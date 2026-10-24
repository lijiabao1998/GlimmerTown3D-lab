import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {deflateSync,crc32} from 'node:zlib';
import {sha} from './d082-redesign-support.mjs';
import {STANDARD_VIEW_IDS,SUPPLEMENTARY_VIEWS,assertCapturedSurfaceViews} from './d082-redesign-views.mjs';
import {LEGAL_ELEVATION,downwardFacingObstruction} from './d082-redesign-conflicts.mjs';

function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'d082-view-controls-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const chunk=(type,data)=>{const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(412);header.writeUInt32BE(860,4);header[8]=8;header[9]=6;
 const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc((412*4+1)*860))),chunk('IEND',Buffer.alloc(0))]);
 const camera={pos:[10,10,10],target:[0,0,0],zoom:4},extra=SUPPLEMENTARY_VIEWS[0];
 const standardViews=STANDARD_VIEW_IDS.map(id=>({view:{id,spin:0,tilt:0},camera:structuredClone(camera)}));
 const plan={slot:'179:0',width:412,owner:154,originalCamera:structuredClone(camera),standardViews,selected:[{view:extra,camera:structuredClone(camera)}]};
 const shots=[];for(const phase of ['before','after'])for(const [i,s]of [...standardViews,{view:extra,camera}].entries()){
  const file=`${phase}-${i}.png`;fs.writeFileSync(path.join(directory,file),png);
  shots.push({k:179,v:0,width:412,height:860,owner:154,phase,view:structuredClone(s.view),camera:structuredClone(s.camera),
   role:i<5?'prototype':'supplementary-surface',file,bytes:png.length,sha256:sha(png),canvasSha256:'canvas',worldSha256:'world',
   pausedRepeat:{passed:true,sha256:sha(png),canvasSha256:'canvas'},geometryComparison:{allDigestFieldsExact:true}});
 }
 return {directory,manifest:{shots,supplementaryPlans:[plan]},check(m){return assertCapturedSurfaceViews(m,{k:179,v:0},412,{directory});}};
}

test('complete paired original and supplementary PNG evidence is accepted',t=>{
 const f=fixture(t),r=f.check(f.manifest);assert.deepEqual(r.phases.map(s=>s.length),[6,6]);
});

for(const [name,mutate]of [
 ['missing original view',m=>m.shots.splice(1,1)],
 ['duplicated original view',m=>m.shots.push(structuredClone(m.shots[1]))],
 ['unpaired supplementary camera',m=>m.shots.pop()],
 ['duplicated supplementary image',m=>m.shots.push(structuredClone(m.shots.at(-1)))],
 ['unplanned supplementary angle',m=>m.shots.at(-1).view.spin+=.01],
 ['changed supplementary observed pose',m=>m.shots.at(-1).camera.pos[0]+=.01],
 ['changed original observed pose',m=>m.shots[1].camera.pos[0]+=.01],
 ['changed world',m=>m.shots.at(-1).worldSha256='changed'],
 ['changed owner',m=>m.shots.at(-1).owner=99],
 ['missing shared plan',m=>m.supplementaryPlans=[]],
 ['duplicate shared plan',m=>m.supplementaryPlans.push(structuredClone(m.supplementaryPlans[0]))],
 ['planned but uncaptured image',m=>m.supplementaryPlans[0].selected.push(structuredClone(m.supplementaryPlans[0].selected[0]))],
 ['reused before PNG as after',m=>m.shots.at(-1).file=m.shots[5].file],
 ['nonexistent PNG',m=>m.shots.at(-1).file='absent.png'],
 ['PNG hash mismatch',m=>m.shots.at(-1).sha256='0'.repeat(64)],
 ['PNG size mismatch',m=>m.shots.at(-1).bytes++],
 ['PNG dimensions mismatch',m=>m.shots.at(-1).height++],
 ['escaped PNG path',m=>m.shots.at(-1).file='../outside.png'],
 ['missing repeat proof',m=>delete m.shots.at(-1).pausedRepeat],
 ['changed repeat pixels',m=>m.shots.at(-1).pausedRepeat.canvasSha256='changed'],
 ['inexact production geometry',m=>m.shots.at(-1).geometryComparison.allDigestFieldsExact=false],
 ['illegal planned orbit',m=>{m.supplementaryPlans[0].selected[0].view={id:'underground',spin:0,tilt:-Math.PI/2};m.shots[5].view=m.shots.at(-1).view=m.supplementaryPlans[0].selected[0].view;}],
])test(`fail closed: ${name}`,t=>{const f=fixture(t),bad=structuredClone(f.manifest);mutate(bad);assert.throws(()=>f.check(bad));});

test('supplementary angles preserve the original OrbitControls limits',()=>{
 assert.ok(SUPPLEMENTARY_VIEWS.length>0);assert.equal(new Set(SUPPLEMENTARY_VIEWS.map(v=>v.id)).size,SUPPLEMENTARY_VIEWS.length);
 for(const v of SUPPLEMENTARY_VIEWS){const e=Math.PI/6+v.tilt;assert.ok(e>LEGAL_ELEVATION[0]&&e<LEGAL_ELEVATION[1]);}
});

test('downward required surfaces are back-facing for the entire legal continuum',()=>{
 const probe={id:'required-bottom',point:[0,.71,0],normal:[0,-1,0],required:true},proof=downwardFacingObstruction(probe);
 assert.ok(proof.minimumNormalDotRayDirection>0);assert.equal(probe.required,true);
 assert.equal(proof.minimumNormalDotRayDirection,Math.sin(LEGAL_ELEVATION[0]));
 for(const normal of [[1,0,0],[0,1,0],[.000001,-1,0]])assert.equal(downwardFacingObstruction({...probe,normal}),null,'no unsupported proof for a nonhorizontal face');
});
