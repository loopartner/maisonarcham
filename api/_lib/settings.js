// Données gérées depuis le back-office : fiches produits, livraison, réglages de la maison.
// Tant que rien n'a été enregistré en base, les valeurs par défaut du code (catalogue.js) s'appliquent.
import { PRODUCTS, SHIPPING } from './catalogue.js';
import { hasStore, getJson, setJson } from './store.js';

const KEYS = { products: 'cms:products', shipping: 'cms:shipping', site: 'cms:site' };

export function defaultProducts() {
  return Object.entries(PRODUCTS).map(([id, p]) => ({
    id, name: p.name.replace(/'/g, '’'), kind: 'Extrait de parfum', volume: (p.variant.split('·').pop() || '').trim(),
    tagline: 'Une signature gourmande, élégante et enveloppante.',
    description: 'Une vanille raffinée aux accents caramélisés, pensée pour offrir une gourmandise subtile et sophistiquée.',
    family: 'Gourmande · Vanillée · Musquée', sillage: 'Chaleureux · Enveloppant · Élégant',
    notes: { top: ['Caramel', 'Poudrée', 'Miel'], heart: ['Vanille de Madagascar', 'Fève de tonka'], base: ['Musc blanc'] },
    price: p.price, comparePrice: null, stock: null, stockAlert: 5, status: 'published',
    images: [p.image, '/assets/img/flacon-hero.webp', '/assets/img/notes-coeur-fond.webp', '/assets/img/notes-tete.webp'],
    updatedAt: null,
  }));
}

export async function getProducts() {
  const saved = hasStore() ? await getJson(KEYS.products).catch(() => null) : null;
  return Array.isArray(saved) && saved.length ? saved : defaultProducts();
}
export const saveProducts = (list) => setJson(KEYS.products, list);

export const variantOf = (p) => [p.kind, p.volume].filter(Boolean).join(' · ');

// Catalogue vendable : fiches publiées, au format attendu par le calcul des prix.
export async function getCatalogue() {
  const out = {};
  for (const p of await getProducts()) {
    if (p.status !== 'published') continue;
    out[p.id] = { name: p.name, variant: variantOf(p), price: p.price, comparePrice: p.comparePrice || null, image: (p.images || [])[0] || '', stock: p.stock };
  }
  return out;
}

export async function getShipping() {
  const saved = hasStore() ? await getJson(KEYS.shipping).catch(() => null) : null;
  const out = {};
  for (const [id, def] of Object.entries(SHIPPING)) {
    const s = { ...def, enabled: true, ...(saved?.[id] || {}) };
    if (s.enabled) out[id] = s;
  }
  return out;
}
export async function getShippingAll() {
  const saved = hasStore() ? await getJson(KEYS.shipping).catch(() => null) : null;
  return Object.fromEntries(Object.entries(SHIPPING).map(([id, def]) => [id, { ...def, enabled: true, ...(saved?.[id] || {}) }]));
}
export const saveShipping = (v) => setJson(KEYS.shipping, v);

export const DEFAULT_SITE = {
  company: { name: 'Maison Archam', siret: '', email: 'contact@maison-archam.fr', phone: '', address: '' },
  seoTitle: 'Maison Archam — Crème d’Ararat, extrait de parfum',
  notifications: { newOrder: true, lowStock: true },
};
export async function getSite() {
  const saved = hasStore() ? await getJson(KEYS.site).catch(() => null) : null;
  return { ...DEFAULT_SITE, ...(saved || {}), company: { ...DEFAULT_SITE.company, ...(saved?.company || {}) }, notifications: { ...DEFAULT_SITE.notifications, ...(saved?.notifications || {}) } };
}
export const saveSite = (v) => setJson(KEYS.site, v);
