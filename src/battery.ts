const NAME = 'Battery';
const COLOR_LOW = {
  red: 188,
  green: 71,
  blue: 54,
};
const COLOR_MED = {
  red: 234,
  green: 196,
  blue: 69,
};
const COLOR_HIGH = {
  red: 79,
  green: 121,
  blue: 66,
};

// TODO type for options
const options: any[] = [
  ['BattSensor', SOURCE, 276],
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
  voltage: number;
  CellVMax: number;
  CellVMin: number;
  pixSizeX: number;
  pixSizeY: number;
  picture: Bitmap;
};

// Beep Battery Low Warning
function batteryWarning(widget: Widget): void {
  if ((widget.options.Alarm === 1 && widget.voltage < widget.CellVMin) || widget.voltage > widget.CellVMax) {
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
    voltage: 0,
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
  widget.voltage = getValue(widget.options.BattSensor);

  if (widget.voltage !== 0) {
    batteryWarning(widget);
  }
}

type Color = {
  red: number;
  green: number;
  blue: number;
};

function colorGradient(fadeFraction: number, rgbColor1: Color, rgbColor2: Color, rgbColor3?: Color): Color {
  let color1 = rgbColor1;
  let color2 = rgbColor2;
  let fade = fadeFraction;

  if (rgbColor3) {
    // Do we have 3 colors for the gradient? Need to adjust the params.
    fade = fade * 2;

    // Find which interval to use and adjust the fade percentage
    if (fade >= 1) {
      fade -= 1;
      color1 = rgbColor2;
      color2 = rgbColor3;
    }
  }

  const diffRed = color2.red - color1.red;
  const diffGreen = color2.green - color1.green;
  const diffBlue = color2.blue - color1.blue;

  return {
    red: math.floor(color1.red + diffRed * fade),
    green: math.floor(color1.green + diffGreen * fade),
    blue: math.floor(color1.blue + diffBlue * fade),
  };
}

function refresh(widget: Widget): void {
  widget.voltage = getValue(widget.options.BattSensor);

  // Error
  if (0 === widget.pixSizeX || 392 === widget.zone.w || 0 === widget.voltage) {
    lcd.drawText(widget.zone.w / 2, widget.zone.h / 2, 'No telemetry', CENTER + VCENTER);

    return;
  }

  let steps = 0;

  if (widget.zone.h == 169) {
    steps = math.floor(
      (144 / 100) * ((widget.voltage - widget.CellVMin) / ((widget.CellVMax - widget.CellVMin) / 100))
    );
  } else {
    steps = math.floor(
      (167 / 100) * ((widget.voltage - widget.CellVMin) / ((widget.CellVMax - widget.CellVMin) / 100))
    );
  }

  const {red, green, blue} = colorGradient(steps / 167, COLOR_LOW, COLOR_MED, COLOR_HIGH);
  const color = lcd.RGB(red, green, blue);

  // Battery filling
  if (steps >= 0 && steps <= 167 && widget.zone.h == 42) {
    lcd.drawFilledRectangle(11, 3, steps, 36, color);
  } else if (steps >= 0 && steps <= 167 && widget.zone.h == 56) {
    lcd.drawFilledRectangle(11, 3, steps, 50, color);
  } else if (steps >= 0 && steps <= 167 && widget.zone.h == 84) {
    lcd.drawFilledRectangle(11, 3, steps, 78, color);
  } else if (steps >= 0 && steps <= 144 && widget.zone.h == 169) {
    lcd.drawFilledRectangle(3, 144 - steps + 16, 78, steps, color);
  } else {
    batteryWarning(widget);
  }

  lcd.drawBitmap(widget.picture, 0, 0);

  drawVoltage(widget);
}

function drawVoltage(widget: Widget): void {
  if (widget.zone.h == 169) {
    lcd.drawText(
      widget.zone.w * 0.7,
      widget.zone.h * 0.68,
      string.format('%.2fv', widget.voltage / widget.options.Cells),
      CENTER + VCENTER + 0 + WHITE
    );
    lcd.drawText(
      widget.zone.w * 0.7,
      widget.zone.h * 0.82,
      string.format('%.2fv', widget.voltage),
      CENTER + VCENTER + DBLSIZE + WHITE
    );
  } else {
    lcd.drawText(
      widget.zone.w / 2,
      widget.zone.h * 0.28,
      string.format('%.2fv', widget.voltage / widget.options.Cells),
      CENTER + VCENTER + 0 + WHITE
    );
    lcd.drawText(
      widget.zone.w / 2,
      widget.zone.h * 0.62,
      string.format('%.2fv', widget.voltage),
      CENTER + VCENTER + MIDSIZE + WHITE
    );
  }
}

export {NAME as name, options, create, update, refresh, background};
