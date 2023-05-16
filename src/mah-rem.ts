const name = 'Flight Battery Monitor';

let VoltageSensor: string | number = 'VFAS';
let mAhSensor: string | number = 'mAh';
let CurrentSensor: string | number = 'Curr';

const CapacityReservePercent = 0;

// TODO remove?
let SwReset = 'sh';

// TODO 4.2?
const CellFullVoltage = 4.0;

const VoltageDelta = 0.3;

const soundDirPath = '/WIDGETS/mahRem/sounds/';
const AnnouncePercentRemaining = true;

const GV = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8};

const GVCellCount = GV[6];
const GVBatCap = GV[7];
const GVFlightMode = 0;

let WriteGVBatRemmAh = false;
let WriteGVBatRemPer = false;

const GVBatRemmAh = GV[8];
const GVBatRemPer = GV[9];

const DEBUG = false;

let CanCallInitFuncAgain = false; // updated in bg_func

// Calculations
let UseVoltsNotmAh: boolean; // updated in init_func
let BatCapFullmAh: number; // updated in init_func
let BatCapmAh: number; // updated in init_func
let BatUsedmAh: number; // updated in bg_func
let BatRemainmAh: number; // updated in init_func, bg_func
let BatRemPer: number; // updated in init_func, bg_func
let VoltsPercentRem: number; // updated in init_func, bg_func
let VoltsNow = 0; // updated in bg_func
let CellCount: number; // updated in init_func, bg_func
let VoltsMax; // updated in bg_func
let VoltageHistory = {}; // updated in bg_func

// Voltage Checking flags
let CheckBatNotFull = true;
let StartTime: number | null = getTime();
let PlayFirstInconsistentCellWarning = true;
let PlayInconsistentCellWarning = false;
let PlayFirstMissingCellWarning = true;
let PlayMissingCellWarning = true;
let InconsistentCellVoltageDetected = false;
let ResetDebounced = true;
let MaxWatts = '////-';
let MaxAmps = '////-';

// Announcements
let BatRemPerFileName = ''; // updated in PlayPercentRemaining
let BatRemPerPlayed = 0; // updated in PlayPercentRemaining
let AtZeroPlayedCount: number; // updated in init_func, PlayPercentRemaining
let PlayAtZero = 1;
//let RxOperational = false
//let BatteryFound = false

// Display
let x, y, fontSize, yColumn2;
let xAlign = 0;

let BlinkWhenZero = 0; // updated in run_func
let Color = GREY;

const VoltToPercentTable = [
  [3.6, 10],
  [3.7, 15],
  [3.72, 20],
  [3.74, 25],
  [3.76, 30],
  [3.78, 35],
  [3.8, 40],
  [3.81, 45],
  [3.83, 50],
  [3.85, 55],
  [3.87, 60],
  [3.98, 65],
  [3.99, 70],
  [4.0, 75],
  [4.03, 80],
  [4.06, 85],
  [4.1, 90],
  [4.15, 95],
  [4.2, 100],
];

const SoundsTable: {[index: number]: string} = {
  5: 'Bat5L.wav',
  10: 'Bat10L.wav',
  20: 'Bat20L.wav',
  30: 'Bat30L.wav',
  40: 'Bat40L.wav',
  50: 'Bat50L.wav',
  60: 'Bat60L.wav',
  70: 'Bat70L.wav',
  80: 'Bat80L.wav',
  90: 'Bat90L.wav',
};

function getCellVoltage(voltageSensorIn: number | string) {
  // For voltage sensors that return a table of sensors, add up the cell
  // voltages to get a total cell voltage.
  // Otherwise, just return the value
  let cellResult = getValue(voltageSensorIn);
  let cellSum = 0;

  if (type(cellResult) == 'table') {
    //   for i, v in ipairs(cellResult) do
    //     cellSum = cellSum + v
    //     // update the historical voltage table
    //     if ((VoltageHistory[i] && VoltageHistory[i] > v) || VoltageHistory[i] == null ) {
    //       VoltageHistory[i] = v
    // }
    //   }
  } else {
    cellSum = cellResult;
  }

  return cellSum;
}

