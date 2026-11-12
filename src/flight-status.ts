const name = 'FMStatus';
const MIN_VALUE = -1024;
const MAX_VALUE = 1024;

const options: any[] = [
  ['FlightModeSource', SOURCE, 1],
  ['GyroSource', SOURCE, 1],
];

interface Options {
  FlightModeSource: number;
  GyroSource: number;
}

interface Widget {
  filename?: string;
  bitmap?: Bitmap;
  bitmapWidth?: number;
  bitmapHeight?: number;
  zone: Zone;
  options: Options;
}

function create(zone: Zone, options: Options) {
  const widget: Widget = {
    zone,
    options,
  };

  update(widget, options);

  return widget;
}

function update(widget: Widget, options: Options) {
  widget.options = options;
}

/** SH held down: the rescue. The zone turns red and says RESCUE, as big as fits (it is longer than "IU 2"). */
function drawRescue(x: number, y: number, w: number, h: number): void {
  lcd.drawFilledRectangle(0, 0, w, h, lcd.RGB(0x8a1c20));
  let size = SMLSIZE;
  for (const bigger of [DBLSIZE, MIDSIZE, 0]) {
    const [textWidth] = lcd.sizeText('RESCUE', bigger);
    if (textWidth <= w - 4) {
      size = bigger;
      break;
    }
  }
  lcd.drawText(x, y, 'RESCUE', size | lcd.RGB(0xffffff));
}

function draw(widget: Widget, x: number, y: number, w: number, h: number): void {
  if (getValue('sh') > 0) {
    drawRescue(x, y, w, h);
    return;
  }
  const isGyroOn = getValue(widget.options.GyroSource) === MAX_VALUE;

  // Self-level on: the zone turns blue, as the cockpit's LEVEL light (the theme's own "active" colour is a light grey).
  if (isGyroOn) {
    lcd.drawFilledRectangle(0, 0, w, h, lcd.RGB(0x3b75a9));
  }

  const flightModeValue = getValue(widget.options.FlightModeSource);
  const flightMode = MIN_VALUE === flightModeValue ? 1 : 0 === flightModeValue ? 2 : 3;

  // Light on the top bar's dark grey, whatever the theme's colours (the Cockpit theme's EDIT is a dark red).
  lcd.drawText(x, y, `IU ${flightMode}`, DBLSIZE | (isGyroOn ? lcd.RGB(0xffffff) : lcd.RGB(0xeeeeee)));
}

function refresh(widget: Widget, event: any, touch: any) {
  if (event != null) {
    draw(widget, 0, 0, LCD_W, LCD_H);
  } else {
    draw(widget, widget.zone.x, widget.zone.y, widget.zone.w, widget.zone.h);
  }
}

export {refresh, name, create, update, options};
