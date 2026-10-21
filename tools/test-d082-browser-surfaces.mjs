// Node-only regression checks. Never substitutes for actual browser observations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createD082BrowserSurfaceOracle,d082SupplementaryViews} from './d082-browser-surfaces.mjs';
if(process.argv.includes('--plan-matrix')){
 for(const width of [360,412,1440])for(const on of [false,true])for(const force of [0,1,2]){
  const oracle=createD082BrowserSurfaceOracle(on,force,width);
  try{console.log(JSON.stringify({width,on,force,owners:oracle.owners,passed:true,qualification:'Node exact-scene contract and complete legal-view plan only'}));}finally{oracle.dispose();}
 }
}else{
 const oracle=createD082BrowserSurfaceOracle(true,2,360);
 try{
  assert.throws(()=>oracle.assertBrowserGeometry({}));assert.throws(()=>oracle.finish());
  for(const [k,owner,group]of [[126,168,'play-water'],[179,154,'halls'],[185,160,'coastal']]){
   const evidence=JSON.parse(gunzipSync(fs.readFileSync(new URL(`../docs/evidence/D082-candidate-v3/candidate-${group}-v3-gallery-k${k}-v2-owner${owner}-360.json.gz`,import.meta.url))));
   const original=structuredClone(evidence.original.view),bad=structuredClone(original);bad.pos[0]+=.01;assert.throws(()=>oracle.audit(owner,bad));
   // A sub-tolerance pose difference exercises the independently reconstructed
   // observed-original silhouette contract, rather than merely reusing the pin.
   original.pos[0]+=1e-12;
   for(const camera of [original,...d082SupplementaryViews(k,2,owner,360).map(s=>s.view)])oracle.audit(owner,camera);
   assert.throws(()=>oracle.audit(owner,original));
  }
  console.log(JSON.stringify({qualification:'Node API and negative controls only, not browser acceptance',coverage:oracle.finish()},null,2));
 }finally{oracle.dispose();}
}
