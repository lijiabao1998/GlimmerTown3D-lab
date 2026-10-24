// Current nine version of the full product-bridge corruption checks.
// Original ten API tests still execute unchanged on the frozen historical tree.
import assert from 'node:assert/strict';
import{createOracle}from'./d082-redesign-support.mjs';
let controls=0;const rows=[];
for(const on of[false,true])for(const force of[0,1,2]){const p=createOracle('gallery',on,force);try{
 p.assertBrowserGeometry(p.digest,p.groundEvidence);
 for(const mutate of[d=>d.ground='00000000',d=>d.inst.push('1:050c5d1f:050c5d1f:-'),d=>d.inst[d.inst.length-1]='1:050c5d1f:050c5d1f:-',d=>d.inst.pop(),d=>d.meshes.walls.attrs.position='00000000']){const bad=structuredClone(p.digest);mutate(bad);assert.throws(()=>p.assertBrowserGeometry(bad,p.groundEvidence));controls++;}
 const ground=structuredClone(p.groundEvidence),bytes=Buffer.from(ground.rgb,'base64');bytes[0]^=1;ground.rgb=bytes.toString('base64');assert.throws(()=>p.assertBrowserGeometry(p.digest,ground));controls++;
 assert.throws(()=>p.assertBrowserGeometry({}));assert.throws(()=>p.assertBrowserGeometry(p.digest));controls+=2;rows.push({on,force,negativeControls:8,passed:true});
}finally{p.dispose();}}
assert.equal(controls,48);console.log(JSON.stringify({passed:true,qualification:'Current nine Node API checks only; not actual browser or images.',rows,negativeControls:controls},null,2));
