#!/usr/bin/env node
/**
 * The Cockpit widget's panel: everything on it that never moves, drawn once here into two full-screen pictures the
 * widget pastes each frame, grey, and dark red while the motor can spin. Pasting one picture costs the radio far
 * less than drawing these hundred-odd shapes 20 times a second: the panel and its screws, the warning lights' boxes, the
 * lever gates with their notches and the pitch scale's ticks, the gauges' faces (rim, coloured bands, ticks) and
 * windows, the digital windows' frames, the data plate, the cyclic box and the rudder's track. The widget draws what moves, and all the
 * text, in the radio's own font.
 *
 * The K110S's cockpit (src/k110s-cockpit.ts) is the same panel, so nothing moves when switching models, with two
 * changes: its big gauge is the Pack timer's (4:00 to 0, a tick every 30 s), and three idle up tiles stand where the
 * cell gauge is (it has no telemetry).
 *
 * Every position here is one src/cockpit.ts and src/k110s-cockpit.ts draw the rest against: change them together. The
 * radio keeps a picture without transparency at 16 bits a pixel (RGB565), so colours are snapped to that here, and
 * Flightdown shows what the radio shows. Writes panel.png and panel-live.png in sd-card/WIDGETS/Cockpit and
 * sd-card/WIDGETS/K110Cockpit.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';

const WIDTH = 480;
const HEIGHT = 227;
/** Samples a pixel's side is cut into, for smooth edges on circles, arcs and slanted lines. */
const SAMPLES = 4;

const RED = 0xff4d4f;
const AMBER = 0xffb020;
const GREEN = 0x2f8f5b;
const INK = 0xe9ecef;
const LABEL = 0xc9ced3;
const DIM = 0x6b737c;
const SLOT = 0x020303;
const EDGE = 0x3a3d40;
const WINDOW = 0x050606;
const WINDOW_EDGE = 0x33373b;

/** A gauge: centre, radius, range, coloured bands (from, to, colour), ticks, the ticks drawn long, the window. */
const BATTERY = {
  x: 226,
  y: 117,
  radius: 72,
  low: 0,
  high: 100,
  bands: [
    [0, 20, RED],
    [20, 35, AMBER],
    [35, 100, GREEN],
  ],
  ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  long: [0, 50, 100],
  window: [56, 33],
};
/** Volts a cell, over the cyclic's box. */
const CELL = {
  x: 442,
  y: 121,
  radius: 28,
  low: 3.2,
  high: 4.2,
  bands: [
    [3.2, 3.3, RED],
    [3.3, 3.5, AMBER],
    [3.5, 4.2, GREEN],
  ],
  ticks: [3.2, 3.4, 3.6, 3.8, 4.0, 4.2],
  long: [3.2, 4.2],
  window: [36, 14],
};
/**
 * The K110S's Pack timer in the battery's place, in seconds left of 4:00: red under 30 s (where its LOW BATT lights),
 * amber under a minute.
 */
const PACK_TIME = {
  ...BATTERY,
  high: 240,
  bands: [
    [0, 30, RED],
    [30, 60, AMBER],
    [60, 240, GREEN],
  ],
  ticks: [0, 30, 60, 90, 120, 150, 180, 210, 240],
  long: [0, 120, 240],
};
/** The K110S's three idle up tiles in the cell gauge's place, one over the other: its widget fills the one flown. */
const TILES = {x: 412, y: 92, width: 60, height: 19, step: 21};

/** Each widget's panel: its folder, its gauges and whether it has the idle up tiles. */
const PANELS = [
  {folder: 'Cockpit', gauges: [BATTERY, CELL], tiles: false},
  {folder: 'K110Cockpit', gauges: [PACK_TIME], tiles: true},
];

/** The lever gates run from y 42 (top) to 198 (bottom): five throttle stops and nine pitch ticks, evenly spaced. */
const TOP = 55;
const BOTTOM = 198;
const stopY = index => Math.floor(BOTTOM - (index / 4) * (BOTTOM - TOP));
const tickY = index => Math.floor(BOTTOM - (index / 8) * (BOTTOM - TOP));

