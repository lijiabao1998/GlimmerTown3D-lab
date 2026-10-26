import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const read=f=>fs.readFileSync(f,'utf8'),old=f=>execFileSync('git',['show','b4275bda73e72a9fb48343376fccaab52bbc8e84:'+f],{encoding:'utf8'});
const viewDeltas=[
 ["import { civicMarketCacheInfo } from './render/britishCivicMarketModels.mjs';","import { civicMarketCacheInfo } from './render/britishCivicMarketModels.mjs';\nimport { workingRuralCacheInfo } from './render/britishWorkingRuralModels.mjs';"],
 ['    d086CacheInfo: () => civicMarketCacheInfo(),','    d086CacheInfo: () => civicMarketCacheInfo(),\n    d087CacheInfo: () => workingRuralCacheInfo(),'],
 ["import { HERITAGE_TOOLS, NATIVE_ART_TOOLS } from './sim/edit.ts';","import { HERITAGE_TOOLS, NATIVE_ART_TOOLS, WORKING_RURAL_TOOLS } from './sim/edit.ts';"],
 ['fieldStudyLodgeOn, coastalRecreationOn, true), colors:','fieldStudyLodgeOn, coastalRecreationOn, true, true), colors:'],
 ["tool === 'food' ? FOOD_TOOLS : NATIVE_ART_TOOLS.some","tool === 'food' ? FOOD_TOOLS : WORKING_RURAL_TOOLS.some(c => c.id === civicTool) ? WORKING_RURAL_TOOLS : NATIVE_ART_TOOLS.some"],
 ['[...CIVIC_TOOLS, ...HERITAGE_TOOLS, ...NATIVE_ART_TOOLS].some','[...CIVIC_TOOLS, ...HERITAGE_TOOLS, ...NATIVE_ART_TOOLS, ...WORKING_RURAL_TOOLS].some']
];
const sceneDeltas=[
 ["import * as THREE from 'three';","import * as THREE from 'three';\n// D087-BEGIN exact-working-rural-precedence\nimport { workingRuralSlot } from '../content/britishWorkingRural.ts';\n// D087-END exact-working-rural-precedence"],
 ['const village = blocks?.villageArt && blocks.detail ? villageKind(b.k) : null;','const village = blocks?.villageArt && blocks.detail && !(shape?.p?.nativeWorkingRural === true && workingRuralSlot(b.k,b.v)) ? villageKind(b.k) : null;']
];
function expected(file,deltas){let s=old(file);for(const[a,b]of deltas){assert.equal(s.split(a).length,2,'one finite native integration seam');s=s.replace(a,b);}return s;}
function qualify(view,scene){assert.equal(view,expected('src/cityView.ts',viewDeltas),'entire player/render camera path unchanged outside exact UI/flag additions');assert.equal(scene,expected('src/render/cityScene.ts',sceneDeltas),'exact new-slot precedence only, original renderer unchanged');}
test('whole original camera/render source exact except explicit new native dispatch/UI wiring',()=>{qualify(read('src/cityView.ts'),read('src/render/cityScene.ts'));assert.equal(read('src/render/post.ts'),old('src/render/post.ts'));assert.doesNotMatch(read('src/cityView.ts'),/inspectionCamera|d086Inspection|d087Inspection/);});
test('D081 original classifier, legal cameras and every tolerance remain exact accepted bytes',()=>{for(const f of ['tools/d081-frame.mjs','tools/unit-d081-frame.mjs','proposals/d086/surface-contract.mjs','proposals/d086/browser-legal-surface-capture.mjs'])assert.equal(read(f),old(f));});
for(const[name,mutate]of [
 ['camera epsilon',s=>s+'\n// unseen camera mutation'],
 ['widen legal zoom',s=>s.replace('controls.maxZoom = 8','controls.maxZoom = 9')],
 ['remove old native flag',s=>s.replace('coastalRecreationOn, true, true','coastalRecreationOn, false, true')]
])test('whole camera source rejects '+name,()=>{const s=read('src/cityView.ts'),bad=mutate(s);assert.notEqual(bad,s,'negative must execute');assert.throws(()=>qualify(bad,read('src/render/cityScene.ts')));});
test('new farm precedence cannot hide any old variant or bypass village flag',()=>{const s=read('src/render/cityScene.ts');for(const bad of [s.replace(' && workingRuralSlot(b.k,b.v)',''),s.replace('shape?.p?.nativeWorkingRural === true','true'),s+'\n// mutation']){assert.notEqual(bad,s);assert.throws(()=>qualify(read('src/cityView.ts'),bad));}});
