// POST /api/admin-order — mise à jour du statut d'une commande (réservé à la Maison).
// En-tête : Authorization: Bearer <ADMIN_TOKEN>
// Corps   : { number: 'MA-10001', status: 'expediee', trackingUrl: 'https://...' }
// Le client reçoit un e-mail quand la commande passe en « expediee ».
import crypto from 'node:crypto';
import { env } from './_lib/env.js';
import { handle, readJson, json, error, escapeHtml, HttpError } from './_lib/http.js';
import { hasStore } from './_lib/store.js';
import { getOrder, saveOrder, STATUSES } from './_lib/orders.js';
import { sendMail, layout } from './_lib/mail.js';

function authorized(request) {
  const token = env('ADMIN_TOKEN');
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || token.length < 16 || given.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token));
}

export const POST = handle(async (request) => {
  if (!authorized(request)) return error('Accès refusé.', 401);
  if (!hasStore()) return error('Base non configurée.', 503);
  const body = await readJson(request);
  const order = await getOrder(String(body.number || ''));
  if (!order) throw new HttpError('Commande introuvable.', 404);
  if (!STATUSES[body.status]) throw new HttpError(`Statut inconnu. Valeurs possibles : ${Object.keys(STATUSES).join(', ')}`);
  if (body.trackingUrl && !/^https:\/\//.test(body.trackingUrl)) throw new HttpError('Lien de suivi invalide (https://…).');

  const previous = order.status;
  order.status = body.status;
  if (body.trackingUrl) order.trackingUrl = body.trackingUrl;
  order.history = [...(order.history || []), { status: body.status, at: new Date().toISOString() }];
  await saveOrder(order);

  if (body.status === 'expediee' && previous !== 'expediee' && order.email) {
    await sendMail({
      to: order.email,
      subject: `Votre commande ${order.number} est en route`,
      html: layout('Votre commande est en route', `<p>Bonjour ${escapeHtml(order.name)},</p>
        <p>Votre commande <strong>${order.number}</strong> vient de quitter notre atelier.</p>
        ${order.trackingUrl ? `<p><a href="${escapeHtml(order.trackingUrl)}" style="color:#1f2a2e">Suivre le colis</a></p>` : ''}`),
    }).catch((e) => console.error(e));
  }
  return json({ ok: true, number: order.number, status: order.status });
});

// GET /api/admin-order — liste des 50 dernières commandes
export const GET = handle(async (request) => {
  if (!authorized(request)) return error('Accès refusé.', 401);
  if (!hasStore()) return error('Base non configurée.', 503);
  const { redis } = await import('./_lib/store.js');
  const numbers = await redis('LRANGE', 'orders', 0, 49);
  const orders = await Promise.all(numbers.map((n) => getOrder(n)));
  return json({ ok: true, orders: orders.filter(Boolean) });
});
