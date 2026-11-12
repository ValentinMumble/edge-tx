"""Adds a low-cell alarm to the M2 EVO model (model20.yml): logical switch L15 is on when VFAS stays under 10.50 V
(3.50 V a cell on 3S) for 2 seconds, and special functions 13 and 14 play "low battery" and vibrate every 15 seconds
while it is on. Backs the file up first. Usage: cell_alarm.py <model20.yml> [<backup folder>]"""
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'
assert 'label: "VFAS"' in text, 'no VFAS sensor'

# Already there (the repo's card has it, and deploy.sh runs every script on the radio each time): nothing to do.
if '      func: FUNC_VNEG\n      def: "tele(5),1050"\n' in text and '      def: "lowbat,1,15"\n' in text:
    print(f'{model}: the low-cell alarm is already there')
    sys.exit(0)

# VFAS must be telemetry sensor 5 with 2 decimals, so 1050 means 10.50 V.
sensors = text[text.index('telemetrySensors: \n'):text.index('screenData: \n')]
fifth = sensors[sensors.index('   5:\n'):sensors.index('   6:\n')]
assert 'label: "VFAS"' in fifth and 'prec: 2' in fifth, fifth

switches = text[text.index('logicalSw: \n'):text.index('customFn: \n')]
functions = text[text.index('customFn: \n'):text.index('flightModeData: \n')]
assert '\n   14:\n' not in switches, 'L15 is already used'
assert '\n   12:\n' not in functions and '\n   13:\n' not in functions, 'special functions 13 or 14 are already used'

last_switch = '''   13:
      func: FUNC_AND
      def: "L4,L5"
      andsw: "NONE"
      lsPersist: 0
      lsState: 0
      delay: 0
      duration: 0
customFn: 
'''
low_cell = '''   14:
      func: FUNC_VNEG
      def: "tele(5),1050"
      andsw: "NONE"
      lsPersist: 0
      lsState: 0
      delay: 20
      duration: 0
'''
last_function = '''   11:
      swtch: "TELEMETRY_STREAMING"
      func: LOGS
      def: "2,1"
flightModeData: 
'''
alarm = '''   12:
      swtch: "L15"
      func: PLAY_TRACK
      def: "lowbat,1,15"
   13:
      swtch: "L15"
      func: HAPTIC
      def: "3,1,15"
'''
assert text.count(last_switch) == 1, 'logical switches changed since the backup'
assert text.count(last_function) == 1, 'special functions changed since the backup'
text = text.replace(last_switch, last_switch.replace('customFn: \n', low_cell + 'customFn: \n'))
text = text.replace(last_function, last_function.replace('flightModeData: \n', alarm + 'flightModeData: \n'))

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: L15 and special functions 13 and 14 added')
