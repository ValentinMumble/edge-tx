"""Adds the sortie timer to the M2 EVO (model20.yml): timer 2, "Sortie", counting up the time with the motor on (!L10,
as timer 1) and kept through power cycles (persistent), silent. Timer 1 is the pack's time (the model resets it with each
new pack); the Cockpit widget starts timer 2 again each new day. Skips a model that has it (deploy.sh runs every script
on the radio each time). Backs the file up first. Usage: sortie_timer.py <model20.yml> [<backup folder>]"""
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

timers = text[text.index('timers: \n'):text.index('telemetryProtocol: ')]
if '      name: "Sortie"\n' in timers:
    print(f'{model}: the sortie timer is already there')
    sys.exit(0)
assert '\n   1:\n' not in timers, 'timer 2 is already used'
assert '      swtch: "!L10"\n' in timers, 'timer 1 no longer runs on !L10'

sortie = '''   1:
      start: 0
      swtch: "!L10"
      value: 0
      mode: ON
      countdownBeep: 0
      minuteBeep: 0
      persistent: 1
      countdownStart: 0
      showElapsed: 0
      extraHaptic: 0
      name: "Sortie"
'''
text = text.replace(timers, timers + sortie, 1)

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: timer 2 "Sortie" added (motor-on time, kept through power cycles)')
