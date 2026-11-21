// POST /api/newsletter/one-click?e=…&s=… — désinscription en un clic depuis la messagerie (RFC 8058).
// Pas de contrôle d'origine : la requête vient du fournisseur de messagerie ; le lien signé suffit.
import { handle, json, error, normEmail, rateLimit } from '../../_lib/http.js';
import { validSig, unsubscribe } from '../../_lib/newsletter.js';

export const POST = handle(async (request) => {
  await rateLimit(request, 'nl-oneclick', 30, 3600);
  const q = new URL(request.url).searchParams;
  const email = normEmail(q.get('e'));
  if (!email || !validSig(email, q.get('s'))) return error('Lien invalide.', 400);
  await unsubscribe(email);
  return json({ ok: true });
}, { csrf: false });
