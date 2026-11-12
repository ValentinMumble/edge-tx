const name = 'Cockpit';

/**
 * The whole screen as a heli's instrument panel (480 × 227, under the top bar):
 * - warning lights across the top: SAFE (green) or ARMED (SA down), THR ON or OFF (SF), LEVEL (SC, self-level),
 *   RESCUE (SH), LOW BATT (or NOT FULL when the pack was not full when plugged in), TELE (no telemetry); the panel
 *   turns dark yellow while the motor can spin;
 * - the throttle as a quadrant: a detent per idle up evenly up the gate, CUT at its foot guarded in hold, the lever at
 *   the motor output (CH3); the pitch as a collective lever against a degree scale, at CH6;
 * - the battery as a fuel gauge: the charge the pack had when plugged in (by its resting volts a cell) less the mAh
 *   used, against the size of the pack picked with the 6-position buttons (the mAh left under the %, the pack under
 *   the gauge), saying the % left every 10% and warning when a pack is not full (mAhRe's sounds);
 * - the model's data plate (picture, name, cells), the amps (with the pack's peak) and volts a cell as gauges, the
 *   power, the time with the motor on this pack (timer 1) and today (timer 2, the sortie), and the cyclic: where the
 *   right stick is, to check it.
 * It is built from EdgeTX's LVGL objects (useLvgl): the radio keeps them on the screen and redraws only what changes,
 * where a widget drawing with lcd calls redraws the whole screen 20 times a second. Everything that never moves is two
 * pictures beside this file (scripts/cockpit-panel.mjs draws them at the positions used here); the rest are objects
 * whose changing properties are functions, read again at each refresh from what refresh() works out once.
 */
const options: any[] = [
  ['Idle1', VALUE, 54, 0, 100],
  ['Idle2', VALUE, 58, 0, 100],
  ['Idle3', VALUE, 75, 0, 100],
  ['PitchRange', VALUE, 12, 1, 20],
];

type Options = {Idle1: number; Idle2: number; Idle3: number; PitchRange: number};
type Light = {word: string; on: boolean; color: number; ink: number};
/** What the screen shows, worked out once a refresh: the objects read it. */
type View = {
  live: boolean;
  motorOff: boolean;
  hold: boolean;
  rescue: boolean;
  idle: number;
  powered: boolean;
  left: number;
  mahLeft: number;
  amps: number;
  cell: number;
  watts: number;
  throttle: number;
  degrees: number;
  aileron: number;
  elevator: number;
  packName: string;
  packMah: number;
  /** Seconds with the motor on: this pack (timer 1), today (timer 2). */
  packTime: number;
  sortieTime: number;
  lights: Light[];
};
type Widget = {
  zone: Zone;
  options: Options;
  powered: boolean;
  /** When the pack's voltage came back (ticks), for the not-full check once it settles; -1 when done. */
  plugged: number;
  notFull: boolean;
  /** The last % left said out loud (100 when nothing yet), and the pack's peak current. */
  said: number;
  peak: number;
  /** The % the pack had when plugged in, from its resting volts a cell (100 when full): the mAh used count from it. */
  startLeft: number;
  /** When the day was last checked for the sortie (getTime, tens of ms). */
  since: number;
  view: View;
};

/** The packs by 6-position button, as the Pack widget and mAhRe have them. */
const PACKS = [
  {name: 'Gens Ace 1', mah: 700},
  {name: 'Gens Ace 2', mah: 700},
  {name: 'OMP 1', mah: 750},
  {name: 'OMP 2', mah: 750},
  {name: 'Eachine 1', mah: 500},
  {name: 'Eachine 2', mah: 500},
];
/** A new pack: its voltage back after none with the mAh count at 0 (see Session). */
const NEW_PACK_MAH = 5;
/** Under this a cell is not full when plugged in (mAhRe's level), and the % left that lights LOW BATT. */
const FULL_CELL = 4.0;
const LOW_FUEL = 25;
/** From this a cell counts as full at rest (89% in the table below, allowing for the voltage sensor's error). */
const FULL_START = 4.1;
const SOUNDS = '/WIDGETS/mAhRe/sounds/';
/** Global variable 9 keeps the day timer 2 last started again: the sortie is today's motor time. */
const SORTIE_DAY = 8;

