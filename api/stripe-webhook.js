// POST /api/stripe-webhook — appelé par Stripe après un paiement.
// Enregistre la commande, lui donne un numéro (MA-10001…) et envoie les e-mails de confirmation.
import crypto from 'node:crypto';
import { env } from './_lib/env.js';
import { json, error, escapeHtml } from './_lib/http.js';
import { redis, hasStore } from './_lib/store.js';
import { sendMail, layout } from './_lib/mail.js';
import { nextOrderNumber, saveOrder } from './_lib/orders.js';
import { PRODUCTS } from './_lib/catalogue.js';

function verify(payload, header, secret, toleranceSec = 300) {
  const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const sigs = String(header || '').split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || sigs.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`, 'utf8').digest('hex');
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

const euro = (cents) => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

export async function POST(request) {
  const secret = env('STRIPE_WEBHOOK_SECRET');
  if (!secret) return error('Webhook non configuré.', 503);
  const payload = await request.text();
  if (!verify(payload, request.headers.get('stripe-signature'), secret)) return error('Signature invalide.', 400);

  const event = JSON.parse(payload);
  let ref, build;
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    if (pi.metadata?.source !== 'site') return json({ received: true, ignored: true }); // paiements Checkout gérés plus bas
    ref = `pi:${pi.id}`;
    build = async (number) => {
      const cart = JSON.parse(pi.metadata.cart || '[]');
      return {
        email: (pi.metadata.email || pi.receipt_email || '').toLowerCase(),
        name: pi.shipping?.name || '',
        phone: pi.shipping?.phone || '',
        shipping: pi.shipping?.address || null,
        items: cart.map(([id, qty]) => ({ name: PRODUCTS[id]?.name || id, quantity: qty, amount: (PRODUCTS[id]?.price || 0) * qty })),
        total: pi.amount_received || pi.amount,
        currency: pi.currency,
        paymentIntent: pi.id,
      };
    };
  } else if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    if (session.payment_status !== 'paid') return json({ received: true, pending: true });
    ref = `session:${session.id}`;
    build = async () => {
      const li = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items?limit=50`, {
        headers: { authorization: `Bearer ${env('STRIPE_SECRET_KEY')}` },
      }).then((r) => r.json());
      const shipping = session.collected_information?.shipping_details || session.shipping_details || null;
      return {
        email: (session.customer_details?.email || session.customer_email || '').toLowerCase(),
        name: shipping?.name || session.customer_details?.name || '',
        phone: session.customer_details?.phone || '',
        shipping: shipping?.address || null,
        items: (li.data || []).map((l) => ({ name: l.description, quantity: l.quantity, amount: l.amount_total })),
        total: session.amount_total,
        currency: session.currency,
        stripeSession: session.id,
        paymentIntent: session.payment_intent,
      };
    };
  } else {
    return json({ received: true });
  }
  if (!hasStore()) { console.error('Paiement reçu mais base non configurée', ref); return error('Base non configurée.', 503); }

  // Idempotence : Stripe peut renvoyer le même événement plusieurs fois
  const lock = await redis('SET', ref, 'pending', 'NX');
  if (lock === null) return json({ received: true, duplicate: true });

  try {
    const number = await nextOrderNumber();
    const order = {
      number,
      ...(await build(number)),
      status: 'confirmee',
      createdAt: new Date().toISOString(),
      history: [{ status: 'confirmee', at: new Date().toISOString() }],
    };
    const email = order.email;
    await saveOrder(order);
    await redis('SET', ref, number);
    await redis('LPUSH', 'orders', number);

    const rows = order.items.map((i) => `<tr><td style="padding:8px 0">${escapeHtml(i.name)} × ${i.quantity}</td><td align="right">${euro(i.amount)}</td></tr>`).join('');
    const recap = `<table width="100%" style="border-top:1px solid #d6d6d2;margin:16px 0">${rows}
      <tr><td style="padding:8px 0">Livraison</td><td align="right">Offerte</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold">Total</td><td align="right" style="font-weight:bold">${euro(order.total)}</td></tr></table>`;

    const site = env('SITE_URL') || '';
    await Promise.allSettled([
      email && sendMail({
        to: email,
        subject: `Votre commande ${number} — Maison Archam`,
        html: layout('Merci pour votre commande', `<p>Bonjour ${escapeHtml(order.name)},</p>
          <p>Votre commande <strong>${number}</strong> est confirmée. Nous la préparons avec soin dans notre atelier parisien, accompagnée de votre échantillon offert.</p>
          ${recap}
          <p>Vous pouvez suivre votre commande à tout moment${site ? ` sur <a href="${site}/suivi.html" style="color:#1f2a2e">notre site</a>` : ''} avec votre numéro de commande et cette adresse e-mail.</p>`),
      }),
      env('ORDERS_NOTIFY_EMAIL') && sendMail({
        to: env('ORDERS_NOTIFY_EMAIL'),
        subject: `Nouvelle commande ${number} — ${euro(order.total)}`,
        html: layout(`Nouvelle commande ${number}`, `<p>${escapeHtml(order.name)} · ${escapeHtml(email)} · ${escapeHtml(order.phone)}</p>${recap}
          <p>${escapeHtml([order.shipping?.line1, order.shipping?.line2, order.shipping?.postal_code, order.shipping?.city, order.shipping?.country].filter(Boolean).join(', '))}</p>`),
      }),
    ]);
    return json({ received: true, number });
  } catch (e) {
    await redis('DEL', ref); // Stripe réessaiera
    console.error(e);
    return error('Erreur de traitement.', 500);
  }
}
