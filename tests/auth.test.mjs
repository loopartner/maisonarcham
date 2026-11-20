// Tests de bout en bout de l'authentification : node --test tests/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFakeUpstash } from './fake-upstash.mjs';

let fake, api = {}, middleware, router;
const ORIGIN = 'https://maison.test';
const mails = [];

before(async () => {
  fake = await startFakeUpstash();
  process.env.KV_REST_API_URL = fake.url;
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.ADMIN_EMAILS = 'direction@maison.test';
  process.env.SITE_URL = ORIGIN;
  process.env.RESEND_API_KEY = 're_test'; process.env.MAIL_FROM = 'Maison <a@maison.test>';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.resend.com')) { mails.push(JSON.parse(init.body)); return new Response('{"id":"x"}', { status: 200 }); }
    if (String(url).endsWith('/404')) return new Response('<h1>404</h1>', { status: 200 });
    return realFetch(url, init);
  };
  for (const n of ['register', 'login', 'logout', 'me', 'forgot', 'reset', 'verify']) api[n] = await import(`../api/_routes/auth/${n}.js`);
  middleware = (await import('../middleware.js')).default;
  router = { GET: (await import('../api/_router.js')).dispatch, POST: (await import('../api/_router.js')).dispatch };
});
after(() => fake.close());

const post = (body, { cookie, origin = ORIGIN, type = 'application/json' } = {}) => new Request(`${ORIGIN}/api/x`, {
  method: 'POST', headers: { 'content-type': type, ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), 'x-real-ip': '203.0.113.' + Math.floor(Math.random() * 250) },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const get = (path, cookie) => new Request(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} });
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];
const tokenFromMail = (m) => m.html.match(/jeton=([A-Za-z0-9_-]+)/)[1];

let clientCookie;

test('inscription : crée un compte CLIENT, même si on tente d’envoyer un rôle', async () => {
  const res = await api.register.POST(post({ firstName: 'Claire', lastName: 'Martin', email: 'Claire@Exemple.fr', password: 'velours2026', role: 'admin' }));
  const data = await res.json();
  assert.equal(res.status, 201);
  assert.equal(data.user.role, 'client');
  assert.equal(data.redirect, '/compte');
  const sc = res.headers.get('set-cookie');
  assert.match(sc, /^__Host-ma_session=/); assert.match(sc, /HttpOnly/); assert.match(sc, /Secure/); assert.match(sc, /SameSite=Lax/);
  clientCookie = cookieOf(res);
  const stored = JSON.parse(fake.kv.get(`user:${data.user.id}`));
  assert.match(stored.passwordHash, /^scrypt\$32768\$8\$1\$/);
  assert.ok(!JSON.stringify(stored).includes('velours2026'), 'mot de passe jamais stocké en clair');
  assert.equal(mails.length, 1, 'e-mail de bienvenue envoyé');
});

test('inscription : adresse déjà utilisée refusée, mot de passe faible refusé', async () => {
  let r = await api.register.POST(post({ firstName: 'X', lastName: 'Y', email: 'claire@exemple.fr', password: 'autre2026xx' }));
  assert.equal(r.status, 409);
  r = await api.register.POST(post({ firstName: 'X', lastName: 'Y', email: 'z@exemple.fr', password: 'court1' }));
  assert.equal(r.status, 422);
  r = await api.register.POST(post({ firstName: 'X', lastName: 'Y', email: 'z@exemple.fr', password: 'sanschiffre' }));
  assert.equal(r.status, 422);
});

test('CSRF : requête d’un autre site ou sans JSON refusée', async () => {
  let r = await api.login.POST(post({ email: 'claire@exemple.fr', password: 'velours2026' }, { origin: 'https://pirate.example' }));
  assert.equal(r.status, 403);
  r = await api.login.POST(post({ email: 'claire@exemple.fr', password: 'velours2026' }, { origin: null }));
  assert.equal(r.status, 403);
  r = await api.login.POST(post('email=claire@exemple.fr', { type: 'application/x-www-form-urlencoded' }));
  assert.equal(r.status, 415);
});

test('connexion : même message pour un mauvais mot de passe et un compte inexistant', async () => {
  const a = await (await api.login.POST(post({ email: 'claire@exemple.fr', password: 'mauvais2026' }))).json();
  const b = await (await api.login.POST(post({ email: 'personne@exemple.fr', password: 'mauvais2026' }))).json();
  assert.equal(a.error, b.error);
});

test('connexion client → /compte ; le middleware bloque /admin (404) et laisse /compte', async () => {
  const res = await api.login.POST(post({ email: 'claire@exemple.fr', password: 'velours2026' }));
  const data = await res.json();
  assert.equal(res.status, 200); assert.equal(data.redirect, '/compte');
  const c = cookieOf(res);
  assert.equal((await middleware(get('/admin', c))).status, 404);
  assert.equal((await middleware(get('/admin/commandes', c))).status, 404);
  assert.equal(await middleware(get('/compte', c)), undefined);
  const m = await middleware(get('/connexion', c));
  assert.equal(m.status, 303); assert.match(m.headers.get('location'), /\/compte$/);
});

