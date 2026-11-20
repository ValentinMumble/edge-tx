const name = 'K110Cockpit';

/**
 * The K110S's whole screen (480 × 227, under the top bar), laid out exactly as the M2 EVO's Cockpit so nothing moves
 * when switching models: each place shows the same thing, or the K110S's nearest one, as it has no telemetry.
 * - The warning lights in the Cockpit's slots: SAFE (green) or ARMED (SA down), THR ON or OFF (SF), LEVEL (SC down,
 *   6G self-level), RESCUE while SH is held (k110s_rescue.py: 6G, then a climb), TELE always dark (it has no
 *   telemetry), LOW BATT once the Pack timer has under 30 s left;
 *   the panel turns dark yellow while the motor can spin.
 * - The throttle as a quadrant: a detent per idle up (LOW, IU2, IU3, at the throttle each gives at mid stick, from the
 *   model's curves), CUT at its foot guarded in hold, the lever at the motor output (CH3); the collective at CH6
 *   against a degree scale.
 * - The Pack timer (timer 1, counting down from 4:00 as fast as CH9 says: a second a second at 90 % throttle) as the
 *   fuel gauge, the time left in its window and how fast it counts under it; the sortie (timer 2) under the gauge.
 * - The data plate; the throttle curves where the Cockpit draws its pitch curve (Low RPM, IU2 and IU3, the one SE
 *   picks lit, with a dot at the throttle stick), and that idle up's pitch curve over them in blue (CPL in Low RPM,
 *   the stick straight in IU2 and IU3), with a dot at the pitch sent; the idle ups as three tiles where the Cockpit
 *   has its cell gauge, in SE's order (LOW up, IU2 middle, IU3 down), the one picked lit; the cyclic.
 * Built as the Cockpit is, from EdgeTX's LVGL objects over two pictures of what never moves (scripts/cockpit-panel.mjs
 * draws both widgets' panels at the same positions); the curves are read again once a second, so a change made on the
 * radio shows.
 */
const options: any[] = [['PitchRange', VALUE, 12, 1, 20]];

type Options = {PitchRange: number};
type Light = {word: string; on: boolean; color: number; ink: number};
/** An idle up as SE picks it: its word, the curve its CH3 line flies (by name in the model) and the level if none. */
/**
 * An idle up: its word, its throttle curve by name (and the throttle drawn when the model has none), and its pitch
 * curve by name, none for the collective stick straight through (the model's Pitch line on CH6).
 */
type Mode = {word: string; curve: string; fallback: number; pitch?: string};
/** What an idle up's curve gives, worked out when the curves are read: the objects read it. */
type Shape = {
  curve?: Curve;
  /** The curve across its plot, and where its label sits (y). */
  points: [number, number][];
  /** Its pitch curve across the same plot (the collective stick across, the pitch up). */
  pitch: [number, number][];
  labelY: number;
  /** Its throttle (0 to 100 %) at mid stick, and its lowest and highest. */
  level: number;
  low: number;
  high: number;
};
/** What the screen shows, worked out once a refresh: the objects read it. */
type View = {
  live: boolean;
  motorOff: boolean;
  hold: boolean;
  /** The idle up SE picks, 1 (up, Low RPM) to 3. */
  idle: number;
  throttle: number;
  /** The throttle stick (-1024 to 1024). */
  stick: number;
  degrees: number;
  /** The pitch sent (CH6, -100 to 100 %). */
  collective: number;
  aileron: number;
  elevator: number;
  /** The Pack timer: seconds left (below 0 once past), seconds it starts from, how fast it counts now (0 to 1). */
  left: number;
  start: number;
  rate: number;
  sortie: number;
  lights: Light[];
};
type Widget = {
  zone: Zone;
  options: Options;
  /** The idle ups' curves, as MODES orders them. */
  shapes: Shape[];
  /** When the curves were last read (getTime, tens of ms). */
  since: number;
  view: View;
};

/** SE up, middle, down: the curves are the model's CH3 and CH6 lines' (k110s_iu1_low.py). */
const MODES: Mode[] = [
  {word: 'LOW', curve: 'Low', fallback: 60, pitch: 'CPL'},
  {word: 'IU2', curve: 'IU2', fallback: 80},
  {word: 'IU3', curve: 'IU3', fallback: 90},
];
/** Under this many seconds left on the Pack timer, LOW BATT lights (it has no telemetry to tell). */
const LOW_TIME = 30;

