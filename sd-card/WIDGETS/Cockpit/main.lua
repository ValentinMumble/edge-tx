-- Lua Library inline imports
local function __TS__ArrayPush(self, ...)
    local items = {...}
    local len = #self
    for i = 1, #items do
        len = len + 1
        self[len] = items[i]
    end
    return len
end

local function __TS__ArrayForEach(self, callbackFn, thisArg)
    for i = 1, #self do
        callbackFn(thisArg, self[i], i - 1, self)
    end
end

local function __TS__CountVarargs(...)
    return select("#", ...)
end

local function __TS__SparseArrayNew(...)
    local sparseArray = {...}
    sparseArray.sparseLength = __TS__CountVarargs(...)
    return sparseArray
end

local function __TS__SparseArrayPush(sparseArray, ...)
    local args = {...}
    local argsLen = __TS__CountVarargs(...)
    local listLen = sparseArray.sparseLength
    for i = 1, argsLen do
        sparseArray[listLen + i] = args[i]
    end
    sparseArray.sparseLength = listLen + argsLen
end

local function __TS__SparseArraySpread(sparseArray)
    local _unpack = unpack or table.unpack
    return _unpack(sparseArray, 1, sparseArray.sparseLength)
end

local function __TS__ArrayPushArray(self, items)
    local len = #self
    for i = 1, #items do
        len = len + 1
        self[len] = items[i]
    end
    return len
end

local function __TS__ObjectAssign(target, ...)
    local sources = {...}
    for i = 1, #sources do
        local source = sources[i]
        for key in pairs(source) do
            target[key] = source[key]
        end
    end
    return target
end
-- End of Lua Library inline imports
local ____exports = {}
local output, button, pack, cells, fuelLeft, look, at, lineHeight, label, dial, readout, objects, update, PACKS, LOW_FUEL, rgb, INK, MUTED, DIM, LABEL, DIGITS, GREEN, AMBER, RED, UNLIT, EDGE, TOP, BOTTOM, clamp
function output(index)
    local value = getOutputValue(index)
    local ____opt_0 = model.getOutput(index)
    return (____opt_0 and ____opt_0.revert) == 1 and -value or value
end
function button()
    return clamp(
        math.floor((getValue("6pos") + 1024) / 409.6 + 0.5) + 1,
        1,
        6
    )
end
function pack()
    return PACKS[button()]
end
function cells()
    local count = model.getGlobalVariable(5, 0)
    return count > 0 and count or 3
end
function fuelLeft(widget)
    return clamp(
        widget.startLeft - getValue("mAh") / pack().mah * 100,
        0,
        100
    )
end
function look(widget)
    local view = widget.view
    local armed = getValue("sa") == 1024
    view.hold = getValue("sf") ~= -1024
    view.rescue = getValue("sh") > 0
    local mode = getValue("se")
    view.idle = mode <= -512 and 1 or (mode >= 512 and 3 or 2)
    view.motorOff = view.hold or not armed
    view.live = not view.motorOff
    local volts = getValue("VFAS")
    view.powered = volts > 0.5
    view.amps = view.powered and getValue("Curr") or 0
    view.cell = view.powered and volts / cells() or 0
    view.left = view.powered and fuelLeft(widget) or 0
    view.watts = view.amps * volts
    local plugged = pack()
    view.packName = plugged.name
    view.packMah = plugged.mah
    view.mahLeft = math.floor(plugged.mah * view.left / 100 + 0.5)
    view.throttle = (output(2) + 1024) / 2048 * 100
    view.degrees = output(5) / 1024 * (widget.options.PitchRange or 12)
    view.aileron = getValue("ail")
    view.elevator = getValue("ele")
    local lights = view.lights
    local function set(index, word, on, color, ink)
        if ink == nil then
            ink = 1315860
        end
        local light = lights[index + 1]
        light.word = word
        light.on = on
        light.color = color
        light.ink = ink
    end
    if armed then
        set(0, "ARMED", true, AMBER)
    else
        set(0, "SAFE", true, 5230987)
    end
    set(1, view.hold and "THR OFF" or "THR ON", not view.hold, AMBER)
    set(
        2,
        "LEVEL",
        getValue("sc") >= 1024,
        3896745,
        16777215
    )
    set(
        3,
        "RESCUE",
        view.rescue,
        9051168,
        16777215
    )
    if widget.notFull and view.left >= LOW_FUEL then
        set(4, "NOT FULL", true, AMBER)
    else
        set(4, "LOW BATT", view.powered and view.left < LOW_FUEL, RED)
    end
    set(
        5,
        "TELE",
        getValue("RSSI") <= 0,
        9051168,
        16777215
    )
