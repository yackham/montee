import json,sys
from collections import defaultdict
R=json.load(open(sys.argv[1]+'/res.json')); kind=sys.argv[2] if len(sys.argv)>2 else 'txt'
EX=('pal-c','ws3','bd-m','cr3-row','cr3-c')
bad=[x for x in R if x['k']==kind and x['r']<x['need'] and not any(e in x['path'] for e in EX)]
g=defaultdict(list)
for x in bad:
    key=' > '.join(x['path'].split(' > ')[-2:])
    g[key].append(x)
for k,v in sorted(g.items(),key=lambda kv:-len(kv[1])):
    ths=sorted(set(x['t'] for x in v)); mn=min(v,key=lambda x:x['r'])
    print(f"{len(v):3d} {k[:95]}\n     thèmes={','.join(ths)} min={mn['r']} ({mn['t']}/{mn['page']}) fg={mn['fg']} bg={mn['bg']} «{mn['txt'][:40]}»")
