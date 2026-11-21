// GET  /api/admin/publish — état de publication (modifications en attente, dernière publication).
// POST /api/admin/publish — reconstruit le site avec le contenu en base (Deploy Hook Vercel).
import { handle, json, error, rateLimit } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { redis } from '../../_lib/store.js';
import { env } from '../../_lib/env.js';
import { can } from '../../_lib/roles.js';
import { audit } from '../../_lib/admin.js';

const pairs = (a) => Object.fromEntries((a || []).reduce((acc, v, i, arr) => (i % 2 ? acc : [...acc, [arr[i], arr[i + 1]]]), []));

async function guard(request) {
  const s = await requireStaff(request);
  if (!can(s.role, 'content') && !can(s.role, 'products')) throw Object.assign(new Error('forbidden'), { forbidden: true });
  return s;
}

export const GET = handle(async (request) => {
  try { await guard(request); } catch (e) { if (e.forbidden) return error('Vous n’avez pas accès à cette section.', 403); throw e; }
  const last = await redis('GET', 'cms:last-publish');
  return json({ ok: true, ready: Boolean(env('VERCEL_DEPLOY_HOOK')), dirty: pairs(await redis('HGETALL', 'cms:dirty')), last: last ? JSON.parse(last) : null });
});

export const POST = handle(async (request) => {
  let s; try { s = await guard(request); } catch (e) { if (e.forbidden) return error('Vous n’avez pas accès à cette section.', 403); throw e; }
  const hook = env('VERCEL_DEPLOY_HOOK');
  if (!hook || !/^https:\/\/api\.vercel\.com\//.test(hook)) return error('La publication automatique n’est pas configurée : ajoutez la variable VERCEL_DEPLOY_HOOK dans Vercel.', 503);
  await rateLimit(request, 'publish', 6, 3600);
  const res = await fetch(hook, { method: 'POST' });
  if (!res.ok) return error('Vercel n’a pas accepté la demande de publication. Réessayez dans un instant.', 502);
  const record = { at: new Date().toISOString(), by: `${s.user.firstName} ${s.user.lastName}`.trim() };
  await redis('SET', 'cms:last-publish', JSON.stringify(record));
  await redis('DEL', 'cms:dirty');
  await audit(request, s.user, 'site.publie', {});
  return json({ ok: true, last: record });
});
