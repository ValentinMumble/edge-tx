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

local function __TS__ArrayForEach(self, callbackFn, thisArg)
    for i = 1, #self do
        callbackFn(thisArg, self[i], i - 1, self)
    end
end

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
    end
    return result
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
local output, clock, look, at, lineHeight, swing, armSwitch, label, dial, curveXs, curveAt, readShapes, objects, update, practiceRate, MODES, LOW_TIME, rgb, INK, MUTED, DIM, LABEL, DIGITS, GREEN, BLUE, AMBER, RED, UNLIT, EDGE, DARK_INK, TOP, BOTTOM, TILE_X, TILE_Y, TILE_W, TILE_H, TILE_STEP, clamp, GUARD_SWING, GUARD_TURN, GUARD_LONG, HINGE, LEVER_FLIP, LEVER_LONG, NUT, ease, toward, round, PLOT_X, PLOT_Y, PLOT_H, plotAt, percentOf
function output(index)
    local value = getOutputValue(index)
    local ____opt_0 = model.getOutput(index)
    return (____opt_0 and ____opt_0.revert) == 1 and -value or value
end
function clock(seconds)
    local whole = math.floor(math.abs(seconds))
    local hours = math.floor(whole / 3600)
    local minutes = math.floor(whole % 3600 / 60)
    local sign = seconds < 0 and "-" or ""
    return hours > 0 and ((sign .. tostring(hours)) .. "h") .. string.format("%02d", minutes) or ((sign .. tostring(minutes)) .. ":") .. string.format("%02d", whole % 60)
