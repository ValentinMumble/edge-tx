"""Sets the K110S's failsafe (model21.yml, the internal module) back to "No pulses": binding it on 23 Nov 2026 left it
"not set", and the radio warns of that each time the model loads. On a lost link the module stops sending, and the
heli's own board decides what to do. Skips a model already changed (deploy.sh runs every script on the radio each
time). Backs the file up first.
Usage: k110s_failsafe.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert re.search(r'^   name: "K110S" *$', text, re.M), 'not the K110S model'

module = re.search(r'^moduleData: *\n   0: *\n((?:      .*\n)*)', text, re.M)
assert module and re.search(r'^      type: TYPE_MULTIMODULE *$', module.group(1), re.M), 'module 1 is not the multi-module'
if re.search(r'^      failsafeMode: NOPULSES *$', module.group(1), re.M):
    print(f'{model}: the failsafe is already No pulses')
    sys.exit(0)
assert re.search(r'^      failsafeMode: NOT_SET *$', module.group(1), re.M), 'the failsafe is set to something else'
body = re.sub(r'^      failsafeMode: NOT_SET( *)$', r'      failsafeMode: NOPULSES\1', module.group(1), count=1, flags=re.M)
text = text[: module.start(1)] + body + text[module.end(1) :]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: the failsafe is No pulses')
