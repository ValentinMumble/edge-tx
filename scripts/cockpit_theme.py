"""Gives the radio a dark top bar with readable menus: a theme of its own, "Cockpit", selected in place of FM2M Concrete
(which stays on the card as it was, to go back to in Radio Setup, Themes).

EdgeTX draws the top bar in the theme's SECONDARY1 with PRIMARY2 text, and every menu row, field and button the other
way round: PRIMARY2 with SECONDARY1 text. Concrete is a light grey bar with dark text, so its menus are dark with light
text, and a dark bar alone left them near black on dark grey. Cockpit takes Concrete's greys in the arrangement of FM2M
Vineyard (a dark top bar with light text, light controls with dark text, dark pages): SECONDARY1 near black, PRIMARY2
light grey. What sits on PRIMARY2's light text needs to be dark in turn: the focused control (blue), a value being
edited (dark red), a row that is on, a sensor receiving data say (dark green, Concrete's was light grey under light
text).

Writes THEMES/Cockpit (Concrete's logo, the new colours), and selects it in radio.yml (whose checksum the radio
checks, computed again as six_pos.py does), and in THEMES/selectedtheme.txt where an older card has one. Skips what is
done already. Backs up radio.yml first.
Usage: cockpit_theme.py <card folder> [<backup folder>]"""
import binascii
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
backup = Path(sys.argv[2]) if len(sys.argv) > 2 else None
THEMES = card / 'THEMES'
folder = THEMES / 'Cockpit'

THEME = '''---
summary:
  name: Cockpit
  author: edge-tx, from FM2M Concrete by JimB40
  info: Concrete's greys with a dark top bar.
colors:
 PRIMARY1:   0xA0A0A0
 PRIMARY2:   0xC8C8C8
 PRIMARY3:   0x505050
 SECONDARY1: 0x161616
 SECONDARY2: 0x505050
 SECONDARY3: 0x303030
 FOCUS:      0x2F5F8F
 EDIT:       0x7A2E2E
 ACTIVE:     0x1F4A2C
 WARNING:    0x404040
 DISABLED:   0x808080
'''
SELECTED = '/THEMES/Cockpit/theme.yml'
changed = []

folder.mkdir(exist_ok=True)
theme = folder / 'theme.yml'
wanted = THEME.replace('\n', '\r\n').encode('utf-8')
if not theme.exists() or theme.read_bytes() != wanted:
    theme.write_bytes(wanted)
    changed.append('THEMES/Cockpit/theme.yml written')
logo = folder / 'logo.png'
concrete_logo = THEMES / 'FM2M_Concrete' / 'logo.png'
if not logo.exists() and concrete_logo.exists():
    shutil.copyfile(concrete_logo, logo)
    changed.append('THEMES/Cockpit/logo.png: Concrete\'s')

# An older card names it in THEMES/selectedtheme.txt too; EdgeTX 2.12 keeps it in radio.yml only.
selected = THEMES / 'selectedtheme.txt'
if selected.exists() and selected.read_text() != SELECTED:
    selected.write_text(SELECTED)
    changed.append('THEMES/selectedtheme.txt: Cockpit')

radio = card / 'RADIO' / 'radio.yml'
raw = radio.read_bytes()
data = raw.replace(b'\r\n', b'\n')
newline = b'\r\n' if b'\r\n' in raw else b'\n'
old = b'selectedTheme: "FM2M Concrete"\n'
if old in data:
    assert data.count(old) == 1
    if backup:
        (backup / 'RADIO').mkdir(parents=True, exist_ok=True)
        shutil.copy2(radio, backup / 'RADIO' / radio.name)
    data = data.replace(old, b'selectedTheme: "Cockpit"\n').replace(b'\n', newline)
    first, rest = data.split(b'\n', 1)
    assert first.startswith(b'checksum: ')
    ending = first[len(first.rstrip(b'\r')):]
    radio.write_bytes(f'checksum: {binascii.crc_hqx(rest, 0xFFFF)}'.encode() + ending + b'\n' + rest)
    changed.append('radio.yml: the Cockpit theme selected')
else:
    assert b'selectedTheme: "Cockpit"\n' in data, 'radio.yml selects another theme'

print('\n'.join(changed) if changed else 'Nothing to change: the Cockpit theme is selected already')
