# python3 ana.py <dossier> : contrastes texte / icônes / surfaces -> <dossier>/res.json
import json,os,sys,numpy as np
from PIL import Image
D=sys.argv[1]
TH=[t for t in ['lin','nuit','terre','dur','gazon','indoor','moquette','nocturne','retro','vert','crep'] if os.path.exists(f'{D}/{t}/items.json')]
def lin(c):
    c=c/255.0; return np.where(c<=0.03928,c/12.92,((c+0.055)/1.055)**2.4)
def L(rgb): r=lin(np.asarray(rgb,float)); return 0.2126*r[...,0]+0.7152*r[...,1]+0.0722*r[...,2]
def ratio(la,lb): hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
def crop(im,x,y,w,h,pad=0):
    H,W,_=im.shape; x0,y0=max(0,int(x-pad)),max(0,int(y-pad)); x1,y1=min(W,int(x+w+pad)),min(H,int(y+h+pad))
    if x1-x0<2 or y1-y0<2: return None
    return im[y0:y1,x0:x1].reshape(-1,3)
def med(px):
    l=L(px); return px[np.argsort(l)[len(l)//2]]
res=[]
for t in TH:
    A=json.load(open(f'{D}/{t}/items.json'))
    for name,v in A.items():
        im=np.asarray(Image.open(f'{D}/{t}/{name}.bg.png').convert('RGB')).astype(float); H,W,_=im.shape
        for it in v['texts']:
            if it.get('dis'): continue
            px=[c for c in (crop(im,*r) for r in it['rects']) if c is not None]
            if not px: continue
            px=np.concatenate(px); bg=med(px)
            c=np.array(it['col'][:3],float); a=it['col'][3]*it['op']; fg=a*c+(1-a)*bg
            r=ratio(L(fg),L(bg)); large=it['fs']>=24 or (it['fs']>=18.66 and it['fw']>=700)
            res.append(dict(k='txt',t=t,page=name,txt=it['txt'],path=it['path'],fs=it['fs'],fw=it['fw'],r=round(float(r),2),need=3 if large else 4.5,fg=[int(x) for x in fg],bg=[int(x) for x in bg],box=it['rects'][0]))
        for it in v['icons']:
            px=crop(im,*it['rect'])
            if px is None: continue
            bg=med(px); c=np.array(it['col'][:3],float); a=it['col'][3]*it['op']; fg=a*c+(1-a)*bg
            r=ratio(L(fg),L(bg))
            res.append(dict(k='ico',t=t,page=name,txt='',path=it['path'],r=round(float(r),2),need=3 if it['act'] else 0,fg=[int(x) for x in fg],bg=[int(x) for x in bg],box=it['rect']))
        for it in v['surf']:
            x,y,w,h=it['rect']
            if y>H-4: continue
            ins=crop(im,x+4,y+4,w-8,h-8)
            # anneau extérieur : 4 bandes de 4 px à 3 px du bord
            ring=[crop(im,x,y-8,w,4),crop(im,x,y+h+4,w,4),crop(im,x-8,y,4,h),crop(im,x+w+4,y,4,h)]
            ring=[c for c in ring if c is not None]
            if ins is None or not ring: continue
            bi=med(ins); bo=med(np.concatenate(ring))
            r=ratio(L(bi),L(bo))
            bc=it['bc']; bord=it['bw']>=1 and bc and bc[3]>0.3 and ratio(L(np.array(bc[:3])),L(bo))>=1.5
            res.append(dict(k='fld' if it['field'] else 'btn',t=t,page=name,txt=it['txt'],path=it['path'],r=round(float(r),3),need=0,fg=[int(x) for x in bi],bg=[int(x) for x in bo],box=it['rect'],bord=bool(bord)))
json.dump(res,open(f'{D}/res.json','w'))
txt=[x for x in res if x['k']=='txt']; bad=[x for x in txt if x['r']<x['need']]
print(len(txt),'textes,',len(bad),'sous AA')
from collections import Counter
print('par thème',Counter(x['t'] for x in bad))
print('< 3:1',Counter(x['t'] for x in bad if x['r']<3))
