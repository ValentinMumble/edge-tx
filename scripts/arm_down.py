"""Arms the M2 EVO (model20.yml) with SA down instead of up: L5 ("disarmed") becomes "SA not down", the "armed" and
"disarmed" sounds follow SA down, and the start-up switch check wants SA up (disarmed) instead of down. Skips a model
already changed (deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: arm_down.py <model20.yml> [<backup folder>]"""
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

CHANGES = [
    # L5, disarmed: SA over -1 % (middle or down) becomes SA under 1 % (up or middle).
    ('   4:\n      func: FUNC_VPOS\n      def: "SA,-1"\n', '   4:\n      func: FUNC_VNEG\n      def: "SA,1"\n'),
    # The sounds: "armed" when SA reaches down (SA2), "disarmed" when it leaves it.
    (
        '      swtch: "SA0"\n      func: PLAY_TRACK\n      def: "armed,1,1x"\n',
        '      swtch: "SA2"\n      func: PLAY_TRACK\n      def: "armed,1,1x"\n',
    ),
    (
        '      swtch: "!SA0"\n      func: PLAY_TRACK\n      def: "disarm,1,1x"\n',
        '      swtch: "!SA2"\n      func: PLAY_TRACK\n      def: "disarm,1,1x"\n',
    ),
    # At start-up the radio wants SA disarmed: up now.
    ('switchWarning: \n   SA:\n      pos: down\n', 'switchWarning: \n   SA:\n      pos: up\n'),
]

if all(new in text for _, new in CHANGES):
    print(f'{model}: SA already arms down')
    sys.exit(0)
for old, new in CHANGES:
    assert text.count(old) == 1, f'{model}: not as expected, so not changed: {old!r}'
    text = text.replace(old, new)

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: SA arms down (L5, the SA sounds, the start-up check)')
