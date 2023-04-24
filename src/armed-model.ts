const name = 'ArmedModel';
const MIN_VALUE = -1024;

const options: any[] = [
  ['ArmedSwitch', SOURCE, 1],
  ['ThrottleCutSwitch', SOURCE, 1],
];

interface Options {
  ArmedSwitch: number;
  ThrottleCutSwitch: number;
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
  const modelInfo = model.getInfo();

  if (widget.filename != modelInfo.bitmap) {
    widget.filename = modelInfo.bitmap;
    widget.bitmap = Bitmap.open(`/IMAGES/${modelInfo.bitmap}`);

    if (widget.bitmap != null) {
      const [width, height] = Bitmap.getSize(widget.bitmap);
      const nh = h >= 96 && w >= 120 ? h - 38 : h;
      const r = Bitmap.resize(widget.bitmap, w, nh);

      if (r != null) {
        widget.bitmap = r;
        widget.bitmapWidth = w;
        widget.bitmapHeight = nh;
      } else {
        widget.bitmapWidth = width;
        widget.bitmapHeight = height;
      }
    }
  }

  const isArmed = getValue(widget.options.ArmedSwitch) === MIN_VALUE;
  // const isThrottleActive = getValue(widget.options.ThrottleCutSwitch) === MIN_VALUE;

  if (isArmed) {
    lcd.drawFilledRectangle(0, 0, w, h, COLOR_THEME_WARNING);
  }

  // big space to draw
  if (h >= 96 && w >= 120) {
    if (widget.bitmap != null) {
      lcd.drawBitmap(widget.bitmap, 0, 38);
    }

    lcd.drawText(x + 5, y + 5, modelInfo.name!);
  } else {
    // smaller space to draw
    if (widget.bitmap != null) {
      lcd.drawBitmap(widget.bitmap, 30, 0);
    }

    lcd.drawText(x + 5, y + 5, modelInfo.name!, MIDSIZE | COLOR_THEME_EDIT);
  }
}

function refresh(widget: Widget, event: any, touch: any) {
  if (event != null) {
    draw(widget, 0, 0, LCD_W, LCD_H);
  } else {
    draw(widget, widget.zone.x, widget.zone.y, widget.zone.w, widget.zone.h);
  }
}

export {refresh, name, create, update, options};
