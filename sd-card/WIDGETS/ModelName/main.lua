--[[

  == Simple widget to display the current model name.
 
  --------------------------------------------------------
  Copyright (c)2018 by Maxim Paperno. All rights reserved.
  This program is released under the terms of the GNU General Public License (GPL) as published by
  the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
  This program is distributed WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GPL for more details.
  You should have received a copy of the GPL along with this program. If not, see <https://www.gnu.org/licenses/>.
]]

local options = {
  { "Size",    5,      0 },  -- ZoneOption::TextSize
  { "Color",   COLOR,  WHITE },
  { "Shadow",  BOOL,   1 },
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

return { name="Model Name", options=options, create=create, update=update, refresh=refresh }
