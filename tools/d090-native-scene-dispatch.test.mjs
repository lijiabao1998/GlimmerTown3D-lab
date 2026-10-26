// Actual scene-versus-drawKind complete Uint32-word proof. This is not a
// classifier/count threshold; every attribute, owner, material arena and order
// is compared, including construction attributes and signed-zero words.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {KINDS} from '../src/content/kinds.ts';
import {shapeOf,kindColors} from '../src/content/kindShapes.ts';
import {UTILITY_HERITAGE_BUILDINGS as MODELS} from '../src/content/britishUtilityHeritage.ts';
import {viewCode} from '../src/io/save.ts';
import {encodeLabCode} from '../src/io/labcode.ts';
import {Geo} from '../src/render/scene.ts';
import {drawKind} from '../src/render/kindArt.ts';
import {buildCityScene,tileTop} from '../src/render/cityScene.ts';
import {ConState,conAttrRect} from '../src/render/construction.ts';
import {STYLES} from '../src/render/styles.ts';
const BASE='5b41bac165ba2b29146e6835490357bebc3cd549';
const scenePath='src/render/cityScene.ts',sceneURL=new URL('../'+scenePath,import.meta.url),source=fs.readFileSync(sceneURL,'utf8');
const original=execFileSync('git',['show',BASE+':'+scenePath],{encoding:'utf8'});
const LOOKS=JSON.parse(fs.readFileSync(new URL('../src/content/lab-looks.json',import.meta.url),'utf8')).looks;
const vrank=JSON.parse(fs.readFileSync(new URL('../src/content/samples/d009-live.json',import.meta.url),'utf8')).vrank;
const colors=(k,lv)=>kindColors(LOOKS,k,lv,KINDS.catColor(KINDS.cat(k)));
const civic=native=>({shape:k=>shapeOf(k,...Array(22).fill(true),native),colors});
const blocks={mode:'c',villageArt:true,detail:true,plan:[],recipe(){throw Error('no RCI blocks');}};
const words=a=>Uint32Array.from(new Uint32Array(a.buffer,a.byteOffset,a.byteLength/4));
function fixture(k,v,{x=3,z=4,terrain=2}={}){
 const n=16,raw={v:1,n,seed:20261090,day:40,money:30000,nm:'D090 native route proof',df:1,ter:String(terrain).repeat(n*n),tre:'0'.repeat(n*n),bl:[[z*n+x,k,1,v,40]]};
 const r=viewCode(encodeLabCode(raw,{deflate:true}),KINDS,vrank);assert.ok(r.ok,r.error);assert.equal(r.city.buildings.length,1);assert.equal(r.city.buildings[0].v,v);return r.city;
}
function record(build,city,native=true,selectedOwner=city.buildings[0].id){
 const before=JSON.stringify(city),con=new ConState(city.n),built=build(city,KINDS,STYLES.A,blocks,'d',civic(native),con,true);
 try{
  const owner=selectedOwner,owners=built.pickOwners();assert.ok([2,3].includes(built.buildingMeshes().length));const renderedOwners=new Set();for(const[mi,mesh]of built.buildingMeshes().entries()){const g=mesh.geometry;for(let t=g.drawRange.start/3;t<(g.drawRange.start+g.drawRange.count)/3;t++)renderedOwners.add(owners[mi][t]);}assert.equal(built.owners(),renderedOwners.size,'actual reported owners match active geometry, including historically empty unknown heritage slots');
  const arenas=built.buildingMeshes().map((mesh,mi)=>{
   const geometry=mesh.geometry,start=geometry.drawRange.start/3,end=(geometry.drawRange.start+geometry.drawRange.count)/3;
   assert.ok(Number.isInteger(start)&&Number.isInteger(end));const triangles=[];
   for(let t=start;t<end;t++){assert.ok(city.buildings.some(b=>b.id===owners[mi][t]),'no missing/unknown scene owner');if(owners[mi][t]===owner)triangles.push(t);}
   const attributes=Object.fromEntries(Object.entries(geometry.attributes).map(([key,a])=>{const w=new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.byteLength/4),out=[];for(const t of triangles)for(let i=t*3*a.itemSize;i<(t+1)*3*a.itemSize;i++)out.push(w[i]);return[key,{itemSize:a.itemSize,words:Uint32Array.from(out)}];}));
   return{materialArena:['W','O','D'][mi],activeMesh:true,triangles:triangles.length,ownerWords:words(Int32Array.from(triangles,t=>owners[mi][t])),attributes};
  });if(arenas.length===2)arenas.push({materialArena:'D',activeMesh:false,triangles:0,ownerWords:new Uint32Array(0),attributes:Object.fromEntries([['position',3],['normal',3],['uv',2],['color',3],['aCon',3]].map(([key,itemSize])=>[key,{itemSize,words:new Uint32Array(0)}]))});assert.equal(JSON.stringify(city),before,'scene is read-only');return arenas;
 }finally{built.dispose();con.dispose();}
}
function direct(city,native=true){
 const b=city.buildings[0],G=[new Geo({ext:true}),new Geo(),new Geo()];G.forEach(g=>g.owner=b.id);const y0=tileTop(city,b.z*city.n+b.x),top=new Map(),wall=new Map();
 drawKind({W:G[0],O:G[1],D:G[2],trees:[],x0:b.x,z0:b.z,y0,s:b.size,H:Math.max(.12,KINDS.height(b.k,b.lv,b.v)),k:b.k,v:b.v,C:colors(b.k,b.lv)},civic(native).shape(b.k));
 return G.map((g,mi)=>{const entries=[['position',g.pos,3],['normal',g.nor,3],['uv',g.uv,2],['color',g.col,3],...(mi===0?[['wStyle',g.wst,1],['wGlass',g.wgl,3],['wBand',g.wbd,1]]:[]),['aCon',conAttrRect(g.pos,g.nor,g.tags,[b.x,b.z,b.x+b.size,b.z+b.size],city.n,top,wall),3]];
  return{materialArena:['W','O','D'][mi],activeMesh:mi<2||g.owners.length>0,triangles:g.owners.length,ownerWords:words(Int32Array.from(g.owners)),attributes:Object.fromEntries(entries.map(([key,a,itemSize])=>[key,{itemSize,words:words(Float32Array.from(a))}]))};
 });
}
// Execute actual published scene source against the same current dependencies
// and fixtures. This isolates routing behavior without inventing a classifier.
async function sceneFunction(text){
 const deps={},js=stripTypeScriptTypes(text),matches=[...js.matchAll(/^import\s+([\s\S]*?)\s+from\s+'([^']+)';/gm)];
 for(const[,binding,spec]of matches){const mod=await import(spec.startsWith('.')?new URL(spec,sceneURL):spec);if(binding.startsWith('* as '))deps[binding.slice(5).trim()]=mod;else for(const name of binding.replace(/^\{|\}$/g,'').split(',')){const[from,to=from]=name.trim().split(/\s+as\s+/);if(from)deps[to]=mod[from];}}
 const body=js.replace(/^import\s+[\s\S]*?\s+from\s+'[^']+';/gm,'').replace(/^export /gm,'');return Function(...Object.keys(deps),body+'\nreturn buildCityScene;')(...Object.values(deps));
}
function sameWords(a,b,label){assert.equal(a.length,b.length,label+' length');for(let i=0;i<a.length;i++)assert.equal(a[i],b[i],label+' word '+i);}
function assertRecords(actual,expected){
 assert.equal(actual.length,expected.length);
 for(let i=0;i<actual.length;i++){const a=actual[i],e=expected[i];assert.equal(a.materialArena,e.materialArena);assert.equal(a.activeMesh,e.activeMesh);assert.equal(a.triangles,e.triangles,a.materialArena+' triangles');sameWords(a.ownerWords,e.ownerWords,a.materialArena+' owners');assert.deepEqual(Object.keys(a.attributes).sort(),Object.keys(e.attributes).sort());for(const key of Object.keys(e.attributes)){assert.equal(a.attributes[key].itemSize,e.attributes[key].itemSize);sameWords(a.attributes[key].words,e.attributes[key].words,a.materialArena+'.'+key);}}
}
const priorBuild=await sceneFunction(original);
for(const m of MODELS)test(m.id+': actual production scene equals complete direct native model in every typed word',()=>{
 for(const site of[{x:3,z:4,terrain:2},{x:7,z:5,terrain:3}]){const city=fixture(m.k,m.v,site);assertRecords(record(buildCityScene,city),direct(city));}
});
test('disabled cemetery preserves exact published village output and is not falsely reported as native',()=>{
 const city=fixture(16,5),actual=record(buildCityScene,city,false);assertRecords(actual,record(priorBuild,city,false));assert.throws(()=>assertRecords(actual,direct(city,true)));
});
test('old16:0/4, D087/D089 farms, unsupported slots and other kinds preserve published scene words with either new flag',()=>{
 for(const[k,v]of[[16,0],[16,4],[16,6],[16,99],[66,5],[22,16],[22,17],[100,5],[10,7],[27,5],[188,0],[188,2],[190,0],[192,0],[6,5],[14,6]])for(const native of[false,true]){
  const city=fixture(k,v);assertRecords(record(buildCityScene,city,native),record(priorBuild,city,native),k+':'+v+' native='+native);
 }
});
test('missing exception, broad kind/slot bypass and disabled-flag bypass are killed by real scene geometry',async()=>{
 const clause=' && !(shape?.p?.nativeUtilityHeritage === true && utilityHeritageSlot(b.k,b.v))';assert.equal(source.split(clause).length,2);
 const missing=await sceneFunction(source.replace(clause,'')),city=fixture(16,5);assert.throws(()=>assertRecords(record(missing,city),direct(city)));
 const broad=await sceneFunction(source.replace('utilityHeritageSlot(b.k,b.v)) ? villageKind','true) ? villageKind'));assert.throws(()=>assertRecords(record(broad,fixture(16,0)),record(priorBuild,fixture(16,0))));
 const noFlag=await sceneFunction(source.replace('shape?.p?.nativeUtilityHeritage === true && utilityHeritageSlot(b.k,b.v)','utilityHeritageSlot(b.k,b.v)'));assert.throws(()=>assertRecords(record(noFlag,city,false),record(priorBuild,city,false)));
 const wrongSlot=await sceneFunction(source.replace('utilityHeritageSlot(b.k,b.v)) ? villageKind','utilityHeritageSlot(b.k,0)) ? villageKind'));assert.throws(()=>assertRecords(record(wrongSlot,city),direct(city)));
});
test('unchanged triangle counts cannot hide a one-bit attribute/owner corruption or material-arena change',()=>{
 const city=fixture(16,5),actual=record(buildCityScene,city),expected=direct(city);assertRecords(actual,expected);let checked=0;
 for(let i=0;i<actual.length;i++){
  for(const[key,a]of Object.entries(actual[i].attributes))if(a.words.length){const bad=structuredClone(actual);bad[i].attributes[key].words[a.words.length-1]^=1;assert.throws(()=>assertRecords(bad,expected));checked++;}
  if(actual[i].ownerWords.length){const bad=structuredClone(actual);bad[i].ownerWords[0]^=1;assert.throws(()=>assertRecords(bad,expected));checked++;}
 }
 const wrongArena=structuredClone(actual);wrongArena[1].materialArena='W';assert.throws(()=>assertRecords(wrongArena,expected));assert.ok(checked>=6);
});