function getMaxWatts(voltsNow: number) {
  if (CurrentSensor !== '') {
    let amps = getValue(CurrentSensor);
    if (type(amps) == 'number') {
      if (type(MaxAmps) == 'string' || (type(MaxAmps) == 'number' && amps > Number(MaxAmps))) {
        MaxAmps = amps.toString();
      }
      let watts = amps * voltsNow;
      if (type(MaxWatts) == 'string' || watts > Number(MaxWatts)) {
        MaxWatts = watts.toString();
      }
    }
  }
}

function findPercentRem(cellVoltage: number): number {
  if (cellVoltage > 4.2) {
    return 100;
  } else if (cellVoltage < 3.6) {
    return 0;
  } else {
    //TODO
    // method of finding percent in my array provided by on4mh (Mike)
    // for i, v in ipairs( VoltToPercentTable ) do
    //   if v[ 1 ] >= cellVoltage {
    //     return v[ 2 ]
    //   }
    // }
    return 0;
  }
}

function PlayPercentRemaining(): void {
  // Announces percent remaining using the accompanying sound files.
  // Announcements ever 10% change when percent remaining is above 10 else every 5%
  let myModVal;

  if (BatRemPer < 10) {
    myModVal = BatRemPer % 5;
  } else {
    myModVal = BatRemPer % 10;
  }

  if (myModVal === 0 && BatRemPer !== BatRemPerPlayed) {
    BatRemPerFileName = SoundsTable[BatRemPer];
    if (BatRemPerFileName !== null) {
      playFile(soundDirPath + BatRemPerFileName);
      BatRemPerPlayed = BatRemPer; // do not keep playing the same sound file over &&
    }
  }

  if (BatRemPer <= 0 && AtZeroPlayedCount < PlayAtZero && getRSSI() > 0) {
    print(BatRemPer, AtZeroPlayedCount);
    playFile(soundDirPath + 'BatNo.wav');
    AtZeroPlayedCount = AtZeroPlayedCount + 1;
  } else if (AtZeroPlayedCount == PlayAtZero && BatRemPer > 0) {
    AtZeroPlayedCount = 0;
  }
}

function HasSecondsElapsed(numSeconds: number) {
  // return true every numSeconds
  if (StartTime === null) {
    StartTime = getTime();
  }

  const currTime = getTime();
  const deltaTime = currTime - StartTime;
  const deltaSeconds = deltaTime / 100; // convert to seconds
  const deltaTimeMod = deltaSeconds % numSeconds; // return the modulus
  if (math.abs(deltaTimeMod - 0) < 1) {
    return true;
  } else {
    return false;
  }
}

function check_for_full_battery(voltageSensorValue: number) {
  // check condition 1: at reset that all voltages > CellFullVoltage volts
  if (BatUsedmAh == 0) {
    // BatUsedmAh is only 0 at reset
    //print(string.format("CheckBatNotFull: %s type: %s", CheckBatNotFull, type(voltageSensorValue)))
    if (CheckBatNotFull) {
      // global variable to gate this so this check is only done once after reset
      const playBatNotFullWarning = false;
      if (type(voltageSensorValue) == 'table') {
        // check to see if this is the dedicated voltage sensor
        print('flvss cell detection');
        //TODO
        // for i, v in ipairs(voltageSensorValue) do
        //   if v < CellFullVoltage {
        //     //print(string.format("flvss i: %d v: %f", i,v))
        //     playBatNotFullWarning = true
        //     break
        //   }
        // }
        CheckBatNotFull = false; // since we have done the check, set to false so it is not ran again
      } else if (VoltageSensor == 'VFAS' && type(voltageSensorValue) == 'number') {
        //this is for the vfas sensor
        print(string.format('vfas: %f', voltageSensorValue));
        //(string.format("vfas value: %d", voltageSensorValue))
        if (voltageSensorValue < CellFullVoltage - 0.001) {
          //print("vfas cell not full detected")
          let playBatNotFullWarning = true;
        }
        CheckBatNotFull = false; // since we have done the check, set to false so it is not ran again
      }
      if (playBatNotFullWarning) {
        playFile(soundDirPath + 'BNFull.wav');
      }
    } // CheckBatNotfull
  } // BatUsedmAh
}

