// POST /api/account/delete — suppression du compte (droit à l'effacement). Corps : { password }
// Les commandes sont conservées (obligations comptables) mais détachées du compte.
import { handle, readJson, json, error, rateLimit } from '../../_lib/http.js';
import { pipeline } from '../../_lib/store.js';
import { requireUser, verifyPassword, destroyAllSessions, clearSessionCookie } from '../../_lib/auth.js';
import { unsubscribe } from '../../_lib/newsletter.js';

export const POST = handle(async (request) => {
  const { user, role } = await requireUser(request);
  await rateLimit(request, 'account-delete', 5, 3600, user.id);
  const { password } = await readJson(request, 1_000);
  if (!(await verifyPassword(String(password || '').slice(0, 128), user.passwordHash))) return error('Mot de passe incorrect.', 422, { fields: { password: 'Mot de passe incorrect.' } });
  if (role === 'admin') return error('Un compte administrateur ne peut pas être supprimé depuis l’espace client.', 403);
  await destroyAllSessions(user.id);
  await unsubscribe(user.email).catch(() => {});
  await pipeline([['DEL', `user:${user.id}`], ['DEL', `user:email:${user.email}`], ['ZREM', 'users', user.id], ['DEL', `orders:user:${user.id}`]]);
  return json({ ok: true, redirect: '/' }, 200, { 'set-cookie': clearSessionCookie() });
});
