"""Keeps the M2 EVO's low-cell alarm (model20.yml, L15 with special functions 13 and 14: "low battery" and a vibration
every 15 s) for a pack that is really there: a new logical switch L17 is on while VFAS reads over 1.00 V, and L15 needs
it (its AND switch). Without it, a link that streams no voltage reads VFAS 0, under 10.50 V, and the alarm goes off for
the whole session. Skips a model already changed (deploy.sh runs every script on the radio each time). Backs the file up
first. Usage: cell_alarm_live.py <model20.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

LOW_CELL = '   14:\n      func: FUNC_VNEG\n      def: "tele(5),1050"\n      andsw: "NONE"\n'
LIVE_LOW_CELL = '   14:\n      func: FUNC_VNEG\n      def: "tele(5),1050"\n      andsw: "L17"\n'
PACK_IN = '''   16:
      func: FUNC_VPOS
      def: "tele(5),100"
      andsw: "NONE"
      lsPersist: 0
      lsState: 0
      delay: 0
      duration: 0
'''

switches = text[text.index('logicalSw: \n'):text.index('customFn: \n')]
# Its threshold may have moved since (cell_alarm_sag.py): L15 needing L17 says it ran.
NEEDS_PACK = r'^   14:\n      func: FUNC_VNEG\n      def: "tele\(5\),\d+"\n      andsw: "L17"\n'
if re.search(NEEDS_PACK, switches, re.M) and PACK_IN in switches:
    print(f'{model}: the low-cell alarm already needs a pack in')
    sys.exit(0)
assert switches.count(LOW_CELL) == 1, 'L15 is not the low-cell alarm cell_alarm.py added'
assert '\n   16:\n' not in switches, 'L17 is already used'

# VFAS is telemetry sensor 5 with 2 decimals, so 100 means 1.00 V. L17 goes last, after L16.
updated = switches.replace(LOW_CELL, LIVE_LOW_CELL) + PACK_IN
text = text.replace(switches, updated, 1)

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: L17 (VFAS over 1.00 V) added, and L15 (low cell) now needs it')
