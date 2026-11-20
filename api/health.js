// GET /api/health — indique quels services sont branchés (oui / non), sans jamais afficher de clé.
import { env } from './_lib/env.js';
import { json } from './_lib/http.js';
import { hasStore } from './_lib/store.js';
import { hasMail } from './_lib/mail.js';

export function GET(request) {
  const sk = env('STRIPE_SECRET_KEY');
  return json({
    environnement: env('VERCEL_ENV', 'inconnu'),
    adresse: new URL(request.url).host,
    paiement_stripe: sk ? (sk.startsWith('sk_test_') ? 'oui (mode test)' : sk.startsWith('sk_live_') ? 'oui (mode réel)' : 'clé au format inattendu') : 'non : STRIPE_SECRET_KEY absente',
    cle_publiable: (() => { const pk = env('STRIPE_PUBLISHABLE_KEY'); if (!pk) return sk && sk.startsWith('sk_live_') ? 'non : STRIPE_PUBLISHABLE_KEY (pk_live_…) obligatoire en mode réel' : 'clé de test par défaut'; const same = sk && sk.slice(3, 7) === pk.slice(3, 7); return same ? (pk.startsWith('pk_live_') ? 'oui (mode réel)' : 'oui (mode test)') : 'ERREUR : pas le même mode que la clé secrète'; })(),
    webhook_stripe: env('STRIPE_WEBHOOK_SECRET') ? 'oui' : 'non : STRIPE_WEBHOOK_SECRET absente',
    base_commandes: hasStore() ? 'oui' : 'non : Upstash non relié',
    emails: hasMail() ? 'oui' : 'non : RESEND_API_KEY / MAIL_FROM absents (indispensable pour confirmer les comptes)',
    comptes_admin: env('ADMIN_EMAILS') ? `${env('ADMIN_EMAILS').split(',').filter(Boolean).length} adresse(s) déclarée(s)` : 'non : ADMIN_EMAILS absente',
    adresse_du_site: env('SITE_URL') ? 'oui' : 'non : SITE_URL conseillée (liens des e-mails)',
  });
}
