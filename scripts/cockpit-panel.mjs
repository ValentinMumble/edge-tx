#!/usr/bin/env node
/**
 * The Cockpit widget's panel: everything on it that never moves, drawn once here into two full-screen pictures the
 * widget pastes each frame, grey, and dark yellow while the motor can spin. Pasting one picture costs the radio far
 * less than drawing these hundred-odd shapes 20 times a second: the panel and its screws, the warning lights' boxes, the
 * lever gates with their notches and the pitch scale's ticks, the gauges' faces (rim, coloured bands, ticks) and
 * windows, the digital windows' frames, the data plate and the cyclic box. The widget draws what moves, and all the
 * text, in the radio's own font.
 *
 * Every position here is one src/cockpit.ts draws the rest against: change both together. The radio keeps a picture
 * without transparency at 16 bits a pixel (RGB565), so colours are snapped to that here, and Flightdown shows what the
 * radio shows. Writes sd-card/WIDGETS/Cockpit/panel.png and panel-live.png.
 */
import {writeFileSync} from 'node:fs';
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

/** The gauges: centre, radius, range, coloured bands (from, to, colour), ticks, the ticks drawn long, the window. */
const GAUGES = [
  {
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
  },
  {
    x: 354,
    y: 121,
    radius: 30,
    low: 0,
    high: 40,
    bands: [[30, 40, RED]],
    ticks: [0, 10, 20, 30, 40],
    long: [0, 20, 40],
    window: [36, 14],
  },
  {
    x: 434,
    y: 121,
    radius: 30,
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
  },
];

/** The lever gates run from y 42 (top) to 198 (bottom): five throttle stops and nine pitch ticks, evenly spaced. */
const TOP = 42;
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

function draw(inside) {
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

  // The six warning lights' boxes, dark: the widget fills a lit one.
  for (let index = 0; index < 6; index += 1) {
    panel.fill(16 + index * 75, 5, 71, 17, 0x0e0f10);
    panel.frame(16 + index * 75, 5, 71, 17, EDGE);
  }

  // The levers' box, the throttle's slot with CUT at its foot and a notch per idle up, the pitch's slot and scale.
  panel.fill(12, 27, 128, 194, 0x08090a);
  panel.frame(12, 27, 128, 194, 0x2a2d30);
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

  for (const spec of GAUGES) gauge(panel, spec);

  // The data plate: the plate, its frame and screws, the picture's box.
  panel.fill(318, 27, 152, 56, 0x2c2f33);
  panel.frame(321, 30, 146, 50, 0x5a5f64);
  screw(panel, 462, 34);
  screw(panel, 462, 76);
  panel.fill(324, 33, 66, 44, 0x0b0c0d);

  // Power, this pack's motor time, the sortie's.
  display(panel, 322, 162, 88);
  display(panel, 322, 180, 88);
  display(panel, 322, 198, 88);

  // The cyclic's box: its cross, dotted, and the ring at the stick's centre.
  panel.fill(420, 158, 48, 48, SLOT);
  panel.frame(420, 158, 48, 48, EDGE);
  panel.dotted(444, 160, 444, 204, EDGE);
  panel.dotted(422, 182, 466, 182, EDGE);
  panel.ring(444, 182, 10, 0x2a2d30);
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

const folder = join(dirname(fileURLToPath(import.meta.url)), '..', 'sd-card', 'WIDGETS', 'Cockpit');
// The panel grey, and dark yellow while live (armed, throttle on), as ARMED and THR ON.
for (const [file, inside] of [
  ['panel', 0x0c0d0e],
  ['panel-live', 0x3a2c06],
]) {
  writeFileSync(join(folder, `${file}.png`), png(draw(inside).rgb565()));
}
console.log('Cockpit panel: panel.png, panel-live.png');
