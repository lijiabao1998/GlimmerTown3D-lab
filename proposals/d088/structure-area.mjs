// Additive D088 copy of D086 full oriented-area proof. Original file remains immutable.
// Sole correction: one canonical projection axis per existing rounded plane key;
// tie-axis polygon/triangle normals cannot project the same plane into unlike coordinates.
// Every area/plane threshold, triangle and destructive control remains unchanged.
import assert from'node:assert/strict';import*as THREE from'three';
const V=p=>new THREE.Vector3(...p),mean=ps=>ps.reduce((s,p)=>s.map((v,i)=>v+p[i]/ps.length),[0,0,0]);
function newell(ps){const n=new THREE.Vector3();for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length];n.x+=(a[1]-b[1])*(a[2]+b[2]);n.y+=(a[2]-b[2])*(a[0]+b[0]);n.z+=(a[0]-b[0])*(a[1]+b[1]);}assert.ok(n.length()>1e-12);return n.normalize();}
function oriented(ps,center){return newell(ps).dot(V(mean(ps)).sub(V(center)))<0?[...ps].reverse():ps;}
const snap=x=>Math.round(x*1e8)/1e8;
function key(p){const n=newell(p);return[...n.toArray(),n.dot(V(p[0]))].map(snap).join(':');}
function projected(p,drop){const q=p.map(a=>a.filter((_,i)=>i!==drop));if(area(q)<0)q.reverse();return q;}
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2;
const edge=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function overlap(A,B){let p=A;for(let i=0;i<B.length&&p.length;i++){const a=B[i],b=B[(i+1)%B.length],out=[];for(let j=0;j<p.length;j++){const x=p[j],y=p[(j+1)%p.length],u=edge(a,b,x),v=edge(a,b,y);if(u>=-1e-14)out.push(x);if(u*v<0){const t=u/(u-v);out.push(x.map((q,k)=>q+t*(y[k]-q)));}}p=out;}return p.length<3?0:Math.abs(area(p));}
function expectedTriangles(ps,drop){const p=projected(ps,drop);return THREE.ShapeUtils.triangulateShape(p.map(v=>new THREE.Vector2(...v)),[]).map(ids=>ids.map(i=>p[i]));}
export function proveComponentSurface(expected,triangles,label){
 const groups=new Map();for(const [which,faces]of[['expected',expected],['actual',triangles]])for(const ps of faces){assert.ok(ps.flat().every(Number.isFinite));const k=key(ps),n=k.split(':').slice(0,3).map(x=>Math.abs(Number(x))),drop=n.indexOf(Math.max(...n)),g=groups.get(k)??{expected:[],actual:[]};g[which].push(...(which==='expected'?expectedTriangles(ps,drop):[projected(ps,drop)]));groups.set(k,g);}
 let maximumError=0;for(const[k,g]of groups){let error=0;for(const A of g.expected)for(const B of g.expected)error+=overlap(A,B);for(const A of g.actual)for(const B of g.actual)error+=overlap(A,B);for(const A of g.expected)for(const B of g.actual)error-=2*overlap(A,B);error=Math.max(0,error);maximumError=Math.max(error,maximumError);assert.ok(error<1e-10,`${label} oriented area mismatch ${k}: ${error}`);}return{planes:groups.size,maximumError};
}
