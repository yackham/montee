# Mettre Montée sur l'App Store — pas à pas

Pas besoin de Mac : l'app est construite dans le cloud par **Codemagic** (gratuit jusqu'à 500 minutes par mois, un build prend environ 10 minutes).
Certaines étapes sont plus confortables sur un ordinateur, mais tout se fait dans un navigateur.

## Ce qu'il te faut

| Quoi | Coût | Où |
|---|---|---|
| Compte développeur Apple | 99 € par an | developer.apple.com/programs |
| Compte GitHub (dépôt privé) | gratuit | github.com |
| Compte Codemagic | gratuit | codemagic.io |

---

## 1. S'inscrire au programme développeur Apple

1. Va sur **developer.apple.com/programs**, « Enroll », connecte-toi avec ton identifiant Apple.
2. Choisis « Individual » (à ton nom), paie les 99 €.
3. La validation prend de quelques heures à 2 jours. Attends l'e-mail de confirmation avant la suite.

## 2. Déclarer l'identifiant de l'app

1. **developer.apple.com/account** › Certificates, Identifiers & Profiles › **Identifiers** › bouton **+**.
2. « App IDs » › « App ».
3. Description : `Montee` · Bundle ID : **Explicit** › `fr.montennis.app`.
4. Ne coche aucune option, « Continue » puis « Register ».

## 3. Créer l'app dans App Store Connect

1. **appstoreconnect.apple.com** › Apps › **+** › « Nouvelle app ».
2. Plateforme iOS · Nom : `Montée – Classement tennis` · Langue : Français · Identifiant de lot : `fr.montennis.app` · SKU : `montee` · Accès complet.
3. Une fois créée, ouvre **Informations sur l'app** et note l'**Identifiant Apple** (un nombre à 10 chiffres). Tu en as besoin à l'étape 6.

## 4. Créer une clé API pour Codemagic

1. App Store Connect › **Utilisateurs et accès** › onglet **Intégrations** › **Clés API App Store Connect** › « Générer une clé API ».
2. Nom : `Codemagic` · Accès : **App Manager**.
3. **Télécharge le fichier .p8** (une seule fois possible !) et note l'**Issuer ID** et le **Key ID** affichés sur la page.

## 5. Mettre le projet sur GitHub

1. Sur **github.com** › « New repository » › nom `montee` › **Private** › « Create repository ».
2. « uploading an existing file » › glisse **tout le contenu** du dossier `montee` (dézippé) : les dossiers `web`, `ios`, `scripts`, `appstore` et les fichiers à la racine.
3. « Commit changes ».

> Astuce : tu peux ensuite relier Netlify à ce même dépôt (Add new site › Import from Git › dossier publié : `web`). Chaque modification du dépôt mettra aussi le site à jour.

## 6. Configurer Codemagic

1. **codemagic.io** › « Sign up » avec ton compte GitHub › « Add application » › choisis le dépôt `montee` › type **codemagic.yaml**.
2. **Clé Apple** : Team settings › Team integrations › **Developer Portal** › « Connect » › nom **`Montee API`** (exactement), puis l'Issuer ID, le Key ID et le fichier .p8 de l'étape 4.
3. **Certificat** : Team settings › codemagic.yaml settings › **Code signing identities** › iOS certificates › « Generate certificate » (type Apple Distribution, avec la clé `Montee API`). Donne-lui un nom, Codemagic le garde.
4. **Profil** : retourne sur developer.apple.com › **Profiles** › **+** › « App Store Connect » › App ID `fr.montennis.app` › choisis le certificat que Codemagic vient de créer › nom `Montee App Store` › « Generate ».
5. Dans Codemagic, iOS provisioning profiles › « Fetch profiles » › choisis `Montee App Store`.
6. Sur GitHub, ouvre `codemagic.yaml` › crayon (modifier) › remplace `0000000000` par l'**Identifiant Apple** de l'étape 3 › « Commit changes ».

## 7. Construire et tester

1. Codemagic › ton app › « Start new build » › workflow **Montée iPhone → TestFlight**.
2. ~10–15 minutes plus tard, le build part sur **TestFlight**. Apple le traite (10 à 30 minutes).
3. Installe l'app **TestFlight** sur ton iPhone. Dans App Store Connect › TestFlight, ajoute-toi comme testeur interne : tu reçois une invitation et tu installes Montée.
4. Teste : connexion Ten'Up, actualisation, notifications.

> Si le build échoue, télécharge le journal (bouton « Download logs ») et envoie-le-moi.

## 8. Publier sur l'App Store

1. App Store Connect › ton app › version **1.0** : copie les textes de `appstore/FICHE-APP-STORE.md`.
2. Captures : glisse les images du dossier `appstore/captures` dans la section « iPhone 6,7 pouces ».
3. **Build** : choisis celui envoyé par Codemagic.
4. **Confidentialité de l'app** : « Nous ne collectons pas de données ».
5. Classification par âge : tout « Aucun ».
6. Notes pour la vérification : colle le texte prévu dans la fiche.
7. « Ajouter pour vérification » › « Soumettre ». Réponse d'Apple en général sous 24 à 48 heures.

---

## Ce qu'il faut savoir

- **Mises à jour** : modifie les fichiers sur GitHub, puis relance un build dans Codemagic. Le numéro de build s'incrémente tout seul. Pour une nouvelle version publique, change aussi le numéro de version (1.0 → 1.1) : demande-moi, c'est deux lignes à modifier.
- **Actualisation automatique** : à chaque ouverture de l'app c'est garanti. En arrière-plan, c'est iOS qui décide quand l'app peut tourner (en général quelques fois par jour si tu l'utilises souvent, moins sinon). Les notifications de nouveau match arrivent donc avec un délai variable.
- **Session Ten'Up** : si Ten'Up te déconnecte, Montée te prévient une fois et te demande de te reconnecter.
- **Bouton de don** : il est masqué dans l'app iPhone, car Apple interdit les liens de paiement externes hors de son système d'achat. Il reste sur le site web.
- **Risques de refus Apple** : Apple peut demander des précisions sur l'usage de Ten'Up (marque de la FFT) ou sur la connexion à un service tiers. Les notes de vérification l'expliquent ; si Apple refuse, envoie-moi son message.
