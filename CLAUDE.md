# Montée : règles de travail

App tennis pour compétiteurs (Capacitor iOS + Android, montre Apple en Swift). Le code web est dans `web/` (`app.js`, `styles.css`, `tenup.js`, `engine.js`, `summary.js`). Yann pilote produit et design ; il ne lit pas le code.

## Modèle et effort
- Haiku : recherches ponctuelles, inventaires, vérifications simples (sous-agent seulement si ça coûte moins que de le faire soi-même).
- Sonnet (par défaut pour le développement) : bugs courants, anomalies visuelles, fonctionnalités, refactoring localisé, tests, accessibilité, corrections depuis captures.
- Opus : architecture, bugs profonds ou persistants, audits UX/UI transversaux, flux complexes, réflexion produit globale. Jamais juste parce que la demande est longue.
- Planification puis implémentation : mode `opusplan` quand l'outil le permet. Effort faible ou moyen par défaut, élevé si la complexité le justifie.
- Sous-agent : le modèle le moins cher qui fait le travail. Ne jamais prétendre avoir changé de modèle ; si Yann doit le faire, lui donner le réglage. Pas de changements de modèle à répétition.

## Méthode
- Avant d'agir : objectif, périmètre, critère de réussite ; vérifier l'existant et les conventions ; choisir l'approche la plus simple ; séparer faits vérifiés, hypothèses et recommandations.
- Petite correction : directement. Changement transversal : diagnostic + plan court d'abord.
- Économie : lire seulement les fichiers et fonctions concernés (`app.js` fait plus de 2 Mo : grep puis `sed -n`, jamais en entier), pas de relecture de fichier inchangé, sorties de commandes courtes, pas de sous-agents multiples sans gain clair, pas de tests déjà concluants relancés sans raison. Proposer une nouvelle session pour un chantier indépendant. Ne jamais économiser sur les tests essentiels, la sécurité ou la fiabilité.
- Développeur senior : cause réelle avant symptôme, réutiliser composants et conventions, modifications ciblées, pas de nouvelle dépendance sans raison, états chargement / erreur / vide, tests adaptés, rien de validé sans vérification. Après un échec, analyser avant de réessayer.
- Données de production et configurations sensibles (stores, Codemagic, clés) : jamais sans accord.

## Autonomie
- Seul : décisions techniques courantes, corrections localisées, améliorations cohérentes avec les règles.
- Avec l'accord de Yann : architecture, refonte de parcours, logique métier importante, tout ce qui peut altérer les données. Toute nouveauté d'interface passe par une maquette sur le vrai écran avant d'être codée.

## Design (décisions actées)
- Classement d'un joueur : petite balle jaune devant (`.rk-tag`, `rkTagOf()`) quand le contexte s'y prête. Une même info = une seule représentation.
- Cartes blanches / neutres : pas de gros aplats de couleur (vert, jaune-vert, kaki), pas de liseré coloré sur le côté ; couleur en accent seulement (texte, pastille à fond doux teinté de sa couleur, jamais de contour : décision du 26/11).
- Feuilles de détail qui réutilisent une liste : lignes à plat séparées d'un trait fin, sans carte autour.
- À garder : les 3 anneaux de l'accueil, « Ce qui arrive », carte Sortie, « Points à défendre », cartes paliers de l'Activité.
- Tout chiffre affiché a une définition ou un détail touchable. Noms d'exemple génériques (jamais de vrais joueurs ou testeurs). Thèmes sans marques de tournois.
- Moderne, sportif, chaleureux, lisible ; contraste vérifié dans les 8 thèmes ; pas de refonte pour moderniser.
- Avant de créer une classe CSS, vérifier qu'elle n'existe pas déjà dans `styles.css` (collisions déjà vues : `.an-r`, `.tq-ed`).

## Métier
- Faits (perfs, plus belle victoire) : classement de l'adversaire au jour du match. Saison = 12 mois glissants. Poule individuelle : victoire 2, défaite 1, pas joué 0.

## Communication
Pour chaque chantier : problème et cause, solution retenue, modifications, vérifications, limites. Court, sans détail technique superflu.
