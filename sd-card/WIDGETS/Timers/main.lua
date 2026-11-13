local ____exports = {}
local name = "Timers"
--- The model's two timers in the top bar (74 × 39): this pack's time with the motor on (timer 1) over the sortie's,
-- today's (timer 2, started again each day by the Cockpit). Past an hour a time reads "1h07", to fit.
local options = {}
local function create(zone)
    return {zone = zone}
end
local function update()
end
local function clock(seconds)
    local whole = math.max(
        0,
        math.floor(seconds)
    )
    local hours = math.floor(whole / 3600)
    local minutes = math.floor(whole % 3600 / 60)
    return hours > 0 and (tostring(hours) .. "h") .. string.format("%02d", minutes) or (tostring(minutes) .. ":") .. string.format("%02d", whole % 60)
end
local function draw(width)
    local grey = lcd.RGB(10134445)
    lcd.drawText(4, 4, "Pack", TINSIZE + grey)
    local ____lcd_drawText_4 = lcd.drawText
    local ____temp_3 = width - 3
    local ____clock_2 = clock
    local ____opt_0 = model.getTimer(0)
    ____lcd_drawText_4(
        ____temp_3,
        1,
        ____clock_2(____opt_0 and ____opt_0.value or 0),
        SMLSIZE + RIGHT + lcd.RGB(8181402)
    )
    lcd.drawText(4, 23, "Sortie", TINSIZE + grey)
    local ____lcd_drawText_9 = lcd.drawText
    local ____temp_8 = width - 3
    local ____clock_7 = clock
    local ____opt_5 = model.getTimer(1)
    ____lcd_drawText_9(
        ____temp_8,
        20,
        ____clock_7(____opt_5 and ____opt_5.value or 0),
        SMLSIZE + RIGHT + lcd.RGB(15658734)
    )
end
local function refresh(widget)
    draw(widget.zone.w)
end
____exports.refresh = refresh
____exports.name = name
____exports.create = create
____exports.update = update
____exports.options = options
return ____exports
