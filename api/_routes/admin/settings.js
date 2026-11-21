// GET  /api/admin/settings — informations de la maison, référencement, livraison, notifications, état des services.
// POST /api/admin/settings — enregistre une section. Corps : { section: 'company'|'site'|'shipping'|'notifications', ... }
import { handle, json, error, readJson, clean, isEmail } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { getSite, saveSite, getShippingAll, saveShipping, markDirty } from '../../_lib/settings.js';
import { env } from '../../_lib/env.js';
import { hasMail } from '../../_lib/mail.js';
import { audit } from '../../_lib/admin.js';

const euroToCents = (v) => { const n = Number(String(v ?? '').replace(',', '.').trim()); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

export const GET = handle(async (request) => {
  await requireStaff(request, 'settings');
  const sk = env('STRIPE_SECRET_KEY');
  return json({ ok: true, site: await getSite(), shipping: await getShippingAll(), services: {
    stripe: sk ? (sk.startsWith('sk_live_') ? 'Mode réel' : 'Mode test') : 'Non configuré', stripeWebhook: Boolean(env('STRIPE_WEBHOOK_SECRET')),
    mail: hasMail() ? env('MAIL_FROM') : 'Non configuré', publish: Boolean(env('VERCEL_DEPLOY_HOOK')), ordersNotify: env('ORDERS_NOTIFY_EMAIL') || 'Non configuré',
  } });
});

export const POST = handle(async (request) => {
  const { user } = await requireStaff(request, 'settings');
  const b = await readJson(request, 5_000);
  const site = await getSite();
  const fields = {};
  if (b.section === 'company') {
    const c = { name: clean(b.name, 120), siret: clean(b.siret, 20).replace(/\s/g, ''), email: clean(b.email, 254).toLowerCase(), phone: clean(b.phone, 30), address: clean(b.address, 250), vat: clean(b.vat, 20).replace(/\s/g, '').toUpperCase() };
    if (!c.name) fields.name = 'Raison sociale requise.';
    if (c.siret && !/^\d{14}$/.test(c.siret)) fields.siret = 'Le SIRET comporte 14 chiffres.';
    if (c.vat && !/^FR[0-9A-Z]{2}\d{9}$/.test(c.vat)) fields.vat = 'Numéro de TVA intracommunautaire invalide (FR…).';
    if (c.email && !isEmail(c.email)) fields.email = 'E-mail invalide.';
    if (c.phone && !/^\+?[\d\s().-]{6,20}$/.test(c.phone)) fields.phone = 'Téléphone invalide.';
    if (Object.keys(fields).length) return error('Certains champs sont à corriger.', 422, { fields });
    site.company = c; await saveSite(site); await markDirty('pages');
  } else if (b.section === 'site') {
    const seoTitle = clean(b.seoTitle, 70), seoDescription = clean(b.seoDescription, 160);
    if (!seoTitle) return error('Titre requis.', 422, { fields: { seoTitle: 'Titre requis.' } });
    Object.assign(site, { seoTitle, seoDescription }); await saveSite(site); await markDirty('pages');
  } else if (b.section === 'shipping') {
    const all = await getShippingAll(), next = {};
    for (const id of Object.keys(all)) {
      const s = b.methods?.[id] || {};
      const price = euroToCents(s.price);
      if (!(price >= 0 && price <= 100000)) fields[`${id}.price`] = 'Tarif invalide.';
      next[id] = { enabled: s.enabled !== false, price, title: clean(s.title, 60) || all[id].title, detail: clean(s.detail, 120) || all[id].detail, label: clean(s.label, 60) || all[id].label };
    }
    if (!Object.values(next).some((s) => s.enabled)) fields.shipping = 'Au moins un mode de livraison doit rester actif.';
    if (Object.keys(fields).length) return error('Certains champs sont à corriger.', 422, { fields });
    await saveShipping(next);
  } else if (b.section === 'notifications') {
    site.notifications = { newOrder: b.newOrder === true, lowStock: b.lowStock === true }; await saveSite(site);
  } else return error('Section inconnue.', 400);
  await audit(request, user, 'parametres.modifies', { section: b.section });
  return json({ ok: true, site, shipping: await getShippingAll() });
});
