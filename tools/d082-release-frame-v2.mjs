// Accepted-nine release contract v2. The historical ten-model frame pins remain immutable.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {TARGETS,ADDITIONAL,isTarget,createOracle,drawCase,cityOf,ownerContent,assertConstructionEnvelope,VIEWPORTS,VIEWS,pairedCamera,assertBudget} from './d082-redesign-support.mjs';

export function assertReleaseWhole(before,after,expectedDelta){
 assert.equal(after.whole,before.whole+expectedDelta,'whole-scene change equals independent emitted target-cost ledger exactly');
 assert.ok(after.whole<=before.whole,'original published whole-scene budget is not increased');
}
export function d082ReleaseFrameV2(){
 const rows=[];let negativeControls=0,frames=0;
 for(const sample of ['gallery','seed516','ai120'])for(const force of [null,0,1,2]){
  const before=createOracle(sample,false,force),after=createOracle(sample,true,force);
  try{
   const preview=force===null?'native':'v'+force;
   assert.equal(before.whole,ADDITIONAL.cities[preview][sample].modes.c.weighted,'immutable D081 nine-slot baseline');
   assert.deepEqual(after.city,before.city,'both phases render exactly the same copied world');
   const native=cityOf(sample),targets=after.city.buildings.filter(b=>isTarget(b.k,b.v)),ids=new Set(targets.map(b=>String(b.id)));
   assert.deepEqual(after.city,{...native,buildings:native.buildings.map(b=>force!==null&&isTarget(b.k,force)?{...b,v:force}:b)},'only nine supported saved variants participate in forced scenes');
   assert.ok(after.city.buildings.filter(b=>b.k===126).every(b=>b.v===native.buildings.find(n=>n.id===b.id).v),'excluded 126 variants remain native');
   const oldOwners=ownerContent(before.built),newOwners=ownerContent(after.built);
   for(let i=0;i<oldOwners.length;i++)for(const owner of new Set([...Object.keys(oldOwners[i]),...Object.keys(newOwners[i])]))if(!ids.has(owner))assert.equal(newOwners[i][owner],oldOwners[i][owner],'every non-target owner retains exact typed geometry');
   let delta=0;const ledger=[];
   for(const b of targets){const t=TARGETS.find(t=>t.k===b.k&&t.v===b.v),r=drawCase(b.k,{v:b.v,lv:b.lv,s:b.size,H:t.H});assert.ok(r.cost<=t.cap);delta+=r.cost-t.cap;ledger.push({owner:b.id,slot:`${b.k}:${b.v}`,published:t.cap,candidate:r.cost});}
   assertReleaseWhole(before,after,delta);
   assert.throws(()=>assertReleaseWhole(before,{whole:after.whole+2},delta));negativeControls++;
   assert.throws(()=>assertReleaseWhole(before,after,delta+2));negativeControls++;
   for(const key of ['ground','counts','inst'])assert.deepEqual(after.digest[key],before.digest[key],'full '+key+' unchanged');
   const construction=assertConstructionEnvelope(before,after,targets);
   const shots=[{x:after.n/2,z:after.n/2,size:after.n,overview:true},...targets.map(b=>({owner:b.id,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size}))];
   for(const viewport of VIEWPORTS)for(const shot of shots)for(const view of shot.overview?[VIEWS[0]]:VIEWS){
    const plan=pairedCamera(before,after,{...shot,...(shot.overview?{zoom:Math.max(.6,.54*viewport.W/viewport.H)}:{})},viewport,view);
    const old=before.measure(plan,viewport),now=after.measure(plan,viewport);assertBudget(now,old);assert.deepEqual(after.measure(plan,viewport),now);frames++;
   }
   after.assertBrowserGeometry(after.digest,after.groundEvidence);
   for(const mutate of [d=>d.inst.pop(),d=>d.meshes.walls.attrs.position='bad',d=>d.ground='bad']){const bad=structuredClone(after.digest);mutate(bad);assert.throws(()=>after.assertBrowserGeometry(bad,after.groundEvidence));negativeControls++;}
   rows.push({sample,force,before:before.whole,after:after.whole,delta,ledger,construction});
  }finally{before.dispose();after.dispose();}
 }
 assert.equal(rows.length,12);
 return {schema:2,passed:true,qualification:'Node accounting and full-scene contract only; browser pixel coverage and actual CI still required.',frames,negativeControls,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(d082ReleaseFrameV2(),null,2));
