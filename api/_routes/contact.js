// POST /api/contact — formulaire de contact. Corps : { name, email, subject, message }
import { env } from '../_lib/env.js';
import { handle, readJson, json, error, isEmail, clean, rateLimit, escapeHtml } from '../_lib/http.js';
import { redis, hasStore } from '../_lib/store.js';
import { sendMail, hasMail, layout } from '../_lib/mail.js';

export const POST = handle(async (request) => {
  const to = env('CONTACT_TO_EMAIL');
  if (!(hasMail() && to) && !hasStore()) return error("Le formulaire n'est pas encore activé.", 503);
  await rateLimit(request, 'contact', 3, 600);

  const body = await readJson(request);
  if (body.website) return json({ ok: true });
  const msg = {
    name: clean(body.name, 120),
    email: clean(body.email, 254).toLowerCase(),
    subject: clean(body.subject, 80) || 'Autre',
    message: String(body.message ?? '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim().slice(0, 5000), // retours à la ligne conservés
    at: new Date().toISOString(),
  };
  if (!msg.name || !msg.message) return error('Merci de renseigner votre nom et votre message.');
  if (!isEmail(msg.email)) return error('Adresse e-mail invalide.');

  if (hasStore()) await redis('LPUSH', 'contact:messages', JSON.stringify(msg));
  if (hasMail() && to) {
    await sendMail({
      to, replyTo: msg.email,
      subject: `[Site] ${msg.subject} — ${msg.name}`,
      html: layout(`Message : ${msg.subject}`, `<p><strong>${escapeHtml(msg.name)}</strong> · ${escapeHtml(msg.email)}</p>
        <p style="white-space:pre-wrap">${escapeHtml(msg.message)}</p>`),
    });
  }
  return json({ ok: true });
});
