"""Puts the K110S model on the radio's card: MODELS/model21.yml and its picture IMAGES/K110S.png from the repo's card,
and its line in MODELS/labels.yml (the radio's list of models). A card that already has a model named K110S keeps it
(deploy.sh runs every script on the radio each time, and the radio may have changed it since): changes to it go through
the repo's model21.yml, copied over it by hand. Stops if model21.yml on the card is another model.
Usage: k110s_model.py <card folder>"""
import re
import shutil
import sys
from pathlib import Path

card = Path(sys.argv[1])
repo = Path(__file__).resolve().parent.parent / 'sd-card'
models = card / 'MODELS'
target = models / 'model21.yml'

for model in models.glob('model*.yml'):
    if re.search(r'^header: *\r?\n   name: "K110S"\r?\n', model.read_bytes().decode('utf-8'), re.M):
        print(f'{model}: the K110S is already there')
        sys.exit(0)
assert not target.exists(), f'{target} is another model: give the K110S another number'

shutil.copyfile(repo / 'MODELS' / 'model21.yml', target)
picture = card / 'IMAGES' / 'K110S.png'
if not picture.exists():
    shutil.copyfile(repo / 'IMAGES' / 'K110S.png', picture)

labels = models / 'labels.yml'
raw = labels.read_bytes().decode('utf-8')
if 'model21.yml:' not in raw:
    newline = '\r\n' if '\r\n' in raw else '\n'
    entry = [
        '  model21.yml:', '    hash: ""', '    name: "K110S"', '    mod0id: 4', '    mod0type: 6', '    mod0rf: 20',
        '    labels: "Favorites"', '    bitmap: "K110S.png"', '    lastopen: 0',
    ]
    if not raw.endswith(newline):
        raw += newline
    labels.write_bytes((raw + newline.join(entry) + newline).encode('utf-8'))
print(f'{target}: the K110S added, with its picture and its line in labels.yml')
