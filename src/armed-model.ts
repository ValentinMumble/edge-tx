const name = 'Armed Model';
const MIN_VALUE = -1024;

const options: any[] = [
  ['ArmedSource', SOURCE, 1],
  ['ArmedColor', COLOR, COLOR_THEME_SECONDARY3],
  ['ThrottleCutSource', SOURCE, 1],
  ['UseThemeColor', BOOL, 1],
];

interface Options {
  ArmedSource: number;
  ThrottleCutSource: number;
  ArmedColor: number;
  UseThemeColor: number;
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

  const isArmed = getValue(widget.options.ArmedSource) === MIN_VALUE;
  const isThrottleActive = getValue(widget.options.ThrottleCutSource) === MIN_VALUE;

  if (isArmed) {
    lcd.drawFilledRectangle(0, 0, w, h, widget.options.ArmedColor);
  }

  if (isArmed && isThrottleActive) {
    drawQuadcopter(5, 5);
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
      lcd.drawBitmap(widget.bitmap, 0, 0);
    } else {
      lcd.drawText(x + 5, y + 5, modelInfo.name!);
    }
  }
}

function refresh(widget: Widget, event: any, touch: any) {
  if (event != null) {
    draw(widget, 0, 0, LCD_W, LCD_H);
  } else {
    draw(widget, widget.zone.x, widget.zone.y, widget.zone.w, widget.zone.h);
  }
}

function translate(text: String, lang: String): String {
  const tr = {
    // ModelBmp: "Models",
    ArmedColor: 'Armed Color',
    ArmedSource: 'Armed Source',
    ThrottleCutSource: 'Throttle Cut Source',
    UseThemeColor: 'Use Theme Color',
  } as unknown as LuaTable<String, String>;

  const v = tr.get(text);

  return v == null ? v : text;
}

////

let animTick = 0;
let armed = false;

function drawPropellor(_x: number, _y: number, invert: boolean): void {
  let inc = animTick;
  if (invert == true) {
    inc = (inc - 3) * -1;
    inc = inc + 3;
    if (inc > 3) {
      inc = inc - 4;
    }
  }

  lcd.drawRectangle(_x + 4, _y + 4, 3, 3, SOLID);

  // Animated Quadcopter propellors
  if ((!armed && !invert) || (armed && inc == 0)) {
    lcd.drawLine(_x + 1, _y + 9, _x + 9, _y + 1, SOLID, FORCE);
    lcd.drawLine(_x + 1, _y + 10, _x + 8, _y + 1, SOLID, FORCE);
  } else if (armed && inc == 1) {
    lcd.drawLine(_x, _y + 5, _x + 9, _y + 5, SOLID, FORCE);
    lcd.drawLine(_x, _y + 4, _x + 9, _y + 6, SOLID, FORCE);
  } else if ((!armed && invert) || (armed && inc == 2)) {
    lcd.drawLine(_x + 1, _y + 1, _x + 9, _y + 9, SOLID, FORCE);
    lcd.drawLine(_x + 1, _y + 2, _x + 10, _y + 9, SOLID, FORCE);
  } else if (armed && inc == 3) {
    lcd.drawLine(_x + 5, _y, _x + 5, _y + 10, SOLID, FORCE);
    lcd.drawLine(_x + 6, _y, _x + 4, _y + 10, SOLID, FORCE);
  }
}

function drawQuadcopter(_x: number, _y: number): void {
  // Top left to bottom right
  lcd.drawLine(_x + 5, _y + 5, _x + 23, _y + 23, SOLID, FORCE);
  lcd.drawLine(_x + 5, _y + 6, _x + 22, _y + 23, SOLID, FORCE);
  lcd.drawLine(_x + 6, _y + 5, _x + 23, _y + 22, SOLID, FORCE);

  // Bottom left to top right
  lcd.drawLine(_x + 5, _y + 23, _x + 23, _y + 5, SOLID, FORCE);
  lcd.drawLine(_x + 5, _y + 22, _x + 22, _y + 5, SOLID, FORCE);
  lcd.drawLine(_x + 6, _y + 23, _x + 23, _y + 6, SOLID, FORCE);

  // Middle of Quad
  lcd.drawFilledRectangle(_x + 12, _y + 7, 5, 15, SOLID);
  lcd.drawFilledRectangle(_x + 11, _y + 11, 7, 7, SOLID);
  lcd.drawPoint(_x + 13, _y + 10);
  lcd.drawPoint(_x + 13, _y + 18);
  lcd.drawPoint(_x + 15, _y + 10);
  lcd.drawPoint(_x + 15, _y + 18);

  if (armed) {
    lcd.drawText(_x + 2, _y + 11, 'armed', SMLSIZE + BLINK);
  }

  // Top-left
  drawPropellor(_x, _y, false);
  // Bottom-Right
  drawPropellor(_x + 18, _y + 18, false);
  // Top-Right
  drawPropellor(_x + 18, _y, true);
  // Bottom-left
  drawPropellor(_x, _y + 18, true);
}
////

export {refresh, name, create, update, options, translate};