end
function at(centerX, centerY, radius, angle)
    local radians = angle * math.pi / 180
    return {
        math.floor(centerX + math.sin(radians) * radius + 0.5),
        math.floor(centerY - math.cos(radians) * radius + 0.5)
    }
end
function lineHeight(font)
    return font == TINSIZE and 12 or (font == SMLSIZE and 17 or (font == BOLD and 20 or 21))
end
function label(x, y, text, font, color, align)
    if align == nil then
        align = 0
    end
    local object = {
        type = "label",
        x = x,
        y = y - math.floor(lineHeight(font) / 2),
        text = text,
        font = font,
        color = color
    }
    if align == CENTER then
        local width = 2 * math.min(80, x, 480 - x)
        object.x = x - width / 2
        object.w = width
        object.align = CENTER
    elseif align == RIGHT then
        local width = math.min(160, x)
        object.x = x - width
        object.w = width
        object.align = RIGHT
    end
    return object
end
function dial(spec)
    local ____spec_2 = spec
    local x = ____spec_2.centerX
    local y = ____spec_2.centerY
    local radius = ____spec_2.radius
    local big = radius > 50
    local function angle(value)
        return -135 + (clamp(value, spec.low, spec.high) - spec.low) / (spec.high - spec.low) * 270
    end
    local objects = {}
    if big then
        for ____, ____value in ipairs(spec.labels) do
            local value = ____value[1]
            local text = ____value[2]
            local labelX, labelY = table.unpack(at(
                x,
                y,
                radius - 20,
                angle(value)
            ))
            objects[#objects + 1] = label(
                labelX,
                labelY,
                text,
                0,
                INK,
                CENTER
            )
        end
    end
    local peak = spec.peak
    if peak then
        objects[#objects + 1] = {
            type = "triangle",
            color = rgb(AMBER),
            pts = function()
                local at1 = angle(peak(nil))
                return {
                    at(x, y, radius + 1, at1),
                    at(x, y, radius - 6, at1 - 5),
                    at(x, y, radius - 6, at1 + 5)
                }
            end
        }
    end
    objects[#objects + 1] = label(
        x,
        y - math.floor(radius * 0.32),
        spec.title,
        big and SMLSIZE or TINSIZE,
        MUTED,
        CENTER
    )
    objects[#objects + 1] = {
        type = "line",
        thickness = big and 3 or 2,
        rounded = true,
        color = rgb(16777215),
        pts = function()
            local needle = angle(spec:value())
            return {
                at(x, y, big and 9 or 6, needle + 180),
                at(x, y, radius - 5, needle)
            }
        end
    }
    objects[#objects + 1] = {
        type = "circle",
        x = x,
        y = y,
        radius = big and 5 or 4,
        filled = true,
        color = rgb(2764080)
    }
    objects[#objects + 1] = {
        type = "circle",
        x = x,
        y = y,
        radius = big and 5 or 4,
        color = rgb(8947848)
    }
    return objects
end
function readout(y, title, value)
    return {
        label(
            326,
            y + 7,
            title,
            TINSIZE,
            MUTED
        ),
        label(
            406,
            y + 7,
            value,
            SMLSIZE,
            DIGITS,
            RIGHT
        )
    }
