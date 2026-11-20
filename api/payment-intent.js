// POST /api/payment-intent — prépare le paiement par carte sur la page commande.html (Stripe Payment Element).
// Corps : { items: [{ id, qty }], customer: { email, phone, firstName, lastName, line1, line2, postalCode, city, country } }
// Réponse : { ok, clientSecret, publishableKey, amount }
import { env } from './_lib/env.js';
import { handle, readJson, json, error, rateLimit, isEmail, clean, HttpError } from './_lib/http.js';
import { PRODUCTS, MAX_QTY } from './_lib/catalogue.js';

export const POST = handle(async (request) => {
  const secret = env('STRIPE_SECRET_KEY');
  // La clé publiable est faite pour être publique (elle s'affiche dans le navigateur) : on garde la clé de test par défaut.
  // La clé SECRÈTE, elle, ne doit jamais être dans le code : uniquement dans les variables d'environnement Vercel.
  const publishableKey = env('STRIPE_PUBLISHABLE_KEY', 'pk_test_51UcqBlGvSTP81gYItbPGzscKXjYFh1OaFg6WvGhHRb5M3h12pGIdZCBvNQchOl2xpvG2zwNJEepb21NaXe4Yx7wH00VX1CyKxZ');
  if (!secret || !publishableKey) return error("Le paiement en ligne n'est pas encore activé.", 503);
  await rateLimit(request, 'payment', 20, 600);

  const { items, customer = {} } = await readJson(request);
  console.log('[paiement] demande reçue', Array.isArray(items) ? items.length : 0, 'article(s)');
  if (!Array.isArray(items) || items.length === 0) throw new HttpError('Votre panier est vide.');
  const lines = items.map((i) => {
    const p = PRODUCTS[i?.id];
    const qty = Number.parseInt(i?.qty, 10);
    if (!p) throw new HttpError('Produit inconnu.');
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new HttpError('Quantité invalide.');
    return { id: i.id, p, qty };
  });
  const amount = lines.reduce((sum, l) => sum + l.p.price * l.qty, 0);

  const c = {
    email: clean(customer.email, 254).toLowerCase(),
    phone: clean(customer.phone, 30),
    firstName: clean(customer.firstName, 60),
    lastName: clean(customer.lastName, 60),
    line1: clean(customer.line1, 120),
    line2: clean(customer.line2, 120),
    postalCode: clean(customer.postalCode, 12),
    city: clean(customer.city, 80),
    country: clean(customer.country, 2).toUpperCase() || 'FR',
  };
  const allowed = env('SHIPPING_COUNTRIES', 'FR').split(',').map((x) => x.trim().toUpperCase());
  if (!isEmail(c.email)) throw new HttpError('Adresse e-mail invalide.');
  if (!c.firstName || !c.lastName) throw new HttpError('Merci d’indiquer votre prénom et votre nom.');
  if (!c.line1 || !c.postalCode || !c.city) throw new HttpError('Adresse de livraison incomplète.');
  if (!allowed.includes(c.country)) throw new HttpError('Nous ne livrons pas encore ce pays.');
  if (c.country === 'FR' && !/^\d{5}$/.test(c.postalCode)) throw new HttpError('Code postal invalide.');

  const name = `${c.firstName} ${c.lastName}`;
  const f = new URLSearchParams();
  f.set('amount', String(amount));
  f.set('currency', 'eur');
  f.set('automatic_payment_methods[enabled]', 'true');
  f.set('description', lines.map((l) => `${l.p.name} × ${l.qty}`).join(', '));
  f.set('receipt_email', c.email);
  f.set('shipping[name]', name);
  if (c.phone) f.set('shipping[phone]', c.phone);
  f.set('shipping[address][line1]', c.line1);
  if (c.line2) f.set('shipping[address][line2]', c.line2);
  f.set('shipping[address][postal_code]', c.postalCode);
  f.set('shipping[address][city]', c.city);
  f.set('shipping[address][country]', c.country);
  f.set('metadata[cart]', JSON.stringify(lines.map((l) => [l.id, l.qty])));
  f.set('metadata[email]', c.email);
  f.set('metadata[source]', 'site');

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: f,
  });
  const data = await res.json();
  if (!res.ok) { console.error('[paiement] refus Stripe', res.status, data?.error?.code, data?.error?.message); return error('Le paiement est momentanément indisponible.', 502); }
  console.log('[paiement] PaymentIntent créé', data.id, amount / 100, '€', 'livemode=' + data.livemode);
  return json({ ok: true, clientSecret: data.client_secret, publishableKey, amount });
});
