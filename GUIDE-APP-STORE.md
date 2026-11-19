# Mettre Montée sur iPhone : pas à pas (version 3.16.1)

Pas besoin de Mac : l'app est construite dans le cloud par **Codemagic**, avec le même dépôt GitHub et le même `montee-app.zip` qu'Android.

L'ordre compte : on vérifie d'abord **gratuitement** que l'app iPhone se construit (étape 0), avant de toucher à la signature Apple. Si quelque chose casse, on le voit là, sans perdre de temps.

| Quoi | Coût | Où |
|---|---|---|
| Compte développeur Apple | 99 € par an | app « Apple Developer » sur iPhone, ou developer.apple.com |
| GitHub, Codemagic | gratuit | déjà en place pour Android |

---

## 0. Test de construction gratuit (avant tout le reste)

C'est la première fois que la partie iPhone est construite : on vérifie qu'elle compile, sans compte Apple.

1. Mets le nouveau `montee-app.zip` sur GitHub (comme pour Android).
2. Codemagic → « Start new build » → workflow **Montée iPhone → test Appetize (simulateur, gratuit)**.
3. **Si le build est vert** : la partie iPhone compile, tu peux passer à la suite.
4. **Si le build est rouge** : ouvre l'étape « Construire pour le simulateur », descends jusqu'aux lignes `error:`, et envoie-les-moi. Je corrige, tu relances.

Bonus facultatif : télécharge `Montee-iPhone-simulateur.zip` et dépose-le sur **appetize.io** (gratuit) pour voir l'app tourner sur un iPhone virtuel dans ton navigateur.

## 1. S'inscrire au programme développeur Apple

1. Le plus simple : l'app **Apple Developer** sur ton iPhone → « Account » → « Enroll Now ». Inscription « Individual » (à ton nom), paiement des 99 €.
2. Apple vérifie ton identité en scannant une pièce d'identité. **La liste des pièces proposées dépend du pays de ton identifiant Apple** (voir l'encadré plus bas si on ne te propose que le permis).
3. La validation prend de quelques heures à 2 jours. Attends l'e-mail de confirmation avant la suite.

