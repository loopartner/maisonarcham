// GET /api/account/order?n=MA-10001 — détail d'une commande du compte (404 si elle ne lui appartient pas).
import { handle, json, error, clean } from '../../_lib/http.js';
import { requireUser } from '../../_lib/auth.js';
import { ownsOrder } from '../../_lib/account.js';
import { getOrder, publicOrder } from '../../_lib/orders.js';
import { COUNTRIES } from '../../_lib/catalogue.js';

export const GET = handle(async (request) => {
  const { user } = await requireUser(request);
  const n = clean(new URL(request.url).searchParams.get('n'), 20).toUpperCase();
  if (!/^MA-\d{4,8}$/.test(n)) return error('Commande introuvable.', 404);
  const order = await getOrder(n);
  if (!ownsOrder(user, order)) return error('Commande introuvable.', 404);
  const s = order.shipping || {};
  return json({ ok: true, order: {
    ...publicOrder(order),
    name: order.name, subtotal: order.subtotal ?? order.items.reduce((t, i) => t + (i.amount || 0), 0),
    address: [s.line1, s.line2, [s.postal_code || s.postalCode, s.city].filter(Boolean).join(' '), COUNTRIES[s.country] || s.country].filter(Boolean),
    carrier: order.carrier || null, trackingNumber: order.trackingNumber || null,
    payment: order.paymentLabel || null, paidAt: order.paidAt || order.createdAt,
  } });
});
