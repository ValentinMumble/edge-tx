"""Softens the K110S's rescue climb (model21.yml, the "Climb" pitch line on CH6 while SH is held, k110s_rescue.py) from
+60 % to +40 % pitch: on 24 Nov 2026 the rescue in IU2 was too strong, the tail lost its hold, as on a full punch. That
day's logs hovered IU2 at +16 % pitch and Low RPM at +27 %, so +40 % still climbs in every idle up, by much less in
IU2. Skips a model already changed (deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: k110s_rescue_softer.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert re.search(r'^   name: "K110S" *$', text, re.M), 'not the K110S model'

climb = re.search(r'^ -\n   destCh: 5 *\n(?:   .*\n)*?   name: "Climb" *\n', text, re.M)
assert climb and '   swtch: "L9"\n' in climb.group(0), 'no Climb line on CH6 on the rescue (L9)'
if '   weight: 40\n' in climb.group(0):
    print(f'{model}: the rescue already climbs at +40 %')
    sys.exit(0)
assert '   weight: 60\n' in climb.group(0), 'the rescue does not climb at +60 %'
text = text[: climb.start()] + climb.group(0).replace('   weight: 60\n', '   weight: 40\n', 1) + text[climb.end() :]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: the rescue climbs at +40 %')
