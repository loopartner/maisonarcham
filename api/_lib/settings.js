// Données gérées depuis le back-office : fiches produits, livraison, réglages de la maison.
// Tant que rien n'a été enregistré en base, les valeurs par défaut du code (catalogue.js) s'appliquent.
import { PRODUCTS, SHIPPING } from './catalogue.js';
import { hasStore, getJson, setJson, redis } from './store.js';
import { DEFAULT_ARTICLES, DEFAULT_PAGES } from './content-default.js';

const KEYS = { products: 'cms:products', shipping: 'cms:shipping', site: 'cms:site', articles: 'cms:articles', pages: 'cms:pages' };

export function defaultProducts() {
  return Object.entries(PRODUCTS).map(([id, p]) => ({
    id, name: p.name.replace(/'/g, '’'), kind: 'Extrait de parfum', volume: (p.variant.split('·').pop() || '').trim(),
    tagline: 'Une signature gourmande, élégante et enveloppante.',
    taglineEn: 'A gourmand, elegant and enveloping signature.',
    descriptionEn: 'A refined vanilla with caramelised accents, conceived to offer a subtle and sophisticated indulgence.',
    familyEn: 'Gourmand · Vanilla · Musky', sillageEn: 'Warm · Enveloping · Elegant', kindEn: 'Extrait de parfum',
    notesEn: { top: ['Caramel', 'Powdery', 'Honey'], heart: ['Madagascar vanilla', 'Tonka bean'], base: ['White musk'] },
    description: 'Une vanille raffinée aux accents caramélisés, pensée pour offrir une gourmandise subtile et sophistiquée.',
    family: 'Gourmande · Vanillée · Musquée', sillage: 'Chaleureux · Enveloppant · Élégant',
    notes: { top: ['Caramel', 'Poudrée', 'Miel'], heart: ['Vanille de Madagascar', 'Fève de tonka'], base: ['Musc blanc'] },
    price: p.price, comparePrice: null, stock: null, stockAlert: 5, status: 'published', featured: p.featured === true,
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

export async function getArticles() {
  const saved = hasStore() ? await getJson(KEYS.articles).catch(() => null) : null;
  return Array.isArray(saved) ? saved : DEFAULT_ARTICLES.map((a) => ({ ...a }));
}
export const saveArticles = (list) => setJson(KEYS.articles, list);

export async function getPages() {
  const saved = hasStore() ? await getJson(KEYS.pages).catch(() => null) : null;
  return { maison: { sections: { ...DEFAULT_PAGES.maison.sections, ...(saved?.maison?.sections || {}) } }, newsletter: { ...DEFAULT_PAGES.newsletter, ...(saved?.newsletter || {}) } };
}
export const savePages = (v) => setJson(KEYS.pages, v);

// Contenu modifié depuis la dernière publication du site ?
export async function markDirty(what) { await redis('HSET', 'cms:dirty', what, new Date().toISOString()); }
