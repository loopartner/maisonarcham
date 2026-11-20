// POST /api/auth/login — connexion unique pour tous les comptes. Corps : { email, password }
// Le serveur décide seul de l'espace de destination (client ou administration) selon le rôle du compte.
import { handle, readJson, json, error, normEmail, rateLimit, clientIp } from '../../_lib/http.js';
import { hasStore, redis } from '../../_lib/store.js';
import { getUserByEmail, verifyPassword, dummyVerify, createSession, saveUser, publicUser, sha256 } from '../../_lib/auth.js';
import { homeFor } from '../../_lib/roles.js';

const FAIL = 'E-mail ou mot de passe incorrect.';

export const POST = handle(async (request) => {
  if (!hasStore()) return error("La connexion n'est pas encore activée.", 503);
  await rateLimit(request, 'login-ip', 30, 900);
  const body = await readJson(request, 5_000);
  const email = normEmail(body.email);
  const password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';
  if (!email || !password) return error(FAIL, 401);

  // Limite par adresse e-mail : protège un compte précis contre les essais en série.
  const emailBucket = `rl:login-email:${sha256(email)}`;
  const tries = Number(await redis('GET', emailBucket)) || 0;
  if (tries >= 8) return error('Trop de tentatives sur ce compte. Réessayez dans 15 minutes ou choisissez « Mot de passe oublié ».', 429);

  const user = await getUserByEmail(email);
  const ok = user ? await verifyPassword(password, user.passwordHash) : await dummyVerify(password);
  if (!ok || !user || user.disabled) {
    const n = await redis('INCR', emailBucket);
    if (n === 1) await redis('EXPIRE', emailBucket, 900);
    console.warn('Connexion refusée', { ip: clientIp(request) });
    return error(FAIL, 401);
  }
  await redis('DEL', emailBucket);
  user.lastLoginAt = new Date().toISOString();
  await saveUser(user);

  const { cookie, role } = await createSession(request, user);
  return json({ ok: true, user: publicUser(user), redirect: homeFor(role) }, 200, { 'set-cookie': cookie });
});
