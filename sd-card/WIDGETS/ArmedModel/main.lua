local ____exports = {}
local update
function update(widget, options)
    widget.options = options
end
local name = "Armed Model"
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
    if isArmed then
        lcd.drawFilledRectangle(
            0,
            0,
            w,
            h,
            COLOR_THEME_WARNING
        )
    end
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
