local ____exports = {}
local name = "Battery"
local options = {
    {"BattSensor", SOURCE, 1},
    {
        "Cells",
        VALUE,
        3,
        1,
        12
    },
    {
        "CellVMax",
        VALUE,
        420,
        400,
        435
    },
    {
        "CellVMin",
        VALUE,
        370,
        250,
        390
    },
    {"Alarm", BOOL, 1}
}
local function batteryWarning(widget)
    if widget.options.Alarm == 1 and widget.bt < widget.CellVMin or widget.bt > widget.CellVMax then
        if getTime() >= widget.waitTime then
            widget.waitTime = getTime() + 200
            playTone(
                2500,
                200,
                100,
                0,
                0
            )
            playTone(
                2500,
                200,
                0,
                0,
                0
            )
        end
    end
end
local function create(zone, options)
    local widget = {
        zone = zone,
        options = options,
        waitTime = getTime(),
        bt = 0,
        CellVMax = 0,
        CellVMin = 0,
        pixSizeX = 0,
        pixSizeY = 0,
        picture = Bitmap.open(("/WIDGETS/Battery/battery_" .. tostring(zone.h)) .. ".png")
    }
    local pixSizeX, pixSizeY = Bitmap.getSize(widget.picture)
    widget.pixSizeX = pixSizeX
    widget.pixSizeY = pixSizeY
    widget.CellVMax = widget.options.CellVMax / 100 * widget.options.Cells
    widget.CellVMin = widget.options.CellVMin / 100 * widget.options.Cells
    return widget
end
local function update(widget, options)
    widget.options = options
    widget.CellVMax = widget.options.CellVMax / 100 * widget.options.Cells
    widget.CellVMin = widget.options.CellVMin / 100 * widget.options.Cells
end
local function background(widget)
    widget.bt = getValue(widget.options.BattSensor)
    if widget.bt ~= 0 then
        batteryWarning(widget)
    end
end
local function refresh(widget)
    widget.bt = getValue(widget.options.BattSensor)
    if widget.pixSizeX == 0 or widget.zone.w == 392 then
        lcd.drawText(widget.zone.w / 2, widget.zone.h / 2, "X", CENTER + VCENTER + DBLSIZE + RED + SHADOWED + BLINK)
    elseif widget.bt ~= 0 then
        local steps = 0
        if widget.zone.h == 169 then
            steps = math.floor(144 / 100 * ((widget.bt - widget.CellVMin) / ((widget.CellVMax - widget.CellVMin) / 100)))
        else
            steps = math.floor(167 / 100 * ((widget.bt - widget.CellVMin) / ((widget.CellVMax - widget.CellVMin) / 100)))
        end
        if steps >= 0 and steps <= 167 and widget.zone.h == 42 then
            lcd.drawFilledRectangle(
                11,
                3,
                steps,
                36,
                GREEN
            )
        elseif steps >= 0 and steps <= 167 and widget.zone.h == 56 then
            lcd.drawFilledRectangle(
                11,
                3,
                steps,
                50,
                GREEN
            )
        elseif steps >= 0 and steps <= 167 and widget.zone.h == 84 then
            lcd.drawFilledRectangle(
                11,
                3,
                steps,
                78,
                GREEN
            )
        elseif steps >= 0 and steps <= 144 and widget.zone.h == 169 then
            lcd.drawFilledRectangle(
                3,
                144 - steps + 16,
                78,
                steps,
                GREEN
            )
        else
            batteryWarning(widget)
        end
        lcd.drawBitmap(widget.picture, 0, 0)
        if widget.zone.h == 169 then
            lcd.drawText(
                widget.zone.w * 0.7,
                widget.zone.h * 0.68,
                string.format("%.2fv", widget.bt / widget.options.Cells),
                CENTER + VCENTER + 0 + GREEN + SHADOWED
            )
            lcd.drawText(
                widget.zone.w * 0.7,
                widget.zone.h * 0.82,
                string.format("%.2fv", widget.bt),
                CENTER + VCENTER + DBLSIZE + GREEN + SHADOWED
            )
        else
            lcd.drawText(
                widget.zone.w / 2,
                widget.zone.h * 0.28,
                string.format("%.2fv", widget.bt / widget.options.Cells),
                CENTER + VCENTER + 0 + GREEN + SHADOWED
            )
            lcd.drawText(
                widget.zone.w / 2,
                widget.zone.h * 0.62,
                string.format("%.2fv", widget.bt),
                CENTER + VCENTER + MIDSIZE + GREEN + SHADOWED
            )
        end
    else
        lcd.drawBitmap(widget.picture, 0, 0)
        if widget.zone.h == 169 then
            lcd.drawText(
                widget.zone.w * 0.7,
                widget.zone.h * 0.68,
                string.format("%.2fv", widget.bt / widget.options.Cells),
                CENTER + VCENTER + 0 + COLOR_THEME_DISABLED + SHADOWED + BLINK
            )
            lcd.drawText(
                widget.zone.w * 0.7,
                widget.zone.h * 0.82,
                string.format("%.2fv", widget.bt),
                CENTER + VCENTER + MIDSIZE + COLOR_THEME_DISABLED + SHADOWED + BLINK
            )
        else
            lcd.drawText(
                widget.zone.w / 2,
                widget.zone.h * 0.28,
                string.format("%.2fv", widget.bt / widget.options.Cells),
                CENTER + VCENTER + 0 + COLOR_THEME_DISABLED + SHADOWED + BLINK
            )
            lcd.drawText(
                widget.zone.w / 2,
                widget.zone.h * 0.62,
                string.format("%.2fv", widget.bt),
                CENTER + VCENTER + MIDSIZE + COLOR_THEME_DISABLED + SHADOWED + BLINK
            )
        end
    end
end
____exports.name = name
____exports.options = options
____exports.create = create
____exports.update = update
____exports.refresh = refresh
____exports.background = background
return ____exports
