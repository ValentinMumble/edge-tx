const name = 'FlightState';

/**
 * How the heli is set to fly, beside the flight mode the top bar shows (FMStatus): the gyro on SC and the throttle hold
 * on SF, as two lights. While SH is held down (the rescue), the zone turns red and says RESCUE.
 */
const options: any[] = [
  ['GyroSource', SOURCE, 1],
  ['HoldSource', SOURCE, 1],
];

type Options = {GyroSource: number; HoldSource: number};
type Widget = {zone: Zone; options: Options};

function create(zone: Zone, options: Options): Widget {
  return {zone, options};
}

function update(widget: Widget, options: Options): void {
  widget.options = options;
}

/** Text centred in a box. */
function centered(x: number, y: number, width: number, height: number, text: string, flags: number) {
  const [, textHeight] = lcd.sizeText(text, flags);
  lcd.drawText(x + math.floor(width / 2), y + math.floor((height - textHeight) / 2), text, flags + CENTER);
}

/** A state light: its word, filled in `color` when on, outlined when off. */
function light(x: number, y: number, width: number, height: number, word: string, on: boolean, color: number) {
  if (on) lcd.drawFilledRectangle(x, y, width, height, lcd.RGB(color));
  else lcd.drawRectangle(x, y, width, height, lcd.RGB(0x5d6570), 2);
  centered(x, y, width, height, word, MIDSIZE + (on ? lcd.RGB(0x101418) : lcd.RGB(0x9aa3ad)));
}

function draw(widget: Widget, width: number, height: number): void {
  if (getValue('sh') > 0) {
    lcd.drawFilledRectangle(0, 0, width, height, lcd.RGB(0x8a1c20));
    lcd.drawText(6, 2, 'SH held', SMLSIZE + lcd.RGB(0xffd2d2));
    centered(0, 0, width, height, 'RESCUE', DBLSIZE + lcd.RGB(0xffffff));
    return;
  }
  const gyro = getValue(widget.options.GyroSource || 'sc') >= 1024;
  const hold = getValue(widget.options.HoldSource || 'sf') !== -1024;
  const gap = 8;
  const lightWidth = math.floor((width - 12 - gap) / 2);
  const lightHeight = math.min(44, height - 12);
  const y = math.floor((height - lightHeight) / 2);
  light(6, y, lightWidth, lightHeight, gyro ? 'GYRO ON' : 'GYRO OFF', gyro, 0x3b9eff);
  light(6 + lightWidth + gap, y, lightWidth, lightHeight, hold ? 'HOLD' : 'THR ON', hold, 0xffb020);
}

function refresh(widget: Widget, event: null | unknown): void {
  if (null !== event) draw(widget, LCD_W, LCD_H);
  else draw(widget, widget.zone.w, widget.zone.h);
}

export {refresh, name, create, update, options};
