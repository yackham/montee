# Montée — widgets iPhone et « Soutenir Montée »

> **En pause dans la 3.23 (version de test)** : `SUPPORTER: false` et `IOS_WIDGETS: false` dans `web/app.js`, projet Xcode sans l'extension. Voir `ios/widgets-plus-tard/LISEZMOI.md` pour les rallumer.

Cette version ajoute deux choses qui demandent un réglage chez Apple et Google :
- les **widgets iPhone**, qui ont besoin d'un groupe d'apps et d'un deuxième profil de signature ;
- les **achats intégrés « Soutenir Montée »**, qu'il faut créer dans les deux stores.

Sans ces réglages, le build iPhone échoue à la signature. En dépannage, tu peux construire **sans widgets** en mettant `SANS_WIDGETS_IOS: 1` dans `codemagic.yaml`.

---

## 1. Apple Developer (developer.apple.com → Certificates, Identifiers & Profiles)

1. **Identifiers → + → App Groups** → description « Montée », identifiant **`group.fr.montennis.app`**.
2. **Identifiers → `fr.montennis.app`** → coche **App Groups** → *Configure* → coche `group.fr.montennis.app` → *Save*.
   (Le profil existant de l'app devient invalide : c'est normal, on le régénère à l'étape 4.)
3. **Identifiers → + → App IDs → App** → description « Montée Widgets », Bundle ID explicite **`fr.montennis.app.widgets`** → coche **App Groups** → *Configure* → `group.fr.montennis.app`.
4. **Profiles** :
   - régénère le profil **App Store** de `fr.montennis.app` (Edit → Save) ;
   - crée un profil **App Store** pour `fr.montennis.app.widgets` (même certificat de distribution).
5. **Codemagic → Team settings → Code signing identities → iOS provisioning profiles → Fetch profiles** : récupère les deux profils.

## 2. App Store Connect

1. **Accords, taxes et banque** : l'accord **« Apps payantes »** doit être actif (coordonnées bancaires + formulaire fiscal). Sans lui, les achats intégrés ne s'affichent pas.
2. **Ton app → Monétisation → Achats intégrés → +** (type **Non consommable**), trois fois :

| Identifiant (exactement) | Nom affiché | Prix |
|---|---|---|
| `supporter_balle` | Une balle | 1,99 € |
| `supporter_cordage` | Un cordage | 4,99 € |
| `supporter_bobine` | Une bobine | 9,99 € |

   Description courte (exemple) : « Soutiens Montée et débloque les thèmes Indoor, Nocturne et Rétro, les cartes du mois Supporter et le badge Supporter. »
   Ajoute une **capture d'écran pour la vérification** (l'écran Soutenir Montée) et une note : « Bonus cosmétiques uniquement, aucune fonction de calcul n'est bloquée. »
3. Dans la **page de la version 3.22**, section **Achats intégrés**, coche les trois achats : les premiers achats intégrés doivent être soumis **avec** une version de l'app.
4. **Programme petites entreprises (Small Business Program)** : inscris-toi si ce n'est pas fait, la commission passe de 30 % à 15 %.

## 3. Google Play Console

1. **Profil de paiement** (compte marchand) : nécessaire pour vendre.
2. **Ton app → Monétiser → Produits → Produits intégrés à l'application → Créer** : mêmes trois identifiants `supporter_balle`, `supporter_cordage`, `supporter_bobine`, mêmes prix, puis **Activer**.
   (Les produits n'apparaissent qu'une fois qu'une version contenant la bibliothèque Billing a été envoyée sur une piste, même de test.)
3. Pour tester sans payer : **Paramètres → Test des licences** → ajoute ton adresse Gmail.

## 4. Codemagic / GitHub

- Mets à jour **`codemagic.yaml` sur GitHub** avec celui du zip (nouvelle étape « Widgets iPhone » et variable `SANS_WIDGETS_IOS`).
- Envoie `montee-app.zip` comme d'habitude.

## 5. Site (Netlify)

- Redéploie `montee-netlify.zip` : la **politique de confidentialité** mentionne maintenant Apple Santé, les widgets et les achats intégrés.

## 6. Ce qu'il faut tester sur iPhone (TestFlight)

1. Écran d'accueil → appui long → **+** → « Montée » : 6 widgets (Montée petit/moyen/grand, Raquette, Points à défendre, Objectif, Ta semaine, Prochain adversaire) + écran verrouillé (rond, rectangle, en ligne).
2. Après avoir posé un widget, **ouvre Montée une fois** : c'est l'app qui dessine les widgets.
3. Touche un widget : Montée s'ouvre sur le bon écran.
4. Menu + → **Soutenir Montée** → achat en **sandbox** (TestFlight ne débite rien) → thèmes débloqués dans Réglages, habillages dans Ta carte du mois.
5. **Restaurer mes achats** après réinstallation.