const rgb = (color: number) => lcd.RGB(color);
const INK = rgb(0xe9ecef);
const MUTED = rgb(0x9aa3ad);
const DIM = rgb(0x6b737c);
const LABEL = rgb(0xc9ced3);
const DIGITS = rgb(0x7cffb2);
const GREEN = rgb(0x4fd18b);
const AMBER = 0xffb020;
const RED = 0xff4d4f;
const UNLIT = rgb(0x4d5257);
const EDGE = rgb(0x3a3d40);

/** The lever gates run from y 42 (top) to 198 (bottom), as in the panel picture. */
const TOP = 42;
const BOTTOM = 198;

/**
 * A channel's output (from 0), the way its mixes make it: the radio gives it after the channel's reversal, and the
 * M2 EVO reverses CH3 and CH6, so its motor at full would read cut.
 */
function output(index: number): number {
  const value = getOutputValue(index);
  return model.getOutput(index)?.revert === 1 ? -value : value;
}
const clamp = (value: number, low: number, high: number) => math.max(low, math.min(high, value));

/** The 6-position button pressed (1 to 6): the buttons read -1024 to 1024 in six steps. */
function button(): number {
  // EdgeTX 2.12.5 names the TX16S's buttons "6pos" in Lua ("P2" in its logs), exactly.
  return clamp(math.floor((getValue('6pos') + 1024) / 409.6 + 0.5) + 1, 1, 6);
}

function pack() {
  return PACKS[button() - 1];
}

function cells(): number {
  const count = model.getGlobalVariable(5, 0);
  return count > 0 ? count : 3;
}

/** A LiPo cell's charge (%) at rest by its voltage: the usual table, read between its points. */
const CHARGE: [number, number][] = [
  [3.3, 0],
  [3.61, 5],
  [3.69, 10],
  [3.71, 15],
  [3.73, 20],
  [3.75, 25],
  [3.77, 30],
  [3.79, 35],
  [3.8, 40],
  [3.82, 45],
  [3.84, 50],
  [3.85, 55],
  [3.87, 60],
  [3.91, 65],
  [3.95, 70],
  [3.98, 75],
  [4.02, 80],
  [4.08, 85],
  [4.11, 90],
  [4.15, 95],
  [4.2, 100],
];
function chargeOf(cell: number): number {
  if (cell <= CHARGE[0][0]) return 0;
  for (let index = 1; index < CHARGE.length; index++) {
    const [volts, percent] = CHARGE[index];
    if (cell <= volts) {
      const [lowVolts, lowPercent] = CHARGE[index - 1];
      return lowPercent + ((cell - lowVolts) / (volts - lowVolts)) * (percent - lowPercent);
    }
  }
  return 100;
}

/** The % of the pack left: what it had when plugged in, less the mAh used since. */
function fuelLeft(widget: Widget): number {
  return clamp(widget.startLeft - (getValue('mAh') / pack().mah) * 100, 0, 100);
}

/** Today as a day of the year (as Session counts it), to start the sortie again each day. */
function today(): number {
  const now = getDateTime();
  const days = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return days[now.mon - 1] + now.day;
}

/**
 * What runs whether the screen shows or not: a new pack starts the checks again; once its voltage settles, the charge
 * it starts with (100% from 4.10 V a cell) and the not-full warning; the % left said at each 10% below that (5%
 * last, then empty), the peak current.
 */
function follow(widget: Widget): void {
  const volts = getValue('VFAS');
  const powered = volts > 0.5;
  const now = getTime();
  if (powered && !widget.powered && getValue('mAh') < NEW_PACK_MAH) {
    widget.plugged = now;
    widget.notFull = false;
    widget.said = 100;
    widget.peak = 0;
    widget.startLeft = 100;
  }
  widget.powered = powered;
  if (!powered) return;
  if (widget.plugged >= 0 && now - widget.plugged >= 200) {
    widget.plugged = -1;
    widget.startLeft = volts / cells() >= FULL_START ? 100 : chargeOf(volts / cells());
    // Said from the next 10% down, not the one it starts in.
    widget.said = math.ceil(widget.startLeft / 10) * 10;
    if (volts / cells() < FULL_CELL) {
      widget.notFull = true;
      playFile(`${SOUNDS}BNFull.wav`);
    }
  }
  widget.peak = math.max(widget.peak, getValue('Curr'));
  const left = fuelLeft(widget);
  const step = left <= 0 ? 0 : left <= 5 ? 5 : math.ceil(left / 10) * 10;
  if (step < widget.said && left < widget.said) {
    widget.said = step;
    playFile(`${SOUNDS}${step === 0 ? 'BatNo' : `Bat${step}L`}.wav`);
  }
}

