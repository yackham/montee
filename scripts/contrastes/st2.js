// État de démo du lot 2 : un tournoi en cours (2 tours gagnés), une poule d'indivs, les équipes (structure de club-responsable/st.js)
const fs=require('fs');const iso=d=>new Date(Date.now()+d*864e5).toISOString().slice(0,10);
module.exports=function(tab){
 const st=require('./club-responsable/st.js')();st.tenup.linked=false;st.prefs.epTab=tab||'toi';
 const ms=st.matches;const add=(id,opp,rank,d,res,score,tr)=>{ms.push({id,opp,oppRank:rank,date:iso(d),result:res,score,kind:'tournoi',source:'manual',tr});};
 add('mxa','L. Garnier','15/3',-9,'V','6-2 6-3','tt1');add('mxb','P. Rivière','15/2',-4,'V','4-6 6-3 7-5','tt1');
 add('mxc','A. Durand','15/2',-15,'V','6-4 6-4','tpool');add('mxd','B. Roche','15/1',-8,'D','6-7 4-6','tpool');
 st.tours=[{id:'tt1',name:'Open d\'automne du TC Exemple',kind:'tournoi',fmt:'tableau',from:iso(-10),to:iso(6),src:'manual',
   rounds:[{id:'r1',day:iso(-9),opp:{name:'L. Garnier',rank:'15/3'},res:'V',score:'6-2 6-3',mid:'mxa'},{id:'r2',day:iso(-4),opp:{name:'P. Rivière',rank:'15/2'},res:'V',score:'4-6 6-3 7-5',mid:'mxb'},{id:'r3',day:iso(2),time:'18:00',opp:{name:'M. Caron',rank:'15/1'}}]},
  {id:'tpool',name:'Indivs +35 ans 4e série',kind:'champ',fmt:'poule',from:iso(-20),to:iso(60),src:'manual',qual:1,
   pool:[{id:'p1',name:'A. Durand',rank:'15/2',day:iso(-15),res:'V',score:'6-4 6-4',mid:'mxc'},{id:'p2',name:'B. Roche',rank:'15/1',day:iso(-8),res:'D',score:'6-7 4-6',mid:'mxd'},{id:'p3',name:'C. Vidal',rank:'15/3',day:iso(9)}]}];
 // 4.28.0 : un match compté à la montre (point par point, avant-match vérifié), exemple simulé des tests
 const W=require('../../tests/point-par-point.fixture.json');
 ms.push({id:'mgl1',opp:'J. Moreau',oppRank:'15/1',date:iso(-3),result:'V',score:'6-3 4-6 10-7',kind:'tournoi',source:'manual',minutes:102,gl:{f:0,fmt:'stb',s:[{g:'101111001'},{g:'0110010010'},{g:'',tb:[10,7]}]}}); // 4.32.0 : match saisi au changement de côté
 ms.push({id:'mwx1',opp:'T. Mercier',oppRank:'15/2',date:iso(-2),result:'D',score:'4-6 6-4 1-6',kind:'tournoi',source:'manual',minutes:111,watch:true,wev:W.ev,wevT:W.evT,wsrv:0,wfmt:'full',
  serve:{me:{pts:88,firstIn:60,firstWon:28,secPts:28,secWon:12,df:6,aces1:3,aces2:1,games:14,held:5,bpFaced:14,bpSaved:5},him:{pts:81,firstIn:54,firstWon:28,secPts:27,secWon:16,df:2,aces1:2,aces2:1,games:13,held:7,bpFaced:8,bpSaved:2}},
  goalSnap:['court','rout','first'],tacSnap:[{id:'t-srv',t:'1re au corps',s:'Vise le corps.',theme:'service'},{id:'pb',t:'Plan B',s:'Change le rythme : slice bas et lent au centre.',theme:'planb'}],tacRes:{pb:1}});
 return st;};
