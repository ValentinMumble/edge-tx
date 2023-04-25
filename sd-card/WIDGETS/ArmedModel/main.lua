local ____exports = {}
local update, drawRotor
function update(widget, options)
    widget.options = options
end
function drawRotor(isActive, x, y, hubSize, propSize, propColor)
    if hubSize == nil then
        hubSize = 8
    end
    if propSize == nil then
        propSize = 12
    end
    if propColor == nil then
        propColor = LIGHTGREY
    end
    local animTick = math.fmod(
        getTime() / 100,
        2
    )
    local phase = math.fmod(
        math.ceil(animTick * 8),
        4
    )
    local rotorSize = propSize * 2 + hubSize
    if not isActive or phase == 0 then
        lcd.drawLine(
            x,
            y + rotorSize / 2,
            x + rotorSize,
            y - rotorSize / 2,
            SOLID,
            propColor
        )
        lcd.drawLine(
            x,
            y + 1 + rotorSize / 2,
            x - 1 + rotorSize,
            y - rotorSize / 2,
            SOLID,
            propColor
        )
    elseif phase == 1 then
        lcd.drawLine(
            x,
            y,
            x + rotorSize,
            y,
            SOLID,
            propColor
        )
        lcd.drawLine(
            x,
            y - 1,
            x + rotorSize,
            y + 1,
            SOLID,
            propColor
        )
    elseif phase == 2 then
        lcd.drawLine(
            x,
            y - rotorSize / 2,
            x + rotorSize,
            y + rotorSize / 2,
            SOLID,
            propColor
        )
        lcd.drawLine(
            x,
            y + 1 - rotorSize / 2,
            x + 1 + rotorSize,
            y + rotorSize / 2,
            SOLID,
            propColor
        )
    elseif phase == 3 then
        lcd.drawLine(
            x + rotorSize / 2,
            y - rotorSize / 2,
            x + rotorSize / 2,
            y + rotorSize / 2,
            SOLID,
            propColor
        )
        lcd.drawLine(
            x - 1 + rotorSize / 2,
            y - rotorSize / 2,
            x + 1 + rotorSize / 2,
            y + rotorSize / 2,
            SOLID,
            propColor
        )
    end
    lcd.drawFilledCircle(x + rotorSize / 2, y, hubSize / 2, SOLID)
    lcd.drawFilledCircle(
        x + rotorSize / 2,
        y,
        hubSize / 4,
        bit32.bor(SOLID, GREY)
    )
end
local name = "ArmedModel"
local MIN_VALUE = -1024
local options = {{"ArmedSwitch", SOURCE, 1}, {"ThrottleCutSwitch", SOURCE, 1}}
local function create(zone, options)
    local widget = {zone = zone, options = options}
    update(widget, options)
    return widget
end
local function draw(widget, x, y, w, h)
    local modelInfo = model.getInfo()
    if widget.filename ~= modelInfo.bitmap then
        widget.filename = modelInfo.bitmap
        widget.bitmap = Bitmap.open("/IMAGES/" .. tostring(modelInfo.bitmap))
        if widget.bitmap ~= nil then
            local width, height = Bitmap.getSize(widget.bitmap)
            local nh = h >= 96 and w >= 120 and h - 38 or h
            local r = Bitmap.resize(widget.bitmap, w, nh)
            if r ~= nil then
                widget.bitmap = r
                widget.bitmapWidth = w
                widget.bitmapHeight = nh
            else
                widget.bitmapWidth = width
                widget.bitmapHeight = height
            end
        end
    end
    local isArmed = getValue(widget.options.ArmedSwitch) == MIN_VALUE
    local isThrottleActive = getValue(widget.options.ThrottleCutSwitch) == MIN_VALUE
    if isArmed then
        lcd.drawFilledRectangle(
            0,
            0,
            w,
            h,
            COLOR_THEME_WARNING
        )
    end
    drawRotor(isArmed and isThrottleActive, 5, 60)
    if h >= 96 and w >= 120 then
        if widget.bitmap ~= nil then
            lcd.drawBitmap(widget.bitmap, 0, 38)
        end
        lcd.drawText(x + 5, y + 5, modelInfo.name)
    else
        if widget.bitmap ~= nil then
            lcd.drawBitmap(widget.bitmap, 30, 0)
        end
        lcd.drawText(
            x + 5,
            y + 5,
            modelInfo.name,
            bit32.bor(MIDSIZE, COLOR_THEME_EDIT)
        )
    end
end
local function refresh(widget, event)
    if nil ~= event then
        draw(
            widget,
            0,
            0,
            LCD_W,
            LCD_H
        )
    else
        draw(
            widget,
            widget.zone.x,
            widget.zone.y,
            widget.zone.w,
            widget.zone.h
        )
    end
end
____exports.refresh = refresh
____exports.name = name
____exports.create = create
____exports.update = update
____exports.options = options
return ____exports
