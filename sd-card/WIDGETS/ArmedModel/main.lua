local ____exports = {}
local update, rotatePoint, drawBlades, drawRotor
function update(widget, options)
    widget.options = options
end
function rotatePoint(x, y, centerX, centerY, degrees)
    local newX = (x - centerX) * math.cos(degrees * math.pi / 180) - (y - centerY) * math.sin(degrees * math.pi / 180) + centerX
    local newY = (x - centerX) * math.sin(degrees * math.pi / 180) + (y - centerY) * math.cos(degrees * math.pi / 180) + centerY
    return {newX, newY}
end
function drawBlades(x, y, rotorSize, propColor, degrees)
    local x1 = x
    local y1 = y
    local x2 = x + rotorSize
    local y2 = y
    local centerX = x + rotorSize / 2
    local centerY = y
    local steps = 6
    do
        local i = 0
        while i < steps do
            local xOffset = i < steps / 2 and steps / 2 - i or i - steps / 2
            local fromX, fromY = table.unpack(rotatePoint(
                x1 + xOffset,
                y1 - i,
                centerX,
                centerY,
                degrees
            ))
            local toX, toY = table.unpack(rotatePoint(
                x2 - xOffset,
                y2 + i,
                centerX,
                centerY,
                degrees
            ))
            lcd.drawLine(
                fromX,
                fromY,
                toX,
                toY,
                SOLID,
                propColor
            )
            i = i + 1
        end
    end
    local degreesOffset = 6 + degrees
    local tipColor = lcd.RGB(16694784)
    local fromX, fromY = table.unpack(rotatePoint(
        x + 2,
        y - 2,
        centerX,
        centerY,
        degrees
    ))
    lcd.drawPie(
        fromX,
        fromY,
        3,
        -180 + degreesOffset,
        0 + degreesOffset,
        tipColor
    )
    fromX, fromY = table.unpack(rotatePoint(
        x + rotorSize - 2,
        y + 2,
        centerX,
        centerY,
        degrees
    ))
    lcd.drawPie(
        fromX,
        fromY,
        3,
        0 + degreesOffset,
        180 + degreesOffset,
        tipColor
    )
end
function drawRotor(isActive, x, y, hubSize, propSize, propColor, phaseCount, tickDuration)
    if hubSize == nil then
        hubSize = 9
    end
    if propSize == nil then
        propSize = 16
    end
    if propColor == nil then
        propColor = LIGHTGREY
    end
    if phaseCount == nil then
        phaseCount = 32
    end
    if tickDuration == nil then
        tickDuration = 60
    end
    local animTick = math.fmod(
        getTime() / tickDuration,
        2
    )
    local phase = math.fmod(
        math.ceil(animTick * phaseCount * 2),
        phaseCount
    )
    local rotorSize = propSize * 2 + hubSize
    drawBlades(
        x,
        y,
        rotorSize,
        propColor,
        isActive and 180 / phaseCount * phase or 0
    )
    lcd.drawFilledCircle(
        x + rotorSize / 2,
        y,
        hubSize / 2,
        bit32.bor(SOLID, GREY)
    )
    lcd.drawFilledCircle(x + rotorSize / 2, y, hubSize / 4, SOLID)
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
    else
        if widget.bitmap ~= nil then
            lcd.drawBitmap(widget.bitmap, 30, 0)
        end
    end
    lcd.drawText(x + 5, y + 5, modelInfo.name, COLOR_THEME_EDIT)
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
