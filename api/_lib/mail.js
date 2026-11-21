// Envoi d'e-mails via Resend (resend.com). Sans RESEND_API_KEY, les e-mails sont simplement ignorés.
import { env } from './env.js';
import { escapeHtml } from './http.js';

export const hasMail = () => Boolean(env('RESEND_API_KEY') && env('MAIL_FROM'));

export async function sendMail({ to, subject, html, replyTo }) {
  if (!hasMail()) return { skipped: true };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env('RESEND_API_KEY')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env('MAIL_FROM'), to: [].concat(to), subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend : ${res.status} ${await res.text()}`);
  return res.json();
}

export function layout(title, bodyHtml) {
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f4f3f0;font-family:Helvetica,Arial,sans-serif;color:#1f2a2e">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d6d6d2">
    <tr><td style="padding:32px;border-bottom:1px solid #d6d6d2;text-align:center;font-family:Georgia,serif;font-size:22px;letter-spacing:4px;text-transform:uppercase">Maison Archam</td></tr>
    <tr><td style="padding:32px;font-size:14px;line-height:22px">
      <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:24px;text-transform:uppercase;margin:0 0 16px">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:20px 32px;background:#e8dfd2;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5c6366;text-align:center">Maison Archam Paris</td></tr>
  </table></td></tr></table></body></html>`;
}
