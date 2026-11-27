# Vérifie les contrastes mesurés par ana.py : sort en erreur si un texte passe sous WCAG AA.
# Usage : python3 verif.py <dossier>  (après runall.sh <dossier> et ana.py <dossier>)
import json,sys
from collections import Counter
# Exclus : textes dessinés dans les illustrations, animation du projecteur de l'accueil, chips hors écran,
# contrôles désactivés (.off) et l'avatar fantôme décoratif du miroir.
EX=('pal-c','ws3','bd-m','cr3-row','cr3-c','co-scn','tq-b','simu-lv','tg-n','av-me.ghost','.off','button.theme')
R=json.load(open(sys.argv[1]+'/res.json'))
bad=[x for x in R if x['k']=='txt' and x['r']<x['need'] and not any(e in x['path'] for e in EX)]
# Traits (bordures, séparateurs) : un trait posé doit se voir sur sa surface (au moins 1,15:1)
bad+=[x for x in R if x['k']=='line' and x['txt'] in ('t','b','l') and x['r']<1.15 and not any(e in x['path'] for e in EX)]
for x in sorted(bad,key=lambda x:x['r']): print(f"{x['t']:9} {x['page']:14} {x['r']:5} (min {x['need']})  {x['path'][-60:]}  «{x['txt'][:30]}»")
print(len(bad),'texte(s) ou trait(s) sous le seuil', dict(Counter(x['t'] for x in bad)))
sys.exit(1 if bad else 0)
