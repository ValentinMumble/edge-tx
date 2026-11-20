"""Keeps the M2 EVO's log going while it is armed (model20.yml: special function 17, LOGS on SA2 every 0.2 s, beside
function 12's LOGS while telemetry streams). The log stops when telemetry does, so walking up to the heli, which cuts
the link for a second or two, started a new file in the middle of a pack (20 Nov 2026). While SA arms the model the
log now goes on through the gap; it still stops once disarmed with the pack out. Skips a model already changed
(deploy.sh runs every script on the radio each time). Backs the file up first.
Usage: continuous_log.py <model20.yml> [<backup folder>]"""
import shutil
import sys
from pathlib import Path

model = Path(sys.argv[1])
raw = model.read_bytes().decode('utf-8')
newline = '\r\n' if '\r\n' in raw else '\n'
text = raw.replace('\r\n', '\n')
assert '   name: "M2 EVO"\n' in text, 'not the M2 EVO model'

functions = text[text.index('customFn: \n'):text.index('flightModeData: \n')]
ARMED = '      swtch: "SA2"\n      func: LOGS\n      def: "2,1"\n'
if ARMED in functions:
    print(f'{model}: the log already goes on while armed')
    sys.exit(0)
assert '      swtch: "TELEMETRY_STREAMING"\n      func: LOGS\n      def: "2,1"\n' in functions, 'no log on telemetry'
assert '\n   16:\n' not in functions, 'special function 17 is taken'
text = text.replace(functions, functions + '   16:\n' + ARMED, 1)

if len(sys.argv) > 2:
    backup = Path(sys.argv[2])
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(model, backup / model.name)
model.write_bytes(text.replace('\n', newline).encode('utf-8'))
print(f'{model}: the log goes on while armed, through a telemetry gap')
