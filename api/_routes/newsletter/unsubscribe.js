// POST /api/newsletter/unsubscribe — désinscription en un clic (lien signé présent dans chaque lettre). Corps : { email, sig }
import { handle, readJson, json, error, normEmail, rateLimit } from '../../_lib/http.js';
import { validSig, unsubscribe } from '../../_lib/newsletter.js';

export const POST = handle(async (request) => {
  await rateLimit(request, 'nl-unsub', 20, 3600);
  const body = await readJson(request, 1_000);
  const email = normEmail(body.email);
  if (!email || !validSig(email, body.sig)) return error('Ce lien de désinscription n’est pas valable.', 400);
  await unsubscribe(email);
  return json({ ok: true });
});
