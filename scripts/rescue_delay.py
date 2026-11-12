"""Shortens the M2 EVO's flat pitch at the start of a rescue (model20.yml). On SH, its "Flat" mix sets the collective to
0 at once, so an inverted heli gets no thrust the wrong way while the flight controller turns it upright; the "Resq1" to
"Resq3" mixes (one an idle up) bring the climb after their delay. At 0.2 s (delayUp 2, tenths of a second) an upright
heli dropped a little before climbing (the logs of 12 Nov 2026: 0° for a sample, then +7°): their delay becomes 0.1 s.
Skips a model already changed (deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: rescue_delay.py <model20.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

start = text.index('mixData: \n')
end = text.index('limitData: \n', start)
mixes = re.split(r'(?m)^(?= -\n)', text[start:end])
rescues = [index for index, mix in enumerate(mixes) if re.search(r'^   name: "Resq[123]"$', mix, re.M)]
assert len(rescues) == 3, f'{len(rescues)} rescue mixes, not 3'

delays = [re.search(r'^   delayUp: (\d+)$', mixes[index], re.M) for index in rescues]
assert all(delays), 'a rescue mix has no delayUp'
if all(found.group(1) == '1' for found in delays):
    print(f'{model}: the rescue climbs after 0.1 s already')
    sys.exit(0)
assert all(found.group(1) == '2' for found in delays), 'the rescue mixes do not all wait 0.2 s'
for index in rescues:
    mixes[index] = mixes[index].replace('   delayUp: 2\n', '   delayUp: 1\n', 1)
text = text[:start] + ''.join(mixes) + text[end:]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: the rescue climbs after 0.1 s (Resq1 to Resq3), not 0.2 s')