const rgb = (color: number) => lcd.RGB(color);
const INK = rgb(0xe9ecef);
const MUTED = rgb(0x9aa3ad);
const DIM = rgb(0x6b737c);
const LABEL = rgb(0xc9ced3);
const DIGITS = rgb(0x7cffb2);
const GREEN = rgb(0x4fd18b);
/** The pitch curve and its dot, over the green throttle curves. */
const BLUE = rgb(0x6cb4ff);
const AMBER = 0xffb020;
const RED = 0xff4d4f;
const UNLIT = rgb(0x4d5257);
const EDGE = rgb(0x3a3d40);
const DARK_INK = 0x141414;

/** The lever gates run from y 42 (top) to 198 (bottom), as in the panel picture. */
const TOP = 42;
const BOTTOM = 198;
/** The idle up tiles, as in the panel picture: one over the other where the Cockpit has its cell gauge. */
const TILE_X = 412;
const TILE_Y = 92;
const TILE_W = 60;
const TILE_H = 19;
const TILE_STEP = 21;

/** A channel's output (from 0), its reversal undone (the K110S reverses none of CH3, CH6 and CH9). */
function output(index: number): number {
  const value = getOutputValue(index);
  return model.getOutput(index)?.revert === 1 ? -value : value;
}
const clamp = (value: number, low: number, high: number) => math.max(low, math.min(high, value));
const round = (value: number) => math.floor(value + 0.5);

/** A timer's seconds as the radio shows them: 3:42, -0:12 once past zero, 1h07 past an hour. */
function clock(seconds: number): string {
  const whole = math.floor(math.abs(seconds));
  const hours = math.floor(whole / 3600);
  const minutes = math.floor((whole % 3600) / 60);
  const sign = seconds < 0 ? '-' : '';
  return hours > 0
    ? `${sign}${hours}h${string.format('%02d', minutes)}`
    : `${sign}${minutes}:${string.format('%02d', whole % 60)}`;
}

