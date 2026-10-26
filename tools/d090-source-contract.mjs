// D090 finite outer lease. Check all actual current source bytes before exposing
// immutable 5b41bac1 preimages to historical source-only guards. Never runtime.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as prior from './d089-source.mjs';
export const D090_BASELINE='5b41bac165ba2b29146e6835490357bebc3cd549';
export const D090_MODIFIED=Object.freeze(['src/cityView.ts','src/content/kindShapes.ts','src/content/kinds.ts','src/render/cityScene.ts','src/render/kindArt.ts','src/sim/edit.ts','src/ui/growthGuide.ts']);
export const D090_ADDED=Object.freeze(['src/content/britishUtilityHeritage.ts','src/render/britishUtilityHeritageArt.ts','src/render/britishUtilityHeritageModels.d.mts','src/render/britishUtilityHeritageModels.mjs','src/sim/utilityHeritageVariant.ts']);
export const D090_CURRENT_PATHS=Object.freeze([...prior.D089_CURRENT_PATHS,...D090_ADDED].sort());
export const D085_CHANGED=prior.D085_CHANGED;
export const D084_CHANGED=Object.freeze([...new Set([...prior.D084_CHANGED,...D090_MODIFIED,...D090_ADDED])]);
export const D084_ADDED=Object.freeze([...prior.D084_ADDED,...D090_ADDED]);
export const D089_MODIFIED=prior.D089_MODIFIED,D089_ADDED=prior.D089_ADDED,D089_CURRENT_PATHS=prior.D089_CURRENT_PATHS;
export const D088_MODIFIED=prior.D088_MODIFIED,D088_ADDED=prior.D088_ADDED,D088_CURRENT_PATHS=prior.D088_CURRENT_PATHS;
export const D087_MODIFIED=prior.D087_MODIFIED,D087_ADDED=prior.D087_ADDED,D087_CURRENT_PATHS=prior.D087_CURRENT_PATHS;
export const D086_MODIFIED=prior.D086_MODIFIED,D086_ADDED=prior.D086_ADDED,D086_CURRENT_PATHS=prior.D086_CURRENT_PATHS;
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=/^[a-f0-9]{64}$/;
export function createD090Lease(bytes,expectedHash){
 assert.equal(typeof bytes,'string');assert.match(expectedHash,hash);assert.equal(sha(bytes),expectedHash,'exact finite D090 manifest');
 const m=JSON.parse(bytes);assert.deepEqual(Object.keys(m),['schema','baseline','qualification','baselineFiles','modified','added']);assert.equal(m.schema,1);assert.equal(m.baseline,D090_BASELINE);assert.ok(m.qualification.length>0);
 assert.deepEqual(Object.keys(m.baselineFiles),prior.D089_CURRENT_PATHS,'all258 actual released source files');
 assert.deepEqual(Object.keys(m.modified),D090_MODIFIED,'only seven explicit native integration files, including exact-slot village precedence');assert.deepEqual(Object.keys(m.added),D090_ADDED,'only five new utility/heritage source files');
 for(const h of Object.values(m.baselineFiles))assert.match(h,hash);
 for(const[f,r]of Object.entries(m.modified)){assert.deepEqual(Object.keys(r),['before','beforeSha256','afterSha256']);assert.equal(typeof r.before,'string');assert.equal(sha(r.before),r.beforeSha256);assert.equal(r.beforeSha256,m.baselineFiles[f]);assert.match(r.afterSha256,hash);assert.notEqual(r.beforeSha256,r.afterSha256);}
 for(const h of Object.values(m.added))assert.match(h,hash);
 function d090PriorSource(file,text){assert.ok(Object.hasOwn(m.baselineFiles,file)||D090_ADDED.includes(file),file+' exact allowed source: unknown path');assert.equal(typeof text,'string',file+' exact allowed source: actual text required');assert.equal(sha(text),m.modified[file]?.afterSha256??m.added[file]??m.baselineFiles[file],file+' exact allowed source: all actual current bytes');return D090_ADDED.includes(file)?'':m.modified[file]?.before??text;}
 function d090PriorInventory(files,read){assert.ok(Array.isArray(files));assert.equal(typeof read,'function');assert.equal(new Set(files).size,files.length,'duplicate actual source');assert.deepEqual([...files].sort(),D090_CURRENT_PATHS,'exact263 current source inventory');for(const f of files)d090PriorSource(f,read(f));return [...prior.D089_CURRENT_PATHS];}
 const chain=(fn,file,text)=>{const old=d090PriorSource(file,text);return D090_ADDED.includes(file)?'':fn(file,old);};
 const inventory=(fn,files,read)=>fn(d090PriorInventory(files,read),f=>d090PriorSource(f,read(f)));
 return Object.freeze({d090PriorSource,d090PriorInventory,d089PriorSource:(f,t)=>chain(prior.d089PriorSource,f,t),d089PriorInventory:(f,r)=>inventory(prior.d089PriorInventory,f,r),d088PriorSource:(f,t)=>chain(prior.d088PriorSource,f,t),d088PriorInventory:(f,r)=>inventory(prior.d088PriorInventory,f,r),d087PriorSource:(f,t)=>chain(prior.d087PriorSource,f,t),d087PriorInventory:(f,r)=>inventory(prior.d087PriorInventory,f,r),d086PriorSource:(f,t)=>chain(prior.d086PriorSource,f,t),d085PriorSource:(f,t)=>chain(prior.d085PriorSource,f,t),d084PriorSource:(f,t)=>chain(prior.d084PriorSource,f,t),d086PriorInventory:(f,r)=>inventory(prior.d086PriorInventory,f,r),d084PriorInventory:(f,r)=>inventory(prior.d084PriorInventory,f,r)});
}
