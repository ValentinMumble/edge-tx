-- Lua Library inline imports
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

local function __TS__ArrayPushArray(self, items)
    local len = #self
    for i = 1, #items do
        len = len + 1
        self[len] = items[i]
    end
    return len
end

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
-- End of Lua Library inline imports
local ____exports = {}
local output, button, pack, cells, fuelLeft, look, at, lineHeight, swing, armSwitch, label, dial, curveXs, curveAt, readCurves, objects, update, practiceRate, PACKS, TELE_LIGHT, LOW_FUEL, ALARM_EVERY, rgb, INK, MUTED, DIM, LABEL, DIGITS, GREEN, BLUE, AMBER, RED, UNLIT, EDGE, TOP, BOTTOM, clamp, GUARD_SWING, GUARD_TURN, GUARD_LONG, HINGE, LEVER_FLIP, LEVER_LONG, NUT, ease, toward, PLOT_X, PLOT_Y, plotAt
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
    view.s1 = math.floor(getValue("s1") / 1024 * (view.idle == 3 and 10 or 20) + 0.5)
    view.motorOff = view.hold or not armed
    view.live = not view.motorOff
    local volts = getValue("VFAS")
    view.powered = volts > 0.5
    view.cell = view.powered and volts / cells() or 0
    view.left = view.powered and fuelLeft(widget) or 0
    local plugged = pack()
    view.packName = plugged.name
    view.packMah = plugged.mah
    view.mahLeft = math.floor(plugged.mah * view.left / 100 + 0.5)
    view.practice = getValue("sd") >= 1024
    view.practiceRate = view.practice and practiceRate() or 0
    view.curve = getValue("sc") >= 1024 and "CPL" or (view.practice and "CPP" or "CP" .. tostring(view.idle))
    view.stick = getValue("thr")
    view.throttle = (output(2) + 1024) / 2048 * 100
    view.degrees = output(5) / 1024 * (widget.options.PitchRange or 12)
    view.collective = output(5) / 1024 * 100
    view.aileron = getValue("ail")
    view.elevator = getValue("ele")
    view.sentAileron = output(0)
    view.sentElevator = output(1)
    view.rudder = getValue("rud")
    view.sentRudder = output(3)
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
    if view.powered and getTime() - widget.sagAt < ALARM_EVERY then
        set(4, "LOW VOLT", true, RED)
    elseif widget.notFull and view.left >= LOW_FUEL then
        set(4, "NOT FULL", true, AMBER)
    else
        set(4, "LOW BATT", view.powered and view.left < LOW_FUEL, RED)
    end
    set(
        TELE_LIGHT,
        "TELE",
        getValue("RSSI") <= 0,
        9051168,
        16777215
    )
    swing(view, armed)
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
function swing(view, armed)
    local now = getTime()
    local guard = armed and 1 or 0
    local lever = view.lights[2].on and 1 or -1
    local seconds = (now - view.swung) / 100
    if view.swung < 0 or seconds > 0.5 then
        view.guard = guard
        view.lever = lever
    else
        view.guard = toward(view.guard, guard, seconds / GUARD_SWING)
        view.lever = toward(view.lever, lever, 2 * seconds / LEVER_FLIP)
    end
    view.swung = now
