// POST /api/checkout — crée une session de paiement Stripe à partir du panier.
// Corps : { items: [{ id: 'creme-dararat-50', qty: 1 }] }  →  { ok: true, url }
import { env } from '../_lib/env.js';
import { handle, readJson, json, error, siteUrl, rateLimit, HttpError } from '../_lib/http.js';
import { PRODUCTS, MAX_QTY } from '../_lib/catalogue.js';

export const POST = handle(async (request) => {
  const secret = env('STRIPE_SECRET_KEY');
  if (!secret) return error("Le paiement en ligne n'est pas encore activé.", 503);
  await rateLimit(request, 'checkout', 20, 600);

  const { items } = await readJson(request);
  if (!Array.isArray(items) || items.length === 0) throw new HttpError('Votre panier est vide.');

  const lines = items.map((i) => {
    const p = PRODUCTS[i?.id];
    const qty = Number.parseInt(i?.qty, 10);
    if (!p) throw new HttpError('Produit inconnu.');
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new HttpError('Quantité invalide.');
    return { id: i.id, p, qty };
  });

  const site = siteUrl(request);
  const countries = env('SHIPPING_COUNTRIES', 'FR').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('locale', 'fr');
  form.set('success_url', `${site}/merci.html?session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${site}/produit.html?panier=annule`);
  form.set('allow_promotion_codes', 'true');
  form.set('phone_number_collection[enabled]', 'true');
  form.set('shipping_options[0][shipping_rate_data][display_name]', 'Livraison offerte');
  form.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  form.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '0');
  form.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'eur');
  countries.forEach((c, k) => form.set(`shipping_address_collection[allowed_countries][${k}]`, c));
  lines.forEach(({ id, p, qty }, k) => {
    form.set(`line_items[${k}][quantity]`, String(qty));
    form.set(`line_items[${k}][price_data][currency]`, 'eur');
    form.set(`line_items[${k}][price_data][unit_amount]`, String(p.price));
    form.set(`line_items[${k}][price_data][product_data][name]`, p.name);
    form.set(`line_items[${k}][price_data][product_data][description]`, p.variant);
    form.set(`line_items[${k}][price_data][product_data][images][0]`, site + p.image);
    form.set(`line_items[${k}][price_data][product_data][metadata][product_id]`, id);
  });
  form.set('metadata[cart]', JSON.stringify(lines.map(({ id, qty }) => [id, qty])));

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Stripe checkout', data);
    return error('Le paiement est momentanément indisponible.', 502);
  }
  return json({ ok: true, url: data.url });
});
