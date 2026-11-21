// Adresses de chaque page dans chaque langue. Le français est servi à la racine, l'anglais sous /en.
export const LOCALES = ['fr', 'en'];
export const DEFAULT_LOCALE = 'fr';
export const LOCALE_NAMES = { fr: 'Français', en: 'English' };

export const ROUTES = {
  home: { fr: '/', en: '/en' },
  parfum: { fr: '/parfum', en: '/en/perfume' },
  panier: { fr: '/panier', en: '/en/cart' },
  commande: { fr: '/commande', en: '/en/checkout' },
  confirmation: { fr: '/confirmation', en: '/en/confirmation' },
  journal: { fr: '/journal', en: '/en/journal' },
  maison: { fr: '/maison', en: '/en/the-house' },
  newsletter: { fr: '/newsletter', en: '/en/newsletter' },
  nlConfirm: { fr: '/newsletter/confirmer', en: '/en/newsletter/confirm' },
  nlUnsub: { fr: '/newsletter/desinscription', en: '/en/newsletter/unsubscribe' },
  aide: { fr: '/aide', en: '/en/help' },
  connexion: { fr: '/connexion', en: '/en/login' },
  reinit: { fr: '/reinitialiser', en: '/en/reset-password' },
  verifier: { fr: '/verifier', en: '/en/verify-email' },
  compte: { fr: '/compte', en: '/en/account' },
  compteCommande: { fr: '/compte/commande', en: '/en/account/order' },
  cgv: { fr: '/cgv', en: '/en/terms' },
  confidentialite: { fr: '/confidentialite', en: '/en/privacy' },
  mentions: { fr: '/mentions-legales', en: '/en/legal-notice' },
};

export const path = (lang, key, slug) => {
  const r = ROUTES[key];
  if (!r) throw new Error(`Route inconnue : ${key}`);
  return slug ? `${r[lang]}/${slug}`.replace('//', '/') : r[lang];
};
