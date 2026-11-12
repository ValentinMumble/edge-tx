const name = 'FlyTimer';

/**
 * Time in the air on this pack: it counts only while the pack draws over 2 A (the rotor driven), as Flightdown counts
 * it, so time on the bench does not count. A bar fills towards the time to land at, amber past 80 %, red past it, with
 * a buzz when it is reached. A new pack starts it again.
 */
const options: any[] = [['LandAt', VALUE, 272, 60, 900]];

type Options = {LandAt: number};
type Widget = {zone: Zone; options: Options; seconds: number; lastTime: number; buzzed: boolean; powered: boolean};

/** Under this the motor only idles. */
const DRIVEN_AMPS = 2;

/**
 * A new pack: its voltage back after none with the mAh count at 0. The model resets the count only when telemetry
 * stops while disarmed (SA), so a dropout in flight is not a new pack.
 */
const NEW_PACK_MAH = 5;

function create(zone: Zone, options: Options): Widget {
  return {zone, options, seconds: 0, lastTime: getTime(), buzzed: false, powered: false};
}

function update(widget: Widget, options: Options): void {
  widget.options = options;
}

const clock = (seconds: number) => string.format('%d:%02d', math.floor(seconds / 60), math.floor(seconds % 60));

function draw(widget: Widget, width: number, height: number): void {
  const now = getTime();
  const elapsed = math.min(50, math.max(0, now - widget.lastTime)) / 100;
  widget.lastTime = now;
  const powered = getValue('VFAS') > 0.5;
  if (powered && !widget.powered && getValue('mAh') < NEW_PACK_MAH) {
    widget.seconds = 0;
    widget.buzzed = false;
  }
  widget.powered = powered;
  if (powered && getValue('Curr') >= DRIVEN_AMPS) widget.seconds += elapsed;

  const landAt = widget.options.LandAt || 272;
  const share = math.min(1, widget.seconds / landAt);
  const color = share >= 1 ? lcd.RGB(0xff5a5f) : share >= 0.8 ? lcd.RGB(0xffb020) : lcd.RGB(0x7cd69a);
  if (share >= 1 && !widget.buzzed) {
    widget.buzzed = true;
    playHaptic(30, 100);
    playTone(1500, 300, 0);
  }

  lcd.drawText(6, 2, 'In the air', SMLSIZE + lcd.RGB(0x9aa3ad));
  lcd.drawText(width - 6, 2, `land at ${clock(landAt)}`, SMLSIZE + RIGHT + lcd.RGB(0x9aa3ad));
  lcd.drawText(6, 14, clock(widget.seconds), (height >= 60 ? DBLSIZE : MIDSIZE) + color);

  const barY = height - 12;
  lcd.drawFilledRectangle(6, barY, width - 12, 6, lcd.RGB(0x3a4048));
  lcd.drawFilledRectangle(6, barY, math.floor((width - 12) * share), 6, color);
  const mark = 6 + math.floor((width - 12) * 0.8);
  lcd.drawLine(mark, barY - 3, mark, barY + 8, SOLID, lcd.RGB(0xffb020));
}

function refresh(widget: Widget, event: null | unknown): void {
  if (null !== event) draw(widget, LCD_W, LCD_H);
  else draw(widget, widget.zone.w, widget.zone.h);
}

export {refresh, name, create, update, options};
