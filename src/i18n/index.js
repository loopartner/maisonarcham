// Traductions : t(lang)('cle') → texte. Les clés absentes font échouer le build (aucun texte oublié en ligne).
import fr from './fr.js';
import en from './en.js';
export { path, ROUTES, LOCALES, LOCALE_NAMES } from './routes.js';

const DICTS = { fr, en };

export function useT(lang) {
  const d = DICTS[lang];
  return (key, vars) => {
    let s = d[key];
    if (s === undefined) throw new Error(`Traduction manquante [${lang}] : ${key}`);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

// Textes utilisés par les scripts du navigateur (préfixe « js. »)
export function clientStrings(lang) {
  return Object.fromEntries(Object.entries(DICTS[lang]).filter(([k]) => k.startsWith('js.')).map(([k, v]) => [k.slice(3), v]));
}

export const fmtEuros = (lang, cents) => (cents / 100).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 });
export const fmtDate = (lang, d, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { ...opts, timeZone: 'UTC' });
