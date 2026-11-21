// Tests de l'espace client : cloisonnement des commandes, profil, adresses, mot de passe.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFakeUpstash } from './fake-upstash.mjs';

let fake, dispatch;
const ORIGIN = 'https://maison.test';
const mails = [];

before(async () => {
  fake = await startFakeUpstash();
  Object.assign(process.env, { KV_REST_API_URL: fake.url, KV_REST_API_TOKEN: 'test-token', SITE_URL: ORIGIN, RESEND_API_KEY: 're_test', MAIL_FROM: 'M <a@maison.test>', ADMIN_EMAILS: '' });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.resend.com')) { mails.push(JSON.parse(init.body)); return new Response('{"id":"x"}'); }
    return realFetch(url, init);
  };
  dispatch = (await import('../api/_router.js')).dispatch;
});
after(() => fake.close());

const call = (method, path, body, cookie) => dispatch(new Request(`${ORIGIN}/api/${path}`, {
  method, headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-real-ip': '192.0.2.' + Math.floor(Math.random() * 250), ...(cookie ? { cookie } : {}) },
  body: method === 'GET' ? undefined : JSON.stringify(body || {}),
}));
const cookieOf = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function signup(email, firstName = 'Test') {
  const r = await call('POST', 'auth/register', { firstName, lastName: 'Client', email, password: 'velours2026x' });
  return { cookie: cookieOf(r), user: (await r.json()).user };
}
function seedOrder(number, email, userId = null) {
  fake.kv.set(`order:${number}`, JSON.stringify({ number, email, userId, name: 'Claire Martin', status: 'expediee', createdAt: new Date().toISOString(), items: [{ name: 'Crème d’Ararat', quantity: 1, amount: 18500 }], total: 18500, shipping: { line1: '1 rue A', postal_code: '75001', city: 'Paris', country: 'FR' } }));
  const k = `orders:email:${email}`; fake.kv.set(k, [...(fake.kv.get(k) || []), number]);
  if (userId) { const u = `orders:user:${userId}`; fake.kv.set(u, [...(fake.kv.get(u) || []), number]); }
}

test('cloisonnement : adresse non confirmée = aucune commande visible', async () => {
  seedOrder('MA-20001', 'victime@exemple.fr');
  const intrus = await signup('victime@exemple.fr'.replace('victime', 'victime')); // même adresse, non confirmée
  const list = await (await call('GET', 'account/orders', null, intrus.cookie)).json();
  assert.equal(list.orders.length, 0);
  assert.equal((await call('GET', 'account/order?n=MA-20001', null, intrus.cookie)).status, 404);
});

test('cloisonnement : adresse confirmée = commandes visibles ; autre client = 404', async () => {
  const token = mails.filter((m) => m.to[0] === 'victime@exemple.fr').pop().html.match(/jeton=([A-Za-z0-9_-]+)/)[1];
  await call('POST', 'auth/verify', { token });
  const login = await call('POST', 'auth/login', { email: 'victime@exemple.fr', password: 'velours2026x' });
  const c = cookieOf(login);
  const list = await (await call('GET', 'account/orders', null, c)).json();
  assert.deepEqual(list.orders.map((o) => o.number), ['MA-20001']);
  const detail = await (await call('GET', 'account/order?n=MA-20001', null, c)).json();
  assert.ok(detail.order.address.includes('France'));
  const autre = await signup('autre@exemple.fr');
  assert.equal((await call('GET', 'account/order?n=MA-20001', null, autre.cookie)).status, 404);
  assert.equal((await call('GET', 'account/order?n=../../etc', null, autre.cookie)).status, 404);
  seedOrder('MA-20002', 'invite@exemple.fr', autre.user.id);
  const mine = await (await call('GET', 'account/orders', null, autre.cookie)).json();
  assert.deepEqual(mine.orders.map((o) => o.number), ['MA-20002'], 'commande passée depuis le compte');
});

test('sans session : 401 sur toutes les routes du compte', async () => {
  for (const p of ['account/overview', 'account/orders', 'account/addresses']) assert.equal((await call('GET', p)).status, 401);
  assert.equal((await call('POST', 'account/profile', { firstName: 'X', lastName: 'Y' })).status, 401);
});

test('profil et carnet d’adresses', async () => {
  const { cookie } = await signup('profil@exemple.fr');
  let r = await call('POST', 'account/profile', { firstName: 'Claire', lastName: 'Martin', phone: '+33 6 12 34 56 78', birthDate: '1991-02-14' }, cookie);
  assert.equal(r.status, 200);
  r = await call('POST', 'account/profile', { firstName: '<b>', lastName: 'Martin', birthDate: '2999-01-01' }, cookie);
  const bad = await r.json(); assert.ok(bad.fields.firstName && bad.fields.birthDate);
  const addr = { label: 'Domicile', firstName: 'Claire', lastName: 'Martin', line1: '18 rue de Sèvres', postalCode: '75006', city: 'Paris', country: 'FR' };
  let a = await (await call('POST', 'account/addresses', addr, cookie)).json();
  assert.equal(a.addresses.length, 1); assert.equal(a.addresses[0].isDefault, true);
  a = await (await call('POST', 'account/addresses', { ...addr, label: 'Bureau', line1: '42 avenue Montaigne' }, cookie)).json();
  const bureau = a.addresses.find((x) => x.label === 'Bureau');
  a = await (await call('PUT', 'account/addresses', { id: bureau.id, onlyDefault: true }, cookie)).json();
  assert.equal(a.addresses.find((x) => x.isDefault).label, 'Bureau');
  a = await (await call('DELETE', 'account/addresses', { id: bureau.id }, cookie)).json();
  assert.equal(a.addresses.length, 1); assert.equal(a.addresses[0].isDefault, true);
  assert.equal((await call('DELETE', 'account/addresses', { id: 'a_inexistant' }, cookie)).status, 404);
});

test('mot de passe : ancien requis, autres sessions fermées', async () => {
  const { cookie } = await signup('pwd@exemple.fr');
  const second = cookieOf(await call('POST', 'auth/login', { email: 'pwd@exemple.fr', password: 'velours2026x' }));
  assert.equal((await call('POST', 'account/password', { current: 'faux', password: 'nouveau2026velours' }, cookie)).status, 422);
  const r = await call('POST', 'account/password', { current: 'velours2026x', password: 'nouveau2026velours' }, cookie);
  assert.equal(r.status, 200);
  const me2 = await (await call('GET', 'auth/me', null, second)).json();
  assert.equal(me2.user, null, 'autre appareil déconnecté');
  const me1 = await (await call('GET', 'auth/me', null, cookieOf(r))).json();
  assert.equal(me1.user.email, 'pwd@exemple.fr', 'appareil courant reconnecté');
});

test('suppression du compte : mot de passe requis, session fermée', async () => {
  const { cookie } = await signup('efface@exemple.fr');
  assert.equal((await call('POST', 'account/delete', { password: 'faux' }, cookie)).status, 422);
  assert.equal((await call('POST', 'account/delete', { password: 'velours2026x' }, cookie)).status, 200);
  assert.equal((await call('POST', 'auth/login', { email: 'efface@exemple.fr', password: 'velours2026x' })).status, 401);
});
