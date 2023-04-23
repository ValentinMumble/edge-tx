local ____exports = {}
local update, drawPropellor, drawQuadcopter, animTick, armed
function update(widget, options)
    widget.options = options
end
function drawPropellor(_x, _y, invert)
    local inc = animTick
    if invert == true then
        inc = (inc - 3) * -1
        inc = inc + 3
        if inc > 3 then
            inc = inc - 4
        end
    end
    lcd.drawRectangle(
        _x + 4,
        _y + 4,
        3,
        3,
        SOLID
    )
    if not armed and not invert or armed and inc == 0 then
        lcd.drawLine(
            _x + 1,
            _y + 9,
            _x + 9,
            _y + 1,
            SOLID,
            FORCE
        )
        lcd.drawLine(
            _x + 1,
            _y + 10,
            _x + 8,
            _y + 1,
            SOLID,
            FORCE
        )
    elseif armed and inc == 1 then
        lcd.drawLine(
            _x,
            _y + 5,
            _x + 9,
            _y + 5,
            SOLID,
            FORCE
        )
        lcd.drawLine(
            _x,
            _y + 4,
            _x + 9,
            _y + 6,
            SOLID,
            FORCE
        )
    elseif not armed and invert or armed and inc == 2 then
        lcd.drawLine(
            _x + 1,
            _y + 1,
            _x + 9,
            _y + 9,
            SOLID,
            FORCE
        )
        lcd.drawLine(
            _x + 1,
            _y + 2,
            _x + 10,
            _y + 9,
            SOLID,
            FORCE
        )
    elseif armed and inc == 3 then
        lcd.drawLine(
            _x + 5,
            _y,
            _x + 5,
            _y + 10,
            SOLID,
            FORCE
        )
        lcd.drawLine(
            _x + 6,
            _y,
            _x + 4,
            _y + 10,
            SOLID,
            FORCE
        )
    end
end
function drawQuadcopter(_x, _y)
    lcd.drawLine(
        _x + 5,
        _y + 5,
        _x + 23,
        _y + 23,
        SOLID,
        FORCE
    )
    lcd.drawLine(
        _x + 5,
        _y + 6,
        _x + 22,
        _y + 23,
        SOLID,
        FORCE
    )
    lcd.drawLine(
        _x + 6,
        _y + 5,
        _x + 23,
        _y + 22,
        SOLID,
        FORCE
    )
    lcd.drawLine(
        _x + 5,
        _y + 23,
        _x + 23,
        _y + 5,
        SOLID,
        FORCE
    )
    lcd.drawLine(
        _x + 5,
        _y + 22,
        _x + 22,
        _y + 5,
        SOLID,
        FORCE
    )
    lcd.drawLine(
        _x + 6,
        _y + 23,
        _x + 23,
        _y + 6,
        SOLID,
        FORCE
    )
    lcd.drawFilledRectangle(
        _x + 12,
        _y + 7,
        5,
        15,
        SOLID
    )
    lcd.drawFilledRectangle(
        _x + 11,
        _y + 11,
        7,
        7,
        SOLID
    )
    lcd.drawPoint(_x + 13, _y + 10)
    lcd.drawPoint(_x + 13, _y + 18)
    lcd.drawPoint(_x + 15, _y + 10)
    lcd.drawPoint(_x + 15, _y + 18)
    if armed then
        lcd.drawText(_x + 2, _y + 11, "armed", SMLSIZE + BLINK)
    end
    drawPropellor(_x, _y, false)
    drawPropellor(_x + 18, _y + 18, false)
    drawPropellor(_x + 18, _y, true)
    drawPropellor(_x, _y + 18, true)
end
local name = "Armed Model"
local MIN_VALUE = -1024
local options = {
    {"Color", COLOR, COLOR_THEME_SECONDARY1},
    {"Size", 5, 0},
    {"ArmedSource", SOURCE, 1},
    {"ArmedColor", COLOR, COLOR_THEME_SECONDARY3},
    {"ThrottleCutSource", SOURCE, 1},
    {"UseThemeColor", BOOL, 1}
}
local function create(zone, options)
    local widget = {zone = zone, options = options}
    update(widget, options)
    return widget
end
local sizes = {
    0,
    BOLD,
    TINSIZE,
    SMLSIZE,
    MIDSIZE,
    DBLSIZE,
    XXLSIZE
}
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
    local isArmed = getValue(widget.options.ArmedSource) == MIN_VALUE
    local isThrottleActive = getValue(widget.options.ThrottleCutSource) == MIN_VALUE
    if isArmed then
        lcd.drawFilledRectangle(
            0,
            0,
            w,
            h,
            widget.options.ArmedColor
        )
    end
    if isArmed and isThrottleActive then
        drawQuadcopter(5, 5)
    end
    if h >= 96 and w >= 120 then
        if widget.bitmap ~= nil then
            lcd.drawBitmap(widget.bitmap, 0, 38)
        end
        lcd.drawText(x + 5, y + 5, modelInfo.name)
    else
        if widget.bitmap ~= nil then
            lcd.drawBitmap(widget.bitmap, 0, 0)
        else
            lcd.drawText(x + 5, y + 5, modelInfo.name)
        end
    end
end
local function refresh(widget, event, touch)
    if event ~= nil then
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
local function translate(text, lang)
    local tr = {
        FillBackground = "Fill Background",
        ArmedColor = "Armed Color",
        ArmedSource = "Armed Source",
        ThrottleCutSource = "Throttle Cut Source",
        UseThemeColor = "Use Theme Color"
    }
    local v = tr[text]
    local ____temp_0
    if v == nil then
        ____temp_0 = v
    else
        ____temp_0 = text
    end
    return ____temp_0
end
animTick = 0
armed = false
____exports.refresh = refresh
____exports.name = name
____exports.create = create
____exports.update = update
____exports.options = options
____exports.translate = translate
return ____exports
