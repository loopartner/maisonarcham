// POST /api/auth/reset — nouveau mot de passe à partir du lien reçu par e-mail. Corps : { token, password }
// Ferme toutes les sessions ouvertes et confirme l'adresse e-mail (le lien prouve l'accès à la boîte).
import { handle, readJson, json, error, rateLimit } from '../_lib/http.js';
import { hasStore } from '../_lib/store.js';
import { consumeEmailToken, getUser, saveUser, hashPassword, passwordProblem, destroyAllSessions } from '../_lib/auth.js';
import { sendPasswordChangedEmail } from '../_lib/account-mail.js';

export const POST = handle(async (request) => {
  if (!hasStore()) return error("Ce service n'est pas encore activé.", 503);
  await rateLimit(request, 'reset', 10, 3600);
  const body = await readJson(request, 2_000);
  const password = typeof body.password === 'string' ? body.password : '';

  // On valide le mot de passe AVANT de consommer le jeton, pour ne pas le gaspiller sur une erreur de saisie.
  const pre = passwordProblem(password);
  if (pre) return error(pre, 422, { fields: { password: pre } });

  const uid = await consumeEmailToken('reset', String(body.token || ''));
  const user = uid ? await getUser(uid) : null;
  if (!user || user.disabled) return error('Ce lien n’est plus valable. Faites une nouvelle demande de mot de passe.', 400);
  const problem = passwordProblem(password, user.email);
  if (problem) return error(`${problem} Faites une nouvelle demande de lien.`, 422);

  user.passwordHash = await hashPassword(password);
  user.pwdVersion = (user.pwdVersion || 1) + 1;
  user.emailVerified = true;
  user.updatedAt = new Date().toISOString();
  await saveUser(user);
  await destroyAllSessions(user.id);
  await sendPasswordChangedEmail(user).catch((e) => console.error(e.message));
  return json({ ok: true, redirect: '/connexion?nouveau-mot-de-passe=1' });
});
