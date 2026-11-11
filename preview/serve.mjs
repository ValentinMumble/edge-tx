// The widget preview: builds the widgets on every save (tstl --watch) and serves the page that runs them.
// npm run preview, then open http://localhost:5420/preview/
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {readdir, stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT ?? 5420);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.lua': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.bmp': 'image/bmp',
  '.map': 'application/json',
};

/** The built widgets, with when each last changed, so the page reloads the one on show when it is rebuilt. */
async function widgets() {
  const folder = join(root, 'output');
  const names = (await readdir(folder)).filter(name => name.endsWith('.lua')).sort();
  return Promise.all(names.map(async name => ({name, changed: (await stat(join(folder, name))).mtimeMs})));
}

/** The model pictures on the radio's card, for the model's bitmap. */
async function images() {
  return (await readdir(join(root, 'sd-card/IMAGES'))).filter(name => /\.(png|jpe?g|bmp)$/i.test(name)).sort();
}

const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  try {
    if (path === '/api/widgets' || path === '/api/images') {
      const body = JSON.stringify(path === '/api/widgets' ? await widgets() : await images());
      response.writeHead(200, {'content-type': types['.json'], 'cache-control': 'no-store'});
      response.end(body);
      return;
    }
    const file = normalize(join(root, path.endsWith('/') ? `${path}index.html` : path));
    if (!file.startsWith(root) || file.includes('node_modules/.bin')) throw new Error('outside');
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    response.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

server.listen(port, () => console.log(`Widget preview on http://localhost:${port}/preview/`));

if (!process.argv.includes('--no-watch')) {
  const build = spawn(join(root, 'node_modules/.bin/tstl'), ['--watch', '--preserveWatchOutput'], {
    cwd: root,
    stdio: 'inherit',
  });
  process.on('exit', () => build.kill());
}
