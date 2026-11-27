# Contrôle des contrastes dans les 12 thèmes

À lancer avant chaque PR qui ajoute ou change un écran (règle de Yann, 27/11/2026).

    npm run contrastes

- Ouvre 51 écrans et feuilles dans les 11 thèmes réels (Auto = Lin le jour, Nuit le soir), Montée+ simulé en natif (pas de thème forcé à la main).
- Mesure au pixel chaque texte (WCAG AA : 4,5:1, 3:1 pour le gros texte), les icônes, les champs, et chaque trait ou séparateur (au moins 1,15:1 sur sa surface).
- Échoue s'il reste un texte sous le seuil, avec la liste (thème, écran, ratio, élément).
- Nouvel écran : l'ajouter à la liste `R` de `cap.js`.
- Corriger à la source : variables du thème (`--n-ok`, `--n-ko`, `--n-info`, `--field`…), jamais une couleur en dur dans une règle `[data-theme="nuit"]`.

Détail d'un groupe d'erreurs : `python3 grp.py <dossier>`.
