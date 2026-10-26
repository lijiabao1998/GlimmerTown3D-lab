import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>fs.readFileSync(f,'utf8'),old=f=>execFileSync('git',['show','c023a2da0e4999d43e3d4216e800c4c96d06a3c1:'+f],{encoding:'utf8'});
const deltas=[
 ["import { HERITAGE_TOOLS, NATIVE_ART_TOOLS, WORKING_RURAL_TOOLS, PUBLIC_SERVICE_TOOLS } from './sim/edit.ts';","import { HERITAGE_TOOLS, NATIVE_ART_TOOLS, WORKING_RURAL_TOOLS, PUBLIC_SERVICE_TOOLS, MARKET_ESTATE_TOOLS } from './sim/edit.ts';"],
 ["import { publicServiceCacheInfo } from './render/britishPublicServicesModels.mjs';","import { publicServiceCacheInfo } from './render/britishPublicServicesModels.mjs';\nimport { britishMarketEstateCacheInfo } from './render/britishMarketEstateModels.mjs';"],
 ['coastalRecreationOn, true, true, true), colors:','coastalRecreationOn, true, true, true, true), colors:'],
 ["tool === 'food' ? FOOD_TOOLS : PUBLIC_SERVICE_TOOLS.some","tool === 'food' ? FOOD_TOOLS : MARKET_ESTATE_TOOLS.some(c => c.id === civicTool) ? MARKET_ESTATE_TOOLS : PUBLIC_SERVICE_TOOLS.some"],
 ['[...CIVIC_TOOLS, ...HERITAGE_TOOLS, ...NATIVE_ART_TOOLS, ...WORKING_RURAL_TOOLS, ...PUBLIC_SERVICE_TOOLS].some','[...CIVIC_TOOLS, ...HERITAGE_TOOLS, ...NATIVE_ART_TOOLS, ...WORKING_RURAL_TOOLS, ...PUBLIC_SERVICE_TOOLS, ...MARKET_ESTATE_TOOLS].some'],
 ['    d088CacheInfo: () => publicServiceCacheInfo(),','    d088CacheInfo: () => publicServiceCacheInfo(),\n    d089CacheInfo: () => britishMarketEstateCacheInfo(),']
];
function expected(){let s=old('src/cityView.ts');for(const[a,b]of deltas){assert.equal(s.split(a).length,2,'one finite native integration seam');s=s.replace(a,b);}return s;}
const sceneDeltas=[
 ["import * as THREE from 'three';","import * as THREE from 'three';\n// D089-BEGIN exact-market-estate-precedence\nimport { marketEstateSlot } from '../content/britishMarketEstates.ts';\n// D089-END exact-market-estate-precedence"],
 ['!(shape?.p?.nativeWorkingRural === true && workingRuralSlot(b.k,b.v)) ? villageKind(b.k)', '!(shape?.p?.nativeWorkingRural === true && workingRuralSlot(b.k,b.v)) && !(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v)) ? villageKind(b.k)']
];
function expectedScene(){let s=old('src/render/cityScene.ts');for(const[a,b]of sceneDeltas){assert.equal(s.split(a).length,2,'one exact-slot native scene integration seam');s=s.replace(a,b);}return s;}
function qualify(view,scene){assert.equal(view,expected(),'entire player/render camera path unchanged outside exact UI/flag/cache observation additions');assert.equal(scene,expectedScene(),'only exact new opted-in variant bypasses inherited village override; every other scene byte unchanged');}
test('whole original camera/render source exact except explicit new native dispatch/UI wiring',()=>{qualify(read('src/cityView.ts'),read('src/render/cityScene.ts'));assert.equal(read('src/render/post.ts'),old('src/render/post.ts'));assert.doesNotMatch(read('src/cityView.ts'),/inspectionCamera|d086Inspection|d087Inspection|d088Inspection|d089Inspection/);});
test('D081 original classifier, legal cameras and every tolerance remain exact accepted bytes',()=>{for(const f of ['tools/d081-frame.mjs','tools/unit-d081-frame.mjs','proposals/d086/surface-contract.mjs','proposals/d086/browser-legal-surface-capture.mjs'])assert.equal(read(f),old(f));});
for(const[name,mutate]of [
 ['camera epsilon',s=>s+'\n// unseen camera mutation'],
 ['widen legal zoom',s=>s.replace('controls.maxZoom = 8','controls.maxZoom = 9')],
 ['remove old native flag',s=>s.replace('coastalRecreationOn, true, true, true, true','coastalRecreationOn, false, true, true, true')],
 ['drop old wave flag',s=>s.replace('coastalRecreationOn, true, true, true, true','coastalRecreationOn, true, true, true')],
 ['hide cache side effect',s=>s.replace('d089CacheInfo: () => britishMarketEstateCacheInfo()','d089CacheInfo: () => (sim.money++, britishMarketEstateCacheInfo())')]
])test('whole camera source rejects '+name,()=>{const s=read('src/cityView.ts'),bad=mutate(s);assert.notEqual(bad,s,'negative must execute');assert.throws(()=>qualify(bad,read('src/render/cityScene.ts')));});
test('new estate wave cannot bypass any old scene or village precedence',()=>{const s=read('src/render/cityScene.ts');for(const bad of [s.replace(' && workingRuralSlot(b.k,b.v)',''),s.replace('shape?.p?.nativeWorkingRural === true','true'),s.replace(' && marketEstateSlot(b.k,b.v)',''),s.replace('shape?.p?.nativeMarketEstates === true','true'),s.replace('marketEstateSlot(b.k,b.v)','marketEstateSlot(22,17)'),s+'\n// mutation']){assert.notEqual(bad,s);assert.throws(()=>qualify(read('src/cityView.ts'),bad));}});
