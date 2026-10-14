// D060 authored industrial review city: every one of the twelve kind-3 archetypes as a 2x2 block and as a 1x1 block.
// Production decode/restyle stays enabled; the plan is the production drawPlan (mode c), so the proof is on real blocks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {mk} from './d034-cities.mjs';
import {ROOT} from './cdp.mjs';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {loadCode,viewCode} from '../src/io/save.ts';
import {gridOf,drawPlan} from '../src/content/blocks.ts';
import {recipe} from '../src/content/recipes.ts';
import {industryBlock} from '../src/content/britishIndustry.ts';

export const D060_BASELINE='0bef78f76daa1edbbc7b2b8f80d49f0a13dc7f63';
export const D060_VIEWPORTS=[{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}];
// [model, level, archetype index (= v mod 4 in lab-arche.json)], in lab-arche.json row order.
export const D060_MODELS=[
 ['goodsShed',1,0],['loftWorkshop',1,1],['northLight',1,2],['timberYard',1,3],
 ['brickFactory',2,0],['cottonMill',2,1],['dockWarehouse',2,2],['boilerHouse',2,3],
 ['engineWorks',3,0],['steamMill',3,1],['gasworks',3,2],['bottleKilns',3,3],
];
// Placements found by search: production restyle (pickV406: position hash, urban density, land value) rewrites every
// building's variant on load, so a site is only valid if the production plan really returns its model at that origin.
// 2x2 blocks on the left, 1x1 blocks on the right, one short road along each block's south edge.
export const D060_SITES=[
 {id:'goodsShed-2x2',model:'goodsShed',lv:1,v:0,w:2,h:2,x:8,z:14},
 {id:'goodsShed-1x1',model:'goodsShed',lv:1,v:0,w:1,h:1,x:41,z:14},
 {id:'loftWorkshop-2x2',model:'loftWorkshop',lv:1,v:1,w:2,h:2,x:15,z:14},
 {id:'loftWorkshop-1x1',model:'loftWorkshop',lv:1,v:1,w:1,h:1,x:48,z:14},
 {id:'northLight-2x2',model:'northLight',lv:1,v:2,w:2,h:2,x:26,z:14},
 {id:'northLight-1x1',model:'northLight',lv:1,v:2,w:1,h:1,x:54,z:14},
 {id:'timberYard-2x2',model:'timberYard',lv:1,v:3,w:2,h:2,x:29,z:14},
 {id:'timberYard-1x1',model:'timberYard',lv:1,v:3,w:1,h:1,x:64,z:15},
 {id:'brickFactory-2x2',model:'brickFactory',lv:2,v:0,w:2,h:2,x:8,z:25},
 {id:'brickFactory-1x1',model:'brickFactory',lv:2,v:0,w:1,h:1,x:40,z:23},
 {id:'cottonMill-2x2',model:'cottonMill',lv:2,v:1,w:2,h:2,x:17,z:23},
 {id:'cottonMill-1x1',model:'cottonMill',lv:2,v:1,w:1,h:1,x:49,z:23},
 {id:'dockWarehouse-2x2',model:'dockWarehouse',lv:2,v:2,w:2,h:2,x:22,z:24},
 {id:'dockWarehouse-1x1',model:'dockWarehouse',lv:2,v:2,w:1,h:1,x:54,z:24},
 {id:'boilerHouse-2x2',model:'boilerHouse',lv:2,v:3,w:2,h:2,x:33,z:23},
 {id:'boilerHouse-1x1',model:'boilerHouse',lv:2,v:3,w:1,h:1,x:62,z:24},
 {id:'engineWorks-2x2',model:'engineWorks',lv:3,v:0,w:2,h:2,x:9,z:32},
 {id:'engineWorks-1x1',model:'engineWorks',lv:3,v:0,w:1,h:1,x:40,z:32},
 {id:'steamMill-2x2',model:'steamMill',lv:3,v:1,w:2,h:2,x:16,z:32},
 {id:'steamMill-1x1',model:'steamMill',lv:3,v:1,w:1,h:1,x:47,z:32},
 {id:'gasworks-2x2',model:'gasworks',lv:3,v:2,w:2,h:2,x:24,z:32},
 {id:'gasworks-1x1',model:'gasworks',lv:3,v:2,w:1,h:1,x:56,z:32},
 {id:'bottleKilns-2x2',model:'bottleKilns',lv:3,v:3,w:2,h:2,x:29,z:32},
 {id:'bottleKilns-1x1',model:'bottleKilns',lv:3,v:3,w:1,h:1,x:63,z:32},
];
export const D060_CAMERA={x:36,z:24,zoom:1.0};
export function d060ReviewCode(){
 return mk(5162060,150,'D060 British industry · authored exterior review',b=>{
  for(const s of D060_SITES)b.road(s.x-1,s.z+s.h,s.x+s.w,s.z+s.h);
  for(const s of D060_SITES)for(let dz=0;dz<s.h;dz++)b.row(s.x,s.x+s.w-1,s.z+dz,3,s.lv,{v:s.v});
 },{money:50000,rk:12,df:1});
}
let context;
export function d060Context(){return context??={
 kinds:kindTableFrom(JSON.parse(fs.readFileSync(path.join(ROOT,'src/content/lab-kinds.json'),'utf8'))),
 vrank:JSON.parse(fs.readFileSync(path.join(ROOT,'src/content/samples/d009-live.json'),'utf8')).vrank,
 arche:JSON.parse(fs.readFileSync(path.join(ROOT,'src/content/lab-arche.json'),'utf8')).arche,
};}
// plan rows are production [x,z,w,h,k,lv,v,...]; every authored site must come back as exactly its own block and model.
export function d060Selectors(plan){
 const {arche}=d060Context();
 return D060_SITES.map(s=>{
  const p=plan.find(p=>p[0]===s.x&&p[1]===s.z);
  assert.ok(p,'production block exists: '+s.id);
  const [x,z,w,h,k,lv,v]=p,r=recipe(arche,k,lv,w,h,v);
  assert.equal(w,s.w,s.id+' real merged width');assert.equal(h,s.h,s.id+' real merged depth');
  assert.equal(industryBlock(r),s.model,'production restyle keeps '+s.id);
  return {id:s.id,x,z,w,h,k,lv,v,arche:r.arche,path:r.path,model:industryBlock(r)};
 });
}
export function d060FixtureProof(code=d060ReviewCode()){
 const {kinds,vrank,arche}=d060Context(),loaded=loadCode(code,kinds,vrank),viewed=viewCode(code,kinds,vrank);
 assert.ok(loaded.ok);assert.ok(viewed.ok);
 const plans=Object.fromEntries(['b','c'].map(mode=>{
  const plan=drawPlan(gridOf(loaded.sim.city),arche,mode);
  const got=d060Selectors(plan.map(b=>[b.x,b.z,b.w,b.h,b.k,b.lv,b.v]));
  assert.deepEqual(drawPlan(gridOf(viewed.city),arche,mode),plan,'production playable/view decode choose identical blocks');
  return [mode,got];
 }));
 return {qualification:'Human-authored fixed-seed city, not a naturally played city; production loadCode/viewCode and restyle are active.',seed:5162060,day:150,restyled:loaded.restyled,viewRestyled:viewed.restyled,selectors:plans};
}
