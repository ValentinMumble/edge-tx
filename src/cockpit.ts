const name = 'Cockpit';

/**
 * The whole screen as a heli's instrument panel (480 × 227, under the top bar):
 * - across the top: arming (SA) and the throttle (SF) as one guarded toggle in its box (the guard closed
 *   while SAFE, flipped up once ARMED, the lever up for THR ON, the box lit green, amber or red), then the warning lights:
 *   LEVEL (SC, self-level),
 *   RESCUE (SH), LOW BATT (LOW VOLT while the low-cell alarm is on, NOT FULL when the pack was not full when plugged
 *   in), TELE (no telemetry, a green dot in its box while it comes in); the panel turns dark red while the motor
 *   can spin;
 * - the throttle as a quadrant: a detent per idle up evenly up the gate, CUT at its foot guarded in hold, the lever at
 *   the motor output (CH3), what S1 adds to it on its knob; the pitch as a collective lever against a degree scale,
 *   at CH6;
 * - the battery as a fuel gauge: the charge the pack had when plugged in (by its resting volts a cell) less the mAh
 *   used, against the size of the pack picked with the 6-position buttons (the mAh left under the %, the pack under
 *   the gauge), saying the % left every 10% and warning when a pack is not full (mAhRe's sounds), when a cell sags
 *   under 3.30 V for a while (the model's low-cell alarm, which waited for 5 s in a row, is off) and, with buzzes,
 *   when the pack runs low;
 * - the model's data plate (picture, name, cells); the curves as the K110Cockpit draws them: the idle ups' flat
 *   throttle lines (FM1 to FM3, the governor's head speeds), the one SE picks lit green with what S1 adds, and over
 *   them the pitch curve flown in blue (the idle up's, CP1 to CP3, or the self-level one, CPL, while LEVEL is lit),
 *   a dot at the collective stick on the throttle and at the pitch sent, read from the model; volts a cell as a gauge;
 *   and the cyclic and the rudder: where the sticks are and what is sent, to check them. The timers (this pack's, the sortie's) are in the top bar
 *   (the Timers widget); this one starts the sortie's again each day.
 * It is built from EdgeTX's LVGL objects (useLvgl): the radio keeps them on the screen and redraws only what changes,
 * where a widget drawing with lcd calls redraws the whole screen 20 times a second. Everything that never moves is two
 * pictures beside this file (scripts/cockpit-panel.mjs draws them at the positions used here); the rest are objects
 * whose changing properties are functions, read again at each refresh from what refresh() works out once.
 */
const options: any[] = [
  ['Idle1', VALUE, 54, 0, 100],
  ['Idle2', VALUE, 60, 0, 100],
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
  cell: number;
  throttle: number;
  /** The pitch curve flown (its name in the model) and the collective stick (-1024 to 1024). */
  curve: string;
  stick: number;
  /** What S1 adds to the idle up's throttle (s1_knob.py), in its % (-100 to 100 scale). */
  s1: number;
  degrees: number;
  /** The pitch sent (CH6, -100 to 100 %). */
  collective: number;
  /**
   * The right stick and the left one across, and the aileron, elevator and rudder sent (CH1, CH2, CH4: after rates and
   * expo), -1024 to 1024.
   */
  aileron: number;
  elevator: number;
  rudder: number;
  sentAileron: number;
  sentElevator: number;
  sentRudder: number;
  packName: string;
  packMah: number;
  lights: Light[];
  /** Practice rates on (SG up, practice_rates.py): calmer cyclic and rudder, the gentler pitch curve CPP. */
  practice: boolean;
  /** The practice rates' share of the cyclic, %, while they are on (0 when the model does not say). */
  practiceRate: number;
  /**
   * The arming switch as drawn, moving towards what SA and SF say (swing): its guard from closed (0) to open (1), its
   * lever from down (-1) to up (1), and when they last moved (getTime, -1 before the first look).
   */
  guard: number;
  lever: number;
  swung: number;
};
type Widget = {
  zone: Zone;
  options: Options;
  powered: boolean;
  /** When the pack's voltage came back (ticks), for the not-full check once it settles; -1 when done. */
  plugged: number;
  notFull: boolean;
  /** The last % left said out loud (100 when nothing yet). */
  said: number;
  /** The model's curves by name, read when the screen is built. */
  curves: Record<string, Curve>;
  /** The % the pack had when plugged in, from its resting volts a cell (100 when full): the mAh used count from it. */
  startLeft: number;
  /** When the day was last checked for the sortie (getTime, tens of ms). */
  since: number;
  /**
   * The low-cell alarm: when follow() last ran, the seconds a cell has spent under SAG_CELL under load (fading), and
   * when the alarm and the low fuel buzz last went off (getTime, tens of ms).
   */
  ticks: number;
  sag: number;
  sagAt: number;
  lowAt: number;
  view: View;
};

