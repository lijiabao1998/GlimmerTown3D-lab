// Authored exterior review city. Production decode/restyle stays enabled.
// Origins were selected with loadCode + drawPlan; incoming v alone does not prove a selector.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {mk} from './d034-cities.mjs';
import {ROOT} from './cdp.mjs';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {loadCode,viewCode} from '../src/io/save.ts';
import {gridOf,drawPlan} from '../src/content/blocks.ts';
import {recipe} from '../src/content/recipes.ts';
import {villageBlock,villageKind} from '../src/content/britishVillage.ts';

export const D059_BASELINE='e8c0a9d0cad300e421fb3d3b7dc373b9493097c3';
export const D059_VIEWPORTS=[{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}];
export const D059_SITES=[
 {id:'cottage',x:20,z:23,k:1,lv:1,v:4,w:4,h:1},
 {id:'rows',x:33,z:22,k:2,lv:1,v:4,w:4,h:2},
 {id:'inn',x:21,z:32,k:2,lv:2,v:1,w:4,h:3},
 {id:'manor',x:34,z:32,k:1,lv:2,v:1,w:4,h:2},
 {id:'church',x:27,z:27,k:16,lv:1,v:0,w:1,h:1,tool:'cemetery'},
 {id:'oast',x:39,z:27,k:22,lv:1,v:0,w:2,h:2,tool:'farm'},
];
export const D059_BONUS=[
 {id:'church-large',model:'church',x:27,z:40,k:66,lv:1,v:0,w:2,h:2,access:'existing/imported-save kind'},
 {id:'oast-large',model:'oast',x:39,z:40,k:100,lv:1,v:0,w:2,h:2,access:'existing/imported-save kind'},
];
export const D059_CAMERA={x:30.8,z:32.3,zoom:1.65};
export function d059ReviewCode(){
 return mk(5162059,150,'D059 British village · authored exterior review',b=>{
  for(const s of D059_SITES.filter(s=>s.k<=3)){
   b.road(s.x-1,s.z+s.h,s.x+s.w,s.z+s.h);
   for(let dz=0;dz<s.h;dz++)b.row(s.x,s.x+s.w-1,s.z+dz,s.k,s.lv,{v:s.v});
  }
  for(const s of [...D059_SITES.filter(s=>s.k>3),...D059_BONUS])b.put(s.x,s.z,s.k,s.lv,{v:s.v});
  b.road(18,24,43,24).road(18,35,43,35).road(18,43,43,43);
  b.road(18,24,18,43).road(31,24,31,43).road(43,24,43,43);
  b.road(26,28,28,28).road(38,29,41,29).road(26,42,29,42).road(38,42,41,42);
 },{money:50000,rk:12,df:1});
}
let context;
export function d059Context(){return context??={
 kinds:kindTableFrom(JSON.parse(fs.readFileSync(path.join(ROOT,'src/content/lab-kinds.json'),'utf8'))),
 vrank:JSON.parse(fs.readFileSync(path.join(ROOT,'src/content/samples/d009-live.json'),'utf8')).vrank,
 arche:JSON.parse(fs.readFileSync(path.join(ROOT,'src/content/lab-arche.json'),'utf8')).arche,
};}
export function d059Selectors(plan,list){
 const {arche}=d059Context();
 return D059_SITES.map(s=>{
  if(s.k<=3){
   const p=plan.find(p=>p[0]===s.x&&p[1]===s.z);
   assert.ok(p,'production block exists: '+s.id);
   const [x,z,w,h,k,lv,v]=p,r=recipe(arche,k,lv,w,h,v);
   assert.equal(w,s.w,s.id+' real merged width');assert.equal(h,s.h,s.id+' real merged depth');
   assert.equal(villageBlock(r),s.id,'production restyle retains '+s.id);
   return {id:s.id,x,z,w,h,k,lv,v,arche:r.arche,path:r.path,model:villageBlock(r)};
  }
  const b=list.find(b=>b[1]===s.k&&b[2]===s.x&&b[3]===s.z);
  assert.ok(b,'production building exists: '+s.id);assert.equal(b[4],s.w);
  assert.equal(villageKind(b[1]),s.id);return {id:s.id,k:s.k,x:s.x,z:s.z,w:s.w,h:s.h,owner:b[0],model:villageKind(b[1]),tool:s.tool};
 });
}
export function d059FixtureProof(code=d059ReviewCode()){
 const {kinds,vrank,arche}=d059Context(),loaded=loadCode(code,kinds,vrank),viewed=viewCode(code,kinds,vrank);
 assert.ok(loaded.ok);assert.ok(viewed.ok);
 const plans=Object.fromEntries(['b','c'].map(mode=>{
  const plan=drawPlan(gridOf(loaded.sim.city),arche,mode),list=loaded.sim.city.buildings.map(b=>[b.id,b.k,b.x,b.z,b.size,b.lv,b.v]);
  const got=d059Selectors(plan.map(b=>[b.x,b.z,b.w,b.h,b.k,b.lv,b.v]),list);
  const viewPlan=drawPlan(gridOf(viewed.city),arche,mode);
  assert.deepEqual(viewPlan,plan,'production playable/view decode choose identical blocks');
  return [mode,got];
 }));
 return {qualification:'Human-authored fixed-seed city, not a naturally played city; production loadCode/viewCode and restyle are active.',seed:5162059,day:150,restyled:loaded.restyled,viewRestyled:viewed.restyled,selectors:plans,bonus:D059_BONUS};
}
