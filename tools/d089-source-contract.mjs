// D089 finite outer lease. Check all actual current source bytes before exposing
// immutable c023a2da preimages to historical source-only guards. Never runtime.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as prior from './d088-source.mjs';
export const D089_BASELINE='c023a2da0e4999d43e3d4216e800c4c96d06a3c1';
export const D089_MODIFIED=Object.freeze(['src/cityView.ts','src/content/kindShapes.ts','src/content/kinds.ts','src/render/cityScene.ts','src/render/kindArt.ts','src/sim/edit.ts','src/ui/growthGuide.ts']);
export const D089_ADDED=Object.freeze(['src/content/britishMarketEstates.ts','src/render/britishMarketEstateArt.ts','src/render/britishMarketEstateModels.d.mts','src/render/britishMarketEstateModels.mjs','src/sim/marketEstateVariant.ts']);
export const D089_CURRENT_PATHS=Object.freeze([...prior.D088_CURRENT_PATHS,...D089_ADDED].sort());
export const D085_CHANGED=prior.D085_CHANGED;
export const D084_CHANGED=Object.freeze([...new Set([...prior.D084_CHANGED,...D089_MODIFIED,...D089_ADDED])]);
export const D084_ADDED=Object.freeze([...prior.D084_ADDED,...D089_ADDED]);
export const D088_MODIFIED=prior.D088_MODIFIED,D088_ADDED=prior.D088_ADDED,D088_CURRENT_PATHS=prior.D088_CURRENT_PATHS;
export const D087_MODIFIED=prior.D087_MODIFIED,D087_ADDED=prior.D087_ADDED,D087_CURRENT_PATHS=prior.D087_CURRENT_PATHS;
export const D086_MODIFIED=prior.D086_MODIFIED,D086_ADDED=prior.D086_ADDED,D086_CURRENT_PATHS=prior.D086_CURRENT_PATHS;
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=/^[a-f0-9]{64}$/;
export function createD089Lease(bytes,expectedHash){
 assert.equal(typeof bytes,'string');assert.match(expectedHash,hash);assert.equal(sha(bytes),expectedHash,'exact finite D089 manifest');
 const m=JSON.parse(bytes);assert.deepEqual(Object.keys(m),['schema','baseline','qualification','baselineFiles','modified','added']);assert.equal(m.schema,1);assert.equal(m.baseline,D089_BASELINE);assert.ok(m.qualification.length>0);
 assert.deepEqual(Object.keys(m.baselineFiles),prior.D088_CURRENT_PATHS,'all253 actual released source files');
 assert.deepEqual(Object.keys(m.modified),D089_MODIFIED,'only seven explicit native integration files, including exact-slot village precedence');assert.deepEqual(Object.keys(m.added),D089_ADDED,'only five new market/estate source files');
 for(const h of Object.values(m.baselineFiles))assert.match(h,hash);
 for(const[f,r]of Object.entries(m.modified)){assert.deepEqual(Object.keys(r),['before','beforeSha256','afterSha256']);assert.equal(typeof r.before,'string');assert.equal(sha(r.before),r.beforeSha256);assert.equal(r.beforeSha256,m.baselineFiles[f]);assert.match(r.afterSha256,hash);assert.notEqual(r.beforeSha256,r.afterSha256);}
 for(const h of Object.values(m.added))assert.match(h,hash);
 function d089PriorSource(file,text){assert.ok(Object.hasOwn(m.baselineFiles,file)||D089_ADDED.includes(file),file+' exact allowed source: unknown path');assert.equal(typeof text,'string',file+' exact allowed source: actual text required');assert.equal(sha(text),m.modified[file]?.afterSha256??m.added[file]??m.baselineFiles[file],file+' exact allowed source: all actual current bytes');return D089_ADDED.includes(file)?'':m.modified[file]?.before??text;}
 function d089PriorInventory(files,read){assert.ok(Array.isArray(files));assert.equal(typeof read,'function');assert.equal(new Set(files).size,files.length,'duplicate actual source');assert.deepEqual([...files].sort(),D089_CURRENT_PATHS,'exact258 current source inventory');for(const f of files)d089PriorSource(f,read(f));return [...prior.D088_CURRENT_PATHS];}
 const chain=(fn,file,text)=>{const old=d089PriorSource(file,text);return D089_ADDED.includes(file)?'':fn(file,old);};
 const inventory=(fn,files,read)=>fn(d089PriorInventory(files,read),f=>d089PriorSource(f,read(f)));
 return Object.freeze({d089PriorSource,d089PriorInventory,d088PriorSource:(f,t)=>chain(prior.d088PriorSource,f,t),d088PriorInventory:(f,r)=>inventory(prior.d088PriorInventory,f,r),d087PriorSource:(f,t)=>chain(prior.d087PriorSource,f,t),d087PriorInventory:(f,r)=>inventory(prior.d087PriorInventory,f,r),d086PriorSource:(f,t)=>chain(prior.d086PriorSource,f,t),d085PriorSource:(f,t)=>chain(prior.d085PriorSource,f,t),d084PriorSource:(f,t)=>chain(prior.d084PriorSource,f,t),d086PriorInventory:(f,r)=>inventory(prior.d086PriorInventory,f,r),d084PriorInventory:(f,r)=>inventory(prior.d084PriorInventory,f,r)});
}
