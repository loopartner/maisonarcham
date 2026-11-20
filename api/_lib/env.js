// Lecture des variables d'environnement (configurées dans Vercel > Settings > Environment Variables)
export const env = (name, fallback = '') => process.env[name] || fallback;
