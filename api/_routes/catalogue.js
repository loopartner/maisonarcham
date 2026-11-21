// GET /api/catalogue — catalogue public (fiches publiées) : nom, contenance, prix, image, disponibilité.
import { handle } from '../_lib/http.js';
import { getCatalogue } from '../_lib/settings.js';
import { MAX_QTY } from '../_lib/catalogue.js';

export const GET = handle(async () => {
  const cat = await getCatalogue();
  const products = Object.fromEntries(Object.entries(cat).map(([id, p]) => [id, {
    name: p.name, variant: p.variant, price: p.price, comparePrice: p.comparePrice, image: p.image,
    available: p.stock === null || p.stock === undefined || p.stock > 0,
  }]));
  return new Response(JSON.stringify({ ok: true, maxQty: MAX_QTY, products }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60, s-maxage=60', 'x-content-type-options': 'nosniff' },
  });
});
