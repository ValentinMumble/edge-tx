"""Puts the Timers widget (this pack's time and the sortie's) in the M2 EVO's top bar (model20.yml), in its empty zone 3
between Link and Radio Info: the Cockpit no longer shows them. Skips a model that has it already (deploy.sh runs every
script on the radio each time). Backs the file up first.
Usage: topbar_timers.py <model20.yml> [<backup folder>]"""
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

if 'widgetName: "Timers"' in text:
    print(f'{model}: the timers are in the top bar already')
    sys.exit(0)

topbar = text[text.index('topbarData: \n'):text.index('topbarWidgetWidth:')]
assert '\n      3:\n' not in topbar, "the top bar's zone 3 is taken"
# Zone 4 (Radio Info) follows the empty zone 3: the timers go just before it.
anchor = '      4:\n         widgetName: "Radio Info"\n'
assert topbar.count(anchor) == 1, 'no Radio Info in zone 4'
updated = topbar.replace(anchor, '      3:\n         widgetName: "Timers"\n         widgetData: \n' + anchor)
text = text.replace(topbar, updated, 1)

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: the Timers widget in the top bar, between Link and Radio Info')
