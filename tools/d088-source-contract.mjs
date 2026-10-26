// D088 finite outer lease. Check all actual current source bytes before exposing
// immutable cdd541da preimages to historical source-only guards. Never runtime.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as prior from './d087-source.mjs';
export const D088_BASELINE='cdd541da74973dba2ca73b782936c012d315add9';
export const D088_MODIFIED=Object.freeze(['src/cityView.ts','src/content/kindShapes.ts','src/content/kinds.ts','src/render/kindArt.ts','src/sim/edit.ts','src/ui/growthGuide.ts']);
export const D088_ADDED=Object.freeze(['src/content/britishPublicServices.ts','src/render/britishPublicServicesArt.ts','src/render/britishPublicServicesModels.d.mts','src/render/britishPublicServicesModels.mjs','src/sim/publicServiceVariant.ts']);
export const D088_CURRENT_PATHS=Object.freeze([...prior.D087_CURRENT_PATHS,...D088_ADDED].sort());
export const D085_CHANGED=prior.D085_CHANGED;
export const D084_CHANGED=Object.freeze([...new Set([...prior.D084_CHANGED,...D088_MODIFIED,...D088_ADDED])]);
export const D084_ADDED=Object.freeze([...prior.D084_ADDED,...D088_ADDED]);
export const D087_MODIFIED=prior.D087_MODIFIED,D087_ADDED=prior.D087_ADDED,D087_CURRENT_PATHS=prior.D087_CURRENT_PATHS;
export const D086_MODIFIED=prior.D086_MODIFIED,D086_ADDED=prior.D086_ADDED,D086_CURRENT_PATHS=prior.D086_CURRENT_PATHS;
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=/^[a-f0-9]{64}$/;
export function createD088Lease(bytes,expectedHash){
 assert.equal(typeof bytes,'string');assert.match(expectedHash,hash);assert.equal(sha(bytes),expectedHash,'exact finite D088 manifest');
 const m=JSON.parse(bytes);assert.deepEqual(Object.keys(m),['schema','baseline','qualification','baselineFiles','modified','added']);assert.equal(m.schema,1);assert.equal(m.baseline,D088_BASELINE);assert.ok(m.qualification.length>0);
 assert.deepEqual(Object.keys(m.baselineFiles),prior.D087_CURRENT_PATHS,'all248 actual released source files');
 assert.deepEqual(Object.keys(m.modified),D088_MODIFIED,'only six explicit native integration files; cityScene unchanged');assert.deepEqual(Object.keys(m.added),D088_ADDED,'only five new public-service source files');
 for(const h of Object.values(m.baselineFiles))assert.match(h,hash);
 for(const[f,r]of Object.entries(m.modified)){assert.deepEqual(Object.keys(r),['before','beforeSha256','afterSha256']);assert.equal(typeof r.before,'string');assert.equal(sha(r.before),r.beforeSha256);assert.equal(r.beforeSha256,m.baselineFiles[f]);assert.match(r.afterSha256,hash);assert.notEqual(r.beforeSha256,r.afterSha256);}
 for(const h of Object.values(m.added))assert.match(h,hash);
 function d088PriorSource(file,text){assert.ok(Object.hasOwn(m.baselineFiles,file)||D088_ADDED.includes(file),file+' exact allowed source: unknown path');assert.equal(typeof text,'string',file+' exact allowed source: actual text required');assert.equal(sha(text),m.modified[file]?.afterSha256??m.added[file]??m.baselineFiles[file],file+' exact allowed source: all actual current bytes');return D088_ADDED.includes(file)?'':m.modified[file]?.before??text;}
 function d088PriorInventory(files,read){assert.ok(Array.isArray(files));assert.equal(typeof read,'function');assert.equal(new Set(files).size,files.length,'duplicate actual source');assert.deepEqual([...files].sort(),D088_CURRENT_PATHS,'exact253 current source inventory');for(const f of files)d088PriorSource(f,read(f));return [...prior.D087_CURRENT_PATHS];}
 const chain=(fn,file,text)=>{const old=d088PriorSource(file,text);return D088_ADDED.includes(file)?'':fn(file,old);};
 const inventory=(fn,files,read)=>fn(d088PriorInventory(files,read),f=>d088PriorSource(f,read(f)));
 return Object.freeze({d088PriorSource,d088PriorInventory,d087PriorSource:(f,t)=>chain(prior.d087PriorSource,f,t),d087PriorInventory:(f,r)=>inventory(prior.d087PriorInventory,f,r),d086PriorSource:(f,t)=>chain(prior.d086PriorSource,f,t),d085PriorSource:(f,t)=>chain(prior.d085PriorSource,f,t),d084PriorSource:(f,t)=>chain(prior.d084PriorSource,f,t),d086PriorInventory:(f,r)=>inventory(prior.d086PriorInventory,f,r),d084PriorInventory:(f,r)=>inventory(prior.d084PriorInventory,f,r)});
}
