// GET /api/admin/audit — 100 dernières actions de l'équipe (propriétaires et administrateurs).
import { handle, json } from '../../_lib/http.js';
import { requireStaff } from '../../_lib/auth.js';
import { redis } from '../../_lib/store.js';

export const GET = handle(async (request) => {
  await requireStaff(request, 'team');
  return json({ ok: true, entries: ((await redis('LRANGE', 'audit', 0, 99)) || []).map((x) => JSON.parse(x)) });
});
