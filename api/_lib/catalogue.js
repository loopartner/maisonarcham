// Catalogue de référence : le prix payé est TOUJOURS celui-ci, jamais celui envoyé par le navigateur.
export const PRODUCTS = {
  'creme-dararat-50': {
    name: "Crème d'Ararat",
    variant: 'Extrait de parfum · 50 ml',
    price: 18500, // en centimes
    image: '/assets/img/flacon-produit.webp',
  },
};
export const MAX_QTY = 10;

// Modes de livraison (prix en centimes). Le serveur est seul juge du prix appliqué.
export const SHIPPING = {
  standard: { label: 'Standard · 2–3 jours', title: 'Livraison standard', detail: 'Colissimo · 2 à 3 jours ouvrés', price: 0 },
  express: { label: 'Express · 24 h', title: 'Livraison express', detail: 'Chronopost · livré le lendemain avant 13 h', price: 1500 },
};
export const DEFAULT_SHIPPING = 'standard';

// Pays de livraison proposés (la variable SHIPPING_COUNTRIES restreint la liste acceptée par le serveur).
export const COUNTRIES = { FR: 'France', BE: 'Belgique', LU: 'Luxembourg', MC: 'Monaco', CH: 'Suisse', DE: 'Allemagne', IT: 'Italie', ES: 'Espagne', NL: 'Pays-Bas', GB: 'Royaume-Uni' };
