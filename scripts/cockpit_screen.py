"""Gives the M2 EVO (model20.yml) one screen, the Cockpit widget on all of it, in place of its two: the top bar kept,
no sliders, trims or flight mode bar. The cockpit's options are the idle ups' throttles (54, 58 and 75 %) and the
pitch range (12° at full collective).

Its top bar becomes FMStatus (the idle up, or RESCUE), Session (packs today) and Link (link quality), then Radio Info
and the clock as they were. Timer2 goes (timer 1 is on the cockpit), and so does BattAnalog (the radio's battery is in
Radio Info).

Skips a model that has the cockpit already. Usage: cockpit_screen.py <model20.yml>"""
import re
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

if 'widgetName: "Cockpit"' in text:
    print(f'{model}: the cockpit screen is already there')
    sys.exit(0)


def block(key: str) -> str:
    """A top-level key's whole block, as the file has it: its line and every indented line under it."""
    found = re.search(rf'^{key}: \n(?: .*\n)+', text, re.M)
    assert found, f'no {key}'
    return found.group(0)


def option(index: int, kind: str, field: str, value: object, indent: int) -> str:
    pad = ' ' * indent
    return f'{pad}{index}:\n{pad}   type: {kind}\n{pad}   value:\n{pad}      {field}: {value}\n'


cockpit = {'Idle1': 54, 'Idle2': 58, 'Idle3': 75, 'PitchRange': 12}
# Top bar on; flight mode bar, sliders, trims and mirroring off.
flags = [True, False, False, False, False]
screens = (
    'screenData: \n   0:\n      LayoutId: Layout1x1\n      layoutData:\n         zones:\n            0:\n'
    '               widgetName: "Cockpit"\n               widgetData:\n                  options:\n'
    + ''.join(option(index, 'Signed', 'signedValue', value, 21) for index, value in enumerate(cockpit.values()))
    + '         options:\n'
    + ''.join(option(index, 'Bool', 'boolValue', int(on), 12) for index, on in enumerate(flags))
)

# The top bar's zones as the file has them, each kept whole where it stays.
topbar = block('topbarData')
zones = {
    match.group(2): match.group(3)
    for match in re.finditer(r'^      (\d+):\n         widgetName: "([^"]+)"\n((?:         .*\n)*)', topbar, re.M)
}
for kept in ('FMStatus', 'Radio Info', 'Date Time'):
    assert kept in zones, f'the top bar has no {kept}'


def zone(index: int, name: str, rest: str) -> str:
    return f'      {index}:\n         widgetName: "{name}"\n{rest}'


empty = '         widgetData:\n            options:\n'
new_topbar = (
    'topbarData: \n   zones: \n'
    + zone(0, 'FMStatus', zones['FMStatus'])
    + zone(1, 'Session', empty)
    + zone(2, 'Link', empty)
    + zone(4, 'Radio Info', zones['Radio Info'])
    + zone(5, 'Date Time', zones['Date Time'])
)

old_screens = block('screenData')
assert text.count(old_screens) == 1 and text.count(topbar) == 1
text = text.replace(old_screens, screens).replace(topbar, new_topbar)
assert text.count('widgetName: "Cockpit"') == 1 and 'widgetName: "Timer2"' not in text
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: one cockpit screen; top bar FMStatus, Session, Link, Radio Info, Date Time')
