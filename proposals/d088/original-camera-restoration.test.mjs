import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>fs.readFileSync(f,'utf8'),old=f=>execFileSync('git',['show','cdd541da74973dba2ca73b782936c012d315add9:'+f],{encoding:'utf8'});
const deltas=[
 ["import { HERITAGE_TOOLS, NATIVE_ART_TOOLS, WORKING_RURAL_TOOLS } from './sim/edit.ts';","import { HERITAGE_TOOLS, NATIVE_ART_TOOLS, WORKING_RURAL_TOOLS, PUBLIC_SERVICE_TOOLS } from './sim/edit.ts';"],
 ["import { workingRuralCacheInfo } from './render/britishWorkingRuralModels.mjs';","import { workingRuralCacheInfo } from './render/britishWorkingRuralModels.mjs';\nimport { publicServiceCacheInfo } from './render/britishPublicServicesModels.mjs';"],
 ['coastalRecreationOn, true, true), colors:','coastalRecreationOn, true, true, true), colors:'],
 ["tool === 'food' ? FOOD_TOOLS : WORKING_RURAL_TOOLS.some","tool === 'food' ? FOOD_TOOLS : PUBLIC_SERVICE_TOOLS.some(c => c.id === civicTool) ? PUBLIC_SERVICE_TOOLS : WORKING_RURAL_TOOLS.some"],
 ['[...CIVIC_TOOLS, ...HERITAGE_TOOLS, ...NATIVE_ART_TOOLS, ...WORKING_RURAL_TOOLS].some','[...CIVIC_TOOLS, ...HERITAGE_TOOLS, ...NATIVE_ART_TOOLS, ...WORKING_RURAL_TOOLS, ...PUBLIC_SERVICE_TOOLS].some'],
 ['    d087CacheInfo: () => workingRuralCacheInfo(),','    d087CacheInfo: () => workingRuralCacheInfo(),\n    d088CacheInfo: () => publicServiceCacheInfo(),']
];
function expected(){let s=old('src/cityView.ts');for(const[a,b]of deltas){assert.equal(s.split(a).length,2,'one finite native integration seam');s=s.replace(a,b);}return s;}
function qualify(view,scene){assert.equal(view,expected(),'entire player/render camera path unchanged outside exact UI/flag/cache observation additions');assert.equal(scene,old('src/render/cityScene.ts'),'entire current scene untouched; no new village precedence necessary');}
test('whole original camera/render source exact except explicit new native dispatch/UI wiring',()=>{qualify(read('src/cityView.ts'),read('src/render/cityScene.ts'));assert.equal(read('src/render/post.ts'),old('src/render/post.ts'));assert.doesNotMatch(read('src/cityView.ts'),/inspectionCamera|d086Inspection|d087Inspection|d088Inspection/);});
test('D081 original classifier, legal cameras and every tolerance remain exact accepted bytes',()=>{for(const f of ['tools/d081-frame.mjs','tools/unit-d081-frame.mjs','proposals/d086/surface-contract.mjs','proposals/d086/browser-legal-surface-capture.mjs'])assert.equal(read(f),old(f));});
for(const[name,mutate]of [
 ['camera epsilon',s=>s+'\n// unseen camera mutation'],
 ['widen legal zoom',s=>s.replace('controls.maxZoom = 8','controls.maxZoom = 9')],
 ['remove old native flag',s=>s.replace('coastalRecreationOn, true, true, true','coastalRecreationOn, false, true, true')],
 ['drop old wave flag',s=>s.replace('coastalRecreationOn, true, true, true','coastalRecreationOn, true, true')],
 ['hide cache side effect',s=>s.replace('d088CacheInfo: () => publicServiceCacheInfo()','d088CacheInfo: () => (sim.money++, publicServiceCacheInfo())')]
])test('whole camera source rejects '+name,()=>{const s=read('src/cityView.ts'),bad=mutate(s);assert.notEqual(bad,s,'negative must execute');assert.throws(()=>qualify(bad,read('src/render/cityScene.ts')));});
test('new service wave cannot bypass any old scene or village precedence',()=>{const s=read('src/render/cityScene.ts');for(const bad of [s.replace(' && workingRuralSlot(b.k,b.v)',''),s.replace('shape?.p?.nativeWorkingRural === true','true'),s+'\n// mutation']){assert.notEqual(bad,s);assert.throws(()=>qualify(read('src/cityView.ts'),bad));}});
