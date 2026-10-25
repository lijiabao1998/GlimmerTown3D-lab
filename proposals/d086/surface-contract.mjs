// D086 additive adapter. The historical classifier, sample inventory and thresholds
// are imported unchanged; source part labels never decide visibility exemptions.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Geo} from '../../src/render/scene.ts';
import {drawKind} from '../../src/render/kindArt.ts';
import {shapeOf} from '../../src/content/kindShapes.ts';
import {d081OwnerSurfaceContract,d081OwnerSurfaceRayAudit,assertD081SurfaceCoverage,d081OwnerBounds,assertD081OwnerFits} from '../../tools/d081-frame.mjs';
export {d081OwnerSurfaceContract as surfaceContract,d081OwnerSurfaceRayAudit as auditSurface,assertD081SurfaceCoverage as assertSurfaceCoverage};
export const VIEWPORTS=Object.freeze([{W:1440,H:1000},{W:412,H:860},{W:360,H:740}]);
export const LEGAL_SURFACE_VIEWS=Object.freeze([Math.PI*.08+1e-8,Math.PI/6,Math.PI*.32-1e-8].flatMap((elevation,e)=>Array.from({length:16},(_,yaw)=>Object.freeze({id:`surface-e${e}-y${yaw}`,yaw:Math.PI/4+yaw*Math.PI/8,elevation}))));
export function surfaceCamera(b,{yaw=Math.PI/4,elevation=Math.PI/6,zoom=5.5/b.size}={},n=40){
 const target=[b.x+b.size/2,0,b.z+b.size/2],radius=n*1.6*Math.SQRT2/Math.cos(Math.PI/6),horizontal=radius*Math.cos(elevation);
 assert.ok(elevation>=Math.PI*.08&&elevation<=Math.PI*.32);assert.ok(zoom>=.6&&zoom<=8);
 return{target,pos:[target[0]+horizontal*Math.sin(yaw),radius*Math.sin(elevation),target[2]+horizontal*Math.cos(yaw)],zoom};
}
// Isolated diagnostic only. Production qualification must pass the complete actual
// native city oracle so neighbours, terrain and trees cannot be silently excluded.
export function isolatedSurfaceOracle(m,{x=3,z=4,y0=0,owner=1}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()];for(const g of G)g.owner=owner;
 drawKind({W:G[0],O:G[1],D:G[2],trees:[],x0:x,z0:z,y0,s:m.size,H:m.H,k:m.k,v:m.v,C:{}},shapeOf(m.k,...Array(19).fill(true)));
 const scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial({side:THREE.FrontSide}),meshes=G.map(g=>new THREE.Mesh(g.geometry(),material));meshes.forEach(m=>scene.add(m));
 return{scene,meshes,owners:G.map(g=>Int32Array.from(g.owners)),n:40,b:{id:owner,x,z,y0,size:m.size,k:m.k,v:m.v},dispose(){meshes.forEach(m=>m.geometry.dispose());material.dispose();}};
}
export function planSurfaceCoverage(oracle,b,viewport,{originalCamera=surfaceCamera(b),contract:provided=null}={}){
 const contract=provided??d081OwnerSurfaceContract(oracle,originalCamera,viewport,b.id),original=d081OwnerSurfaceRayAudit(oracle,originalCamera,viewport,contract),required=new Set(contract.requiredSamples),selected=[{id:'original',camera:originalCamera,audit:original}];
 original.visibleSamples.forEach(id=>required.delete(id));
 const candidates=LEGAL_SURFACE_VIEWS.map(view=>{const camera=surfaceCamera(b,view,oracle.n);assertD081OwnerFits(d081OwnerBounds(oracle,camera,viewport,b.id));return{...view,camera,audit:d081OwnerSurfaceRayAudit(oracle,camera,viewport,contract)};});
 while(required.size&&candidates.length){for(const c of candidates)c.gain=c.audit.visibleSamples.filter(id=>required.has(id)).length;candidates.sort((a,b)=>b.gain-a.gain);const best=candidates.shift();if(!best.gain)break;selected.push(best);best.audit.visibleSamples.forEach(id=>required.delete(id));}
 const missing=contract.probes.filter(p=>required.has(p.id));
 return{contract,selected,missing,passed:!missing.length,coverage:missing.length?null:assertD081SurfaceCoverage(selected.map(s=>s.audit),contract,'D086 numerical planning only; actual PNG capture remains mandatory')};
}