/** Works out what the screen shows now, once, for the objects to read. */
function look(widget: Widget): void {
  const view = widget.view;
  const armed = getValue('sa') === 1024;
  view.hold = getValue('sf') !== -1024;
  view.rescue = getValue('sh') > 0;
  const mode = getValue('se');
  view.idle = mode <= -512 ? 1 : mode >= 512 ? 3 : 2;
  view.motorOff = view.hold || !armed;
  view.live = !view.motorOff;
  const volts = getValue('VFAS');
  view.powered = volts > 0.5;
  view.amps = view.powered ? getValue('Curr') : 0;
  view.cell = view.powered ? volts / cells() : 0;
  view.left = view.powered ? fuelLeft(widget) : 0;
  view.watts = view.amps * volts;
  const plugged = pack();
  view.packName = plugged.name;
  view.packMah = plugged.mah;
  view.mahLeft = math.floor((plugged.mah * view.left) / 100 + 0.5);
  view.throttle = ((output(2) + 1024) / 2048) * 100;
  view.degrees = (output(5) / 1024) * (widget.options.PitchRange || 12);
  view.aileron = getValue('ail');
  view.elevator = getValue('ele');
  view.packTime = model.getTimer(0).value ?? 0;
  view.sortieTime = model.getTimer(1)?.value ?? 0;

  // SAFE lit green while disarmed, ARMED amber; THR ON amber while the throttle is on (out of hold), THR OFF dark in
  // hold; LEVEL blue with white letters, as the flight mode tile in the top bar, while self-level is on.
  const lights = view.lights;
  const set = (index: number, word: string, on: boolean, color: number, ink = 0x141414) => {
    const light = lights[index];
    light.word = word;
    light.on = on;
    light.color = color;
    light.ink = ink;
  };
  if (armed) set(0, 'ARMED', true, AMBER);
  else set(0, 'SAFE', true, 0x4fd18b);
  set(1, view.hold ? 'THR OFF' : 'THR ON', !view.hold, AMBER);
  set(2, 'LEVEL', getValue('sc') >= 1024, 0x3b75a9, 0xffffff);
  // RESCUE and TELE white on dark red, as FMStatus's RESCUE in the top bar.
  set(3, 'RESCUE', view.rescue, 0x8a1c20, 0xffffff);
  if (widget.notFull && view.left >= LOW_FUEL) set(4, 'NOT FULL', true, AMBER);
  else set(4, 'LOW BATT', view.powered && view.left < LOW_FUEL, RED);
  set(5, 'TELE', getValue('RSSI') <= 0, 0x8a1c20, 0xffffff);
}

/** A point at `radius` from a centre, at `angle` degrees clockwise from 12 o'clock. */
function at(centerX: number, centerY: number, radius: number, angle: number): [number, number] {
  const radians = (angle * math.pi) / 180;
  return [
    math.floor(centerX + math.sin(radians) * radius + 0.5),
    math.floor(centerY - math.cos(radians) * radius + 0.5),
  ];
}

/** EdgeTX's line heights on the TX16S (its fonts' line_height): a label's box is this tall. */
function lineHeight(font: number): number {
  return font === TINSIZE ? 12 : font === SMLSIZE ? 17 : font === BOLD ? 20 : 21;
}

/**
 * A label where lcd.drawText with VCENTER put its text: its box's top half a line above `y`, and `x` its left, its
 * centre (CENTER) or its right (RIGHT), the box as wide as fits on the screen.
 */
