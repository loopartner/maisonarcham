// GET /api/order?number=MA-10001&email=...   → suivi d'une commande (le numéro ET l'e-mail doivent correspondre)
// GET /api/order?payment_intent=pi_... (ou session_id=cs_...) → numéro de commande après paiement (page merci)
import { handle, json, error, rateLimit, isEmail, clean } from '../../_lib/http.js';
import { redis, hasStore } from '../../_lib/store.js';
import { getOrder, publicOrder } from '../../_lib/orders.js';

export const GET = handle(async (request) => {
  if (!hasStore()) return error("Le suivi en ligne n'est pas encore activé.", 503);
  const q = new URL(request.url).searchParams;

  const sessionId = clean(q.get('session_id'), 200);
  const piId = clean(q.get('payment_intent'), 200);
  if (sessionId || piId) {
    if (sessionId && !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return error('Session invalide.');
    if (piId && !/^pi_[A-Za-z0-9_]+$/.test(piId)) return error('Paiement invalide.');
    const number = await redis('GET', sessionId ? `session:${sessionId}` : `pi:${piId}`);
    if (!number || number === 'pending') return json({ ok: true, pending: true });
    return json({ ok: true, number });
  }

  await rateLimit(request, 'order', 10, 600);
  const number = clean(q.get('number'), 20).toUpperCase();
  const email = clean(q.get('email'), 254).toLowerCase();
  if (!/^MA-\d{5,}$/.test(number) || !isEmail(email)) return error('Vérifiez le numéro de commande et l’adresse e-mail.');
  const order = await getOrder(number);
  if (!order || order.email !== email) return error('Aucune commande ne correspond à ces informations.', 404);
  return json({ ok: true, order: publicOrder(order) });
});
