import test from 'node:test';
import assert from 'node:assert/strict';
import {createOracle,cityOf,VIEWPORTS,VIEWS,pairedCamera} from './d082-redesign-support.mjs';
import {planSupplementaryViews} from './d082-redesign-views.mjs';
import {auditSurface,assertCoverage} from './d082-redesign-surfaces.mjs';
import {retained179v1,assertRetained179v1Coverage} from './d082-179v1-retained.mjs';
test('real 179v1 keeps all 524 old exterior coordinates in addition to every new D081 point',()=>{
 const before=createOracle('gallery',false,1),after=createOracle('gallery',true,1),b=cityOf('gallery',1).buildings.find(b=>b.k===179),viewport=VIEWPORTS.find(v=>v.W===412),shot={k:179,v:1,owner:b.id,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size,zoom:8};
 try{const standard=[{id:'context',spin:0,tilt:0},...VIEWS].map(view=>({...shot,view,camera:pairedCamera(before,after,{...shot,zoom:view.id==='context'?4:8},viewport,view)})),r=planSupplementaryViews(before,after,shot,viewport,standard),old=retained179v1(shot),views=[...standard,...r.plan.selected],audits=views.map(s=>auditSurface(after,s.camera,viewport,old.contract));
  assert.equal(assertCoverage(r.audits[1],r.contracts[1]).coveredSamples,1044);assert.equal(assertRetained179v1Coverage(audits).covered,524);assert.equal(r.plan.retainedOldCoordinates.remaining,0);
  const extra=r.plan.selected.findIndex(s=>s.gain.every(n=>n===0)&&s.retainedOldGain>0);assert.ok(extra>=0,'an honest extra angle is necessary solely for retained coordinates');
  const without=audits.filter((_,i)=>i!==standard.length+extra);assert.throws(()=>assertRetained179v1Coverage(without),'old seven-view pass must reject when two retained points are unseen');assert.equal(assertCoverage(r.audits[1].filter((_,i)=>i!==standard.length+extra),r.contracts[1]).coveredSamples,1044,'new-mesh pass alone cannot waive old coordinates');
  const dropped=structuredClone(audits);for(const a of dropped)a.samples=a.samples.filter(p=>p.id!==old.supersededIds[0]);assert.throws(()=>assertRetained179v1Coverage(dropped),'even a superseded record cannot be deleted from the retained old audit');
  const omitted=structuredClone(audits),id=old.retainedIds[0];for(const a of omitted){a.samples=a.samples.map(p=>p.id===id?{...p,visible:false}:p);a.visibleSamples=a.samples.filter(p=>p.visible).map(p=>p.id);}assert.throws(()=>assertRetained179v1Coverage(omitted),'one missing retained coordinate remains red');
  assert.equal(old.contract.requiredSamples.length,1011);assert.ok(old.supersededIds.every(id=>old.contract.probes.find(p=>p.id===id).required));
 }finally{before.dispose();after.dispose();}
});
