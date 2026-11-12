const name = 'ArmedModel';
const MIN_VALUE = -1024;

const options: any[] = [
  ['ArmedSwitch', SOURCE, 1],
  ['ThrottleCutSwitch', SOURCE, 1],
];

type Options = {
  ArmedSwitch: number;
  ThrottleCutSwitch: number;
};

type Widget = {
  zone: Zone;
  options: Options;
  /** The model picture, resized for the box it was resized for. */
  picture?: Bitmap;
  pictureKey?: string;
  /** The rotor: where its first blade points (degrees clockwise from 12 o'clock) and how fast it turns. */
  angle: number;
  speed: number;
  lastTime: number;
};

/**
 * The rotor's top speed on screen, in degrees every 10 ms: about 1.1 turns a second, the blur does the rest. Slow
 * enough that even at 5 frames a second a blade moves less than a quarter turn, so it never seems to turn backwards.
 */
const FULL_SPEED = 4;
/** How long it takes, in 10 ms ticks, to spool up from still to full speed, and to coast down after a cut. */
const SPOOL_UP = 350;
const SPOOL_DOWN = 600;

const METAL = 0xc7d0da;
const METAL_DARK = 0x5d6978;
const LIGHT_OFF = 0x4a5058;

/**
 * The three states, each with its own fill, word and rotor: SAFE when disarmed (the motor cannot start), ARMED when
 * armed with the throttle cut, LIVE when armed with the throttle on (the motor can spin). Colours that read at a glance
 * on the radio: grey-green, amber, red.
 */
type State = 'safe' | 'armed' | 'live';
const STATES: Record<State, {word: string; fill: number; ink: number; blade: number; tip: number}> = {
  safe: {word: 'SAFE', fill: 0x24302a, ink: 0x7cd69a, blade: 0x8b939c, tip: 0x8b939c},
  armed: {word: 'ARMED', fill: 0x4a3810, ink: 0xffb020, blade: 0xd8dde3, tip: 0xffb020},
  live: {word: 'LIVE', fill: 0x5c1a1f, ink: 0xff5a5f, blade: 0xe6e9ed, tip: 0xfebe00},
};

/**
 * SH held down: the flybarless unit's rescue levels the heli and climbs. Whatever the state, the zone turns red, says
 * RESCUE and its border blinks fast, as long as SH is held (it springs back).
 */
const RESCUE = {word: 'RESCUE', fill: 0x8a1c20, ink: 0xffffff};

function create(zone: Zone, options: Options): Widget {
  return {zone, options, angle: 30, speed: 0, lastTime: getTime()};
}

function update(widget: Widget, options: Options): void {
  widget.options = options;
}

/** A colour part way from one to another (share 0 to 1), as the radio cannot draw see-through circles. */
function mix(from: number, to: number, share: number): number {
  const part = (rgb: number, unit: number) => Math.floor(rgb / unit) % 256;
  const blend = (unit: number) => Math.floor(part(from, unit) + (part(to, unit) - part(from, unit)) * share);
  return lcd.RGB(blend(65536), blend(256), blend(1));
}

/** A point on a blade: `along` from the hub towards the tip, `across` towards the leading edge. */
function bladePoint(centerX: number, centerY: number, angle: number, along: number, across: number) {
  const radians = (angle * math.pi) / 180;
  const x = centerX + math.sin(radians) * along + math.cos(radians) * across;
  const y = centerY - math.cos(radians) * along + math.sin(radians) * across;
  return [math.floor(x + 0.5), math.floor(y + 0.5)];
}

/** A tapered strip along a blade, from `from` to `to` away from the hub: two filled triangles. */
function strip(
  centerX: number,
  centerY: number,
  angle: number,
  from: number,
  to: number,
  rootHalf: number,
  tipHalf: number,
  color: number,
): void {
  const [x1, y1] = bladePoint(centerX, centerY, angle, from, -rootHalf);
  const [x2, y2] = bladePoint(centerX, centerY, angle, from, rootHalf);
  const [x3, y3] = bladePoint(centerX, centerY, angle, to, tipHalf);
  const [x4, y4] = bladePoint(centerX, centerY, angle, to, -tipHalf);
  lcd.drawFilledTriangle(x1, y1, x2, y2, x3, y3, color);
  lcd.drawFilledTriangle(x1, y1, x3, y3, x4, y4, color);
}

