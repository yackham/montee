# Montée 3.25 — app Apple Watch et Montée+ : ce qu'il faut régler chez Apple

À faire **avant** d'envoyer la 3.25 sur Codemagic. Compte environ 1 h.

## 1. Accord « Apps payantes » (App Store Connect)

Section **Entreprise** (« Business ») d'App Store Connect, accessible directement par https://appstoreconnect.apple.com/business (l'ancien « Accords, taxes et banque »). Accepte l'accord **Apps payantes** (« Paid Apps »), puis remplis les coordonnées bancaires et le formulaire fiscal.
Si l'accord n'apparaît pas : accepte d'abord la dernière version du contrat du programme développeur sur developer.apple.com › Account.
Tant qu'il n'est pas actif, Montée+ affiche ses formules mais aucun achat ne se lance.

Inscris-toi aussi au **Small Business Program** (commission de 15 % au lieu de 30 %) : developer.apple.com/app-store/small-business-program.

## 2. Identifiant de l'app montre (developer.apple.com)

1. **Certificates, Identifiers & Profiles → Identifiers → + → App IDs → App**.
2. Description : `Montee Watch` · Bundle ID **explicite** : `fr.montennis.app.watchkitapp`.
3. Coche **HealthKit** dans les capacités → **Register**.
4. Sur l'identifiant `fr.montennis.app` : vérifie que **In-App Purchase** est coché (c'est le cas par défaut).

Codemagic crée tout seul le profil de signature de la montre au build suivant.
Si le build échoue à la signature : **Profiles → +** → « App Store Connect » → App ID `fr.montennis.app.watchkitapp` → même certificat que l'app → puis dans Codemagic, **Code signing identities → Fetch profiles**.

## 3. Les produits Montée+ (App Store Connect → ton app → Monétisation)

### Abonnements

**Abonnements → Créer un groupe** : nom `Montée+`. Dans ce groupe, deux abonnements :

| Identifiant (exactement) | Nom de référence | Durée | Prix |
|---|---|---|---|
| `plus_saison` | Montée+ Saison | 1 an | 14,99 € |
| `plus_mois` | Montée+ Mensuel | 1 mois | 1,99 € |

Pour chacun, il faut aussi :
- **Localisation (Français)** : nom affiché « Montée+ Saison » / « Montée+ Mensuel », description « L'app Apple Watch, tes stats de service et 3 habillages. »
- **Informations pour la vérification** : la capture de l'écran Montée+ (menu › Montée+), plus la note : « Montée+ débloque l'app Apple Watch (score, cardio, séance Tennis), les statistiques de service et 3 thèmes. Le calcul du classement reste gratuit. Un match par mois est offert sur la montre, ce qui permet de la tester sans payer. »

### Achat à vie

**Achats intégrés → +** → type **Non consommable** :

| Identifiant (exactement) | Nom | Prix |
|---|---|---|
| `plus_vie` | Montée+ à vie | 39,99 € |

Même description, même capture, même note.

### Les mentions obligatoires pour un abonnement

Dans la **description de l'app** (page de la version), ajoute à la fin :

> Montée+ : 14,99 €/an ou 1,99 €/mois, renouvellement automatique sauf résiliation 24 h avant la fin de la période, ou 39,99 € à vie.
> Conditions d'utilisation : https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> Confidentialité : https://yackham.github.io/montee-confidentialite/

## 4. Ton accès gratuit

- **TestFlight** : les achats ne sont jamais débités, tu peux tout tester.
- **Sur l'App Store** : `plus_vie` → **Codes d'offre** → crée un code gratuit, puis saisis-le sur ton iPhone (App Store › ta photo › « Utiliser une carte cadeau ou un code »).
  Si l'option n'apparaît pas pour l'achat à vie, fais la même chose sur l'abonnement `plus_saison` (code « gratuit 1 an », à refaire chaque année).

## 5. Envoyer la version

1. Mets le nouveau `codemagic.yaml` du zip sur GitHub (il y a une étape « App Apple Watch »), puis `montee-app.zip`.
2. Lance **Montée iPhone → TestFlight**.
3. Si le build bloque à cause de la montre, mets `SANS_MONTRE_IOS: 1` dans `codemagic.yaml` : l'app part sans la montre, et Montée+ reste utilisable.
4. Mets à jour la page de confidentialité sur GitHub (dépôt `montee-confidentialite`, fichier `index.html`) : elle parle maintenant de la montre et de Montée+.
5. Dans la page de la version 3.25, section **Achats intégrés et abonnements**, coche `plus_saison`, `plus_mois` et `plus_vie` : les premiers produits partent **avec** une version.

## 6. À tester sur ta montre (TestFlight)

1. Installe Montée 3.25 depuis TestFlight sur l'iPhone : l'app montre s'installe avec (sinon : app Watch de l'iPhone › Montée › Installer).
2. Ouvre Montée sur l'iPhone une fois : la montre reçoit ton classement et tes adversaires.
3. Sur la montre : Démarrer un match → type et format → adversaire → qui sert. Autorise Santé.
4. Compte quelques points, une faute, une double faute, et annule avec ↺.
5. Arrête le match (glisse à gauche jusqu'aux réglages › Arrêter le match) → Enregistrer.
6. Sur l'iPhone, le match arrive prérempli : vérifie et enregistre. La fiche du match montre « Au service ».
7. Menu › Montée+ → achat en sandbox → Montée+ actif, sur la montre aussi.
