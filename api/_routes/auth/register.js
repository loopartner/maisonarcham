// POST /api/auth/register — création d'un compte client. Corps : { firstName, lastName, email, password, newsletter }
// Tout nouveau compte est un compte client ; le rôle ne peut jamais être choisi depuis le site.
import { handle, readJson, json, error, isEmail, normEmail, clean, rateLimit, siteUrl } from '../../_lib/http.js';
import { hasStore, redis } from '../../_lib/store.js';
import { createUser, createSession, passwordProblem, publicUser } from '../../_lib/auth.js';
import { sendVerificationEmail } from '../../_lib/account-mail.js';
import { homeFor } from '../../_lib/roles.js';

export const POST = handle(async (request) => {
  if (!hasStore()) return error("La création de compte n'est pas encore activée.", 503);
  await rateLimit(request, 'register', 5, 3600);
  const body = await readJson(request);
  if (body.website) return error('Requête refusée.', 400); // champ piège anti-robots

  const firstName = clean(body.firstName, 60);
  const lastName = clean(body.lastName, 60);
  const email = normEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const fields = {};
  if (!firstName) fields.firstName = 'Indiquez votre prénom.';
  if (!lastName) fields.lastName = 'Indiquez votre nom.';
  if (!isEmail(email)) fields.email = 'Adresse e-mail invalide.';
  const pwdErr = passwordProblem(password, email);
  if (pwdErr) fields.password = pwdErr;
  if (Object.keys(fields).length) return error('Merci de vérifier les champs indiqués.', 422, { fields });

  const user = await createUser({ email, password, firstName, lastName, newsletter: body.newsletter === true });
  if (!user) {
    return error('Impossible de créer un compte avec cette adresse. Si vous avez déjà un compte, connectez-vous ou choisissez « Mot de passe oublié ».', 409);
  }
  if (user.newsletter) {
    await redis('SADD', 'newsletter', email);
    await redis('HSET', 'newsletter:dates', email, new Date().toISOString());
  }
  await sendVerificationEmail(siteUrl(request), user).catch((e) => console.error('E-mail de bienvenue :', e.message));

  const { cookie, role } = await createSession(request, user);
  return json({ ok: true, user: publicUser(user), redirect: homeFor(role) }, 201, { 'set-cookie': cookie });
});
