import * as THREE from 'three';
import { MODELS,drawModel } from './models.ts';
import { windowAtlas,patchWindowMaterial } from '../../src/render/windows.ts';
const all:any[]=[];
const params=new URLSearchParams(location.search),turn=Number(params.get('turn')??0),only=params.get('only');
for(const [i,m] of MODELS.entries()){
 if(only!==null&&i!==Number(only))continue;
 const article=document.createElement('article');
 article.innerHTML=`<div class="number">STUDY ${String(i+1).padStart(2,'0')}</div><canvas></canvas><h2>${m.name}</h2><p>Candidate ${m.k}:${m.v} · inherited H ${m.H} · parcel ${m.size}</p>`;document.querySelector('#grid')!.append(article);
 const canvas=article.querySelector('canvas')!,w=Math.round(canvas.getBoundingClientRect().width);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(w,Math.round(w*.8),false);renderer.setPixelRatio(1);renderer.setClearColor('#edf0e9');renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff7de','#7f9382',2));const sun=new THREE.DirectionalLight('#fff2d8',3);sun.position.set(-3,6,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
 const r=drawModel(m),materials=[new THREE.MeshStandardMaterial({map:windowAtlas(),vertexColors:true,roughness:1}),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1})];patchWindowMaterial(materials[0]);
 const group=new THREE.Group();r.G.slice(0,2).forEach((g,j)=>{const mesh=new THREE.Mesh(g.geometry(),materials[j]);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);});scene.add(group);
 const ground=new THREE.Mesh(new THREE.BoxGeometry(m.size,.025,m.size),new THREE.MeshStandardMaterial({color:'#c0c8b4',roughness:1}));ground.position.set(m.size/2,-.016,m.size/2);ground.receiveShadow=true;scene.add(ground);
 const span=Math.max(m.size*1.35,m.H*1.65),camera=new THREE.OrthographicCamera(-span*.625,span*.625,span*.5,-span*.5,.01,100);const a=Math.PI/4+turn;camera.position.set(m.size/2+5*Math.cos(a),3.7,m.size/2+5*Math.sin(a));camera.lookAt(m.size/2,m.H*.4,m.size/2);renderer.render(scene,camera);
 article.insertAdjacentHTML('beforeend',`<p>${r.cost} architectural weighted triangles / inherited cap ${m.cap}<br>${m.components.length} architectural component${m.components.length>1?'s':''}</p>`);
 all.push({k:m.k,v:m.v,name:m.name,height:m.H,size:m.size,cost:r.cost,camera:{position:camera.position.toArray(),target:[m.size/2,m.H*.4,m.size/2]},triangles:renderer.info.render.triangles});
}
(window as any).__d082={ready:true,models:all,turn,qualification:'ISOLATED STUDIO REVIEW; NOT PRODUCTION GALLERY'};
