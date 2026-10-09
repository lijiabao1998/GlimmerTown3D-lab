import * as THREE from 'three';
import {drawKind} from '../src/render/kindArt.ts';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';import {kindHashes,drawOne} from './d018-kinds.mjs';import{D056_LEGACY}from'./d056-legacy.mjs';
import{BRITISH_CIVIC,BRITISH_NATIVE_KINDS,BRITISH_KINDS,BRITISH_PALETTE as C}from'../src/content/britishCivic.ts';
import{kindTableFrom}from'../src/content/kindTable.ts';
function clearOpening(r,s,u,front,back,y){
 const ray=new THREE.Raycaster(new THREE.Vector3(u*s,y*r.H,front*s),new THREE.Vector3(0,0,-1),0,(front-back)*s);
 return r.G.every(g=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(g.pos,3));const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});const mesh=new THREE.Mesh(geo,material);mesh.updateMatrixWorld();const clear=ray.intersectObject(mesh).length===0;geo.dispose();material.dispose();return clear;});
}
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
export async function d056Guards(log){
 const test=(name,f)=>{try{f();log(true,'D056 '+name)}catch(e){log(false,'D056 '+name,e.stack)}};
 const before=read('src/content/samples/d056-kinds-before.json'),now=kindHashes(),KT=kindTableFrom(read('src/content/lab-kinds.json')),looks=read('src/content/lab-looks.json').looks;
 test('eight native and three bonus architectures; only these eleven × nine variants change',()=>{
  assert.equal(before.commit,'0e849a6f6322091863ab0c27b64a45c669e45444');assert.equal(BRITISH_CIVIC.length,11);assert.equal(BRITISH_NATIVE_KINDS.size,8);
  assert.equal(new Set(BRITISH_CIVIC.map(x=>x.silhouette)).size,11);assert.equal(BRITISH_KINDS.size,11);
  assert.deepEqual(Object.keys(now),Object.keys(before.kinds));assert.deepEqual(kindHashes(D056_LEGACY),before.kinds);
  for(const k of Object.keys(now)){if(BRITISH_KINDS.has(+k)){for(let v=0;v<9;v++)assert.notEqual(now[k].h[v],before.kinds[k].h[v]);}else assert.deepEqual(now[k],before.kinds[k],'unchanged kind '+k);}
  assert.equal(new Set(BRITISH_CIVIC.map(({k})=>now[k].h[0])).size,11);
 });
 test('complete candidate geometry golden and independent position/color mutations for every revised kind',()=>{
  const golden=read('src/content/samples/d056-current-art.json').kinds;
  for(const {k} of BRITISH_CIVIC)assert.deepEqual(now[k],golden[k],'current geometry '+k);
  for(const field of ['pos','col']){
   const mutated=kindHashes({},(ctx,shape)=>{const used=drawKind(ctx,shape);if(BRITISH_KINDS.has(ctx.k)){const g=[ctx.W,ctx.O,ctx.D].find(g=>g[field].length);g[field][0]+=.01;}return used;});
   for(const {k} of BRITISH_CIVIC)assert.notDeepEqual(mutated[k],golden[k],field+' mutation '+k);
  }
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
 test('market arcades and courthouse inter-column gaps are open across all three geometry arenas',()=>{
  const market=drawOne(KT,looks,87,1,0,2),court=drawOne(KT,looks,43,1,0,2);
  for(const u of [.24,.5,.76])assert.ok(clearOpening(market,2,u,.9,.74,.4),'market opening '+u);
  for(const u of [.37,.5,.63])assert.ok(clearOpening(court,2,u,.9,.72,.4),'court opening '+u);
  const blocked=(k,u)=>drawOne(KT,looks,k,1,0,2,undefined,(ctx,shape)=>{const used=drawKind(ctx,shape);ctx.O.box(.13*2,.77*2,.87*2,.81*2,.1*ctx.H,.58*ctx.H,new THREE.Color(C.brick),null,null);return used;});
  for(const k of [87,43])assert.equal(clearOpening(blocked(k),2,.5,.9,.72,.4),false,'solid-front mutation must fail '+k);
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){let fail=0;await d056Guards((ok,n,e)=>{console.log(ok?'PASS':'FAIL',n,e??'');if(!ok)fail++});process.exitCode=fail?1:0;}
