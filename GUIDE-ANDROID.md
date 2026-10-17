# Montée sur Android : l'APK de test, pas à pas

But : construire l'app Android **gratuitement** et l'envoyer à tes testeurs par WhatsApp.
Pas besoin de compte Google Play pour ça. Il te faut un **ordinateur** pour l'étape 2 (envoi des fichiers), le reste se fait aussi sur téléphone.

## 1. Dézippe le projet

Dézippe `montee-app.zip` : tu obtiens un dossier `montee` avec, entre autres, les dossiers `web`, `ios`, `android`, `scripts`, `appstore`.

## 2. Mets le projet sur GitHub (gratuit)

1. Crée un compte sur **github.com** si tu n'en as pas.
2. **New repository** › nom `montee` › **Private** › **Create repository**.
3. Clique sur **uploading an existing file**. Ouvre le dossier `montee` et glisse **tout sauf le dossier `android`** dans la page. Clique **Commit changes**.
4. Dans le dépôt : **Add file › Upload files**, glisse le **dossier `android`** entier. **Commit changes**.

> GitHub accepte 100 fichiers par envoi : c'est pour ça qu'on fait `android` à part.

## 3. Branche Codemagic (gratuit, 500 minutes par mois)

1. **codemagic.io** › **Sign up** avec ton compte GitHub.
2. **Add application** › choisis le dépôt `montee` › type de projet **codemagic.yaml** › **Finish**.

## 4. Construis l'APK

1. Dans Codemagic, ton app › **Start new build**.
2. Choisis le workflow **Montée Android → APK de test** › **Start new build**.
3. Environ 10 minutes plus tard, le build est vert. Dans la page du build, section **Artifacts**, télécharge **Montee.apk**.

> Si le build est rouge : bouton **Download logs** en haut de la page, et envoie-moi le fichier.

## 5. Envoie l'APK à tes testeurs

Dans WhatsApp : trombone › **Document** › choisis `Montee.apk`. Envoie-le à Nico et à ton père.

## 6. Ce que font tes testeurs (sur Android)

1. Ils touchent le fichier `Montee.apk` reçu dans WhatsApp.
2. Android demande d'autoriser l'installation depuis WhatsApp (ou Fichiers) : **Paramètres › Autoriser cette source**, puis retour.
3. **Installer**. Si Play Protect affiche « Application inconnue » : **Plus de détails › Installer quand même**. C'est normal pour une app qui ne vient pas du Play Store.
4. Ils ouvrent Montée › **C'est parti** › choisissent leur classement › **Connecter mon compte Ten'Up**.
5. La vraie page Ten'Up s'ouvre : ils se connectent avec leur e-mail et mot de passe Ten'Up. Montée récupère leur palmarès tout seul et la fenêtre se ferme.
6. Ils acceptent les notifications quand l'app le demande.

## 7. Ce que je veux savoir après leur test

- La connexion Ten'Up a-t-elle marché du premier coup ? Une vérification « je ne suis pas un robot » est-elle apparue ?
- Le palmarès est-il complet (dates, scores, sans les doubles) ?
- Le lendemain : en rouvrant l'app, les nouveaux matchs arrivent-ils ? Une notification est-elle arrivée ?

## Mettre à jour l'app de test

Quand je te donne une nouvelle version : remplace les fichiers sur GitHub, relance le build Android dans Codemagic, renvoie le nouvel APK. Il s'installe **par-dessus** l'ancien : les testeurs gardent leurs matchs.

## Pour plus tard : le Play Store

Le jour où tu veux que n'importe qui l'installe sans avertissement : compte Google Play Console (25 $, une seule fois), et je te prépare la version Play Store.
