// E-mails liés au compte client.
import { sendMail, layout } from './mail.js';
import { escapeHtml } from './http.js';
import { createEmailToken } from './auth.js';

const VERIFY_TTL = 60 * 60 * 48; // 48 h
const RESET_TTL = 60 * 30;       // 30 min

const button = (href, label) => `<p style="margin:28px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#241A16;color:#F8F6F2;text-decoration:none;padding:16px 28px;font-size:12px;letter-spacing:2px;text-transform:uppercase">${escapeHtml(label)}</a></p>`;

export async function sendVerificationEmail(base, user) {
  const token = await createEmailToken('verify', user.id, VERIFY_TTL);
  // Le jeton est placé après « # » : il n'est jamais transmis au serveur ni enregistré dans les journaux.
  const link = `${base}/verifier#jeton=${token}`;
  return sendMail({
    to: user.email,
    subject: 'Bienvenue chez Maison Archam — confirmez votre adresse',
    html: layout('Bienvenue', `<p>Bonjour ${escapeHtml(user.firstName)},</p>
      <p>Votre compte Maison Archam a bien été créé. Confirmez votre adresse e-mail pour sécuriser votre compte :</p>
      ${button(link, 'Confirmer mon adresse')}
      <p style="color:#75695F;font-size:12px">Ce lien est valable 48 heures. Si vous n’êtes pas à l’origine de cette inscription, ignorez simplement ce message.</p>`),
  });
}

export async function sendResetEmail(base, user) {
  const token = await createEmailToken('reset', user.id, RESET_TTL);
  const link = `${base}/reinitialiser#jeton=${token}`;
  return sendMail({
    to: user.email,
    subject: 'Maison Archam — choisir un nouveau mot de passe',
    html: layout('Nouveau mot de passe', `<p>Bonjour ${escapeHtml(user.firstName)},</p>
      <p>Vous avez demandé à choisir un nouveau mot de passe. Cliquez sur le bouton ci-dessous :</p>
      ${button(link, 'Choisir un mot de passe')}
      <p style="color:#75695F;font-size:12px">Ce lien est valable 30 minutes et ne peut servir qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.</p>`),
  });
}

export async function sendPasswordChangedEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Maison Archam — votre mot de passe a été modifié',
    html: layout('Mot de passe modifié', `<p>Bonjour ${escapeHtml(user.firstName)},</p>
      <p>Le mot de passe de votre compte vient d’être modifié et toutes vos sessions ont été fermées.</p>
      <p>Si vous n’êtes pas à l’origine de ce changement, contactez-nous immédiatement en répondant à ce message.</p>`),
  });
}
