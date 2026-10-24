// Independent, closed reference for the finite native containment correction.
// The accepted source remains immutable; no observed product output sets a pin.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createDesign as acceptedDesign,DESIGNS} from './models.mjs';
export const ACCEPTED_SOURCE_SHA='9f0e20ad062b2638e2f4f0b0de365664383a2e05f88f61f3421ba44b4bd8b7d8';
export const NATIVE_SOURCE_SHA='7f368677d4b3725493f8a3ea9633e31e40ab811ad25b88143eeeb9ae468493d3';
const sha=b=>createHash('sha256').update(b).digest('hex'),source=fs.readFileSync('proposals/d083/models.mjs','utf8');assert.equal(sha(source),ACCEPTED_SOURCE_SHA);
const from="b.beam('access-plank',[.5,.18,.86],[.5,0,.98],.11,C.oak,false)",to="b.beam('access-plank',[.5,.18,.86],[.5,0.02802554803768824,0.95],.11,C.oak,false)";
assert.equal(source.split(from).length,2);const referenceSource=source.replace(from,to);assert.equal(sha(referenceSource),NATIVE_SOURCE_SHA);
const file=path.resolve('scratch/d083-native-reference/independent-reference.mjs');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,referenceSource);
const reference=await import(pathToFileURL(file).href+'?sha='+NATIVE_SOURCE_SHA);
export const emitNativeReference=reference.emitD083Prototype;
export function assertNativeArtCorrection(){
 assert.equal(sha(fs.readFileSync('src/render/d083AcceptedModels.mjs')),NATIVE_SOURCE_SHA);
 const delta=[];for(const d of DESIGNS){const old=acceptedDesign(d.id),now=reference.createDesign(d.id);assert.equal(now.triangles.length,old.triangles.length);
  for(let i=0;i<old.triangles.length;i++)if(JSON.stringify(old.triangles[i])!==JSON.stringify(now.triangles[i])){assert.equal(d.id,'01-staddle-granary');assert.equal(old.triangles[i].part,'access-plank');assert.equal(now.triangles[i].part,'access-plank');assert.equal(old.triangles[i].color,now.triangles[i].color);delta.push(i);}
 }
 assert.equal(delta.length,12);return{acceptedSourceSha256:ACCEPTED_SOURCE_SHA,nativeSourceSha256:NATIVE_SOURCE_SHA,changedGranaryTriangleIndices:delta,allOtherGranaryTrianglesExact:1012,otherSevenModelsExact:true,noTriangleRemoved:true,noMaterialChanged:true,finiteArtConfirmation:'Sentinel_2b0f80763e308191aaf466520dc9a728'};
}
