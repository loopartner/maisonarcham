// /api/admin/promos — codes promotionnels. GET · POST (création) · PUT (modification) · DELETE { code }
import { handle, json, error, readJson, clean } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { redis, getJson, setJson } from '../../_lib/store.js';
import { normCode } from '../../_lib/pricing.js';
import { audit } from '../../_lib/admin.js';

const euroToCents = (v) => { const n = Number(String(v ?? '').replace(',', '.').trim()); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

function parse(b) {
  const fields = {};
  const p = {
    code: normCode(b.code), type: b.type === 'amount' ? 'amount' : 'percent', active: b.active !== false,
    value: b.type === 'amount' ? euroToCents(b.value) : Math.round(Number(b.value)),
    minSubtotal: b.minSubtotal === '' || b.minSubtotal == null ? 0 : euroToCents(b.minSubtotal),
    expiresAt: b.expiresAt ? clean(b.expiresAt, 10) : null, maxUses: b.maxUses === '' || b.maxUses == null ? null : Math.floor(Number(b.maxUses)),
    label: clean(b.label, 80),
  };
  if (!/^[A-Z0-9_-]{3,32}$/.test(p.code)) fields.code = 'Code : 3 à 32 caractères (lettres, chiffres, - et _).';
  if (p.type === 'percent' && !(p.value >= 1 && p.value <= 90)) fields.value = 'Pourcentage entre 1 et 90.';
  if (p.type === 'amount' && !(p.value >= 100 && p.value <= 100000)) fields.value = 'Montant invalide.';
  if (!(p.minSubtotal >= 0)) fields.minSubtotal = 'Montant invalide.';
  if (p.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(p.expiresAt)) fields.expiresAt = 'Date invalide.';
  if (p.maxUses !== null && !(p.maxUses >= 1)) fields.maxUses = 'Nombre invalide.';
  if (p.expiresAt) p.expiresAt = `${p.expiresAt}T23:59:59.999Z`;
  return { promo: p, fields };
}

const list = async () => (await Promise.all(((await redis('SMEMBERS', 'promos')) || []).map((c) => getJson(`promo:${c}`).then((p) => (p ? { code: c, ...p } : null))))).filter(Boolean).sort((a, b) => a.code.localeCompare(b.code));

export const GET = handle(async (request) => { await requireStaff(request, 'settings'); return json({ ok: true, promos: await list() }); });

async function upsert(request, creating) {
  const { user } = await requireStaff(request, 'settings');
  const { promo, fields } = parse(await readJson(request, 2_000));
  const exists = await getJson(`promo:${promo.code}`);
  if (creating && exists) fields.code = 'Ce code existe déjà.';
  if (!creating && !exists) return error('Code introuvable.', 404);
  if (Object.keys(fields).length) return error('Certains champs sont à corriger.', 422, { fields });
  const { code, ...data } = promo;
  await setJson(`promo:${code}`, { ...data, uses: exists?.uses || 0, createdAt: exists?.createdAt || new Date().toISOString() });
  await redis('SADD', 'promos', code);
  await audit(request, user, creating ? 'promo.cree' : 'promo.modifie', { code });
  return json({ ok: true, promos: await list() });
}
export const POST = handle((r) => upsert(r, true));
export const PUT = handle((r) => upsert(r, false));
export const DELETE = handle(async (request) => {
  const { user } = await requireStaff(request, 'settings');
  const code = normCode((await readJson(request, 500)).code);
  await redis('DEL', `promo:${code}`); await redis('SREM', 'promos', code);
  await audit(request, user, 'promo.supprime', { code });
  return json({ ok: true, promos: await list() });
});
