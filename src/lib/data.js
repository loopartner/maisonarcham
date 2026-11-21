// Données lues au moment du build : contenu publié depuis le back-office (Upstash Redis) ou valeurs par défaut.
import { defaultProducts, variantOf, DEFAULT_SITE } from '../../api/_lib/settings.js';
import { DEFAULT_ARTICLES, DEFAULT_PAGES } from '../../api/_lib/content-default.js';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const cache = new Map();

async function kvGet(key) {
  if (!url || !token) return null;
  if (cache.has(key)) return cache.get(key);
  const p = fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(['GET', key]) })
    .then((r) => r.json()).then((d) => (d.result ? JSON.parse(d.result) : null))
    .catch((e) => { console.warn(`[build] ${key} indisponible, contenu par défaut :`, e.message); return null; });
  cache.set(key, p);
  return p;
}

// Champ traduit : p.nameEn en anglais s'il existe, sinon le champ français.
export const loc = (obj, field, lang) => (lang === 'en' && obj?.[`${field}En`]) || obj?.[field] || '';

export async function getProducts() {
  const saved = await kvGet('cms:products');
  return (Array.isArray(saved) && saved.length ? saved : defaultProducts()).filter((p) => p.status === 'published').sort((a, b) => a.price - b.price);
}
export async function getMainProduct() {
  const list = await getProducts();
  return list.find((p) => p.featured) || list[list.length - 1];
}
export { variantOf };

export async function getArticles(lang) {
  const saved = await kvGet('cms:articles');
  const today = new Date().toISOString().slice(0, 10);
  const list = Array.isArray(saved) ? saved.filter((a) => a.status === 'published' && a.date <= today) : DEFAULT_ARTICLES;
  // En anglais, seuls les articles traduits sont publiés.
  return list.filter((a) => lang !== 'en' || (a.titleEn && a.bodyEn)).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPages() {
  const saved = await kvGet('cms:pages');
  return { maison: { sections: { ...DEFAULT_PAGES.maison.sections, ...(saved?.maison?.sections || {}) } }, newsletter: { ...DEFAULT_PAGES.newsletter, ...(saved?.newsletter || {}) } };
}

export async function getSite() {
  const saved = await kvGet('cms:site');
  return { ...DEFAULT_SITE, ...(saved || {}), company: { ...DEFAULT_SITE.company, ...(saved?.company || {}) } };
}

// Titre enrichi : tout est échappé, seule la balise <em> (italique) est conservée.
export const rich = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])).replace(/&lt;(\/?)em&gt;/g, '<$1em>');
