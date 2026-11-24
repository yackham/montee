/* 3.72 : La Balle, le coach de Montée (validée par Yann le 23/11/2026) : dessin SVG + pose(p) + 6 moments.
   Balle.make(taille) crée le dessin ; Balle.play(el, moment, ms) joue un moment une fois, puis la balle se pose.
   4.4 (Yann, « plus vivant ») : duvet, contour, reflets, joues ; Balle.live = respiration, clignements, regard ;
   Balle.play2 joue un moment par-dessus la vie ; moments parle, surpris, fier, rebond, dort, rire. Rien si mouvement réduit. */
(function(root){
const NS='http://www.w3.org/2000/svg';let uid=0;
function make(size){const id='bl'+(uid++);const w=document.createElement('div');w.style.width=size+'px';w.style.height=(size*1.1)+'px';
w.innerHTML=`<svg viewBox="0 0 200 220" width="100%" height="100%" overflow="visible" aria-hidden="true">
<defs>
 <radialGradient id="${id}g" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#F4FAB8"/><stop offset=".45" stop-color="#DCEC55"/><stop offset=".85" stop-color="#BFD23A"/><stop offset="1" stop-color="#A3B62A"/></radialGradient>
 <radialGradient id="${id}s" cx=".72" cy=".78" r=".6"><stop offset="0" stop-color="#5E7000" stop-opacity=".28"/><stop offset="1" stop-color="#5E7000" stop-opacity="0"/></radialGradient>
 <filter id="${id}f" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .38  0 0 0 0 0  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
 <clipPath id="${id}c"><circle cx="100" cy="120" r="80"/></clipPath>
 <filter id="${id}z" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="5"/></filter>
</defs>
<ellipse class="sh" cx="100" cy="206" rx="56" ry="7" fill="#000" opacity=".2"/>
<g class="dots" fill="currentColor"><circle cx="168" cy="44" r="5"/><circle cx="182" cy="26" r="6"/><circle cx="198" cy="6" r="7"/></g>
<g class="zz" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M150 46h14l-14 16h14"/><path d="M174 14h10l-10 12h10"/></g>
<path class="ex" d="M100 0 v16 M100 34 v1" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
<g class="sp" stroke="#D4E64A" stroke-width="5" stroke-linecap="round"><line/><line/><line/><line/><line/><line/></g>
<g class="body">
 <circle cx="100" cy="120" r="82.5" fill="#C9DB3E" filter="url(#${id}z)" opacity=".9"/>
 <circle cx="100" cy="120" r="80" fill="url(#${id}g)"/>
 <circle cx="100" cy="120" r="80" fill="#fff" filter="url(#${id}f)" opacity=".5"/>
 <circle cx="100" cy="120" r="80" fill="url(#${id}s)"/>
 <g clip-path="url(#${id}c)">
  <g class="face">
   <path class="sg" fill="none" stroke="#6F8410" stroke-opacity=".35" stroke-width="10" stroke-linecap="round"/>
   <path class="sm" fill="none" stroke="#FAFCEB" stroke-width="7" stroke-linecap="round"/>
   <g class="eo"><ellipse class="e1" cx="78" cy="105" rx="9.5" ry="13" fill="#141810"/><ellipse class="e2" cx="122" cy="105" rx="9.5" ry="13" fill="#141810"/>
    <circle class="h1" r="3.8" fill="#fff"/><circle class="h2" r="3.8" fill="#fff"/><circle class="k1" r="1.7" fill="#fff" opacity=".8"/><circle class="k2" r="1.7" fill="#fff" opacity=".8"/></g>
   <g class="ck" fill="#FF8FA3"><ellipse cx="60" cy="128" rx="11" ry="6.5"/><ellipse cx="140" cy="128" rx="11" ry="6.5"/></g>

   <path class="eh" d="M66 108 Q78 94 90 108 M110 108 Q122 94 134 108" fill="none" stroke="#141810" stroke-width="6.5" stroke-linecap="round"/>
   <path class="br" fill="none" stroke="#45540E" stroke-width="5.5" stroke-linecap="round"/>
  </g>
  <g class="band"><path d="M10 70 Q100 46 190 70 L190 88 Q100 64 10 88 Z" fill="#1F5C3F"/><path d="M10 79 Q100 55 190 79" stroke="#2E7A55" stroke-width="2" fill="none"/></g>
  <ellipse cx="72" cy="66" rx="26" ry="14" fill="#fff" opacity=".22" transform="rotate(-25 72 66)"/>
 </g>
 <circle cx="100" cy="120" r="80" fill="none" stroke="#7E9214" stroke-opacity=".55" stroke-width="3"/>
</g></svg>`;
const q=s=>w.querySelector(s);const el={sh:q('.sh'),dots:[...w.querySelectorAll('.dots circle')],sp:[...w.querySelectorAll('.sp line')],body:q('.body'),face:q('.face'),sg:q('.sg'),sm:q('.sm'),e1:q('.e1'),e2:q('.e2'),h1:q('.h1'),h2:q('.h2'),eo:q('.eo'),eh:q('.eh'),br:q('.br'),band:q('.band'),k1:q('.k1'),k2:q('.k2'),ck:q('.ck'),zz:q('.zz'),ex:q('.ex')};
w.pose=function(p){p=Object.assign({y:0,sx:1,sy:1,fx:0,fy:0,open:1,happy:0,lx:0,ly:0,brow:0,browA:0,smile:22,band:0,dots:0,spark:0,tilt:0,cheek:0,zz:0,ex:0,wide:0,spin:0},p);
 el.body.setAttribute('transform',`translate(100 ${200+p.y}) rotate(${p.tilt}) scale(${p.sx} ${p.sy}) translate(-100 -200) rotate(${p.spin} 100 120)`);
 const hgt=Math.max(0,-p.y);el.sh.setAttribute('rx',56*p.sx*Math.max(.45,1-hgt/160));el.sh.setAttribute('opacity',.2*Math.max(.3,1-hgt/140));
 el.face.setAttribute('transform',`translate(${p.fx} ${p.fy})`);
 const L=36,R=164,Y=136,d=Y+p.smile;
 const path=`M${L+14} 52 Q${L-16} ${Y-36} ${L} ${Y} Q100 ${d} ${R} ${Y} Q${R+16} ${Y-36} ${R-14} 52`;
 el.sm.setAttribute('d',path);el.sg.setAttribute('d',path);el.sg.setAttribute('transform','translate(0 2.5)');
 const ry=13*(1+.25*p.wide)*Math.max(.08,p.open);[el.e1,el.e2].forEach(e=>{e.setAttribute('ry',ry);e.setAttribute('cy',105+(13-ry)*.6)});
 el.h1.setAttribute('cx',81+p.lx);el.h1.setAttribute('cy',100+p.ly);el.h2.setAttribute('cx',125+p.lx);el.h2.setAttribute('cy',100+p.ly);
 [el.e1,el.e2].forEach((e,i)=>{e.setAttribute('cx',(i?122:78)+p.lx*.6)});
 el.h1.setAttribute('opacity',p.open>.5?1:0);el.h2.setAttribute('opacity',p.open>.5?1:0);
 el.k1.setAttribute('cx',75+p.lx);el.k1.setAttribute('cy',110+p.ly);el.k2.setAttribute('cx',119+p.lx);el.k2.setAttribute('cy',110+p.ly);el.k1.setAttribute('opacity',p.open>.5?.8:0);el.k2.setAttribute('opacity',p.open>.5?.8:0);
 [el.e1,el.e2].forEach(e=>e.setAttribute('rx',9.5*(1+.15*p.wide)));
 el.ck.setAttribute('opacity',.55*Math.max(p.cheek,p.happy));el.zz.setAttribute('opacity',p.zz);el.zz.setAttribute('transform',`translate(0 ${(1-p.zz)*10})`);el.ex.setAttribute('opacity',p.ex);el.ex.setAttribute('transform',`translate(0 ${p.y}) scale(1 ${.6+.4*p.ex})`);
 el.eo.setAttribute('opacity',1-p.happy);el.eh.setAttribute('opacity',p.happy);
 const b=p.brow; // >0 concentré (intérieur bas), <0 triste (intérieur haut)
 el.br.setAttribute('d',`M64 ${84-0} L90 ${84+b*7} M136 84 L110 ${84+b*7}`);el.br.setAttribute('opacity',p.browA);
 el.band.setAttribute('transform',`translate(0 ${(1-p.band)*-110})`);
 el.dots.forEach((c,i)=>c.setAttribute('opacity',Math.max(0,Math.min(1,p.dots-i))));
 el.sp.forEach((l,i)=>{const a=(-160+i*28)*Math.PI/180,r1=92+p.spark*8,r2=r1+p.spark*20;l.setAttribute('x1',100+Math.cos(a)*r1);l.setAttribute('y1',120+p.y+Math.sin(a)*r1);l.setAttribute('x2',100+Math.cos(a)*r2);l.setAttribute('y2',120+p.y+Math.sin(a)*r2);l.setAttribute('opacity',p.spark>0.02?Math.min(1,p.spark*1.4):0)});
};
w.pose({});return w;}
/* Les 6 moments : renvoient la pose à l'instant u ∈ [0,1] */
const cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),seg=(u,a,b)=>cl((u-a)/(b-a)),eo=t=>1-Math.pow(1-t,3),eio=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,bump=t=>Math.sin(Math.PI*cl(t));
const blink=(u,at,w=.06)=>{const k=Math.abs(u-at)/w;return k<1?k:1};
const M={
 arrivee(u){ // tombe, deux rebonds, ouvre les yeux
  let y=0,sx=1,sy=1;const f=seg(u,0,.28);
  if(u<.28){y=-190*(1-f*f);sy=1+.08*f;sx=1-.05*f}
  else if(u<.36){const t=bump(seg(u,.28,.36));sy=1-.22*t;sx=1+.16*t}
  else if(u<.56){const t=seg(u,.36,.56);y=-60*4*t*(1-t);sy=1+.04*bump(t);sx=1-.03*bump(t)}
  else if(u<.62){const t=bump(seg(u,.56,.62));sy=1-.1*t;sx=1+.07*t}
  const op=u<.66?.08:eo(seg(u,.66,.78));return {y,sx,sy,open:op,smile:22*eo(seg(u,.7,.9))}},
 repos(u){const br=Math.sin(u*Math.PI*4)*.012;const g=u<.3?0:u<.5?eio(seg(u,.3,.42))*-5:u<.75?-5+eio(seg(u,.5,.62))*10:5-eio(seg(u,.75,.87))*5;
  return {sy:1+br,sx:1-br*.6,open:Math.min(blink(u,.2),blink(u,.9)),lx:g,fx:g*.5}},
 joie(u){let y=0,sx=1,sy=1,happy=eo(seg(u,.05,.2));
  if(u<.18){const t=eo(seg(u,0,.18));sy=1-.14*t;sx=1+.1*t}
  else if(u<.52){const t=seg(u,.18,.52);y=-120*4*t*(1-t);sy=1+.14*(1-t)*bump(t*2);sx=1-.09*(1-t)*bump(t*2)}
  else if(u<.6){const t=bump(seg(u,.52,.6));sy=1-.18*t;sx=1+.13*t}
  else if(u<.78){const t=seg(u,.6,.78);y=-30*4*t*(1-t)}
  else if(u<.84){const t=bump(seg(u,.78,.84));sy=1-.06*t;sx=1+.04*t}
  return {y,sx,sy,happy:u>.9?1-eo(seg(u,.92,1))*0:happy,smile:22+14*happy,spark:u>.3&&u<.9?bump(seg(u,.3,.9)):0,tilt:Math.sin(u*Math.PI*3)*3*(1-u)}},
 decue(u){const down=eio(seg(u,.05,.35))*(1-eio(seg(u,.7,.95)));
  return {sy:1-.07*down,sx:1+.05*down,fy:9*down,open:1-.45*down,ly:4*down,brow:-1,browA:down,smile:22-17*down,tilt:-3*down+Math.sin(seg(u,.72,.95)*Math.PI)*2}},
 reflexion(u){const t=eio(seg(u,.08,.3))*(1-eio(seg(u,.8,.98)));
  return {fx:16*t,fy:-8*t,lx:5*t,ly:-6*t,tilt:6*t,dots:t>.9?cl((u-.3)/.12)*3:(u>.8?3*t:0),open:blink(u,.55)}},
 concentree(u){const b=eo(seg(u,.05,.4));const lean=eio(seg(u,.45,.6))*(1-eio(seg(u,.85,1))*.5);const nod=u>.62&&u<.82?Math.sin(seg(u,.62,.82)*Math.PI)*1:0;
  return {band:b,brow:1,browA:eo(seg(u,.35,.5)),fy:3*lean+5*nod,sy:1-.03*lean,sx:1+.02*lean,tilt:0,smile:22-8*eo(seg(u,.35,.5)),open:Math.min(1-.15*eo(seg(u,.35,.5)),blink(u,.9))}},
 parle(u){const t=u*12;const o=Math.abs(Math.sin(t*Math.PI));return {smile:22+10*o,sy:1+.02*o,sx:1-.012*o,y:-2*o,open:blink(u,.62,.04),lx:2,cheek:.2}},
 surpris(u){const t=eo(seg(u,0,.18));let y=0,sy=1,sx=1;if(u<.35){const k=seg(u,0,.35);y=-40*4*k*(1-k)}else if(u<.42){const k=bump(seg(u,.35,.42));sy=1-.12*k;sx=1+.08*k}
  return {y,sx,sy,wide:t*(1-eo(seg(u,.75,1))*.6),ex:t*(1-eo(seg(u,.7,.95))),smile:22-6*t,ly:-3*t,open:1}},
 fier(u){const r=eio(seg(u,.15,.6));let y=0,sx=1,sy=1;if(u<.12){const k=eo(seg(u,0,.12));sy=1-.16*k;sx=1+.12*k}else if(u<.6){const k=seg(u,.12,.6);y=-150*4*k*(1-k)}else if(u<.68){const k=bump(seg(u,.6,.68));sy=1-.2*k;sx=1+.14*k}
  return {y,sx,sy,spin:360*r,happy:eo(seg(u,.55,.7)),smile:36,spark:u>.55?bump(seg(u,.55,1)):0,cheek:1}},
 rebond(u){const d=eio(seg(u,0,.3))*(1-eio(seg(u,.35,.55)));let y=0,sx=1+.06*d,sy=1-.1*d;if(u>.55&&u<.85){const k=seg(u,.55,.85);y=-70*4*k*(1-k)}
  return {y,sx,sy,fy:8*d,open:1-.4*d,brow:u<.45?-1:0,browA:d,smile:22-14*d+(u>.55?10*eo(seg(u,.55,.8)):0),cheek:u>.7?.6:0}},
 dort(u){const br=Math.sin(u*Math.PI*2)*.03;return {sy:1+br,sx:1-br*.6,open:.08,fy:4,smile:16,zz:.5+.5*Math.sin(u*Math.PI*2),tilt:-4}},
 rire(u){const w=Math.sin(u*Math.PI*8)*(1-u);return {happy:1,smile:38,tilt:w*7,sy:1-.06*Math.abs(w),sx:1+.04*Math.abs(w),cheek:1,y:-6*Math.abs(w)}},
};
// Joue un moment une fois (requestAnimationFrame), puis garde la dernière pose ; mouvement réduit : pose finale directe
function play(w,m,ms){const f=M[m]||M.repos;const red=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const end=m==='arrivee'||m==='joie'?1:m==='repos'?0:.55;if(red){w.pose(f(end));return}
 const t0=performance.now(),D=ms||1600;(function step(now){const u=Math.min(1,(now-t0)/D);w.pose(f(m==='repos'||m==='arrivee'||m==='joie'?u:u*end/1));if(u<1&&w.isConnected)requestAnimationFrame(step)})(t0)}
function live(w,base){if(w._live)return;w._live=1;const red=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;if(red)return;
 let nb=performance.now()+1500+Math.random()*2500,bl=-1,gx=0,gt=0,ng=performance.now()+3000;w._base=base||{};
 const t0=performance.now();(function st(now){if(!w.isConnected&&(w._seen||now-t0>4000))return;w._seen=w.isConnected||w._seen;if(w._busy){requestAnimationFrame(st);return}
  const br=Math.sin(now/650)*.014;let open=1;if(now>nb){bl=now;nb=now+2600+Math.random()*3600}const k=(now-bl)/140;if(k>=0&&k<2)open=Math.abs(1-k)<.08?.08:Math.abs(1-k);
  if(now>ng){gt=[-5,0,5,3,-3][Math.floor(Math.random()*5)];ng=now+2500+Math.random()*3500}gx+=(gt-gx)*.08;
  w.pose(Object.assign({},w._base,{sy:1+br,sx:1-br*.6,y:-Math.max(0,br)*60,open:Math.min(open,w._base.open==null?1:w._base.open),lx:gx,fx:gx*.4}));requestAnimationFrame(st)})(performance.now());}
function play2(w,m,ms,after){w._busy=1;const f=M[m]||M.repos;const D=ms||1600,t0=performance.now();(function step(now){const u=Math.min(1,(now-t0)/D);w.pose(f(u));if(u<1)requestAnimationFrame(step);else{w._busy=0;w._base=after||{};}})(t0)}
root.Balle={make,M,play,live,play2};
})(window);
