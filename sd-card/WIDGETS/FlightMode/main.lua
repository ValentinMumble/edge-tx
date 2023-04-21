--[[

  == Simple widget to display the flight mode & gyro status.
 
]]

local options = {
  { "Size",    5,      0 },  -- ZoneOption::TextSize
  { "Color",   COLOR,  WHITE },
  { "OffsetX", VALUE,  1, -(LCD_W-1), LCD_W-1 },
  { "OffsetY", VALUE,  1, -(LCD_H-1), LCD_H-1 }
}

local function create(zone, options)
  return { zone = zone, options = options, mname = model.getInfo().name }
end

local function update(self, options)
  self.options = options
end

function refresh(self)
  local sz = bit32.band(bit32.lshift(self.options.Size, 8), 0x0F00);
  local sh = self.options.Shadow == 1 and SHADOWED or 0
  local x = math.min(math.max(0, self.zone.x + self.options.OffsetX), LCD_W-1)
  local y = math.min(math.max(0, self.zone.y + self.options.OffsetY), LCD_H-1)
  lcd.setColor(CUSTOM_COLOR, self.options.Color)
  lcd.drawText(x, y, self.mname, LEFT + CUSTOM_COLOR + sz + sh)
end

return { name="Flight Mode", options=options, create=create, update=update, refresh=refresh }