function label(
  x: number,
  y: number,
  text: string | (() => string),
  font: number,
  color: number | (() => number),
  align = 0,
): LvglObject {
  const object: LvglObject = {type: 'label', x, y: y - math.floor(lineHeight(font) / 2), text, font, color};
  if (align === CENTER) {
    const width = 2 * math.min(80, x, 480 - x);
    object.x = x - width / 2;
    object.w = width;
    object.align = CENTER;
  } else if (align === RIGHT) {
    const width = math.min(160, x);
    object.x = x - width;
    object.w = width;
    object.align = RIGHT;
  }
  return object;
}

/** m:ss, or h:mm:ss past an hour. */
function clock(seconds: number): string {
  const whole = math.max(0, math.floor(seconds));
  const hours = math.floor(whole / 3600);
  const minutes = math.floor((whole % 3600) / 60);
  return hours > 0
    ? `${hours}:${string.format('%02d:%02d', minutes, whole % 60)}`
    : `${minutes}:${string.format('%02d', whole % 60)}`;
}

type Dial = {
  centerX: number;
  centerY: number;
  radius: number;
  title: string;
  low: number;
  high: number;
  value: () => number;
  labels: [number, string][];
  peak?: () => number;
};

/** A round instrument's figures, peak marker, name, needle and hub: its face and window are in the panel picture. */
function dial(spec: Dial): LvglObject[] {
  const {centerX: x, centerY: y, radius} = spec;
  const big = radius > 50;
  const angle = (value: number) =>
    -135 + ((clamp(value, spec.low, spec.high) - spec.low) / (spec.high - spec.low)) * 270;
  const objects: LvglObject[] = [];
  // The figures on the big gauge only: on a small one they would sit on its name and its window.
  if (big) {
    for (const [value, text] of spec.labels) {
      const [labelX, labelY] = at(x, y, radius - 20, angle(value));
      objects.push(label(labelX, labelY, text, 0, INK, CENTER));
    }
  }
  const peak = spec.peak;
  if (peak) {
    objects.push({
      type: 'triangle',
      color: rgb(AMBER),
      pts: () => {
        const at1 = angle(peak());
        return [at(x, y, radius + 1, at1), at(x, y, radius - 6, at1 - 5), at(x, y, radius - 6, at1 + 5)];
      },
    });
  }
  objects.push(label(x, y - math.floor(radius * 0.32), spec.title, big ? SMLSIZE : TINSIZE, MUTED, CENTER));
  // The needle: a thick line from just behind the hub to near the scale, then the hub over it.
  objects.push({
    type: 'line',
    thickness: big ? 3 : 2,
    rounded: true,
    color: rgb(0xffffff),
    pts: () => {
      const needle = angle(spec.value());
      return [at(x, y, big ? 9 : 6, needle + 180), at(x, y, radius - 5, needle)];
    },
  });
  objects.push({type: 'circle', x, y, radius: big ? 5 : 4, filled: true, color: rgb(0x2a2d30)});
  objects.push({type: 'circle', x, y, radius: big ? 5 : 4, color: rgb(0x888888)});
  return objects;
}

/**
 * A small digital window's words (its frame is in the panel picture, 88 wide at x 322): its name on the left, its value
 * on the right.
 */
function readout(y: number, title: string, value: () => string): LvglObject[] {
  return [label(326, y + 7, title, TINSIZE, MUTED), label(406, y + 7, value, SMLSIZE, DIGITS, RIGHT)];
}

