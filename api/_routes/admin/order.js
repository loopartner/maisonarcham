// GET  /api/admin/order?n=MA-10001 — détail complet d'une commande.
// POST /api/admin/order — mise à jour. Corps : { number, status, carrier, trackingNumber, notify }
import { handle, json, error, readJson, clean, escapeHtml, siteUrl } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { getOrder, saveOrder, STATUSES, EDITABLE_STATUSES, CARRIERS, normStatus } from '../../_lib/orders.js';
import { getUserByEmail } from '../../_lib/auth.js';
import { sendMail, layout } from '../../_lib/mail.js';
import { audit } from '../../_lib/admin.js';
import { COUNTRIES } from '../../_lib/catalogue.js';

const validNumber = (n) => /^MA-\d{4,8}$/.test(n);

function detail(o, customerId) {
  const s = o.shipping || {};
  return { ...o, status: normStatus(o.status), statusLabel: STATUSES[o.status] || o.status, customerId,
    address: [s.line1, s.line2, [s.postal_code || s.postalCode, s.city].filter(Boolean).join(' '), COUNTRIES[s.country] || s.country].filter(Boolean).join(', ') };
}

export const GET = handle(async (request) => {
  await requireStaff(request, 'orders');
  const n = clean(new URL(request.url).searchParams.get('n'), 20).toUpperCase();
  const o = validNumber(n) ? await getOrder(n) : null;
  if (!o) return error('Commande introuvable.', 404);
  const customer = o.email ? await getUserByEmail(o.email) : null;
  return json({ ok: true, order: detail(o, customer?.emailVerified ? customer.id : null), statuses: EDITABLE_STATUSES.map((id) => ({ id, label: STATUSES[id] })), carriers: Object.entries(CARRIERS).map(([id, c]) => ({ id, label: c.label })) });
});

const MAILS = {
  preparation: ['est en préparation', 'Votre commande est en cours de préparation et de mise en écrin dans notre atelier.'],
  expediee: ['a été expédiée', 'Bonne nouvelle : votre commande vient de quitter notre atelier.'],
  livree: ['a été livrée', 'Votre commande a été livrée. Nous espérons que Crème d’Ararat vous accompagnera longtemps.'],
  annulee: ['a été annulée', 'Votre commande a été annulée. Si un paiement a été effectué, il vous sera intégralement remboursé.'],
  remboursee: ['a été remboursée', 'Le remboursement de votre commande a été effectué. Il apparaîtra sur votre relevé sous quelques jours.'],
};

export const POST = handle(async (request) => {
  const { user } = await requireStaff(request, 'orders');
  const b = await readJson(request, 2_000);
  const n = clean(b.number, 20).toUpperCase();
  const o = validNumber(n) ? await getOrder(n) : null;
  if (!o) return error('Commande introuvable.', 404);
  const status = clean(b.status, 20);
  if (!EDITABLE_STATUSES.includes(status)) return error('Statut invalide.', 422);
  const carrier = b.carrier ? clean(b.carrier, 20) : '';
  if (carrier && !CARRIERS[carrier]) return error('Transporteur invalide.', 422);
  const trackingNumber = clean(b.trackingNumber, 40).replace(/[^A-Za-z0-9 -]/g, '');
  if (status === 'expediee' && !trackingNumber) return error('Indiquez le numéro de suivi pour une commande expédiée.', 422, { fields: { trackingNumber: 'Numéro de suivi requis.' } });

  const before = normStatus(o.status), now = new Date().toISOString(), by = `${user.firstName} ${user.lastName}`.trim();
  const changes = [];
  if (status !== before) { o.status = status; o.history = [...(o.history || []), { status, at: now, by }]; changes.push(`statut : ${STATUSES[before] || before} → ${STATUSES[status]}`); }
  if (carrier !== (o.carrierId || '') || trackingNumber !== (o.trackingNumber || '')) {
    o.carrierId = carrier || null; o.carrier = carrier ? CARRIERS[carrier].label : null;
    o.trackingNumber = trackingNumber || null; o.trackingUrl = carrier && trackingNumber ? CARRIERS[carrier].url(trackingNumber) : null;
    o.history = [...(o.history || []), { event: 'suivi', at: now, by, note: trackingNumber ? `${o.carrier || ''} ${trackingNumber}`.trim() : 'Suivi retiré' }];
    changes.push('suivi d’expédition');
  }
  if (!changes.length) return json({ ok: true, order: detail(o), notified: false });
  o.updatedAt = now;

  let notified = false;
  if (b.notify === true && o.email && status !== before && MAILS[status]) {
    const [subj, text] = MAILS[status];
    const track = status === 'expediee' && o.trackingUrl ? `<p>Transporteur : ${escapeHtml(o.carrier)} · Nº de suivi <strong>${escapeHtml(o.trackingNumber)}</strong></p><p><a href="${escapeHtml(o.trackingUrl)}" style="color:#241A16">Suivre mon colis</a></p>` : '';
    await sendMail({ to: o.email, subject: `Votre commande ${o.number} ${subj} — Maison Archam`,
      html: layout(`Commande ${o.number}`, `<p>Bonjour ${escapeHtml(String(o.name || '').split(' ')[0])},</p><p>${text}</p>${track}<p>Retrouvez le détail dans <a href="${escapeHtml(siteUrl(request))}/compte" style="color:#241A16">votre espace client</a>.</p>`) })
      .then(() => { notified = true; o.history.push({ event: 'notification', at: now, by, note: `E-mail « ${subj} » envoyé` }); })
      .catch((e) => console.error('Notification client :', e.message));
  }
  await saveOrder(o);
  await audit(request, user, 'commande.modifiee', { number: o.number, changes });
  return json({ ok: true, order: detail(o), notified });
});
