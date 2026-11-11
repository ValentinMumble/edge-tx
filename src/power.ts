const name = 'Power';

/**
 * The power the heli draws: a round dial of amps with a peak marker, and the watts (pack volts times amps) beside it.
 * The peak starts again with a new pack.
 */
const options: any[] = [['MaxAmps', VALUE, 40, 10, 200]];

type Options = {MaxAmps: number};
type Widget = {zone: Zone; options: Options; peak: number; powered: boolean};

/** The dial's sweep: from 7:30 round to 4:30, as cockpit dials. */
const FROM = 225;
const SWEEP = 270;

/**
 * A new pack: its voltage back after none with the mAh count at 0. The model resets the count only when telemetry
 * stops while disarmed (SA), so a dropout in flight is not a new pack.
 */
const NEW_PACK_MAH = 5;

function create(zone: Zone, options: Options): Widget {
  return {zone, options, peak: 0, powered: false};
}

function update(widget: Widget, options: Options): void {
  widget.options = options;
}

function draw(widget: Widget, width: number, height: number): void {
  const volts = getValue('VFAS');
  const amps = math.max(0, getValue('Curr'));
  const powered = volts > 0.5;
  if (powered && !widget.powered && getValue('mAh') < NEW_PACK_MAH) widget.peak = 0;
  widget.powered = powered;
  if (powered) widget.peak = math.max(widget.peak, amps);
  const most = widget.options.MaxAmps || 40;
  const angle = (value: number) => math.floor((FROM + (math.min(most, value) / most) * SWEEP) % 360);

  const radius = math.max(10, math.floor(math.min(height - 6, width / 2) / 2));
  const centerX = radius + 4;
  const centerY = math.floor(height / 2) + 2;
  // The track, the amps so far, the peak.
  lcd.drawAnnulus(centerX, centerY, radius - 5, radius, FROM, FROM + SWEEP - 360, lcd.RGB(0x3a4048));
  if (amps > 0.2) lcd.drawAnnulus(centerX, centerY, radius - 5, radius, FROM, angle(amps), lcd.RGB(0xffb020));
  if (widget.peak > 0.2) {
    const at = angle(widget.peak);
    lcd.drawAnnulus(centerX, centerY, radius - 7, radius + 1, at - 2, at + 2, lcd.RGB(0xff5a5f));
  }
  lcd.drawText(centerX, centerY, string.format('%.0f', amps), MIDSIZE + BOLD + CENTER + VCENTER + lcd.RGB(0xeeeeee));
  lcd.drawText(centerX, centerY + 14, 'A', SMLSIZE + CENTER + lcd.RGB(0x9aa3ad));

  const x = centerX + radius + 10;
  lcd.drawText(x, 2, 'Power', SMLSIZE + lcd.RGB(0x9aa3ad));
  lcd.drawText(x, 16, `${string.format('%.0f', volts * amps)} W`, MIDSIZE + BOLD + lcd.RGB(0xeeeeee));
  lcd.drawText(x, height - 18, `peak ${string.format('%.1f', widget.peak)} A`, SMLSIZE + lcd.RGB(0xff5a5f));
}

function refresh(widget: Widget, event: null | unknown): void {
  if (null !== event) draw(widget, LCD_W, LCD_H);
  else draw(widget, widget.zone.w, widget.zone.h);
}

export {refresh, name, create, update, options};
