// GET /api/auth/me — compte connecté (ou { user: null }).
import { handle, json } from '../_lib/http.js';
import { getSession, publicUser } from '../_lib/auth.js';

export const GET = handle(async (request) => {
  const s = await getSession(request);
  return json({ ok: true, user: s ? publicUser(s.user) : null });
});
