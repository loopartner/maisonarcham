// Build du site Maison Archam — aucune dépendance npm.
// 1. (l'ancien site a été entièrement remplacé)
// 2. assemble chaque page de src/pages avec les gabarits communs (en-tête, pied de page) ;
// 3. copie les ressources de src/assets en ajoutant une empreinte de version aux CSS/JS.
//
// Chaque page commence par un bloc de métadonnées :
// <!--meta {"title":"…","description":"…","nav":"parfum","layout":"site","scripts":["auth.js"],"noindex":true} -->
import { readFile, writeFile, mkdir, cp, rm, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'public');

const read = (p) => readFile(p, 'utf8');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = path.join(dir, name);
    if ((await stat(p)).isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // 3. Ressources, avec empreinte de contenu pour le cache
  await cp(path.join(SRC, 'assets'), path.join(OUT, 'assets'), { recursive: true });
  const version = {};
  for (const f of await walk(path.join(SRC, 'assets'))) {
    if (/\.(css|js)$/.test(f)) {
      const rel = '/' + path.relative(SRC, f).split(path.sep).join('/');
      version[rel] = createHash('sha256').update(await readFile(f)).digest('hex').slice(0, 10);
    }
  }
  const asset = (rel) => `${rel}?v=${version[rel] || '0'}`;

  // Contenu géré depuis le back-office (Upstash Redis) ; repli sur le contenu du dépôt.
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  async function kvGet(key) {
    if (!kvUrl || !kvToken) return null;
    try {
      const r = await fetch(kvUrl, { method: 'POST', headers: { authorization: `Bearer ${kvToken}`, 'content-type': 'application/json' }, body: JSON.stringify(['GET', key]) });
      const d = await r.json();
      return d.result ? JSON.parse(d.result) : null;
    } catch (e) { console.warn(`Contenu ${key} indisponible, repli sur le dépôt :`, e.message); return null; }
  }
  const { MAX_QTY } = await import(pathToFileURL(path.join(ROOT, 'api/_lib/catalogue.js')).href);
  const { defaultProducts, variantOf } = await import(pathToFileURL(path.join(ROOT, 'api/_lib/settings.js')).href);
  const savedProducts = await kvGet('cms:products');
  const productList = (Array.isArray(savedProducts) && savedProducts.length ? savedProducts : defaultProducts()).filter((p) => p.status === 'published').sort((a, b) => a.price - b.price);
  if (!productList.length) productList.push(defaultProducts()[0]);
  const PRODUCTS = Object.fromEntries(productList.map((p) => [p.id, { name: p.name, variant: variantOf(p), price: p.price, image: (p.images || [])[0] || '' }]));
  console.log(`Catalogue : ${productList.length} fiche(s) ${savedProducts ? 'depuis le back-office' : 'par défaut'}`);
  const typo = (t) => String(t).replace(/'/g, '’');
  const euros = (cents) => (cents % 100 ? (cents / 100).toFixed(2).replace('.', ',') : String(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + '\u00a0€';
  const main = productList.find((p) => p.featured) || productList[productList.length - 1];
  const productId = main.id, product = PRODUCTS[productId];
  const fromPrice = Math.min(...productList.map((p) => p.price));
  const catalogue = { maxQty: MAX_QTY, products: Object.fromEntries(Object.entries(PRODUCTS).map(([id, p]) => [id, { name: typo(p.name), variant: p.variant, price: p.price, image: p.image }])) };
  const catalogueJson = JSON.stringify(catalogue).replace(/</g, '\\u003c');
  const { DEFAULT_ARTICLES, DEFAULT_PAGES, MEDIA } = await import(pathToFileURL(path.join(ROOT, 'api/_lib/content-default.js')).href);
  for (const m of MEDIA) { await stat(path.join(SRC, m)).catch(() => { throw new Error(`Image de la médiathèque absente : ${m}`); }); }
  const savedArticles = await kvGet('cms:articles');
  const savedPages = await kvGet('cms:pages');
  const { DEFAULT_SITE } = await import(pathToFileURL(path.join(ROOT, 'api/_lib/settings.js')).href);
  const savedSite = await kvGet('cms:site');
  const siteCfg = { ...DEFAULT_SITE, ...(savedSite || {}), company: { ...DEFAULT_SITE.company, ...(savedSite?.company || {}) } };
  const pagesCfg = { maison: { sections: { ...DEFAULT_PAGES.maison.sections, ...(savedPages?.maison?.sections || {}) } }, newsletter: { ...DEFAULT_PAGES.newsletter, ...(savedPages?.newsletter || {}) } };
  const today = new Date().toISOString().slice(0, 10);
  const journal = (Array.isArray(savedArticles) ? savedArticles.filter((a) => a.status === 'published' && a.date <= today) : DEFAULT_ARTICLES)
    .sort((a, b) => b.date.localeCompare(a.date));
  console.log(`Journal : ${journal.length} article(s) ${savedArticles ? 'depuis le back-office' : 'du dépôt'}`);
  // Dans le contenu, seul <em> est autorisé (titres) ; tout le reste est échappé.
  const rich = (t) => esc(t).replace(/&lt;(\/?)em&gt;/g, '<$1em>');
  const plain = (t) => String(t).replace(/<\/?em>/g, '');
  const readMin = (a) => Math.max(1, Math.round(a.body.reduce((n, b) => n + (b.x ? b.x.split(/\s+/).length : 0), 0) / 200));
  const frDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const journalCard = (a) => `<a class="j-card" href="/journal/${esc(a.slug)}"><div class="j-img zoom"><img src="${esc(a.image)}" alt="" loading="lazy" width="800" height="1000"></div><p class="eyebrow muted">${esc(a.category)} — ${esc(frDate(a.date))}</p><p class="j-title">${rich(a.title)}</p></a>`;
  const jCats = ['Tous', ...new Set(journal.map((a) => a.category))];
  const jListCard = (a, i) => `<a class="j-card" href="/journal/${esc(a.slug)}" data-cat="${esc(a.category)}"><div class="j-img zoom${i % 3 === 1 ? ' r34' : ''}"><img src="${esc(a.image)}" alt="" loading="lazy" width="800" height="1000"></div><p class="eyebrow muted">${esc(a.category)} · ${esc(frDate(a.date))}</p><h3 class="j-title">${rich(a.title)}</h3><p class="j-excerpt">${esc(a.excerpt)}</p></a>`;
  const featured = journal.find((a) => a.featured) || journal[0];
  const jFeatured = (a) => `<a class="j-feat" href="/journal/${esc(a.slug)}" data-cat="${esc(a.category)}"><div class="j-feat-img zoom"><img src="${esc(a.image)}" alt="${esc(a.imageAlt || '')}" width="1600" height="1100"></div><div class="j-feat-text"><p class="eyebrow muted">À la une — ${esc(a.category)} · ${esc(frDate(a.date))}</p><h2 class="j-feat-title">${rich(a.title)}</h2><p class="body-m j-feat-ex">${esc(a.excerpt)}</p><span class="link-ed self-start">Lire l’article · ${readMin(a)} min</span></div></a>`;
  const vars = {
    'product.id': productId,
    'product.name': esc(typo(product.name)),
    'product.variant': esc(product.variant),
    'product.price': `<span data-price-of="${esc(productId)}">${euros(product.price)}</span>`,
    'product.image': product.image,
    'product.from': euros(fromPrice),
    'product.tagline': esc(main.tagline || ''),
    'product.description': esc(main.description || ''),
    'product.family': esc(main.family || ''),
    'product.sillage': esc(main.sillage || ''),
    'product.top': (main.notes?.top || []).map(esc).join('<br>'),
    'product.heart': (main.notes?.heart || []).map(esc).join('<br>'),
    'product.base': (main.notes?.base || []).map(esc).join('<br>'),
  };
  const thumbs = (main.images || []).map((src, i) => `<button class="pdp-thumb" type="button" aria-pressed="${i === 0}" aria-label="Photo ${i + 1}" data-img="${esc(src)}" data-alt="${esc(typo(product.name))} — photo ${i + 1}"><img src="${esc(src)}" alt="" width="84" height="105"></button>`).join('\n');
  const nlVars = { 'nl.eyebrow': pagesCfg.newsletter.eyebrow, 'nl.title': pagesCfg.newsletter.title, 'nl.text': pagesCfg.newsletter.text, 'nl.confirm': pagesCfg.newsletter.confirm };
  const todo = (v, label) => (v ? esc(v) : `<mark>${label}</mark>`);
  const companyVars = { 'company.name': esc(siteCfg.company.name), 'company.siret': todo(siteCfg.company.siret, 'SIRET'), 'company.vat': todo(siteCfg.company.vat, 'numéro de TVA'), 'company.address': todo(siteCfg.company.address, 'adresse'), 'company.email': esc(siteCfg.company.email || 'contact@maison-archam.fr'), 'company.phone': todo(siteCfg.company.phone, 'numéro') };
  const expand = (html) => html
    .replace(/\{\{(company\.[a-z]+)\}\}/g, (m, k) => (k in companyVars ? companyVars[k] : m))
    .replace(/\{\{(nl\.[a-z]+)\}\}/g, (m, k) => (k in nlVars ? esc(nlVars[k]) : m))
    .replace(/<!--section:([a-z]+)-->([\s\S]*?)<!--\/section:\1-->/g, (m, id, inner) => (pagesCfg.maison.sections[id] === false ? '' : inner))
    .replace(/\{\{(product\.[a-z]+)\}\}/g, (m, k) => (k in vars ? vars[k] : m))
    .replace(/<!--product-thumbs-->/g, () => thumbs)
    .replace(/<!--size-options-->/g, () => Object.entries(PRODUCTS).map(([id, p], i) =>
      `<button class="size-opt" type="button" aria-pressed="${id === productId}" data-size="${esc(id)}" data-price="${p.price}">${esc(p.variant.split('·').pop().trim())} — ${euros(p.price)}</button>`).join(''))
    .replace(/<!--journal-cats-->/g, () => jCats.map((c, i) => `<button class="j-cat" type="button" aria-pressed="${i === 0}" data-filter="${esc(c)}">${esc(c)}</button>`).join(''))
    .replace(/<!--journal-featured-->/g, () => (featured ? jFeatured(featured) : ''))
    .replace(/<!--journal-list-->/g, () => journal.filter((a) => a !== featured).map(jListCard).join('\n'))
    .replace(/<!--journal-cards (\d+)-->/g, (_, n) => journal.slice(0, Number(n)).map(journalCard).join('\n'));

  // 2. Pages
  const partial = {};
  for (const name of ['head', 'header', 'footer', 'admin-nav', 'cart-drawer', 'checkout-header']) {
    partial[name] = await read(path.join(SRC, 'partials', `${name}.html`)).catch(() => '');
  }

  const pageFiles = (await walk(path.join(SRC, 'pages'))).filter((f) => f.endsWith('.html'));
  const pages = await Promise.all(pageFiles.map(async (file) => ({ file, raw: await read(file), rel: path.relative(path.join(SRC, 'pages'), file) })));
  const articleTpl = await read(path.join(SRC, 'templates/article.html'));
  for (const a of journal) {
    const block = (b) => ({
      lead: () => `<p class="a-lead serif">${esc(b.x)}</p>`,
      p: () => `<p>${esc(b.x)}</p>`,
      h2: () => `<h2 class="a-h2">${esc(b.x)}</h2>`,
      quote: () => `</div><blockquote class="a-quote"><p class="serif">${esc(b.x)}</p>${b.by ? `<footer class="eyebrow muted">${esc(b.by)}</footer>` : ''}</blockquote><div class="a-body">`,
      gallery: () => (a.gallery || []).length ? `</div><div class="a-gallery">${a.gallery.map((g) => `<figure class="zoom"><img src="${esc(g.src)}" alt="${esc(g.alt)}" width="800" height="1000" loading="lazy"></figure>`).join('')}</div><div class="a-body">` : '',
    }[b.t] || (() => ''))();
    const related = journal.filter((x) => x !== a).slice(0, 3).map((x) => `<a class="j-card" href="/journal/${esc(x.slug)}"><div class="j-img zoom r32"><img src="${esc(x.image)}" alt="" loading="lazy" width="900" height="600"></div><p class="eyebrow muted">${esc(x.category)}</p><p class="j-title">${rich(x.title)}</p></a>`).join('\n');
    const meta = { title: plain(a.title), description: a.excerpt, nav: 'journal', ogImage: a.image };
    const raw = `<!--meta ${JSON.stringify(meta)} -->\n` + articleTpl
      .replaceAll('{{a.title}}', rich(a.title)).replaceAll('{{a.category}}', esc(a.category))
      .replaceAll('{{a.date}}', esc(frDate(a.date))).replaceAll('{{a.datetime}}', esc(a.date))
      .replaceAll('{{a.read}}', String(readMin(a))).replaceAll('{{a.image}}', esc(a.image)).replaceAll('{{a.imageAlt}}', esc(a.imageAlt || ''))
      .replaceAll('{{a.caption}}', a.caption ? `<figcaption>${esc(a.caption)}</figcaption>` : '')
      .replaceAll('{{a.body}}', a.body.map(block).join('\n')).replaceAll('{{a.related}}', related);
    pages.push({ file: `article:${a.slug}`, raw, rel: `journal/${a.slug}.html` });
  }
  for (const { file, raw, rel } of pages) {
    const m = raw.match(/^<!--meta\s+([\s\S]*?)\s*-->\s*/);
    if (!m) throw new Error(`Métadonnées manquantes : ${file}`);
    const meta = JSON.parse(m[1]);
    const body = expand(raw.slice(m[0].length));
    const layout = meta.layout || 'site';
    const nav = meta.nav || 'none';

    const scripts = ['/assets/js/site.js', ...(['site', 'checkout'].includes(layout) ? ['/assets/js/cart.js'] : []), ...(meta.scripts || []).map((s) => `/assets/js/${s}`)]
      .map((s) => `<script src="${asset(s)}" defer></script>`).join('\n');

    if (siteCfg.seoTitle && !meta.title) meta.title = '';
    const head = partial.head
      .replaceAll('{{title}}', esc(meta.title ? `${meta.title} | Maison Archam` : siteCfg.seoTitle || 'Maison Archam'))
      .replaceAll('{{description}}', esc(meta.description || siteCfg.seoDescription || 'Maison Archam — Crème d’Ararat, extrait de parfum.'))
      .replaceAll('{{robots}}', meta.noindex ? '<meta name="robots" content="noindex, nofollow">' : '')
      .replaceAll('{{css}}', asset('/assets/css/site.css'))
      .replaceAll('{{fonts}}', asset('/assets/css/fonts.css'))
      .replaceAll('{{scripts}}', `<script type="application/json" id="ma-catalogue">${catalogueJson}</script>\n${scripts}`);

    let header = expand(partial.header);
    const footer = expand(partial.footer);
    for (const k of ['accueil', 'parfum', 'journal', 'maison']) {
      header = header.replaceAll(`{{nav.${k}}}`, k === nav ? ' aria-current="page"' : '');
    }

    let html;
    if (layout === 'admin') {
      let adminNav = partial['admin-nav'];
      adminNav = adminNav.replace(/\{\{anav\.([a-z]+)\}\}/g, (_, k) => (k === meta.adminNav ? ' aria-current="page"' : ''));
      html = `<!DOCTYPE html>\n<html lang="fr">\n<head>\n${head}\n</head>\n<body class="admin">\n<a class="skip" href="#contenu">Aller au contenu</a>\n<div class="admin-shell">\n${adminNav}\n<main id="contenu" class="admin-main">\n${body}\n</main>\n</div>\n</body>\n</html>\n`;
    } else if (layout === 'checkout') {
      html = `<!DOCTYPE html>\n<html lang="fr">\n<head>\n${head}\n</head>\n<body>\n<a class="skip" href="#contenu">Aller au contenu</a>\n${partial['checkout-header']}\n<main id="contenu">\n${body}\n</main>\n</body>\n</html>\n`;
    } else if (layout === 'bare') {
      html = `<!DOCTYPE html>\n<html lang="fr">\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
    } else {
      html = `<!DOCTYPE html>\n<html lang="fr">\n<head>\n${head}\n</head>\n<body>\n<a class="skip" href="#contenu">Aller au contenu</a>\n${header}\n<main id="contenu">\n${body}\n</main>\n${footer}\n${expand(partial['cart-drawer'])}\n</body>\n</html>\n`;
    }
    if (/\{\{[a-z.]+\}\}/.test(html)) throw new Error(`Variable non remplacée dans ${file} : ${html.match(/\{\{[a-z.]+\}\}/)[0]}`);
    if (/\sstyle="/.test(html.replace(/<svg[\s\S]*?<\/svg>/g, ''))) throw new Error(`Attribut style interdit (CSP) dans ${file}`);
    if (/<script(?![^>]*\ssrc=)(?![^>]*type="application\/json")[^>]*>/.test(html)) throw new Error(`Script inline interdit (CSP) dans ${file}`);

    const dest = path.join(OUT, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, html);
  }
  console.log(`Build OK : ${pages.length} page(s) générée(s) dans public/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
