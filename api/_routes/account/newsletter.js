// POST /api/account/newsletter — abonnement depuis le compte. Corps : { subscribed: true|false }
import { handle, readJson, json, siteUrl } from '../../_lib/http.js';
import { requireUser, saveUser } from '../../_lib/auth.js';
import { subscribe, unsubscribe, requestSubscription } from '../../_lib/newsletter.js';

export const POST = handle(async (request) => {
  const { user } = await requireUser(request);
  const { subscribed } = await readJson(request, 500);
  let status;
  if (subscribed === true) {
    // Adresse confirmée : inscription directe. Sinon, double consentement par e-mail.
    if (user.emailVerified) { await subscribe(user.email, 'compte'); status = 'subscribed'; }
    else status = await requestSubscription(siteUrl(request), user.email, 'compte');
  } else { await unsubscribe(user.email); status = 'unsubscribed'; }
  user.newsletter = status === 'subscribed';
  await saveUser(user);
  return json({ ok: true, status });
});
