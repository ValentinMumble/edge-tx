"""Makes the K110S (model21.yml) log only once its motor may run (armed and out of hold) for 3 s in a row, not as soon
as it is armed: S-FHSS is one-way, so the radio cannot know the heli is listening, and flipping switches on the bench
made five logs under 2 s. A new logical switch, L8, is on 3 s after "not in hold (L4) and not disarmed (L5)" is, and
off at once; the special function that logs (LOGS) runs on it instead of on SA down. Skips a model already changed
(deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: k110s_log.py <model21.yml> [<backup folder>]"""
import re
import shutil
import sys
from pathlib import Path

# L8 (logical switches count from 0 in the file), 3 s (delay counts tenths of a second).
SLOT = 7
DELAY = 30

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert re.search(r'^header: ?\n   name: "K110S"\n', text, re.M), 'not the K110S model'


def section(name: str) -> tuple[int, int]:
    """Where a top-level key's block starts (its line) and ends (the next top-level key)."""
    found = re.search(rf'^{name}: ?\n', text, re.M)
    assert found, f'no {name}'
    end = re.compile(r'^[a-zA-Z]\w*:', re.M).search(text, found.end())
    return found.start(), end.start() if end else len(text)


def entries(name: str) -> tuple[int, int, str, dict[int, str]]:
    """A numbered block's entries (logicalSw, customFn): its bounds, its first line and each entry's lines by number."""
    start, end = section(name)
    first = text[start:text.index('\n', start) + 1]
    found = re.findall(r'^   (\d+):\n((?:      .*\n)*)', text[start:end], re.M)
    return start, end, first, {int(number): body for number, body in found}


def field(body: str, key: str) -> str:
    found = re.search(rf'^      {key}: ?(.*)$', body, re.M)
    return found.group(1) if found else ''


# The two switches it builds on: L4 SF down (hold), L5 SA not down (disarmed).
start, end, switches_line, switches = entries('logicalSw')
assert field(switches.get(3, ''), 'def') == '"SF,0"' and field(switches[3], 'func') == 'FUNC_VPOS', 'L4 is not hold'
assert field(switches.get(4, ''), 'def') == '"SA,1"' and field(switches[4], 'func') == 'FUNC_VNEG', 'L5 is not disarmed'
_, _, _, functions = entries('customFn')
logs = [number for number, body in functions.items() if field(body, 'func') == 'LOGS']
assert len(logs) == 1, 'not one LOGS special function'
log = functions[logs[0]]

running = (
    '      func: FUNC_AND\n      def: "!L4,!L5"\n      andsw: "NONE"\n      lsPersist: 0\n      lsState: 0\n'
    f'      delay: {DELAY}\n      duration: 0\n'
)
made = switches.get(SLOT, '')
if (
    [field(made, 'func'), field(made, 'def'), field(made, 'delay')] == ['FUNC_AND', '"!L4,!L5"', str(DELAY)]
    and field(log, 'swtch') == f'"L{SLOT + 1}"'
):
    print(f'{model}: it logs once the motor may run for 3 s already')
    sys.exit(0)
assert SLOT not in switches, f'L{SLOT + 1} is taken'
assert field(log, 'swtch') == '"SA2"', f'the log runs on {field(log, "swtch")}, not SA down'

switches[SLOT] = running
listing = ''.join(f'   {number}:\n{body}' for number, body in sorted(switches.items()))
text = text[:start] + switches_line + listing + text[end:]
start, end, _, functions = entries('customFn')
on_running = log.replace('      swtch: "SA2"\n', f'      swtch: "L{SLOT + 1}"\n')
text = text[:start] + text[start:end].replace(log, on_running, 1) + text[end:]

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: it logs once the motor may run for 3 s (L{SLOT + 1})')