end
function armSwitch(view)
    local lights = view.lights
    local function armed()
        return lights[1].word == "ARMED"
    end
    local function live()
        return armed() and lights[2].on
    end
    local function safeOn()
        return not armed() and lights[2].on
    end
    local x = 40
    local outline = rgb(2764080)
    local chrome = rgb(13225683)
    local shine = rgb(16054008)
    local pivot = rgb(12172995)
    local edge = rgb(3999754)
    local inside = rgb(7213075)
    local function closed()
        return view.guard <= 0.02
    end
    local function open()
        return view.guard >= 0.98
    end
    local function turn()
        return ease(view.guard) * GUARD_TURN
    end
    local function reach()
        return GUARD_LONG * math.cos(turn())
    end
    local function facing()
        return not closed() and not open() and reach() >= 0
    end
    local function flipped()
        return not closed() and not open() and reach() < 0
    end
    local function seen()
        return math.max(
            2,
            math.floor(math.abs(reach()) + 0.5)
        )
    end
    local function face()
        local light = 0.55 + 0.45 * math.cos(turn())
        return lcd.RGB(
            math.floor(200 * light),
            math.floor(38 * light),
            math.floor(43 * light)
        )
    end
    local function tip()
        return math.floor(NUT - LEVER_LONG * (ease((view.lever + 1) / 2) * 2 - 1) + 0.5)
    end
    local function top()
        return math.min(
            tip(),
            NUT
        )
    end
    local function length()
        return math.abs(tip() - NUT)
    end
    return {
        {
            type = "rectangle",
            x = 16,
            y = 5,
            w = 146,
            h = 31,
            filled = true,
            color = function() return rgb(live() and 14034990 or ((armed() or safeOn()) and AMBER or 3450963)) end
        },
        {
            type = "rectangle",
            x = 16,
            y = 5,
            w = 146,
            h = 31,
            color = EDGE
        },
        {
            type = "rectangle",
            x = 29,
            y = 5,
            w = 23,
            h = 8,
            filled = true,
            color = inside,
            visible = open
        },
        {
            type = "rectangle",
            x = 31,
            y = 6,
            w = 19,
            h = 5,
            filled = true,
            color = rgb(9378078),
            visible = open
        },
        {
            type = "rectangle",
            x = 29,
            y = 5,
            w = 23,
            h = 1,
            filled = true,
            color = rgb(15495798),
            visible = open
        },
        {
            type = "rectangle",
            x = 29,
            y = 5,
            w = 23,
            h = 8,
            color = edge,
            visible = open
        },
        {
            type = "rectangle",
            x = 29,
            y = HINGE - 7,
            w = 23,
            h = 8,
            filled = true,
            color = inside,
            pos = function() return 29, HINGE - seen() end,
            size = function() return 23, seen() + 1 end,
            visible = flipped
        },
        {
            type = "rectangle",
            x = 29,
            y = HINGE - 7,
            w = 23,
            h = 8,
            color = edge,
            pos = function() return 29, HINGE - seen() end,
            size = function() return 23, seen() + 1 end,
            visible = flipped
        },
        {
            type = "circle",
            x = 31,
            y = HINGE,
            radius = 2,
            filled = true,
            color = pivot,
            visible = function() return open() or flipped() end
        },
        {
            type = "circle",
            x = 49,
            y = HINGE,
            radius = 2,
            filled = true,
            color = pivot,
            visible = function() return open() or flipped() end
        },
        {
            type = "rectangle",
            x = 30,
            y = 13,
            w = 21,
            h = 21,
            filled = true,
            color = rgb(1382427)
        },
        {
            type = "rectangle",
            x = 30,
            y = 13,
            w = 21,
            h = 21,
            color = rgb(3817026)
        },
        {
            type = "circle",
            x = x,
            y = NUT,
            radius = 6,
            filled = true,
            color = outline
        },
        {
            type = "circle",
            x = x,
            y = NUT,
            radius = 5,
            filled = true,
            color = rgb(12172995)
        },
        {
            type = "circle",
            x = x,
            y = NUT,
            radius = 3,
            filled = true,
            color = rgb(6120040)
        },
        {
            type = "circle",
            x = x - 2,
            y = NUT - 2,
            radius = 1,
            filled = true,
            color = shine
        },
        {
            type = "rectangle",
            x = x - 3,
            y = NUT - 1,
            w = 6,
            h = LEVER_LONG + 2,
            filled = true,
            color = outline,
            pos = function() return x - 3, top() - 1 end,
            size = function() return 6, length() + 2 end,
            visible = function() return length() >= 1 end
        },
        {
            type = "rectangle",
            x = x - 2,
            y = NUT,
            w = 4,
            h = LEVER_LONG,
            filled = true,
            color = chrome,
            pos = function() return x - 2, top() end,
            size = function() return 4, length() end,
            visible = function() return length() >= 1 end
        },
        {
            type = "rectangle",
            x = x - 1,
            y = NUT + 2,
            w = 1,
            h = LEVER_LONG - 4,
            filled = true,
            color = shine,
            pos = function() return x - 1, top() + 2 end,
            size = function() return 1, length() - 4 end,
            visible = function() return length() > 4 end
        },
        {
            type = "circle",
            x = x,
            y = NUT + LEVER_LONG,
            radius = 4,
            filled = true,
            color = outline,
            pos = function() return x, tip() end
        },
        {
            type = "circle",
            x = x,
            y = NUT + LEVER_LONG,
            radius = 3,
            filled = true,
            color = rgb(14672871),
            pos = function() return x, tip() end
        },
        {
            type = "circle",
            x = x - 1,
            y = NUT + LEVER_LONG - 1,
            radius = 1,
            filled = true,
            color = rgb(16777215),
            pos = function() return x - 1, tip() - 1 end
        },
        {
            type = "rectangle",
            x = 29,
            y = 9,
            w = 23,
            h = 25,
            filled = true,
            color = rgb(13116971),
            visible = closed
        },
        {
            type = "rectangle",
            x = 29,
            y = 9,
            w = 23,
            h = 4,
            filled = true,
            color = rgb(8197144),
            visible = closed
        },
        {
            type = "circle",
            x = 31,
            y = 11,
            radius = 2,
            filled = true,
            color = pivot,
            visible = closed
        },
        {
            type = "circle",
            x = 49,
            y = 11,
            radius = 2,
            filled = true,
            color = pivot,
            visible = closed
        },
        {
            type = "rectangle",
            x = 38,
            y = 14,
            w = 5,
            h = 18,
            filled = true,
            color = rgb(10689826),
            visible = closed
        },
        {
            type = "rectangle",
            x = 39,
            y = 14,
            w = 3,
            h = 18,
            filled = true,
            color = rgb(14170173),
            visible = closed
        },
        {
            type = "rectangle",
            x = 31,
            y = 14,
            w = 2,
            h = 18,
            filled = true,
            color = rgb(15696004),
            visible = closed
        },
        {
            type = "rectangle",
            x = 29,
            y = 32,
            w = 23,
            h = 2,
            filled = true,
            color = rgb(9378078),
            visible = closed
        },
        {
            type = "rectangle",
            x = 29,
            y = 9,
            w = 23,
            h = 25,
            color = edge,
            visible = closed
        },
        {
            type = "rectangle",
            x = 29,
            y = HINGE - 2,
            w = 23,
            h = GUARD_LONG + 2,
            filled = true,
            color = face,
            size = function() return 23, seen() + 2 end,
            visible = facing
        },
        {
            type = "rectangle",
            x = 29,
            y = HINGE - 2,
            w = 23,
            h = 3,
            filled = true,
            color = rgb(8197144),
            visible = facing
        },
        {
            type = "rectangle",
            x = 29,
            y = HINGE - 2,
            w = 23,
            h = GUARD_LONG + 2,
            color = edge,
            size = function() return 23, seen() + 2 end,
            visible = facing
        },
        {
            type = "circle",
            x = 31,
            y = HINGE,
            radius = 2,
            filled = true,
            color = pivot,
            visible = facing
        },
        {
            type = "circle",
            x = 49,
            y = HINGE,
            radius = 2,
            filled = true,
            color = pivot,
            visible = facing
        },
        {
            type = "circle",
            x = x,
            y = 9,
            radius = 4,
            filled = true,
            color = outline,
            visible = function() return closed() and view.lever > 0 end
        },
        {
            type = "circle",
            x = x,
            y = 9,
            radius = 3,
            filled = true,
            color = rgb(14672871),
            visible = function() return closed() and view.lever > 0 end
        },
        {
            type = "circle",
            x = x - 1,
            y = 8,
            radius = 1,
            filled = true,
            color = rgb(16777215),
            visible = function() return closed() and view.lever > 0 end
        },
        __TS__ObjectAssign(
            {},
            label(
                106,
                21,
                function() return live() and "THR ON" or (armed() and "ARMED" or "SAFE") end,
                BOLD,
                function() return rgb(live() and 16777215 or 858642) end,
                CENTER
            ),
            {visible = function() return not safeOn() end}
        ),
        __TS__ObjectAssign(
            {},
            label(
                106,
                16,
                "UNARMED",
                BOLD,
                rgb(858642),
                CENTER
            ),
            {visible = safeOn}
        ),
        __TS__ObjectAssign(
            {},
            label(
                106,
                29,
                "THR ON",
                TINSIZE,
                rgb(858642),
                CENTER
            ),
            {visible = safeOn}
        )
    }
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
function curveXs(curve)
    local xs = {}
    do
        local index = 0
        while index < #curve.y do
            xs[#xs + 1] = curve.x and curve.x[index + 1] or -100 + 200 * index / (#curve.y - 1)
            index = index + 1
        end
    end
    return xs
end
function curveAt(curve, across)
    local xs = curveXs(curve)
    do
        local index = 1
        while index < #xs do
            if across <= xs[index + 1] or index == #xs - 1 then
                local span = xs[index + 1] - xs[index]
                local share = span == 0 and 1 or clamp((across - xs[index]) / span, 0, 1)
                return curve.y[index] + share * (curve.y[index + 1] - curve.y[index])
            end
            index = index + 1
        end
    end
    return 0
end
function readCurves()
    local curves = {}
    do
        local index = 0
        while index < 32 do
            local curve = model.getCurve(index)
            if curve and curve.name ~= "" and #curve.y >= 2 then
                curves[curve.name] = curve
            end
            index = index + 1
        end
    end
    return curves
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
    __TS__ArrayPushArray(
        list,
        armSwitch(view)
    )
    __TS__ArrayForEach(
        view.lights,
        function(____, light, index)
            if index < 2 then
                return
            end
            local x = 16 + index * 75
            local word = label(
                x + 35,
                13,
                function() return light.word end,
                SMLSIZE,
                function() return light.on and rgb(light.ink) or UNLIT end,
                CENTER
            )
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
                }
            )
            if index ~= TELE_LIGHT then
                list[#list + 1] = word
                return
            end
            __TS__ArrayPush(
                list,
                __TS__ObjectAssign(
                    {},
                    word,
                    {visible = function() return light.on end}
                ),
                __TS__ObjectAssign(
                    {},
                    label(
                        x + 30,
                        13,
                        function() return light.word end,
                        SMLSIZE,
                        UNLIT,
                        CENTER
                    ),
                    {visible = function() return not light.on end}
                ),
                {
                    type = "circle",
                    x = x + 55,
                    y = 12,
                    radius = 2,
                    filled = true,
                    color = rgb(5230987),
                    visible = function() return not light.on end
                }
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
            47,
            "THROTTLE",
            TINSIZE,
            LABEL,
            CENTER
        ),
        label(
            108,
            47,
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
            label(
                23,
                10,
                function() return ("S1 " .. (view.s1 > 0 and "+" or "")) .. tostring(view.s1) end,
                TINSIZE,
                rgb(1316377),
                CENTER
            )
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
    local function flown()
        return widget.curves[view.curve]
    end
    --- An idle up's throttle (1 to 3) across the stick, from its curve (FM1 to FM3), else flat at its placard.
    local function throttleAt(idle, across)
        local curve = widget.curves["FM" .. tostring(idle)]
        return curve and curveAt(curve, across) or idles[idle] * 2 - 100
    end
    --- An idle up's throttle line, lifted by `extra` (what S1 adds).
    local function throttleLine(idle, extra)
        local curve = widget.curves["FM" .. tostring(idle)]
        if not curve then
            return {
                plotAt(
                    -100,
                    throttleAt(idle, 0) + extra
                ),
                plotAt(
                    100,
                    throttleAt(idle, 0) + extra
                )
            }
        end
        local xs = curveXs(curve)
        local points = {}
        do
            local index = 0
            while index < #xs do
                points[#points + 1] = plotAt(xs[index + 1], curve.y[index + 1] + extra)
                index = index + 1
            end
        end
        return points
    end
    __TS__ArrayPush(
        list,
        label(
            326,
            99,
            "THR",
            TINSIZE,
            GREEN
        ),
        label(
            347,
            99,
            "PITCH",
            TINSIZE,
            BLUE
        )
    )
    list[#list + 1] = label(
        402,
        99,
        function() return view.curve end,
        TINSIZE,
        DIGITS,
        RIGHT
    )
    __TS__ArrayForEach(
        {1, 2, 3},
        function(____, idle)
            list[#list + 1] = {
                type = "line",
                thickness = 1,
                color = DIM,
                pts = function() return throttleLine(idle, 0) end
            }
        end
    )
    __TS__ArrayPush(
        list,
        {
            type = "line",
            thickness = 2,
            rounded = true,
            color = GREEN,
            pts = function() return throttleLine(view.idle, view.s1) end
        },
        {
            type = "circle",
            x = PLOT_X,
            y = PLOT_Y,
            radius = 3,
            filled = true,
            color = rgb(16777215),
            pos = function()
                local across = view.stick / 1024 * 100
                return table.unpack(plotAt(
                    across,
                    throttleAt(view.idle, across) + view.s1
                ))
            end
        }
    )
    __TS__ArrayPush(
        list,
        {
            type = "line",
            thickness = 2,
            rounded = true,
            color = BLUE,
            pts = function()
                local curve = flown()
                if not curve then
                    return {
                        plotAt(-100, 0),
                        plotAt(100, 0)
                    }
                end
                local xs = curveXs(curve)
                local points = {}
                do
                    local index = 0
                    while index < #xs do
                        points[#points + 1] = plotAt(xs[index + 1], curve.y[index + 1])
                        index = index + 1
                    end
                end
                return points
            end
        },
        {
            type = "circle",
            x = PLOT_X,
            y = PLOT_Y,
            radius = 3,
            filled = true,
            color = BLUE,
            pos = function() return table.unpack(plotAt(view.stick / 1024 * 100, view.collective)) end
        },
        label(
            363,
            213,
            function()
                if view.practice then
                    return view.practiceRate > 0 and ("PRACTICE " .. tostring(view.practiceRate)) .. "%" or "PRACTICE"
                end
                local curve = flown()
                if not curve then
                    return "no curve"
                end
                local most = 0
                for ____, point in ipairs(curve.y) do
                    most = math.max(
                        most,
                        math.abs(point)
                    )
                end
                return ("max " .. string.format("%.1f", most / 100 * (widget.options.PitchRange or 12))) .. "°"
            end,
            TINSIZE,
            function() return view.practice and BLUE or DIGITS end,
            CENTER
        )
    )
    local ____array_7 = __TS__SparseArrayNew(table.unpack(dial({
        centerX = 442,
        centerY = 121,
        radius = 28,
        title = "CELL",
        low = 3.2,
        high = 4.2,
        value = function() return view.cell end,
        labels = {}
    })))
    __TS__SparseArrayPush(
        ____array_7,
        label(
            442,
            136,
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
    local function percent(value)
        return (value >= 0 and "+" or "") .. tostring(math.floor(value / 1024 * 100 + 0.5))
    end
    local function across(value)
        return math.floor(clamp(value, -1024, 1024) / 1024 * 18)
    end
    __TS__ArrayPush(
        list,
        {
            type = "circle",
            x = 442,
            y = 175,
            radius = 4,
            color = MUTED,
            pos = function() return 442 + across(view.aileron), 175 - across(view.elevator) end
        },
        {
            type = "circle",
            x = 442,
            y = 175,
            radius = 3,
            filled = true,
            color = GREEN,
            pos = function() return 442 + across(view.sentAileron), 175 - across(view.sentElevator) end
        },
        {
            type = "rectangle",
            x = 441,
            y = 197,
            w = 3,
            h = 10,
            color = MUTED,
            pos = function() return 441 + across(view.rudder), 197 end
        },
        {
            type = "rectangle",
            x = 441,
            y = 200,
            w = 3,
            h = 4,
            filled = true,
            color = GREEN,
            pos = function() return 441 + across(view.sentRudder), 200 end
        },
        label(
            464,
            213,
            function() return (((("A" .. percent(view.sentAileron)) .. " E") .. percent(view.sentElevator)) .. " R") .. percent(view.sentRudder) end,
            TINSIZE,
            DIGITS,
            RIGHT
        )
    )
    list[#list + 1] = {
        type = "rectangle",
        x = 0,
        y = 0,
        w = 480,
        h = 227,
        thickness = 3,
        color = BLUE,
        visible = function() return view.practice end
    }
    return list
end
function update(widget, options)
    widget.options = options
    widget.curves = readCurves()
    look(widget)
    lvgl.clear()
    lvgl.build(objects(widget))
end
function practiceRate()
    local lines = model.getInputsCount(0)
    do
        local line = 0
        while line < lines do
            local found = model.getInput(0, line)
            if found ~= nil and found.name == "Prac" then
                return found.weight
            end
            line = line + 1
        end
    end
    return 0
end
local name = "Cockpit"
--- The whole screen as a heli's instrument panel (480 × 227, under the top bar):
-- - across the top: arming (SA) and the throttle (SF) as one guarded toggle in its box (the guard closed
--   while SAFE, flipped up once ARMED, the lever up for THR ON, the box lit green, amber or red), then the warning lights:
--   LEVEL (SC, self-level),
--   RESCUE (SH), LOW BATT (LOW VOLT while the low-cell alarm is on, NOT FULL when the pack was not full when plugged
--   in), TELE (no telemetry, a green dot in its box while it comes in); the panel turns dark red while the motor
--   can spin;
-- - the throttle as a quadrant: a detent per idle up evenly up the gate, CUT at its foot guarded in hold, the lever at
--   the motor output (CH3), what S1 adds to it on its knob; the pitch as a collective lever against a degree scale,
--   at CH6;
-- - the battery as a fuel gauge: the charge the pack had when plugged in (by its resting volts a cell) less the mAh
--   used, against the size of the pack picked with the 6-position buttons (the mAh left under the %, the pack under
--   the gauge), saying the % left every 10% and warning when a pack is not full (mAhRe's sounds), when a cell sags
--   under 3.30 V for a while (the model's low-cell alarm, which waited for 5 s in a row, is off) and, with buzzes,
--   when the pack runs low;
-- - the model's data plate (picture, name, cells); the curves as the K110Cockpit draws them: the idle ups' flat
--   throttle lines (FM1 to FM3, the governor's head speeds), the one SE picks lit green with what S1 adds, and over
--   them the pitch curve flown in blue (the idle up's, CP1 to CP3, or the self-level one, CPL, while LEVEL is lit),
--   a dot at the collective stick on the throttle and at the pitch sent, read from the model; volts a cell as a gauge;
--   and the cyclic and the rudder: where the sticks are and what is sent, to check them. The timers (this pack's, the sortie's) are in the top bar
--   (the Timers widget); this one starts the sortie's again each day.
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
    60,
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
    {name = "Gens Ace 3", mah = 750},
    {name = "Gens Ace 4", mah = 750},
    {name = "OMP 2", mah = 750},
    {name = "Eachine 2", mah = 500},
    {name = "Eachine 1", mah = 500},
    {name = "None", mah = 750}
}
--- A new pack: its voltage back after none with the mAh count at 0 (see Session).
local NEW_PACK_MAH = 5
TELE_LIGHT = 5
--- Under this a cell is not full when plugged in (mAhRe's level), and the % left that lights LOW BATT.
local FULL_CELL = 4
LOW_FUEL = 25
--- The low-cell alarm, in place of the model's (L15, now off): a 3S pack pulled hard dips under 3.30 V a cell for a
-- second or two at a time, too short for a switch that waits for 5 s in a row. So the seconds a cell spends under
-- SAG_CELL while drawing LOAD amps or more add up, fading by SAG_FADE (a dip 20 s ago counts a tenth), and past
-- SAG_SECONDS the radio says "low battery" and buzzes twice, again after ALARM_EVERY (tens of ms) if the pack still
-- sags. On the logs of 12 and 13 Nov 2026 it goes off on 9 packs of 10, where the old alarm did on 4.
local SAG_CELL = 3.3
local LOAD = 2
local SAG_FADE = 10
local SAG_SECONDS = 2
ALARM_EVERY = 1500
--- Long ago, for an alarm that has not gone off yet.
local NEVER = -100000
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
BLUE = rgb(7124223)
AMBER = 16756768
RED = 16731471
UNLIT = rgb(5067351)
EDGE = rgb(3816768)
TOP = 55
BOTTOM = 198
clamp = function(value, low, high) return math.max(
    low,
    math.min(high, value)
) end
GUARD_SWING = 0.3
GUARD_TURN = 108.5 * math.pi / 180
GUARD_LONG = 22
HINGE = 12
LEVER_FLIP = 0.15
LEVER_LONG = 9
NUT = 23
ease = function(share) return share * share * (3 - 2 * share) end
toward = function(from, to, step) return from < to and math.min(to, from + step) or math.max(to, from - step) end
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
--- `times` buzzes of `length` (tens of ms), a tenth of a second apart.
local function buzz(times, length)
    do
        local index = 0
        while index < times do
            playHaptic(length, 10)
            index = index + 1
        end
    end
end
--- What runs whether the screen shows or not: a new pack starts the checks again; once its voltage settles, the charge
-- it starts with (100% from 4.10 V a cell) and the not-full warning; the % left said at each 10% below that (5%
-- last, then empty); the low-cell alarm, and three buzzes every 15 s while the motor runs on a pack
-- under LOW_FUEL % (a call said over the rotor is easy to miss, a buzz in the hands is not).
local function follow(widget)
    local volts = getValue("VFAS")
    local powered = volts > 0.5
    local now = getTime()
    local elapsed = clamp((now - widget.ticks) / 100, 0, 1)
    widget.ticks = now
    if powered and not widget.powered and getValue("mAh") < NEW_PACK_MAH then
        widget.plugged = now
        widget.notFull = false
        widget.said = 100
        widget.startLeft = 100
        widget.sag = 0
        widget.sagAt = NEVER
        widget.lowAt = NEVER
    end
    widget.powered = powered
    if not powered then
        return
    end
    local sagging = getValue("Curr") >= LOAD and volts / cells() < SAG_CELL
    widget.sag = widget.sag * math.exp(-elapsed / SAG_FADE) + (sagging and elapsed or 0)
    if widget.sag >= SAG_SECONDS and now - widget.sagAt >= ALARM_EVERY then
        widget.sagAt = now
        playFile("lowbat.wav")
        buzz(2, 15)
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
    local left = fuelLeft(widget)
    local step = left <= 0 and 0 or (left <= 5 and 5 or math.ceil(left / 10) * 10)
    if step < widget.said and left < widget.said then
        widget.said = step
        playFile((SOUNDS .. (step == 0 and "BatNo" or ("Bat" .. tostring(step)) .. "L")) .. ".wav")
    end
    local running = getValue("sa") == 1024 and getValue("sf") == -1024
    if running and left < LOW_FUEL and now - widget.lowAt >= ALARM_EVERY then
        widget.lowAt = now
        buzz(3, 30)
    end
end
PLOT_X = 363
PLOT_Y = 157
local PLOT_W = 38
local PLOT_H = 44
plotAt = function(across, up) return {
    PLOT_X + math.floor(clamp(across, -100, 100) / 100 * PLOT_W + 0.5),
    PLOT_Y - math.floor(clamp(up, -100, 100) / 100 * PLOT_H + 0.5)
} end
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
        curves = {},
        startLeft = 100,
        since = getTime(),
        ticks = getTime(),
        sag = 0,
        sagAt = NEVER,
        lowAt = NEVER,
        view = {
            live = false,
            motorOff = true,
            hold = true,
            rescue = false,
            idle = 2,
            powered = false,
            left = 0,
            mahLeft = 0,
            cell = 0,
            throttle = 0,
            curve = "CP2",
            stick = 0,
            s1 = 0,
            degrees = 0,
            collective = 0,
            aileron = 0,
            elevator = 0,
            sentAileron = 0,
            sentElevator = 0,
            rudder = 0,
            sentRudder = 0,
            packName = "",
            packMah = 0,
            lights = lights,
            practice = false,
            practiceRate = 0,
            guard = 0,
            lever = -1,
            swung = -1
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
