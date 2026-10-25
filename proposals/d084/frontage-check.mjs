import assert from 'node:assert/strict';
import {frontageEdges, StreetFrontage} from '../../src/render/streetFrontage.ts';
import {Preview} from '../../src/render/preview.ts';
const road = new Uint8Array(64), c = [{x:3,z:3,y:0,ok:true},{x:4,z:3,y:0,ok:true},{x:3,z:4,y:0,ok:true},{x:4,z:4,y:0,ok:true}];
for (const side of [[3,2],[5,3],[4,5],[2,4]]) road[side[1]*8+side[0]]=1;
const before=JSON.stringify([Array.from(road),c]), e=frontageEdges(8,road,c);
assert.equal(e.length,4);assert.equal(JSON.stringify([Array.from(road),c]),before);
assert.deepEqual(e,frontageEdges(8,road,c));
for(let r=0;r<4;r++){const rotated=new Uint8Array(64);let pts=c.map(p=>({...p}));for(let i=0;i<64;i++){let x=i%8,z=i>>3;for(let j=0;j<r;j++)[x,z]=[7-z,x];rotated[z*8+x]=road[i];}for(const p of pts)for(let j=0;j<r;j++)[p.x,p.z]=[7-p.z,p.x];assert.equal(frontageEdges(8,rotated,pts).length,4);}
assert.deepEqual(frontageEdges(8,road,c.map((p,i)=>({...p,ok:i!==0}))),[]);
assert.deepEqual(frontageEdges(8,road,[...c,c[0]]),[]);
assert.deepEqual(frontageEdges(8,road,[{x:-1,z:3,y:0,ok:true}]),[]);
const corner=new Uint8Array(64);corner[2*8+2]=1;assert.deepEqual(frontageEdges(8,corner,c),[]);
const mesh=new StreetFrontage();mesh.set(e);assert.equal(mesh.mesh.count,4);assert.equal(mesh.geometry.index.count/3*mesh.mesh.count,8);mesh.clear();assert.equal(mesh.mesh.count,0);mesh.dispose();
const off=new Preview(1);off.setFrontage(8,road,c);assert.equal(off.frontageCount(),0);assert.equal(off.mesh.children.length,0);off.dispose();
const on=new Preview(1,true);on.setFrontage(8,road,c);on.set(c,'#fff');assert.equal(on.frontageCount(),4);assert.equal(on.mesh.children.length,1);on.clear();assert.equal(on.frontageCount(),0);on.dispose();
console.log('D084: deterministic four-sided frontage, negative controls, legacy default, grow/clear/dispose passed');
