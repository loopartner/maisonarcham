// POST /api/account/email — change l'adresse e-mail. Corps : { email, password }
// La nouvelle adresse doit être confirmée ; l'ancienne est prévenue.
import { handle, readJson, json, error, rateLimit, normEmail, isEmail, siteUrl } from '../../_lib/http.js';
import { redis } from '../../_lib/store.js';
import { requireUser, verifyPassword, saveUser, publicUser } from '../../_lib/auth.js';
import { sendVerificationEmail } from '../../_lib/account-mail.js';
import { sendMail, layout } from '../../_lib/mail.js';

export const POST = handle(async (request) => {
  const { user } = await requireUser(request);
  await rateLimit(request, 'email-change', 5, 3600, user.id);
  const b = await readJson(request, 2_000);
  const email = normEmail(b.email);
  if (!isEmail(email)) return error('Adresse e-mail invalide.', 422, { fields: { email: 'Adresse e-mail invalide.' } });
  if (email === user.email) return json({ ok: true, user: publicUser(user) });
  if (!(await verifyPassword(String(b.password || '').slice(0, 128), user.passwordHash))) return error('Mot de passe incorrect.', 422, { fields: { password: 'Mot de passe incorrect.' } });
  const claimed = await redis('SET', `user:email:${email}`, user.id, 'NX');
  if (claimed !== 'OK') return error('Cette adresse ne peut pas être utilisée.', 409, { fields: { email: 'Cette adresse ne peut pas être utilisée.' } });
  const old = user.email;
  await redis('DEL', `user:email:${old}`);
  Object.assign(user, { email, emailVerified: false, updatedAt: new Date().toISOString() });
  await saveUser(user);
  await Promise.allSettled([
    sendVerificationEmail(siteUrl(request), user),
    sendMail({ to: old, subject: 'Maison Archam — adresse e-mail modifiée', html: layout('Adresse modifiée', '<p>L’adresse e-mail de votre compte Maison Archam vient d’être modifiée. Si vous n’êtes pas à l’origine de ce changement, contactez-nous immédiatement.</p>') }),
  ]);
  return json({ ok: true, user: publicUser(user) });
});
