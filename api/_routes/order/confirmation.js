// GET /api/order/confirmation?payment_intent=pi_…&secret=pi_…_secret_…
// Détail d'une commande juste payée. Le secret client du paiement (connu seulement du navigateur qui a payé)
// est comparé à son empreinte enregistrée à la création du paiement.
import crypto from 'node:crypto';
import { handle, json, error, rateLimit, clean } from '../../_lib/http.js';
import { redis, hasStore } from '../../_lib/store.js';
import { getOrder, publicOrder } from '../../_lib/orders.js';
import { COUNTRIES } from '../../_lib/catalogue.js';

const sha = (s) => crypto.createHash('sha256').update(s).digest();

export const GET = handle(async (request) => {
  if (!hasStore()) return error('Service indisponible.', 503);
  await rateLimit(request, 'order-confirm', 60, 600);
  const q = new URL(request.url).searchParams;
  const pi = clean(q.get('payment_intent'), 100), secret = clean(q.get('secret'), 200);
  if (!/^pi_[A-Za-z0-9]+$/.test(pi) || !secret.startsWith(`${pi}_secret_`)) return error('Lien invalide.', 400);
  const stored = await redis('GET', `pisecret:${pi}`);
  if (!stored || !crypto.timingSafeEqual(Buffer.from(stored, 'hex'), sha(secret))) return error('Commande introuvable.', 404);
  const number = await redis('GET', `pi:${pi}`);
  if (!number || number === 'pending') return json({ ok: true, pending: true });
  const order = await getOrder(number);
  if (!order) return json({ ok: true, pending: true });
  const s = order.shipping || {};
  return json({ ok: true, order: { ...publicOrder(order), email: order.email, name: order.name,
    address: [s.line1, s.line2, [s.postal_code || s.postalCode, s.city].filter(Boolean).join(' '), COUNTRIES[s.country] || s.country].filter(Boolean) } });
});
