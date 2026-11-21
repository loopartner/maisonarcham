# Back-end Maison Archam

Le site est statique (HTML/CSS/JS). Le back-end est fait de **fonctions serverless Vercel** dans `api/`, sans aucune dépendance npm.
Tant qu'un service n'est pas configuré, la fonction correspondante répond proprement « pas encore activé » et le site continue de marcher.

## Ce que fait chaque fonction

| Route | Rôle |
|---|---|
| `POST /api/payment-intent` | Paiement sur la page `commande.html` (carte, Apple Pay, Google Pay via Stripe Payment Element). Les prix viennent de `api/_lib/catalogue.js`, jamais du navigateur ; l'adresse est vérifiée. |
| `POST /api/checkout` | Variante : page de paiement hébergée par Stripe (non utilisée par défaut, gardée en secours). |
| `POST /api/stripe-webhook` | Appelée par Stripe après paiement : crée la commande (`MA-10001`, `MA-10002`…), envoie l'e-mail de confirmation au client et l'alerte à l'atelier. |
| `GET /api/order` | Suivi de commande (numéro **et** e-mail requis) + numéro affiché sur `merci.html`. |
| `POST /api/admin-order` | Changer le statut d'une commande (`confirmee`, `preparation`, `expediee`, `livree`, `annulee`) et ajouter un lien de suivi colis. Le client reçoit un e-mail au passage en « expediee ». `GET` liste les 50 dernières commandes. |
| `POST /api/newsletter` | Inscription newsletter. |
| `POST /api/contact` | Formulaire de contact → e-mail à l'atelier (on peut répondre directement au client). |

## Comptes, connexion et administration

Une seule page de connexion (`/connexion`) pour tout le monde. Il n'y a **aucun choix de rôle** dans le formulaire :
après connexion, le serveur envoie chaque personne vers son espace selon les droits de son compte.

| Route | Rôle |
|---|---|
| `POST /api/auth/register` | Création de compte (toujours un compte **client**). |
| `POST /api/auth/login` | Connexion ; la réponse indique l'espace de destination (`/compte` ou `/admin`). |
| `POST /api/auth/logout` | Déconnexion. |
| `GET /api/auth/me` | Compte connecté. |
| `POST /api/auth/forgot` / `reset` | Mot de passe oublié (lien valable 30 min, usage unique). |
| `POST /api/auth/verify` / `resend-verification` | Confirmation de l'adresse e-mail. |

