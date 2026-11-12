// Puts each widget built from src/ (in output/) in its folder on the repo's card, sd-card/WIDGETS/<folder>/main.lua,
// as widgets.json pairs them, so the card holds what goes on the radio. `npm run build` runs it after building.
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pairs = JSON.parse(await readFile(join(root, 'widgets.json'), 'utf8'));
for (const [file, folder] of Object.entries(pairs)) {
  const target = join(root, 'sd-card', 'WIDGETS', folder);
  await mkdir(target, {recursive: true});
  // Written into the file that is there, so it keeps the permissions it came off the radio with.
  await writeFile(join(target, 'main.lua'), await readFile(join(root, 'output', `${file}.lua`)));
  // A compiled copy the radio made would run instead of the new one.
  await rm(join(target, 'main.luac'), {force: true});
}
console.log(`On the card: ${Object.values(pairs).join(', ')}`);
