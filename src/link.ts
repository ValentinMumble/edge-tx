const name = 'Link';

/**
 * The radio link: the signal (RSSI, dB) and the link quality (%) as bars that go amber, then red, at the radio's own
 * alarm levels.
 */
const options: any[] = [];

type Widget = {zone: Zone};

function create(zone: Zone): Widget {
  return {zone};
}

function update(): void {}

/** A meter: its name, its bar against a full value, its figure, coloured by the two warning levels. */
function meter(
  y: number,
  width: number,
  label: string,
  value: number,
  full: number,
  amber: number,
  red: number,
  unit: string,
) {
  const color =
    value <= 0
      ? lcd.RGB(0x5d6570)
      : value < red
        ? lcd.RGB(0xff5a5f)
        : value < amber
          ? lcd.RGB(0xffb020)
          : lcd.RGB(0x7cd69a);
  lcd.drawText(6, y, label, SMLSIZE + lcd.RGB(0x9aa3ad));
  const barX = 44;
  const barWidth = width - barX - 52;
  lcd.drawFilledRectangle(barX, y + 3, barWidth, 9, lcd.RGB(0x3a4048));
  lcd.drawFilledRectangle(barX, y + 3, math.floor(barWidth * math.max(0, math.min(1, value / full))), 9, color);
  lcd.drawText(width - 6, y, value > 0 ? `${math.floor(value)} ${unit}` : '--', SMLSIZE + RIGHT + color);
}

function draw(widget: Widget, width: number, height: number): void {
  const rssi = getValue('RSSI');
  const quality = getValue('TQly');
  // In the top bar (74 × 39): the link quality in %, amber then red as the bars turn ("LQ 100" would not fit).
  if (height < 50) {
    lcd.drawText(4, 1, 'Tele', SMLSIZE + lcd.RGB(0x9aa3ad));
    const lost = rssi <= 0 && quality <= 0;
    const color = lost || quality <= 50 ? 0xff5a5f : quality <= 70 ? 0xffb020 : 0x7cd69a;
    lcd.drawText(4, 15, lost ? 'None' : `${quality}%`, MIDSIZE + lcd.RGB(color));
    return;
  }
  lcd.drawText(6, 2, 'Tele', SMLSIZE + lcd.RGB(0x9aa3ad));
  if (rssi <= 0 && quality <= 0) {
    lcd.drawText(6, 20, 'No tele', MIDSIZE + lcd.RGB(0x9aa3ad));
    return;
  }
  const row = math.max(16, math.floor((height - 18) / 2));
  meter(18, width, 'RSSI', rssi, 100, 45, 42, 'dB');
  meter(18 + row, width, 'LQ', quality, 100, 70, 50, '%');
}

function refresh(widget: Widget, event: null | unknown): void {
  if (null !== event) draw(widget, LCD_W, LCD_H);
  else draw(widget, widget.zone.w, widget.zone.h);
}

export {refresh, name, create, update, options};
