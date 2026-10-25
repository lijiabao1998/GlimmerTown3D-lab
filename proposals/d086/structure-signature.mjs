// Exact D081 geometric identity algorithm copied unchanged as an independent helper.
import assert from 'node:assert/strict';import * as THREE from 'three';import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function fieldStudyLodgeStructureSignature(r,{architectureOnly=false}={}){
 const groups=architectureOnly?r.G.slice(0,2):r.G,pts=groups.flatMap(g=>g.pos),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<pts.length;i++)lo[i%3]=Math.min(lo[i%3],pts[i]),hi[i%3]=Math.max(hi[i%3],pts[i]);
 assert.ok(hi.every((n,j)=>Number.isFinite(n)&&n>lo[j]),'structure has positive finite dimensions');
 const q=n=>Math.round(n*1e7),pointKey=p=>p.map(q).join(','),representations=[];
 for(let turn=0;turn<4;turn++){
  const planes=new Map();
  for(const g of groups)for(let ti=0;ti<g.pos.length;ti+=9){
   const tri=[0,3,6].map(j=>{let x=(g.pos[ti+j]-lo[0])/(hi[0]-lo[0]),z=(g.pos[ti+j+2]-lo[2])/(hi[2]-lo[2]);for(let q=0;q<turn;q++)[x,z]=[1-z,x];return [x,(g.pos[ti+j+1]-lo[1])/(hi[1]-lo[1]),z];});
   const [a,b,c]=tri.map(p=>new THREE.Vector3(...p)),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();assert.ok(normal.lengthSq()>.99,'noncollapsed structure');
   const first=normal.toArray().find(n=>Math.abs(n)>1e-8);if(first<0){normal.negate();[tri[1],tri[2]]=[tri[2],tri[1]];}
   const key=[...normal.toArray(),normal.dot(a)].map(n=>Math.round(n*1e6)).join(','),edges=planes.get(key)??new Map();
   for(let j=0;j<3;j++){const u=pointKey(tri[j]),v=pointKey(tri[(j+1)%3]),edge=[u,v].sort().join('|'),dir=u<v?1:-1;edges.set(edge,(edges.get(edge)??0)+dir);}planes.set(key,edges);
  }
  const patches=[];
  for(const [plane,edges]of planes){
   // Adjacent collinear boundaries are merged, so inserting an edge vertex cannot create an identity.
   let seg=[...edges].filter(([,n])=>n).map(([edge,n])=>({p:edge.split('|').map(p=>p.split(',').map(Number)),n}));let changed=true;
   while(changed){changed=false;outer:for(let i=0;i<seg.length;i++)for(let j=i+1;j<seg.length;j++){
    const a=seg[i],b=seg[j];if(Math.abs(a.n)!==Math.abs(b.n))continue;const A=a.n>0?a.p:[...a.p].reverse(),B=b.n>0?b.p:[...b.p].reverse();let points=null;
    if(A[1].join()===B[0].join())points=[A[0],A[1],B[1]];else if(B[1].join()===A[0].join())points=[B[0],B[1],A[1]];if(!points)continue;
    const [u,v,w]=points.map(p=>new THREE.Vector3(...p)),ab=v.clone().sub(u),bc=w.clone().sub(v);if(ab.clone().cross(bc).length()>1e-6*ab.length()*bc.length()||ab.dot(bc)<=0)continue;
    const k0=points[0].join(','),k1=points[2].join(','),n=Math.abs(a.n)*(k0<k1?1:-1);seg=seg.filter((_,x)=>x!==i&&x!==j);seg.push({p:(k0<k1?[points[0],points[2]]:[points[2],points[0]]),n});changed=true;break outer;
   }}
   patches.push(plane+':'+seg.map(s=>s.p.map(p=>p.join(',')).join('|')+'@'+s.n).sort().join(';'));
  }representations.push(patches.sort().join('/'));
 }return sha(representations.sort()[0]);
}

