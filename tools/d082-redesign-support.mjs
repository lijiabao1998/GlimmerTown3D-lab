import {releaseHistoricalSource} from './d082-release-source-v2.mjs';
// Nine-model expansion review. Independent of the unchanged rejected D082 ten-model gates.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {shapeOf,kindColors} from '../src/content/kindShapes.ts';
import {viewCode} from '../src/io/save.ts';
import {drawPlan,gridOf} from '../src/content/blocks.ts';
import {recipe} from '../src/content/recipes.ts';
import {facadePlan,trimPlan} from '../src/content/facades.ts';
import {dressing} from '../src/content/dressing.ts';
import {houseBlock} from '../src/content/britishHouses.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest,hashOf} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {landLevelOf} from '../src/render/landArt.ts';
import {seasonOptionOf} from '../src/render/seasonArt.ts';
import {Preview} from '../src/render/preview.ts';
import {HazardMarks} from '../src/render/hazard.ts';
import {Geo} from '../src/render/scene.ts';
import {drawKind} from '../src/render/kindArt.ts';
import {D082_185_ART_PATH,D082_185_PREVIOUS_ART_SHA,D082_185_CURRENT_ART_SHA} from './d082-185-approved-source.mjs';
export const J=JSON.stringify;
export const sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
export const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks,ARCHE=read('src/content/lab-arche.json').arche,VRANK=read('src/content/samples/d009-live.json').vrank;
export const TARGETS=Object.freeze([[179,0,.78,1,182],[179,1,.66,1,182],[179,2,.56,1,182],[185,0,1.48,1,120],[185,1,.88,1,120],[185,2,.91,1,120],[154,0,.33,4,342],[154,1,.87,4,342],[154,2,.78,4,342]].map(([k,v,H,size,cap])=>Object.freeze({k,v,H,size,cap})));
export const isTarget=(k,v)=>TARGETS.some(t=>t.k===k&&t.v===v);
export const REJECTED=Object.freeze([[126,0],[126,1],[126,2]]);
export const VIEWS=Object.freeze([{id:'original',spin:0,tilt:0},{id:'front',spin:Math.PI/4,tilt:0},{id:'rear',spin:-3*Math.PI/4,tilt:0},{id:'side',spin:-Math.PI/4,tilt:0}]);
export const VIEWPORTS=Object.freeze([{W:1440,H:1000},{W:412,H:860},{W:360,H:740}]);
export const QUALIFICATION='Nine-model expansion after explicit acceptance of the two prototypes. The accepted pair is byte-pinned to its approved snapshot. This preview is not release approval, deployment, Android-device testing, or a claim that the unchanged rejected ten-model gates pass. Before is the same production build with coastalArt=legacy; accepted-family references are in this same build, not historical screenshots.';
const fixtureBytes=fs.readFileSync(path.join(ROOT,'fixtures/d082-geometry-before.json'));
assert.equal(sha(fixtureBytes),'98f9d7d0bdb219fe4fe1ff2cfd1791f04b49fcc5e62da2833bef6dfeb228ae68','immutable D081 geometry baseline');
export const LEGACY=JSON.parse(fixtureBytes);
const addedGzip=fs.readFileSync(path.join(ROOT,'fixtures/d082-redesign-additional-before.json.gz'));assert.equal(sha(addedGzip),'0114070fc3eecb5acbfc133e84392b44dee3e003993d0244ff4130b0044857ed');const addedBytes=gunzipSync(addedGzip);
assert.equal(sha(addedBytes),'5ee4253aa8a02ed912d246220875183eb8664d00a48d78c1857187f581895c01','immutable published nine-slot qualification');
export const ADDITIONAL=JSON.parse(addedBytes);
export const legacySlot=(k,v)=>LEGACY.slots[k+':'+v]??ADDITIONAL.slots[k+':'+v];
export const PREVIOUS_ACCEPTED=Object.freeze({'179:0':{defaultGeometry:'5d5de66f9401492b83bfbfa1be04b2c1288eefa3106fa1074dc765c1b1d00665',allAffineCasesSha256:'b65ee3b473de9cab0e82012eaa3042a228e72f6748b448f074a8e4d2a21e2a62'},'179:1':{defaultGeometry:'1ad82e98714bd84ae41435298b0cf6ada16e93ea56153ffb046eb3d183aca049',allAffineCasesSha256:'b7a060fca867dd2866e65898b0840fe93aeb20a7011f4a54d0aeeb89191f2ab0'}});
// Only 179v1 is superseded by the explicit 2026-10-22 finite-revision approval.
export const APPROVED_179_V1=Object.freeze(read('fixtures/d082-179v1-approved-revision.json'));
assert.deepEqual(APPROVED_179_V1.previousPins,PREVIOUS_ACCEPTED['179:1']);
assert.equal(APPROVED_179_V1.approvedPins.defaultGeometry,'e33779d6bf749fe114fcc9e8079e6978d4acfcc956745df9d91735002f3cc2df');
assert.equal(APPROVED_179_V1.approvedPins.allAffineCasesSha256,'4d2bac3a4ab58469109380fc40881a1ea1246cea8df177e53fc543e07ddcc853');
for(const[file,hash]of Object.entries(APPROVED_179_V1.evidence))assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash,'immutable pre-approval evidence '+file);
// The previous179 source receipt is immutable. Only the art-file packaging was
// superseded by the explicit185 approval;179 geometry and its other sources stay exact.
export const APPROVED_185=Object.freeze(read('fixtures/d082-185-approved-revision.json'));
assert.equal(APPROVED_185.approval.message,'Sentinel_a416d384950081919aa629cf2e2fbab6');
assert.equal(APPROVED_185.previewSource,'0b583d1deecc8a72af19c6c470cacd73153bfe83');
assert.deepEqual(Object.keys(APPROVED_185.slots),['185:1','185:2']);
assert.equal(APPROVED_185.previousArtSha256,D082_185_PREVIOUS_ART_SHA);
assert.deepEqual(APPROVED_185.approvedProductSources,{[D082_185_ART_PATH]:D082_185_CURRENT_ART_SHA});
assert.deepEqual(APPROVED_185.slots['185:1'].approvedPins,{defaultGeometry:'786452b12fcd97c87b4319831b05a99f23791cc67a0da39e22c007de705dd508',allAffineCasesSha256:'609cac2b6163dce79eca5a32debd9efde2bcc1b6e741a1fa7c3dd2405c540f95'});
assert.deepEqual(APPROVED_185.slots['185:2'].approvedPins,{defaultGeometry:'ddddc1a69f8b63ffb9d753aaf51b05c79676396174ac21f471597475c0462ba8',allAffineCasesSha256:'b7c2660c179c1a2bf4968636066789cb27955786a261c18aa81d0aa17d071d06'});
for(const[file,hash]of Object.entries(APPROVED_185.evidence))assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash,'immutable185 old-coordinate evidence '+file);
for(const[file,hash]of Object.entries(APPROVED_179_V1.approvedProductSources)){
 if(file===D082_185_ART_PATH){assert.equal(hash,D082_185_PREVIOUS_ART_SHA,'unchanged historical179 source pin');assert.equal(sha(releaseHistoricalSource(file)),D082_185_CURRENT_ART_SHA,'exact approved185-only art packaging');}
 else assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash,'unchanged179 approved product source '+file);
}
export const ACCEPTED=Object.freeze({...PREVIOUS_ACCEPTED,'179:1':Object.freeze(APPROVED_179_V1.approvedPins),...Object.fromEntries(Object.entries(APPROVED_185.slots).map(([key,s])=>[key,Object.freeze(s.approvedPins)]))});
// Previous pins retain immutable c3b601b / approved cb09a27b. Only 179v1 is
// superseded by reviewed 90b80f4 CI evidence and the explicit approval record.
const flags=Array(17).fill(true);
export const civic=on=>({shape:k=>shapeOf(k,...flags,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))});
export function cityOf(sample,force=null){
 assert.ok(['gallery','seed516','ai120'].includes(sample));assert.ok(force===null||[0,1,2].includes(force));
 const r=viewCode(fs.readFileSync(path.join(ROOT,`src/content/samples/${sample}.code.txt`),'utf8'),KT,VRANK);assert.ok(r.ok,r.error);
 // Independently declared nine-slot render-only dispatch; never changes saved records.
 return force===null?r.city:{...r.city,buildings:r.city.buildings.map(b=>isTarget(b.k,force)?{...b,v:force}:b)};
}
export function blocksOf(city){const r=b=>recipe(ARCHE,b.k,b.lv,b.w,b.h,b.v);return {mode:'c',streetArt:true,villageArt:true,industryArt:true,commerceArt:true,houseArt:true,plan:drawPlan(gridOf(city),ARCHE,'c'),recipe:r,dress:b=>dressing(r(b)),facade:b=>facadePlan(r(b)),trim:b=>trimPlan(r(b)),detail:true};}
export const weighted=b=>b.meshStats().reduce((n,m)=>n+m.tris*(m.shadow?2:1),0);
export function sceneSignature(d){return sha({meshes:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),ground:d.ground,inst:d.inst,queries:d.queries,counts:d.counts});}
export function drawCase(k,{v=0,lv=1,s=KT.size(k),x0=3.125,z0=7.375,y0=.21,H=Math.max(.12,KT.height(k,lv,v)),owner=71,on=true}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];G.forEach(g=>g.owner=owner);
 const args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C:kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))},input=sha([x0,z0,y0,s,H,k,v,args.C]);
 const used=[...drawKind(args,shapeOf(k,...flags,on))];assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input);
 return {G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,cost:2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length};
}
export const caseSignature=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
export function caseBytes(r){const h=createHash('sha256');for(const g of r.G)for(const k of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(k+':'+g[k].length+':');h.update(Buffer.from(Float64Array.from(g[k]).buffer));}h.update(J([r.trees,r.used]));return h.digest('hex');}
export function assertCase(r){
 assert.equal(r.G.length,3);assert.deepEqual(r.trees,[]);let top=-Infinity;
 for(const g of r.G){assert.equal(g.pos.length%9,0);for(const k of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags'])assert.ok(g[k].every(Number.isFinite),'finite '+k);
  assert.equal(g.nor.length,g.pos.length);assert.equal(g.col.length,g.pos.length);assert.equal(g.uv.length,g.pos.length/3*2);assert.equal(g.owners.length,g.pos.length/9);assert.equal(g.tags.length,g.owners.length);assert.ok(g.owners.every(o=>o===r.owner));
  if(g.ext){assert.equal(g.wst.length,g.pos.length/3);assert.equal(g.wgl.length,g.pos.length);assert.equal(g.wbd.length,g.pos.length/3);}else for(const k of ['wst','wgl','wbd'])assert.equal(g[k].length,0);
  for(let i=0;i<g.pos.length;i+=3){const[x,y,z]=g.pos.slice(i,i+3);assert.ok(x>=r.x0-1e-9&&x<=r.x0+r.s+1e-9);assert.ok(z>=r.z0-1e-9&&z<=r.z0+r.s+1e-9);assert.ok(y>=r.y0-1e-9&&y<=r.y0+r.H+1e-9);top=Math.max(top,y-r.y0);assert.ok(Math.abs(Math.hypot(...g.nor.slice(i,i+3))-1)<1e-6);}
  for(let i=0;i<g.pos.length;i+=9){const a=new THREE.Vector3(...g.pos.slice(i,i+3)),b=new THREE.Vector3(...g.pos.slice(i+3,i+6)).sub(a),c=new THREE.Vector3(...g.pos.slice(i+6,i+9)).sub(a),cross=b.cross(c);assert.ok(cross.length()>1e-10);for(let j=0;j<9;j+=3)assert.ok(cross.clone().normalize().dot(new THREE.Vector3(...g.nor.slice(i+j,i+j+3)))>1-1e-6);}
 }
 assert.ok(top>=r.H*.85);const cap=TARGETS.find(t=>t.k===r.k&&t.v===r.v)?.cap;assert.ok(cap);assert.equal(r.cost,2*(r.G[0].owners.length+r.G[1].owners.length)+r.G[2].owners.length,'actual weighted triangle arithmetic');assert.ok(r.cost>=12&&r.cost<=cap);return {triangles:r.G.map(g=>g.owners.length),weighted:r.cost,top};
}
// Exact typed attributes by owner, excluding allocator holes only.
export function ownerContent(built){const owners=built.pickOwners();return built.buildingMeshes().map((m,mi)=>{const g=m.geometry,a=g.attributes,p=a.position.array,end=Math.min(a.position.count,g.drawRange.start+g.drawRange.count),acc=new Map();for(let t=g.drawRange.start/3;t<end/3;t++){const i=t*9,ax=p[i+3]-p[i],ay=p[i+4]-p[i+1],az=p[i+5]-p[i+2],bx=p[i+6]-p[i],by=p[i+7]-p[i+1],bz=p[i+8]-p[i+2];if(ay*bz-az*by===0&&az*bx-ax*bz===0&&ax*by-ay*bx===0)continue;const owner=String(owners[mi][t]??0),h=acc.get(owner)??createHash('sha256');for(const key of ['position','normal','uv','color','wStyle','wGlass','wBand','aCon']){const at=a[key];if(!at)continue;const start=t*3*at.itemSize,arr=at.array;h.update(Buffer.from(arr.buffer,arr.byteOffset+start*arr.BYTES_PER_ELEMENT,3*at.itemSize*arr.BYTES_PER_ELEMENT));}acc.set(owner,h);}return Object.fromEntries([...acc].map(([k,h])=>[k,h.digest('hex')]));});}
export function cameraFor(n,view,{W,H}){assert.ok([...view.pos,...view.target,view.zoom,W,H].every(Number.isFinite));const half=n*.42,c=new THREE.OrthographicCamera(-half*W/H,half*W/H,half,-half,.1,n*6);c.position.fromArray(view.pos);c.zoom=view.zoom;c.lookAt(new THREE.Vector3(...view.target));c.updateProjectionMatrix();c.updateMatrixWorld(true);return c;}
export function plannedCamera(n,shot,viewport,view=VIEWS[0]){
 const target=[shot.x,0,shot.z],D=n*1.6,b=[D,D*Math.SQRT2*Math.tan(Math.PI/6),D],horizontal=Math.hypot(b[0],b[2]),radius=Math.hypot(...b),elevation=Math.PI/6+view.tilt,scale=radius*Math.cos(elevation)/horizontal,c=Math.cos(view.spin),s=Math.sin(view.spin);
 const zoom=shot.zoom??Math.min(8,.70*.84*n*(viewport.W/viewport.H)/(shot.size*Math.SQRT2));
 assert.ok(zoom>=.6&&zoom<=8);assert.ok(Math.PI/2-elevation>=Math.PI*.18&&Math.PI/2-elevation<=Math.PI*.42);
 return {target,zoom,pos:[target[0]+(b[0]*c-b[2]*s)*scale,radius*Math.sin(elevation),target[2]+(b[0]*s+b[2]*c)*scale]};
}
export function assertCamera(actual,planned){assert.equal(actual.zoom,planned.zoom);for(const key of ['pos','target'])for(let i=0;i<3;i++)assert.ok(Math.abs(actual[key][i]-planned[key][i])<1e-9,'legal production camera '+key);}
function elements(g,group=null){const cap=g.index?.count??g.attributes.position?.count;assert.ok(Number.isFinite(cap));let start=Math.max(0,g.drawRange.start),end=Math.min(cap,g.drawRange.start+g.drawRange.count);if(group){start=Math.max(start,group.start);end=Math.min(end,group.start+group.count);}const count=end-start;if(count<0)return null;assert.ok(Number.isInteger(count)&&count%3===0);return count;}
function instances(m){const g=m.geometry,n=m.isInstancedMesh?m.count:g.isInstancedBufferGeometry?Math.min(g.instanceCount,g._maxInstanceCount??Infinity):1;assert.ok(Number.isInteger(n)&&n>=0);return n;}
function submissions(m,shadow=false){const gs=Array.isArray(m.material)?m.geometry.groups.map(g=>[m.material[g.materialIndex],g]):[[m.material,null]];let triangles=0,calls=0;const n=instances(m);if(!n)return{triangles,calls};for(const[mat,g]of gs){if(!mat?.visible)continue;assert.ok(!mat.wireframe&&!m.isBatchedMesh);const count=elements(m.geometry,g);if(count===null)continue;const passes=!shadow&&mat.transparent&&mat.side===THREE.DoubleSide&&!mat.forceSinglePass?2:1;triangles+=count/3*n*passes;calls+=passes;}return{triangles,calls};}
const sum=xs=>xs.reduce((a,b)=>a+b,0);
function visible(m){for(let p=m;p;p=p.parent)if(!p.visible)return false;return true;}
export function createOracle(sample,on,force=null){
 const source=cityOf(sample),city=cityOf(sample,force),world=sha(city),blocks=blocksOf(source),variant=force===null?'native':'v'+force;
 // Preserve the archival qualification separately: it predates production land/season defaults.
 if(!on){const rawCon=new ConState(city.n),raw=buildCityScene(city,KT,STYLES.A,blocks,'d',civic(false),rawCon,true);try{const d=sceneDigest(raw);const pin=ADDITIONAL.cities[variant][sample].modes.c;assert.equal(sceneSignature(d),pin.signature,'exact immutable nine-slot legacy scene');assert.deepEqual(d,pin.digest,'entire immutable raw legacy scene digest');assert.equal(weighted(raw),pin.weighted);}finally{raw.dispose();rawCon.dispose();}}
 const landArt=landLevelOf(()=>null),season=seasonOptionOf(()=>null,landArt);assert.equal(landArt,2);assert.deepEqual(season,{mode:'auto',soft:false});
 const con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,{...blocks,landArt,season},'d',civic(on),con,true,false,undefined),scene=built.scene,preview=new Preview(),hazard=new HazardMarks();
 if(built.con)con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(source,k=>KT.cat(k));built.setTreeAges(i=>con.siteAge(i));con.uni.uDayFrac.value=0;con.uni.uTime.value=2.2;built.setTraffic(undefined);built.setSeason(source.day);scene.add(preview.mesh,hazard.mesh);
 const digest=sceneDigest(built),meshes=built.buildingMeshes(),owners=built.pickOwners(),whole=weighted(built);assert.equal(meshes.length,3);assert.equal(sha(city),world);assert.equal(preview.mesh.count,0);assert.equal(hazard.mesh.count,0);assert.deepEqual(digest.inst.slice(-2),['0:050c5d1f:050c5d1f:-','0:050c5d1f:050c5d1f:-']);
 const ground=built.groundData(),rgb=Buffer.alloc(ground.W*ground.W*3);for(let i=0,j=0;i<ground.rgba.length;i+=4,j+=3){assert.equal(ground.rgba[i+3],255);rgb[j]=ground.rgba[i];rgb[j+1]=ground.rgba[i+1];rgb[j+2]=ground.rgba[i+2];}const groundEvidence={S:ground.S,W:ground.W,rgb:rgb.toString('base64')};
 const normalSpecs=Object.fromEntries(['walls','other','dress'].map((name,i)=>{const g=meshes[i].geometry,a=g.attributes.normal,start=g.drawRange.start*a.itemSize,length=Math.min(g.attributes.position.count-g.drawRange.start,g.drawRange.count)*a.itemSize;return[name,{capacity:a.array.length,start,length,hash:digest.meshes[name].attrs.normal,nodeWords:Array.from(new Uint32Array(a.array.buffer,a.array.byteOffset+start*4,length))}];}));
 const checkUnchanged=()=>{assert.equal(sha(city),world);assert.equal(weighted(built),whole);assert.deepEqual(sceneDigest(built),digest);};
 function measure(view,viewport){checkUnchanged();const camera=cameraFor(city.n,view,viewport);scene.updateMatrixWorld(true);const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem,camera.reversedDepth),suns=[];scene.traverseVisible(o=>{if(o.isLight&&o.castShadow&&o.layers.test(camera.layers))suns.push(o);});assert.equal(suns.length,1);const sun=suns[0];sun.shadow.camera.updateProjectionMatrix();sun.shadow.updateMatrices(sun,camera);const sf=sun.shadow.getFrustum(),rows=[];scene.traverse(m=>{if(!m.isMesh)return;const v=visible(m)&&m.layers.test(camera.layers),main=v&&(!m.frustumCulled||m.intersectsFrustum(frustum))?submissions(m):{triangles:0,calls:0},shadow=v&&m.castShadow&&(!m.frustumCulled||m.intersectsFrustum(sf))?submissions(m,true):{triangles:0,calls:0};rows.push({main,shadow});});const main={triangles:sum(rows.map(r=>r.main.triangles)),calls:sum(rows.map(r=>r.main.calls))},shadow={triangles:sum(rows.map(r=>r.shadow.triangles)),calls:sum(rows.map(r=>r.shadow.calls))};return{triangles:main.triangles+shadow.triangles,calls:main.calls+shadow.calls,wholeTriangles:whole,main,shadow};}
 function ownerBounds(owner,view,viewport){const c=cameraFor(city.n,view,viewport),lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];let triangles=0;scene.updateMatrixWorld(true);meshes.forEach((m,mi)=>{const p=m.geometry.attributes.position;for(let t=0;t<owners[mi].length;t++)if(owners[mi][t]===owner){triangles++;for(let j=0;j<3;j++){const v=new THREE.Vector3().fromBufferAttribute(p,t*3+j).applyMatrix4(m.matrixWorld).project(c);lo[0]=Math.min(lo[0],v.x);lo[1]=Math.min(lo[1],v.y);hi[0]=Math.max(hi[0],v.x);hi[1]=Math.max(hi[1],v.y);}}});assert.ok(triangles>0);return{owner,triangles,lo,hi,fits:lo.every(v=>v>=-1)&&hi.every(v=>v<=1)};}
 function assertBrowserGeometry(actual,actualGround){assert.deepEqual(actual,digest,'every live production digest field is exact, including all attributes, queries, instance colors and ages, ground, and ordered UI systems');assert.deepEqual(actualGround,groundEvidence,'full live RGB bytes, dimensions and tile scale match independent production ground');return{fullProductionSceneSha256:sha(digest),groundRgbSha256:sha(rgb),groundSha256:sha(ground.rgba),landArt,season,uiInstances:digest.inst.slice(-2),allDigestFieldsExact:true};}
 return{city,blocks,n:city.n,scene,meshes,owners,built,con,digest,groundEvidence,normalSpecs,whole,world,measure,ownerBounds,assertBrowserGeometry,checkUnchanged,dispose:()=>{preview.mesh.removeFromParent();hazard.mesh.removeFromParent();preview.dispose();hazard.dispose();built.dispose();con.dispose();}};
}
export function references(){const gallery=cityOf('gallery'),church=gallery.buildings.find(b=>b.k===16);assert.ok(church);const ai=cityOf('ai120'),blocks=blocksOf(ai);const bi=blocks.plan.findIndex(b=>b.x===31&&b.z===32&&houseBlock(blocks.recipe(b))==='villa');assert.ok(bi>=0,'existing D065 1x1 villa at 31,32');const villa=blocks.plan[bi];assert.deepEqual([villa.w,villa.h],[1,1]);return[{id:'reference-D059-church',family:'D059 village church',sample:'gallery',owner:church.id,k:church.k,x:church.x+church.size/2,z:church.z+church.size/2,size:church.size},{id:'reference-D065-villa',family:'D065 villa',sample:'ai120',owner:-bi-1,k:1,x:villa.x+.5,z:villa.z+.5,size:1}];}
export function assertBudget(after,before){for(const k of ['triangles','calls','wholeTriangles'])assert.ok(Number.isFinite(after[k])&&after[k]<=before[k],`${k} budget ${after[k]} <= ${before[k]}`);}
export function assertFrame(actual,expected){for(const k of ['triangles','calls'])assert.equal(actual[k],expected[k],k+' equals independent scene/frustum oracle');}

