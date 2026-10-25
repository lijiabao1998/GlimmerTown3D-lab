// Finite SUPPORT-REPAIR PROPOSAL. The original103-solid plan stays immutable.
// Only four base elevations differ; no facade/roof/footprint/top/cap change is
// inferred. This module is not adopted until actual repaired source is tested.
import assert from'node:assert/strict';import{STRUCTURAL_PLAN,planFaces,proveComponentSurface,assertStructuralPlan}from'./structural-plan.mjs';
export const SUPPORT_BASE_DELTAS=Object.freeze([
 Object.freeze({id:'georgian-customs-house',part:'chimney',occurrence:0,before:.73,after:.64,roofMinimum:.6484210526315789,top:.94}),
 Object.freeze({id:'georgian-customs-house',part:'chimney',occurrence:1,before:.73,after:.64,roofMinimum:.6484210526315789,top:.94}),
 Object.freeze({id:'edwardian-board-school',part:'bellcote-left',occurrence:0,before:.68,after:.65,roofMinimum:.6566666666666667,top:.83}),
 Object.freeze({id:'edwardian-board-school',part:'bellcote-right',occurrence:0,before:.68,after:.65,roofMinimum:.6566666666666667,top:.83})
]);
function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
const next=structuredClone(STRUCTURAL_PLAN);
for(const d of SUPPORT_BASE_DELTAS){const part=next[d.id].solids.filter(s=>s.name===d.part)[d.occurrence];assert.equal(part.type,'box');assert.equal(part.a[4],d.before);assert.equal(part.a[5],d.top);assert.ok(d.after<d.roofMinimum&&d.before>d.roofMinimum);part.a[4]=d.after;}
export const STRUCTURAL_PLAN_V2=freeze(next);
export function assertStructuralPlanV2(model,{negativeControls=false}={}){
 if(!SUPPORT_BASE_DELTAS.some(d=>d.id===model.id))return assertStructuralPlan(model,{negativeControls});
 const plan=STRUCTURAL_PLAN_V2[model.id];assert.ok(plan);assert.equal(model.parts[0]?.start,0);for(let i=0;i<model.parts.length;i++){const p=model.parts[i],end=model.parts[i+1]?.start??model.triangles.length;assert.ok(Number.isInteger(p.start)&&end>p.start&&end<=model.triangles.length);assert.ok(model.triangles.slice(p.start,end).every(t=>t.part===p.name&&t.structural===p.solid),'complete current triangle membership');}
 const parts=model.parts.map((p,i)=>({...p,end:model.parts[i+1]?.start??model.triangles.length})).filter(p=>p.solid);assert.deepEqual(parts.map(p=>p.name),plan.solids.map(s=>s.name));let controls=0,triangles=0,maximumError=0;
 for(const[p,i]of parts.map((p,i)=>[p,i])){const actual=model.triangles.slice(p.start,p.end);assert.ok(actual.every(t=>t.structural&&t.part===p.name));const expected=planFaces(plan.solids[i],plan.height),ts=actual.map(t=>t.p),label=`support-v2:${model.id}:${i}:${p.name}`,r=proveComponentSurface(expected,ts,label);triangles+=ts.length;maximumError=Math.max(maximumError,r.maximumError);
  if(negativeControls){for(let j=0;j<ts.length;j++){assert.throws(()=>proveComponentSurface(expected,ts.filter((_,k)=>j!==k),label));assert.throws(()=>proveComponentSurface(expected,ts.map((t,k)=>j===k?[...t].reverse():t),label));controls+=2;}for(const mutation of [[...ts,ts[0]],ts.map(t=>t.map(([x,y,z])=>[x,y+.0001,z])),ts.map(t=>t.map(([x,y,z])=>[x*.98,y,z]))]){assert.throws(()=>proveComponentSurface(expected,mutation,label));controls++;}}
 }
 return{id:model.id,solids:parts.length,triangles,maximumError,negativeControls:controls,supportBaseDeltas:SUPPORT_BASE_DELTAS.filter(d=>d.id===model.id)};
}
