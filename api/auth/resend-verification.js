// POST /api/auth/resend-verification — renvoie l'e-mail de confirmation (compte connecté).
import { handle, json, rateLimit, siteUrl } from '../_lib/http.js';
import { requireUser } from '../_lib/auth.js';
import { sendVerificationEmail } from '../_lib/account-mail.js';

export const POST = handle(async (request) => {
  const { user } = await requireUser(request);
  if (user.emailVerified) return json({ ok: true, already: true });
  await rateLimit(request, 'resend-verify', 3, 3600, user.id);
  await sendVerificationEmail(siteUrl(request), user);
  return json({ ok: true });
});
