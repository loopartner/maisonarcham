// GET/POST /api/admin/pages — sections de la page La Maison et textes du bloc newsletter.
import { handle, json, readJson, clean } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { getPages, savePages, markDirty } from '../../_lib/settings.js';
import { audit } from '../../_lib/admin.js';

export const GET = handle(async (request) => { await requireStaff(request, 'content'); return json({ ok: true, pages: await getPages() }); });

export const POST = handle(async (request) => {
  const { user } = await requireStaff(request, 'content');
  const b = await readJson(request, 5_000);
  const cur = await getPages();
  const sections = Object.fromEntries(Object.keys(cur.maison.sections).map((k) => [k, b.maison?.sections?.[k] !== false]));
  const nl = b.newsletter || {};
  const next = { maison: { sections }, newsletter: {
    eyebrow: clean(nl.eyebrow, 60) || cur.newsletter.eyebrow, title: clean(nl.title, 120) || cur.newsletter.title,
    text: clean(nl.text, 400) || cur.newsletter.text, confirm: clean(nl.confirm, 160) || cur.newsletter.confirm,
  } };
  await savePages(next);
  await markDirty('pages');
  await audit(request, user, 'pages.modifiees', {});
  return json({ ok: true, pages: next });
});
