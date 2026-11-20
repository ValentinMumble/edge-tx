"""Makes the M2 EVO's failsafe cut the motor (model20.yml). It was HOLD: on a lost link the R-XSR kept sending the last
sticks and throttle, so the heli flew on with the motor running and nobody at the sticks. Now CUSTOM: CH3 goes to what
it sends while the motor is off (the HLD curve, -100 %, reversed: +100 %, 1024), every other channel holds its last
value (EdgeTX's 2000), so the controller's mode and gyro stay as they were. The receiver keeps the last frame for about
a second before failsafe starts, so a short glitch does not stop the motor. The radio writes the file with a space
after a key that opens a block, the repo without: both are read. Skips a model already changed (deploy.sh runs every
script on the radio each time). Backs the file up first.
Usage: m2evo_failsafe.py <model20.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

HOLD = 2000
MOTOR_OFF = 1024
CHANNELS = 16

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert re.search(r'^   name: "M2 EVO" *$', text, re.M), 'not the M2 EVO model'

VALUES = ''.join(
    f'   {channel}:\n      val: {MOTOR_OFF if channel == 2 else HOLD}\n' for channel in range(CHANNELS)
)
BLOCK = 'failsafeChannels:\n' + VALUES

mode = re.search(r'^      failsafeMode: (\w+) *$', text, re.M)
assert mode and text.count('failsafeMode:') == 1, 'not one module with a failsafe'
if mode.group(1) == 'CUSTOM' and re.search(r'^failsafeChannels: *\n' + re.escape(VALUES), text, re.M):
    print(f'{model}: the failsafe already cuts the motor')
    sys.exit(0)
assert mode.group(1) == 'HOLD', f'the failsafe is {mode.group(1)}, not HOLD as this script expects'
assert not re.search(r'^failsafeChannels:', text, re.M), 'failsafe values already there, not as this script makes them'

text = text[: mode.start(1)] + 'CUSTOM' + text[mode.end(1) :]
# The values go where the radio writes them: after the modules, before the trainer.
trainer = re.search(r'^trainerData: *\n', text, re.M)
assert trainer, 'no trainerData in the model'
text = text[: trainer.start()] + BLOCK + text[trainer.start() :]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: on a lost link the motor stops (CH3 at its hold value), the rest holds')
