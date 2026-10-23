// Local-only build adapter. Uses the original game's scene, material and lights.
import * as THREE from 'three';
import {Geo} from '../../src/render/scene.ts';
import {Pen} from '../../src/render/kindArt.ts';
import {emitD083Prototype} from './models.mjs';
import plan from './game-preview-plan.json';
export function installD083GamePreview(scene:THREE.Scene,c:any,top:ArrayLike<number>,originalMesh:THREE.Mesh,disposables:{dispose():void}[]){
 const params=typeof location==='undefined'?null:new URLSearchParams(location.search);
 if(params?.get('d083Scene')!=='1'||params.get('sample')!=='gallery')return;
 const identity=JSON.stringify(c.buildings.map((b:any)=>[b.id,b.k,b.lv,b.v,b.x,b.z,b.size]));
 if(c.n!==plan.cityN||identity!==plan.cityBuildingSignature)throw new Error('D083 preview only supports unchanged native gallery records');
 const material=originalMesh.material as THREE.Material,meshes:THREE.Mesh[]=[],rows:any[]=[];
 for(const plot of plan.plots){
  let y0=0;for(let dz=0;dz<plot.size;dz++)for(let dx=0;dx<plot.size;dx++){const i=(plot.z+dz)*c.n+plot.x+dx;if(c.occ[i]||c.road[i]||c.ter[i]===0||c.tree[i])throw new Error('D083 preview parcel is not the original empty land');y0=Math.max(y0,top[i]);}
  const W=new Geo({ext:true}),O=new Geo(),D=new Geo();W.owner=O.owner=D.owner=10000+rows.length;
  const model=emitD083Prototype(new Pen({W,O,D,trees:[],x0:plot.x,z0:plot.z,s:plot.size,y0,H:plot.H,k:0,v:0,C:{} as any}),plot.id);
  const geometry=O.geometry();
  // These are unowned render-only exhibits, not fabricated finished saved buildings.
  // Use the same existing unowned-prop construction attribute; do not change uNoClip or any old owner.
  geometry.setAttribute('aCon',new THREE.Float32BufferAttribute(Array.from({length:geometry.attributes.position.count},()=>[-1,-1,0]).flat(),3));
  const mesh=new THREE.Mesh(geometry,material);mesh.name='D083-local-preview:'+plot.id;mesh.castShadow=mesh.receiveShadow=true;mesh.customDepthMaterial=originalMesh.customDepthMaterial;scene.add(mesh);disposables.push(geometry);meshes.push(mesh);
  geometry.computeBoundingBox();rows.push({...plot,y0,triangles:O.owners.length,bounds:{min:geometry.boundingBox!.min.toArray(),max:geometry.boundingBox!.max.toArray()},materialType:material.type,modelVertices:model.triangles.length*3});
 }
 (window as any).__d083Game={qualification:plan.qualification,plots:rows,sourceHead:plan.sourceHead,materialSharedWithOriginalBuildings:true,originalBuildingCount:c.buildings.length,constructionQualification:'Unowned render-only exhibits, not production construction or saved-owner acceptance; original uNoClip and all original owners unchanged.',
  setVisible(on:boolean){if(typeof on!=='boolean')throw new Error('boolean preview visibility required');meshes.forEach(m=>m.visible=on);return meshes.map(m=>m.visible);},
  observe(){return{meshes:meshes.map(m=>({name:m.name,visible:m.visible,materialType:m.material.type,castShadow:m.castShadow,receiveShadow:m.receiveShadow,positionCount:m.geometry.attributes.position.count})),lights:scene.children.filter(o=>(o as any).isLight).map((l:any)=>({type:l.type,color:l.color.getHexString(),intensity:l.intensity,position:l.position.toArray()}))};}
 };
 document.querySelector('#d083-preview-select')?.remove();const select=document.createElement('select');select.id='d083-preview-select';select.title='D083 local art preview only';select.style.cssText='position:fixed;right:16px;top:76px;z-index:20;padding:8px 12px;border:1px solid #486457;border-radius:7px;background:#f5f1e6;color:#294537;font:14px system-ui;max-width:270px;';
 select.innerHTML='<option value="all">D083 本地新稿：八棟總覽</option>'+rows.map((p,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} ${p.zh}</option>`).join('');
 select.onchange=()=>{const gt=(window as any).__gt;if(!gt)return;if(select.value==='all')gt.view(48,49,2.4);else{const p=rows[Number(select.value)];gt.view(p.x+1,p.z-1.0,6);}gt.spin(0);};document.body.appendChild(select);
}
