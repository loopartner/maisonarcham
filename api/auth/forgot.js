// POST /api/auth/forgot — envoie un lien de réinitialisation. Corps : { email }
// La réponse est toujours la même, que le compte existe ou non.
import { handle, readJson, json, normEmail, isEmail, rateLimit, siteUrl, error } from '../_lib/http.js';
import { hasStore } from '../_lib/store.js';
import { getUserByEmail, sha256 } from '../_lib/auth.js';
import { sendResetEmail } from '../_lib/account-mail.js';

export const POST = handle(async (request) => {
  if (!hasStore()) return error("Ce service n'est pas encore activé.", 503);
  await rateLimit(request, 'forgot-ip', 10, 3600);
  const body = await readJson(request, 2_000);
  const email = normEmail(body.email);
  if (!isEmail(email)) return error('Adresse e-mail invalide.', 422, { fields: { email: 'Adresse e-mail invalide.' } });
  await rateLimit(request, 'forgot-email', 3, 3600, sha256(email));
  const user = await getUserByEmail(email);
  if (user && !user.disabled) await sendResetEmail(siteUrl(request), user).catch((e) => console.error('E-mail de réinitialisation :', e.message));
  return json({ ok: true });
});
