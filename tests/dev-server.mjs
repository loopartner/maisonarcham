// Serveur de développement local : sert public/ et les API, avec une base Redis simulée en mémoire.
// Usage : node scripts/build.mjs && node tests/dev-server.mjs  →  http://localhost:3000
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { startFakeUpstash } from './fake-upstash.mjs';

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'dist');
const fake = await startFakeUpstash();
Object.assign(process.env, { KV_REST_API_URL: fake.url, KV_REST_API_TOKEN: 'test-token', SITE_URL: `http://localhost:${PORT}`, ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'admin@maison.test' });
const { dispatch } = await import('../api/_router.js');
const middleware = (await import('../middleware.js')).default;

// Données de démonstration (mémoire locale uniquement) : compte propriétaire admin@maison.test / velours2026
{
  const { hashPassword } = await import('../api/_lib/auth.js');
  const id = 'u_demoowner';
  fake.kv.set(`user:${id}`, JSON.stringify({ id, email: 'admin@maison.test', firstName: 'Sophie', lastName: 'Arakelian', passwordHash: await hashPassword('velours2026'), pwdVersion: 1, role: 'client', emailVerified: true, createdAt: '2026-01-05T10:00:00Z' }));
  fake.kv.set('user:email:admin@maison.test', id);
  fake.kv.set('users', new Map([[id, Date.parse('2026-01-05')]]));
  const names = ['Claire Martin', 'Jean Dupont', 'Zoé Petit', 'Hugo Bernard', 'Inès Moreau', 'Lucas Laurent', 'Emma Garnier', 'Louis Fabre'];
  const statuses = ['livree', 'livree', 'livree', 'expediee', 'preparation', 'payee', 'annulee', 'livree'];
  const nums = [], dates = new Map();
  for (let i = 0; i < 34; i++) {
    const n = `MA-${10001 + i}`, d = new Date(Date.now() - (34 - i) * 10.5 * 86400000 + (i % 5) * 3600000);
    const name = names[i % names.length], qty = 1 + (i % 3 === 0 ? 1 : 0), email = name.toLowerCase().replace(' ', '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '@exemple.fr';
    const status = i > 30 ? ['payee', 'preparation', 'payee'][i - 31] : statuses[i % statuses.length];
    fake.kv.set(`order:${n}`, JSON.stringify({ number: n, name, email, phone: '+33 6 12 45 78 90', status, total: 16000 * qty, items: [{ name: 'Crème d’Ararat', variant: 'Extrait de parfum · 100 ml', quantity: qty, amount: 16000 * qty }], shippingMethod: 'Livraison standard', shippingCost: 0, createdAt: d.toISOString(), history: [{ status: 'payee', at: d.toISOString() }], shipping: { line1: '18 rue de Sèvres', postal_code: '75006', city: 'Paris', country: 'FR' } }));
    nums.unshift(n);
    fake.kv.set(`orders:email:${email}`, [n, ...(fake.kv.get(`orders:email:${email}`) || [])]);
    dates.set(`abonne${i}@exemple.fr`, new Date(Date.now() - i * 9 * 86400000).toISOString());
  }
  fake.kv.set('orders', nums);
  fake.kv.set('newsletter', new Set(dates.keys()));
  fake.kv.set('newsletter:dates', dates);
  console.log('Démo : admin@maison.test / velours2026 — 34 commandes');
}
const vercel = JSON.parse(await readFile(path.join(ROOT, '..', 'vercel.json'), 'utf8'));
const CSP = vercel.headers.flatMap((x) => x.headers).find((x) => x.key === 'Content-Security-Policy').value.replace('; upgrade-insecure-requests', '');
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
  const h = { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' };
  // Même politique de sécurité du contenu qu'en production (vercel.json), pour détecter les violations en local.
  if (f.endsWith('.html')) h['content-security-policy'] = CSP;
  res.writeHead(200, h); res.end(await readFile(f));
}).listen(PORT, () => console.log(`Maison Archam en local : http://localhost:${PORT}`));
