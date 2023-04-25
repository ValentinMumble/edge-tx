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

    lcd.drawText(x + 5, y + 5, modelInfo.name!);
  } else {
    // smaller space to draw
    if (widget.bitmap != null) {
      lcd.drawBitmap(widget.bitmap, 30, 0);
    }

    lcd.drawText(x + 5, y + 5, modelInfo.name!, MIDSIZE | COLOR_THEME_EDIT);
  }
}

function drawRotor(
  isActive: boolean,
  x: number,
  y: number,
  hubSize: number = 8,
  propSize: number = 12,
  propColor: number = LIGHTGREY
): void {
  const animTick = math.fmod(getTime() / 100, 2);
  const phase = math.fmod(math.ceil(animTick * 8), 4);
  const rotorSize = propSize * 2 + hubSize;

  // Blades
  if (!isActive || phase === 0) {
    // /
    lcd.drawLine(x, y + rotorSize / 2, x + rotorSize, y - rotorSize / 2, SOLID, propColor);
    lcd.drawLine(x, y + 1 + rotorSize / 2, x - 1 + rotorSize, y - rotorSize / 2, SOLID, propColor);
  } else if (phase === 1) {
    // -
    lcd.drawLine(x, y, x + rotorSize, y, SOLID, propColor);
    lcd.drawLine(x, y - 1, x + rotorSize, y + 1, SOLID, propColor);
  } else if (phase === 2) {
    // \
    lcd.drawLine(x, y - rotorSize / 2, x + rotorSize, y + rotorSize / 2, SOLID, propColor);
    lcd.drawLine(x, y + 1 - rotorSize / 2, x + 1 + rotorSize, y + rotorSize / 2, SOLID, propColor);
  } else if (phase === 3) {
    // |
    lcd.drawLine(x + rotorSize / 2, y - rotorSize / 2, x + rotorSize / 2, y + rotorSize / 2, SOLID, propColor);
    lcd.drawLine(x - 1 + rotorSize / 2, y - rotorSize / 2, x + 1 + rotorSize / 2, y + rotorSize / 2, SOLID, propColor);
  }

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
