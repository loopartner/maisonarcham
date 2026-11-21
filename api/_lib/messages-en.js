// Traduction anglaise des messages renvoyés aux visiteurs (le serveur écrit en français ;
// la réponse est traduite si le navigateur envoie « x-lang: en »). Les messages du back-office restent en français.
const EXACT = {
  'Une erreur est survenue. Merci de réessayer.': 'Something went wrong. Please try again.',
  'Requête invalide.': 'Invalid request.', 'Requête refusée.': 'Request refused.', 'Requête trop volumineuse.': 'Request too large.',
  'Format de requête non accepté.': 'Unsupported request format.', 'Méthode non autorisée.': 'Method not allowed.', 'Introuvable.': 'Not found.',
  'Trop de tentatives. Merci de réessayer dans quelques minutes.': 'Too many attempts. Please try again in a few minutes.',
  'Trop de tentatives sur ce compte. Réessayez dans 15 minutes ou choisissez « Mot de passe oublié ».': 'Too many attempts on this account. Try again in 15 minutes or choose “Forgot password”.',
  'Service indisponible.': 'Service unavailable.', 'Lien invalide.': 'Invalid link.',
  'Merci de vérifier les champs indiqués.': 'Please check the highlighted fields.', 'Certains champs sont à corriger.': 'Some fields need correcting.',
  // Comptes
  'E-mail ou mot de passe incorrect.': 'Incorrect email or password.',
  "La connexion n'est pas encore activée.": 'Sign-in is not available yet.', "La création de compte n'est pas encore activée.": 'Account creation is not available yet.',
  "Ce service n'est pas encore activé.": 'This service is not available yet.', "L'espace client n'est pas encore activé.": 'The client area is not available yet.',
  'Votre session a expiré. Merci de vous reconnecter.': 'Your session has expired. Please sign in again.',
  'Impossible de créer un compte avec cette adresse. Si vous avez déjà un compte, connectez-vous ou choisissez « Mot de passe oublié ».': 'An account cannot be created with this address. If you already have an account, sign in or choose “Forgot password”.',
  'Ce lien n’est plus valable. Faites une nouvelle demande de mot de passe.': 'This link is no longer valid. Please request a new password link.',
  'Ce lien n’est plus valable. Connectez-vous pour en recevoir un nouveau.': 'This link is no longer valid. Sign in to receive a new one.',
  'Ce lien n’est plus valable. Inscrivez-vous de nouveau.': 'This link is no longer valid. Please subscribe again.',
  'Ce lien de désinscription n’est pas valable.': 'This unsubscribe link is not valid.',
  'Le mot de passe doit contenir au moins 8 caractères.': 'The password must contain at least 8 characters.',
  'Le mot de passe ne doit pas dépasser 128 caractères.': 'The password must not exceed 128 characters.',
  'Le mot de passe doit contenir au moins une lettre et un chiffre.': 'The password must contain at least one letter and one number.',
  'Ce mot de passe est trop courant. Choisissez-en un autre.': 'This password is too common. Please choose another one.',
  'Le mot de passe ne doit pas contenir votre adresse e-mail.': 'The password must not contain your email address.',
  'Mot de passe invalide.': 'Invalid password.', 'Mot de passe incorrect.': 'Incorrect password.', 'Mot de passe actuel incorrect.': 'Current password is incorrect.',
  'Cette adresse ne peut pas être utilisée.': 'This address cannot be used.',
  'Un compte de l’équipe ne peut pas être supprimé depuis l’espace client.': 'A team account cannot be deleted from the client area.',
  // Champs
  'Adresse e-mail invalide.': 'Invalid email address.', 'E-mail invalide.': 'Invalid email.', 'Merci de saisir une adresse e-mail valide.': 'Please enter a valid email address.',
  'Indiquez votre prénom.': 'Please enter your first name.', 'Indiquez votre nom.': 'Please enter your last name.',
  'Prénom invalide.': 'Invalid first name.', 'Nom invalide.': 'Invalid last name.', 'Indiquez l’adresse.': 'Please enter the address.',
  'Indiquez la ville.': 'Please enter the city.', 'Indiquez le code postal.': 'Please enter the postcode.', 'Code postal invalide.': 'Invalid postcode.',
  'Nous ne livrons pas encore ce pays.': 'We do not deliver to this country yet.', 'Pays non desservi.': 'Country not served.',
  'Numéro de téléphone invalide.': 'Invalid phone number.', 'Téléphone invalide.': 'Invalid phone number.', 'Date invalide.': 'Invalid date.',
  'Merci d’accepter les conditions générales de vente.': 'Please accept the terms of sale.',
  'Merci d’accepter de recevoir notre correspondance.': 'Please agree to receive our correspondence.',
  'Merci de renseigner votre nom et votre message.': 'Please enter your name and your message.',
  // Panier, commande
  'Votre panier est vide.': 'Your bag is empty.', 'Un article de votre panier n’est plus disponible.': 'An item in your bag is no longer available.',
  'Quantité invalide.': 'Invalid quantity.', 'Ce code n’est pas valide.': 'This code is not valid.',
  'Commande introuvable.': 'Order not found.', 'Adresse introuvable.': 'Address not found.',
  "L'inscription n'est pas encore activée.": 'Subscription is not available yet.', "Le formulaire n'est pas encore activé.": 'The form is not available yet.',
  "Le paiement en ligne n'est pas encore activé.": 'Online payment is not available yet.', 'Le paiement est momentanément indisponible.': 'Payment is temporarily unavailable.',
  'Aucune commande ne correspond à ces informations.': 'No order matches this information.',
  // Livraison (libellés du calcul)
  'Livraison standard': 'Standard shipping', 'Livraison express': 'Express shipping',
  'Colissimo · 2 à 3 jours ouvrés': 'Colissimo · 2 to 3 business days', 'Chronopost · livré le lendemain avant 13 h': 'Chronopost · next day before 1 pm',
  'Standard · 2–3 jours': 'Standard · 2–3 days', 'Express · 24 h': 'Express · 24 h',
};
const COUNTRIES_EN = { France: 'France', Belgique: 'Belgium', Luxembourg: 'Luxembourg', Monaco: 'Monaco', Suisse: 'Switzerland', Allemagne: 'Germany', Italie: 'Italy', Espagne: 'Spain', 'Pays-Bas': 'Netherlands', 'Royaume-Uni': 'United Kingdom' };
const PATTERNS = [
  [/^Il ne reste que (\d+) exemplaires? de (.+)\.$/, (m) => `Only ${m[1]} left of ${m[2]}.`],
  [/^(.+) est momentanément épuisé\.$/, (m) => `${m[1]} is temporarily sold out.`],
  [/^Ce code s’applique à partir de (.+) € d’achat\.$/, (m) => `This code applies to orders of €${m[1]} or more.`],
  [/^Vous pouvez enregistrer (\d+) adresses au maximum\.$/, (m) => `You can save up to ${m[1]} addresses.`],
  [/^(.+) Faites une nouvelle demande de lien\.$/, (m) => `${en(m[1])} Please request a new link.`],
  [/^Code (\S+) \(−(\d+) %\)$/, (m) => `Code ${m[1]} (−${m[2]}%)`],
];

export function en(msg) {
  if (typeof msg !== 'string') return msg;
  if (EXACT[msg]) return EXACT[msg];
  if (COUNTRIES_EN[msg]) return COUNTRIES_EN[msg];
  for (const [re, f] of PATTERNS) { const m = msg.match(re); if (m) return f(m); }
  return msg;
}

// Traduit une réponse JSON de l'API (messages, champs, libellés du calcul de commande).
export function translatePayload(d) {
  if (!d || typeof d !== 'object') return d;
  if (d.error) d.error = en(d.error);
  if (d.fields) for (const k of Object.keys(d.fields)) d.fields[k] = en(d.fields[k]);
  const q = d.quote;
  if (q) {
    if (q.promoError) q.promoError = en(q.promoError);
    if (q.promo?.label) q.promo.label = en(q.promo.label);
    for (const s of [q.shipping, ...(q.shippingOptions || [])]) if (s) { s.label = en(s.label); s.title = en(s.title); s.detail = en(s.detail); }
    for (const c of q.countries || []) c.name = en(c.name);
  }
  return d;
}
