// Independent numerical envelope of the explicitly approved finite revision.
// No emitted triangles or artist metadata construct these expectations.
import assert from 'node:assert/strict';
import * as THREE from 'three';
const V=p=>new THREE.Vector3(...p),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),EPS=1e-10;
const center=ps=>ps.reduce((a,p)=>a.map((v,i)=>v+p[i]/ps.length),[0,0,0]);
function oriented(points,c,virtual,solid){let n=V(points[1]).sub(V(points[0])).cross(V(points[2]).sub(V(points[0]))).normalize();if(n.dot(V(center(points)).sub(V(c)))<0){points=[...points].reverse();n.negate();}return{points,normal:n.toArray(),d:n.dot(V(points[0])),virtual,solid,kind:'approved-tapered-body'};}
function body(x0,x1,z0,z1,h,[a,b,c,d],solid){const base=[[x0,0,z0],[x1,0,z0],[x1,0,z1],[x0,0,z1]],top=[[a,h,c],[b,h,c],[b,h,d],[a,h,d]],C=center([...base,...top]);return[base,top,...base.map((p,i)=>[p,base[(i+1)%4],top[(i+1)%4],top[i]])].map((p,i)=>oriented(p,C,i===0,solid));}
export function approved179v1Solids(faces){return[
 body(.14,.58,.20,.76,.56,[.125,.595,.185,.775],0),faces(['roof',.125,.595,.185,.775,.56,.88,'z'],1),
 body(.58,.87,.36,.74,.41,[.57,.885,.345,.755],2),faces(['roof',.57,.885,.345,.755,.41,.64,'x'],3),
 body(.34,.53,.74,.90,.29,[.325,.545,.725,.915],4),faces(['roof',.325,.545,.725,.915,.29,.45,'z'],5),
 faces(['box',.19,.27,.40,.49,.64,1],6)
];}
function area(p){if(p.length<3)return 0;const a=V(p[0]);let n=0;for(let i=1;i<p.length-1;i++)n+=V(p[i]).sub(a).cross(V(p[i+1]).sub(a)).length()/2;return n;}
function clean(p){const out=[];for(const q of p)if(!out.length||V(q).distanceTo(V(out.at(-1)))>EPS)out.push(q);if(out.length>1&&V(out[0]).distanceTo(V(out.at(-1)))<EPS)out.pop();return out;}
function split(p,f){const inside=[],outside=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],da=dot(f.normal,a)-f.d,db=dot(f.normal,b)-f.d;if(da<=EPS)inside.push(a);if(da>=-EPS)outside.push(a);if((da>EPS&&db<-EPS)||(da<-EPS&&db>EPS)){const t=da/(da-db),q=a.map((v,j)=>v+t*(b[j]-v));inside.push(q);outside.push(q);}}return[clean(inside),clean(outside)];}
function subtract(p,solid,normal,canonical){let remain=p;const result=[];for(const f of solid){const ds=remain.map(q=>dot(f.normal,q)-f.d),alignment=dot(f.normal,normal);if(ds.every(d=>Math.abs(d)<EPS)&&Math.abs(alignment)>1-1e-8){if(alignment>0&&!canonical)return[p];continue;}const[inside,outside]=split(remain,f);if(area(outside)>1e-20)result.push(outside);if(area(inside)<1e-20)return[p];remain=inside;}return result;}
export function joinedExterior(solids){const result=[];for(let own=0;own<solids.length;own++)for(const f of solids[own]){let pieces=[f.points];for(let other=0;other<solids.length&&pieces.length;other++)if(other!==own)pieces=pieces.flatMap(p=>subtract(p,solids[other],f.normal,other<own));result.push(...pieces.map(points=>({...f,points})));}assert.ok(result.length>0);return result;}
export function approved179v1Door(){const points=[[.3932,0,.90],[.4768,0,.90],[.481948,.2262,.9117],[.388052,.2262,.9117]],normal=V([0,-.015/.29,1]).normalize().toArray();return{points,normal,d:dot(normal,points[0])};}
