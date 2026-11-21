// GET  /api/admin/campaign — campagnes envoyées et tailles d'audience.
// POST /api/admin/campaign — envoi d'une lettre. Corps : { subject, title, body, audience: all|customers|prospects, mode: test|send }
import { handle, json, error, readJson, clean, escapeHtml, siteUrl, rateLimit } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { redis } from '../../_lib/store.js';
import { hasMail, layout } from '../../_lib/mail.js';
import { sendCampaign } from '../../_lib/newsletter.js';
import { allOrders } from '../../_lib/orders.js';
import { isPaid, audit } from '../../_lib/admin.js';

async function audiences() {
  const active = (await redis('SMEMBERS', 'newsletter')) || [];
  const buyers = new Set((await allOrders()).filter(isPaid).map((o) => String(o.email || '').toLowerCase()));
  return { all: active, customers: active.filter((e) => buyers.has(e)), prospects: active.filter((e) => !buyers.has(e)) };
}

export const GET = handle(async (request) => {
  await requireStaff(request, 'newsletter');
  const a = await audiences();
  const list = ((await redis('LRANGE', 'campaigns', 0, 19)) || []).map((x) => JSON.parse(x));
  return json({ ok: true, audiences: { all: a.all.length, customers: a.customers.length, prospects: a.prospects.length }, campaigns: list, mailReady: hasMail() });
});

export const POST = handle(async (request) => {
  const { user } = await requireStaff(request, 'newsletter');
  if (!hasMail()) return error('L’envoi d’e-mails n’est pas configuré (RESEND_API_KEY et MAIL_FROM).', 503);
  const b = await readJson(request, 60_000);
  const subject = clean(b.subject, 150), title = clean(b.title, 150), body = String(b.body || '').replace(/\r/g, '').slice(0, 20_000).trim();
  const fields = {};
  if (!subject) fields.subject = 'Indiquez l’objet.';
  if (!body) fields.body = 'Rédigez le contenu de la lettre.';
  if (Object.keys(fields).length) return error('Merci de compléter la lettre.', 422, { fields });
  const paragraphs = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  const html = layout(title || subject, `${paragraphs}<p style="margin-top:32px;font-size:11px;color:#75695F">Vous recevez cette lettre car vous êtes inscrit à la correspondance de Maison Archam. <a href="{{desinscription}}" style="color:#75695F">Se désinscrire</a></p>`);
  const base = siteUrl(request);
  if (b.mode === 'test') {
    await rateLimit(request, 'campaign-test', 20, 3600, user.id);
    await sendCampaign(base, [user.email], { subject: `[Test] ${subject}`, html });
    return json({ ok: true, sent: 1, test: true });
  }
  await rateLimit(request, 'campaign-send', 5, 3600, user.id);
  const audience = ['all', 'customers', 'prospects'].includes(b.audience) ? b.audience : 'all';
  const recipients = (await audiences())[audience];
  if (!recipients.length) return error('Aucun abonné dans cette audience.', 422);
  const sent = await sendCampaign(base, recipients, { subject, html });
  const record = { at: new Date().toISOString(), subject, audience, sent, by: `${user.firstName} ${user.lastName}`.trim() };
  await redis('LPUSH', 'campaigns', JSON.stringify(record));
  await audit(request, user, 'newsletter.campagne', { subject, audience, sent });
  return json({ ok: true, sent });
});