end
function look(widget)
    local view = widget.view
    local armed = getValue("sa") == 1024
    view.hold = getValue("sf") ~= -1024
    local mode = getValue("se")
    view.idle = mode <= -512 and 1 or (mode >= 512 and 3 or 2)
    view.motorOff = view.hold or not armed
    view.live = not view.motorOff
    view.stick = getValue("thr")
    view.throttle = (output(2) + 1024) / 2048 * 100
    view.degrees = output(5) / 1024 * (widget.options.PitchRange or 12)
    view.collective = output(5) / 1024 * 100
    view.practice = getValue("sd") >= 1024
    view.practiceRate = view.practice and practiceRate() or 0
    view.aileron = getValue("ail")
    view.elevator = getValue("ele")
    view.sentAileron = output(0)
    view.sentElevator = output(1)
    view.rudder = getValue("rud")
    view.sentRudder = output(3)
    local pack = model.getTimer(0)
    view.start = (pack and pack.start or 0) > 0 and (pack and pack.start) or 240
    view.left = pack and pack.value or view.start
    local ____opt_8 = model.getTimer(1)
    view.sortie = ____opt_8 and ____opt_8.value or 0
    view.rate = view.live and clamp(
        (getOutputValue(8) + 1024) / 2048,
        0,
        1
    ) or 0
    local lights = view.lights
    local function set(index, word, on, color, ink)
        if ink == nil then
            ink = DARK_INK
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
    local rescue = getValue("sh") > 0
    set(
        2,
        "LEVEL",
        getValue("sc") >= 1024 or rescue,
        3896745,
        16777215
    )
    set(
        3,
        "RESCUE",
        rescue,
        9051168,
        16777215
    )
    set(4, "LOW BATT", view.left < LOW_TIME, RED)
    set(
        5,
        "TELE",
        false,
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
    local ____spec_10 = spec
    local x = ____spec_10.centerX
    local y = ____spec_10.centerY
    local radius = ____spec_10.radius
    local function angle(value)
        return -135 + clamp(value, 0, 100) / 100 * 270
    end
    local objects = {}
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
    objects[#objects + 1] = label(
        x,
        y - math.floor(radius * 0.32),
        spec.title,
        SMLSIZE,
        MUTED,
        CENTER
    )
    objects[#objects + 1] = {
        type = "line",
        thickness = 3,
        rounded = true,
        color = rgb(16777215),
        pts = function()
            local needle = angle(spec:value())
            return {
                at(x, y, 9, needle + 180),
                at(x, y, radius - 5, needle)
            }
        end
    }
    objects[#objects + 1] = {
        type = "circle",
        x = x,
        y = y,
        radius = 5,
        filled = true,
        color = rgb(2764080)
    }
    objects[#objects + 1] = {
        type = "circle",
        x = x,
        y = y,
        radius = 5,
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
function readShapes(widget)
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
    local top = 0
    __TS__ArrayForEach(
        MODES,
        function(____, mode, index)
            local curve = curves[mode.curve]
            local shape = widget.shapes[index + 1]
            shape.curve = curve
            if not curve then
                shape.points = {
                    plotAt(-100, mode.fallback * 2 - 100),
                    plotAt(100, mode.fallback * 2 - 100)
                }
                shape.level = mode.fallback
                shape.low = mode.fallback
                shape.high = mode.fallback
            else
                local xs = curveXs(curve)
                local points = {}
                do
                    local point = 0
                    while point < #xs do
                        points[#points + 1] = plotAt(xs[point + 1], curve.y[point + 1])
                        point = point + 1
                    end
                end
                local lowest = curve.y[1]
                local highest = curve.y[1]
                for ____, value in ipairs(curve.y) do
                    lowest = math.min(lowest, value)
                    highest = math.max(highest, value)
                end
                shape.points = points
                shape.level = percentOf(curveAt(curve, 0))
                shape.low = percentOf(lowest)
                shape.high = percentOf(highest)
            end
            if shape.level > widget.shapes[top + 1].level then
                top = index
            end
            local ____temp_11
            if mode.pitch == nil then
                ____temp_11 = nil
            else
                ____temp_11 = curves[mode.pitch]
            end
            local pitch = ____temp_11
            if pitch then
                local xs = curveXs(pitch)
                local points = {}
                do
                    local point = 0
                    while point < #xs do
                        points[#points + 1] = plotAt(xs[point + 1], pitch.y[point + 1])
                        point = point + 1
                    end
                end
                shape.pitch = points
            else
                shape.pitch = {
                    plotAt(-100, -100),
                    plotAt(100, 100)
                }
            end
        end
    )
    local practice = curves.CPP
    widget.practice = practice and __TS__ArrayMap(
        curveXs(practice),
        function(____, across, point) return plotAt(across, practice.y[point + 1]) end
    ) or ({
        plotAt(-100, -100),
        plotAt(100, 100)
    })
    __TS__ArrayForEach(
        MODES,
        function(____, mode, index)
            local shape = widget.shapes[index + 1]
            local ____, lineY = table.unpack(plotAt(
                50,
                shape.curve and curveAt(shape.curve, 50) or mode.fallback * 2 - 100
            ))
            shape.labelY = clamp(lineY + (index == top and -8 or 8), PLOT_Y - PLOT_H, PLOT_Y + PLOT_H)
        end
    )
end
function objects(widget)
    local view = widget.view
    local shapes = widget.shapes
    local list = {
        {
            type = "image",
            x = 0,
            y = 0,
            w = 480,
            h = 227,
            file = "/WIDGETS/K110Cockpit/panel.png"
        },
        {
            type = "image",
            x = 0,
            y = 0,
            w = 480,
            h = 227,
            file = "/WIDGETS/K110Cockpit/panel-live.png",
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
    local function stopY(index)
        return math.floor(BOTTOM - index / 4 * (BOTTOM - TOP))
    end
    local function throttleY(percent)
        local stops = {
            0,
            shapes[1].level,
            shapes[2].level,
            shapes[3].level,
            100
        }
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
        MODES,
        function(____, mode, index)
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
                    mode.word,
                    TINSIZE,
                    function() return current() and GREEN or MUTED end,
                    RIGHT
                ),
                label(
                    30,
                    y + 5,
                    function() return tostring(shapes[index + 1].level) end,
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
            }
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
                color = rgb(stripe % 2 == 0 and AMBER or DARK_INK)
            }
            stripe = stripe + 1
        end
    end
    local ____temp_13 = stopY(0) - 23
    local function ____temp_14()
        return view.hold
    end
    local ____array_12 = __TS__SparseArrayNew(table.unpack(stripes))
    __TS__SparseArrayPush(
        ____array_12,
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
        y = ____temp_13,
        w = 20,
        h = 7,
        visible = ____temp_14,
        children = {__TS__SparseArraySpread(____array_12)}
    }
    list[#list + 1] = label(
        44,
        BOTTOM + 14,
        function() return view.motorOff and "CUT" or tostring(round(view.throttle)) .. "%" end,
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
            local text = mark == 0 and "0" or (mark > 0 and "+" or "") .. tostring(round(mark))
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
    local grip = rgb(12568011)
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
                color = rgb(15856629)
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
        function() return ((view.degrees >= 0 and "+" or "") .. tostring(round(view.degrees))) .. "°" end,
        SMLSIZE,
        DIGITS,
        CENTER
    )
    local ____array_15 = __TS__SparseArrayNew(table.unpack(dial({
        centerX = 226,
        centerY = 117,
        radius = 72,
        title = "PACK",
        value = function() return view.left / view.start * 100 end,
        labels = {{0, "E"}, {50, "1/2"}, {100, "F"}}
    })))
    __TS__SparseArrayPush(
        ____array_15,
        label(
            226,
            147,
            function() return clock(view.left) end,
            0,
            function() return view.left < LOW_TIME and rgb(RED) or DIGITS end,
            CENTER
        ),
        label(
            226,
            162,
            function() return view.live and "x" .. string.format("%.2f", view.rate) or "stopped" end,
            SMLSIZE,
            function() return view.live and DIGITS or MUTED end,
            CENTER
        ),
        label(
            226,
            210,
            function() return "Sortie " .. clock(view.sortie) end,
            SMLSIZE,
            LABEL,
            CENTER
        )
    )
    __TS__ArrayPush(
        list,
        __TS__SparseArraySpread(____array_15)
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
            "1S",
            SMLSIZE,
            MUTED
        )
    )
    local function flown()
        return shapes[view.idle]
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
        ),
        label(
            402,
            99,
            function() return MODES[view.idle].word end,
            TINSIZE,
            DIGITS,
            RIGHT
        )
    )
    __TS__ArrayForEach(
        shapes,
        function(____, shape)
            list[#list + 1] = {
                type = "line",
                thickness = 1,
                color = DIM,
                pts = function() return shape.points end
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
            pts = function() return flown().points end
        },
        {
            type = "line",
            thickness = 2,
            rounded = true,
            color = BLUE,
            pts = function() return view.practice and view.idle ~= 1 and widget.practice or flown().pitch end
        }
    )
    __TS__ArrayForEach(
        MODES,
        function(____, mode, index)
            local shape = shapes[index + 1]
            local word = label(
                382,
                shape.labelY,
                mode.word,
                TINSIZE,
                function() return view.idle == index + 1 and GREEN or MUTED end,
                CENTER
            )
            list[#list + 1] = __TS__ObjectAssign(
                {},
                word,
                {pos = function() return word.x, shape.labelY - 6 end}
            )
        end
    )
    __TS__ArrayPush(
        list,
        {
            type = "circle",
            x = PLOT_X,
            y = PLOT_Y,
            radius = 3,
            filled = true,
            color = rgb(16777215),
            visible = function() return flown().curve ~= nil end,
            pos = function()
                local curve = flown().curve
                local across = view.stick / 1024 * 100
                return table.unpack(plotAt(
                    across,
                    curve and curveAt(curve, across) or 0
                ))
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
                local shape = flown()
                if not shape.curve then
                    return "no curve"
                end
                return shape.low == shape.high and tostring(shape.level) .. "%" or ((tostring(shape.low) .. "-") .. tostring(shape.high)) .. "%"
            end,
            TINSIZE,
            function() return view.practice and BLUE or DIGITS end,
            CENTER
        )
    )
    __TS__ArrayForEach(
        MODES,
        function(____, mode, index)
            local y = TILE_Y + index * TILE_STEP
            local function picked()
                return view.idle == index + 1
            end
            __TS__ArrayPush(
                list,
                {
                    type = "rectangle",
                    x = TILE_X,
                    y = y,
                    w = TILE_W,
                    h = TILE_H,
                    filled = true,
                    color = GREEN,
                    visible = picked
                },
                {
                    type = "rectangle",
                    x = TILE_X,
                    y = y,
                    w = TILE_W,
                    h = TILE_H,
                    color = EDGE,
                    visible = picked
                },
                label(
                    TILE_X + 5,
                    y + 9,
                    mode.word,
                    SMLSIZE,
                    function() return picked() and rgb(DARK_INK) or MUTED end
                ),
                label(
                    TILE_X + TILE_W - 4,
                    y + 10,
                    function() return tostring(shapes[index + 1].level) .. "%" end,
                    TINSIZE,
                    function() return picked() and rgb(DARK_INK) or DIM end,
                    RIGHT
                )
            )
        end
    )
    local function percent(value)
        return (value >= 0 and "+" or "") .. tostring(round(value / 1024 * 100))
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
    readShapes(widget)
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
local name = "K110Cockpit"
--- The K110S's whole screen (480 × 227, under the top bar), laid out exactly as the M2 EVO's Cockpit so nothing moves
-- when switching models: each place shows the same thing, or the K110S's nearest one, as it has no telemetry.
-- - The warning lights in the Cockpit's slots: SAFE (green) or ARMED (SA down), THR ON or OFF (SF), LEVEL (SC down,
--   6G self-level), RESCUE while SH is held (k110s_rescue.py: 6G, then a climb), TELE always dark (it has no
--   telemetry), LOW BATT once the Pack timer has under 30 s left;
--   the panel turns dark red while the motor can spin.
-- - The throttle as a quadrant: a detent per idle up (LOW, IU2, IU3, at the throttle each gives at mid stick, from the
--   model's curves), CUT at its foot guarded in hold, the lever at the motor output (CH3); the collective at CH6
--   against a degree scale.
-- - The Pack timer (timer 1, counting down from 4:00 as fast as CH9 says: a second a second at 90 % throttle) as the
--   fuel gauge, the time left in its window and how fast it counts under it; the sortie (timer 2) under the gauge.
-- - The data plate; the throttle curves where the Cockpit draws its pitch curve (Low RPM, IU2 and IU3, the one SE
--   picks lit, with a dot at the throttle stick), and that idle up's pitch curve over them in blue (CPL in Low RPM,
--   the stick straight in IU2 and IU3), with a dot at the pitch sent; the idle ups as three tiles where the Cockpit
--   has its cell gauge, in SE's order (LOW up, IU2 middle, IU3 down), the one picked lit; the cyclic and the rudder.
-- Built as the Cockpit is, from EdgeTX's LVGL objects over two pictures of what never moves (scripts/cockpit-panel.mjs
-- draws both widgets' panels at the same positions); the curves are read again once a second, so a change made on the
-- radio shows.
local options = {{
    "PitchRange",
    VALUE,
    12,
    1,
    20
}}
MODES = {{word = "LOW", curve = "Low", fallback = 60, pitch = "CPL"}, {word = "IU2", curve = "IU2", fallback = 80}, {word = "IU3", curve = "IU3", fallback = 90}}
LOW_TIME = 30
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
DARK_INK = 1315860
TOP = 55
BOTTOM = 198
TILE_X = 412
TILE_Y = 92
TILE_W = 60
TILE_H = 19
TILE_STEP = 21
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
round = function(value) return math.floor(value + 0.5) end
PLOT_X = 363
PLOT_Y = 157
local PLOT_W = 38
PLOT_H = 44
plotAt = function(across, up) return {
    PLOT_X + math.floor(clamp(across, -100, 100) / 100 * PLOT_W + 0.5),
    PLOT_Y - math.floor(clamp(up, -100, 100) / 100 * PLOT_H + 0.5)
} end
percentOf = function(value) return round((value + 100) / 2) end
local function create(zone, options)
    local lights = {}
    do
        local index = 0
        while index < 6 do
            lights[#lights + 1] = {word = "", on = false, color = 0, ink = 0}
            index = index + 1
        end
    end
    local shapes = __TS__ArrayMap(
        MODES,
        function(____, mode) return {
            points = {},
            pitch = {},
            labelY = PLOT_Y,
            level = mode.fallback,
            low = mode.fallback,
            high = mode.fallback
        } end
    )
    local widget = {
        zone = zone,
        options = options,
        shapes = shapes,
        practice = {},
        since = getTime(),
        view = {
            live = false,
            motorOff = true,
            hold = true,
            idle = 2,
            throttle = 0,
            stick = 0,
            degrees = 0,
            collective = 0,
            aileron = 0,
            elevator = 0,
            sentAileron = 0,
            sentElevator = 0,
            rudder = 0,
            sentRudder = 0,
            left = 240,
            start = 240,
            rate = 0,
            sortie = 0,
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
local function refresh(widget)
    look(widget)
    local now = getTime()
    if now - widget.since >= 100 then
        widget.since = now
        readShapes(widget)
    end
end
local useLvgl = true
____exports.refresh = refresh
____exports.name = name
____exports.create = create
____exports.update = update
____exports.options = options
____exports.useLvgl = useLvgl
return ____exports