/**
 * The main rotor seen from above, as on Flightdown's cockpit: two blades with yellow tips, their grips and the head.
 * As it spools up the blades leave a blur behind them and the disc they sweep shows.
 */
function drawRotor(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
  share: number,
  background: number,
  blade: number,
  tip: number,
) {
  const hub = math.max(3, math.floor(radius * 0.16 + 0.5));
  const half = math.max(1.5, radius * 0.06);
  const blades = [angle, angle + 180];

  if (share > 0.05) {
    lcd.drawFilledCircle(centerX, centerY, radius, mix(background, blade, 0.08 * share));
    lcd.drawCircle(centerX, centerY, radius, mix(background, blade, 0.3 * share));
    // The blur trails each blade (the rotor turns clockwise): a wide faint wedge, then a narrow brighter one.
    for (const pointing of blades) {
      const at = math.floor(pointing) % 360;
      lcd.drawPie(centerX, centerY, radius, at - math.floor(55 * share), at, mix(background, blade, 0.2 * share));
      lcd.drawPie(centerX, centerY, radius, at - math.floor(22 * share), at, mix(background, blade, 0.42 * share));
    }
  }

  for (const at of blades) {
    strip(centerX, centerY, at, hub * 0.9, radius - 1, half, half * 0.75, lcd.RGB(blade));
    strip(centerX, centerY, at, radius * 0.84, radius - 1, half * 0.8, half * 0.75, lcd.RGB(tip));
    const [fromX, fromY] = bladePoint(centerX, centerY, at, hub * 0.9, -half);
    const [toX, toY] = bladePoint(centerX, centerY, at, radius * 0.84, -half * 0.8);
    lcd.drawLine(fromX, fromY, toX, toY, SOLID, mix(blade, 0x000000, 0.28));
    strip(centerX, centerY, at, 0, hub * 2.1, half * 1.6, half * 1.4, mix(METAL, 0x000000, 0.1));
  }

  lcd.drawFilledCircle(centerX, centerY, hub, lcd.RGB(METAL_DARK));
  lcd.drawFilledCircle(centerX, centerY, math.max(2, math.floor(hub * 0.62)), lcd.RGB(METAL));
  lcd.drawFilledCircle(centerX, centerY, math.max(1, math.floor(hub * 0.25)), mix(background, 0x000000, 0.2));
}

/** Spools the rotor up while armed with the throttle on, and lets it coast down after a cut or a disarm. */
function turn(widget: Widget, spinning: boolean): number {
  const now = getTime();
  // Back from a hidden screen: no jump.
  const elapsed = math.min(50, math.max(0, now - widget.lastTime));
  widget.lastTime = now;
  if (spinning) widget.speed = math.min(FULL_SPEED, widget.speed + (FULL_SPEED / SPOOL_UP) * elapsed);
  else widget.speed = math.max(0, widget.speed - (FULL_SPEED / SPOOL_DOWN) * elapsed);
  widget.angle = (widget.angle + widget.speed * elapsed) % 360;
  return widget.speed / FULL_SPEED;
}

/** The model picture fitted to a box, kept until the model or the box changes. */
function picture(widget: Widget, file: string | undefined, width: number, height: number): Bitmap | undefined {
  const key = `${file}@${width}x${height}`;
  if (widget.pictureKey != key) {
    widget.pictureKey = key;
    widget.picture = undefined;
    const opened = file ? Bitmap.open(`/IMAGES/${file}`) : undefined;
    if (opened != null) widget.picture = Bitmap.resize(opened, width, height) ?? opened;
  }
  return widget.picture;
}

/**
 * A switch's light: a small pill with a lamp, lit in `color` when on, dark when off, and what it is for ("SA ARM"),
 * cut to the switch's name ("SA") when the pill is too narrow for both.
 */
