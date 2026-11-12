"""Makes timer 1 count up the time with the motor on, instead of down from 4:40. A fixed time cannot follow how hard
the pack is flown (80 % of a 700 mAh pack went after 4:14 one day, 3:21 another): the mAh used (mAhRe's callouts, the
Pack widget) say when to land, the low-cell alarm backs it up, and the timer only tells the time run.

For every model whose timer 1 runs on "!L10" (the motor on). Usage: timer_up.py <card folder>"""
import re
import sys
from pathlib import Path

card = Path(sys.argv[1])

changed = []
for model in sorted((card / 'MODELS').glob('model*.yml')):
    raw = model.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    text = raw.replace('\r\n', '\n')
    first_timer = re.search(r'^timers: \n   0:\n(?:      .*\n)+', text, re.M)
    if not first_timer or '      swtch: "!L10"\n' not in first_timer.group(0):
        continue
    start = re.search(r'^      start: (\d+)\n', first_timer.group(0), re.M)
    if not start or start.group(1) == '0':
        continue
    timer = first_timer.group(0).replace(start.group(0), '      start: 0\n')
    assert text.count(first_timer.group(0)) == 1
    text = text.replace(first_timer.group(0), timer)
    model.write_bytes(text.replace('\n', newline).encode('utf-8'))
    seconds = int(start.group(1))
    changed.append(f'{model.name}: timer 1 counts up (was down from {seconds // 60}:{seconds % 60:02d})')

print('\n'.join(changed) if changed else 'Nothing to change')
