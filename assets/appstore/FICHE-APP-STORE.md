# Fiche App Store — Montée

Textes prêts à copier dans App Store Connect (Distribution › ta version iOS).

## Informations de l'app

| Champ | Valeur |
|---|---|
| Nom (30 car. max) | Montée – Classement tennis |
| Sous-titre (30 car. max) | Ton classement avant la sortie |
| Identifiant de lot (Bundle ID) | fr.montennis.app |
| SKU | montee |
| Langue principale | Français |
| Catégorie principale | Sports |
| Catégorie secondaire | Utilitaires |
| Prix | Gratuit |
| URL d'assistance | https://montennis.netlify.app/confidentialite.html#contact |
| URL de confidentialité | https://montennis.netlify.app/confidentialite.html |
| URL marketing (facultatif) | https://montennis.netlify.app |
| Copyright | 2026 Yann Munier |

> Si le nom « Montée – Classement tennis » est déjà pris, essaie « Montée : classement tennis » ou « Montée Tennis ».

## Texte promotionnel (170 car. max, modifiable sans nouvelle version)

Tu montes ce mois-ci ? Montée recalcule ton bilan avant chaque sortie du classement et te dit exactement ce qu'il te manque.

## Description

Tu montes ce mois-ci ? Montée te le dit avant mardi.

Montée récupère ton palmarès depuis ton compte Ten'Up et recalcule ton bilan comme le fait le classement mensuel : 12 mois glissants, points de chaque victoire, victoires prises en compte, normes de chaque échelon.

CE QUE TU VOIS EN UN COUP D'ŒIL
• Si tu montes, te maintiens ou risques de descendre à la prochaine sortie
• Combien de points il te manque pour l'échelon d'au-dessus
• Contre quel classement une victoire suffit pour monter
• Les victoires qui vont sortir de tes 12 mois, et ce qu'elles te coûtent
• Ta simulation officielle, sans avoir à la relancer

TES MATCHS, AUTOMATIQUEMENT
Connecte ton compte une fois sur la page officielle : Montée vérifie tes nouveaux matchs et te prévient. Nouveau match détecté, points gagnés, montée ou pas : tu le sais tout de suite.

L'ANALYSE DE CHAQUE MATCH
Montée lit le palmarès de ton adversaire et te dit ce que valait vraiment ton match : sa série en cours, son vrai niveau, la lecture du score, et ce que ta victoire change pour ton classement.

PRÉPARE TON PROCHAIN ADVERSAIRE
Tape son nom : tes chances, son jeu, ton plan de jeu, vos statistiques face à face. Et tes notes sur lui, toujours sous la main.

LE CHEMIN LE PLUS COURT
Montée simule tes prochaines victoires avec le vrai calcul et te propose les pistes à ta portée : contre qui une victoire suffit, ou quelle combinaison de victoires te fait monter.

TES COURBES, AU TOUCHER
• L'évolution de ton bilan, mois par mois : touche un point pour voir le détail
• Les points à défendre aux prochaines sorties
• Ton plafond : contre quels classements tu gagnes et tu perds, match par match
• Ton mental : premiers sets, matchs en trois sets, tie-breaks
• Tes records, ton temps de jeu, où tu gagnes le plus

SIX THÈMES
Lin, Nuit, Terre battue, Dur, Gazon, ou Auto qui suit le mode sombre de ton iPhone.

TON MATÉRIEL
Tes séances de tennis enregistrées par ton Apple Watch arrivent depuis l'app Santé (si tu l'autorises) : Montée te propose de les ajouter à tes entraînements, sans doublon les jours de match. Note ta raquette, ton cordage et ta tension (y compris montants et travers différents), et tes entraînements. Montée estime tes heures de jeu sur chaque cordage, te prévient quand un monofilament approche des 20 h, et te montre avec quoi tu gagnes et comment tu te sens. Tu sais quand recorder.

TES DONNÉES RESTENT CHEZ TOI
Pas de compte Montée, pas de serveur, pas de pub, pas de pisteur. Ton mot de passe Ten'Up n'est jamais vu par Montée. Tout reste sur ton téléphone.

Montée est une application indépendante. Elle n'est ni éditée ni approuvée par la Fédération Française de Tennis. Les calculs sont indicatifs : seul le classement officiel fait foi.

## Mots-clés (100 car. max, séparés par des virgules, sans espace)

tennis,classement,palmarès,simulation,montée,bilan,tournoi,adversaire,match,15/1,cordage,raquette

## Nouveautés de cette version

Première version de Montée sur l'App Store : calcul du classement, analyse de chaque match, face-à-face avec ton prochain adversaire, objectif de saison, séances de tennis depuis Apple Santé, et six thèmes.

## Captures d'écran

Dossier `captures-app-store/` : 6 images 1320 × 2868 (format iPhone 6,9 pouces, le seul obligatoire ; Apple les réduit pour les autres iPhone), avec titre, dans l'ordre 1 à 6. Uniquement des noms d'exemple. Les écrans bruts sans titre sont dans `captures/`.

Pas de captures iPad : l'app est uniquement pour iPhone.

## Confidentialité (questionnaire « App Privacy »)

- Collectez-vous des données à partir de cette app ? **Non, nous ne collectons pas de données.**
  (Tout est stocké sur l'appareil ; rien n'est envoyé au développeur ni à un tiers. Les séances lues dans Apple Santé restent aussi sur l'appareil : selon Apple, des données traitées uniquement sur l'appareil ne sont pas « collectées ».)

## Classification par âge

Répondre « Aucun » partout → **4+**.

## Conformité export (chiffrement)

Déjà déclaré dans l'app (`ITSAppUsesNonExemptEncryption = NO`) : rien à faire.

## Notes pour l'équipe de vérification Apple (App Review Information)

À coller dans « Notes » :

> Montée helps French tennis players understand their FFT ranking (the monthly "classement" computed by the French Tennis Federation). Players can import their own match history from their personal Ten'Up account (tenup.fft.fr): the official Ten'Up login page is displayed in a web view, the user signs in there, and the app reads the user's own match list with that session, directly on the device. No credentials are seen or stored by the app, and no data leaves the device (no backend).
>
> To review without a Ten'Up account: on the first screen tap "C'est parti", then "Essayer avec un exemple" at the bottom of the next screen. This loads sample data and shows every feature (home projection, paths to the next ranking, interactive charts, equipment tracking, themes in the gear menu next to the ranking).
>
> HealthKit: with the user's permission (Settings › Santé connectée in the app), Montée reads workouts only (read-only, no write) to suggest adding tennis sessions to the user's training log, which tracks playing time and racket string wear. Tennis sessions on match days are skipped. Health data never leaves the device, is not used for advertising, and is not shared. Background delivery is used only to send a local notification "New tennis session" when a new tennis workout appears; the user can turn it off in the app.
>
> Montée is an independent app, not affiliated with or endorsed by the Fédération Française de Tennis. Notifications are local only.

Compte de démonstration : laisser vide (cocher « Connexion requise » : non).
