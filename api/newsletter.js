// POST /api/newsletter — inscription à la newsletter. Corps : { email }
import { env } from './_lib/env.js';
import { handle, readJson, json, error, isEmail, clean, rateLimit } from './_lib/http.js';
import { redis, hasStore } from './_lib/store.js';

export const POST = handle(async (request) => {
  const audience = env('RESEND_AUDIENCE_ID');
  if (!hasStore() && !(audience && env('RESEND_API_KEY'))) return error("L'inscription n'est pas encore activée.", 503);
  await rateLimit(request, 'newsletter', 5, 600);

  const body = await readJson(request);
  if (body.website) return json({ ok: true }); // champ piège anti-robots
  const email = clean(body.email, 254).toLowerCase();
  if (!isEmail(email)) return error('Adresse e-mail invalide.');

  if (hasStore()) {
    await redis('SADD', 'newsletter', email);
    await redis('HSET', 'newsletter:dates', email, new Date().toISOString());
  }
  if (audience && env('RESEND_API_KEY')) {
    await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ email, unsubscribed: false }),
    }).catch((e) => console.error(e));
  }
  return json({ ok: true });
});