**Devenir administrateur.** Dans Vercel, ajouter la variable `ADMIN_EMAILS` (une ou plusieurs adresses séparées par des virgules), puis redéployer.
Avec cette adresse : créer un compte normalement sur `/connexion`, puis cliquer le lien de confirmation reçu par e-mail
(ou utiliser « Mot de passe oublié », qui confirme aussi l'adresse). À la connexion suivante, le même formulaire mène au back-office.
Une adresse **non confirmée** n'a jamais accès à l'administration : personne ne peut « réserver » l'adresse de la Maison.

**Sécurité en place.**
- Mots de passe hachés avec scrypt (jamais stockés en clair), 8 caractères minimum avec lettre et chiffre.
- Session dans un cookie `__Host-` HttpOnly, Secure, SameSite=Lax ; seule l'empreinte du jeton est stockée en base. 14 jours pour un client, 12 h pour un administrateur.
- Changement de mot de passe → toutes les sessions du compte sont fermées.
- Anti-CSRF : toute requête qui modifie des données doit venir du site (en-tête Origin) et être en JSON.
- Limitation des tentatives par IP et par compte (blocage 15 min après 8 échecs).
- Messages identiques que le compte existe ou non (connexion, mot de passe oublié) et temps de réponse égalisé.
- Contrôle d'accès en deux barrières : le middleware (`middleware.js`) bloque les pages `/compte` et `/admin` avant envoi, et chaque API revérifie les droits. Un client qui tente `/admin` reçoit une page 404.
- En-têtes de sécurité (CSP stricte sans script inline, HSTS, anti-iframe, etc.) dans `vercel.json`. Polices hébergées sur le site (aucun appel à Google Fonts).

**Tests.** `npm test` lance les tests de bout en bout de l'authentification (base Redis simulée).

## Structure du code

- `src/pages/` : pages du nouveau site, assemblées par `scripts/build.mjs` avec `src/partials/` (en-tête, pied de page, navigation admin).
- `src/assets/` : CSS, JS, polices, images.
- `api/` : fonctions serverless. `middleware.js` : contrôle d'accès des pages privées.

## Mise en route (≈ 20 min)

Dans Vercel : **Project → Settings → Environment Variables**, puis **redéployer**.

### 1. Base de données : Upstash Redis (gratuit)
Vercel → **Storage** (ou Marketplace) → **Upstash for Redis** → relier au projet.
Ajoute automatiquement `KV_REST_API_URL` et `KV_REST_API_TOKEN`.

### 2. Paiement : Stripe
1. Compte sur stripe.com → **Développeurs → Clés API** → copier la clé secrète dans `STRIPE_SECRET_KEY` (`sk_test_…`) **et** la clé publiable dans `STRIPE_PUBLISHABLE_KEY` (`pk_test_…`). Commencer en mode test.
2. **Développeurs → Webhooks → Ajouter un endpoint** :
   - URL : `https://VOTRE-DOMAINE/api/stripe-webhook`
   - Événements : `payment_intent.succeeded` (indispensable), et si besoin `checkout.session.completed`
   - Copier le « secret de signature » dans `STRIPE_WEBHOOK_SECRET` (`whsec_…`).
3. Carte de test : `4242 4242 4242 4242`, date future, n'importe quel CVC.

### 3. E-mails : Resend
1. Compte sur resend.com → vérifier le domaine d'envoi.
2. `RESEND_API_KEY` = clé API, `MAIL_FROM` = `Maison Archam <bonjour@votre-domaine.fr>`.
3. Optionnel : créer une « Audience » et mettre son id dans `RESEND_AUDIENCE_ID` pour y ajouter les inscrits newsletter.

### Autres variables
| Variable | Exemple | Rôle |
|---|---|---|
| `ADMIN_EMAILS` | `direction@maison-archam.fr` | Adresse(s) du ou des **propriétaires** du back-office (adresse confirmée obligatoire). |
| `VERCEL_DEPLOY_HOOK` | `https://api.vercel.com/v1/integrations/deploy/…` | Bouton « Publier le site » du back-office (Vercel → Settings → Git → Deploy Hooks, branche de production). |
| `NEWSLETTER_SECRET` | longue chaîne aléatoire | Signature des liens de désinscription (facultatif, sinon dérivé du jeton Redis). |
| `CONTACT_TO_EMAIL` | `atelier@…` | Reçoit les messages du formulaire de contact |
| `ORDERS_NOTIFY_EMAIL` | `atelier@…` | Reçoit une alerte à chaque commande |
| `SITE_URL` | `https://maisonarcham.fr` | Adresse du site utilisée dans les liens des e-mails (sinon déduite automatiquement) |
| `SHIPPING_COUNTRIES` | `FR,BE,LU,MC` | Pays de livraison acceptés (défaut : `FR`) |

## Passer une commande en « expédiée »

```bash
curl -X POST https://VOTRE-DOMAINE/api/admin-order \
  -H "Content-Type: application/json" \
  -d '{"number":"MA-10001","status":"expediee","trackingUrl":"https://www.laposte.fr/outils/suivre-vos-envois?code=XXXX"}'
```

## Page de commande
`commande.html` : récapitulatif du panier modifiable, coordonnées, adresse auto-complétée (Base Adresse Nationale via la Géoplateforme IGN, gratuite, sans clé), puis paiement. Si le service d'adresses ne répond pas, on saisit simplement à la main.

## Pas encore fait
- **Espace client** (connexion / création de compte) : formulaires visuels uniquement. Le suivi se fait par numéro + e-mail, sans compte.
- **Modifier le prix ou ajouter un produit** : `api/_lib/catalogue.js` (prix serveur) **et** `cart.js` (affichage).

## Back-office

Accès : `/admin`, avec le même formulaire de connexion que les clients. Rôles (Paramètres → Administrateurs) :

| Rôle | Accès |
|---|---|
| Propriétaire (`ADMIN_EMAILS`) | Tout |
| Administrateur | Tout, sauf modifier un propriétaire |
| Gestion commandes | Tableau de bord, commandes, clients |
| Éditeur | Tableau de bord, contenu, fiches produits, newsletter |

Prix, stock, livraison et codes promo enregistrés dans l'admin s'appliquent **immédiatement** au calcul des commandes.
Textes, photos et articles sont intégrés aux pages au moment de la publication (bouton « Publier le site », environ une minute).
Toutes les actions sensibles sont tracées (journal d'audit : qui, quoi, quand, adresse IP).

**En local** : `npm run dev` lance le site avec une base simulée et un compte de démonstration (admin@maison.test / velours2026).
