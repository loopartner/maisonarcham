// POST /api/cart/quote — recalcule le panier côté serveur. Corps : { items: [{id, qty}], shipping, code }
import { handle, readJson, json, rateLimit } from '../../_lib/http.js';
import { quote } from '../../_lib/pricing.js';

export const POST = handle(async (request) => {
  await rateLimit(request, 'quote', 60, 600);
  const body = await readJson(request, 5_000);
  // Essais de codes promo limités (anti-devinette)
  if (body.code) await rateLimit(request, 'promo-try', 15, 3600);
  return json({ ok: true, quote: await quote(body) });
});
