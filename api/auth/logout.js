// POST /api/auth/logout — ferme la session en cours.
import { handle, json } from '../_lib/http.js';
import { getSession, destroySession, clearSessionCookie } from '../_lib/auth.js';

export const POST = handle(async (request) => {
  const s = await getSession(request);
  if (s) await destroySession(s.hash, s.user.id);
  return json({ ok: true, redirect: '/connexion' }, 200, { 'set-cookie': clearSessionCookie() });
});
