// Calcul du montant d'une commande — utilisé par le panier ET par le paiement.
// Rien de ce qui vient du navigateur n'est cru : seuls les identifiants et quantités sont lus.
import { PRODUCTS, MAX_QTY, SHIPPING, DEFAULT_SHIPPING } from './catalogue.js';
import { allowedCountries } from './customer.js';
import { HttpError, clean } from './http.js';
import { hasStore, getJson } from './store.js';

export const normCode = (c) => clean(c, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, '');

export function parseItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) throw new HttpError('Votre panier est vide.', 400);
  const merged = new Map();
  for (const it of raw) {
    const id = String(it?.id || '');
    const qty = Math.floor(Number(it?.qty ?? it?.quantity));
    if (!Object.prototype.hasOwnProperty.call(PRODUCTS, id)) throw new HttpError('Un article de votre panier n’est plus disponible.', 400);
    if (!(qty >= 1)) throw new HttpError('Quantité invalide.', 400);
    merged.set(id, Math.min((merged.get(id) || 0) + qty, MAX_QTY));
  }
  return [...merged].map(([id, qty]) => ({ id, qty }));
}

// Code promo : { type: 'percent' | 'amount', value, active, expiresAt?, minSubtotal?, maxUses?, uses? }
export async function findPromo(code) {
  if (!code || !hasStore()) return null;
  const p = await getJson(`promo:${code}`);
  if (!p || p.active === false) return null;
  if (p.expiresAt && Date.parse(p.expiresAt) < Date.now()) return null;
  if (p.maxUses && (p.uses || 0) >= p.maxUses) return null;
  return { code, ...p };
}

export async function quote({ items, shipping, code }) {
  const lines = parseItems(items).map(({ id, qty }) => {
    const p = PRODUCTS[id];
    return { id, name: p.name.replace(/'/g, '’'), variant: p.variant, image: p.image, unit: p.price, qty, total: p.price * qty };
  });
  const subtotal = lines.reduce((n, l) => n + l.total, 0);
  const shipId = Object.prototype.hasOwnProperty.call(SHIPPING, shipping) ? shipping : DEFAULT_SHIPPING;
  const ship = SHIPPING[shipId];

  let discount = 0, promo = null, promoError = null;
  const c = normCode(code);
  if (c) {
    const p = await findPromo(c);
    if (!p) promoError = 'Ce code n’est pas valide.';
    else if (p.minSubtotal && subtotal < p.minSubtotal) promoError = `Ce code s’applique à partir de ${(p.minSubtotal / 100).toLocaleString('fr-FR')} € d’achat.`;
    else {
      discount = p.type === 'amount' ? Math.min(subtotal, Math.round(p.value)) : Math.round(subtotal * Math.min(100, Math.max(0, p.value)) / 100);
      promo = { code: c, label: p.type === 'amount' ? `Code ${c}` : `Code ${c} (−${p.value} %)` };
    }
  }
  return {
    lines, subtotal, discount, promo, promoError,
    shipping: { id: shipId, label: ship.label, price: ship.price },
    shippingOptions: Object.entries(SHIPPING).map(([id, s]) => ({ id, label: s.label, title: s.title, detail: s.detail, price: s.price })),
    countries: allowedCountries(),
    total: subtotal - discount + ship.price,
    currency: 'eur',
  };
}