/** A picture being drawn: red, green and blue per pixel, painted over in order. */
class Panel {
  pixels = new Float64Array(WIDTH * HEIGHT * 3);

  paint(x, y, color, cover = 1) {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT || cover <= 0) return;
    const at = (y * WIDTH + x) * 3;
    [color >> 16, (color >> 8) & 0xff, color & 0xff].forEach((channel, index) => {
      this.pixels[at + index] = this.pixels[at + index] * (1 - cover) + channel * cover;
    });
  }

  /** lcd.drawFilledRectangle: x to x + width - 1, y to y + height - 1. */
  fill(x, y, width, height, color) {
    for (let row = y; row < y + height; row += 1)
      for (let column = x; column < x + width; column += 1) this.paint(column, row, color);
  }

  /** lcd.drawRectangle: a one-pixel frame on the same bounds. */
  frame(x, y, width, height, color) {
    this.fill(x, y, width, 1, color);
    this.fill(x, y + height - 1, width, 1, color);
    this.fill(x, y, 1, height, color);
    this.fill(x + width - 1, y, 1, height, color);
  }

  /** A dotted straight line (lcd.drawLine with DOTTED): every other pixel. */
  dotted(x1, y1, x2, y2, color) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let step = 0; step <= steps; step += 2) {
      this.paint(x1 + Math.sign(x2 - x1) * step, y1 + Math.sign(y2 - y1) * step, color);
    }
  }

  /** A smooth shape: each pixel of the box covered by the share of its samples `inside` says (pixel centres at .5). */
  shape(left, top, right, bottom, inside, color) {
    for (let row = Math.floor(top); row <= Math.ceil(bottom); row += 1) {
      for (let column = Math.floor(left); column <= Math.ceil(right); column += 1) {
        let covered = 0;
        for (let down = 0; down < SAMPLES; down += 1) {
          for (let across = 0; across < SAMPLES; across += 1) {
            if (inside(column + (across + 0.5) / SAMPLES, row + (down + 0.5) / SAMPLES)) covered += 1;
          }
        }
        this.paint(column, row, color, covered / (SAMPLES * SAMPLES));
      }
    }
  }

  /** lcd.drawFilledCircle: a disc of 2r + 1 pixels across, centred on the middle of pixel (x, y). */
  disc(x, y, radius, color) {
    const [centerX, centerY] = [x + 0.5, y + 0.5];
    const reach = radius + 1;
    this.shape(
      x - reach,
      y - reach,
      x + reach,
      y + reach,
      (px, py) => Math.hypot(px - centerX, py - centerY) <= radius + 0.5,
      color,
    );
  }

  /** lcd.drawCircle: a one-pixel ring on the same edge. */
  ring(x, y, radius, color) {
    const [centerX, centerY] = [x + 0.5, y + 0.5];
    const reach = radius + 1;
    this.shape(
      x - reach,
      y - reach,
      x + reach,
      y + reach,
      (px, py) => Math.abs(Math.hypot(px - centerX, py - centerY) - radius) <= 0.5,
      color,
    );
  }

  /** A line between pixel centres, `width` wide (lcd.drawLine is one pixel). */
  line([x1, y1], [x2, y2], color, width = 1) {
    this.shape(
      Math.min(x1, x2) - width,
      Math.min(y1, y2) - width,
      Math.max(x1, x2) + width,
      Math.max(y1, y2) + width,
      (px, py) => toSegment(px, py, [x1 + 0.5, y1 + 0.5], [x2 + 0.5, y2 + 0.5]) <= width / 2,
      color,
    );
  }

  /** As the radio shows it: each pixel at 5, 6 and 5 bits, red, green and blue. */
  rgb565() {
    const rows = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
    for (let row = 0; row < HEIGHT; row += 1) {
      const start = row * (1 + WIDTH * 3);
      for (let column = 0; column < WIDTH; column += 1) {
        const at = (row * WIDTH + column) * 3;
        const [red, green, blue] = [0, 1, 2].map(index =>
          Math.max(0, Math.min(255, Math.round(this.pixels[at + index]))),
        );
        const [red5, green6, blue5] = [red >> 3, green >> 2, blue >> 3];
        rows.set(
          [(red5 << 3) | (red5 >> 2), (green6 << 2) | (green6 >> 4), (blue5 << 3) | (blue5 >> 2)],
          start + 1 + column * 3,
        );
      }
    }
    return rows;
  }
}