test('sans session : /compte et /admin redirigent vers /connexion', async () => {
  for (const p of ['/compte', '/admin', '/admin/clients']) {
    const r = await middleware(get(p));
    assert.equal(r.status, 303); assert.match(r.headers.get('location'), /\/connexion\?suite=/);
  }
  const forged = await middleware(get('/admin', '__Host-ma_session=' + 'A'.repeat(43)));
  assert.equal(forged.status, 303);
});

test('admin : adresse listée mais NON vérifiée = simple client', async () => {
  const r = await api.register.POST(post({ firstName: 'Sophie', lastName: 'Arakelian', email: 'direction@maison.test', password: 'ararat2026maison' }));
  const d = await r.json();
  assert.equal(d.user.role, 'client');
  assert.equal((await middleware(get('/admin', cookieOf(r)))).status, 404);
});

test('admin : après confirmation de l’adresse → même formulaire, redirigé vers /admin', async () => {
  const mail = mails.filter((m) => m.to[0] === 'direction@maison.test').pop();
  const v = await api.verify.POST(post({ token: tokenFromMail(mail) }));
  assert.equal(v.status, 200);
  const again = await api.verify.POST(post({ token: tokenFromMail(mail) }));
  assert.equal(again.status, 400, 'jeton à usage unique');
  const res = await api.login.POST(post({ email: 'direction@maison.test', password: 'ararat2026maison' }));
  const data = await res.json();
  assert.equal(data.redirect, '/admin'); assert.equal(data.user.role, 'admin');
  assert.match(res.headers.get('set-cookie'), /Max-Age=43200/, 'session admin limitée à 12 h');
  const c = cookieOf(res);
  assert.equal(await middleware(get('/admin', c)), undefined);
  const me = await (await api.me.GET(get('/api/auth/me', c))).json();
  assert.equal(me.user.role, 'admin');
  assert.ok(!('passwordHash' in me.user));
});

test('mot de passe oublié : réponse identique que le compte existe ou non', async () => {
  const before = mails.length;
  const a = await (await api.forgot.POST(post({ email: 'claire@exemple.fr' }))).json();
  const b = await (await api.forgot.POST(post({ email: 'inconnu@exemple.fr' }))).json();
  assert.deepEqual(a, b);
  assert.equal(mails.length, before + 1);
});

test('réinitialisation : change le mot de passe et ferme toutes les sessions', async () => {
  const mail = mails.filter((m) => m.to[0] === 'claire@exemple.fr' && /mot de passe/.test(m.subject)).pop();
  const res = await api.reset.POST(post({ token: tokenFromMail(mail), password: 'nouveau2026velours' }));
  assert.equal(res.status, 200);
  const me = await (await api.me.GET(get('/api/auth/me', clientCookie))).json();
  assert.equal(me.user, null, 'ancienne session invalidée');
  const old = await api.login.POST(post({ email: 'claire@exemple.fr', password: 'velours2026' }));
  assert.equal(old.status, 401);
  const neu = await api.login.POST(post({ email: 'claire@exemple.fr', password: 'nouveau2026velours' }));
  assert.equal(neu.status, 200);
});

test('déconnexion : la session ne fonctionne plus', async () => {
  const res = await api.login.POST(post({ email: 'claire@exemple.fr', password: 'nouveau2026velours' }));
  const c = cookieOf(res);
  const out = await api.logout.POST(post({}, { cookie: c }));
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  const me = await (await api.me.GET(get('/api/auth/me', c))).json();
  assert.equal(me.user, null);
});

test('limitation : blocage après 8 échecs sur le même compte', async () => {
  let last;
  for (let i = 0; i < 9; i++) last = await api.login.POST(post({ email: 'direction@maison.test', password: 'faux' + i + 'xxxxx' }));
  assert.equal(last.status, 429);
  const good = await api.login.POST(post({ email: 'direction@maison.test', password: 'ararat2026maison' }));
  assert.equal(good.status, 429, 'même le bon mot de passe attend la fin du blocage');
});

test('routeur : route connue servie, route inconnue 404, mauvaise méthode 405, pas de remontée de dossier', async () => {
  const ok = await router.GET(new Request(`${ORIGIN}/api/auth/me`));
  assert.equal(ok.status, 200);
  assert.equal((await router.GET(new Request(`${ORIGIN}/api/inexistante`))).status, 404);
  assert.equal((await router.GET(new Request(`${ORIGIN}/api/_lib/auth`))).status, 404);
  assert.equal((await router.GET(new Request(`${ORIGIN}/api/constructor`))).status, 404);
  assert.equal((await router.GET(new Request(`${ORIGIN}/api/auth/login`))).status, 405);
  const viaRouter = await router.POST(new Request(`${ORIGIN}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ email: 'x@y.fr', password: 'abc' }) }));
  assert.equal(viaRouter.status, 401);
});

test('routeur : chemin réécrit par Vercel (/api/auth/[action]?action=…)', async () => {
  const r = await router.GET(new Request(`${ORIGIN}/api/auth/[action]?action=me`));
  assert.equal(r.status, 200);
  const r2 = await router.GET(new Request(`${ORIGIN}/api/[route]?route=health`));
  assert.equal(r2.status, 200);
});