test('all23 generic old water/sewage/cemetery/fire/library slots preserve every production scene word',()=>{
 const slots=[[10,5],[27,3],[16,5],[6,5],[14,5]].flatMap(([k,n])=>Array.from({length:n},(_,v)=>[k,v]));assert.equal(slots.length,23);
 for(const[k,v]of slots)for(const enabled of[false,true]){const city=fixture(k,v);assertRecords(record(buildCityScene,city,enabled),record(priorBuild,city,enabled));}
});
test('mixed cemetery/D087 farm/D089 longhouse and generic old owners retain exact owner words under one-clause mutants',async()=>{
 const n=24,raw={v:1,n,seed:20261090,day:40,money:30000,nm:'D090 mixed exact owners',df:1,ter:'2'.repeat(n*n),tre:'0'.repeat(n*n),bl:[[3*n+3,16,1,5,40],[3*n+8,22,1,16,40],[3*n+13,22,1,17,40],[9*n+3,16,1,0,40],[9*n+8,66,1,0,40],[9*n+13,10,1,4,40],[15*n+3,27,1,2,40],[15*n+8,6,1,5,40],[15*n+13,14,1,6,40]]};
 const r=viewCode(encodeLabCode(raw,{deflate:true}),KINDS,vrank);assert.ok(r.ok);const city=r.city;assert.equal(city.buildings.length,9);
 for(const[clause,k,v]of[
  [' && !(shape?.p?.nativeUtilityHeritage === true && utilityHeritageSlot(b.k,b.v))',16,5],
  [' && !(shape?.p?.nativeWorkingRural === true && workingRuralSlot(b.k,b.v))',22,16],
  [' && !(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v))',22,17],
 ]){assert.equal(source.split(clause).length,2);const mutated=await sceneFunction(source.replace(clause,''));let changed=0;
  for(const b of city.buildings){const a=record(buildCityScene,city,true,b.id),bad=record(mutated,city,true,b.id);if(b.k===k&&b.v===v){assert.throws(()=>assertRecords(bad,a));changed++;}else assertRecords(bad,a);}
  assert.equal(changed,1,'only the intended exact native owner changes');
 }
});
