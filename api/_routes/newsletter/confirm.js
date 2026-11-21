// POST /api/newsletter/confirm — confirme l'inscription depuis le lien reçu. Corps : { token }
import { handle, readJson, json, error, rateLimit } from '../../_lib/http.js';
import { confirmSubscription } from '../../_lib/newsletter.js';

export const POST = handle(async (request) => {
  await rateLimit(request, 'nl-confirm', 20, 3600);
  const { token } = await readJson(request, 1_000);
  const email = await confirmSubscription(token);
  if (!email) return error('Ce lien n’est plus valable. Inscrivez-vous de nouveau.', 400);
  return json({ ok: true, email });
});
