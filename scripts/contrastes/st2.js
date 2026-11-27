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
 return st;};
