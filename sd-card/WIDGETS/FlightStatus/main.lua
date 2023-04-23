local ____exports = {}
local update
function update(widget, options)
    widget.options = options
end
local name = "Flight Status"
local MIN_VALUE = -1024
local MAX_VALUE = 1024
local options = {{"FlightModeSource", SOURCE, 1}, {"GyroSource", SOURCE, 1}, {"GyroColor", COLOR, COLOR_THEME_SECONDARY3}}
local function create(zone, options)
    local widget = {zone = zone, options = options}
    update(widget, options)
    return widget
end
local function draw(widget, x, y, w, h)
    local isGyroOn = getValue(widget.options.GyroSource) == MAX_VALUE
    if isGyroOn then
        lcd.drawFilledRectangle(
            0,
            0,
            w,
            h,
            widget.options.GyroColor
        )
    end
    local flightModeValue = getValue(widget.options.FlightModeSource)
    local flightMode = MIN_VALUE == flightModeValue and 1 or (0 == flightModeValue and 2 or 3)
    lcd.drawText(
        x,
        y,
        "Idle up " .. tostring(flightMode)
    )
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
____exports.refresh = refresh
____exports.name = name
____exports.create = create
____exports.update = update
____exports.options = options
return ____exports
