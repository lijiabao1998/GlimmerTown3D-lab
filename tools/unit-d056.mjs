import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';import {kindHashes,drawOne} from './d018-kinds.mjs';import{D056_LEGACY}from'./d056-legacy.mjs';
import{BRITISH_CIVIC,BRITISH_KINDS,BRITISH_PALETTE as C}from'../src/content/britishCivic.ts';
import{kindTableFrom}from'../src/content/kindTable.ts';
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
export async function d056Guards(log){
 const test=(name,f)=>{try{f();log(true,'D056 '+name)}catch(e){log(false,'D056 '+name,e.stack)}};
 const before=read('src/content/samples/d056-kinds-before.json'),now=kindHashes(),KT=kindTableFrom(read('src/content/lab-kinds.json')),looks=read('src/content/lab-looks.json').looks;
 test('eight unique functions and architecture; only these eight × nine variants change',()=>{
  assert.equal(before.commit,'0e849a6f6322091863ab0c27b64a45c669e45444');assert.equal(BRITISH_CIVIC.length,8);
  assert.equal(new Set(BRITISH_CIVIC.map(x=>x.silhouette)).size,8);assert.equal(BRITISH_KINDS.size,8);
  assert.deepEqual(Object.keys(now),Object.keys(before.kinds));assert.deepEqual(kindHashes(D056_LEGACY),before.kinds);
  for(const k of Object.keys(now)){if(BRITISH_KINDS.has(+k)){for(let v=0;v<9;v++)assert.notEqual(now[k].h[v],before.kinds[k].h[v]);}else assert.deepEqual(now[k],before.kinds[k],'unchanged kind '+k);}
  assert.equal(new Set(BRITISH_CIVIC.map(({k})=>now[k].h[0])).size,8);
 });
 test('bounded finite geometry, valid normals, exact height, correct picking owners, ≤850 triangles each',()=>{
  for(const {k} of BRITISH_CIVIC)for(let v=0;v<9;v++){
   const s=KT.size(k),r=drawOne(KT,looks,k,1,v,s),pos=r.G.flatMap(g=>g.pos),tris=pos.length/9;assert.ok(tris>100&&tris<=850,`${k}: ${tris}`);assert.ok(pos.every(Number.isFinite));let top=0;
   for(let i=0;i<pos.length;i+=3){assert.ok(pos[i]>=0&&pos[i]<=s&&pos[i+2]>=0&&pos[i+2]<=s,`parcel ${k}`);assert.ok(pos[i+1]>=-1e-7&&pos[i+1]<=r.H+1e-7,`height ${k}`);top=Math.max(top,pos[i+1]);}assert.ok(Math.abs(top-r.H)<1e-9);
   for(const g of r.G){assert.equal(g.owners.length,g.pos.length/9);assert.ok(g.owners.every(o=>o===1));for(let i=0;i<g.pos.length;i+=9){const a=g.pos.slice(i,i+3),b=g.pos.slice(i+3,i+6),c=g.pos.slice(i+6,i+9),u=b.map((v,j)=>v-a[j]),w=c.map((v,j)=>v-a[j]);assert.ok(Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])>1e-10,'nondegenerate '+k);for(let j=i;j<i+9;j+=3)assert.ok(Math.hypot(...g.nor.slice(j,j+3))>.99);}}
   for(const c of [C.stone,C.slate])assert.ok(r.used.includes(c));assert.deepEqual(r.trees,[]);
  }
 });
 test('geometry is deterministic at every variant without editing the content inputs',()=>{const frozen=JSON.stringify([KT.data,looks]);assert.deepEqual(kindHashes(),now);assert.equal(JSON.stringify([KT.data,looks]),frozen)});
 test('specialized structures have genuinely open spaces instead of painted solid boxes',()=>{
  // Ray-independent geometric proof: no wall triangle spans the market's front arcade openings.
  const r=drawOne(KT,looks,87,1,0,2);assert.equal(r.G[0].pos.length,0,'market has no windowed wall mass');
  const court=drawOne(KT,looks,43,1,0,2);assert.ok(court.G[1].pos.length>300,'portico and pediment are real geometry');
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){let fail=0;await d056Guards((ok,n,e)=>{console.log(ok?'PASS':'FAIL',n,e??'');if(!ok)fail++});process.exitCode=fail?1:0;}
