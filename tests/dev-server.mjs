// Serveur de développement local : sert public/ et les API, avec une base Redis simulée en mémoire.
// Usage : node scripts/build.mjs && node tests/dev-server.mjs  →  http://localhost:3000
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { startFakeUpstash } from './fake-upstash.mjs';

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public');
const fake = await startFakeUpstash();
Object.assign(process.env, { KV_REST_API_URL: fake.url, KV_REST_API_TOKEN: 'test-token', SITE_URL: `http://localhost:${PORT}`, ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'admin@maison.test' });
const { dispatch } = await import('../api/_router.js');
const middleware = (await import('../middleware.js')).default;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };

async function file(p) {
  for (const c of [p, p + '.html', path.join(p, 'index.html')]) {
    try { if ((await stat(c)).isFile()) return c; } catch { /* suivant */ }
  }
  return null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const chunks = []; for await (const c of req) chunks.push(c);
  // Le serveur local est en http : on retire « Secure » et « __Host- » des cookies pour le navigateur.
  const headers = { ...req.headers, cookie: (req.headers.cookie || '').replace(/(^|;\s*)ma_session=/, '$1__Host-ma_session=') };
  const request = new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
  let response = null;
  if (url.pathname.startsWith('/api/')) response = await dispatch(request);
  else {
    const mw = await middleware(request);
    if (mw) response = mw;
  }
  if (response) {
    const h = Object.fromEntries(response.headers);
    if (h['set-cookie']) h['set-cookie'] = h['set-cookie'].replace('__Host-ma_session', 'ma_session').replace('; Secure', '');
    res.writeHead(response.status, h); res.end(Buffer.from(await response.arrayBuffer())); return;
  }
  const f = await file(path.join(ROOT, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')));
  if (!f) { res.writeHead(404, { 'content-type': TYPES['.html'] }); res.end(await readFile(path.join(ROOT, '404.html'))); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(await readFile(f));
}).listen(PORT, () => console.log(`Maison Archam en local : http://localhost:${PORT}`));