function check_cell_delta_voltage(voltageSensorValue: number) {
  // Check to see if all cells are within VoltageDelta volts of each other
  //  default is .3 volts, can be changed above
  if (type(voltageSensorValue) == 'table') {
    //TODO
    // check to see if this is the dedicated voltage sensor
    // for i, v1 in ipairs(voltageSensorValue) do
    //   for j,v2 in ipairs(voltageSensorValue) do
    //         // print(string.format("i: %d v: %f j: %d v: %f", i, v1, j,v2))
    //         if (i!==j && (math.abs(v1 - v2) > VoltageDelta)) {
    //           //print(string.format("i: %d v: %f j: %d v: %f", i, v1, j,v2))
    //           timeElapsed = HasSecondsElapsed(10)  // check to see if the 10 second timer has elapsed
    //           if (PlayFirstInconsistentCellWarning || (PlayInconsistentCellWarning == true && timeElapsed)) { // Play immediately upon detection && { every 10 seconds
    //             playFile(soundDirPath+"icw.wav")
    //             PlayFirstInconsistentCellWarning = false // clear the first play flag, only reset on reset switch toggle
    //             PlayInconsistentCellWarning = false // clear the playing flag, only reset it at 10 second intervals
    // //  }
    //           if (! timeElapsed ){  // debounce so the sound is only played once in 10 seconds
    //             PlayInconsistentCellWarning = true
    //  }
    //           return
    //  }
    //  }
    //  }
  }
}

function voltage_sensor_tests(): void {
  // 1. at reset check to see that the cell voltage is > 4.1 for all cellSum
  // 2. check to see that all cells are within VoltageDelta volts of each other
  // 3. if number of cells are set in GV6, check to see that all are showing voltage

  //print("check_initial_battery_voltage")
  if (VoltageSensor !== '') {
    //print("getting VoltageSensor data")
    const cellResult = getValue(VoltageSensor);

    // check condition 1: at reset that all voltages > 4.0 volts
    check_for_full_battery(cellResult);

    // check condition 2: delta voltage
    check_cell_delta_voltage(cellResult);
  }
}

function init_func(): void {
  // Called once when model is loaded
  BatCapFullmAh = model.getGlobalVariable(GVBatCap, GVFlightMode) * 100;
  // BatCapmAh = BatCapFullmAh
  BatCapmAh = (BatCapFullmAh * (100 - CapacityReservePercent)) / 100;
  BatRemainmAh = BatCapmAh;
  CellCount = model.getGlobalVariable(GVCellCount, GVFlightMode);
  VoltsPercentRem = 0;
  BatRemPer = 0;
  AtZeroPlayedCount = 0;
  if (mAhSensor == '' || BatCapmAh == 0) {
    UseVoltsNotmAh = true;
  } else {
    UseVoltsNotmAh = false;
  }
}

function reset_if_needed(): void {
  // test if the reset switch is toggled, if so { reset all internal flags
  if (SwReset !== '') {
    // Update switch position
    if (ResetDebounced && HasSecondsElapsed(2) && -1024 !== getValue(SwReset)) {
      // reset switch
      print('reset switch toggled');
      CheckBatNotFull = true;
      StartTime = null;
      PlayInconsistentCellWarning = true;
      PlayFirstMissingCellWarning = true;
      PlayMissingCellWarning = true;
      PlayFirstInconsistentCellWarning = true;
      InconsistentCellVoltageDetected = false;
      VoltageHistory = {};
      ResetDebounced = false;
      VoltsNow = 0;
      MaxWatts = '////-';
      MaxAmps = '////-';
      //print("reset event")
    }
    if (!HasSecondsElapsed(2)) {
      //print("debounced")
      ResetDebounced = true;
    }
  }
}

