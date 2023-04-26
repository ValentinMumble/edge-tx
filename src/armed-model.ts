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

function create(zone: Zone, options: Options): Widget {
  const widget: Widget = {
    zone,
    options,
  };

  update(widget, options);

  return widget;
}

function update(widget: Widget, options: Options): void {
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
  const isThrottleActive = getValue(widget.options.ThrottleCutSwitch) === MIN_VALUE;

  if (isArmed) {
    lcd.drawFilledRectangle(0, 0, w, h, COLOR_THEME_WARNING);
  }

  drawRotor(isArmed && isThrottleActive, 5, 60);

  // big space to draw
  if (h >= 96 && w >= 120) {
    if (widget.bitmap != null) {
      lcd.drawBitmap(widget.bitmap, 0, 38);
    }
  } else {
    // smaller space to draw
    if (widget.bitmap != null) {
      lcd.drawBitmap(widget.bitmap, 30, 0);
    }
  }

  // Model name
  lcd.drawText(x + 5, y + 5, modelInfo.name!, COLOR_THEME_EDIT);
}

function rotatePoint(x: number, y: number, centerX: number, centerY: number, degrees: number) {
  const newX =
    (x - centerX) * math.cos((degrees * math.pi) / 180) - (y - centerY) * math.sin((degrees * math.pi) / 180) + centerX;
  const newY =
    (x - centerX) * math.sin((degrees * math.pi) / 180) + (y - centerY) * math.cos((degrees * math.pi) / 180) + centerY;

  return [newX, newY];
}

function drawBlades(x: number, y: number, rotorSize: number, propColor: number, degrees: number): void {
  const x1 = x;
  const y1 = y;
  const x2 = x + rotorSize;
  const y2 = y;

  const centerX = x + rotorSize / 2;
  const centerY = y;

  let [xx1, yy1] = rotatePoint(x1 + 2, y1 - 0, centerX, centerY, degrees);
  let [xx2, yy2] = rotatePoint(x2 - 2, y2 + 0, centerX, centerY, degrees);
  lcd.drawLine(xx1, yy1, xx2, yy2, SOLID, propColor);

  [xx1, yy1] = rotatePoint(x1 + 1, y1 - 1, centerX, centerY, degrees);
  [xx2, yy2] = rotatePoint(x2 - 1, y2 + 1, centerX, centerY, degrees);
  lcd.drawLine(xx1, yy1, xx2, yy2, SOLID, propColor);

  [xx1, yy1] = rotatePoint(x1 + 0, y1 - 2, centerX, centerY, degrees);
  [xx2, yy2] = rotatePoint(x2 - 0, y2 + 2, centerX, centerY, degrees);
  lcd.drawLine(xx1, yy1, xx2, yy2, SOLID, propColor);

  [xx1, yy1] = rotatePoint(x1 + 0, y1 - 3, centerX, centerY, degrees);
  [xx2, yy2] = rotatePoint(x2 - 0, y2 + 3, centerX, centerY, degrees);
  lcd.drawLine(xx1, yy1, xx2, yy2, SOLID, propColor);

  [xx1, yy1] = rotatePoint(x1 + 1, y1 - 4, centerX, centerY, degrees);
  [xx2, yy2] = rotatePoint(x2 - 1, y2 + 4, centerX, centerY, degrees);
  lcd.drawLine(xx1, yy1, xx2, yy2, SOLID, propColor);

  [xx1, yy1] = rotatePoint(x1 + 2, y1 - 5, centerX, centerY, degrees);
  [xx2, yy2] = rotatePoint(x2 - 2, y2 + 5, centerX, centerY, degrees);
  lcd.drawLine(xx1, yy1, xx2, yy2, SOLID, propColor);
}

function drawRotor(
  isActive: boolean,
  x: number,
  y: number,
  hubSize = 8,
  propSize = 16,
  propColor = LIGHTGREY,
  phaseCount = 10
): void {
  const animTick = math.fmod(getTime() / 100, 2);
  const phase = math.fmod(math.ceil(animTick * phaseCount * 2), phaseCount);
  const rotorSize = propSize * 2 + hubSize;

  drawBlades(x, y, rotorSize, propColor, isActive ? (180 / phaseCount) * phase : 0);

  // Hub
  lcd.drawFilledCircle(x + rotorSize / 2, y, hubSize / 2, SOLID);
  lcd.drawFilledCircle(x + rotorSize / 2, y, hubSize / 4, SOLID | GREY);
}

function refresh(widget: Widget, event: null | unknown): void {
  if (null !== event) {
    draw(widget, 0, 0, LCD_W, LCD_H);
  } else {
    draw(widget, widget.zone.x, widget.zone.y, widget.zone.w, widget.zone.h);
  }
}

export {refresh, name, create, update, options};
