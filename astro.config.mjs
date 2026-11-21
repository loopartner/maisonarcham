// Configuration Astro — site statique multilingue (fr par défaut, en sous /en/).
// Les API (dossier api/) et le contrôle d'accès (middleware.js) restent des fonctions Vercel indépendantes.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL || 'https://maisonarcham.fr',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'never', assets: '_astro' },
  vite: { build: { assetsInlineLimit: 0 } },
  i18n: { locales: ['fr', 'en'], defaultLocale: 'fr', routing: { prefixDefaultLocale: false } },
  devToolbar: { enabled: false },
  image: { responsiveStyles: false },
});
