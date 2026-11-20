// Build du site Maison Archam — aucune dépendance npm.
// 1. copie l'ancien site (legacy/) tant que ses pages ne sont pas remplacées ;
// 2. assemble chaque page de src/pages avec les gabarits communs (en-tête, pied de page) ;
// 3. copie les ressources de src/assets en ajoutant une empreinte de version aux CSS/JS.
//
// Chaque page commence par un bloc de métadonnées :
// <!--meta {"title":"…","description":"…","nav":"parfum","layout":"site","scripts":["auth.js"],"noindex":true} -->
import { readFile, writeFile, mkdir, cp, rm, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

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

  // 1. Ancien site (servi tant que la page n'a pas d'équivalent dans src/pages)
  await cp(path.join(ROOT, 'legacy'), OUT, { recursive: true });

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

  // 2. Pages
  const partial = {};
  for (const name of ['head', 'header', 'footer', 'admin-nav']) {
    partial[name] = await read(path.join(SRC, 'partials', `${name}.html`)).catch(() => '');
  }

  const pages = (await walk(path.join(SRC, 'pages'))).filter((f) => f.endsWith('.html'));
  for (const file of pages) {
    const raw = await read(file);
    const m = raw.match(/^<!--meta\s+([\s\S]*?)\s*-->\s*/);
    if (!m) throw new Error(`Métadonnées manquantes : ${file}`);
    const meta = JSON.parse(m[1]);
    const body = raw.slice(m[0].length);
    const layout = meta.layout || 'site';
    const nav = meta.nav || 'none';

    const scripts = ['/assets/js/site.js', ...(meta.scripts || []).map((s) => `/assets/js/${s}`)]
      .map((s) => `<script src="${asset(s)}" defer></script>`).join('\n');

    const head = partial.head
      .replaceAll('{{title}}', esc(meta.title ? `${meta.title} | Maison Archam` : 'Maison Archam'))
      .replaceAll('{{description}}', esc(meta.description || 'Maison Archam — Crème d’Ararat, extrait de parfum.'))
      .replaceAll('{{robots}}', meta.noindex ? '<meta name="robots" content="noindex, nofollow">' : '')
      .replaceAll('{{css}}', asset('/assets/css/site.css'))
      .replaceAll('{{fonts}}', asset('/assets/css/fonts.css'))
      .replaceAll('{{scripts}}', scripts);

    let header = partial.header;
    for (const k of ['accueil', 'parfum', 'journal', 'maison']) {
      header = header.replaceAll(`{{nav.${k}}}`, k === nav ? ' aria-current="page"' : '');
    }

    let html;
    if (layout === 'admin') {
      let adminNav = partial['admin-nav'];
      adminNav = adminNav.replace(/\{\{anav\.([a-z]+)\}\}/g, (_, k) => (k === meta.adminNav ? ' aria-current="page"' : ''));
      html = `<!DOCTYPE html>\n<html lang="fr">\n<head>\n${head}\n</head>\n<body class="admin">\n<a class="skip" href="#contenu">Aller au contenu</a>\n<div class="admin-shell">\n${adminNav}\n<main id="contenu" class="admin-main">\n${body}\n</main>\n</div>\n</body>\n</html>\n`;
    } else if (layout === 'bare') {
      html = `<!DOCTYPE html>\n<html lang="fr">\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
    } else {
      html = `<!DOCTYPE html>\n<html lang="fr">\n<head>\n${head}\n</head>\n<body>\n<a class="skip" href="#contenu">Aller au contenu</a>\n${header}\n<main id="contenu">\n${body}\n</main>\n${partial.footer}\n</body>\n</html>\n`;
    }
    if (/\{\{[a-z.]+\}\}/.test(html)) throw new Error(`Variable non remplacée dans ${file} : ${html.match(/\{\{[a-z.]+\}\}/)[0]}`);
    if (/\sstyle="/.test(html.replace(/<svg[\s\S]*?<\/svg>/g, ''))) throw new Error(`Attribut style interdit (CSP) dans ${file}`);
    if (/<script(?![^>]*\ssrc=)[^>]*>/.test(html)) throw new Error(`Script inline interdit (CSP) dans ${file}`);

    const rel = path.relative(path.join(SRC, 'pages'), file);
    const dest = path.join(OUT, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, html);
  }
  console.log(`Build OK : ${pages.length} page(s) générée(s) dans public/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