export function pairedCamera(before,after,shot,viewport,view=shot.view??VIEWS[0]){const requested=plannedCamera(after.n,shot,viewport,view);if(!shot.owner)return requested;const extent=Math.max(...[before,after].flatMap(o=>{const b=o.ownerBounds(shot.owner,{...requested,zoom:1},viewport);return [...b.lo,...b.hi].map(Math.abs);}));const zoom=Math.min(requested.zoom,.94/extent);assert.ok(zoom>=.6&&zoom<=8,'both complete models fit within legal zoom');const plan={...requested,zoom};for(const o of [before,after])assert.ok(o.ownerBounds(shot.owner,plan,viewport).fits);return plan;}
// Frozen contract: tools/unit-d082.mjs construction checks are exact outside target
// footprints. Target envelopes are intentionally geometry-derived, not saved-world state.
export function assertConstructionEnvelope(before,after,targets,actual=after.built.con){
 const old=before.built.con,foot=new Set(),expected=new Map(),rows=[];assert.ok(old&&actual);
 for(const b of targets){const tiles=[];for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++){const i=z*after.n+x;foot.add(i);tiles.push({x,z,i});expected.set(i,old.base[i]);}
  const y0=old.base[b.z*after.n+b.x],H=KT.height(b.k,b.lv,b.v),r=drawCase(b.k,{v:b.v,lv:b.lv,s:b.size,x0:b.x,z0:b.z,y0,H,owner:b.id});
  // Independent scalar reference: assign each inward-offset vertex to the one
  // half-open parcel cell that contains it. No production construction helper used.
  for(const g of r.G)for(let j=0;j<g.pos.length;j+=3){const q=[0,2].map(a=>Math.min((a===0?b.x:b.z)+b.size-.001,Math.max((a===0?b.x:b.z)+.001,g.pos[j+a]-.01*g.nor[j+a]))),cell=tiles.filter(t=>q[0]>=t.x&&q[0]<t.x+1&&q[1]>=t.z&&q[1]<t.z+1);assert.equal(cell.length,1);const i=cell[0].i;expected.set(i,Math.max(expected.get(i),Math.fround(g.pos[j+1])));}
  for(const t of tiles){assert.ok(Number.isFinite(actual.top[t.i])&&actual.top[t.i]>=old.base[t.i]&&actual.top[t.i]<=Math.fround(y0+H));assert.equal(actual.top[t.i],expected.get(t.i),'independently recomputed target construction envelope');rows.push({owner:b.id,tile:[t.x,t.z],before:old.top[t.i],after:actual.top[t.i],expected:expected.get(t.i)});}
 }
 for(const key of ['top','base','wallTop','blockOf']){assert.equal(actual[key].length,old[key].length);for(let i=0;i<old[key].length;i++)if(key!=='top'||!foot.has(i))assert.equal(actual[key][i],old[key][i],`exact construction ${key} at non-target or invariant tile ${i}`);}
 return{targetTiles:rows,changedTiles:rows.filter(r=>r.before!==r.after).length,nonTargetTilesExact:true,baseWallTopBlockOfExact:true,rule:'Frozen unit-d082.mjs target-footprint envelope allowance, independently recomputed from emitted source geometry. Saved world, history and simulation remain unchanged.'};
}
