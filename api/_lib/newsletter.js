// Newsletter : double consentement (lien de confirmation par e-mail) et désinscription signée.
import crypto from 'node:crypto';
import { env } from './env.js';
import { redis, pipeline } from './store.js';
import { sendMail, layout, hasMail } from './mail.js';
import { escapeHtml } from './http.js';
import { newToken, sha256 } from './auth.js';

const key = () => env('NEWSLETTER_SECRET') || sha256(`newsletter:${env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN')}`);
export const unsubscribeSig = (email) => crypto.createHmac('sha256', key()).update(email).digest('base64url').slice(0, 32);
export function validSig(email, sig) {
  const a = Buffer.from(unsubscribeSig(email)), b = Buffer.from(String(sig || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const unsubscribeUrl = (base, email) => `${base}/newsletter/desinscription?e=${encodeURIComponent(email)}&s=${unsubscribeSig(email)}`;

export const isSubscribed = async (email) => (await redis('SISMEMBER', 'newsletter', email)) === 1;

export async function subscribe(email, source) {
  await pipeline([
    ['SADD', 'newsletter', email],
    ['HSET', 'newsletter:dates', email, new Date().toISOString()],
    ['HSET', 'newsletter:sources', email, source || 'site'],
  ]);
  const audience = env('RESEND_AUDIENCE_ID');
  if (audience && env('RESEND_API_KEY')) {
    await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
      method: 'POST', headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ email, unsubscribed: false }),
    }).catch((e) => console.error(e));
  }
}

export async function unsubscribe(email) {
  await pipeline([['SREM', 'newsletter', email], ['HDEL', 'newsletter:dates', email], ['HDEL', 'newsletter:sources', email]]);
}

// Renvoie 'pending' (e-mail de confirmation envoyé) ou 'subscribed' (inscription directe si aucun e-mail n'est configuré).
export async function requestSubscription(base, email, source) {
  if (!hasMail()) { await subscribe(email, source); return 'subscribed'; }
  const token = newToken(32);
  await redis('SET', `nlpending:${sha256(token)}`, JSON.stringify({ email, source }), 'EX', 60 * 60 * 48);
  await sendMail({
    to: email,
    subject: 'Maison Archam — confirmez votre inscription',
    html: layout('La Correspondance', `<p>Bonjour,</p><p>Pour recevoir les lettres de la Maison, confirmez votre inscription :</p>
      <p style="margin:28px 0"><a href="${escapeHtml(`${base}/newsletter/confirmer#jeton=${token}`)}" style="display:inline-block;background:#241A16;color:#F8F6F2;text-decoration:none;padding:16px 28px;font-size:12px;letter-spacing:2px;text-transform:uppercase">Confirmer mon inscription</a></p>
      <p style="color:#75695F;font-size:12px">Ce lien est valable 48 heures. Sans confirmation, aucune lettre ne vous sera envoyée.</p>`),
  });
  return 'pending';
}

export async function confirmSubscription(token) {
  if (!/^[A-Za-z0-9_-]{30,100}$/.test(String(token || ''))) return null;
  const raw = await redis('GETDEL', `nlpending:${sha256(token)}`);
  if (!raw) return null;
  const { email, source } = JSON.parse(raw);
  await subscribe(email, source);
  return email;
}