/** Every object of the screen, in drawing order, for the options as they are. */
function objects(widget: Widget): LvglObject[] {
  const view = widget.view;
  const list: LvglObject[] = [
    // The panel's fixed parts, grey, or dark yellow while live (armed, throttle on: the motor can spin).
    {type: 'image', x: 0, y: 0, w: 480, h: 227, file: '/WIDGETS/Cockpit/panel.png'},
    {type: 'image', x: 0, y: 0, w: 480, h: 227, file: '/WIDGETS/Cockpit/panel-live.png', visible: () => view.live},
  ];

  // The warning lights: their boxes are in the panel picture, dark; a lit light fills its own.
  view.lights.forEach((light, index) => {
    const x = 16 + index * 75;
    list.push(
      {type: 'rectangle', x, y: 5, w: 71, h: 17, filled: true, color: () => rgb(light.color), visible: () => light.on},
      {type: 'rectangle', x, y: 5, w: 71, h: 17, color: EDGE, visible: () => light.on},
      label(
        x + 35,
        13,
        () => light.word,
        SMLSIZE,
        () => (light.on ? rgb(light.ink) : UNLIT),
        CENTER,
      ),
    );
  });

  // The throttle quadrant: a detent for each idle up, evenly spaced up the gate whatever their throttles (54, 58 and
  // 75 % are close), CUT at the foot. The lever stands at the motor output, in proportion between the detents.
  const idles = [widget.options.Idle1, widget.options.Idle2, widget.options.Idle3];
  const stops = [0, ...idles, 100];
  const stopY = (index: number) => math.floor(BOTTOM - (index / (stops.length - 1)) * (BOTTOM - TOP));
  const throttleY = (percent: number) => {
    for (let index = 1; index < stops.length; index++) {
      if (percent <= stops[index] || index === stops.length - 1) {
        const span = stops[index] - stops[index - 1];
        const share = span > 0 ? clamp((percent - stops[index - 1]) / span, 0, 1) : 1;
        return math.floor(stopY(index - 1) - share * (stopY(index - 1) - stopY(index)));
      }
    }
    return BOTTOM;
  };
  list.push(
    label(44, 34, 'THROTTLE', TINSIZE, LABEL, CENTER),
    label(108, 34, 'PITCH', TINSIZE, LABEL, CENTER),
    label(26, stopY(0) - 5, 'CUT', TINSIZE, rgb(RED), RIGHT),
  );
  idles.forEach((level, index) => {
    const y = stopY(index + 1);
    const current = () => view.idle === index + 1 && !view.motorOff;
    // The gate's notch is in the panel picture, its edges lit green at the idle up flown; its placard: IU 2 / 58.
    list.push(
      {type: 'hline', x: 33, y: y - 3, w: 7, h: 1, color: GREEN, visible: current},
      {type: 'hline', x: 33, y: y + 3, w: 7, h: 1, color: GREEN, visible: current},
      label(30, y - 5, `IU${index + 1}`, TINSIZE, () => (current() ? GREEN : MUTED), RIGHT),
      label(30, y + 5, `${level}`, TINSIZE, DIM, RIGHT),
    );
  });
  // The throttle's T-handle across its gate: a stem out of the slot, a knob lit along its top edge and shaded along its
  // foot, with grip ridges; grey when the motor cannot run.
  const ridges: LvglObject[] = [];
  for (let ridge = -12; ridge <= 12; ridge += 4) {
    ridges.push({
      type: 'vline',
      x: 23 + ridge,
      y: 5,
      w: 1,
      h: 10,
      color: () => (view.motorOff ? rgb(0x5d636a) : rgb(0x9aa0a6)),
    });
  }
  list.push({
    type: 'box',
    x: 21,
    y: BOTTOM - 10,
    w: 46,
    h: 23,
    pos: () => $multi(21, throttleY(view.throttle) - 10),
    children: [
      {type: 'rectangle', x: 21, y: 17, w: 4, h: 6, filled: true, color: rgb(0x5a5f64)},
      {type: 'rectangle', x: 0, y: 0, w: 46, h: 20, filled: true, color: rgb(0x020303)},
      {
        type: 'rectangle',
        x: 2,
        y: 2,
        w: 42,
        h: 16,
        filled: true,
        color: () => (view.motorOff ? rgb(0x7b8189) : rgb(0xdfe3e7)),
      },
      {type: 'hline', x: 2, y: 2, w: 42, h: 1, color: () => (view.motorOff ? rgb(0x9aa0a6) : rgb(0xffffff))},
      {type: 'hline', x: 2, y: 17, w: 42, h: 1, color: rgb(0x4a4f55)},
      ...ridges,
    ],
  });
  // The guard in hold: a striped bar across the gate above CUT, as on a real quadrant.
  const stripes: LvglObject[] = [];
  for (let stripe = 0; stripe < 4; stripe++) {
    stripes.push({
      type: 'rectangle',
      x: 2 + stripe * 4,
      y: 1,
      w: 2,
      h: 5,
      filled: true,
      color: rgb(stripe % 2 === 0 ? AMBER : 0x141414),
    });
  }
  list.push({
    type: 'box',
    x: 34,
    y: stopY(0) - 23,
    w: 20,
    h: 7,
    visible: () => view.hold,
    children: [...stripes, {type: 'rectangle', x: 0, y: 0, w: 20, h: 7, color: rgb(AMBER)}],
  });
  list.push(
    label(
      44,
      BOTTOM + 14,
      () => (view.motorOff ? 'CUT' : `${math.floor(view.throttle + 0.5)}%`),
      SMLSIZE,
      () => (view.motorOff ? rgb(RED) : DIGITS),
      CENTER,
    ),
  );

  // The collective: its scale's ticks are in the panel picture, evenly spaced whatever the range; its figures every
  // half range, and the grip at the pitch: rounder, a thumb switch on its top, red while rescue drives it.
  const range = widget.options.PitchRange || 12;
  const pitchY = (value: number) =>
    math.floor(BOTTOM - ((clamp(value, -range, range) + range) / (2 * range)) * (BOTTOM - TOP));
  for (let step = 0; step <= 4; step++) {
    const mark = -range + (step * range) / 2;
    const text = mark === 0 ? '0' : `${mark > 0 ? '+' : ''}${math.floor(mark + 0.5)}`;
    list.push(label(90, pitchY(mark), text, TINSIZE, mark === 0 ? LABEL : MUTED, RIGHT));
  }
  const grip = () => (view.rescue ? rgb(RED) : rgb(0xbfc5cb));
  list.push({
    type: 'box',
    x: 82,
    y: pitchY(0) - 9,
    w: 53,
    h: 18,
    pos: () => $multi(82, pitchY(view.degrees) - 9),
    children: [
      {type: 'rectangle', x: 5, y: 0, w: 42, h: 18, filled: true, color: rgb(0x020303)},
      {type: 'rectangle', x: 7, y: 2, w: 38, h: 14, filled: true, color: grip},
      {type: 'circle', x: 7, y: 9, radius: 7, filled: true, color: grip},
      {type: 'circle', x: 45, y: 9, radius: 7, filled: true, color: grip},
      {type: 'hline', x: 9, y: 2, w: 35, h: 1, color: () => (view.rescue ? rgb(0xffb0b0) : rgb(0xf1f3f5))},
      {type: 'circle', x: 38, y: 8, radius: 3, filled: true, color: rgb(0x2a2d30)},
    ],
  });
  list.push(
    label(
      108,
      BOTTOM + 14,
      () => `${view.degrees >= 0 ? '+' : ''}${math.floor(view.degrees + 0.5)}°`,
      SMLSIZE,
      () => (view.rescue ? rgb(RED) : DIGITS),
      CENTER,
    ),
  );

  // The battery as a fuel gauge: the pack left, E to F, the % in its window and the mAh left under it.
  list.push(
    ...dial({
      centerX: 226,
      centerY: 117,
      radius: 72,
      title: 'BATTERY',
      low: 0,
      high: 100,
      value: () => view.left,
      labels: [
        [0, 'E'],
        [50, '1/2'],
        [100, 'F'],
      ],
    }),
  );
  const powered = () => view.powered;
  list.push(
    {...label(226, 147, () => `${math.floor(view.left + 0.5)}%`, 0, DIGITS, CENTER), visible: powered},
    {...label(226, 162, () => `${view.mahLeft} mAh`, SMLSIZE, DIGITS, CENTER), visible: powered},
    {...label(226, 154, '--', 0, DIGITS, CENTER), visible: () => !view.powered},
  );
  // Under it, the pack the buttons pick; with no voltage in, a warning above it.
  list.push(
    {...label(226, 201, 'No battery detected', SMLSIZE, rgb(AMBER), CENTER), visible: () => !view.powered},
    {
      ...label(
        226,
        210,
        () => `${view.packName}, ${view.packMah} mAh`,
        SMLSIZE,
        () => (view.powered ? LABEL : MUTED),
        CENTER,
      ),
      pos: () => $multi(146, view.powered ? 202 : 206),
    },
  );

  // The data plate (the plate, its frame and screws, the picture's box are in the panel picture).
  const info = model.getInfo();
  if (info.bitmap && info.bitmap !== '') {
    list.push({type: 'image', x: 324, y: 33, w: 66, h: 44, file: `/IMAGES/${info.bitmap}`});
  }
  list.push(
    label(398, 40, 'MODEL', TINSIZE, MUTED),
    // EdgeTX's bold font: on a colour radio BOLD is a size of its own, added to another it makes it bigger.
    label(398, 56, info.name ?? '', BOLD, rgb(0xf1f3f5)),
    label(398, 72, () => `${cells()}S`, SMLSIZE, MUTED),
  );

  // Amps (with the pack's peak) and volts a cell.
  list.push(
    ...dial({
      centerX: 354,
      centerY: 121,
      radius: 30,
      title: 'AMPS',
      low: 0,
      high: 40,
      value: () => view.amps,
      labels: [],
      peak: () => widget.peak,
    }),
    label(354, 137, () => `${math.floor(view.amps + 0.5)}A`, SMLSIZE, DIGITS, CENTER),
    ...dial({
      centerX: 434,
      centerY: 121,
      radius: 30,
      title: 'CELL',
      low: 3.2,
      high: 4.2,
      value: () => view.cell,
      labels: [],
    }),
    label(434, 137, () => (view.powered ? string.format('%.2f', view.cell) : '--'), SMLSIZE, DIGITS, CENTER),
  );

  // The power, and the time with the motor on: this pack, and the whole sortie (today).
  list.push(
    ...readout(162, 'POWER', () => `${math.floor(view.watts + 0.5)} W`),
    ...readout(180, 'PACK', () => clock(view.packTime)),
    ...readout(198, 'SORTIE', () => clock(view.sortieTime)),
  );

  // The cyclic (the right stick): a dot where aileron and elevator put it, their values under it (its box, cross and
  // ring are in the panel picture).
  const percent = (value: number) => `${value >= 0 ? '+' : ''}${math.floor((value / 1024) * 100 + 0.5)}`;
  list.push(
    {
      type: 'circle',
      x: 444,
      y: 182,
      radius: 3,
      filled: true,
      color: GREEN,
      pos: () =>
        $multi(
          444 + math.floor((clamp(view.aileron, -1024, 1024) / 1024) * 20),
          182 - math.floor((clamp(view.elevator, -1024, 1024) / 1024) * 20),
        ),
    },
    label(444, 213, () => `A${percent(view.aileron)} E${percent(view.elevator)}`, TINSIZE, DIGITS, CENTER),
  );
  return list;
}

