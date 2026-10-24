// Planning-only proof on actual complete production scenes, never a browser or PNG receipt.
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {TARGETS,VIEWPORTS,createOracle} from './d082-redesign-support.mjs';
import {planSurfaceViews} from './d082-redesign-surfaces.mjs';
const rows=[],out=process.env.D082_RELEASE_COVERAGE_OUT??'scratch/d082-release-node-coverage-v2',slots=process.env.D082_RELEASE_COVERAGE_SLOTS?.split(',');fs.mkdirSync(out,{recursive:true});const sourcePins=Object.fromEntries(['src/render/britishCoastalRecreationArt.ts','src/render/d082RemainingGeometryData.ts'].map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));fs.writeFileSync(out+'/source-pins.json',JSON.stringify(sourcePins,null,2));
for(const t of TARGETS.filter(t=>!slots||slots.includes(t.k+':'+t.v)))for(const vp of VIEWPORTS){
 const before=createOracle('gallery',false,t.v),after=createOracle('gallery',true,t.v);
 try{const b=after.city.buildings.find(b=>b.k===t.k&&b.v===t.v);assert.ok(b);const shot={owner:b.id,k:t.k,v:t.v,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size};
 const r=planSurfaceViews(before,after,shot,vp);fs.writeFileSync(`${out}/surface-${t.k}-v${t.v}-${vp.W}.json.gz`,gzipSync(JSON.stringify({qualification:'Node planning only, no captured pixels.',sourcePins,...r}))); const row={slot:t.k+':'+t.v,width:vp.W,passed:r.passed,required:r.contracts.map(c=>c.requiredSamples.length),missing:r.failure.map(f=>f.remaining),views:r.selected};rows.push(row);console.log(JSON.stringify(row));fs.writeFileSync(out+'/report.json',JSON.stringify({qualification:'Node actual-scene planning only. Real Chromium paired PNG acceptance still required.',complete:false,rows},null,2));
 }finally{before.dispose();after.dispose();}
}
fs.writeFileSync(out+'/report.json',JSON.stringify({qualification:'Node actual-scene planning only. Real Chromium paired PNG acceptance still required.',complete:true,passed:rows.every(r=>r.passed),rows},null,2));process.exitCode=rows.every(r=>r.passed)?0:1;