function bg_func(): void {
  reset_if_needed(); // test if the reset switch is toggled, if so { reset all internal flags
  // Check in battery capacity was changed
  if (BatCapFullmAh !== model.getGlobalVariable(GVBatCap, GVFlightMode) * 100) {
    init_func();
  }

  if (mAhSensor !== '') {
    BatUsedmAh = getValue(mAhSensor);
    if (BatUsedmAh == 0 && CanCallInitFuncAgain) {
      // BatUsedmAh == 0 when Telemetry has been reset || model loaded
      // BatUsedmAh == 0 when no battery used which could be a long time
      //	so don't keep calling the init_func unnecessarily.
      init_func();
      CanCallInitFuncAgain = false;
    } else if (BatUsedmAh > 0) {
      // Call init function again when Telemetry has been reset
      CanCallInitFuncAgain = true;
    }
    BatRemainmAh = BatCapmAh - BatUsedmAh;
  }

  if (VoltageSensor !== '') {
    const volts = getCellVoltage(VoltageSensor);
    if (VoltsNow < 1 || volts > 1) {
      VoltsNow = volts;
    }
    //VoltsNow = getCellVoltage(VoltageSensor)
    VoltsMax = getCellVoltage(VoltageSensor + '+');
    getMaxWatts(VoltsNow);

    //CellCount = math.ceil(VoltsMax / 4.25)
    if (CellCount > 0) {
      VoltsPercentRem = findPercentRem(VoltsNow / CellCount);
    }
  }

  // Update battery remaining percent
  if (UseVoltsNotmAh) {
    BatRemPer = VoltsPercentRem - CapacityReservePercent;
    //elseif BatCapFullmAh > 0 {
  } else if (BatCapmAh > 0) {
    // BatRemPer = math.floor( (BatRemainmAh / BatCapFullmAh) * 100 ) - CapacityReservePercent
    BatRemPer = math.floor((BatRemainmAh / BatCapFullmAh) * 100);
  }

  if (AnnouncePercentRemaining) {
    PlayPercentRemaining();
  }

  if (WriteGVBatRemmAh == true) {
    model.setGlobalVariable(GVBatRemmAh, GVFlightMode, math.floor(BatRemainmAh / 100));
  }

  if (WriteGVBatRemPer == true) {
    model.setGlobalVariable(GVBatRemPer, GVFlightMode, BatRemPer);
  }

  voltage_sensor_tests();
}

function getPercentColor(cpercent: number) {
  // This function returns green at 100%, red bellow 30% && graduate in between
  if (cpercent < 30) {
    return lcd.RGB(0xff, 0, 0);
  } else {
    const g = math.floor((0xdf * cpercent) / 100);
    const r = 0xdf - g;

    return lcd.RGB(r, g, 0);
  }
}

//TODO
function formatCellVoltage(voltage: number) {
  if (type(voltage) == 'number') {
    // vColor, blinking = Color, 0
    // if voltage < 3.7 { vColor, blinking = RED, BLINK }
    // return string.format("%.2f", voltage), vColor, blinking
  } else {
    // return "//////", Color, 0
  }
}

function drawCellVoltage(wgt: any) {
  // Draw the voltage table for the current/low cell voltages
  // this should use ~1/4 screen
  const cellResult = getValue(VoltageSensor);

  // for i=1, 7, 2 do
  //   cell1, cell1Color, cell1Blink = formatCellVoltage(cellResult[i])
  //   history1, history1Color, history1Blink = formatCellVoltage(VoltageHistory[i])
  //   cell2, cell2Color, cell2Blink = formatCellVoltage(cellResult[i+1])
  //   history2, history2Color, history2Blink = formatCellVoltage(VoltageHistory[i+1])

  //   // C1: C.cc/H.hh  C2: C.cc/H.hh
  //   lcd.drawText(wgt.zone.x, wgt.zone.y  + 10*(i-1), string.format("C%d:", i), Color)
  //   lcd.drawText(wgt.zone.x + 25, wgt.zone.y  + 10*(i-1), string.format("%s", cell1), cell1Color+cell1Blink)
  //   lcd.drawText(wgt.zone.x + 55, wgt.zone.y  + 10*(i-1), string.format("/"), Color)
  //   lcd.drawText(wgt.zone.x + 60, wgt.zone.y  + 10*(i-1), string.format("%s", history1), history1Color+history1Blink)

  //   lcd.drawText(wgt.zone.x + 100, wgt.zone.y  + 10*(i-1), string.format("C%d:", i+1), Color)
  //   lcd.drawText(wgt.zone.x + 125, wgt.zone.y  + 10*(i-1), string.format("%s", cell2), cell2Color+cell2Blink)
  //   lcd.drawText(wgt.zone.x + 155, wgt.zone.y  + 10*(i-1), string.format("/"), Color)
  //   lcd.drawText(wgt.zone.x + 160, wgt.zone.y  + 10*(i-1), string.format("%s", history2), history2Color+history2Blink)
  // }
}

