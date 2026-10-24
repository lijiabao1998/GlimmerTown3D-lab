// Local scene placement only; no saved buildings, IDs, terrain or accepted geometry is modified.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {kindTableFrom} from '../../src/content/kindTable.ts';
import {viewCode} from '../../src/io/save.ts';
import {DESIGNS} from './models.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),K=kindTableFrom(read('src/content/lab-kinds.json'));
const r=viewCode(fs.readFileSync('src/content/samples/gallery.code.txt','utf8'),K,read('src/content/samples/d009-live.json').vrank);assert.ok(r.ok);const c=r.city;
const signature=city=>JSON.stringify(city.buildings.map(b=>[b.id,b.k,b.lv,b.v,b.x,b.z,b.size]));
const candidates=[];for(let z=46;z<58;z++)for(let x=31;x<67;x++){
 let ok=true;for(let dz=-1;dz<3;dz++)for(let dx=-1;dx<3;dx++){const i=(z+dz)*c.n+x+dx;if(c.occ[i]||c.road[i]||c.ter[i]===0||c.tree[i])ok=false;}if(ok)candidates.push({x,z});
}
const selected=[];for(let i=0;i<8;i++){const aim={x:38+(i%4)*6,z:47+Math.floor(i/4)*6};const options=candidates.filter(p=>selected.every(q=>Math.abs(q.x-p.x)>=4||Math.abs(q.z-p.z)>=4)).sort((a,b)=>Math.hypot(a.x-aim.x,a.z-aim.z)-Math.hypot(b.x-aim.x,b.z-aim.z));assert.ok(options.length,'original empty grass parcels available');selected.push(options[0]);}
const heights=[.78,1.05,1.08,.72,1.8,.78,.94,.75];
const plan={qualification:'Preview-only models added on original empty gallery parcels; all original buildings, records, neighbours, terrain, lighting and camera remain. No kind/variant adoption or game budget claim.',sourceHead:'d98e3196062b3685f0e9e20cc478cb384e1e12a1',sample:'gallery',cityN:c.n,cityBuildingSignature:signature(c),sourceSampleSha256:createHash('sha256').update(fs.readFileSync('src/content/samples/gallery.code.txt')).digest('hex'),plots:selected.map((p,i)=>({...p,id:DESIGNS[i].id,name:DESIGNS[i].name,zh:DESIGNS[i].zh,size:2,H:heights[i],nearestOriginal:c.buildings.map(b=>({...b,d:Math.hypot(b.x+b.size/2-p.x-1,b.z+b.size/2-p.z-1)})).sort((a,b)=>a.d-b.d).slice(0,3).map(b=>({id:b.id,k:b.k,x:b.x,z:b.z,size:b.size,distance:b.d}))}))};
fs.writeFileSync('proposals/d083/game-preview-plan.json',JSON.stringify(plan,null,2));console.log(JSON.stringify({plots:plan.plots,unchangedOriginalBuildings:c.buildings.length},null,2));
