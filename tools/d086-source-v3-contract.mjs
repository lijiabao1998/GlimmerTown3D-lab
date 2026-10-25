// Additive exact-source V3 contract factory. No current-candidate pin is authored
// here: the separately frozen entry/fixture supplies its exact manifest hash.
import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import * as prior from'./d086-source-v2.mjs';
export{D085_CHANGED,D084_ADDED,D086_ADDED,D086_CURRENT_PATHS}from'./d086-source-v2.mjs';
export const D086_MODIFIED=Object.freeze([...prior.D086_MODIFIED,'src/render/post.ts']);
export const D084_CHANGED=Object.freeze([...new Set([...prior.D084_CHANGED,'src/render/post.ts'])]);
export const D086_V3_BASELINE='207404e1479593cd748b6e71bbe9c2d7e3c1042a';
export const D086_V3_FILE='src/render/britishCivicMarketModels.mjs';
export const D086_V3_FILES=Object.freeze([D086_V3_FILE,'src/cityView.ts','src/render/post.ts']);
export const D086_V3_BEFORE_SHAS=Object.freeze({[D086_V3_FILE]:'d74fd0c2bac005e39ded486067f83f7b922a64dd7ab20f3e82882709ea76a38e','src/cityView.ts':'70269eb87a36fad556fe228d2dba0894bc9dfe09f02303b6fc7f565023a30d09','src/render/post.ts':'e30b91b4ad1a60feb489ec3df04052b574d752f7c002baf0e00a1b34c516fa5c'});
export const D086_V3_BEFORE_SHA='d74fd0c2bac005e39ded486067f83f7b922a64dd7ab20f3e82882709ea76a38e';
export const D086_V3_POST_TYPE_BEFORE='cam: THREE.OrthographicCamera, style: Style';
export const D086_V3_POST_TYPE_AFTER='cam: THREE.OrthographicCamera | THREE.PerspectiveCamera, style: Style';
export const D086_V3_BASELINE_PINS_SHA='2f32a9ac9655344c7f509c7218c340c68d50aebb85b259cc28f4692865b97aba';
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=/^[a-f0-9]{64}$/;
export function createD086V3Lease(bytes,expectedHash){
 assert.equal(typeof bytes,'string');assert.match(expectedHash,hash);assert.equal(sha(bytes),expectedHash,'D086 immutable finite geometry-v3 lease');const m=JSON.parse(bytes);
 assert.deepEqual(Object.keys(m),['schema','baseline','qualification','baselineFiles','changes']);assert.equal(m.schema,3);assert.equal(m.baseline,D086_V3_BASELINE);assert.equal(typeof m.qualification,'string');assert.ok(m.qualification.length>0);
 assert.deepEqual(Object.keys(m.baselineFiles),prior.D086_CURRENT_PATHS,'exact243 source inventory at207404e');for(const pin of Object.values(m.baselineFiles))assert.match(pin,hash);assert.equal(sha(JSON.stringify(m.baselineFiles)),D086_V3_BASELINE_PINS_SHA,'complete immutable207404e source pins');
 assert.deepEqual(m.changes.map(r=>r.file),D086_V3_FILES,'exact three existing product files, no additional inspection-source allowance');const changes=new Map();for(const r of m.changes){assert.deepEqual(Object.keys(r),['file','before','beforeSha256','afterSha256']);assert.equal(typeof r.before,'string');assert.equal(sha(r.before),D086_V3_BEFORE_SHAS[r.file]);assert.equal(r.beforeSha256,D086_V3_BEFORE_SHAS[r.file]);assert.equal(m.baselineFiles[r.file],r.beforeSha256);assert.match(r.afterSha256,hash);assert.notEqual(r.afterSha256,r.beforeSha256,'each declared source must really change, never stale v2 relabel');if(r.file==='src/render/post.ts'){assert.equal(r.before.split(D086_V3_POST_TYPE_BEFORE).length,2);assert.equal(r.afterSha256,sha(r.before.replace(D086_V3_POST_TYPE_BEFORE,D086_V3_POST_TYPE_AFTER)),'post.ts permits only the exact camera parameter type union, no runtime edit');}changes.set(r.file,r);}
 function d086V3PriorSource(file,text){assert.ok(Object.hasOwn(m.baselineFiles,file),file+' exact allowed source: unknown/unlisted path rejected');assert.equal(typeof text,'string',file+' exact allowed source: actual text required');const r=changes.get(file);assert.equal(sha(text),r?r.afterSha256:m.baselineFiles[file],file+' exact allowed source: exact current V3 or unchanged207404e bytes');return r?r.before:text;}
 function inventory(files,read){assert.ok(Array.isArray(files));assert.equal(typeof read,'function');assert.equal(new Set(files).size,files.length,'duplicate current source rejected');assert.deepEqual([...files].sort(),prior.D086_CURRENT_PATHS,'complete current inventory, no unknown/missing paths');for(const f of files)d086V3PriorSource(f,read(f));}
 const api={d086V3PriorSource,
  d086PriorSource:(file,text)=>prior.d086PriorSource(file,d086V3PriorSource(file,text)),
  d085PriorSource:(file,text)=>prior.d085PriorSource(file,d086V3PriorSource(file,text)),
  d084PriorSource:(file,text)=>prior.d084PriorSource(file,d086V3PriorSource(file,text)),
  d086PriorInventory:(files,read)=>{inventory(files,read);return prior.d086PriorInventory(files,f=>d086V3PriorSource(f,read(f)));},
  d084PriorInventory:(files,read)=>{inventory(files,read);return prior.d084PriorInventory(files,f=>d086V3PriorSource(f,read(f)));}};
 return Object.freeze(api);
}