//TODO any
function drawBattery(xOrigin: number, yOrigin: number, wgt: any) {
  const volts = getCellVoltage(VoltageSensor);

  if (0 == volts) {
    lcd.drawText(50, 20, 'No telemetry');

    return;
  }

  const myBatt = {x: xOrigin, y: yOrigin, w: 85, h: 35, segments_w: 15, color: WHITE, cath_w: 6, cath_h: 20};

  lcd.setColor(CUSTOM_COLOR, wgt.options.Color);

  if (BatRemPer > 0) {
    // Don't blink
    BlinkWhenZero = 0;
  } else {
    BlinkWhenZero = BLINK;
  }

  // fill batt
  lcd.setColor(CUSTOM_COLOR, getPercentColor(BatRemPer));
  lcd.drawGauge(wgt.zone.x + myBatt.x, wgt.zone.y + myBatt.y, myBatt.w, myBatt.h, BatRemPer, 100, CUSTOM_COLOR);

  // draws bat
  lcd.setColor(CUSTOM_COLOR, WHITE);
  lcd.drawRectangle(wgt.zone.x + myBatt.x, wgt.zone.y + myBatt.y, myBatt.w, myBatt.h, CUSTOM_COLOR, 2);
  lcd.drawFilledRectangle(
    wgt.zone.x + myBatt.x + myBatt.w,
    //wgt.zone.y + myBatt.h / 2 - myBatt.cath_h / 2,
    wgt.zone.y + myBatt.y + myBatt.cath_h / 2 - 2.5,
    myBatt.cath_w,
    myBatt.cath_h,
    CUSTOM_COLOR
  );
  lcd.drawText(
    wgt.zone.x + myBatt.x + 20,
    wgt.zone.y + myBatt.y + 5,
    string.format('%d%%', BatRemPer),
    LEFT + MIDSIZE + CUSTOM_COLOR
  );

  // draw values
  lcd.drawText(
    wgt.zone.x + myBatt.x,
    wgt.zone.y + myBatt.y + 35,
    string.format('%d mAh', BatRemainmAh),
    DBLSIZE + Color + BlinkWhenZero
  );

  // draw VFAS
  lcd.drawText(
    wgt.zone.x + myBatt.x + myBatt.cath_w + myBatt.w + 15,
    wgt.zone.y,
    string.format('%.1f V', volts),
    DBLSIZE
  );
}

// TODO any
function refreshZoneTiny(wgt: any) {
  // This size is for top bar wgts
  //- Zone size: 70x39 1/8th top bar
  const myString = string.format('%d', BatRemainmAh);
  lcd.drawText(
    wgt.zone.x + wgt.zone.w - 25,
    wgt.zone.y + 5,
    BatRemPer + '%',
    RIGHT + SMLSIZE + CUSTOM_COLOR + BlinkWhenZero
  );
  lcd.drawText(wgt.zone.x + wgt.zone.w - 25, wgt.zone.y + 20, myString, RIGHT + SMLSIZE + CUSTOM_COLOR + BlinkWhenZero);
  // draw batt
  lcd.drawRectangle(wgt.zone.x + 50, wgt.zone.y + 9, 16, 25, CUSTOM_COLOR, 2);
  lcd.drawFilledRectangle(wgt.zone.x + 50 + 4, wgt.zone.y + 7, 6, 3, CUSTOM_COLOR);
  const rect_h = math.floor((25 * BatRemPer) / 100);
  lcd.drawFilledRectangle(wgt.zone.x + 50, wgt.zone.y + 9 + 25 - rect_h, 16, rect_h, CUSTOM_COLOR + BlinkWhenZero);
}

