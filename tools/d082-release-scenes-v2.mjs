// Versioned nine-slot three-mode scene contract. No archived ten-scene receipts changed.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {TARGETS,ADDITIONAL,cityOf,isTarget,KT,civic,ownerContent,weighted,sceneSignature,sha} from './d082-redesign-support.mjs';
import {d082Blocks} from './unit-d082.mjs';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {STYLES} from '../src/render/styles.ts';
import {sceneDigest} from '../src/render/digest.ts';
function snapshot(city,mode,on){const con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,d082Blocks(city,mode),'d',civic(on),con,true);try{return{cost:weighted(built),digest:sceneDigest(built),owners:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}finally{built.dispose();con.dispose();}}
const ownerCost=(d,id)=>2*((d.meshes.walls.ownerTris[id]??0)+(d.meshes.other.ownerTris[id]??0))+(d.meshes.dress.ownerTris[id]??0);
export function d082ReleaseScenesV2(){const rows=[],covered=new Set();let targets=0;for(const force of[null,0,1,2])for(const sample of['gallery','seed516','ai120']){
 const city=cityOf(sample,force),world=sha(city),preview=force===null?'native':'v'+force,wanted=city.buildings.filter(b=>isTarget(b.k,b.v)&&b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
 for(const mode of['a','b','c']){const before=snapshot(city,mode,false),after=snapshot(city,mode,true),pin=ADDITIONAL.cities[preview][sample].modes[mode];assert.equal(before.cost,pin.weighted);assert.equal(sceneSignature(before.digest),pin.signature);assert.deepEqual(before.digest,pin.digest);assert.equal(sha(city),world);
 assert.equal(after.batches,3);assert.equal(before.batches,3);for(const k of['ground','inst','counts'])assert.deepEqual(after.digest[k],before.digest[k]);assert.deepEqual(after.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),before.meshes.filter(m=>!['walls','other','dress'].includes(m.name)));
 after.owners.forEach((a,i)=>{for(const id of new Set([...Object.keys(a),...Object.keys(before.owners[i])]))if(!ids.has(id))assert.equal(a[id],before.owners[i][id]);});for(const id of new Set([...Object.keys(after.boxes),...Object.keys(before.boxes)]))if(!ids.has(id)){assert.deepEqual(after.boxes[id],before.boxes[id]);assert.deepEqual(after.colors[id],before.colors[id]);}for(const key of['top','base','wallTop','blockOf'])after.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,before.con[key][i]);});
 let delta=0;for(const b of wanted){const key=b.k+':'+b.v,cap=TARGETS.find(t=>t.k===b.k&&t.v===b.v).cap,a=ownerCost(before.digest,b.id),n=ownerCost(after.digest,b.id);assert.equal(a,cap);assert.ok(n>=12&&n<=a);assert.ok(after.owners.some((r,i)=>r[b.id]!==before.owners[i][b.id]));delta+=n-a;targets++;covered.add(key);}
 assert.equal(after.cost,before.cost+delta);assert.ok(after.cost<=before.cost);if(!wanted.length)assert.deepEqual(after,before);rows.push({sample,force,mode,before:before.cost,after:after.cost,delta,targets:wanted.length,world});
 }}assert.equal(rows.length,36);assert.equal(targets,36);assert.equal(covered.size,9);return{passed:true,qualification:'Node raw three-mode scene regression, not actual Chromium or deployment.',rows,targets,slots:[...covered]};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(d082ReleaseScenesV2(),null,2));
