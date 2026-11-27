// Usage: node cap.js <theme> <outdir> [filtre]
const L=require('./lib.js'); const fs=require('fs');
const th=process.argv[2], OUT=process.argv[3], F=process.argv[4];
const st=require('./st2.js')('toi'); st.aceSeen=1; st.arrSeen=1; delete st.seenNotes; st.prefs.theme=th;
const R=[['accueil',''],['menu','@menu'],['activite','palmares'],['courbes','courbes'],['joueurs','faf'],['ma-montee','projection'],['ace','coach'],
['match-v','match/mwp1txgfaa4g8'],['match-d','match/mwp1txgfzo8yz'],['saisie-match','match/new'],['saisie-entr','entrainement/new'],['joueur','joueur/demo1'],['adversaire','adversaire/J. Lefèvre'],
['tournoi','tournoi/tt1'],['poule','tournoi/tpool'],['equipe','equipe/301'],['badges','badges'],['saison','saison'],['semaine','semaine'],
['objectif','objectif'],['service','service'],['victoires','victoires'],['gagner','gagner'],['niveau','niveau'],['competiteur','competiteur'],
['tournois','tournois'],['moi','moi'],['entrainement','entrainement/mwp1txgfzdynz'],['double','double'],['materiel','materiel'],['sante','sante'],['zones','zones'],
['methode','methode'],['reglages','reglages'],['notifs','notifs'],['apropos','apropos'],['profil','profil'],['donnees','donnees'],['tenup','tenup'],['montees','montees'],['simu','simu'],['carte','carte'],['soutenir','soutenir'],['dispos','dispos'],['f-forme','@sel|#/|button.cr3-c'],['f-niveau','@sel|#/|.cr3-c.hot, .cr3-row .cr3-c:last-child'],['f-corriger','@sel|#/tournoi/tt1|.tq-edl'],['f-poule','@sel|#/tournoi/tpool|.pl-ub'],['f-ace-tag','@sel|#/coach|.co-tags span'],['f-match','@sel|#/palmares|.card a, a.row']];
const FREEZE='*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important} .tabbar,.mm-pill{position:static!important} .toast,.sb-fade{display:none!important}';
const NOTXT='*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important} svg *{fill:transparent!important;stroke:transparent!important} svg text,svg tspan{fill:transparent!important} input::placeholder,textarea::placeholder{color:transparent!important} img{opacity:0!important}';
(async()=>{ fs.mkdirSync(OUT,{recursive:true}); const {b,p}=await L.open({plus:true,state:st}); const all={};
 for(const [n,r] of R){ if(F&&!n.includes(F))continue; p.errs.length=0;
  if(r.startsWith('@sel|')){ const [,u,sel]=r.split('|'); await L.go(p,u,1300); await p.evaluate(sel=>{const x=document.querySelector(sel); x&&x.click();},sel); await p.waitForTimeout(900);} else if(r==='@menu'){ await L.go(p,'#/',1300); await p.evaluate(()=>{const x=document.querySelector('.tabbar .plus'); x&&x.click();}); await p.waitForTimeout(700);} else await L.go(p,'#/'+r,1300);
  await p.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));
  await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}scrollTo(0,0);});
  const s1=await p.addStyleTag({content:FREEZE}); await p.waitForTimeout(150);
  if(!r.startsWith('@')){ const hh=await p.evaluate(()=>document.documentElement.scrollHeight); await p.setViewportSize({width:390,height:Math.min(hh,16000)}); await p.waitForTimeout(200);}
  const data=await p.evaluate(()=>{
   const rgba=c=>{const m=c&&c.match(/rgba?\(([^)]+)\)/); if(!m) return null; const v=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [v[0],v[1],v[2],v.length>3?v[3]:1];};
   const path=e=>{const a=[];let x=e;for(let i=0;i<4&&x&&x.nodeType===1;i++){a.unshift(x.tagName.toLowerCase()+(x.className&&typeof x.className==='string'?'.'+x.className.trim().split(/\s+/).slice(0,3).join('.'):''));x=x.parentElement;}return a.join(' > ');};
   const opa=e=>{let op=1,x=e;while(x&&x.nodeType===1){op*=parseFloat(getComputedStyle(x).opacity);x=x.parentElement;}return op;};
   const vis=e=>{const cs=getComputedStyle(e);return cs.visibility==='visible'&&cs.display!=='none';};
   const texts=[]; const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); const seen=new Map(); let n;
   while(n=tw.nextNode()){ const t=n.nodeValue.trim(); if(!t||!/[\p{L}\p{N}]/u.test(t)) continue; const e=n.parentElement; if(!e||!vis(e)) continue; const cs=getComputedStyle(e);
    const rg=document.createRange(); rg.selectNodeContents(n); const rects=[...rg.getClientRects()].filter(q=>q.width>2&&q.height>4); if(!rects.length) continue;
    const op=opa(e); if(op<0.05) continue; const q0=rects[0]; const hit=document.elementFromPoint(q0.left+q0.width/2,q0.top+q0.height/2); if(hit&&!(hit===e||e.contains(hit)||hit.contains(e))) continue; const col=rgba(e instanceof SVGElement?cs.fill:cs.color); if(!col) continue;
    let o=seen.get(e); if(!o){o={txt:'',rects:[],col,op,fs:parseFloat(cs.fontSize),fw:parseInt(cs.fontWeight),path:path(e),dis:!!e.closest('[disabled],[aria-disabled="true"]')};seen.set(e,o);texts.push(o);}
    o.txt+=(o.txt?' ':'')+t; rects.forEach(q=>o.rects.push([q.left+scrollX,q.top+scrollY,q.width,q.height]));}
   texts.forEach(o=>o.txt=o.txt.slice(0,70));
   // icônes : svg sans texte, couleur du trait/remplissage
   const icons=[]; document.querySelectorAll('svg').forEach(s=>{ if(!vis(s)) return; const r=s.getBoundingClientRect(); if(r.width<8||r.width>64||r.height<8) return;
     const sh=s.querySelector('path,circle,rect,line,polyline,polygon,ellipse'); if(!sh) return; const cs=getComputedStyle(sh);
     let c=cs.stroke&&cs.stroke!=='none'?cs.stroke:cs.fill; const col=rgba(c); if(!col||col[3]===0) return; const op=opa(sh); if(op<0.05) return;
     const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); if(hit&&!(s.contains(hit)||hit.contains(s))) return; const host=s.closest('button,a,[data-a]'); icons.push({col,op,rect:[r.left+scrollX,r.top+scrollY,r.width,r.height],path:path(s.parentElement),act:!!host}); });
   // surfaces interactives : champs, boutons, tuiles
   const surf=[]; document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea,button,a.btn,.mb,.chip,[role=button],.seg button,.tile,[class*="tile"],.mb-i,.ml-i').forEach(e=>{
     if(!vis(e)) return; const r=e.getBoundingClientRect(); if(r.width<24||r.height<20) return; const cs=getComputedStyle(e); const bg=rgba(cs.backgroundColor);
     const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); if(hit&&!(e.contains(hit)||hit.contains(e))) return; const bw=parseFloat(cs.borderTopWidth)||0; const bc=rgba(cs.borderTopColor); const op=opa(e); if(op<0.05) return;
     surf.push({tag:e.tagName.toLowerCase(),bg,bw,bc,img:cs.backgroundImage!=='none',sh:cs.boxShadow,rect:[r.left+scrollX,r.top+scrollY,r.width,r.height],path:path(e),txt:(e.innerText||e.placeholder||e.value||'').trim().slice(0,40),field:/^(input|select|textarea)$/i.test(e.tagName)}); });
   return {texts,icons,surf};});
  await p.screenshot({path:`${OUT}/${n}.png`});
  const s2=await p.addStyleTag({content:NOTXT}); await p.waitForTimeout(120);
  await p.screenshot({path:`${OUT}/${n}.bg.png`});
  await s2.evaluate(e=>e.remove()); await s1.evaluate(e=>e.remove());
  const th2=await p.evaluate(()=>[document.documentElement.getAttribute('data-theme'),document.documentElement.getAttribute('data-skin')]);
  await p.setViewportSize({width:390,height:844});
  all[n]={route:r,...data,errs:[...p.errs],th:th2};
 }
 fs.writeFileSync(`${OUT}/items.json`,JSON.stringify(all)); await b.close(); console.log(th,'ok');})();
