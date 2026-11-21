// Tests du back-office : accès par rôle, commandes, export CSV.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFakeUpstash } from './fake-upstash.mjs';

let fake, dispatch;
const ORIGIN = 'https://maison.test';
const mails = [];
const C = {};

before(async () => {
  fake = await startFakeUpstash();
  Object.assign(process.env, { KV_REST_API_URL: fake.url, KV_REST_API_TOKEN: 'test-token', SITE_URL: ORIGIN, RESEND_API_KEY: 're_test', MAIL_FROM: 'M <a@maison.test>', ADMIN_EMAILS: 'patronne@maison.test' });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.resend.com')) { mails.push(JSON.parse(init.body)); return new Response('{"id":"x"}'); }
    return realFetch(url, init);
  };
  dispatch = (await import('../api/_router.js')).dispatch;
  // Comptes : propriétaire, gestion commandes, éditeur, client
  for (const [k, email, role] of [['owner', 'patronne@maison.test'], ['orders', 'logistique@maison.test', 'orders'], ['editor', 'redaction@maison.test', 'editor'], ['client', 'client@maison.test'], ['unverified', 'nonverifie@maison.test', 'admin']]) {
    const r = await call('POST', 'auth/register', { firstName: k, lastName: 'Test', email, password: 'velours2026x' });
    const { user } = await r.json();
    const u = JSON.parse(fake.kv.get(`user:${user.id}`));
    u.emailVerified = k !== 'unverified'; if (role) u.role = role;
    fake.kv.set(`user:${user.id}`, JSON.stringify(u));
    C[k] = (await call('POST', 'auth/login', { email, password: 'velours2026x' })).headers.get('set-cookie').split(';')[0];
  }
  const now = Date.now();
  [['MA-10001', 'payee', 18500, 'claire@exemple.fr', 'Claire Martin', 1], ['MA-10002', 'expediee', 37000, 'jean@exemple.fr', '=HYPERLINK("http://x")', 3], ['MA-10003', 'attente', 18500, 'zoe@exemple.fr', 'Zoé Petit', 40]].forEach(([n, status, total, email, name, d]) => {
    fake.kv.set(`order:${n}`, JSON.stringify({ number: n, status, total, email, name, createdAt: new Date(now - d * 86400000).toISOString(), items: [{ name: 'Crème d’Ararat', quantity: total / 18500, amount: total }], history: [{ status, at: new Date().toISOString() }] }));
    fake.kv.set('orders', [n, ...(fake.kv.get('orders') || [])]);
  });
});
after(() => fake.close());

