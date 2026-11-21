// /api/admin/articles — articles du Journal.
// GET : liste · POST : création · PUT : modification · DELETE { slug } : suppression
// Le corps s'écrit en texte simple : paragraphes séparés par une ligne vide, « ## » pour un intertitre,
// « > » pour une citation, « [galerie] » pour la galerie de photos. Le premier paragraphe sert de chapô.
import { handle, json, error, readJson, clean } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { getArticles, saveArticles, markDirty } from '../../_lib/settings.js';
import { MEDIA } from '../../_lib/content-default.js';
import { audit } from '../../_lib/admin.js';

export const CATEGORIES = ['Art de vivre', 'Parfumerie', 'Inspiration', 'Savoir-faire', 'La Maison', 'Coulisses'];
const STATUSES = ['published', 'scheduled', 'draft'];

export const slugify = (t) => String(t).replace(/<\/?em>/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);

export function textToBlocks(text) {
  const blocks = [];
  String(text || '').replace(/\r/g, '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).slice(0, 80).forEach((para, i) => {
    if (para === '[galerie]') blocks.push({ t: 'gallery' });
    else if (para.startsWith('## ')) blocks.push({ t: 'h2', x: clean(para.slice(3), 200) });
    else if (para.startsWith('> ')) { const [q, by] = para.slice(2).split(/\n—\s*/); blocks.push({ t: 'quote', x: clean(q, 400), ...(by ? { by: clean(by, 100) } : {}) }); }
    else blocks.push({ t: blocks.length === 0 && i === 0 ? 'lead' : 'p', x: para.replace(/\s*\n\s*/g, ' ').slice(0, 3000) });
  });
  return blocks;
}
export function blocksToText(blocks) {
  return (blocks || []).map((b) => (b.t === 'gallery' ? '[galerie]' : b.t === 'h2' ? `## ${b.x}` : b.t === 'quote' ? `> ${b.x}${b.by ? `\n— ${b.by}` : ''}` : b.x)).join('\n\n');
}

function parse(b, existing) {
  const fields = {};
  // Titre : seul l'italique est autorisé (balise <em>), tout autre balisage est retiré.
  const title = clean(b.title, 200).replace(/<(?!\/?em>)[^>]*>/g, '');
  const a = {
    slug: existing ? existing.slug : slugify(b.slug || title),
    title, category: CATEGORIES.includes(b.category) ? b.category : 'Parfumerie',
    date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10),
    status: STATUSES.includes(b.status) ? b.status : 'draft', featured: b.featured === true,
    excerpt: clean(b.excerpt, 300), image: MEDIA.includes(b.image) ? b.image : '', imageAlt: clean(b.imageAlt, 160), caption: clean(b.caption, 200),
    gallery: (Array.isArray(b.gallery) ? b.gallery : []).filter((g) => MEDIA.includes(g)).slice(0, 4).map((src) => ({ src, alt: '' })),
    body: textToBlocks(b.body),
  };
  if (a.status === 'scheduled' && a.date <= new Date().toISOString().slice(0, 10)) a.status = 'published';
  if (!a.title) fields.title = 'Titre requis.';
  if (!a.slug || a.slug.length < 3) fields.title = fields.title || 'Titre trop court.';
  if (!a.excerpt) fields.excerpt = 'Chapô requis.';
  if (!a.image) fields.image = 'Choisissez une image.';
  if (!a.body.length) fields.body = 'Rédigez le corps de l’article.';
  return { article: a, fields };
}

export const GET = handle(async (request) => {
  await requireStaff(request, 'content');
  const articles = (await getArticles()).map((a) => ({ ...a, bodyText: blocksToText(a.body) })).sort((x, y) => y.date.localeCompare(x.date));
  return json({ ok: true, articles, categories: CATEGORIES, media: MEDIA });
});

async function upsert(request, creating) {
  const { user } = await requireStaff(request, 'content');
  const b = await readJson(request, 60_000);
  const articles = await getArticles();
  const i = creating ? -1 : articles.findIndex((a) => a.slug === b.slug);
  if (!creating && i < 0) return error('Article introuvable.', 404);
  const { article, fields } = parse(b, creating ? null : articles[i]);
  if (creating && articles.some((a) => a.slug === article.slug)) fields.title = 'Un article porte déjà ce titre.';
  if (Object.keys(fields).length) return error('Certains champs sont à corriger.', 422, { fields });
  article.updatedAt = new Date().toISOString();
  if (article.featured) articles.forEach((a) => { a.featured = false; });
  if (creating) articles.push(article); else articles[i] = article;
  await saveArticles(articles);
  await markDirty('journal');
  await audit(request, user, creating ? 'article.cree' : 'article.modifie', { slug: article.slug, status: article.status });
  return json({ ok: true, article: { ...article, bodyText: blocksToText(article.body) } });
}
export const POST = handle((request) => upsert(request, true));
export const PUT = handle((request) => upsert(request, false));

export const DELETE = handle(async (request) => {
  const { user } = await requireStaff(request, 'content');
  const { slug } = await readJson(request, 500);
  const articles = await getArticles();
  if (!articles.some((a) => a.slug === slug)) return error('Article introuvable.', 404);
  await saveArticles(articles.filter((a) => a.slug !== slug));
  await markDirty('journal');
  await audit(request, user, 'article.supprime', { slug });
  return json({ ok: true });
});
