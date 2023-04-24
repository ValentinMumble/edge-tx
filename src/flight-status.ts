const name = 'Flight Status';
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

function draw(widget: Widget, x: number, y: number, w: number, h: number): void {
  const isGyroOn = getValue(widget.options.GyroSource) === MAX_VALUE;

  if (isGyroOn) {
    lcd.drawFilledRectangle(0, 0, w, h, COLOR_THEME_ACTIVE);
  }

  const flightModeValue = getValue(widget.options.FlightModeSource);
  const flightMode = MIN_VALUE === flightModeValue ? 1 : 0 === flightModeValue ? 2 : 3;

  lcd.drawText(x, y, `IU ${flightMode}`, DBLSIZE | COLOR_THEME_EDIT);
}

function refresh(widget: Widget, event: any, touch: any) {
  if (event != null) {
    draw(widget, 0, 0, LCD_W, LCD_H);
  } else {
    draw(widget, widget.zone.x, widget.zone.y, widget.zone.w, widget.zone.h);
  }
}

export {refresh, name, create, update, options};
