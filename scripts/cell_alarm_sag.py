"""Keeps the M2 EVO's low-cell alarm (model20.yml, L15: "low battery" and a vibration every 15 s) for a pack that is
really running out, not one pulled hard: a 500 to 750 mAh 3S pack drawing 15 to 20 A sags under 3.5 V a cell when still
half full, and set at 10.50 V for 2 s (cell_alarm.py) the alarm went off on every pack of 12 Nov 2026, for up to 85 s.
L15 now wants VFAS under 9.90 V (3.30 V a cell) for 5 s: on that day's logs, it would have gone off only on the two
packs that ran weak. The % left, said every 10% by the Cockpit, tells when to land. Skips a model already changed
(deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: cell_alarm_sag.py <model20.yml> [<backup folder>]"""
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

OLD = (
    '   14:\n      func: FUNC_VNEG\n      def: "tele(5),1050"\n      andsw: "L17"\n'
    '      lsPersist: 0\n      lsState: 0\n      delay: 20\n'
)
# VFAS is telemetry sensor 5 with 2 decimals (990 is 9.90 V), the delay in tenths of a second.
NEW = (
    '   14:\n      func: FUNC_VNEG\n      def: "tele(5),990"\n      andsw: "L17"\n'
    '      lsPersist: 0\n      lsState: 0\n      delay: 50\n'
)

switches = text[text.index('logicalSw: \n'):text.index('customFn: \n')]
if NEW in switches:
    print(f'{model}: the low-cell alarm already waits for real sag')
    sys.exit(0)
assert switches.count(OLD) == 1, 'L15 is not the low-cell alarm of cell_alarm.py and cell_alarm_live.py'
text = text.replace(switches, switches.replace(OLD, NEW), 1)

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: the low-cell alarm now at 9.90 V (3.30 V a cell) for 5 s')
