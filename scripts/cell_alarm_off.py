"""Turns off the M2 EVO's own low-cell alarm (model20.yml: special functions 13 and 14, "low battery" and a vibration
every 15 s while L15 is on): the Cockpit widget warns instead. L15 waits for VFAS under 9.90 V for 5 s in a row
(cell_alarm_sag.py), and a pack pulled hard dips under that for a second or two at a time, so on the logs of 12 and
13 Nov 2026 it went off on 4 packs of 10, where the Cockpit, adding up the seconds under 3.30 V a cell, does on 9.
The functions stay in the model, unticked (their active flag at 0), and L15 too. Skips a model already changed
(deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: cell_alarm_off.py <model20.yml> [<backup folder>]"""
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

# The second field of a function's def is its active flag ("name,active,repeat").
ON = (
    '   12:\n      swtch: "L15"\n      func: PLAY_TRACK\n      def: "lowbat,1,15"\n'
    '   13:\n      swtch: "L15"\n      func: HAPTIC\n      def: "3,1,15"\n'
)
OFF = ON.replace('"lowbat,1,15"', '"lowbat,0,15"').replace('"3,1,15"', '"3,0,15"')

functions = text[text.index('customFn: \n'):text.index('flightModeData: \n')]
if OFF in functions:
    print(f'{model}: the model\'s low-cell alarm is already off')
    sys.exit(0)
assert functions.count(ON) == 1, 'special functions 13 and 14 are not the low-cell alarm of cell_alarm.py'
text = text.replace(functions, functions.replace(ON, OFF), 1)

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: the model\'s low-cell alarm is off, the Cockpit warns instead')
