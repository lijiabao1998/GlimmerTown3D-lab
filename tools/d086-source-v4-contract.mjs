// Exact finite V4 source lease: lazy procedural cache plus removal of the
// superseded inspection seam. Runtime geometry is never projected by this API.
import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import * as prior from'./d086-source-v3.mjs';
export{D085_CHANGED,D084_CHANGED,D084_ADDED,D086_MODIFIED,D086_ADDED,D086_CURRENT_PATHS}from'./d086-source-v3.mjs';
export const D086_V4_BASELINE='cc8280f30e7b4115c6ffff2df27ca6ca7aa0baba';
export const D086_V4_FILE='src/render/britishCivicMarketModels.mjs';
export const D086_V4_FILES=Object.freeze([D086_V4_FILE,'src/cityView.ts','src/render/post.ts','src/render/britishCivicMarketModels.d.mts']);
export const D086_V4_BEFORE_SHAS=Object.freeze({[D086_V4_FILE]:'cbaf9009d122d66915f0deb21b4540cba4b2e4816c2265a7d17536710a45cc73','src/cityView.ts':'1f2b0cd2669e7672679a83cfb7913f9bbad5c35dc60265aaafaf0225f5afc2e3','src/render/post.ts':'1b7a39238b7fc6e79c578ec311b94876248b129ace6177f7863e1ecdb92a44b3','src/render/britishCivicMarketModels.d.mts':'612624d8049ebe7ed97c3881de44b45fddeb98c4b12427cca51304630c756c47'});
export const D086_V4_BEFORE_SHA=D086_V4_BEFORE_SHAS[D086_V4_FILE];
export const D086_V4_POST_TYPE_BEFORE='cam: THREE.OrthographicCamera | THREE.PerspectiveCamera, style: Style';
export const D086_V4_POST_TYPE_AFTER='cam: THREE.OrthographicCamera, style: Style';
export const D086_V4_BASELINE_PINS_SHA='555bacc2e134e30e6385858adae73fd50b331ad3393931762fa32eba000f9774';
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=/^[a-f0-9]{64}$/;
function once(text,before,after){assert.equal(text.split(before).length,2,'one exact city cache seam');return text.replace(before,after);}
export function d086V4CityAfter(before){
 assert.equal(sha(before),D086_V4_BEFORE_SHAS['src/cityView.ts']);let text=before;
 for(const name of['inspection-camera','inspection-hook']){const re=new RegExp('// D086-BEGIN '+name+'\n[\\s\\S]*?// D086-END '+name+'\n','g');assert.equal([...text.matchAll(re)].length,1);text=text.replace(re,'');}
 text=once(text,'pipe.render(renderer, built.scene, inspectionCamera ?? cam, style,','pipe.render(renderer, built.scene, cam, style,');
 text=once(text,"import { civicMarketSlot } from './content/britishCivicMarkets.ts';\n",'');
 assert.equal(sha(text),'70269eb87a36fad556fe228d2dba0894bc9dfe09f02303b6fc7f565023a30d09','exact actual207404e normal-camera preimage restored');
 text=once(text,"import { HERITAGE_TOOLS, NATIVE_ART_TOOLS } from './sim/edit.ts';","import { HERITAGE_TOOLS, NATIVE_ART_TOOLS } from './sim/edit.ts';\nimport { civicMarketCacheInfo } from './render/britishCivicMarketModels.mjs';");
 return once(text,'    timing: () => ({ ...timing }),','    timing: () => ({ ...timing }),\n    d086CacheInfo: () => civicMarketCacheInfo(),');
}
export const D086_V4_DECLARATION_SUFFIX="export interface CivicMarketCacheInfo {\n  readonly sourceSha256: string;\n  readonly decoded: readonly {readonly id:string;readonly payloadBytes:number;readonly decodeMs:number|null;readonly triangles:number;readonly sourceSha256:string}[];\n  readonly fallbacks: readonly {readonly id:string;readonly reason:string}[];\n  readonly renderCachedModels: readonly string[];\n  readonly proceduralCachedModels: readonly string[];\n}\nexport function civicMarketCacheInfo():CivicMarketCacheInfo;\n";
export function d086V4DeclarationAfter(before){assert.equal(sha(before),D086_V4_BEFORE_SHAS['src/render/britishCivicMarketModels.d.mts']);return before+D086_V4_DECLARATION_SUFFIX;}
export function createD086V4Lease(bytes,expectedHash){
 assert.equal(typeof bytes,'string');assert.match(expectedHash,hash);assert.equal(sha(bytes),expectedHash,'D086 immutable finite source-v4 lease');const m=JSON.parse(bytes);
 assert.deepEqual(Object.keys(m),['schema','baseline','qualification','baselineFiles','changes']);assert.equal(m.schema,4);assert.equal(m.baseline,D086_V4_BASELINE);assert.equal(typeof m.qualification,'string');assert.ok(m.qualification.length>0);
 assert.deepEqual(Object.keys(m.baselineFiles),prior.D086_CURRENT_PATHS,'exact243 source inventory atcc8280f');for(const pin of Object.values(m.baselineFiles))assert.match(pin,hash);assert.equal(sha(JSON.stringify(m.baselineFiles)),D086_V4_BASELINE_PINS_SHA,'complete immutablecc8280f source pins');
 assert.deepEqual(m.changes.map(r=>r.file),D086_V4_FILES,'exact four existing product files only');const changes=new Map();
 for(const r of m.changes){assert.deepEqual(Object.keys(r),['file','before','beforeSha256','afterSha256']);assert.equal(typeof r.before,'string');assert.equal(sha(r.before),D086_V4_BEFORE_SHAS[r.file]);assert.equal(r.beforeSha256,D086_V4_BEFORE_SHAS[r.file]);assert.equal(m.baselineFiles[r.file],r.beforeSha256);assert.match(r.afterSha256,hash);assert.notEqual(r.afterSha256,r.beforeSha256,'each declared source must really change, never stale V3 relabel');
  if(r.file==='src/render/post.ts'){assert.equal(r.before.split(D086_V4_POST_TYPE_BEFORE).length,2);assert.equal(r.afterSha256,sha(r.before.replace(D086_V4_POST_TYPE_BEFORE,D086_V4_POST_TYPE_AFTER)),'post.ts restores only the exact orthographic camera type, no runtime edit');}
  if(r.file==='src/render/britishCivicMarketModels.d.mts')assert.equal(r.afterSha256,sha(d086V4DeclarationAfter(r.before)),'declaration appends only exact readonly CacheInfo type and getter signature');
  if(r.file==='src/cityView.ts')assert.equal(r.afterSha256,sha(d086V4CityAfter(r.before)),'cityView exactly restores normal camera and adds only read-only cache information');changes.set(r.file,r);
 }
 function d086V4PriorSource(file,text){assert.ok(Object.hasOwn(m.baselineFiles,file),file+' exact allowed source: unknown/unlisted path rejected');assert.equal(typeof text,'string',file+' exact allowed source: actual text required');const r=changes.get(file);assert.equal(sha(text),r?r.afterSha256:m.baselineFiles[file],file+' exact allowed source: exact current V4 or unchangedcc8280f bytes');return r?r.before:text;}
 function inventory(files,read){assert.ok(Array.isArray(files));assert.equal(typeof read,'function');assert.equal(new Set(files).size,files.length,'duplicate current source rejected');assert.deepEqual([...files].sort(),prior.D086_CURRENT_PATHS,'complete current inventory, no unknown/missing paths');for(const f of files)d086V4PriorSource(f,read(f));}
 return Object.freeze({d086V4PriorSource,d086PriorSource:(file,text)=>prior.d086PriorSource(file,d086V4PriorSource(file,text)),d085PriorSource:(file,text)=>prior.d085PriorSource(file,d086V4PriorSource(file,text)),d084PriorSource:(file,text)=>prior.d084PriorSource(file,d086V4PriorSource(file,text)),d086PriorInventory:(files,read)=>{inventory(files,read);return prior.d086PriorInventory(files,f=>d086V4PriorSource(f,read(f)));},d084PriorInventory:(files,read)=>{inventory(files,read);return prior.d084PriorInventory(files,f=>d086V4PriorSource(f,read(f)));}});
}
