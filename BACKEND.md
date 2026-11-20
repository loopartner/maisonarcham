# Back-end Maison Archam

Le site est statique (HTML/CSS/JS). Le back-end est fait de **fonctions serverless Vercel** dans `api/`, sans aucune dépendance npm.
Tant qu'un service n'est pas configuré, la fonction correspondante répond proprement « pas encore activé » et le site continue de marcher.

## Ce que fait chaque fonction

| Route | Rôle |
|---|---|
| `POST /api/checkout` | Crée la page de paiement Stripe à partir du panier. Les prix viennent de `api/_lib/catalogue.js`, jamais du navigateur. |
| `POST /api/stripe-webhook` | Appelée par Stripe après paiement : crée la commande (`MA-10001`, `MA-10002`…), envoie l'e-mail de confirmation au client et l'alerte à l'atelier. |
| `GET /api/order` | Suivi de commande (numéro **et** e-mail requis) + numéro affiché sur `merci.html`. |
| `POST /api/admin-order` | Changer le statut d'une commande (`confirmee`, `preparation`, `expediee`, `livree`, `annulee`) et ajouter un lien de suivi colis. Le client reçoit un e-mail au passage en « expediee ». `GET` liste les 50 dernières commandes. |
| `POST /api/newsletter` | Inscription newsletter. |
| `POST /api/contact` | Formulaire de contact → e-mail à l'atelier (on peut répondre directement au client). |

## Mise en route (≈ 20 min)

Dans Vercel : **Project → Settings → Environment Variables**, puis **redéployer**.

### 1. Base de données : Upstash Redis (gratuit)
Vercel → **Storage** (ou Marketplace) → **Upstash for Redis** → relier au projet.
Ajoute automatiquement `KV_REST_API_URL` et `KV_REST_API_TOKEN`.

### 2. Paiement : Stripe
1. Compte sur stripe.com → **Développeurs → Clés API** → copier la clé secrète dans `STRIPE_SECRET_KEY` (commencer en mode test `sk_test_…`).
2. **Développeurs → Webhooks → Ajouter un endpoint** :
   - URL : `https://VOTRE-DOMAINE/api/stripe-webhook`
   - Événements : `checkout.session.completed` et `checkout.session.async_payment_succeeded`
   - Copier le « secret de signature » dans `STRIPE_WEBHOOK_SECRET` (`whsec_…`).
3. Carte de test : `4242 4242 4242 4242`, date future, n'importe quel CVC.

### 3. E-mails : Resend
1. Compte sur resend.com → vérifier le domaine d'envoi.
2. `RESEND_API_KEY` = clé API, `MAIL_FROM` = `Maison Archam <bonjour@votre-domaine.fr>`.
3. Optionnel : créer une « Audience » et mettre son id dans `RESEND_AUDIENCE_ID` pour y ajouter les inscrits newsletter.

### Autres variables
| Variable | Exemple | Rôle |
|---|---|---|
| `CONTACT_TO_EMAIL` | `atelier@…` | Reçoit les messages du formulaire de contact |
| `ORDERS_NOTIFY_EMAIL` | `atelier@…` | Reçoit une alerte à chaque commande |
| `ADMIN_TOKEN` | longue chaîne aléatoire (32+ caractères) | Protège `/api/admin-order` |
| `SITE_URL` | `https://maisonarcham.fr` | Liens dans les e-mails (sinon déduit automatiquement) |
| `SHIPPING_COUNTRIES` | `FR,BE,LU,MC` | Pays de livraison acceptés (défaut : `FR`) |

## Passer une commande en « expédiée »

```bash
curl -X POST https://VOTRE-DOMAINE/api/admin-order \
  -H "Authorization: Bearer VOTRE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"number":"MA-10001","status":"expediee","trackingUrl":"https://www.laposte.fr/outils/suivre-vos-envois?code=XXXX"}'
```

## Pas encore fait
- **Espace client** (connexion / création de compte) : formulaires visuels uniquement. Le suivi se fait par numéro + e-mail, sans compte.
- **Modifier le prix ou ajouter un produit** : `api/_lib/catalogue.js` (prix serveur) **et** `cart.js` (affichage).