async function call(method, path, body, cookie) {
  return dispatch(new Request(`${ORIGIN}/api/${path}`, {
    method, headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-real-ip': '203.0.113.' + Math.floor(Math.random() * 250), ...(cookie ? { cookie } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  }));
}

test('accès : client et compte d’équipe non vérifié = 404 ; sans session = 401', async () => {
  for (const p of ['admin/session', 'admin/dashboard', 'admin/orders']) {
    assert.equal((await call('GET', p, null, C.client)).status, 404);
    assert.equal((await call('GET', p, null, C.unverified)).status, 404);
    assert.equal((await call('GET', p)).status, 401);
  }
});

test('permissions : l’éditeur n’accède pas aux commandes ; la logistique oui', async () => {
  assert.equal((await call('GET', 'admin/orders', null, C.editor)).status, 403);
  assert.equal((await call('GET', 'admin/orders-export', null, C.editor)).status, 403);
  assert.equal((await call('GET', 'admin/orders', null, C.orders)).status, 200);
  const s = await (await call('GET', 'admin/session', null, C.orders)).json();
  assert.equal(s.role, 'orders'); assert.ok(!s.permissions.includes('settings'));
  const o = await (await call('GET', 'admin/session', null, C.owner)).json();
  assert.equal(o.role, 'owner'); assert.equal(o.badges.commandes, 1);
});

test('connexion de l’équipe : redirigée vers /admin par le même formulaire', async () => {
  const r = await (await call('POST', 'auth/login', { email: 'redaction@maison.test', password: 'velours2026x' })).json();
  assert.equal(r.redirect, '/admin');
});

test('tableau de bord : chiffres calculés sur les commandes payées', async () => {
  const d = await (await call('GET', 'admin/dashboard?period=30d', null, C.owner)).json();
  assert.equal(d.kpis.revenueTotal, 55500); assert.equal(d.kpis.orders, 2); assert.equal(d.kpis.revenue, 55500);
  assert.equal(d.series.length, 10); assert.equal(d.recent[0].number, 'MA-10001');
});

test('commandes : filtres, recherche et mise à jour avec historique, e-mail et audit', async () => {
  let l = await (await call('GET', 'admin/orders?status=expediee', null, C.orders)).json();
  assert.deepEqual(l.orders.map((o) => o.number), ['MA-10002']);
  l = await (await call('GET', 'admin/orders?q=zoe&days=30', null, C.orders)).json();
  assert.equal(l.total, 0);
  assert.equal((await call('POST', 'admin/order', { number: 'MA-10001', status: 'expediee' }, C.orders)).status, 422, 'suivi requis');
  assert.equal((await call('POST', 'admin/order', { number: 'MA-10001', status: 'piraterie' }, C.orders)).status, 422);
  const before = mails.length;
  const r = await (await call('POST', 'admin/order', { number: 'MA-10001', status: 'expediee', carrier: 'colissimo', trackingNumber: '6A19842033', notify: true }, C.orders)).json();
  assert.equal(r.order.status, 'expediee'); assert.equal(r.notified, true);
  assert.match(r.order.trackingUrl, /^https:\/\/www\.laposte\.fr\//);
  assert.equal(mails.length, before + 1); assert.match(mails.at(-1).subject, /expédiée/);
  assert.equal(r.order.history.at(-2).by, 'orders Test');
  const auditLog = JSON.parse(fake.kv.get('audit')[0]);
  assert.equal(auditLog.action, 'commande.modifiee'); assert.equal(auditLog.by, 'logistique@maison.test');
});

test('export CSV : formules neutralisées (anti-injection)', async () => {
  const res = await call('GET', 'admin/orders-export', null, C.owner);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  const csv = await res.text();
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`), 'la formule est préfixée');
  assert.ok(!/;=HYPERLINK/.test(csv));
});

test('clients : agrégés par e-mail (comptes et sans compte), réservés aux bons rôles', async () => {
  assert.equal((await call('GET', 'admin/customers', null, C.editor)).status, 403);
  const r = await (await call('GET', 'admin/customers', null, C.orders)).json();
  const emails = r.customers.map((c) => c.email);
  assert.ok(emails.includes('claire@exemple.fr') && emails.includes('client@maison.test'));
  assert.ok(!emails.includes('patronne@maison.test'), 'l’équipe n’apparaît pas parmi les clients');
  const d = await (await call('GET', 'admin/customer?email=claire@exemple.fr', null, C.orders)).json();
  assert.equal(d.customer.orders.length, 1); assert.equal(d.customer.account, false);
});

test('newsletter : liste, désinscription, campagne de test ; interdite à la logistique', async () => {
  assert.equal((await call('GET', 'admin/subscribers', null, C.orders)).status, 403);
  fake.kv.set('newsletter', new Set(['a@exemple.fr', 'claire@exemple.fr']));
  let r = await (await call('GET', 'admin/subscribers', null, C.editor)).json();
  assert.equal(r.stats.active, 2);
  await call('POST', 'admin/subscribers', { email: 'a@exemple.fr' }, C.editor);
  r = await (await call('GET', 'admin/subscribers?status=desinscrit', null, C.editor)).json();
  assert.deepEqual(r.subscribers.map((s) => s.email), ['a@exemple.fr']);
  const camp = await (await call('GET', 'admin/campaign', null, C.editor)).json();
  assert.equal(camp.audiences.customers, 1);
  const t = await (await call('POST', 'admin/campaign', { subject: 'Lettre de décembre', body: 'Bonjour <script>x</script>', mode: 'test' }, C.editor)).json();
  assert.equal(t.sent, 1);
});

test('produits : validation, prix modifié appliqué immédiatement au calcul, refusé à la logistique', async () => {
  assert.equal((await call('GET', 'admin/products', null, C.orders)).status, 403);
  const { products } = await (await call('GET', 'admin/products', null, C.editor)).json();
  const p = products.find((x) => x.id === 'creme-dararat-50');
  let r = await call('PUT', 'admin/products', { ...p, price: '-3', images: ['/etc/passwd'] }, C.editor);
  const bad = await r.json(); assert.ok(bad.fields.price && bad.fields.images);
  r = await call('PUT', 'admin/products', { ...p, price: '195,00', stock: 2, images: p.images }, C.editor);
  assert.equal(r.status, 200);
  const q = await (await call('POST', 'cart/quote', { items: [{ id: p.id, qty: 1 }] })).json();
  assert.equal(q.quote.subtotal, 19500, 'nouveau prix appliqué');
  const tooMany = await call('POST', 'cart/quote', { items: [{ id: p.id, qty: 3 }] });
  assert.equal(tooMany.status, 409, 'stock respecté');
  const big = products.find((x) => x.id === 'creme-dararat-100');
  await call('PUT', 'admin/products', { ...big, price: '160', status: 'draft', images: big.images }, C.editor);
  r = await call('PUT', 'admin/products', { ...p, price: '195', stock: 2, status: 'draft', images: p.images }, C.editor);
  assert.equal(r.status, 422, 'au moins une fiche en ligne');
  await call('PUT', 'admin/products', { ...big, price: '160', status: 'published', images: big.images }, C.editor);
});

test('articles : texte converti en blocs, balisage retiré du titre, publication non configurée', async () => {
  const r = await (await call('POST', 'admin/articles', { title: 'Hiver <em>doré</em><script>x</script>', category: 'Parfumerie', excerpt: 'Chapô', image: '/assets/img/flacon-hero.webp', body: 'Premier paragraphe.\n\n## Intertitre\n\n> Une citation\n— La Maison\n\nSuite.', status: 'draft' }, C.editor)).json();
  assert.equal(r.article.slug, 'hiver-dorex');
  assert.equal(r.article.title, 'Hiver <em>doré</em>x');
  assert.deepEqual(r.article.body.map((b) => b.t), ['lead', 'h2', 'quote', 'p']);
  assert.equal(r.article.body[2].by, 'La Maison');
  const pub = await call('POST', 'admin/publish', {}, C.editor);
  assert.equal(pub.status, 503);
  const st = await (await call('GET', 'admin/publish', null, C.editor)).json();
  assert.ok(st.dirty.journal && st.dirty.produits);
  assert.equal((await call('POST', 'admin/publish', {}, C.orders)).status, 403);
});

test('équipe : seul propriétaire/administrateur gère les rôles ; protections', async () => {
  assert.equal((await call('GET', 'admin/team', null, C.editor)).status, 403);
  let r = await call('POST', 'admin/team', { email: 'client@maison.test', role: 'superadmin' }, C.owner);
  assert.equal(r.status, 422);
  r = await call('POST', 'admin/team', { email: 'inconnu@maison.test', role: 'editor' }, C.owner);
  assert.equal(r.status, 404);
  r = await call('POST', 'admin/team', { email: 'patronne@maison.test', role: 'editor' }, C.owner);
  assert.equal(r.status, 422, 'pas son propre rôle');
  r = await (await call('POST', 'admin/team', { email: 'client@maison.test', role: 'editor' }, C.owner)).json();
  assert.ok(r.members.some((m) => m.email === 'client@maison.test' && m.role === 'editor'));
  assert.equal((await call('GET', 'auth/me', null, C.client)).status, 200);
  const me = await (await call('GET', 'auth/me', null, C.client)).json();
  assert.equal(me.user, null, 'sessions fermées après changement de rôle');
});

test('codes promo et livraison : gérés en paramètres, appliqués au calcul', async () => {
  assert.equal((await call('POST', 'admin/promos', { code: 'NOEL', type: 'percent', value: 15 }, C.orders)).status, 403);
  assert.equal((await call('POST', 'admin/promos', { code: 'NOEL', type: 'percent', value: 150 }, C.owner)).status, 422);
  assert.equal((await call('POST', 'admin/promos', { code: 'noel', type: 'percent', value: 15, minSubtotal: '100' }, C.owner)).status, 200);
  await call('POST', 'admin/settings', { section: 'shipping', methods: { standard: { enabled: true, price: '4,90' }, express: { enabled: false, price: '15' } } }, C.owner);
  const { products } = await (await call('GET', 'admin/products', null, C.owner)).json();
  const q = await (await call('POST', 'cart/quote', { items: [{ id: 'creme-dararat-100', qty: 1 }], shipping: 'express', code: 'NOEL' })).json();
  assert.equal(q.quote.shipping.id, 'standard', 'express désactivé'); assert.equal(q.quote.shipping.price, 490);
  assert.equal(q.quote.discount, Math.round(q.quote.subtotal * 0.15));
  assert.equal((await call('POST', 'admin/settings', { section: 'company', name: 'Maison Archam SAS', siret: '123' }, C.owner)).status, 422);
});
