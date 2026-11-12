"""Gives the radio's menus their readable text back. EdgeTX paints both the top bar and the text of every menu row,
button and field in the theme's SECONDARY1, over the controls' PRIMARY2 (0x202020 in FM2M Concrete, the radio's
theme). A very dark top bar (0x161616) made that text near black on dark grey, so SECONDARY1 goes back to the theme's
own mid grey (0x808080), and the M2 EVO's clock in the top bar back to the theme's dark text colour (COLIDX1), which
reads on it.

Skips what is done already. Usage: readable_menus.py <card folder>"""
import re
import sys
from pathlib import Path

card = Path(sys.argv[1])
GREY = '0x808080'
changed = []


def rewrite(path: Path, change) -> None:
    raw = path.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = raw.replace('\r\n', '\n')
    updated = change(text)
    if updated != text:
        path.write_bytes(updated.replace('\n', newline).encode('utf-8'))


def theme(text: str) -> str:
    found = re.search(r'^ SECONDARY1: (0x[0-9A-Fa-f]{6})$', text, re.M)
    assert found, 'the theme has no SECONDARY1'
    if found.group(1).lower() == GREY:
        return text
    changed.append(f'theme: the top bar and the menus\' text from {found.group(1)} to {GREY}')
    return text.replace(found.group(0), f' SECONDARY1: {GREY}')


def clock(text: str) -> str:
    old = ('         widgetName: "Date Time"\n         widgetData: \n            options: \n               0:\n'
           '                  type: Color\n                  value: \n                     color: COLIDX0\n')
    if old not in text:
        return text
    assert text.count(old) == 1
    changed.append('model20.yml: the clock in the theme\'s dark text colour')
    return text.replace(old, old.replace('color: COLIDX0', 'color: COLIDX1'))


rewrite(card / 'THEMES' / 'FM2M_Concrete' / 'theme.yml', theme)
rewrite(card / 'MODELS' / 'model20.yml', clock)
print('\n'.join(changed) if changed else 'Nothing to change: the menus are readable already')
