// POST /api/checkout/validate — vérifie la commande avant paiement : panier, livraison, code promo, coordonnées, CGV.
// Corps : { items, shipping, code, customer: {...}, acceptTerms: true }
import { handle, readJson, json, error, rateLimit } from '../../_lib/http.js';
import { quote } from '../../_lib/pricing.js';
import { parseCustomer } from '../../_lib/customer.js';
import { env } from '../../_lib/env.js';

export const POST = handle(async (request) => {
  await rateLimit(request, 'checkout-validate', 30, 600);
  const body = await readJson(request, 10_000);
  const q = await quote(body);
  const { customer, errors } = parseCustomer(body.customer);
  if (body.acceptTerms !== true) errors.acceptTerms = 'Merci d’accepter les conditions générales de vente.';
  if (q.promoError && body.code) errors.code = q.promoError;
  if (Object.keys(errors).length) return error('Merci de vérifier les champs indiqués.', 422, { fields: errors, quote: q });
  const paymentReady = Boolean(env('STRIPE_SECRET_KEY'));
  return json({ ok: true, quote: q, customer: { email: customer.email, firstName: customer.firstName }, paymentReady });
});
