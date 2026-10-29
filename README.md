# Lashéane : site de la marque

Site vitrine et boutique des kits d'extensions de cils Lashéane.

- **Hébergement :** Cloudflare Pages (gratuit)
- **Administration :** Decap CMS, à l'adresse `/admin` du site. La cliente y modifie textes, prix, photos, couleurs, livraison et réseaux sociaux sans toucher au code.
- **Paiement :** Stripe Checkout. L'argent arrive sur l'IBAN enregistré dans le compte Stripe de la cliente.

## Contenu du dépôt

| Dossier ou fichier | Rôle |
| --- | --- |
| `content/` | Tous les textes, prix et réglages, modifiés depuis l'administration |
| `static/img/` | Photos et logo (les photos ajoutées depuis l'administration arrivent ici) |
| `static/admin/` | L'espace d'administration (Decap CMS) |
| `src/` | Mise en forme (`styles.css`) et panier (`app.js`) |
| `functions/api/` | Paiement Stripe (`checkout.js`) et connexion à l'administration (`auth.js`, `callback.js`) |
| `build.mjs` | Assemble le site dans `dist/` à chaque modification |

## Mise en ligne (à faire une seule fois)

### 1. Publier le site sur Cloudflare Pages

1. Créer un compte gratuit sur [dash.cloudflare.com](https://dash.cloudflare.com).
2. Aller dans **Workers & Pages** › **Créer** › onglet **Pages** › **Se connecter à Git**, puis choisir ce dépôt GitHub.
3. Réglages de construction :
   - Préréglage du framework : **Aucun**
   - Commande de construction : `node build.mjs`
   - Répertoire de sortie : `dist`
4. Cliquer sur **Enregistrer et déployer**. Noter l'adresse obtenue, du type `https://lasheane.pages.dev`.

### 2. Activer la connexion à l'administration

1. Sur GitHub : **Settings** › **Developer settings** › **OAuth Apps** › **New OAuth App**.
   - Application name : `Lashéane admin`
   - Homepage URL : `https://lasheane.pages.dev` (l'adresse du site)
   - Authorization callback URL : `https://lasheane.pages.dev/api/callback`
2. Copier le **Client ID**, puis cliquer sur **Generate a new client secret** et copier le secret.
3. Dans Cloudflare, ouvrir le projet › **Paramètres** › **Variables et secrets**, puis ajouter, en type **Secret** :
   - `GITHUB_CLIENT_ID` : le Client ID
   - `GITHUB_CLIENT_SECRET` : le secret
4. Relancer un déploiement (**Déploiements** › dernier déploiement › **Réessayer le déploiement**).

### 3. Activer le paiement Stripe (compte de la cliente)

1. La cliente crée son compte sur [stripe.com](https://stripe.com) et l'active avec son identité et son IBAN.
2. Dans Stripe : **Développeurs** › **Clés API**, puis copier la **clé secrète**. Elle commence par `sk_test_` en mode test et par `sk_live_` en mode réel.
3. Dans Cloudflare, ajouter le secret `STRIPE_SECRET_KEY`, puis relancer un déploiement.
4. Dans Stripe : **Paramètres** › **E-mails clients**, activer l'envoi d'un reçu après chaque paiement réussi.
5. Tester avec la clé `sk_test_` et la carte `4242 4242 4242 4242` (date future, n'importe quel code). Remplacer ensuite la clé par `sk_live_` pour le lancement.

### 4. Donner l'accès à la cliente

1. La cliente crée un compte GitHub gratuit.
2. Dans ce dépôt : **Settings** › **Collaborators** › **Add people**, puis saisir son nom d'utilisateur. Elle accepte l'invitation reçue par email.

### 5. Nom de domaine (facultatif)

Dans Cloudflare : projet › **Domaines personnalisés**. Une fois le domaine actif, mettre à jour les deux adresses de l'OAuth App GitHub (étape 2) avec le nouveau domaine.

## Guide de la cliente

1. Aller sur l'adresse du site suivie de `/admin` (exemple : `https://lasheane.pages.dev/admin`).
2. Cliquer sur **Se connecter avec GitHub**.
3. Choisir une rubrique :
   - **Prix, offre et livraison** : offre de lancement, frais et délais de livraison, pays livrés
   - **Les kits** : nom, description, prix, photo, badge, disponibilité
   - **Page d'accueil** : tous les textes et les grandes photos
   - **Notre histoire**
   - **Contact et réseaux** : email, Instagram, TikTok
   - **Couleurs**
4. Modifier, puis cliquer sur **Publier** › **Publier maintenant**. Le site est mis à jour en 1 à 2 minutes.

**Fin de l'offre de lancement :** dans **Prix, offre et livraison**, décocher « Offre de lancement en cours », puis publier. Les prix normaux s'affichent partout et les mentions de lancement disparaissent.

**Rupture de stock :** dans **Les kits**, décocher « Disponible à la vente » pour le kit concerné.

**Commandes :** chaque commande apparaît dans Stripe, rubrique **Paiements**, avec l'adresse de livraison et le téléphone de la cliente.

**Codes promo :** ils se créent dans Stripe (**Catalogue de produits** › **Coupons**). Le champ « code promo » apparaît automatiquement sur la page de paiement.
