const name = 'FlightState';

/**
 * How the heli is set to fly, in one place: the flight mode on SE (IU 1, IU 2, IU 3, as FMStatus names them), the gyro
 * on SC, and the throttle hold on SF.
 */
const options: any[] = [
  ['FlightModeSource', SOURCE, 1],
  ['GyroSource', SOURCE, 1],
  ['HoldSource', SOURCE, 1],
];

type Options = {FlightModeSource: number; GyroSource: number; HoldSource: number};
type Widget = {zone: Zone; options: Options};

function create(zone: Zone, options: Options): Widget {
  return {zone, options};
}

function update(widget: Widget, options: Options): void {
  widget.options = options;
}

/** A state chip: its word, filled in `color` when on, outlined when off. */
function chip(x: number, y: number, width: number, word: string, on: boolean, color: number) {
  if (on) lcd.drawFilledRectangle(x, y, width, 18, lcd.RGB(color));
  else lcd.drawRectangle(x, y, width, 18, lcd.RGB(0x5d6570));
  lcd.drawText(x + width / 2, y + 2, word, SMLSIZE + CENTER + (on ? lcd.RGB(0x101418) : lcd.RGB(0x9aa3ad)));
}

function draw(widget: Widget, width: number, height: number): void {
  const mode = getValue(widget.options.FlightModeSource || 'se');
  const gyro = getValue(widget.options.GyroSource || 'sc') >= 1024;
  const hold = getValue(widget.options.HoldSource || 'sf') !== -1024;
  const label = mode <= -512 ? 'IU 1' : mode >= 512 ? 'IU 3' : 'IU 2';

  lcd.drawText(6, 2, 'Flight mode', SMLSIZE + lcd.RGB(0x9aa3ad));
  lcd.drawText(6, 16, label, (height >= 60 ? DBLSIZE : MIDSIZE) + BOLD + lcd.RGB(0xeeeeee));
  const chipWidth = math.min(80, math.floor((width - 18) / 2));
  const y = height - 22;
  chip(width - 2 * chipWidth - 10, y, chipWidth, gyro ? 'GYRO ON' : 'GYRO OFF', gyro, 0x3b9eff);
  chip(width - chipWidth - 6, y, chipWidth, hold ? 'HOLD' : 'THR ON', hold, 0xffb020);
}

function refresh(widget: Widget, event: null | unknown): void {
  if (null !== event) draw(widget, LCD_W, LCD_H);
  else draw(widget, widget.zone.w, widget.zone.h);
}

export {refresh, name, create, update, options};
