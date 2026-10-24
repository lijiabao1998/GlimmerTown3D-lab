// Honest checkpoint continuity, not a substitute for independent geometry or visibility proof.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {MODELS} from '../src/content/britishCoastalRecreation.ts';
const sha=b=>createHash('sha256').update(b).digest('hex');
const ORIGINAL_SHA='cdb72ffe7c6798490f11830455c237053ff20aaf6ce639397771ecdb98dfd92f';
const REPAIR_SHA='681ca81a3ad584acdb9e0993c0031a705417d251dae37ad7d777ed8d63eaf8f8';
function assertRepair(before,current){
 assert.equal(current.length,before.length,'same ten structures');let points=0;
 for(let i=0;i<before.length;i++){
  const original=before[i],actual=current[i],key=original.k+':'+original.v;
  const expected=structuredClone(original);
  if(['179:0','185:0','185:2'].includes(key)){
   for(let ci=0;ci<expected.components.length;ci++){
    const transform=([x,y,z])=>{
     if(ci===0){const [a,b,c]=key==='179:0'?[.17,.83,.59]:key==='185:0'?[.18,.81,.58]:[.19,.81,.59];return [x,y,a+(z-a)*(c-a)/(b-a)];}
     if(key==='179:0')return [.68+(x-.65)*(.88-.68)/(.87-.65),y,.70+(z-.45)*(.90-.70)/(.77-.45)];
     if(key==='185:0')return [x+.01,y,.73+(z-.39)*(.90-.73)/(.73-.39)];
     return [x+.01,y,.73+(z-.36)*(.90-.73)/(.74-.36)];
    };
    const component=expected.components[ci];component.ground=component.ground.map(transform);for(const face of component.faces)face.points=face.points.map(transform);
   }
  }
  // Numeric tolerance only accommodates arithmetic ordering, not alternative geometry.
  const compare=(a,b,p)=>{if(typeof a==='number'){assert.ok(Number.isFinite(b)&&Math.abs(a-b)<1e-12,p+' exact approved affine repair');points++;return;}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(b),Object.keys(a),p+' unchanged schema');for(const k of Object.keys(a))compare(a[k],b[k],p+'.'+k);return;}assert.equal(b,a,p+' metadata unchanged');};
  compare(expected,actual,key);
 }
 return points;
}
export function d082ArchitectureContractGuards(){
 const originalBytes=fs.readFileSync(new URL('../docs/D082-integration-architecture.json',import.meta.url)),repairBytes=fs.readFileSync(new URL('../docs/D082-visibility-repair-architecture.json',import.meta.url));
 assert.equal(sha(originalBytes),ORIGINAL_SHA,'original pre-integration checkpoint is immutable');assert.equal(sha(repairBytes),REPAIR_SHA,'separate honest post-repair checkpoint is immutable');
 const original=JSON.parse(originalBytes),repair=JSON.parse(repairBytes);
 assert.equal(repair.originalCheckpoint.sha256,ORIGINAL_SHA);assert.deepEqual(repair.changedSlots,['179:0','185:0','185:2']);assert.deepEqual(MODELS,repair.models,'actual source matches separately recorded repair checkpoint');
 const comparedNumericFields=assertRepair(original.models,MODELS);
 let negativeControls=0;
 for(const mutate of [m=>m[0].components[0].faces[0].points[0][0]+=.001,m=>m[3].H+=.001,m=>m[3].components[0].faces[0].points[0][2]+=.001,m=>m[6].components[1].faces[0].points[0][1]+=.001,m=>m[8].components[1].ground[0][2]+=.001,m=>m[3].components[1].faces.pop()]){const bad=structuredClone(MODELS);mutate(bad);assert.throws(()=>assertRepair(original.models,bad));negativeControls++;}
 return {passed:true,originalCheckpointSha256:ORIGINAL_SHA,repairCheckpointSha256:REPAIR_SHA,changedSlots:repair.changedSlots,comparedNumericFields,negativeControls,qualification:'Source/checkpoint continuity only. Does not establish visibility, appearance, or screenshot acceptance.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(d082ArchitectureContractGuards(),null,2));
