# Mettre Montée sur le Google Play Store, pas à pas

Les textes et réponses à copier sont dans `playstore/FICHE-PLAY-STORE.md`. Les images sont dans `playstore/`.

## Ce qu'il faut savoir avant de commencer

- **Le test fermé est obligatoire.** Pour un compte personnel récent, Google exige **12 testeurs inscrits pendant 14 jours d'affilée** avant d'autoriser la publication pour tout le monde. Compte large (15 à 20 personnes), car un testeur qui se désinscrit avant 14 jours ne compte plus.
- **Les testeurs ont besoin d'un compte Google** (une adresse Gmail ou l'adresse de leur compte Google) et d'un téléphone Android.
- **L'APK de test et la version Play Store ne sont pas signés pareil.** Ceux qui ont installé l'APK par WhatsApp doivent **désinstaller Montée** avant d'installer la version Play Store. Ils devront refaire « Connecter mon compte Ten'Up » : le palmarès revient tout seul.
- **Vérification du téléphone.** Google peut demander de prouver que tu as accès à un vrai téléphone Android, via l'app Google Play Console. Si on te le demande, emprunte celui d'Antoine ou de Nico le temps de la vérification.

## 1. Fabrique le fichier pour le Play Store (.aab)

Le Play Store ne prend pas les APK : il veut un fichier `.aab`.