/** Works out what the screen shows now, once, for the objects to read. */
function look(widget: Widget): void {
  const view = widget.view;
  const armed = getValue('sa') === 1024;
  view.hold = getValue('sf') !== -1024;
  const mode = getValue('se');
  view.idle = mode <= -512 ? 1 : mode >= 512 ? 3 : 2;
  view.motorOff = view.hold || !armed;
  view.live = !view.motorOff;
  view.stick = getValue('thr');
  view.throttle = ((output(2) + 1024) / 2048) * 100;
  view.degrees = (output(5) / 1024) * (widget.options.PitchRange || 12);
  view.collective = (output(5) / 1024) * 100;
  view.aileron = getValue('ail');
  view.elevator = getValue('ele');
  const pack = model.getTimer(0);
  view.start = (pack?.start ?? 0) > 0 ? (pack?.start as number) : 240;
  view.left = pack?.value ?? view.start;
  view.sortie = model.getTimer(1)?.value ?? 0;
  // The Pack timer counts relative to CH9 (THR_REL): from nothing at -100 % to a second a second at 100 %, only while
  // the motor may run (its switch, !L10). The radio reads CH9 after its reversal, as getOutputValue gives it.
  view.rate = view.live ? clamp((getOutputValue(8) + 1024) / 2048, 0, 1) : 0;

  // The Cockpit's lights, slot for slot: RESCUE while SH is held, TELE dark (no telemetry, which is normal here).
  const lights = view.lights;
  const set = (index: number, word: string, on: boolean, color: number, ink = DARK_INK) => {
    const light = lights[index];
    light.word = word;
    light.on = on;
    light.color = color;
    light.ink = ink;
  };
  if (armed) set(0, 'ARMED', true, AMBER);
  else set(0, 'SAFE', true, 0x4fd18b);
  set(1, view.hold ? 'THR OFF' : 'THR ON', !view.hold, AMBER);
  // LEVEL lights for 6G on SC, and for the rescue's 6G too.
  const rescue = getValue('sh') > 0;
  set(2, 'LEVEL', getValue('sc') >= 1024 || rescue, 0x3b75a9, 0xffffff);
  set(3, 'RESCUE', rescue, 0x8a1c20, 0xffffff);
  set(4, 'LOW BATT', view.left < LOW_TIME, RED);
  set(5, 'TELE', false, 0x8a1c20, 0xffffff);
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

type Dial = {
  centerX: number;
  centerY: number;
  radius: number;
  title: string;
  value: () => number;
  labels: [number, string][];
};

/** The big round instrument's figures, name, needle and hub (0 to 100): its face and window are in the panel. */
function dial(spec: Dial): LvglObject[] {
  const {centerX: x, centerY: y, radius} = spec;
  const angle = (value: number) => -135 + (clamp(value, 0, 100) / 100) * 270;
  const objects: LvglObject[] = [];
  for (const [value, text] of spec.labels) {
    const [labelX, labelY] = at(x, y, radius - 20, angle(value));
    objects.push(label(labelX, labelY, text, 0, INK, CENTER));
  }
  objects.push(label(x, y - math.floor(radius * 0.32), spec.title, SMLSIZE, MUTED, CENTER));
  // The needle: a thick line from just behind the hub to near the scale, then the hub over it.
  objects.push({
    type: 'line',
    thickness: 3,
    rounded: true,
    color: rgb(0xffffff),
    pts: () => {
      const needle = angle(spec.value());
      return [at(x, y, 9, needle + 180), at(x, y, radius - 5, needle)];
    },
  });
  objects.push({type: 'circle', x, y, radius: 5, filled: true, color: rgb(0x2a2d30)});
  objects.push({type: 'circle', x, y, radius: 5, color: rgb(0x888888)});
  return objects;
}

/** The curves' plot (its box and cross are in the panel picture): centre and half sizes, -100 to 100 each way. */
const PLOT_X = 363;
const PLOT_Y = 157;
const PLOT_W = 38;
const PLOT_H = 44;
const plotAt = (across: number, up: number): [number, number] => [
  PLOT_X + math.floor((clamp(across, -100, 100) / 100) * PLOT_W + 0.5),
  PLOT_Y - math.floor((clamp(up, -100, 100) / 100) * PLOT_H + 0.5),
];

/** Where a curve's points sit across: its own x (ends included), else evenly from -100 to 100. */
function curveXs(curve: Curve): number[] {
  const xs: number[] = [];
  for (let index = 0; index < curve.y.length; index++) {
    xs.push(curve.x ? curve.x[index] : -100 + (200 * index) / (curve.y.length - 1));
  }
  return xs;
}

/** A curve's value at `across` (%): its points joined straight, as the mixer applies it. */
function curveAt(curve: Curve, across: number): number {
  const xs = curveXs(curve);
  for (let index = 1; index < xs.length; index++) {
    if (across <= xs[index] || index === xs.length - 1) {
      const span = xs[index] - xs[index - 1];
      const share = span === 0 ? 1 : clamp((across - xs[index - 1]) / span, 0, 1);
      return curve.y[index - 1] + share * (curve.y[index] - curve.y[index - 1]);
    }
  }
  return 0;
}

/** A motor curve's value (-100 to 100) as throttle (0 to 100 %). */
const percentOf = (value: number) => round((value + 100) / 2);

/**
 * Reads the idle ups' curves from the model (EdgeTX keeps 32, found by name) and works out what the screen draws from
 * them: each curve's line, its level, lowest and highest, and its label, over the highest curve and under the others,
 * where they spread at three quarters of the stick.
 */
function readShapes(widget: Widget): void {
  const curves: Record<string, Curve> = {};
  for (let index = 0; index < 32; index++) {
    const curve = model.getCurve(index);
    if (curve && curve.name !== '' && curve.y.length >= 2) curves[curve.name] = curve;
  }
  let top = 0;
  MODES.forEach((mode, index) => {
    const curve = curves[mode.curve];
    const shape = widget.shapes[index];
    shape.curve = curve;
    if (!curve) {
      shape.points = [plotAt(-100, mode.fallback * 2 - 100), plotAt(100, mode.fallback * 2 - 100)];
      shape.level = mode.fallback;
      shape.low = mode.fallback;
      shape.high = mode.fallback;
    } else {
      const xs = curveXs(curve);
      const points: [number, number][] = [];
      for (let point = 0; point < xs.length; point++) points.push(plotAt(xs[point], curve.y[point]));
      let lowest = curve.y[0];
      let highest = curve.y[0];
      for (const value of curve.y) {
        lowest = math.min(lowest, value);
        highest = math.max(highest, value);
      }
      shape.points = points;
      shape.level = percentOf(curveAt(curve, 0));
      shape.low = percentOf(lowest);
      shape.high = percentOf(highest);
    }
    if (shape.level > widget.shapes[top].level) top = index;
    const pitch = mode.pitch === undefined ? undefined : curves[mode.pitch];
    if (pitch) {
      const xs = curveXs(pitch);
      const points: [number, number][] = [];
      for (let point = 0; point < xs.length; point++) points.push(plotAt(xs[point], pitch.y[point]));
      shape.pitch = points;
    } else {
      shape.pitch = [plotAt(-100, -100), plotAt(100, 100)];
    }
  });
  MODES.forEach((mode, index) => {
    const shape = widget.shapes[index];
    const [, lineY] = plotAt(50, shape.curve ? curveAt(shape.curve, 50) : mode.fallback * 2 - 100);
    shape.labelY = clamp(lineY + (index === top ? -8 : 8), PLOT_Y - PLOT_H, PLOT_Y + PLOT_H);
  });
}

/** Every object of the screen, in drawing order. */
function objects(widget: Widget): LvglObject[] {
  const view = widget.view;
  const shapes = widget.shapes;
  const list: LvglObject[] = [
    // The panel's fixed parts, grey, or dark yellow while live (armed, throttle on: the motor can spin).
    {type: 'image', x: 0, y: 0, w: 480, h: 227, file: '/WIDGETS/K110Cockpit/panel.png'},
    {type: 'image', x: 0, y: 0, w: 480, h: 227, file: '/WIDGETS/K110Cockpit/panel-live.png', visible: () => view.live},
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

  // The throttle quadrant: a detent for each idle up, evenly spaced up the gate whatever their throttles, CUT at the
  // foot. The lever stands at the motor output, in proportion between the detents: in Low RPM it rides the ramp
  // between CUT and LOW.
  const stopY = (index: number) => math.floor(BOTTOM - (index / 4) * (BOTTOM - TOP));
  const throttleY = (percent: number) => {
    const stops = [0, shapes[0].level, shapes[1].level, shapes[2].level, 100];
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
  MODES.forEach((mode, index) => {
    const y = stopY(index + 1);
    const current = () => view.idle === index + 1 && !view.motorOff;
    // The gate's notch is in the panel picture, its edges lit green at the idle up flown; its placard: IU2 / 80.
    list.push(
      {type: 'hline', x: 33, y: y - 3, w: 7, h: 1, color: GREEN, visible: current},
      {type: 'hline', x: 33, y: y + 3, w: 7, h: 1, color: GREEN, visible: current},
      label(30, y - 5, mode.word, TINSIZE, () => (current() ? GREEN : MUTED), RIGHT),
      label(30, y + 5, () => `${shapes[index].level}`, TINSIZE, DIM, RIGHT),
    );
  });
  // The throttle's T-handle across its gate: a stem out of the slot, a knob lit along its top edge and shaded along
  // its foot, grey when the motor cannot run (the K110S has no head speed knob to show on it).
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
      color: rgb(stripe % 2 === 0 ? AMBER : DARK_INK),
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
      () => (view.motorOff ? 'CUT' : `${round(view.throttle)}%`),
      SMLSIZE,
      () => (view.motorOff ? rgb(RED) : DIGITS),
      CENTER,
    ),
  );

  // The collective: its scale's ticks are in the panel picture, evenly spaced whatever the range; its figures every
  // half range, and the grip at the pitch, a thumb switch on its top.
  const range = widget.options.PitchRange || 12;
  const pitchY = (value: number) =>
    math.floor(BOTTOM - ((clamp(value, -range, range) + range) / (2 * range)) * (BOTTOM - TOP));
  for (let step = 0; step <= 4; step++) {
    const mark = -range + (step * range) / 2;
    const text = mark === 0 ? '0' : `${mark > 0 ? '+' : ''}${round(mark)}`;
    list.push(label(90, pitchY(mark), text, TINSIZE, mark === 0 ? LABEL : MUTED, RIGHT));
  }
  const grip = rgb(0xbfc5cb);
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
      {type: 'hline', x: 9, y: 2, w: 35, h: 1, color: rgb(0xf1f3f5)},
      {type: 'circle', x: 38, y: 8, radius: 3, filled: true, color: rgb(0x2a2d30)},
    ],
  });
  list.push(
    label(108, BOTTOM + 14, () => `${view.degrees >= 0 ? '+' : ''}${round(view.degrees)}°`, SMLSIZE, DIGITS, CENTER),
  );

  // The Pack timer as the fuel gauge, where the Cockpit has the battery: E to F over the time it starts from, the time
  // left in its window (red under 30 s) and under it how fast it counts now, "stopped" while the motor cannot run.
  list.push(
    ...dial({
      centerX: 226,
      centerY: 117,
      radius: 72,
      title: 'PACK',
      value: () => (view.left / view.start) * 100,
      labels: [
        [0, 'E'],
        [50, '1/2'],
        [100, 'F'],
      ],
    }),
    label(
      226,
      147,
      () => clock(view.left),
      0,
      () => (view.left < LOW_TIME ? rgb(RED) : DIGITS),
      CENTER,
    ),
    label(
      226,
      162,
      () => (view.live ? `x${string.format('%.2f', view.rate)}` : 'stopped'),
      SMLSIZE,
      () => (view.live ? DIGITS : MUTED),
      CENTER,
    ),
    // Under it, where the Cockpit names the pack: the sortie's time (timer 2).
    label(226, 210, () => `Sortie ${clock(view.sortie)}`, SMLSIZE, LABEL, CENTER),
  );

  // The data plate (the plate, its frame and screws, the picture's box are in the panel picture), with the cell count
  // where the M2 EVO's shows it: fixed, as no telemetry tells it, and the K110S only takes 1S packs.
  const info = model.getInfo();
  if (info.bitmap && info.bitmap !== '') {
    list.push({type: 'image', x: 324, y: 33, w: 66, h: 44, file: `/IMAGES/${info.bitmap}`});
  }
  list.push(
    label(398, 40, 'MODEL', TINSIZE, MUTED),
    // EdgeTX's bold font: on a colour radio BOLD is a size of its own, added to another it makes it bigger.
    label(398, 56, info.name ?? '', BOLD, rgb(0xf1f3f5)),
    label(398, 72, '1S', SMLSIZE, MUTED),
  );

  // The throttle curves, in the Cockpit's pitch curve box: the three idle ups' lines dim, the one SE picks lit over
  // them, each named, a dot at the throttle stick on the one flown, and its lowest to highest throttle under them.
  const flown = () => shapes[view.idle - 1];
  list.push(
    label(326, 99, 'THR', TINSIZE, GREEN),
    label(347, 99, 'PITCH', TINSIZE, BLUE),
    label(402, 99, () => MODES[view.idle - 1].word, TINSIZE, DIGITS, RIGHT),
  );
  // No line has a `visible` function: EdgeTX 2.12.5 makes a line's object only once it has its points, and a line
  // hidden when it is built is hidden through that missing object, which crashes the radio (it froze on its splash).
  // A missing curve draws flat at its idle up's level instead, and the lit line follows SE.
  shapes.forEach(shape => {
    list.push({
      type: 'line',
      thickness: 1,
      color: DIM,
      pts: () => shape.points,
    });
  });
  list.push(
    {
      type: 'line',
      thickness: 2,
      rounded: true,
      color: GREEN,
      pts: () => flown().points,
    },
    // The pitch curve of the idle up flown, over the throttle's.
    {
      type: 'line',
      thickness: 2,
      rounded: true,
      color: BLUE,
      pts: () => flown().pitch,
    },
  );
  MODES.forEach((mode, index) => {
    const shape = shapes[index];
    const word = label(382, shape.labelY, mode.word, TINSIZE, () => (view.idle === index + 1 ? GREEN : MUTED), CENTER);
    list.push({...word, pos: () => $multi(word.x as number, shape.labelY - 6)});
  });
  list.push(
    {
      type: 'circle',
      x: PLOT_X,
      y: PLOT_Y,
      radius: 3,
      filled: true,
      color: rgb(0xffffff),
      visible: () => flown().curve !== undefined,
      pos: () => {
        const curve = flown().curve;
        const across = (view.stick / 1024) * 100;
        return $multi(...plotAt(across, curve ? curveAt(curve, across) : 0));
      },
    },
    // The pitch sent (CH6) at the collective stick: on its curve, off it while the rescue holds it flat or climbs.
    {
      type: 'circle',
      x: PLOT_X,
      y: PLOT_Y,
      radius: 3,
      filled: true,
      color: BLUE,
      pos: () => $multi(...plotAt((view.stick / 1024) * 100, view.collective)),
    },
    label(
      363,
      213,
      () => {
        const shape = flown();
        if (!shape.curve) return 'no curve';
        return shape.low === shape.high ? `${shape.level}%` : `${shape.low}-${shape.high}%`;
      },
      TINSIZE,
      DIGITS,
      CENTER,
    ),
  );

  // The idle ups as SE sets them, one over the other where the Cockpit has its cell gauge (their boxes are in the
  // panel picture): each one's throttle at mid stick, the one picked lit green.
  MODES.forEach((mode, index) => {
    const y = TILE_Y + index * TILE_STEP;
    const picked = () => view.idle === index + 1;
    list.push(
      {type: 'rectangle', x: TILE_X, y, w: TILE_W, h: TILE_H, filled: true, color: GREEN, visible: picked},
      {type: 'rectangle', x: TILE_X, y, w: TILE_W, h: TILE_H, color: EDGE, visible: picked},
      label(TILE_X + 5, y + 9, mode.word, SMLSIZE, () => (picked() ? rgb(DARK_INK) : MUTED)),
      label(
        TILE_X + TILE_W - 4,
        y + 10,
        () => `${shapes[index].level}%`,
        TINSIZE,
        () => (picked() ? rgb(DARK_INK) : DIM),
        RIGHT,
      ),
    );
  });

  // The cyclic (the right stick): a dot where aileron and elevator put it, their values under it (its box, cross and
  // ring are in the panel picture).
  const percent = (value: number) => `${value >= 0 ? '+' : ''}${round((value / 1024) * 100)}`;
  list.push(
    {
      type: 'circle',
      x: 442,
      y: 182,
      radius: 3,
      filled: true,
      color: GREEN,
      pos: () =>
        $multi(
          442 + math.floor((clamp(view.aileron, -1024, 1024) / 1024) * 20),
          182 - math.floor((clamp(view.elevator, -1024, 1024) / 1024) * 20),
        ),
    },
    label(442, 213, () => `A${percent(view.aileron)} E${percent(view.elevator)}`, TINSIZE, DIGITS, CENTER),
  );
  return list;
}