> **On ne te propose que le permis de conduire ?**
> - Vérifie que ton identifiant Apple est bien en **France** : Réglages → ton nom → Médias et achats → Afficher le compte → Pays/région. Si ce n'est pas la France, la liste des pièces n'est pas la bonne.
> - Essaie depuis l'app Apple Developer sur l'iPhone, si tu étais sur le site (ou l'inverse).
> - Sinon, appelle le **support Apple Developer** (developer.apple.com/contact, « Membership and Account »). Ils peuvent débloquer l'inscription ou vérifier ton identité autrement. Un passeport est en général accepté partout.

## 2. Déclarer l'identifiant de l'app (avec Santé)

1. **developer.apple.com/account** → Certificates, Identifiers & Profiles → **Identifiers** → **+**.
2. « App IDs » → « App ».
3. Description : `Montee` · Bundle ID : **Explicit** → `fr.montennis.app`.
4. Dans la liste des capacités (« Capabilities »), coche **HealthKit**. Si une sous-option **Background Delivery** apparaît, coche-la aussi.
5. « Continue » puis « Register ».

> Important : HealthKit doit être coché **avant** de créer le profil de l'étape 6. Si tu l'ajoutes après, il faudra régénérer le profil.

## 3. Créer l'app dans App Store Connect

1. **appstoreconnect.apple.com** → Apps → **+** → « Nouvelle app ».
2. Plateforme iOS · Nom : `Montée – Classement tennis` · Langue : Français · Identifiant de lot : `fr.montennis.app` · SKU : `montee` · Accès complet.
3. Ouvre **Informations sur l'app** et note l'**Identifiant Apple** (un nombre à 10 chiffres). Il sert à l'étape 6.

## 4. Créer une clé API pour Codemagic

1. App Store Connect → **Utilisateurs et accès** → onglet **Intégrations** → **Clés API App Store Connect** → « Générer une clé API ».
2. Nom : `Codemagic` · Accès : **App Manager**.
3. **Télécharge le fichier .p8** (une seule fois possible !) et note l'**Issuer ID** et le **Key ID**.

## 5. Le projet sur GitHub

Rien à changer : même dépôt, même `montee-app.zip`. Un seul zip sert aux deux applis.

## 6. Configurer Codemagic

1. **Clé Apple** : Team settings → Team integrations → **Developer Portal** → « Connect » → nom **`Montee API`** (exactement), puis l'Issuer ID, le Key ID et le fichier .p8.
2. **Certificat** : Team settings → codemagic.yaml settings → **Code signing identities** → iOS certificates → « Generate certificate » (type Apple Distribution, avec la clé `Montee API`).
3. **Profil** : developer.apple.com → **Profiles** → **+** → « App Store Connect » → App ID `fr.montennis.app` → le certificat créé par Codemagic → nom `Montee App Store` → « Generate ».
4. Dans Codemagic : iOS provisioning profiles → « Fetch profiles » → choisis `Montee App Store`.
5. Sur GitHub, ouvre `codemagic.yaml` → crayon → remplace `0000000000` par l'**Identifiant Apple** de l'étape 3 → « Commit changes ».

## 7. Construire et installer avec TestFlight

1. Codemagic → « Start new build » → workflow **Montée iPhone → TestFlight**.
2. Environ 15 minutes plus tard, le build part sur TestFlight. Apple le traite (10 à 30 minutes ; tu reçois un e-mail).
3. Installe l'app **TestFlight** sur ton iPhone. App Store Connect → ton app → **TestFlight** → « Testeurs internes » → ajoute-toi. Tu reçois l'invitation, tu installes Montée.
4. À tester en priorité :
   - Connexion Ten'Up, synchro, notification de nouveau match.
   - Réglages → **Santé connectée** → « Connecter Apple Santé » : l'écran d'autorisation d'iOS doit apparaître. Autorise « Entraînements ». Tes séances de tennis de l'Apple Watch doivent apparaître dans « Revoir les séances ».
   - Une fiche de match : l'analyse, avec le palmarès de l'adversaire.

> Si le build échoue : « Download logs » et envoie-moi les lignes `error:`.

## 8. Tes copains sur TestFlight

- **Testeurs internes** (toi, jusqu'à 100 personnes ajoutées comme utilisateurs d'App Store Connect) : pas de validation, accès immédiat.
- **Testeurs externes** (tes copains, avec un simple lien) : TestFlight → « Testeurs externes » → **+** → crée un groupe « Copains » → ajoute le build → remplis « Informations de test » (texte ci-dessous) → Apple valide le premier build (en général sous 24 à 48 h). Ensuite, active le **lien public** et envoie-le sur WhatsApp : ils installent TestFlight, puis Montée.
- Texte « Ce qu'il faut tester » :
  > Connecte ton compte Ten'Up (Réglages › Ten'Up), regarde ta projection de classement, l'analyse de tes matchs et l'onglet Joueurs. Si tu as une Apple Watch, active Réglages › Santé connectée. Envoie tes retours avec une capture d'écran.

## 9. Publier sur l'App Store (plus tard)

1. App Store Connect → ton app → version **1.0** : copie les textes de `appstore/FICHE-APP-STORE.md`.
2. Captures : glisse les 6 images de `appstore/captures` (format iPhone 6,7 pouces, noms d'exemple uniquement).
3. **Build** : celui envoyé par Codemagic.
4. **Confidentialité de l'app** : « Nous ne collectons pas de données ».
5. Classification par âge : « Aucun » partout.
6. Notes pour la vérification : colle le texte de la fiche (il explique Ten'Up et l'usage d'Apple Santé).
7. « Ajouter pour vérification » → « Soumettre ». Réponse d'Apple en général sous 24 à 48 h.

---

## Ce qu'il faut savoir

- **Mises à jour** : nouveau zip sur GitHub, puis workflow **Montée iPhone → TestFlight**. La version suit Android, le numéro de build s'incrémente tout seul.
- **Apple Santé** : Montée lit seulement les entraînements, rien n'est écrit. iOS ne dit jamais à une app si tu as refusé la lecture : si tes séances n'apparaissent pas, vérifie Réglages → Santé → Accès aux données et appareils → Montée.
- **Notification de nouvelle séance** : c'est iOS qui réveille Montée, en général dans l'heure qui suit la fin de la séance, parfois plus tard. Sinon, la séance t'attend sur l'accueil à la prochaine ouverture.
- **Widgets** : pas encore sur iPhone (ils demandent une extension iOS à part). Prévus pour une version suivante.
- **Risques de refus Apple** : Apple peut demander des précisions sur l'usage de Ten'Up (marque de la FFT) ou d'Apple Santé. Les notes de vérification l'expliquent ; si Apple refuse, envoie-moi son message.
