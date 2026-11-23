"""Makes the K110S's Pack timer (model21.yml, timer 1, 4:00 down while the motor may run) count real flying time, where
it counted by throttle (THR_REL on CH9, a second a second at 90 %, about two thirds of one in Low RPM): it showed 3:17
for a flight of 4:36 on 23 Nov 2026, which misled, and that day's logs hovered every idle up at about the same pitch,
so the head speed, and the pack's drain, barely change with the idle up. The pack faded near the end of that flight:
4:00 of real flying leaves a margin. CH9 (the throttle the timer followed) stays, unused. Skips a model already
changed (deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: k110s_timer_real.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert re.search(r'^   name: "K110S" *$', text, re.M), 'not the K110S model'

pack = re.search(r'^timers: *\n   0: *\n((?:      .*\n)*)', text, re.M)
assert pack and re.search(r'^      name: "Pack" *$', pack.group(1), re.M), 'timer 1 is not the Pack timer'
assert re.search(r'^      start: 240 *$', pack.group(1), re.M), 'the Pack timer does not start at 4:00'
if re.search(r'^      mode: ON *$', pack.group(1), re.M):
    print(f'{model}: the Pack timer already counts real time')
    sys.exit(0)
assert re.search(r'^      mode: THR_REL *$', pack.group(1), re.M), 'the Pack timer does not count by throttle'
body = re.sub(r'^      mode: THR_REL( *)$', r'      mode: ON\1', pack.group(1), count=1, flags=re.M)
text = text[: pack.start(1)] + body + text[pack.end(1) :]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: the Pack timer counts real flying time, 4:00 down')