function create(zone: Zone, options: Options): Widget {
  const lights: Light[] = [];
  for (let index = 0; index < 6; index++) lights.push({word: '', on: false, color: 0, ink: 0});
  const shapes: Shape[] = MODES.map(mode => ({
    points: [],
    pitch: [],
    labelY: PLOT_Y,
    level: mode.fallback,
    low: mode.fallback,
    high: mode.fallback,
  }));
  const widget: Widget = {
    zone,
    options,
    shapes,
    since: getTime(),
    view: {
      live: false,
      motorOff: true,
      hold: true,
      idle: 2,
      throttle: 0,
      stick: 0,
      degrees: 0,
      collective: 0,
      aileron: 0,
      elevator: 0,
      left: 240,
      start: 240,
      rate: 0,
      sortie: 0,
      lights,
    },
  };
  update(widget, options);
  return widget;
}

/** New options (the pitch range): the screen built again for them. */
function update(widget: Widget, options: Options): void {
  widget.options = options;
  readShapes(widget);
  look(widget);
  lvgl.clear();
  lvgl.build(objects(widget));
}

function refresh(widget: Widget): void {
  look(widget);
  const now = getTime();
  if (now - widget.since >= 100) {
    widget.since = now;
    // Once a second: the curves again, for a change made on the radio.
    readShapes(widget);
  }
}

const useLvgl = true;

export {refresh, name, create, update, options, useLvgl};