function create(zone: Zone, options: Options): Widget {
  const lights: Light[] = [];
  for (let index = 0; index < 6; index++) lights.push({word: '', on: false, color: 0, ink: 0});
  const widget: Widget = {
    zone,
    options,
    powered: false,
    plugged: -1,
    notFull: false,
    said: 100,
    peak: 0,
    startLeft: 100,
    since: getTime(),
    view: {
      live: false,
      motorOff: true,
      hold: true,
      rescue: false,
      idle: 2,
      powered: false,
      left: 0,
      mahLeft: 0,
      amps: 0,
      cell: 0,
      watts: 0,
      throttle: 0,
      degrees: 0,
      aileron: 0,
      elevator: 0,
      packName: '',
      packMah: 0,
      packTime: 0,
      sortieTime: 0,
      lights,
    },
  };
  update(widget, options);
  return widget;
}

/** New options (idle ups, pitch range): the screen built again for them. */
function update(widget: Widget, options: Options): void {
  widget.options = options;
  look(widget);
  lvgl.clear();
  lvgl.build(objects(widget));
}

function background(widget: Widget): void {
  follow(widget);
}

function refresh(widget: Widget): void {
  follow(widget);
  look(widget);
  const now = getTime();
  if (now - widget.since >= 100) {
    widget.since = now;
    // Once a second: a new day starts the sortie (timer 2) again.
    if (model.getGlobalVariable(SORTIE_DAY, 0) !== today()) {
      model.resetTimer(1);
      model.setGlobalVariable(SORTIE_DAY, 0, today());
    }
  }
}

const useLvgl = true;

export {refresh, background, name, create, update, options, useLvgl};
