# Montée — classement tennis

- `web/` : l'application (site Netlify https://montennis.netlify.app, et contenu de l'app iPhone).
- `ios/` : projet iPhone (Capacitor) : connexion Ten'Up, actualisation en arrière-plan, notifications.
- `codemagic.yaml` : construction de l'app iPhone dans le cloud et envoi sur TestFlight.
- `appstore/` : textes de la fiche App Store et captures d'écran.
- `GUIDE-APP-STORE.md` : le pas à pas pour publier.

Netlify : dossier publié `web` (déjà réglé dans `netlify.toml`). Le glisser-déposer du dossier `web` marche aussi.

## Android

- Le projet Android est dans `android/` (même app, même connexion Ten'Up et même synchro).
- `npm run sync:android` copie l'app web dans le projet Android.
- APK de test : workflow Codemagic **Montée Android → APK de test** (voir `GUIDE-ANDROID.md`). Il est signé avec une clé de test (`android/app/montee-test.keystore`), toujours la même pour que les mises à jour s'installent par-dessus.