1. Sur GitHub, envoie le nouveau `montee-app.zip` et le nouveau `codemagic.yaml` (supprime l'ancien zip).
2. Dans Codemagic, lance **Montée Android → Play Store (fichier .aab)**.
3. Télécharge **Montee.aab** dans les Artifacts du build.

> Chaque build Codemagic a un numéro de version plus grand que le précédent : Google refuse deux envois avec le même numéro.

## 2. Crée l'app dans la Play Console

1. **play.google.com/console** › **Créer une appli**.
2. Nom : `Montée – Classement tennis` · Langue par défaut : **Français (France)** · **Appli** · **Gratuite**.
3. Coche les deux déclarations (règles du programme, lois d'exportation) › **Créer l'appli**.

## 3. Remplis « Contenu de l'appli »

Menu de gauche › **Règles et programmes › Contenu de l'appli** (ou suis la liste « Configurer votre appli » du tableau de bord). Pour chaque section, copie les réponses de la fiche :

1. Règles de confidentialité
2. Accès à l'appli
3. Annonces
4. Classification du contenu
5. Public cible et contenu
6. Sécurité des données
7. Identifiant publicitaire
8. Applis gouvernementales, financières, santé, actualités : Non

## 4. Remplis la fiche du Play Store

**Croissance › Présence sur le Play Store › Fiche principale** :
- nom, description courte, description complète (dans la fiche) ;
- icône `icone-512.png`, image de présentation `feature-graphic-1024x500.png` ;
- captures « Téléphone » : les 6 images de `captures/`.

**Paramètres de la fiche** : catégorie **Sports**, adresse e-mail de contact, site web.

## 5. Lance le test fermé

1. **Tester et publier › Tests › Test fermé** › le canal **Alpha** (ou **Créer un canal** : `Testeurs Montée`).
2. Onglet **Testeurs** › **Créer une liste d'adresses e-mail** › nom `Les potes du tennis` › colle les adresses Gmail, une par ligne › **Enregistrer**. Coche la liste.
3. Copie le **lien d'inscription** affiché en bas de l'onglet Testeurs.
4. **Pays/régions** : ajoute la **France** (et la Belgique ou la Suisse si tu as des testeurs là-bas).
5. **Créer une release** › Google te propose la **signature d'applications Play** : accepte (Google garde la clé de l'app, la clé du projet sert seulement à envoyer les mises à jour).
6. Glisse **Montee.aab** › nom de release : `2.5.4` › notes de version (dans la fiche) › **Suivant** › **Enregistrer et publier**.
7. Google vérifie la version : quelques heures à quelques jours la première fois.

## 6. Invite tes testeurs

Envoie-leur ce message avec le lien d'inscription :

```
Salut ! Je lance Montée sur le Play Store et Google me demande 12 testeurs pendant 14 jours. Tu peux m'aider ?
1. Si tu as installé l'APK que je t'ai envoyé : désinstalle-le d'abord.
2. Ouvre ce lien avec le compte Google de ton téléphone : [LIEN D'INSCRIPTION]
3. Touche « Devenir testeur », puis « Télécharger sur Google Play ».
4. Garde l'app installée au moins 14 jours, et ouvre-la de temps en temps.
Merci !
```

## 7. Après 14 jours : demande l'accès à la production

1. **Tableau de bord** › **Demander l'accès à la production**.
2. Réponds aux trois parties. Ce qui aide : explique que tes testeurs sont des joueurs de ton club, qu'ils ont importé leur palmarès, saisi des matchs et des raquettes, et ce que tu as corrigé grâce à leurs retours.
3. Google répond en général sous 7 jours.

## 8. Publie pour tout le monde

**Tester et publier › Production** › **Créer une release** › reprends le dernier `.aab` (ou un nouveau) › **Envoyer pour examen**. Une fois validée, Montée est sur le Play Store.

## Mises à jour

Je te donne un nouveau `montee-app.zip` › tu l'envoies sur GitHub › build **Montée Android → Play Store** › tu envoies le nouveau `Montee.aab` dans le test fermé ou en production.

## Santé connectée (Health Connect) : à faire une fois, à partir de la 3.15

Montée lit les séances de tennis dans Health Connect. Google contrôle les applis qui demandent des autorisations Health Connect : sans cette déclaration, la version qui contient la santé connectée peut être bloquée à l'envoi, ou l'autorisation peut rester grisée chez tes testeurs.

1. Play Console → ton appli → **Règles et programmes → Contenu de l'appli** → **Autorisations Health Connect** (parfois sous « Applis de santé »).
2. Coche les deux autorisations demandées :
   - **Lire : Exercice** (`android.permission.health.READ_EXERCISE`)
   - **Lire les données de santé en arrière-plan** (`android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND`)
3. Justification, à coller :
   > Montée est un carnet de tennis. L'appli lit uniquement les séances d'exercice de type « tennis » (date, heure, durée, appareil d'origine) pour proposer au joueur de les ajouter à ses entraînements. Elle calcule ainsi son temps de jeu et l'usure du cordage de sa raquette. Les séances des jours de match sont ignorées pour éviter les doublons. Rien n'est ajouté sans validation du joueur.
4. Justification de la lecture en arrière-plan :
   > Si le joueur l'active, Montée vérifie environ toutes les heures s'il y a une nouvelle séance de tennis, pour lui envoyer une notification « Nouvelle séance de tennis » qu'il peut ajouter à ses entraînements. Aucune autre utilisation.
5. Utilisation des données : **pas de transfert**, **pas de publicité**, **pas de vente**, données traitées **uniquement sur l'appareil**. Lien vers la politique de confidentialité : la page `confidentialite.html` (section « Santé connectée »).
6. **Sécurité des données** : rien ne change. Les données ne quittent pas le téléphone, donc elles ne sont pas « collectées » au sens de Google. Si le formulaire te demande quand même la catégorie, choisis « Santé et remise en forme → Informations de remise en forme », traitées sur l'appareil seulement, non partagées.

La validation prend en général quelques jours. En attendant, la santé connectée peut ne pas fonctionner chez les testeurs. Le reste de l'appli marche normalement.

Côté téléphone : Health Connect est intégré à Android 14 et plus. Sur Android 13 et moins, l'option indique simplement qu'elle n'est pas disponible. La notification quand Montée est fermée demande Android 15 et l'autorisation « lecture en arrière-plan ». Sur Android 14, la nouvelle séance s'affiche sur l'accueil à l'ouverture de Montée.

## Si Google refuse

Envoie-moi son message tel quel. Les points sensibles possibles : l'utilisation du nom Ten'Up et de la FFT (la description précise bien que Montée est indépendante), et l'accès à l'appli (le mode exemple montre tout sans compte).