/** The packs by 6-position button, as the Pack widget and mAhRe have them. */
const PACKS = [
  {name: 'Gens Ace 3', mah: 750},
  {name: 'Gens Ace 4', mah: 750},
  {name: 'OMP 2', mah: 750},
  {name: 'Eachine 2', mah: 500},
  {name: 'Eachine 1', mah: 500},
  {name: 'None', mah: 750},
];
/** A new pack: its voltage back after none with the mAh count at 0 (see Session). */
const NEW_PACK_MAH = 5;
/** The warning light that is TELE, from 0. */
const TELE_LIGHT = 5;
/** Under this a cell is not full when plugged in (mAhRe's level), and the % left that lights LOW BATT. */
const FULL_CELL = 4.0;
const LOW_FUEL = 25;
/** The % left said with two buzzes: half the pack is gone. */
const HALF = 50;
/**
 * The low-cell alarm, in place of the model's (L15, now off): a 3S pack pulled hard dips under 3.30 V a cell for a
 * second or two at a time, too short for a switch that waits for 5 s in a row. So the seconds a cell spends under
 * SAG_CELL while drawing LOAD amps or more add up, fading by SAG_FADE (a dip 20 s ago counts a tenth), and past
 * SAG_SECONDS the radio says "low battery" and buzzes twice, again after ALARM_EVERY (tens of ms) if the pack still
 * sags. On the logs of 12 and 13 Nov 2026 it goes off on 9 packs of 10, where the old alarm did on 4.
 */
const SAG_CELL = 3.3;
const LOAD = 2;
const SAG_FADE = 10;
const SAG_SECONDS = 2;
const ALARM_EVERY = 1500;
/** Long ago, for an alarm that has not gone off yet. */
const NEVER = -100000;
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
/** The pitch curve and its dot, over the green throttle lines (as on the K110Cockpit). */
const BLUE = rgb(0x6cb4ff);
const AMBER = 0xffb020;
const RED = 0xff4d4f;
const UNLIT = rgb(0x4d5257);
const EDGE = rgb(0x3a3d40);

/** The lever gates run from y 42 (top) to 198 (bottom), as in the panel picture. */
const TOP = 55;
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

/**
 * The arming switch's moves (swing, armSwitch): the guard swings open or shut in GUARD_SWING s, turning GUARD_TURN
 * radians on its hinge (y HINGE), GUARD_LONG px long; the lever flips in LEVER_FLIP s, its ball LEVER_LONG px from the
 * nut's centre (y NUT).
 */
const GUARD_SWING = 0.3;
const GUARD_TURN = (108.5 * math.pi) / 180;
const GUARD_LONG = 22;
const HINGE = 12;
const LEVER_FLIP = 0.15;
const LEVER_LONG = 9;
const NUT = 23;
/** Slow in, slow out: a share of a move (0 to 1) as drawn. */
const ease = (share: number) => share * share * (3 - 2 * share);
/** A step from `from` towards `to`, at most `step`. */
const toward = (from: number, to: number, step: number) =>
  from < to ? math.min(to, from + step) : math.max(to, from - step);

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

/** `times` buzzes of `length` (tens of ms), a tenth of a second apart. */
function buzz(times: number, length: number): void {
  for (let index = 0; index < times; index++) playHaptic(length, 10);
}

/**
 * What runs whether the screen shows or not: a new pack starts the checks again; once its voltage settles, the charge
 * it starts with (100% from 4.10 V a cell) and the not-full warning; the % left said at each 10% below that (50%
 * with two buzzes, 5% last, then empty); the low-cell alarm, and three buzzes every 15 s while the motor runs on a pack
 * under LOW_FUEL % (a call said over the rotor is easy to miss, a buzz in the hands is not).
 */
