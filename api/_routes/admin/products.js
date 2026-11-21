// /api/admin/products — fiches produits.
// GET : liste · POST : création · PUT : modification · DELETE { id } : suppression (brouillons et archives uniquement)
import { handle, json, error, readJson, clean } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { getProducts, saveProducts, markDirty } from '../../_lib/settings.js';
import { MEDIA } from '../../_lib/content-default.js';
import { audit } from '../../_lib/admin.js';

const STATUSES = ['published', 'draft', 'archived'];
const euroToCents = (v) => { const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const list = (v, max) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => clean(x, 60)).filter(Boolean).slice(0, max);

function parse(b, existing) {
  const fields = {};
  const p = {
    id: existing ? existing.id : clean(b.id, 40).toLowerCase(),
    name: clean(b.name, 80), kind: clean(b.kind, 60) || 'Extrait de parfum', volume: clean(b.volume, 20),
    tagline: clean(b.tagline, 160), description: String(b.description || '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim().slice(0, 2000),
    family: clean(b.family, 120), sillage: clean(b.sillage, 120),
    notes: { top: list(b.notes?.top, 8), heart: list(b.notes?.heart, 8), base: list(b.notes?.base, 8) },
    price: euroToCents(b.price), comparePrice: b.comparePrice === '' || b.comparePrice == null ? null : euroToCents(b.comparePrice),
    stock: b.stock === '' || b.stock == null ? null : Math.floor(Number(b.stock)), stockAlert: b.stockAlert === '' || b.stockAlert == null ? 5 : Math.floor(Number(b.stockAlert)),
    status: STATUSES.includes(b.status) ? b.status : 'draft',
    images: (Array.isArray(b.images) ? b.images : []).filter((x) => MEDIA.includes(x)).slice(0, 8),
  };
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(p.id)) fields.id = 'Référence : 3 à 40 caractères (lettres minuscules, chiffres, tirets).';
  if (!p.name) fields.name = 'Nom requis.';
  if (!p.volume) fields.volume = 'Contenance requise.';
  if (!(p.price >= 100 && p.price <= 10_000_000)) fields.price = 'Prix invalide.';
  if (p.comparePrice !== null && !(p.comparePrice > p.price)) fields.comparePrice = 'Le prix barré doit être supérieur au prix.';
  if (p.stock !== null && !(p.stock >= 0 && p.stock <= 1_000_000)) fields.stock = 'Stock invalide.';
  if (!(p.stockAlert >= 0 && p.stockAlert <= 100_000)) fields.stockAlert = 'Seuil invalide.';
  if (!p.images.length) fields.images = 'Choisissez au moins une photo.';
  return { product: p, fields };
}

export const GET = handle(async (request) => {
  await requireStaff(request, 'products');
  return json({ ok: true, products: await getProducts(), media: MEDIA });
});

async function upsert(request, creating) {
  const { user } = await requireStaff(request, 'products');
  const b = await readJson(request, 20_000);
  const products = await getProducts();
  const i = creating ? -1 : products.findIndex((p) => p.id === b.id);
  if (!creating && i < 0) return error('Fiche introuvable.', 404);
  const { product, fields } = parse(b, creating ? null : products[i]);
  if (creating && products.some((p) => p.id === product.id)) fields.id = 'Cette référence existe déjà.';
  if (!creating && product.status !== 'published' && products[i].status === 'published' && products.filter((p) => p.status === 'published').length === 1) fields.status = 'Au moins une fiche doit rester en ligne.';
  if (Object.keys(fields).length) return error('Certains champs sont à corriger.', 422, { fields });
  product.updatedAt = new Date().toISOString();
  if (creating) products.push(product); else products[i] = product;
  await saveProducts(products);
  await markDirty('produits');
  await audit(request, user, creating ? 'produit.cree' : 'produit.modifie', { id: product.id, price: product.price, stock: product.stock, status: product.status });
  return json({ ok: true, product, products });
}

export const POST = handle((request) => upsert(request, true));
export const PUT = handle((request) => upsert(request, false));

export const DELETE = handle(async (request) => {
  const { user } = await requireStaff(request, 'products');
  const { id } = await readJson(request, 500);
  const products = await getProducts();
  const p = products.find((x) => x.id === id);
  if (!p) return error('Fiche introuvable.', 404);
  if (p.status === 'published') return error('Passez d’abord la fiche en brouillon ou archivée.', 422);
  await saveProducts(products.filter((x) => x.id !== id));
  await markDirty('produits');
  await audit(request, user, 'produit.supprime', { id });
  return json({ ok: true, products: products.filter((x) => x.id !== id) });
});
