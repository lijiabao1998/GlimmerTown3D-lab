// Intentional small-sample review gate. Does not replace or weaken final D082 acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './cdp.mjs';
import {MODELS,COASTAL_RECREATION_KINDS} from '../src/content/britishCoastalRecreation.ts';
import {Pen} from '../src/render/kindArt.ts';
import {drawBritishCoastalRecreation} from '../src/render/britishCoastalRecreationArt.ts';
import {TARGETS,REJECTED,LEGACY,KT,QUALIFICATION,VIEWPORTS,VIEWS,drawCase,caseSignature,caseBytes,assertCase,createOracle,cityOf,ownerContent,plannedCamera,assertBudget,references,sha} from './d082-redesign-support.mjs';
const report={qualification:QUALIFICATION,complete:false,geometryCases:0,unchangedSlots:[],scenePairs:[],referenceModels:references(),negativeControls:0};
assert.deepEqual(MODELS.map(({k,v,H,size,cap})=>({k,v,H,size,cap})),TARGETS);assert.deepEqual([...COASTAL_RECREATION_KINDS],[179]);
report.targets=TARGETS.map(t=>{
 assert.deepEqual([KT.height(t.k,1,t.v),KT.size(t.k)],[t.H,t.size]);const old=drawCase(t.k,{v:t.v,on:false}),pin=LEGACY.slots[t.k+':'+t.v];assert.equal(caseSignature(old),pin.sha256);assert.equal(caseBytes(old),pin.float64Sha256);assert.equal(old.cost,t.cap);
 for(const lv of [1,2,3])for(const s of [1,4])for(const H of [.12,t.H,t.H*1.7])for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}]){const options={v:t.v,lv,s,H,...origin},r=drawCase(t.k,options);assertCase(r);assert.equal(caseBytes(r),caseBytes(drawCase(t.k,options)));assert.notEqual(caseBytes(r),caseBytes(drawCase(t.k,{...options,on:false})));report.geometryCases++;}
 const r=drawCase(t.k,{v:t.v});for(const mutate of [r=>r.G[0].pos[0]=NaN,r=>r.G[0].owners[0]=0,r=>r.G[0].nor[0]=42,r=>r.G[0].pos[0]=r.x0-1,r=>r.cost=183]){const bad=structuredClone(r);mutate(bad);assert.throws(()=>assertCase(bad));report.negativeControls++;}return{...t,...assertCase(r)};
});
for(const[k,v]of REJECTED){const on=drawCase(k,{v}),off=drawCase(k,{v,on:false}),pin=LEGACY.slots[k+':'+v];assert.equal(caseSignature(on),pin.sha256);assert.equal(caseBytes(on),pin.float64Sha256);assert.equal(caseBytes(on),caseBytes(off));report.unchangedSlots.push({k,v,weighted:on.cost,sha256:caseBytes(on)});}
// Strict dispatch: unsupported or coerced values produce no geometry and mutate nothing.
for(const k of [126,179,185,154,999,'179'])for(const v of [null,undefined,-1,0,1,2,3,'0','1',NaN,Infinity]){const r=drawCase(179,{on:false}),a={W:r.G[0],O:r.G[1],D:r.G[2],trees:r.trees,x0:0,z0:0,y0:0,s:1,H:1,k,v,C:{}};for(const g of r.G){for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags'])g[key].length=0;}if(k===179&&(v===0||v===1))continue;const before=sha(a);assert.equal(drawBritishCoastalRecreation(new Pen(a)),false);assert.equal(sha(a),before);}
for(const sample of ['gallery','ai120','seed516']){
 const native=createOracle(sample,false,null),nativeOwners=ownerContent(native.built),nativeCity=cityOf(sample);
 try{for(const force of [null,0,1,2]){
  const old=createOracle(sample,false,force),now=createOracle(sample,true,force);
  try{now.assertBrowserGeometry(now.digest,now.groundEvidence);
   if(sample==='gallery'&&force===null){for(const mutate of [d=>d.inst.pop(),d=>d.inst[d.inst.length-1]='0:050c5d1f:-:-',d=>d.meshes.walls.attrs.normal='00000000',d=>delete d.queries.ownerBoxes,d=>d.ground='00000000']){const bad=structuredClone(now.digest);mutate(bad);assert.throws(()=>now.assertBrowserGeometry(bad,now.groundEvidence));report.negativeControls++;}assert.throws(()=>now.assertBrowserGeometry(now.digest,{...now.groundEvidence,rgb:'AAAA'}));report.negativeControls++;}
   const oldOwners=ownerContent(old.built),nowOwners=ownerContent(now.built),changedOwners=now.city.buildings.filter(b=>b.k===179&&[0,1].includes(b.v)).map(b=>String(b.id));
   assert.deepEqual(old.city,now.city);assert.deepEqual(old.city,{...nativeCity,buildings:nativeCity.buildings.map(b=>force!==null&&b.k===179&&[0,1].includes(force)?{...b,v:force}:b)},'copied preview modifies only the selected 179 render variant');
   for(let mi=0;mi<3;mi++){assert.deepEqual(Object.keys(oldOwners[mi]).filter(o=>!changedOwners.includes(o)).sort(),Object.keys(nowOwners[mi]).filter(o=>!changedOwners.includes(o)).sort());for(const owner of Object.keys(oldOwners[mi])){if(!changedOwners.includes(owner)){assert.equal(nowOwners[mi][owner],oldOwners[mi][owner],'candidate non-target owner stays exact');assert.equal(oldOwners[mi][owner],nativeOwners[mi][owner],'copied legacy non-target owner stays exact');}}}
   for(const key of ['ground','counts'])assert.deepEqual(now.digest[key],old.digest[key]);for(const key of Object.keys(old.digest.queries))if(!['ownerBoxes','kindColors'].includes(key))assert.equal(now.digest.queries[key],old.digest.queries[key],key+' query remains exact');assert.deepEqual(now.digest.inst,old.digest.inst);assert.equal(old.whole,LEGACY.cities.native[sample].c[0]);assert.ok(now.whole<=old.whole);
   const targets=now.city.buildings.filter(b=>changedOwners.includes(String(b.id))),shots=[{x:now.n/2,z:now.n/2,size:now.n,overview:true},...targets.map(b=>({owner:b.id,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size}))];let frames=0;
   for(const viewport of VIEWPORTS)for(const shot of shots)for(const view of shot.overview?[VIEWS[0]]:VIEWS){const plan=plannedCamera(now.n,{...shot,...(shot.overview?{zoom:Math.max(.6,.54*viewport.W/viewport.H)}:{})},viewport,view),a=old.measure(plan,viewport),b=now.measure(plan,viewport);assertBudget(b,a);assert.deepEqual(now.measure(plan,viewport),b);if(shot.owner){assert.ok(old.ownerBounds(shot.owner,plan,viewport).fits);assert.ok(now.ownerBounds(shot.owner,plan,viewport).fits);}frames++;}
   report.scenePairs.push({sample,force,before:old.whole,after:now.whole,changedOwners,frames,allOtherOwnersByteExact:true,worldUnchanged:true,legacyCopiedQualification:force===1&&sample==='gallery'?'Two-slot copy is checked by exact native D081 scene, immutable per-slot legacy bytes and preservation of every non-target owner; the former ten-slot-copy hash does not apply.':'Immutable D081 scene signature or equivalent native presentation.'});
  }finally{old.dispose();now.dispose();}
 }}finally{native.dispose();}
}
assert.equal(report.geometryCases,72);assert.equal(report.unchangedSlots.length,8);assert.equal(report.scenePairs.length,12);report.complete=true;fs.mkdirSync(path.join(ROOT,'scratch/d082-redesign'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d082-redesign/node-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
