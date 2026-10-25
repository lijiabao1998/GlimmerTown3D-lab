// Additive independent convex-polyhedron plan support; old shape planners and
// all numeric area/winding tolerances remain unchanged.
import * as THREE from 'three';
import {planFaces} from './structural-plan.mjs';
export function constructionFaces(spec,height){if(spec.type!=='polyhedron')return planFaces(spec,height);const faces=structuredClone(spec.faces),points=faces.flat(),center=points.reduce((s,p)=>s.map((v,i)=>v+p[i]/points.length),[0,0,0]);return faces.map(face=>{const a=new THREE.Vector3(...face[0]),n=new THREE.Vector3(...face[1]).sub(a).cross(new THREE.Vector3(...face[2]).sub(a)),m=face.reduce((s,p)=>s.map((v,i)=>v+p[i]/face.length),[0,0,0]);if(n.dot(new THREE.Vector3(...m).sub(new THREE.Vector3(...center)))<0)face.reverse();return face.map(([x,y,z])=>[x,y/height,z]);});}