/** How far a point is from a segment. */
function toSegment(x, y, [x1, y1], [x2, y2]) {
  const [dx, dy] = [x2 - x1, y2 - y1];
  const length = dx * dx + dy * dy;
  const share = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
  return Math.hypot(x - (x1 + share * dx), y - (y1 + share * dy));
}

function screw(panel, x, y) {
  panel.disc(x, y, 3, 0x2c2f32);
  panel.ring(x, y, 3, 0x4a4e52);
  panel.line([x - 2, y - 1], [x + 2, y + 1], 0x15171a);
}

/** A gauge's face (rim, groove, face, coloured bands, ticks) and its digital window. */
function gauge(panel, {x, y, radius, low, high, bands, ticks, long, window}) {
  const angleOf = value => -135 + ((value - low) / (high - low)) * 270;
  const [centerX, centerY] = [x + 0.5, y + 0.5];
  const point = (distance, angle) => {
    const radians = (angle * Math.PI) / 180;
    return [centerX + Math.sin(radians) * distance, centerY - Math.cos(radians) * distance];
  };
  panel.disc(x, y, radius + 5, EDGE);
  panel.disc(x, y, radius + 2, 0x0b0c0d);
  panel.disc(x, y, radius, 0x121315);
  for (const [from, to, color] of bands) {
    const [start, end] = [angleOf(from), angleOf(to)];
    panel.shape(
      x - radius,
      y - radius,
      x + radius,
      y + radius,
      (px, py) => {
        const distance = Math.hypot(px - centerX, py - centerY);
        const angle = (Math.atan2(px - centerX, centerY - py) * 180) / Math.PI;
        return distance >= radius - 6.5 && distance <= radius - 2.5 && angle >= start && angle <= end;
      },
      color,
    );
  }
  for (const value of ticks) {
    const [outer, inner] = [
      point(radius - 1, angleOf(value)),
      point(radius - (long.includes(value) ? 10 : 6), angleOf(value)),
    ];
    panel.shape(
      Math.min(outer[0], inner[0]) - 1,
      Math.min(outer[1], inner[1]) - 1,
      Math.max(outer[0], inner[0]) + 1,
      Math.max(outer[1], inner[1]) + 1,
      (px, py) => toSegment(px, py, outer, inner) <= 0.55,
      INK,
    );
  }
  const [width, height] = window;
  const windowX = x - width / 2;
  const windowY = y + Math.floor(radius * 0.3);
  panel.fill(windowX, windowY, width, height, WINDOW);
  panel.frame(windowX, windowY, width, height, WINDOW_EDGE);
}

/** A small digital window's frame, as the widget's display() fills it. */
function display(panel, x, y, width) {
  panel.fill(x, y, width, 15, WINDOW);
  panel.frame(x, y, width, 15, WINDOW_EDGE);
}

