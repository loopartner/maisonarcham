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
  standard: { label: 'Standard · 2–3 jours', price: 0 },
  express: { label: 'Express · 24 h', price: 1500 },
};
export const DEFAULT_SHIPPING = 'standard';
