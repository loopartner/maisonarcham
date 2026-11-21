// POST /api/newsletter — demande d'inscription. Corps : { email, consent: true }
// Réponse : { status: 'pending' | 'subscribed' | 'already' }
import { handle, readJson, json, error, isEmail, normEmail, rateLimit, siteUrl } from '../../_lib/http.js';
import { hasStore } from '../../_lib/store.js';
import { isSubscribed, requestSubscription } from '../../_lib/newsletter.js';

export const POST = handle(async (request) => {
  if (!hasStore()) return error("L'inscription n'est pas encore activée.", 503);
  await rateLimit(request, 'newsletter', 5, 600);
  const body = await readJson(request, 2_000);
  if (body.website) return json({ ok: true, status: 'pending' }); // champ piège anti-robots
  const email = normEmail(body.email);
  if (!isEmail(email)) return error('Merci de saisir une adresse e-mail valide.', 422);
  if (body.consent !== true) return error('Merci d’accepter de recevoir notre correspondance.', 422);
  if (await isSubscribed(email)) return json({ ok: true, status: 'already' });
  const status = await requestSubscription(siteUrl(request), email, String(body.source || 'site').slice(0, 20));
  return json({ ok: true, status });
});
