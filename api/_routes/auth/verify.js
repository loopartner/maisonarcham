// POST /api/auth/verify — confirme l'adresse e-mail. Corps : { token }
import { handle, readJson, json, error, rateLimit } from '../../_lib/http.js';
import { hasStore } from '../../_lib/store.js';
import { consumeEmailToken, getUser, saveUser } from '../../_lib/auth.js';

export const POST = handle(async (request) => {
  if (!hasStore()) return error("Ce service n'est pas encore activé.", 503);
  await rateLimit(request, 'verify', 20, 3600);
  const body = await readJson(request, 2_000);
  const uid = await consumeEmailToken('verify', String(body.token || ''));
  const user = uid ? await getUser(uid) : null;
  if (!user) return error('Ce lien n’est plus valable. Connectez-vous pour en recevoir un nouveau.', 400);
  if (!user.emailVerified) {
    user.emailVerified = true;
    user.updatedAt = new Date().toISOString();
    await saveUser(user);
  }
  return json({ ok: true });
});
