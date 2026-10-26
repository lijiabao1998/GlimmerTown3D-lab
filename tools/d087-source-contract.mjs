// D087 finite outer source lease. This validates every actual current source
// before exposing immutable b427 historical bytes to old source-only guards.
// Runtime imports, model audits, native/browser builds NEVER use this mapping.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as prior from './d086-source-v6.mjs';
export const D087_BASELINE='b4275bda73e72a9fb48343376fccaab52bbc8e84';
export const D087_MODIFIED=Object.freeze(['src/cityView.ts','src/content/kindShapes.ts','src/content/kinds.ts','src/render/cityScene.ts','src/render/kindArt.ts','src/sim/edit.ts','src/ui/growthGuide.ts']);
export const D087_ADDED=Object.freeze(['src/content/britishWorkingRural.ts','src/render/britishWorkingRuralArt.ts','src/render/britishWorkingRuralModels.d.mts','src/render/britishWorkingRuralModels.mjs','src/sim/workingRuralVariant.ts']);
export const D087_CURRENT_PATHS=Object.freeze([...prior.D086_CURRENT_PATHS,...D087_ADDED].sort());
export const D085_CHANGED=prior.D085_CHANGED;
export const D084_CHANGED=Object.freeze([...new Set([...prior.D084_CHANGED,...D087_MODIFIED,...D087_ADDED])]);
export const D084_ADDED=Object.freeze([...prior.D084_ADDED,...D087_ADDED]);
export const D086_MODIFIED=prior.D086_MODIFIED,D086_ADDED=prior.D086_ADDED,D086_CURRENT_PATHS=prior.D086_CURRENT_PATHS;
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=/^[a-f0-9]{64}$/;
export function createD087Lease(bytes,expectedHash){
 assert.equal(typeof bytes,'string');assert.match(expectedHash,hash);assert.equal(sha(bytes),expectedHash,'exact finite D087 manifest');
 const m=JSON.parse(bytes);assert.deepEqual(Object.keys(m),['schema','baseline','qualification','baselineFiles','modified','added']);assert.equal(m.schema,1);assert.equal(m.baseline,D087_BASELINE);assert.ok(m.qualification.length>0);
 assert.deepEqual(Object.keys(m.baselineFiles),prior.D086_CURRENT_PATHS,'all243 actual released source files');
 assert.deepEqual(Object.keys(m.modified),D087_MODIFIED,'only seven explicit native integration files');assert.deepEqual(Object.keys(m.added),D087_ADDED,'only five new working rural source files');
 for(const h of Object.values(m.baselineFiles))assert.match(h,hash);
 for(const [f,r]of Object.entries(m.modified)){assert.deepEqual(Object.keys(r),['before','beforeSha256','afterSha256']);assert.equal(typeof r.before,'string');assert.equal(sha(r.before),r.beforeSha256);assert.equal(r.beforeSha256,m.baselineFiles[f]);assert.match(r.afterSha256,hash);assert.notEqual(r.beforeSha256,r.afterSha256);}
 for(const h of Object.values(m.added))assert.match(h,hash);
 function d087PriorSource(file,text){
  assert.ok(Object.hasOwn(m.baselineFiles,file)||D087_ADDED.includes(file),file+' exact allowed source: unknown path');assert.equal(typeof text,'string',file+' exact allowed source: actual text required');
  assert.equal(sha(text),m.modified[file]?.afterSha256??m.added[file]??m.baselineFiles[file],file+' exact allowed source: all actual current bytes');
  return D087_ADDED.includes(file)?'':m.modified[file]?.before??text;
 }
 function d087PriorInventory(files,read){assert.ok(Array.isArray(files));assert.equal(typeof read,'function');assert.equal(new Set(files).size,files.length,'duplicate actual source');assert.deepEqual([...files].sort(),D087_CURRENT_PATHS,'exact248 current source inventory');for(const f of files)d087PriorSource(f,read(f));return [...prior.D086_CURRENT_PATHS];}
 const chain=(fn,file,text)=>{const old=d087PriorSource(file,text);return D087_ADDED.includes(file)?'':fn(file,old);};
 const inventory=(fn,files,read)=>fn(d087PriorInventory(files,read),f=>d087PriorSource(f,read(f)));
 return Object.freeze({d087PriorSource,d087PriorInventory,
  d086PriorSource:(f,t)=>chain(prior.d086PriorSource,f,t),d085PriorSource:(f,t)=>chain(prior.d085PriorSource,f,t),d084PriorSource:(f,t)=>chain(prior.d084PriorSource,f,t),
  d086PriorInventory:(f,r)=>inventory(prior.d086PriorInventory,f,r),d084PriorInventory:(f,r)=>inventory(prior.d084PriorInventory,f,r)});
}
