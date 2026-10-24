// Independent exact numerical expectations for the two explicitly approved185 models.
// Original primitive plans and their old attachment caps remain in d082-redesign-surfaces.
import assert from 'node:assert/strict';
import * as THREE from 'three';
const V=p=>new THREE.Vector3(...p),mean=ps=>ps.reduce((a,p)=>a.map((x,i)=>x+p[i]/ps.length),[0,0,0]);
function body(x0,x1,z0,z1,h,[a,b,c,d],solid){const lo=[[x0,0,z0],[x1,0,z0],[x1,0,z1],[x0,0,z1]],hi=[[a,h,c],[b,h,c],[b,h,d],[a,h,d]],center=mean([...lo,...hi]);return[lo,hi,...lo.map((p,i)=>[p,lo[(i+1)%4],hi[(i+1)%4],hi[i]])].map((points,i)=>{let n=V(points[1]).sub(V(points[0])).cross(V(points[2]).sub(V(points[0]))).normalize();if(n.dot(V(mean(points)).sub(V(center)))<0){points=[...points].reverse();n.negate();}return{points,normal:n.toArray(),d:n.dot(V(points[0])),virtual:i===0,solid,kind:'approved185-tapered-body'};});}
export const isApproved185=key=>key==='185:1'||key==='185:2';
export function approved185Solids(key,faces){
 assert.ok(isApproved185(key));
 return key==='185:1'?[
  body(.13,.87,.24,.71,.53,[.115,.885,.225,.725],0),faces(['roof',.115,.885,.225,.725,.53,.82,'x'],1),
  body(.34,.66,.69,.89,.34,[.325,.675,.675,.905],2),faces(['roof',.325,.675,.675,.905,.34,.56,'z'],3),faces(['box',.19,.27,.40,.49,.70,1],4)
 ]:[
  body(.15,.84,.24,.75,.57,[.13,.86,.22,.77],0),faces(['hip',.13,.86,.22,.77,.57,.85],1),
  body(.55,.78,.73,.90,.31,[.535,.795,.715,.915],2),faces(['roof',.535,.795,.715,.915,.31,.46,'z'],3),faces(['box',.24,.32,.39,.47,.72,1],4)
 ];
}
export function approved185Door(key){assert.ok(isApproved185(key));const points=key==='185:1'?[[.4296,0,.89],[.5704,0,.89],[.575548,.2652,.9017],[.424452,.2652,.9017]]:[[.6144,0,.90],[.7156,0,.90],[.720748,.2418,.9117],[.609252,.2418,.9117]],normal=V([0,-.015/(key==='185:1'?.34:.31),1]).normalize().toArray();return{points,normal,d:normal.reduce((n,x,i)=>n+x*points[0][i],0)};}