function switchLight(
  x: number,
  y: number,
  width: number,
  label: string,
  on: boolean,
  color: number,
  background: number,
) {
  lcd.drawFilledRectangle(x, y, width, 16, mix(background, 0x000000, 0.35));
  lcd.drawFilledCircle(x + 8, y + 8, 4, on ? lcd.RGB(color) : lcd.RGB(LIGHT_OFF));
  const [labelWidth] = lcd.sizeText(label, SMLSIZE);
  const shown = 15 + labelWidth + 3 <= width ? label : label.slice(0, 2);
  lcd.drawText(x + 15, y + 2, shown, SMLSIZE + (on ? lcd.RGB(0xffffff) : lcd.RGB(0x9aa3ad)));
}

function draw(widget: Widget, width: number, height: number): void {
  const info = model.getInfo();
  const isArmed = getValue(widget.options.ArmedSwitch) === MIN_VALUE;
  const isThrottleActive = getValue(widget.options.ThrottleCutSwitch) === MIN_VALUE;
  const live = isArmed && isThrottleActive;
  const share = turn(widget, live);
  const rescue = getValue('sh') > 0;
  const armedState = STATES[live ? 'live' : isArmed ? 'armed' : 'safe'];
  const state = rescue ? {...armedState, ...RESCUE} : armedState;

  lcd.drawFilledRectangle(0, 0, width, height, lcd.RGB(state.fill));
  // Live: the border blinks, a second on, a second off. Rescue: twice as fast.
  if (rescue ? getTime() % 50 < 30 : live && getTime() % 100 < 60) {
    lcd.drawRectangle(0, 0, width, height, lcd.RGB(state.ink), 2);
  }

  // The M2 EVO's zone (2 + 1 layout, top left, with the top bar, sliders, trims and flight mode) is 198 × 86.
  if (height >= 80 && width >= 150) {
    // The rotor on the right, as tall as the zone; the state, the two switches and the picture on the left.
    const radius = math.floor(math.min(height - 8, width * 0.45) / 2);
    const centerX = width - radius - 4;
    const left = centerX - radius - 6;
    drawRotor(centerX, math.floor(height / 2), radius, widget.angle, share, state.fill, state.blade, state.tip);
    lcd.drawText(6, 0, state.word, MIDSIZE + BOLD + lcd.RGB(state.ink));
    const [wordWidth] = lcd.sizeText(state.word, MIDSIZE + BOLD);
    const [nameWidth] = lcd.sizeText(info.name!, SMLSIZE);
    if (6 + wordWidth + 8 + nameWidth <= left) lcd.drawText(left, 9, info.name!, SMLSIZE + RIGHT + lcd.RGB(0xc0c6cd));
    const pill = math.min(64, math.floor((left - 10) / 2));
    switchLight(6, 28, pill, 'SA ARM', isArmed, 0xffb020, state.fill);
    switchLight(10 + pill, 28, pill, 'SF THR', isThrottleActive, 0xff5a5f, state.fill);
    const bitmap = picture(widget, info.bitmap, left - 4, height - 48);
    if (bitmap != null) lcd.drawBitmap(bitmap, 4, 46);
  } else {
    // A small zone: the rotor on the left, the state and the two switches beside it when there is room.
    const radius = math.max(8, math.floor(height / 2) - 3);
    drawRotor(radius + 4, math.floor(height / 2), radius, widget.angle, share, state.fill, state.blade, state.tip);
    const x = radius * 2 + 12;
    if (width - x >= 60) lcd.drawText(x, math.floor(height / 2) - 20, state.word, MIDSIZE + BOLD + lcd.RGB(state.ink));
    if (width - x >= 116 && height >= 40) {
      switchLight(x, math.floor(height / 2) + 4, 54, 'SA ARM', isArmed, 0xffb020, state.fill);
      switchLight(x + 58, math.floor(height / 2) + 4, 54, 'SF THR', isThrottleActive, 0xff5a5f, state.fill);
    }
  }
}

function refresh(widget: Widget, event: null | unknown): void {
  if (null !== event) draw(widget, LCD_W, LCD_H);
  else draw(widget, widget.zone.w, widget.zone.h);
}

export {refresh, name, create, update, options};
