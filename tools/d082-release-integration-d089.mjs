// D089 finite current contract. Original tools/d082-release-integration-d088.mjs remains byte-exact at c023a2da0e4999d43e3d4216e800c4c96d06a3c1.
// D088 finite current contract. Original tools/d082-release-integration-d087.mjs remains byte-exact at cdd541da74973dba2ca73b782936c012d315add9.
// D087 finite current contract. Original tools/d082-release-integration-d086.mjs is unchanged at b4275bda73e72a9fb48343376fccaab52bbc8e84.
// Current accepted-nine integration. Historical ten assertions execute separately on their frozen tree.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './cdp.mjs';
import {createHash} from 'node:crypto';
import {drawCoastalRecreationCase,validCoastalRecreationGeometry,d082Blocks} from './unit-d082.mjs';
import {fieldStudyLodgeStructureSignature as structure} from './unit-d081.mjs';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {STYLES} from '../src/render/styles.ts';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {MODELS,COASTAL_RECREATION_KINDS} from '../src/content/britishCoastalRecreation.ts';
import {shapeOf,kindColors} from '../src/content/kindShapes.ts';
import {Geo} from '../src/render/scene.ts';
import {Pen} from '../src/render/kindArt.ts';
import {drawBritishCoastalRecreation} from '../src/render/britishCoastalRecreationArt.ts';
import {TARGETS,LEGACY,ADDITIONAL,civic as d082Civic,cityOf as d082City,legacySlot,isTarget,KT,drawCase,caseSignature,caseBytes,assertCase,sha} from './d082-redesign-support.mjs';
import {d082ScopeGuards} from './unit-d082-scope.mjs';
const D082_SLOTS=TARGETS.map(t=>[t.k,t.v]),D082_KINDS=[179,185,154],D082_KT=KT,BASE=LEGACY,oldFlags=Array(17).fill(true);
const geoBytes=caseBytes,geoSig=caseSignature,isCoastalRecreation=isTarget;
const frozen=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(frozen);Object.freeze(o);}return o;};
const D082_CAP=Object.fromEntries(TARGETS.map(t=>[t.k+':'+t.v,t.cap]));
const assertCoastalRecreationBudget=r=>{assert.ok(r.cost>=12&&r.cost<=D082_CAP[r.k+':'+r.v]);return r.cost;};
function d082CoastalCity(city,v=null){assert.ok(v===null||v===0||v===1||v===2);return v===null?city:{...city,buildings:city.buildings.map(b=>isTarget(b.k,v)?{...b,v}:b)};}
export async function d082ReleaseIntegrationV2(log=()=>{}){
 const sourceFiles=['src/content/britishCoastalRecreation.ts','src/render/britishCoastalRecreationArt.ts','src/render/d082RemainingGeometryData.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/cityView.ts'],fileHash=f=>createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex'),sourcePins=Object.fromEntries(sourceFiles.map(f=>[f,fileHash(f)]));
 let failed=0;const report={schema:2,sourcePins,passed:false,tests:[],geometryCases:0,preservedCases:0,negativeControls:0,costs:{}};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack});log(false,name,e.stack);}};
 test('all historical flag combinations keep nine-family flag default off',()=>{for(let mask=0;mask<131072;mask++){const flags=Array.from({length:17},(_,i)=>Boolean(mask&(1<<i)));for(const k of D082_KINDS)assert.deepEqual(shapeOf(k,...flags),shapeOf(k,...flags,false));}});
 test('nine explicit accepted slots retain original dimensions and ceilings',()=>{
  assert.deepEqual(MODELS.map(({k,v,H,size,cap})=>({k,v,H,size,cap})),TARGETS);assert.deepEqual([...COASTAL_RECREATION_KINDS],[179,185,154]);
  for(const t of TARGETS){assert.deepEqual([KT.height(t.k,1,t.v),KT.size(t.k)],[t.H,t.size]);const old=drawCase(t.k,{v:t.v,on:false}),pin=legacySlot(t.k,t.v);assert.equal(caseBytes(old),pin.float64Sha256);assert.equal(caseSignature(old),pin.sha256);assert.equal(old.cost,t.cap);}
 });
 test('all 130 published exact models preserve every binary attribute',()=>{
  assert.equal(Object.keys(LEGACY.priorModels).length,130);
  for(const[key,pin]of Object.entries(LEGACY.priorModels)){const[k,v]=key.split(':').map(Number),r=drawCase(k,{v});assert.equal(caseBytes(r),pin.float64Sha256);assert.equal(caseSignature(r),pin.sha256);assert.equal(r.cost,pin.cost);}
 });
 test('all actual non-target kinds levels variants sizes preserve legacy geometry',()=>{
  let expected=0;for(const k of [0,...KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,KT.size(k)])){
   if([179,185,154].includes(k)&&[0,1,2].includes(v))continue;expected++;
   const old=drawCase(k,{lv,v,s,on:false}),now=drawCase(k,{lv,v,s});assert.equal(caseBytes(now),caseBytes(old),`non-target ${k}/${lv}/${v}/${s}`);assert.equal(caseSignature(now),caseSignature(old));report.preservedCases++;
  }assert.equal(report.preservedCases,expected);
 });
 test('strict direct dispatch rejects unsupported values without mutation',()=>{
  for(const k of [0,126,179,185,154,160,182,72,999,'179',null,undefined])for(const v of [undefined,null,-1,0,1,2,3,4,8,9,.5,'0','1','2',true,false,NaN,Infinity]){
   const G=[new Geo({ext:true}),new Geo(),new Geo()],a={W:G[0],O:G[1],D:G[2],trees:[],x0:0,z0:0,y0:0,s:1,H:1,k,v,C:kindColors({},k,1,'#ffffff')},before=sha(a),accept=isTarget(k,v);
   assert.equal(drawBritishCoastalRecreation(new Pen(a)),accept);if(accept)assert.ok(G.some(g=>g.pos.length));else{assert.equal(sha(a),before);report.negativeControls++;}
  }
 });
 test('caller window state and scalar inputs are retained for all nine models',()=>{
  for(const t of TARGETS){const G=[new Geo({ext:true}),new Geo(),new Geo()],a={W:G[0],O:G[1],D:G[2],trees:[],x0:-3.125,z0:7.375,y0:.21,s:2,H:.71,k:t.k,v:t.v,C:{}};G[0].style=7;G[0].glass=new THREE.Color('#315579');G[0].band=.31;const state=[G[0].style,G[0].glass,G[0].band],input=sha([a.x0,a.z0,a.y0,a.s,a.H,a.k,a.v,a.C]);assert.equal(drawBritishCoastalRecreation(new Pen(a)),true);assert.deepEqual([G[0].style,G[0].glass,G[0].band],state);assert.equal(sha([a.x0,a.z0,a.y0,a.s,a.H,a.k,a.v,a.C]),input);}
 });
 test('current geometry remains finite bounded normalized and under original budgets over324 affine cases',()=>{
  for(const t of TARGETS)for(const lv of[1,2,3])for(const s of[1,4])for(const H of[.12,t.H,t.H*1.7])for(const origin of[{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}]){const r=drawCase(t.k,{v:t.v,lv,s,H,...origin});assertCase(r);report.geometryCases++;}assert.equal(report.geometryCases,324);
 });
 report.affineCasesBeforeExtended=report.geometryCases;
 test('all exact-slot levels/heights/sizes/origins/quarter-turns preserve finite deterministic bounded geometry and strict budgets',()=>{
  for(const [k,v]of D082_SLOTS){let min=Infinity,max=0;const key=k+':'+v;for(const lv of [1,2,3])for(const s of new Set([1,D082_KT.size(k),4]))for(const H of new Set([.12,Math.max(.12,D082_KT.height(k,lv,v)),Math.max(.24,D082_KT.height(k,lv,v)*1.7)]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const options={v,lv,s,H,...origin,turn},r=drawCoastalRecreationCase(k,options),again=drawCoastalRecreationCase(k,options),old=drawCoastalRecreationCase(k,{...options,on:false});validCoastalRecreationGeometry(r);assertCoastalRecreationBudget(r);assert.equal(geoBytes(r),geoBytes(again),'byte-identical deterministic repeat');assert.notEqual(geoSig(r),geoSig(old),'each approved exact slot changes actual geometry');
   assert.deepEqual(r.trees,old.trees,'all ordered existing trees preserved');assert.equal(old.cost,D082_CAP[key],'strict immediate D081 weighted ceiling');
   assert.ok(r.cost>=12,'positive multi-face building floor within the immutable exact-slot cap');assert.ok(r.cost<=old.cost,`${key}: ${r.cost} <= ${old.cost}`);assert.equal(structure(r),structure(drawCoastalRecreationCase(k,{...options,turn:0})),'four rigid orientations preserve structural identity');assert.equal(structure(r),structure(drawCoastalRecreationCase(k,{v,s:1,H:1,x0:0,z0:0,y0:0})),'origin, parcel and inherited height are pure independent transforms');min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
  }report.costs[key]={name:D082_KT.name(k),min,max,cap:D082_CAP[key]};}
 });
 test('all 130 prior models and nine current W/O architectures remain distinct',()=>{for(const architectureOnly of [false,true]){const signatures=new Map();for(const key of [...Object.keys(BASE.priorModels),...D082_SLOTS.map(s=>s.join(':'))]){const[k,v]=key.split(':').map(Number),id=structure(drawCoastalRecreationCase(k,{v,s:1}),{architectureOnly});assert.ok(!signatures.has(id),key+' duplicates '+signatures.get(id));signatures.set(id,key);}assert.equal(signatures.size,139);}});
 test('all 21840 prior ordered tree transforms and 4000 target transforms remain exact',()=>{
  for(const field of ['treeCases','targetTreeCases']){let count=0;for(const [key,expected]of Object.entries(BASE[field])){const[k,v,s,H,x0,z0,y0,turn]=JSON.parse(key);assert.deepEqual(drawCoastalRecreationCase(k,{v,s,H,x0,z0,y0,turn}).trees,expected,key);count++;}assert.equal(count,field==='treeCases'?21840:4000);report[field]=count;}
  for(const k of [54,47])for(const mutate of [r=>r.trees.reverse(),r=>r.trees.pop(),r=>r.trees.push({...r.trees[0]}),r=>r.trees[0].x+=.01,r=>r.trees[0].z+=.01,r=>r.trees[0].y+=.01,r=>r.trees[0].s+=.01]){const r=drawCoastalRecreationCase(k,{v:0,s:1,H:.35,x0:0,z0:0,y0:0});mutate(r);assert.throws(()=>assert.deepEqual(r.trees,BASE.treeCases[JSON.stringify([k,0,1,.35,0,0,0,0])])) ;}
 });
 test('copied previews change only supported slots and preserve original world and unsupported records',()=>{
  for(const invalid of [-1,3,4,.5,'0','1','2',true,false,NaN,Infinity])assert.throws(()=>d082CoastalCity({buildings:[]},invalid));
  for(const sample of ['gallery','seed516','ai120']){const city=d082City(sample),before=sha(city);assert.equal(d082CoastalCity(city,null),city,'native preview is the original object');for(const variant of [0,1,2]){const copy=d082CoastalCity(city,variant);assert.notEqual(copy,city);assert.notEqual(copy.buildings,city.buildings);assert.equal(sha(city),before);for(const key of Object.keys(city))if(key!=='buildings')assert.equal(copy[key],city[key],'all other world/history fields shared unchanged');for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],v=copy.buildings[i];if(isCoastalRecreation(b.k,variant)){assert.notEqual(v,b);assert.equal(v.v,variant);assert.deepEqual({...v,v:b.v},b);}else assert.equal(v,b,'unsupported requested slots keep the original building record');}}}
 });
 test('actual production coastalRecreation preview and hook retain unsupported slots and reject coercion',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),expression=view.match(/const coastalView = \(c: City\): City => ([^\n]+);/);assert.ok(expression,'production copied-view expression is exposed');
  const preview=Function('c','coastalForcedV','COASTAL_RECREATION_BUILDINGS','return '+expression[1].replaceAll('coastalForcedV!','coastalForcedV'));
  const records=[];for(const k of [0,...D082_KINDS,135,28,32,65,999,'164','119','116','149','81'])for(const v of [0,1,2,3,4,7])records.push({id:records.length+1,k,v,size:2,x:4,z:6,history:[{day:3,kind:'placed'}]});
  const world=frozen({buildings:records,history:[{day:3,kind:'snapshot'}],day:9,seed:516}),before=sha(world);
  for(const v of [null,0,1,2]){const actual=preview(world,v,MODELS),expected=d082CoastalCity(world,v);assert.deepEqual(actual,expected,'real production expression matches independent exact-slot selection');assert.equal(actual.history,world.history);assert.equal(sha(world),before);if(v===null){assert.equal(actual,world);continue;}assert.notEqual(actual,world);assert.notEqual(actual.buildings,world.buildings);for(let i=0;i<records.length;i++){const b=records[i],copy=actual.buildings[i];if(isCoastalRecreation(b.k,v)){assert.notEqual(copy,b);assert.deepEqual(copy,{...b,v});assert.equal(copy.history,b.history);}else assert.equal(copy,b,'unsupported requested variant leaves the exact original record unchanged');}}
  const method=view.match(/coastalV\(v: number \| null\) \{ ([^\n]+) \},/);assert.ok(method,'production public hook is exposed');
  const hook=Function('let coastalForcedV=null,needsRender=false,rebuilds=0,draws=0;const rebuildScene=fresh=>{if(fresh!==true)throw new Error("preview must rebuild fresh");rebuilds++;};const draw=()=>draws++;return {call(v){'+method[1]+'},state(){return {coastalForcedV,needsRender,rebuilds,draws};}};')();
  for(const v of [0,1,2,null]){const was=hook.state();assert.equal(hook.call(v),v);assert.deepEqual(hook.state(),{coastalForcedV:v,needsRender:true,rebuilds:was.rebuilds+1,draws:was.draws+1});}
  for(const v of [undefined,-1,3,4,5,.5,'0','1','2','3','4',true,false,NaN,Infinity]){const was=hook.state();assert.throws(()=>hook.call(v),/supports saved variants/);assert.deepEqual(hook.state(),was,'invalid request cannot update preview state or rebuild');if(v===undefined)assert.equal(d082CoastalCity(world,v),world,'omitted helper variant means native');else assert.throws(()=>d082CoastalCity(world,v),'independent copied preview rejects invalid input');}
 });
 test('every exact-slot production-batched model has real faces that pick its owning building',()=>{
  const source=d082City('gallery'),before=sha(source),covered=new Set();let picks=0;
  for(const variant of [0,1,2])for(const mode of ['a','b','c']){const city=d082CoastalCity(source,variant),con=new ConState(city.n),built=buildCityScene(city,D082_KT,STYLES.A,d082Blocks(city,mode),'d',d082Civic(true),con,true);
   try{const wanted=city.buildings.filter(b=>isCoastalRecreation(b.k,b.v)&&b.goneDay===undefined),ids=new Set(wanted.map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
    for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
    }for(const b of wanted){assert.ok([...seen].some(key=>key.startsWith(b.id+':')),`mode ${mode}: k${b.k} v${b.v} owner${b.id} is pickable`);covered.add(b.k+':'+b.v);}
   }finally{built.dispose();con.dispose();}
  }assert.ok(picks>=27,'at least one actual hit for each supported forced-gallery target in all three modes');assert.equal(covered.size,9);assert.equal(sha(source),before);
 });
 test('twenty-four legacy switches disable only coastal art and production applies the copied preview',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),match=view.match(/const coastalRecreationOn = ([^;]+);/);assert.ok(match);const flags=['coastalArt','fieldStudyArt','communityArt','transitUtilityArt','neighbourhoodArt','serviceLodgeArt','healthResponseArt','farmMemorialArt','emergencyHotelArt','campusArt','educationArt','commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],evaluate=Function('q','return '+match[1]);assert.deepEqual([...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]),flags);assert.equal(evaluate(new URLSearchParams()),true);for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false);assert.equal(evaluate(new URLSearchParams(flag+'=other')),true);}assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true);
  for(const line of view.split('\n').filter(line=>/const (?:towerOn|metropolisOn|landmarkOn|facilityOn|commerceVariantOn|commerceThirdOn|educationOn|campusOn|emergencyHotelOn|farmMemorialOn|healthResponseOn|serviceLodgeOn|fieldStudyLodgeOn|communityBuildingOn)/.test(line)))assert.ok(!line.includes('coastalArt'),'new switch does not disable previous art');assert.match(view,/fieldStudyLodgeOn, coastalRecreationOn, true, true, true, true\)/);assert.match(view,/buildCityScene\(coastalView\(fieldStudyView\(/);
 });
 test('additional published154v1/v2 ordered tree transforms remain exact',()=>{let count=0;for(const[key,expected]of Object.entries(ADDITIONAL.targetTreeCases)){const[k,v,s,H,x0,z0,y0,turn]=JSON.parse(key);assert.deepEqual(drawCoastalRecreationCase(k,{v,s,H,x0,z0,y0,turn}).trees,expected);count++;}assert.equal(count,800);report.additionalTreeCases=count;});
 test('accepted-nine arenas retain W/O architecture and no rejected-ten water patch',()=>{for(const t of TARGETS){const r=drawCase(t.k,{v:t.v});assert.ok(r.G[0].owners.length&&r.G[1].owners.length);assert.equal(r.G[2].owners.length,0,'accepted-nine numerical plans have no dress/water triangles');}});
 test('current geometry and original caps reject independent corruptions',()=>{for(const t of TARGETS){for(const mutate of[r=>r.G[0].pos[0]=NaN,r=>r.G[0].owners[0]=0,r=>r.G[0].uv.pop(),r=>r.G[0].nor[0]=NaN,r=>r.G[0].pos[1]=r.y0+r.H+1,r=>r.trees.push({x:0,z:0,y:0,s:1}),r=>r.cost=t.cap+1]){const r=drawCase(t.k,{v:t.v});mutate(r);assert.throws(()=>assertCase(r));report.negativeControls++;}}});
 test('exact versioned source accounting and every original source corruption control',()=>{report.scope=d082ScopeGuards();assert.equal(report.scope.passed,true);});
 test('immutable historical fixtures and actual tested sources remain unchanged throughout run',()=>{const history=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/d082-history-before.json'),'utf8'));for(const[f,pin]of Object.entries(history.fixtures))assert.equal(fileHash(f),pin);for(const[f,pin]of Object.entries(sourcePins))assert.equal(fileHash(f),pin);});
 report.passed=failed===0;report.qualification='Current nine integration, not final geometry visibility, actual browser, CI or release acceptance.';return{failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const r=await d082ReleaseIntegrationV2();console.log(JSON.stringify(r,null,2));process.exitCode=r.failed?1:0;}
