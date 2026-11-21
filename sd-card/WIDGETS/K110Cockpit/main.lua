-- Lua Library inline imports
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
local output, clock, look, at, lineHeight, label, dial, curveXs, curveAt, readShapes, objects, update, MODES, LOW_TIME, rgb, INK, MUTED, DIM, LABEL, DIGITS, GREEN, BLUE, AMBER, RED, UNLIT, EDGE, DARK_INK, TOP, BOTTOM, TILE_X, TILE_Y, TILE_W, TILE_H, TILE_STEP, clamp, round, PLOT_X, PLOT_Y, PLOT_H, plotAt, percentOf
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
    view.aileron = getValue("ail")
    view.elevator = getValue("ele")
    view.sentAileron = output(0)
    view.sentElevator = output(1)
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
                    return "PRACTICE"
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
    __TS__ArrayPush(
        list,
        {
            type = "circle",
            x = 442,
            y = 182,
            radius = 4,
            color = MUTED,
            pos = function() return 442 + math.floor(clamp(view.aileron, -1024, 1024) / 1024 * 20), 182 - math.floor(clamp(view.elevator, -1024, 1024) / 1024 * 20) end
        },
        {
            type = "circle",
            x = 442,
            y = 182,
            radius = 3,
            filled = true,
            color = GREEN,
            pos = function() return 442 + math.floor(clamp(view.sentAileron, -1024, 1024) / 1024 * 20), 182 - math.floor(clamp(view.sentElevator, -1024, 1024) / 1024 * 20) end
        },
        label(
            442,
            213,
            function() return (("A" .. percent(view.sentAileron)) .. " E") .. percent(view.sentElevator) end,
            TINSIZE,
            DIGITS,
            CENTER
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
local name = "K110Cockpit"
--- The K110S's whole screen (480 × 227, under the top bar), laid out exactly as the M2 EVO's Cockpit so nothing moves
-- when switching models: each place shows the same thing, or the K110S's nearest one, as it has no telemetry.
-- - The warning lights in the Cockpit's slots: SAFE (green) or ARMED (SA down), THR ON or OFF (SF), LEVEL (SC down,
--   6G self-level), RESCUE while SH is held (k110s_rescue.py: 6G, then a climb), TELE always dark (it has no
--   telemetry), LOW BATT once the Pack timer has under 30 s left;
--   the panel turns dark yellow while the motor can spin.
-- - The throttle as a quadrant: a detent per idle up (LOW, IU2, IU3, at the throttle each gives at mid stick, from the
--   model's curves), CUT at its foot guarded in hold, the lever at the motor output (CH3); the collective at CH6
--   against a degree scale.
-- - The Pack timer (timer 1, counting down from 4:00 as fast as CH9 says: a second a second at 90 % throttle) as the
--   fuel gauge, the time left in its window and how fast it counts under it; the sortie (timer 2) under the gauge.
-- - The data plate; the throttle curves where the Cockpit draws its pitch curve (Low RPM, IU2 and IU3, the one SE
--   picks lit, with a dot at the throttle stick), and that idle up's pitch curve over them in blue (CPL in Low RPM,
--   the stick straight in IU2 and IU3), with a dot at the pitch sent; the idle ups as three tiles where the Cockpit
--   has its cell gauge, in SE's order (LOW up, IU2 middle, IU3 down), the one picked lit; the cyclic.
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
TOP = 42
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
            left = 240,
            start = 240,
            rate = 0,
            sortie = 0,
            lights = lights,
            practice = false
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