function follow(widget: Widget): void {
  const volts = getValue('VFAS');
  const powered = volts > 0.5;
  const now = getTime();
  // Seconds since the last run, at most one: a gap (a menu open) is not counted as time under.
  const elapsed = clamp((now - widget.ticks) / 100, 0, 1);
  widget.ticks = now;
  if (powered && !widget.powered && getValue('mAh') < NEW_PACK_MAH) {
    widget.plugged = now;
    widget.notFull = false;
    widget.said = 100;
    widget.startLeft = 100;
    widget.sag = 0;
    widget.sagAt = NEVER;
    widget.lowAt = NEVER;
  }
  widget.powered = powered;
  if (!powered) return;
  const sagging = getValue('Curr') >= LOAD && volts / cells() < SAG_CELL;
  widget.sag = widget.sag * math.exp(-elapsed / SAG_FADE) + (sagging ? elapsed : 0);
  if (widget.sag >= SAG_SECONDS && now - widget.sagAt >= ALARM_EVERY) {
    widget.sagAt = now;
    playFile('lowbat.wav');
    buzz(2, 15);
  }
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
  const left = fuelLeft(widget);
  const step = left <= 0 ? 0 : left <= 5 ? 5 : math.ceil(left / 10) * 10;
  if (step < widget.said && left < widget.said) {
    widget.said = step;
    playFile(`${SOUNDS}${step === 0 ? 'BatNo' : `Bat${step}L`}.wav`);
    // Half the pack gone: a buzz in the hands too, as the call is easy to miss over the rotor.
    if (step === HALF) buzz(2, 15);
  }
  const running = getValue('sa') === 1024 && getValue('sf') === -1024;
  if (running && left < LOW_FUEL && now - widget.lowAt >= ALARM_EVERY) {
    widget.lowAt = now;
    buzz(3, 30);
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
  // S1's mix lines (s1_knob.py): -20 to +20 % in idle ups 1 and 2, -10 to +10 % in idle up 3.
  view.s1 = math.floor((getValue('s1') / 1024) * (view.idle === 3 ? 10 : 20) + 0.5);
  view.motorOff = view.hold || !armed;
  view.live = !view.motorOff;
  const volts = getValue('VFAS');
  view.powered = volts > 0.5;
  view.cell = view.powered ? volts / cells() : 0;
  view.left = view.powered ? fuelLeft(widget) : 0;
  const plugged = pack();
  view.packName = plugged.name;
  view.packMah = plugged.mah;
  view.mahLeft = math.floor((plugged.mah * view.left) / 100 + 0.5);
  // The pitch curve flown, as the model's pitch lines pick it: the self-level one while LEVEL is lit (SC), else the
  // practice one while SG is up, else the idle up's (the Coll lines).
  view.practice = getValue('sg') <= -1024;
  view.practiceRate = view.practice ? practiceRate() : 0;
  view.curve = getValue('sc') >= 1024 ? 'CPL' : view.practice ? 'CPP' : `CP${view.idle}`;
  view.stick = getValue('thr');
  view.throttle = ((output(2) + 1024) / 2048) * 100;
  view.degrees = (output(5) / 1024) * (widget.options.PitchRange || 12);
  view.collective = (output(5) / 1024) * 100;
  view.aileron = getValue('ail');
  view.elevator = getValue('ele');
  view.sentAileron = output(0);
  view.sentElevator = output(1);
  view.rudder = getValue('rud');
  view.sentRudder = output(3);

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
  // LOW VOLT while the low-cell alarm is on (15 s from when it went off), before LOW BATT and NOT FULL.
  if (view.powered && getTime() - widget.sagAt < ALARM_EVERY) set(4, 'LOW VOLT', true, RED);
  else if (widget.notFull && view.left >= LOW_FUEL) set(4, 'NOT FULL', true, AMBER);
  else set(4, 'LOW BATT', view.powered && view.left < LOW_FUEL, RED);
  set(TELE_LIGHT, 'TELE', getValue('RSSI') <= 0, 0x8a1c20, 0xffffff);
  swing(view, armed);
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
 * Moves the arming switch as drawn towards what SA and SF say, by the time since the last look: the guard open while
 * armed, the lever up while the throttle is on. At once on the first look, or after a gap (the screen hidden): it
 * opens as things are, not replaying a move.
 */
function swing(view: View, armed: boolean): void {
  const now = getTime();
  const guard = armed ? 1 : 0;
  const lever = view.lights[1].on ? 1 : -1;
  const seconds = (now - view.swung) / 100;
  if (view.swung < 0 || seconds > 0.5) {
    view.guard = guard;
    view.lever = lever;
  } else {
    view.guard = toward(view.guard, guard, seconds / GUARD_SWING);
    view.lever = toward(view.lever, lever, (2 * seconds) / LEVER_FLIP);
  }
  view.swung = now;
}

/**
 * Arming (SA) and the throttle (SF) as one guarded toggle switch, as on an aircraft's switch panel, in its box across
 * the top left, the box lit as a warning light: green SAFE, amber ARMED, red THR ON (the motor can spin). On a black
 * plate, a chrome bat lever on its nut, up ON (throttle on), down OFF; the red guard closed over it while SAFE (its
 * hinge bar and pivots on top, a ridge down its middle), flipped up off it once ARMED; disarmed with the throttle on,
 * UNARMED with THR ON small under it, in amber, not safe, the lever's ball peeking over the closed guard. The word
 * after it. The guard swings and the lever flips (swing): the guard turns on its hinge towards the eye, its face
 * shortening and darkening, edge-on halfway, then its inside rising above the hinge; the lever's bat shortens into the
 * nut and grows out of its other side. Only rectangles, circles and labels, shown, hidden, moved and sized.
 */
function armSwitch(view: View): LvglObject[] {
  const lights = view.lights;
  const armed = () => lights[0].word === 'ARMED';
  const live = () => armed() && lights[1].on;
  const safeOn = () => !armed() && lights[1].on;
  const x = 40;
  const outline = rgb(0x2a2d30);
  const chrome = rgb(0xc9ced3);
  const shine = rgb(0xf4f6f8);
  const pivot = rgb(0xb9bec3);
  const edge = rgb(0x3d080a);
  const inside = rgb(0x6e1013);
  // The guard as drawn: closed, open, or on its way, facing the eye (before edge-on) or flipped (past it), so many px
  // of it seen.
  const closed = () => view.guard <= 0.02;
  const open = () => view.guard >= 0.98;
  const turn = () => ease(view.guard) * GUARD_TURN;
  const reach = () => GUARD_LONG * math.cos(turn());
  const facing = () => !closed() && !open() && reach() >= 0;
  const flipped = () => !closed() && !open() && reach() < 0;
  const seen = () => math.max(2, math.floor(math.abs(reach()) + 0.5));
  // Its face darkens as it turns from the light.
  const face = () => {
    const light = 0.55 + 0.45 * math.cos(turn());
    return lcd.RGB(math.floor(0xc8 * light), math.floor(0x26 * light), math.floor(0x2b * light));
  };
  // The lever's ball, under the nut (down) to over it (up), through it as it flips; its bat between.
  const tip = () => math.floor(NUT - LEVER_LONG * (ease((view.lever + 1) / 2) * 2 - 1) + 0.5);
  const top = () => math.min(tip(), NUT);
  const length = () => math.abs(tip() - NUT);
  return [
    {
      type: 'rectangle',
      x: 16,
      y: 5,
      w: 146,
      h: 31,
      filled: true,
      // Annunciator colours: a true green, the panel's amber, a deep red.
      color: () => rgb(live() ? 0xd6282e : armed() || safeOn() ? AMBER : 0x34a853),
    },
    {type: 'rectangle', x: 16, y: 5, w: 146, h: 31, color: EDGE},
    // The guard flipped up off the switch, its inside seen, hinged at the plate's top.
    {type: 'rectangle', x: 29, y: 5, w: 23, h: 8, filled: true, color: inside, visible: open},
    {type: 'rectangle', x: 31, y: 6, w: 19, h: 5, filled: true, color: rgb(0x8f191e), visible: open},
    {type: 'rectangle', x: 29, y: 5, w: 23, h: 1, filled: true, color: rgb(0xec7276), visible: open},
    {type: 'rectangle', x: 29, y: 5, w: 23, h: 8, color: edge, visible: open},
    // Swinging, past edge-on: its inside, rising above the hinge, behind the lever as when open.
    {
      type: 'rectangle',
      x: 29,
      y: HINGE - 7,
      w: 23,
      h: 8,
      filled: true,
      color: inside,
      pos: () => $multi(29, HINGE - seen()),
      size: () => $multi(23, seen() + 1),
      visible: flipped,
    },
    {
      type: 'rectangle',
      x: 29,
      y: HINGE - 7,
      w: 23,
      h: 8,
      color: edge,
      pos: () => $multi(29, HINGE - seen()),
      size: () => $multi(23, seen() + 1),
      visible: flipped,
    },
    {type: 'circle', x: 31, y: HINGE, radius: 2, filled: true, color: pivot, visible: () => open() || flipped()},
    {type: 'circle', x: 49, y: HINGE, radius: 2, filled: true, color: pivot, visible: () => open() || flipped()},
    // The black plate, the nut, the lever.
    {type: 'rectangle', x: 30, y: 13, w: 21, h: 21, filled: true, color: rgb(0x15181b)},
    {type: 'rectangle', x: 30, y: 13, w: 21, h: 21, color: rgb(0x3a3e42)},
    {type: 'circle', x, y: NUT, radius: 6, filled: true, color: outline},
    {type: 'circle', x, y: NUT, radius: 5, filled: true, color: rgb(0xb9bec3)},
    {type: 'circle', x, y: NUT, radius: 3, filled: true, color: rgb(0x5d6268)},
    {type: 'circle', x: x - 2, y: NUT - 2, radius: 1, filled: true, color: shine},
    {
      type: 'rectangle',
      x: x - 3,
      y: NUT - 1,
      w: 6,
      h: LEVER_LONG + 2,
      filled: true,
      color: outline,
      pos: () => $multi(x - 3, top() - 1),
      size: () => $multi(6, length() + 2),
      visible: () => length() >= 1,
    },
    {
      type: 'rectangle',
      x: x - 2,
      y: NUT,
      w: 4,
      h: LEVER_LONG,
      filled: true,
      color: chrome,
      pos: () => $multi(x - 2, top()),
      size: () => $multi(4, length()),
      visible: () => length() >= 1,
    },
    {
      type: 'rectangle',
      x: x - 1,
      y: NUT + 2,
      w: 1,
      h: LEVER_LONG - 4,
      filled: true,
      color: shine,
      pos: () => $multi(x - 1, top() + 2),
      size: () => $multi(1, length() - 4),
      visible: () => length() > 4,
    },
    {type: 'circle', x, y: NUT + LEVER_LONG, radius: 4, filled: true, color: outline, pos: () => $multi(x, tip())},
    {
      type: 'circle',
      x,
      y: NUT + LEVER_LONG,
      radius: 3,
      filled: true,
      color: rgb(0xdfe3e7),
      pos: () => $multi(x, tip()),
    },
    {
      type: 'circle',
      x: x - 1,
      y: NUT + LEVER_LONG - 1,
      radius: 1,
      filled: true,
      color: rgb(0xffffff),
      pos: () => $multi(x - 1, tip() - 1),
    },
    // The guard closed over it all: a red cap, its hinge bar and pivots, a ridge, a shine, a lip.
    {type: 'rectangle', x: 29, y: 9, w: 23, h: 25, filled: true, color: rgb(0xc8262b), visible: closed},
    {type: 'rectangle', x: 29, y: 9, w: 23, h: 4, filled: true, color: rgb(0x7d1418), visible: closed},
    {type: 'circle', x: 31, y: 11, radius: 2, filled: true, color: pivot, visible: closed},
    {type: 'circle', x: 49, y: 11, radius: 2, filled: true, color: pivot, visible: closed},
    {type: 'rectangle', x: 38, y: 14, w: 5, h: 18, filled: true, color: rgb(0xa31d22), visible: closed},
    {type: 'rectangle', x: 39, y: 14, w: 3, h: 18, filled: true, color: rgb(0xd8383d), visible: closed},
    {type: 'rectangle', x: 31, y: 14, w: 2, h: 18, filled: true, color: rgb(0xef8084), visible: closed},
    {type: 'rectangle', x: 29, y: 32, w: 23, h: 2, filled: true, color: rgb(0x8f191e), visible: closed},
    {type: 'rectangle', x: 29, y: 9, w: 23, h: 25, color: edge, visible: closed},
    // Swinging, before edge-on: its face, shortening and darkening, over the lever, its hinge bar and pivots on top.
    {
      type: 'rectangle',
      x: 29,
      y: HINGE - 2,
      w: 23,
      h: GUARD_LONG + 2,
      filled: true,
      color: face,
      size: () => $multi(23, seen() + 2),
      visible: facing,
    },
    {type: 'rectangle', x: 29, y: HINGE - 2, w: 23, h: 3, filled: true, color: rgb(0x7d1418), visible: facing},
    {
      type: 'rectangle',
      x: 29,
      y: HINGE - 2,
      w: 23,
      h: GUARD_LONG + 2,
      color: edge,
      size: () => $multi(23, seen() + 2),
      visible: facing,
    },
    {type: 'circle', x: 31, y: HINGE, radius: 2, filled: true, color: pivot, visible: facing},
    {type: 'circle', x: 49, y: HINGE, radius: 2, filled: true, color: pivot, visible: facing},
    // Closed with the lever up (disarmed, throttle on): not safe, the lever's ball peeking over the guard.
    {type: 'circle', x, y: 9, radius: 4, filled: true, color: outline, visible: () => closed() && view.lever > 0},
    {
      type: 'circle',
      x,
      y: 9,
      radius: 3,
      filled: true,
      color: rgb(0xdfe3e7),
      visible: () => closed() && view.lever > 0,
    },
    {
      type: 'circle',
      x: x - 1,
      y: 8,
      radius: 1,
      filled: true,
      color: rgb(0xffffff),
      visible: () => closed() && view.lever > 0,
    },
    {
      ...label(
        106,
        21,
        () => (live() ? 'THR ON' : armed() ? 'ARMED' : 'SAFE'),
        BOLD,
        () => rgb(live() ? 0xffffff : 0x0d1a12),
        CENTER,
      ),
      visible: () => !safeOn(),
    },
    // UNARMED, and THR ON small under it.
    {...label(106, 16, 'UNARMED', BOLD, rgb(0x0d1a12), CENTER), visible: safeOn},
    {...label(106, 29, 'THR ON', TINSIZE, rgb(0x0d1a12), CENTER), visible: safeOn},
  ];
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
  low: number;
  high: number;
  value: () => number;
  labels: [number, string][];
};

/** A round instrument's figures, name, needle and hub: its face and window are in the panel picture. */
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

/** The pitch curve's plot (its box and cross are in the panel picture): centre and half sizes, -100 to 100 each way. */
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

/** The model's curves by name (EdgeTX keeps 32): the screen draws the pitch curve flown from them. */
function readCurves(): Record<string, Curve> {
  const curves: Record<string, Curve> = {};
  for (let index = 0; index < 32; index++) {
    const curve = model.getCurve(index);
    if (curve && curve.name !== '' && curve.y.length >= 2) curves[curve.name] = curve;
  }
  return curves;
}

/** Every object of the screen, in drawing order, for the options as they are. */
function objects(widget: Widget): LvglObject[] {
  const view = widget.view;
  const list: LvglObject[] = [
    // The panel's fixed parts, grey, or dark red while live (armed, throttle on: the motor can spin), on full rates.
    {type: 'image', x: 0, y: 0, w: 480, h: 227, file: '/WIDGETS/Cockpit/panel.png'},
    {
      type: 'image',
      x: 0,
      y: 0,
      w: 480,
      h: 227,
      file: '/WIDGETS/Cockpit/panel-live.png',
      visible: () => view.live && !view.practice,
    },
    // Dark blue on practice rates (SG up), live or not: the whole screen says which rates fly.
    {
      type: 'image',
      x: 0,
      y: 0,
      w: 480,
      h: 227,
      file: '/WIDGETS/Cockpit/panel-practice.png',
      visible: () => view.practice,
    },
  ];

  // The warning lights: their boxes are in the panel picture, dark; a lit light fills its own.
  // TELE's box holds a green dot while telemetry comes in (its light dark then): the word and the dot centred
  // together, the word alone centred once it lights.
  // Arming and the throttle: one guarded switch across the first two lights' boxes.
  list.push(...armSwitch(view));
  view.lights.forEach((light, index) => {
    if (index < 2) return;
    const x = 16 + index * 75;
    const word = label(
      x + 35,
      13,
      () => light.word,
      SMLSIZE,
      () => (light.on ? rgb(light.ink) : UNLIT),
      CENTER,
    );
    list.push(
      {type: 'rectangle', x, y: 5, w: 71, h: 17, filled: true, color: () => rgb(light.color), visible: () => light.on},
      {type: 'rectangle', x, y: 5, w: 71, h: 17, color: EDGE, visible: () => light.on},
    );
    if (index !== TELE_LIGHT) {
      list.push(word);
      return;
    }
    list.push(
      {...word, visible: () => light.on},
      {...label(x + 30, 13, () => light.word, SMLSIZE, UNLIT, CENTER), visible: () => !light.on},
      {type: 'circle', x: x + 55, y: 12, radius: 2, filled: true, color: rgb(0x4fd18b), visible: () => !light.on},
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
    label(44, 47, 'THROTTLE', TINSIZE, LABEL, CENTER),
    label(108, 47, 'PITCH', TINSIZE, LABEL, CENTER),
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
  // foot, grey when the motor cannot run, and on it what S1 adds to the head speed ("S1 0" at the middle, where it
  // should be when the flight starts).
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
      label(23, 10, () => `S1 ${view.s1 > 0 ? '+' : ''}${view.s1}`, TINSIZE, rgb(0x141619), CENTER),
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

  // The curves, across their box beside the cell gauge and the cyclic, as the K110Cockpit draws them: the idle ups'
  // throttle lines dim (flat: the ESC's governor holds a head speed for each), the one SE picks lit green with what S1
  // adds and a dot at the collective stick, the pitch curve flown over them in blue with a dot at the pitch sent, its
  // name, and the most pitch it gives either way.
  const flown = () => widget.curves[view.curve];
  /** An idle up's throttle (1 to 3) across the stick, from its curve (FM1 to FM3), else flat at its placard. */
  const throttleAt = (idle: number, across: number) => {
    const curve = widget.curves[`FM${idle}`];
    return curve ? curveAt(curve, across) : idles[idle - 1] * 2 - 100;
  };
  /** An idle up's throttle line, lifted by `extra` (what S1 adds). */
  const throttleLine = (idle: number, extra: number): [number, number][] => {
    const curve = widget.curves[`FM${idle}`];
    if (!curve) return [plotAt(-100, throttleAt(idle, 0) + extra), plotAt(100, throttleAt(idle, 0) + extra)];
    const xs = curveXs(curve);
    const points: [number, number][] = [];
    for (let index = 0; index < xs.length; index++) points.push(plotAt(xs[index], curve.y[index] + extra));
    return points;
  };
  list.push(label(326, 99, 'THR', TINSIZE, GREEN), label(347, 99, 'PITCH', TINSIZE, BLUE));
  list.push(label(402, 99, () => view.curve, TINSIZE, DIGITS, RIGHT));
  // forEach, not a for loop: in the Lua it becomes, a for loop's functions all share one `idle`, 4 once it is over.
  [1, 2, 3].forEach(idle => {
    list.push({type: 'line', thickness: 1, color: DIM, pts: () => throttleLine(idle, 0)});
  });
  list.push(
    {type: 'line', thickness: 2, rounded: true, color: GREEN, pts: () => throttleLine(view.idle, view.s1)},
    {
      type: 'circle',
      x: PLOT_X,
      y: PLOT_Y,
      radius: 3,
      filled: true,
      color: rgb(0xffffff),
      pos: () => {
        const across = (view.stick / 1024) * 100;
        return $multi(...plotAt(across, throttleAt(view.idle, across) + view.s1));
      },
    },
  );
  list.push(
    // No `visible` function on a line: EdgeTX 2.12.5 crashes when a line is hidden before it has its points (the
    // K110Cockpit froze the radio that way). With no curve, the line lies flat.
    {
      type: 'line',
      thickness: 2,
      rounded: true,
      color: BLUE,
      pts: () => {
        const curve = flown();
        if (!curve) return [plotAt(-100, 0), plotAt(100, 0)];
        const xs = curveXs(curve);
        const points: [number, number][] = [];
        for (let index = 0; index < xs.length; index++) points.push(plotAt(xs[index], curve.y[index]));
        return points;
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
        if (view.practice) return view.practiceRate > 0 ? `PRACTICE ${view.practiceRate}%` : 'PRACTICE';
        const curve = flown();
        if (!curve) return 'no curve';
        let most = 0;
        for (const point of curve.y) most = math.max(most, math.abs(point));
        return `max ${string.format('%.1f', (most / 100) * (widget.options.PitchRange || 12))}°`;
      },
      TINSIZE,
      () => (view.practice ? BLUE : DIGITS),
      CENTER,
    ),
  );

  // Volts a cell, over the cyclic's box.
  list.push(
    ...dial({
      centerX: 442,
      centerY: 121,
      radius: 28,
      title: 'CELL',
      low: 3.2,
      high: 4.2,
      value: () => view.cell,
      labels: [],
    }),
    label(442, 136, () => (view.powered ? string.format('%.2f', view.cell) : '--'), SMLSIZE, DIGITS, CENTER),
  );

  // The cyclic: a ring where the right stick is, a dot where the aileron and elevator sent put it (after rates and
  // expo, so in practice the dot trails the ring and stops short of the edge). The rudder under it, the same way
  // across its track: a mark where the left stick is, a bar where the rudder sent puts it. The values sent under them
  // (the box, its cross and ring, and the rudder's track are in the panel picture).
  const percent = (value: number) => `${value >= 0 ? '+' : ''}${math.floor((value / 1024) * 100 + 0.5)}`;
  // A stick's travel from the middle, px: the box is 42 px square, its centre at (442, 175).
  const across = (value: number) => math.floor((clamp(value, -1024, 1024) / 1024) * 18);
  list.push(
    {
      type: 'circle',
      x: 442,
      y: 175,
      radius: 4,
      color: MUTED,
      pos: () => $multi(442 + across(view.aileron), 175 - across(view.elevator)),
    },
    {
      type: 'circle',
      x: 442,
      y: 175,
      radius: 3,
      filled: true,
      color: GREEN,
      pos: () => $multi(442 + across(view.sentAileron), 175 - across(view.sentElevator)),
    },
    {type: 'rectangle', x: 441, y: 197, w: 3, h: 10, color: MUTED, pos: () => $multi(441 + across(view.rudder), 197)},
    {
      type: 'rectangle',
      x: 441,
      y: 200,
      w: 3,
      h: 4,
      filled: true,
      color: GREEN,
      pos: () => $multi(441 + across(view.sentRudder), 200),
    },
    // Ending at the box's right edge, so a long line grows left, away from the corner screw.
    label(
      464,
      213,
      () => `A${percent(view.sentAileron)} E${percent(view.sentElevator)} R${percent(view.sentRudder)}`,
      TINSIZE,
      DIGITS,
      RIGHT,
    ),
  );
  // Practice rates on (SG up): a blue frame round the whole screen.
  list.push({type: 'rectangle', x: 0, y: 0, w: 480, h: 227, thickness: 3, color: BLUE, visible: () => view.practice});
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
    curves: {},
    startLeft: 100,
    since: getTime(),
    ticks: getTime(),
    sag: 0,
    sagAt: NEVER,
    lowAt: NEVER,
    view: {
      live: false,
      motorOff: true,
      hold: true,
      rescue: false,
      idle: 2,
      powered: false,
      left: 0,
      mahLeft: 0,
      cell: 0,
      throttle: 0,
      curve: 'CP2',
      stick: 0,
      s1: 0,
      degrees: 0,
      collective: 0,
      aileron: 0,
      elevator: 0,
      sentAileron: 0,
      sentElevator: 0,
      rudder: 0,
      sentRudder: 0,
      packName: '',
      packMah: 0,
      lights,
      practice: false,
      practiceRate: 0,
      guard: 0,
      lever: -1,
      swung: -1,
    },
  };
  update(widget, options);
  return widget;
}

/** New options (idle ups, pitch range): the screen built again for them. */
function update(widget: Widget, options: Options): void {
  widget.options = options;
  widget.curves = readCurves();
  look(widget);
  lvgl.clear();
  lvgl.build(objects(widget));
}

function background(widget: Widget): void {
  follow(widget);
}

/**
 * The practice rates' share of the cyclic, %: the weight of the aileron input's practice line (practice_rates.py names
 * it Prac), else 0. Read while practice is on: the sim changes it with its own rates.
 */
function practiceRate() {
  const lines = model.getInputsCount(0);
  for (let line = 0; line < lines; line++) {
    const found = model.getInput(0, line);
    if (found !== undefined && found.name === 'Prac') return found.weight;
  }
  return 0;
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
