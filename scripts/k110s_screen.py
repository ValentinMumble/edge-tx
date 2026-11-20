"""Gives the K110S (model21.yml) one screen, its cockpit (the K110Cockpit widget, laid out as the M2 EVO's) on all of
it, in place of ArmedModel, Timer and FlightState: the top bar kept as it is (FMStatus, Timers, Radio Info, the
clock), no sliders, trims or flight mode bar. The cockpit's option is the pitch range (12° at full collective).
Skips a model that has the cockpit already (deploy.sh runs every script on the radio each time). Backs the file up
first. Usage: k110s_screen.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert re.search(r'^header: ?\n   name: "K110S"\n', text, re.M), 'not the K110S model'

if 'widgetName: "K110Cockpit"' in text:
    print(f'{model}: the cockpit screen is already there')
    sys.exit(0)

found = re.search(r'^screenData: ?\n(?: .*\n)+', text, re.M)
assert found and 'widgetName: "ArmedModel"' in found.group(0), 'no screen with ArmedModel'
assert text.count('widgetName: "K110Cockpit"') == 0


def option(index: int, kind: str, field: str, value: object, indent: int) -> str:
    pad = ' ' * indent
    return f'{pad}{index}:\n{pad}   type: {kind}\n{pad}   value:\n{pad}      {field}: {value}\n'


cockpit = {'PitchRange': 12}
# Top bar on; flight mode bar, sliders, trims and mirroring off.
flags = [True, False, False, False, False]
screens = (
    'screenData:\n   0:\n      LayoutId: Layout1x1\n      layoutData:\n         zones:\n            0:\n'
    '               widgetName: "K110Cockpit"\n               widgetData:\n                  options:\n'
    + ''.join(option(index, 'Signed', 'signedValue', value, 21) for index, value in enumerate(cockpit.values()))
    + '         options:\n'
    + ''.join(option(index, 'Bool', 'boolValue', int(on), 12) for index, on in enumerate(flags))
)
text = text[:found.start()] + screens + text[found.end():]
assert text.count('widgetName: "K110Cockpit"') == 1 and 'widgetName: "ArmedModel"' not in text

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: one cockpit screen (K110Cockpit), the top bar as it was')
