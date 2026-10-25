import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{createHash}from'node:crypto';
import{createCivicMarketDesign,MODEL_IDS}from'../../src/render/britishCivicMarketModels.mjs';
import{assertStructuralPlan}from'./structural-plan.mjs';
import{LEGAL_SURFACE_VIEWS,surfaceCamera}from'./surface-contract.mjs';
for(const id of MODEL_IDS)test(`D086 independent closed numerical wall/roof plan ${id}`,()=>{const r=assertStructuralPlan(createCivicMarketDesign(id),{negativeControls:true});assert.ok(r.solids>0&&r.negativeControls>0);assert.ok(r.maximumError<1e-10);});
for(const[title,mutate]of[
 ['hide a structural component by artist metadata',m=>{const p=m.parts.find(p=>p.solid);p.solid=false;for(let i=p.start;i<(m.parts[m.parts.indexOf(p)+1]?.start??m.triangles.length);i++)m.triangles[i].structural=false;}],
 ['rename expected architectural use',m=>{m.parts[0].name='unapproved-structural-substitute';}],
 ['orphan actual triangle outside complete part membership',m=>{m.triangles.push({...structuredClone(m.triangles[0]),structural:false});}],
 ['wrong model identity',m=>{m.id='not-a-declared-model';}],
 ['move actual component inward while preserving topology',m=>{const end=m.parts[1].start;for(let i=0;i<end;i++)m.triangles[i].p=m.triangles[i].p.map(([x,y,z])=>[x+.001,y,z]);}]
])test(`D086 structural oracle rejects ${title}`,()=>{const m=createCivicMarketDesign(MODEL_IDS[0]);mutate(m);assert.throws(()=>assertStructuralPlan(m));});
test('D086 does not alter original D081 classifier or widen legal inspection orbit',()=>{assert.equal(createHash('sha256').update(fs.readFileSync('tools/d081-frame.mjs')).digest('hex'),'2a6510fe84db1a233040df0dc2cda24ed1e1a40113518a41be506809cf2d73fb');assert.equal(LEGAL_SURFACE_VIEWS.length,48);for(const v of LEGAL_SURFACE_VIEWS){assert.ok(v.elevation>Math.PI*.08&&v.elevation<Math.PI*.32);const c=surfaceCamera({x:3,z:4,size:2},v),rayY=c.target[1]-c.pos[1];assert.ok(rayY<0);assert.ok(-rayY>0,'downward horizontal FrontSide is provably back-facing, never silently exempt');}assert.throws(()=>surfaceCamera({x:3,z:4,size:1},{elevation:-.01}));assert.throws(()=>surfaceCamera({x:3,z:4,size:1},{zoom:9}));});

import{minimumLegalRayDot}from'./legal-camera-impossibility.mjs';
test('D086 mathematical unreachable witness is exact, not a generic downward exemption',()=>{assert.ok(minimumLegalRayDot([0,-1,0])>0);assert.ok(minimumLegalRayDot([0,1,0])<0);assert.ok(minimumLegalRayDot([1,0,0])<0);assert.ok(minimumLegalRayDot([Math.SQRT1_2,-Math.SQRT1_2,0])<0,'slanted downward face may be visible and is never categorically exempted');assert.throws(()=>minimumLegalRayDot([0,-2,0]));});