//TODO any
function refreshZoneSmall(wgt: any) {
  //- Size is 160x32 1/8th
  const myBatt = {x: 0, y: 0, w: 155, h: 35, segments_w: 25, color: WHITE, cath_w: 6, cath_h: 20};

  // draws bat
  lcd.setColor(CUSTOM_COLOR, WHITE);
  lcd.drawRectangle(wgt.zone.x + myBatt.x, wgt.zone.y + myBatt.y, myBatt.w, myBatt.h, CUSTOM_COLOR, 2);

  // fill batt
  lcd.setColor(CUSTOM_COLOR, getPercentColor(BatRemPer));
  lcd.drawGauge(wgt.zone.x + 2, wgt.zone.y + 2, myBatt.w - 4, wgt.zone.h, BatRemPer, 100, CUSTOM_COLOR);

  // write text
  lcd.setColor(CUSTOM_COLOR, wgt.options.Color);
  const topLine = string.format('%d      %d%%', BatRemainmAh, BatRemPer);
  lcd.drawText(wgt.zone.x + 20, wgt.zone.y + 2, topLine, MIDSIZE + CUSTOM_COLOR + BlinkWhenZero);
}

//TODO any
function refreshZoneMedium(wgt: any) {
  //- Size is 225x98 1/4th  (no sliders/trim)
  drawBattery(0, 0, wgt);

  //TODO
  // myBatt = { ["x"] = 0, ["y"] = 0, ["w"] = 85, ["h"] = 35, ["segments_w"] = 15, ["color"] = WHITE, ["cath_w"] = 6, ["cath_h"] = 20 }
  //
  //lcd.setColor(CUSTOM_COLOR, wgt.options.Color)
  //
  //if BatRemPer > 0 { // Don't blink
  //  BlinkWhenZero = 0
  //else
  //  BlinkWhenZero = BLINK
  //}
  //
  //// fill batt
  //lcd.setColor(CUSTOM_COLOR, getPercentColor(BatRemPer))
  //lcd.drawGauge(wgt.zone.x + myBatt.x, wgt.zone.y + myBatt.y, myBatt.w, myBatt.h, BatRemPer, 100, CUSTOM_COLOR)
  //
  //// draws bat
  //lcd.setColor(CUSTOM_COLOR, WHITE)
  //lcd.drawRectangle(wgt.zone.x + myBatt.x, wgt.zone.y + myBatt.y, myBatt.w, myBatt.h, CUSTOM_COLOR, 2)
  //lcd.drawFilledRectangle(wgt.zone.x + myBatt.x + myBatt.w, wgt.zone.y + myBatt.h / 2 - myBatt.cath_h / 2, myBatt.cath_w, myBatt.cath_h, CUSTOM_COLOR)
  //lcd.drawText(wgt.zone.x + myBatt.x + 20, wgt.zone.y + myBatt.y + 5, string.format("%d%%", BatRemPer), LEFT + MIDSIZE + CUSTOM_COLOR)
  //
  //  // draw values
  //lcd.drawText(wgt.zone.x + myBatt.x, wgt.zone.y + myBatt.y + 35,
  //        string.format("%d mAh", BatRemainmAh), DBLSIZE + CUSTOM_COLOR + BlinkWhenZero)
}

//TODO any
function refreshZoneLarge(wgt: any) {
  //- Size is 192x152 1/2
  lcd.setColor(CUSTOM_COLOR, wgt.options.Color);

  fontSize = 10;

  if (BatRemPer > 0) {
    // Don't blink
    BlinkWhenZero = 0;
  } else {
    BlinkWhenZero = BLINK;
  }
  lcd.drawText(wgt.zone.x + 5, wgt.zone.y + fontSize, 'BATTERY LEFT', SHADOWED);
  lcd.setColor(CUSTOM_COLOR, getPercentColor(BatRemPer));
  lcd.drawText(
    wgt.zone.x + 5,
    wgt.zone.y + fontSize + 25,
    math.floor(BatRemPer) + '%',
    DBLSIZE + SHADOWED + BlinkWhenZero
  );
  lcd.drawText(
    wgt.zone.x + 5,
    wgt.zone.y + fontSize + 55,
    math.floor(BatRemainmAh) + 'mAh',
    DBLSIZE + SHADOWED + BlinkWhenZero
  );

  lcd.setColor(CUSTOM_COLOR, wgt.options.Color);
  lcd.drawRectangle(wgt.zone.x - 1, wgt.zone.y + (wgt.zone.h - 31), wgt.zone.w + 2, 32, 0);
  lcd.setColor(CUSTOM_COLOR, getPercentColor(BatRemPer));
  lcd.drawGauge(wgt.zone.x, wgt.zone.y + (wgt.zone.h - 30), wgt.zone.w, 30, BatRemPer, 100, BlinkWhenZero);
}