function draw(inside, {gauges, tiles}) {
  const panel = new Panel();
  panel.fill(0, 0, WIDTH, HEIGHT, 0x050606);
  panel.fill(2, 2, WIDTH - 4, HEIGHT - 4, inside);
  for (const [x, y] of [
    [8, 8],
    [WIDTH - 8, 8],
    [8, HEIGHT - 8],
    [WIDTH - 8, HEIGHT - 8],
  ])
    screw(panel, x, y);

  // The arming switch's box across the first two lights' places: the widget lights it and draws the switch.
  panel.fill(16, 5, 146, 31, 0x0e0f10);
  panel.frame(16, 5, 146, 31, EDGE);
  // The other warning lights' boxes, dark: the widget fills a lit one.
  for (let index = 2; index < 6; index += 1) {
    panel.fill(16 + index * 75, 5, 71, 17, 0x0e0f10);
    panel.frame(16 + index * 75, 5, 71, 17, EDGE);
  }

  // The levers' box, the throttle's slot with CUT at its foot and a notch per idle up, the pitch's slot and scale.
  panel.fill(12, 40, 128, 181, 0x08090a);
  panel.frame(12, 40, 128, 181, 0x2a2d30);
  panel.fill(40, TOP, 8, BOTTOM - TOP, SLOT);
  panel.frame(39, TOP - 1, 10, BOTTOM - TOP + 2, EDGE);
  panel.fill(40, stopY(0) - 14, 8, 14, 0x5c1a1f);
  for (const index of [1, 2, 3]) {
    const y = stopY(index);
    panel.fill(33, y - 2, 7, 5, SLOT);
    panel.fill(33, y - 3, 7, 1, LABEL);
    panel.fill(33, y + 3, 7, 1, LABEL);
  }
  panel.fill(104, TOP, 8, BOTTOM - TOP, SLOT);
  panel.frame(103, TOP - 1, 10, BOTTOM - TOP + 2, EDGE);
  for (let index = 0; index <= 8; index += 1) {
    const major = index % 2 === 0;
    panel.fill(major ? 92 : 96, tickY(index), major ? 10 : 6, 1, index === 4 ? LABEL : DIM);
  }
  display(panel, 20, BOTTOM + 7, 48);
  display(panel, 84, BOTTOM + 7, 48);

  for (const spec of gauges) gauge(panel, spec);
  if (tiles) {
    for (let index = 0; index < 3; index += 1) {
      panel.fill(TILES.x, TILES.y + index * TILES.step, TILES.width, TILES.height, 0x0e0f10);
      panel.frame(TILES.x, TILES.y + index * TILES.step, TILES.width, TILES.height, EDGE);
    }
  }

  // The data plate: the plate, its frame and screws, the picture's box.
  panel.fill(318, 27, 152, 56, 0x2c2f33);
  panel.frame(321, 30, 146, 50, 0x5a5f64);
  screw(panel, 462, 34);
  screw(panel, 462, 76);
  panel.fill(324, 33, 66, 44, 0x0b0c0d);

  // The pitch curve's box, its title over the plot and the plot's cross, dotted, at the middle of the stick and pitch
  // (the widget draws the curve and its dot, centred on 363, 157, 38 across and 44 up each way).
  panel.fill(320, 92, 86, 114, SLOT);
  panel.frame(320, 92, 86, 114, EDGE);
  panel.dotted(325, 157, 401, 157, EDGE);
  panel.dotted(363, 113, 363, 201, EDGE);

  // The cyclic's box: its cross, dotted, and the ring at the stick's centre. The rudder's track under it, its middle
  // marked.
  panel.fill(421, 154, 42, 42, SLOT);
  panel.frame(421, 154, 42, 42, EDGE);
  panel.dotted(442, 156, 442, 194, EDGE);
  panel.dotted(423, 175, 461, 175, EDGE);
  panel.ring(442, 175, 9, 0x2a2d30);
  panel.fill(421, 199, 42, 6, SLOT);
  panel.frame(421, 199, 42, 6, EDGE);
  panel.fill(442, 200, 1, 4, EDGE);
  return panel;
}

const CRC_TABLE = Array.from({length: 256}, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, sum]);
}

/** An RGB PNG from its rows (each led by its filter byte, 0). */
function png(rows) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, {level: 9})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const widgets = join(dirname(fileURLToPath(import.meta.url)), '..', 'sd-card', 'WIDGETS');
for (const spec of PANELS) {
  const folder = join(widgets, spec.folder);
  mkdirSync(folder, {recursive: true});
  // The panel grey, and dark red while live (armed, throttle on), as the switch's THR ON.
  for (const [file, inside] of [
    ['panel', 0x0c0d0e],
    ['panel-live', 0x3d0c0f],
  ]) {
    writeFileSync(join(folder, `${file}.png`), png(draw(inside, spec).rgb565()));
  }
}
console.log(`Cockpit panels: panel.png, panel-live.png in ${PANELS.map(spec => spec.folder).join(', ')}`);
