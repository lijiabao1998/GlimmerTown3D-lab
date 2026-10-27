// Additive D090 finite-source camera restoration. D089's accepted test is immutable.
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{execFileSync}from'node:child_process';
const read=f=>fs.readFileSync(f,'utf8'),old=f=>execFileSync('git',['show','5b41bac165ba2b29146e6835490357bebc3cd549:'+f],{encoding:'utf8'});
const deltas=[
 ["import { HERITAGE_TOOLS, NATIVE_ART_TOOLS, WORKING_RURAL_TOOLS, PUBLIC_SERVICE_TOOLS, MARKET_ESTATE_TOOLS } from './sim/edit.ts';","import { HERITAGE_TOOLS, NATIVE_ART_TOOLS, WORKING_RURAL_TOOLS, PUBLIC_SERVICE_TOOLS, MARKET_ESTATE_TOOLS, UTILITY_HERITAGE_TOOLS } from './sim/edit.ts';\nimport { utilityHeritageTool } from './content/britishUtilityHeritage.ts';\nimport { britishUtilityHeritageCacheInfo } from './render/britishUtilityHeritageModels.mjs';"],
 ['coastalRecreationOn, true, true, true, true), colors:','coastalRecreationOn, true, true, true, true, true), colors:'],
 ["tool === 'food' ? FOOD_TOOLS : MARKET_ESTATE_TOOLS.some","tool === 'food' ? FOOD_TOOLS : UTILITY_HERITAGE_TOOLS.some(c => c.id === civicTool) ? UTILITY_HERITAGE_TOOLS : MARKET_ESTATE_TOOLS.some"],
 ["    const want = tool === 'civic' && (civicTool === 'wpipe' || civicTool === 'water' || civicTool === 'sewage');","    const utilityBase = utilityHeritageTool(civicTool)?.baseTool;\n    const want = tool === 'civic' && (civicTool === 'wpipe' || civicTool === 'water' || civicTool === 'sewage' || utilityBase === 'water' || utilityBase === 'sewage');"],
 ['[...CIVIC_TOOLS, ...HERITAGE_TOOLS, ...NATIVE_ART_TOOLS, ...WORKING_RURAL_TOOLS, ...PUBLIC_SERVICE_TOOLS, ...MARKET_ESTATE_TOOLS].some','[...CIVIC_TOOLS, ...HERITAGE_TOOLS, ...NATIVE_ART_TOOLS, ...WORKING_RURAL_TOOLS, ...PUBLIC_SERVICE_TOOLS, ...MARKET_ESTATE_TOOLS, ...UTILITY_HERITAGE_TOOLS].some'],
 ['    d089CacheInfo: () => britishMarketEstateCacheInfo(),','    d089CacheInfo: () => britishMarketEstateCacheInfo(),\n    d090CacheInfo: () => britishUtilityHeritageCacheInfo(),']
];
const sceneDeltas=[
 ["import * as THREE from 'three';","import * as THREE from 'three';\n// D090-BEGIN exact-utility-heritage-precedence\nimport { utilityHeritageSlot } from '../content/britishUtilityHeritage.ts';\n// D090-END exact-utility-heritage-precedence"],
 ['!(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v)) ? villageKind(b.k)','!(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v)) && !(shape?.p?.nativeUtilityHeritage === true && utilityHeritageSlot(b.k,b.v)) ? villageKind(b.k)']
];
function expected(file,changes){let s=old(file);for(const[a,b]of changes){assert.equal(s.split(a).length,2,'one finite native integration seam');s=s.replace(a,b);}return s;}
function qualify(view,scene){assert.equal(view,expected('src/cityView.ts',deltas),'entire player/render camera source remains exact beyond explicit UI/native flag/cache/pipe selection');assert.equal(scene,expected('src/render/cityScene.ts',sceneDeltas),'only opted-in exact new variant can bypass village override');}
test('whole original player camera/render bytes restored by finite native-only additions',()=>{qualify(read('src/cityView.ts'),read('src/render/cityScene.ts'));assert.equal(read('src/render/post.ts'),old('src/render/post.ts'));assert.doesNotMatch(read('src/cityView.ts'),/inspectionCamera|d08[6-9]Inspection|d090Inspection/);});
test('D081 original classifier, legal cameras and all tolerances remain exact verified190 bytes',()=>{for(const f of['tools/d081-frame.mjs','tools/unit-d081-frame.mjs','proposals/d086/surface-contract.mjs','proposals/d086/browser-legal-surface-capture.mjs'])assert.equal(read(f),old(f));});
for(const[name,mutate]of[
 ['camera epsilon',s=>s+'\n// unseen camera mutation'],
 ['widen legal zoom',s=>s.replace('controls.maxZoom = 8','controls.maxZoom = 9')],
 ['remove old native flag',s=>s.replace('coastalRecreationOn, true, true, true, true, true','coastalRecreationOn, false, true, true, true, true')],
 ['drop old wave flag',s=>s.replace('coastalRecreationOn, true, true, true, true, true','coastalRecreationOn, true, true, true, true')],
 ['hide cache side effect',s=>s.replace('d090CacheInfo: () => britishUtilityHeritageCacheInfo()','d090CacheInfo: () => (sim.money++, britishUtilityHeritageCacheInfo())')]
])test('complete camera source rejects '+name,()=>{const s=read('src/cityView.ts'),bad=mutate(s);assert.notEqual(bad,s);assert.throws(()=>qualify(bad,read('src/render/cityScene.ts')));});
test('new exact cemetery path cannot bypass any older wave or village/default slot',()=>{const s=read('src/render/cityScene.ts');for(const bad of[s.replace(' && workingRuralSlot(b.k,b.v)',''),s.replace('shape?.p?.nativeWorkingRural === true','true'),s.replace(' && marketEstateSlot(b.k,b.v)',''),s.replace('shape?.p?.nativeMarketEstates === true','true'),s.replace(' && utilityHeritageSlot(b.k,b.v)',''),s.replace('shape?.p?.nativeUtilityHeritage === true','true'),s.replace('utilityHeritageSlot(b.k,b.v)','utilityHeritageSlot(16,5)'),s+'\n// mutation']){assert.notEqual(bad,s);assert.throws(()=>qualify(read('src/cityView.ts'),bad));}});
test('exact inherited pipe visibility cannot broaden to unrelated civic tools',()=>{const s=read('src/cityView.ts');for(const bad of[s.replace("utilityBase === 'water' || utilityBase === 'sewage'","utilityBase !== undefined"),s.replace("utilityHeritageTool(civicTool)?.baseTool","'water'"),s.replace("civicTool === 'wpipe' || civicTool === 'water'","civicTool === 'water'")]){assert.notEqual(bad,s);assert.throws(()=>qualify(bad,read('src/render/cityScene.ts')));}});