//TODO any
function refreshZoneXLarge(widget: any) {
  //- Size is 390x172 1/1
  //- Size is 460x252 1/1 (no sliders/trim/topbar)
  lcd.setColor(CUSTOM_COLOR, widget.options.Color);
  fontSize = 10;

  if (BatRemPer > 0) {
    // Don't blink
    BlinkWhenZero = 0;
  } else {
    BlinkWhenZero = BLINK;
  }

  // Draw the top-left 1/4 of the screen
  drawCellVoltage(widget);

  // Draw the bottom-left 1/4 of the screen
  drawBattery(0, 100, widget);

  // Draw the top-right 1/4 of the screen
  //lcd.drawText(wgt.zone.x + 270, wgt.zone.y + -5, string.format("%.2fV", VoltsNow), DBLSIZE + Color)
  lcd.drawText(widget.zone.x + 210, widget.zone.y + -5, 'Current/Max', DBLSIZE + Color + SHADOWED);
  const amps = getValue(CurrentSensor);
  //lcd.drawText(wgt.zone.x + 270, wgt.zone.y + 25, string.format("%.1fA", amps), DBLSIZE + Color)
  lcd.drawText(widget.zone.x + 210, widget.zone.y + 30, string.format('%.0fA/%.0fA', amps, MaxAmps), MIDSIZE + Color);
  const watts = math.floor(amps * VoltsNow);

  let sMaxWatts;
  if (type(MaxWatts) == 'string') {
    sMaxWatts = MaxWatts;
  } else if (type(MaxWatts) == 'number') {
    sMaxWatts = string.format('%.0f', MaxWatts);
  }
  lcd.drawText(widget.zone.x + 210, widget.zone.y + 55, string.format('%.0fW/%sW', watts, sMaxWatts), MIDSIZE + Color);

  // Draw the bottom-right of the screen
  //lcd.drawText(wgt.zone.x + 190, wgt.zone.y + 85, string.format("%sW", MaxWatts), XXLSIZE + Color)
  lcd.drawText(widget.zone.x + 185, widget.zone.y + 85, string.format('%.2fV', VoltsNow), XXLSIZE + Color);
}

//TODO
function run_func(widget: any) {
  // Called periodically when screen is visible
  bg_func();
  if (widget.zone.w > 380 && widget.zone.h > 165) {
    refreshZoneXLarge(widget);
  } else if (widget.zone.w > 180 && widget.zone.h > 145) {
    refreshZoneLarge(widget);
  } else if (widget.zone.w > 170 && widget.zone.h > 65) {
    refreshZoneMedium(widget);
  } else if (widget.zone.w > 150 && widget.zone.h > 28) {
    refreshZoneSmall(widget);
  } else if (widget.zone.w > 65 && widget.zone.h > 35) {
    refreshZoneTiny(widget);
  }
}

//TODO any
function create(zone: any, options: any) {
  init_func();

  return {zone, options};
}

//TODO any
function update(Context: any, options: any) {
  mAhSensor = options.mAh;
  VoltageSensor = options.Voltage;
  CurrentSensor = options.Current;
  Color = options.Color;
  Context.options = options;
  Context.back = null;
}

function background() {
  bg_func();
}

//TODO any
function refresh(widget: any) {
  run_func(widget);
}

const options: any[] = [
  ['mAh', SOURCE, 279], // Defines source Battery Current Sensor
  ['Voltage', SOURCE, 276], // Defines source Battery Voltage Sensor
  ['Current', SOURCE, 273],
  ['Color', COLOR, WHITE],
];

export {name, options, create, update, refresh, background};
