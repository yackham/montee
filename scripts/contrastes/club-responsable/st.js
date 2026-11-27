const fs=require('fs');const iso=d=>new Date(Date.now()+d*864e5).toISOString().slice(0,10);
module.exports=function(){
const st=JSON.parse(fs.readFileSync('/mnt/project-files/maquettes/fac-seance-coach/state2.json','utf8'));st.demo=false;
st.tenup=Object.assign(st.tenup||{},{linked:true});st.prefs=Object.assign({},st.prefs,{epTab:'eq',theme:'nuit'});
const mk=(id,nom,div,poule,mine,names,res)=>{const teams=names.map((n,i)=>({id:i+1,nom:n,cl:i+1,pts:12-2*i,j:4,v:4-Math.min(i,4),n:0,d:Math.min(i,4),mg:20-3*i,mp:4+3*i,pen:0}));
 const renc=res.map((r,k)=>({id:id*100+k,d:iso(r[0]),dt:iso(r[0]),a:r[1],b:r[2],an:names[r[1]-1],bn:names[r[2]-1],dom:r[1],w:r[3]?(r[3]>r[4]?r[1]:r[2]):null,s1:r[3],s2:r[4],c1:r[3],c2:r[4],st:r[0]<=0?'T':''}));
 return {id:String(id),cid:String(id),nom:nom,cloture:false,div:div,phase:'Phase 1',poule:poule,path:{d:1,p:1,q:1},pts:{v:3,n:2,d:1},ns:4,nd:1,cal:[-27,-20,-13,-6,1,8,15].map((d,j)=>({j:j+1,d:iso(d)})),me:{mine:mine,club:[mine],days:[iso(-6),iso(-13)],sure:true},teams:teams,renc:renc,last:iso(-6)};};
st.teams={at:Date.now(),qv:7,club:{nom:'TC Exemple'},pid:'1',champs:[
 mk(301,'CHAMPIONNAT SENIORS MESSIEURS 2027','Division 2','Poule B',1,['TC EXEMPLE 2','AS VALLON 1','TC DES PRES 1','RC BORDS 2','US PLAINE 1','TC COLLINE 3'],[[-6,1,2,3,2],[-13,4,1,1,4],[1,1,5,0,0]]),
 mk(302,'SENIORS +35 MESSIEURS 2027','Division 1','Poule A',2,['TC VERGER 1','TC EXEMPLE 1','AS RIVIERE 1','ES MONTS 1'],[[-6,2,3,4,0],[-13,1,2,2,2],[8,4,2,0,0]])]};
return st;};
