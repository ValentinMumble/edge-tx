const name = 'Battery';

// TODO type for options

const options: any[] = [
  ['BattSensor', SOURCE, 1],
  ['Cells', VALUE, 3, 1, 12],
  ['CellVMax', VALUE, 420, 400, 435],
  ['CellVMin', VALUE, 370, 250, 390],
  ['Alarm', BOOL, 1],
];

type Options = {
  BattSensor: number;
  Cells: number;
  CellVMax: number;
  CellVMin: number;
  Alarm: number;
};

type Widget = {
  zone: Zone;
  options: Options;
  waitTime: number;
  bt: number;
  CellVMax: number;
  CellVMin: number;
  pixSizeX: number;
  pixSizeY: number;
  picture: Bitmap;
};

// Beep Battery Low Warning
function batteryWarning(widget: Widget) {
  if ((widget.options.Alarm === 1 && widget.bt < widget.CellVMin) || widget.bt > widget.CellVMax) {
    if (getTime() >= widget.waitTime) {
      widget.waitTime = getTime() + 200;
      playTone(2500, 200, 100, 0, 0);
      playTone(2500, 200, 0, 0, 0);
    }
  }
}

function create(zone: Zone, options: Options): Widget {
  const widget: Widget = {
    zone,
    options,
    waitTime: getTime(),
    bt: 0,
    CellVMax: 0,
    CellVMin: 0,
    pixSizeX: 0,
    pixSizeY: 0,
    picture: Bitmap.open(`/WIDGETS/Battery/battery_${zone.h}.png`),
  };

  const [pixSizeX, pixSizeY] = Bitmap.getSize(widget.picture);

  widget.pixSizeX = pixSizeX;
  widget.pixSizeY = pixSizeY;
  widget.CellVMax = (widget.options.CellVMax / 100) * widget.options.Cells;
  widget.CellVMin = (widget.options.CellVMin / 100) * widget.options.Cells;

  return widget;
}

function update(widget: Widget, options: Options): void {
  widget.options = options;
  widget.CellVMax = (widget.options.CellVMax / 100) * widget.options.Cells;
  widget.CellVMin = (widget.options.CellVMin / 100) * widget.options.Cells;
}

function background(widget: Widget): void {
  widget.bt = getValue(widget.options.BattSensor);

  if (widget.bt !== 0) {
    batteryWarning(widget);
  }
}

function refresh(widget: Widget): void {
  widget.bt = getValue(widget.options.BattSensor);

  if (widget.pixSizeX == 0 || widget.zone.w == 392) {
    lcd.drawText(widget.zone.w / 2, widget.zone.h / 2, 'X', CENTER + VCENTER + DBLSIZE + RED + SHADOWED + BLINK);
  } else if (widget.bt !== 0) {
    let steps = 0;

    if (widget.zone.h == 169) {
      steps = math.floor((144 / 100) * ((widget.bt - widget.CellVMin) / ((widget.CellVMax - widget.CellVMin) / 100)));
    } else {
      steps = math.floor((167 / 100) * ((widget.bt - widget.CellVMin) / ((widget.CellVMax - widget.CellVMin) / 100)));
    }

    if (steps >= 0 && steps <= 167 && widget.zone.h == 42) {
      lcd.drawFilledRectangle(11, 3, steps, 36, GREEN);
    } else if (steps >= 0 && steps <= 167 && widget.zone.h == 56) {
      lcd.drawFilledRectangle(11, 3, steps, 50, GREEN);
    } else if (steps >= 0 && steps <= 167 && widget.zone.h == 84) {
      lcd.drawFilledRectangle(11, 3, steps, 78, GREEN);
    } else if (steps >= 0 && steps <= 144 && widget.zone.h == 169) {
      lcd.drawFilledRectangle(3, 144 - steps + 16, 78, steps, GREEN);
    } else {
      batteryWarning(widget);
    }

    lcd.drawBitmap(widget.picture, 0, 0);

    if (widget.zone.h == 169) {
      lcd.drawText(
        widget.zone.w * 0.7,
        widget.zone.h * 0.68,
        string.format('%.2fv', widget.bt / widget.options.Cells),
        CENTER + VCENTER + 0 + GREEN + SHADOWED
      );
      lcd.drawText(
        widget.zone.w * 0.7,
        widget.zone.h * 0.82,
        string.format('%.2fv', widget.bt),
        CENTER + VCENTER + DBLSIZE + GREEN + SHADOWED
      );
    } else {
      lcd.drawText(
        widget.zone.w / 2,
        widget.zone.h * 0.28,
        string.format('%.2fv', widget.bt / widget.options.Cells),
        CENTER + VCENTER + 0 + GREEN + SHADOWED
      );
      lcd.drawText(
        widget.zone.w / 2,
        widget.zone.h * 0.62,
        string.format('%.2fv', widget.bt),
        CENTER + VCENTER + MIDSIZE + GREEN + SHADOWED
      );
    }
  } else {
    lcd.drawBitmap(widget.picture, 0, 0);

    if (widget.zone.h == 169) {
      lcd.drawText(
        widget.zone.w * 0.7,
        widget.zone.h * 0.68,
        string.format('%.2fv', widget.bt / widget.options.Cells),
        CENTER + VCENTER + 0 + COLOR_THEME_DISABLED + SHADOWED + BLINK
      );
      lcd.drawText(
        widget.zone.w * 0.7,
        widget.zone.h * 0.82,
        string.format('%.2fv', widget.bt),
        CENTER + VCENTER + MIDSIZE + COLOR_THEME_DISABLED + SHADOWED + BLINK
      );
    } else {
      lcd.drawText(
        widget.zone.w / 2,
        widget.zone.h * 0.28,
        string.format('%.2fv', widget.bt / widget.options.Cells),
        CENTER + VCENTER + 0 + COLOR_THEME_DISABLED + SHADOWED + BLINK
      );
      lcd.drawText(
        widget.zone.w / 2,
        widget.zone.h * 0.62,
        string.format('%.2fv', widget.bt),
        CENTER + VCENTER + MIDSIZE + COLOR_THEME_DISABLED + SHADOWED + BLINK
      );
    }
  }
}

export {name, options, create, update, refresh, background};
