const name = 'Timers';

/**
 * The model's two timers in the top bar (74 × 39): this pack's time with the motor on (timer 1) over the sortie's,
 * today's (timer 2, started again each day by the Cockpit). Past an hour a time reads "1h07", to fit.
 */
const options: any[] = [];

type Widget = {zone: Zone};

function create(zone: Zone): Widget {
  return {zone};
}

function update(): void {}

function clock(seconds: number): string {
  const whole = math.max(0, math.floor(seconds));
  const hours = math.floor(whole / 3600);
  const minutes = math.floor((whole % 3600) / 60);
  return hours > 0 ? `${hours}h${string.format('%02d', minutes)}` : `${minutes}:${string.format('%02d', whole % 60)}`;
}

function draw(width: number): void {
  const grey = lcd.RGB(0x9aa3ad);
  lcd.drawText(4, 4, 'Pack', TINSIZE + grey);
  lcd.drawText(width - 3, 1, clock(model.getTimer(0)?.value ?? 0), SMLSIZE + RIGHT + lcd.RGB(0x7cd69a));
  lcd.drawText(4, 23, 'Sortie', TINSIZE + grey);
  lcd.drawText(width - 3, 20, clock(model.getTimer(1)?.value ?? 0), SMLSIZE + RIGHT + lcd.RGB(0xeeeeee));
}

function refresh(widget: Widget): void {
  draw(widget.zone.w);
}

export {refresh, name, create, update, options};