end
function objects(widget)
    local view = widget.view
    local list = {
        {
            type = "image",
            x = 0,
            y = 0,
            w = 480,
            h = 227,
            file = "/WIDGETS/Cockpit/panel.png"
        },
        {
            type = "image",
            x = 0,
            y = 0,
            w = 480,
            h = 227,
            file = "/WIDGETS/Cockpit/panel-live.png",
            visible = function() return view.live end
        }
    }
    __TS__ArrayForEach(
        view.lights,
        function(____, light, index)
            local x = 16 + index * 75
            __TS__ArrayPush(
                list,
                {
                    type = "rectangle",
                    x = x,
                    y = 5,
                    w = 71,
                    h = 17,
                    filled = true,
                    color = function() return rgb(light.color) end,
                    visible = function() return light.on end
                },
                {
                    type = "rectangle",
                    x = x,
                    y = 5,
                    w = 71,
                    h = 17,
                    color = EDGE,
                    visible = function() return light.on end
                },
                label(
                    x + 35,
                    13,
                    function() return light.word end,
                    SMLSIZE,
                    function() return light.on and rgb(light.ink) or UNLIT end,
                    CENTER
                )
            )
        end
    )
    local idles = {widget.options.Idle1, widget.options.Idle2, widget.options.Idle3}
    local ____array_3 = __TS__SparseArrayNew(
        0,
        table.unpack(idles)
    )
    __TS__SparseArrayPush(____array_3, 100)
    local stops = {__TS__SparseArraySpread(____array_3)}
    local function stopY(index)
        return math.floor(BOTTOM - index / (#stops - 1) * (BOTTOM - TOP))
    end
    local function throttleY(percent)
        do
            local index = 1
            while index < #stops do
                if percent <= stops[index + 1] or index == #stops - 1 then
                    local span = stops[index + 1] - stops[index]
                    local share = span > 0 and clamp((percent - stops[index]) / span, 0, 1) or 1
                    return math.floor(stopY(index - 1) - share * (stopY(index - 1) - stopY(index)))
                end
                index = index + 1
            end
        end
        return BOTTOM
    end
    __TS__ArrayPush(
        list,
        label(
            44,
            34,
            "THROTTLE",
            TINSIZE,
            LABEL,
            CENTER
        ),
        label(
            108,
            34,
            "PITCH",
            TINSIZE,
            LABEL,
            CENTER
        ),
        label(
            26,
            stopY(0) - 5,
            "CUT",
            TINSIZE,
            rgb(RED),
            RIGHT
        )
    )
    __TS__ArrayForEach(
        idles,
        function(____, level, index)
            local y = stopY(index + 1)
            local function current()
                return view.idle == index + 1 and not view.motorOff
            end
            __TS__ArrayPush(
                list,
                {
                    type = "hline",
                    x = 33,
                    y = y - 3,
                    w = 7,
                    h = 1,
                    color = GREEN,
                    visible = current
                },
                {
                    type = "hline",
                    x = 33,
                    y = y + 3,
                    w = 7,
                    h = 1,
                    color = GREEN,
                    visible = current
                },
                label(
                    30,
                    y - 5,
                    "IU" .. tostring(index + 1),
                    TINSIZE,
                    function() return current() and GREEN or MUTED end,
                    RIGHT
                ),
                label(
                    30,
                    y + 5,
                    tostring(level),
                    TINSIZE,
                    DIM,
                    RIGHT
                )
            )
        end
    )
    local ridges = {}
    do
        local ridge = -12
        while ridge <= 12 do
            ridges[#ridges + 1] = {
                type = "vline",
                x = 23 + ridge,
                y = 5,
                w = 1,
                h = 10,
                color = function() return view.motorOff and rgb(6120298) or rgb(10133670) end
            }
            ridge = ridge + 4
        end
    end
    list[#list + 1] = {
        type = "box",
        x = 21,
        y = BOTTOM - 10,
        w = 46,
        h = 23,
        pos = function() return 21, throttleY(view.throttle) - 10 end,
        children = {
            {
                type = "rectangle",
                x = 21,
                y = 17,
                w = 4,
                h = 6,
                filled = true,
                color = rgb(5922660)
            },
            {
                type = "rectangle",
                x = 0,
                y = 0,
                w = 46,
                h = 20,
                filled = true,
                color = rgb(131843)
            },
            {
                type = "rectangle",
                x = 2,
                y = 2,
                w = 42,
                h = 16,
                filled = true,
                color = function() return view.motorOff and rgb(8094089) or rgb(14672871) end
            },
            {
                type = "hline",
                x = 2,
                y = 2,
                w = 42,
                h = 1,
                color = function() return view.motorOff and rgb(10133670) or rgb(16777215) end
            },
            {
                type = "hline",
                x = 2,
                y = 17,
                w = 42,
                h = 1,
                color = rgb(4869973)
            },
            table.unpack(ridges)
        }
    }
    local stripes = {}
    do
        local stripe = 0
        while stripe < 4 do
            stripes[#stripes + 1] = {
                type = "rectangle",
                x = 2 + stripe * 4,
                y = 1,
                w = 2,
                h = 5,
                filled = true,
                color = rgb(stripe % 2 == 0 and AMBER or 1315860)
            }
            stripe = stripe + 1
        end
    end
    local ____temp_5 = stopY(0) - 23
    local function ____temp_6()
        return view.hold
    end
    local ____array_4 = __TS__SparseArrayNew(table.unpack(stripes))
    __TS__SparseArrayPush(
        ____array_4,
        {
            type = "rectangle",
            x = 0,
            y = 0,
            w = 20,
            h = 7,
            color = rgb(AMBER)
        }
    )
    list[#list + 1] = {
        type = "box",
        x = 34,
        y = ____temp_5,
        w = 20,
        h = 7,
        visible = ____temp_6,
        children = {__TS__SparseArraySpread(____array_4)}
    }
    list[#list + 1] = label(
        44,
        BOTTOM + 14,
        function() return view.motorOff and "CUT" or tostring(math.floor(view.throttle + 0.5)) .. "%" end,
        SMLSIZE,
        function() return view.motorOff and rgb(RED) or DIGITS end,
        CENTER
    )
    local range = widget.options.PitchRange or 12
    local function pitchY(value)
        return math.floor(BOTTOM - (clamp(value, -range, range) + range) / (2 * range) * (BOTTOM - TOP))
    end
    do
        local step = 0
        while step <= 4 do
            local mark = -range + step * range / 2
            local text = mark == 0 and "0" or (mark > 0 and "+" or "") .. tostring(math.floor(mark + 0.5))
            list[#list + 1] = label(
                90,
                pitchY(mark),
                text,
                TINSIZE,
                mark == 0 and LABEL or MUTED,
                RIGHT
            )
            step = step + 1
        end
    end
    local function grip()
        return view.rescue and rgb(RED) or rgb(12568011)
    end
    list[#list + 1] = {
        type = "box",
        x = 82,
        y = pitchY(0) - 9,
        w = 53,
        h = 18,
        pos = function() return 82, pitchY(view.degrees) - 9 end,
        children = {
            {
                type = "rectangle",
                x = 5,
                y = 0,
                w = 42,
                h = 18,
                filled = true,
                color = rgb(131843)
            },
            {
                type = "rectangle",
                x = 7,
                y = 2,
                w = 38,
                h = 14,
                filled = true,
                color = grip
            },
            {
                type = "circle",
                x = 7,
                y = 9,
                radius = 7,
                filled = true,
                color = grip
            },
            {
                type = "circle",
                x = 45,
                y = 9,
                radius = 7,
                filled = true,
                color = grip
            },
            {
                type = "hline",
                x = 9,
                y = 2,
                w = 35,
                h = 1,
                color = function() return view.rescue and rgb(16756912) or rgb(15856629) end
            },
            {
                type = "circle",
                x = 38,
                y = 8,
                radius = 3,
                filled = true,
                color = rgb(2764080)
            }
        }
    }
    list[#list + 1] = label(
        108,
        BOTTOM + 14,
        function() return ((view.degrees >= 0 and "+" or "") .. tostring(math.floor(view.degrees + 0.5))) .. "°" end,
        SMLSIZE,
        function() return view.rescue and rgb(RED) or DIGITS end,
        CENTER
    )
    __TS__ArrayPushArray(
        list,
        dial({
            centerX = 226,
            centerY = 117,
            radius = 72,
            title = "BATTERY",
            low = 0,
            high = 100,
            value = function() return view.left end,
            labels = {{0, "E"}, {50, "1/2"}, {100, "F"}}
        })
    )
    local function powered()
        return view.powered
    end
    __TS__ArrayPush(
        list,
        __TS__ObjectAssign(
            {},
            label(
                226,
                147,
                function() return tostring(math.floor(view.left + 0.5)) .. "%" end,
                0,
                DIGITS,
                CENTER
            ),
            {visible = powered}
        ),
        __TS__ObjectAssign(
            {},
            label(
                226,
                162,
                function() return tostring(view.mahLeft) .. " mAh" end,
                SMLSIZE,
                DIGITS,
                CENTER
            ),
            {visible = powered}
        ),
        __TS__ObjectAssign(
            {},
            label(
                226,
                154,
                "--",
                0,
                DIGITS,
                CENTER
            ),
            {visible = function() return not view.powered end}
        )
    )
    __TS__ArrayPush(
        list,
        __TS__ObjectAssign(
            {},
            label(
                226,
                201,
                "No battery detected",
                SMLSIZE,
                rgb(AMBER),
                CENTER
            ),
            {visible = function() return not view.powered end}
        ),
        __TS__ObjectAssign(
            {},
            label(
                226,
                210,
                function() return ((view.packName .. ", ") .. tostring(view.packMah)) .. " mAh" end,
                SMLSIZE,
                function() return view.powered and LABEL or MUTED end,
                CENTER
            ),
            {pos = function() return 146, view.powered and 202 or 206 end}
        )
    )
    local info = model.getInfo()
    if info.bitmap and info.bitmap ~= "" then
        list[#list + 1] = {
            type = "image",
            x = 324,
            y = 33,
            w = 66,
            h = 44,
            file = "/IMAGES/" .. info.bitmap
        }
    end
    __TS__ArrayPush(
        list,
        label(
            398,
            40,
            "MODEL",
            TINSIZE,
            MUTED
        ),
        label(
            398,
            56,
            info.name or "",
            BOLD,
            rgb(15856629)
        ),
        label(
            398,
            72,
            function() return tostring(cells()) .. "S" end,
            SMLSIZE,
            MUTED
        )
    )
    local ____array_7 = __TS__SparseArrayNew(table.unpack(dial({
        centerX = 354,
        centerY = 121,
        radius = 30,
        title = "AMPS",
        low = 0,
        high = 40,
        value = function() return view.amps end,
        labels = {},
        peak = function() return widget.peak end
    })))
    __TS__SparseArrayPush(
        ____array_7,
        label(
            354,
            137,
            function() return tostring(math.floor(view.amps + 0.5)) .. "A" end,
            SMLSIZE,
            DIGITS,
            CENTER
        ),
        table.unpack(dial({
            centerX = 434,
            centerY = 121,
            radius = 30,
            title = "CELL",
            low = 3.2,
            high = 4.2,
            value = function() return view.cell end,
            labels = {}
        }))
    )
    __TS__SparseArrayPush(
        ____array_7,
        label(
            434,
            137,
            function() return view.powered and string.format("%.2f", view.cell) or "--" end,
            SMLSIZE,
            DIGITS,
            CENTER
        )
    )
    __TS__ArrayPush(
        list,
        __TS__SparseArraySpread(____array_7)
    )
    __TS__ArrayPushArray(
        list,
        readout(
            180,
            "POWER",
            function() return tostring(math.floor(view.watts + 0.5)) .. " W" end
        )
    )
    local function percent(value)
        return (value >= 0 and "+" or "") .. tostring(math.floor(value / 1024 * 100 + 0.5))
    end
    __TS__ArrayPush(
        list,
        {
            type = "circle",
            x = 444,
            y = 182,
            radius = 3,
            filled = true,
            color = GREEN,
            pos = function() return 444 + math.floor(clamp(view.aileron, -1024, 1024) / 1024 * 20), 182 - math.floor(clamp(view.elevator, -1024, 1024) / 1024 * 20) end
        },
        label(
            444,
            213,
            function() return (("A" .. percent(view.aileron)) .. " E") .. percent(view.elevator) end,
            TINSIZE,
            DIGITS,
            CENTER
        )
    )
    return list
end
function update(widget, options)
    widget.options = options
    look(widget)
    lvgl.clear()
    lvgl.build(objects(widget))
end
local name = "Cockpit"
--- The whole screen as a heli's instrument panel (480 × 227, under the top bar):
-- - warning lights across the top: SAFE (green) or ARMED (SA down), THR ON or OFF (SF), LEVEL (SC, self-level),
--   RESCUE (SH), LOW BATT (or NOT FULL when the pack was not full when plugged in), TELE (no telemetry); the panel
--   turns dark yellow while the motor can spin;
-- - the throttle as a quadrant: a detent per idle up evenly up the gate, CUT at its foot guarded in hold, the lever at
--   the motor output (CH3); the pitch as a collective lever against a degree scale, at CH6;
-- - the battery as a fuel gauge: the charge the pack had when plugged in (by its resting volts a cell) less the mAh
--   used, against the size of the pack picked with the 6-position buttons (the mAh left under the %, the pack under
--   the gauge), saying the % left every 10% and warning when a pack is not full (mAhRe's sounds);
-- - the model's data plate (picture, name, cells), the amps (with the pack's peak) and volts a cell as gauges, the
--   power, and the cyclic: where the right stick is, to check it. The timers (this pack's, the sortie's) are in the
--   top bar (the Timers widget); this one starts the sortie's again each day.
-- It is built from EdgeTX's LVGL objects (useLvgl): the radio keeps them on the screen and redraws only what changes,
-- where a widget drawing with lcd calls redraws the whole screen 20 times a second. Everything that never moves is two
-- pictures beside this file (scripts/cockpit-panel.mjs draws them at the positions used here); the rest are objects
-- whose changing properties are functions, read again at each refresh from what refresh() works out once.
local options = {{
    "Idle1",
    VALUE,
    54,
    0,
    100
}, {
    "Idle2",
    VALUE,
    58,
    0,
    100
}, {
    "Idle3",
    VALUE,
    75,
    0,
    100
}, {
    "PitchRange",
    VALUE,
    12,
    1,
    20
}}
PACKS = {
    {name = "Gens Ace 1", mah = 700},
    {name = "Gens Ace 3", mah = 750},
    {name = "Gens Ace 4", mah = 750},
    {name = "OMP 2", mah = 750},
    {name = "Eachine 1", mah = 500},
    {name = "Eachine 2", mah = 500}
}
--- A new pack: its voltage back after none with the mAh count at 0 (see Session).
local NEW_PACK_MAH = 5
--- Under this a cell is not full when plugged in (mAhRe's level), and the % left that lights LOW BATT.
local FULL_CELL = 4
LOW_FUEL = 25
--- From this a cell counts as full at rest (89% in the table below, allowing for the voltage sensor's error).
local FULL_START = 4.1
local SOUNDS = "/WIDGETS/mAhRe/sounds/"
--- Global variable 9 keeps the day timer 2 last started again: the sortie is today's motor time.
local SORTIE_DAY = 8
rgb = function(color) return lcd.RGB(color) end
INK = rgb(15330543)
MUTED = rgb(10134445)
DIM = rgb(7041916)
LABEL = rgb(13225683)
DIGITS = rgb(8191922)
GREEN = rgb(5230987)
AMBER = 16756768
RED = 16731471
UNLIT = rgb(5067351)
EDGE = rgb(3816768)
TOP = 42
BOTTOM = 198
clamp = function(value, low, high) return math.max(
    low,
    math.min(high, value)
) end
--- A LiPo cell's charge (%) at rest by its voltage: the usual table, read between its points.
local CHARGE = {
    {3.3, 0},
    {3.61, 5},
    {3.69, 10},
    {3.71, 15},
    {3.73, 20},
    {3.75, 25},
    {3.77, 30},
    {3.79, 35},
    {3.8, 40},
    {3.82, 45},
    {3.84, 50},
    {3.85, 55},
    {3.87, 60},
    {3.91, 65},
    {3.95, 70},
    {3.98, 75},
    {4.02, 80},
    {4.08, 85},
    {4.11, 90},
    {4.15, 95},
    {4.2, 100}
}
local function chargeOf(cell)
    if cell <= CHARGE[1][1] then
        return 0
    end
    do
        local index = 1
        while index < #CHARGE do
            local volts, percent = table.unpack(CHARGE[index + 1])
            if cell <= volts then
                local lowVolts, lowPercent = table.unpack(CHARGE[index])
                return lowPercent + (cell - lowVolts) / (volts - lowVolts) * (percent - lowPercent)
            end
            index = index + 1
        end
    end
    return 100
end
--- Today as a day of the year (as Session counts it), to start the sortie again each day.
local function today()
    local now = getDateTime()
    local days = {
        0,
        31,
        59,
        90,
        120,
        151,
        181,
        212,
        243,
        273,
        304,
        334
    }
    return days[now.mon] + now.day
end
--- What runs whether the screen shows or not: a new pack starts the checks again; once its voltage settles, the charge
-- it starts with (100% from 4.10 V a cell) and the not-full warning; the % left said at each 10% below that (5%
-- last, then empty), the peak current.
local function follow(widget)
    local volts = getValue("VFAS")
    local powered = volts > 0.5
    local now = getTime()
    if powered and not widget.powered and getValue("mAh") < NEW_PACK_MAH then
        widget.plugged = now
        widget.notFull = false
        widget.said = 100
        widget.peak = 0
        widget.startLeft = 100
    end
    widget.powered = powered
    if not powered then
        return
    end
    if widget.plugged >= 0 and now - widget.plugged >= 200 then
        widget.plugged = -1
        widget.startLeft = volts / cells() >= FULL_START and 100 or chargeOf(volts / cells())
        widget.said = math.ceil(widget.startLeft / 10) * 10
        if volts / cells() < FULL_CELL then
            widget.notFull = true
            playFile(SOUNDS .. "BNFull.wav")
        end
    end
    widget.peak = math.max(
        widget.peak,
        getValue("Curr")
    )
    local left = fuelLeft(widget)
    local step = left <= 0 and 0 or (left <= 5 and 5 or math.ceil(left / 10) * 10)
    if step < widget.said and left < widget.said then
        widget.said = step
        playFile((SOUNDS .. (step == 0 and "BatNo" or ("Bat" .. tostring(step)) .. "L")) .. ".wav")
    end
end
local function create(zone, options)
    local lights = {}
    do
        local index = 0
        while index < 6 do
            lights[#lights + 1] = {word = "", on = false, color = 0, ink = 0}
            index = index + 1
        end
    end
    local widget = {
        zone = zone,
        options = options,
        powered = false,
        plugged = -1,
        notFull = false,
        said = 100,
        peak = 0,
        startLeft = 100,
        since = getTime(),
        view = {
            live = false,
            motorOff = true,
            hold = true,
            rescue = false,
            idle = 2,
            powered = false,
            left = 0,
            mahLeft = 0,
            amps = 0,
            cell = 0,
            watts = 0,
            throttle = 0,
            degrees = 0,
            aileron = 0,
            elevator = 0,
            packName = "",
            packMah = 0,
            lights = lights
        }
    }
    update(widget, options)
    return widget
end
local function background(widget)
    follow(widget)
end
local function refresh(widget)
    follow(widget)
    look(widget)
    local now = getTime()
    if now - widget.since >= 100 then
        widget.since = now
        if model.getGlobalVariable(SORTIE_DAY, 0) ~= today() then
            model.resetTimer(1)
            model.setGlobalVariable(
                SORTIE_DAY,
                0,
                today()
            )
        end
    end
end
local useLvgl = true
____exports.refresh = refresh
____exports.background = background
____exports.name = name
____exports.create = create
____exports.update = update
____exports.options = options
____exports.useLvgl = useLvgl
return ____exports
