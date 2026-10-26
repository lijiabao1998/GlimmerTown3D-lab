// D089 finite current contract. Original proposals/d083/native-integration-check-d088.mjs remains byte-exact at c023a2da0e4999d43e3d4216e800c4c96d06a3c1.
// D088 finite current contract. Original proposals/d083/native-integration-check-d087.mjs remains byte-exact at cdd541da74973dba2ca73b782936c012d315add9.
// D087 finite current contract. Original proposals/d083/native-integration-check-d086.mjs is unchanged at b4275bda73e72a9fb48343376fccaab52bbc8e84.
// D086 current-version contract. Original proposals/d083/native-integration-check.mjs remains unchanged and tested on77b8616.
// Focused native product checks. Never substitutes for the still-red D082 gates.
import {assertD089PreD086KindMetadata} from '../../tools/d089-kind-metadata-contract.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {KINDS} from '../../src/content/kinds.ts';
import {kindTableFrom} from '../../src/content/kindTable.ts';
import {RURAL_HERITAGE_BUILDINGS as MODELS,withRuralHeritageKinds} from '../../src/content/britishRuralHeritage.ts';
import {HERITAGE_TOOLS,FACILITY_TOOLS,previewOp,commitOp,undoOp} from '../../src/sim/edit.ts';
import {canPlaceHeritage,tapHeritage} from '../../src/sim/heritageBuild.ts';
import {FOREIGN_LAYERS} from '../../src/sim/rules/build.ts';
import {saveCode,loadCode} from '../../src/io/save.ts';
import {encodeLabCode,decodeLabCode} from '../../src/io/labcode.ts';
import {stepDay} from '../../src/sim/day.ts';
import {galleryLayout} from '../../src/content/gallery.ts';
import {Geo} from '../../src/render/scene.ts';
import {Pen,drawKind} from '../../src/render/kindArt.ts';
import {shapeOf,kindColors} from '../../src/content/kindShapes.ts';
import {emitD083Prototype} from './models.mjs';
import {emitNativeReference,assertNativeArtCorrection,ACCEPTED_SOURCE_SHA} from './native-art-reference.mjs';
import {drawBritishRuralHeritage} from '../../src/render/britishRuralHeritageArt.ts';
import {buildCityScene} from '../../src/render/cityScene.ts';
import {ConState} from '../../src/render/construction.ts';
import {STYLES} from '../../src/render/styles.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=x=>createHash('sha256').update(x).digest('hex');
const out=path.resolve('scratch/d089-native/d083-current');fs.mkdirSync(out,{recursive:true});
const report={qualification:'Focused native D083 functionality, immutable accepted art and the explicit12-triangle containment correction. Not historical-source, whole-frame budget, old D082 coverage, full CI or release acceptance.',complete:false,checks:[],negativeControls:0,blockedFootprintCases:0,affineCases:0,pickedOwners:[],oldAcceptedModelCases:0,releasePrerequisite:'D082 remains blocked; old gates are unchanged.'};
const write=()=>fs.writeFileSync(path.join(out,'native-integration-report.json'),JSON.stringify(report,null,2));
const vrank=read('src/content/samples/d009-live.json').vrank,baseData=read('src/content/lab-kinds.json'),legacyKT=kindTableFrom(baseData),LOOKS=read('src/content/lab-looks.json').looks;
const acceptedPlan=read('proposals/d083/game-preview-plan.json');
const N=32,raw={v:1,n:N,seed:20261083,day:0,money:20000,nm:'D083 native integration',df:1,ter:'2'.repeat(N*N),tre:'0'.repeat(N*N),bl:[]},start=encodeLabCode(raw,{deflate:true});
function loaded(code=start){const r=loadCode(code,KINDS,vrank);assert.ok(r.ok,r.error);return r;}
const op=(tool,x,z,k='tap')=>({k,tool,x0:x,z0:z,x1:x,z1:z});
const coords=i=>[3+(i%4)*6,4+Math.floor(i/4)*8];
function state(s){return{w:s.w,g:s.g,budget:s.budget,rng:s.rng,resource:s.res.resource,money:s.money,diff:s.diff,tech:s.edu.tech,spec:s.edu.spec,landDirty:s.landDirty,landBox:s.landBox,txn:null,dozeArm:s.dozeArm,protect:true};}
function draw(m,{s=2,H=m.H,x0=3.125,z0=7.375,y0=.21,v=m.v,owner=71,prototype=false}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()];G.forEach(g=>g.owner=owner);const trees=[],a={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k:m.k,v,C:kindColors(LOOKS,m.k,1,KINDS.catColor(KINDS.cat(m.k)))};
 const acceptedScale=acceptedPlan.plots.find(p=>p.id===m.id)?.H;
 const referenceH=acceptedScale===m.H?H:H===m.H?acceptedScale:H/m.H*acceptedScale;
 const used=prototype?(emitNativeReference(new Pen({...a,H:referenceH}),m.id),[]):[...drawKind(a,shapeOf(m.k,...Array(18).fill(true)))];return{G,trees,used};
}
const arrays=r=>r.G.map(g=>Object.fromEntries(['pos','nor','col','uv','wst','wgl','wbd','owners','tags'].map(k=>[k,g[k]])));
function bytes(r){const h=createHash('sha256');for(const g of r.G)for(const k of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(k+':'+g[k].length+':');h.update(Buffer.from(Float64Array.from(g[k]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');}
async function check(name,fn){try{await fn();report.checks.push({name,passed:true});console.log('OK',name);}catch(e){report.checks.push({name,passed:false,error:e.stack??String(e)});console.error('NG',name,String(e.message).slice(0,800));}}
await check('append-only catalogue, eight tools, old rows and gallery coordinates retained',()=>{
 assertD089PreD086KindMetadata(KINDS.data.kinds.slice(0,baseData.kinds.length),baseData.kinds);
 assert.deepEqual(MODELS.map(m=>m.k),[187,188,189,190,191,192,193,194]);assert.equal(new Set(KINDS.data.kinds.map(k=>k.k)).size,KINDS.data.kinds.length);
 assert.throws(()=>withRuralHeritageKinds(KINDS.data));report.negativeControls++;
 assert.equal(HERITAGE_TOOLS.length,8);assert.equal(new Set(FACILITY_TOOLS.map(t=>t.id)).size,FACILITY_TOOLS.length);
 for(const m of MODELS){assert.equal(KINDS.size(m.k),2);assert.equal(KINDS.height(m.k,1,0),m.H);assert.ok(FACILITY_TOOLS.some(t=>t.id===m.tool&&t.size===2));}
 const old=galleryLayout(baseData.kinds),current=galleryLayout(KINDS.data.kinds);assert.deepEqual(current.slice(0,old.length),old);assert.equal(current.length,old.length+8);
});
await check('immutable accepted source, finite12-triangle containment correction and exact native affine emission',()=>{
 assert.equal(sha(fs.readFileSync('proposals/d083/models.mjs')),ACCEPTED_SOURCE_SHA);report.nativeArtCorrection=assertNativeArtCorrection();
 for(const m of MODELS)for(const options of [{},{s:1,H:.4,x0:-2,z0:4,y0:.1},{s:4,H:2.1,x0:5.25,z0:-3.125,y0:.31}]){
  const actual=draw(m,options),expected=draw(m,{...options,prototype:true});assert.deepEqual(arrays(actual),arrays(expected));
  assert.ok(actual.G[1].owners.length>0&&actual.G[1].owners.every(o=>o===71));assert.equal(actual.G[0].owners.length,0);assert.equal(actual.G[2].owners.length,0);report.affineCases++;
 }
 // Retain explicit before/after evidence: this is not called the same surface.
 for(const m of MODELS){const old=draw(m),G=[new Geo({ext:true}),new Geo(),new Geo()];G.forEach(g=>g.owner=71);const H=acceptedPlan.plots.find(p=>p.id===m.id).H;emitD083Prototype(new Pen({W:G[0],O:G[1],D:G[2],trees:[],x0:3.125,z0:7.375,y0:.21,s:2,H,k:m.k,v:0,C:{}}),m.id);if(m.k!==187)assert.deepEqual(arrays(old),arrays({G}));else assert.notDeepEqual(arrays(old),arrays({G}));}
 for(const m of MODELS)for(const v of [1,-1,null,undefined,'0',NaN]){const r=draw(m),a={W:r.G[0],O:r.G[1],D:r.G[2],trees:[],x0:0,z0:0,y0:0,s:2,H:m.H,k:m.k,v,C:{}},before=sha(JSON.stringify(arrays(r)));assert.equal(drawBritishRuralHeritage(new Pen(a)),false);assert.equal(sha(JSON.stringify(arrays(r))),before);report.negativeControls++;}
});
await check('all130 previously accepted model byte pins retained',()=>{
 const fixture=read('fixtures/d082-geometry-before.json');
 for(const[key,pin]of Object.entries(fixture.priorModels)){const[k,v]=key.split(':').map(Number),m={k,v,H:Math.max(.12,legacyKT.height(k,1,v))};assert.equal(bytes(draw(m,{s:legacyKT.size(k)})),pin.float64Sha256,key);report.oldAcceptedModelCases++;}
 assert.equal(report.oldAcceptedModelCases,130);
});
await check('every tile blocks roads, water, ruins, craters, buildings and foreign layers without partial writes',()=>{
 const s=loaded().sim,st=state(s),blocked=[['t',0],['t',3],['road',1],['ruin',1],['crater',1],['bld',{k:4,lv:1,v:0,age:9}],...FOREIGN_LAYERS.map(k=>[k,1])];
 for(const m of MODELS)for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++)for(const[key,value]of blocked){const i=(6+dz)*N+5+dx,before=structuredClone(st.w.tiles[i]);st.w.tiles[i][key]=value;const world=JSON.stringify(st.w.tiles),money=st.money;assert.ok(canPlaceHeritage(st,m.tool,5,6));assert.equal(tapHeritage(st,m.tool,5,6).ok,false);assert.equal(JSON.stringify(st.w.tiles),world);assert.equal(st.money,money);st.w.tiles[i]=before;report.blockedFootprintCases++;}
 for(const m of MODELS)for(const[x,z]of [[-1,0],[31,0],[0,31],[1.5,2],[NaN,2]]){assert.ok(canPlaceHeritage(st,m.tool,x,z));report.negativeControls++;}
 assert.throws(()=>canPlaceHeritage(st,'heritageUnknown',5,6));report.negativeControls++;
});
await check('insufficient funds, sandbox, tree surcharge, tech and transaction controls',()=>{
 for(const m of MODELS){const st=state(loaded().sim);st.money=m.cost-1;const before=JSON.stringify(st.w.tiles);assert.equal(tapHeritage(st,m.tool,5,6).ok,false);assert.equal(JSON.stringify(st.w.tiles),before);report.negativeControls++;
  st.money=m.cost;st.tech=['B5','C8','D4a'];st.spec='hub';st.w.tiles[6*N+5].tree=1;const expected=(m.cost+2)*.95*.95*.90*1.05,r=tapHeritage(st,m.tool,5,6);assert.ok(r.ok);assert.equal(r.txn.spent,expected);assert.equal(r.txn.snaps.length,4);assert.equal(new Set(r.txn.snaps.map(s=>s.i)).size,4);assert.equal(st.money,m.cost-expected);
  const sandbox=state(loaded().sim);sandbox.diff=3;sandbox.money=0;assert.equal(tapHeritage(sandbox,m.tool,5,6).txn.spent,0);
  const unsupported=loaded().sim;for(const k of ['line','rect']){const r=commitOp(unsupported,op(m.tool,5,6,k),0);assert.equal(r.ok,false);assert.equal(r.spent,0);report.negativeControls++;}
 }
});
let builtCode,finishedCode,buildingRows;
await check('real commitOp places eight four-tile owned buildings; exact save/load/history replay',()=>{
 const L=loaded(),s=L.sim;fs.writeFileSync(path.join(out,'initial.code.txt'),start);
 for(const[m,i]of MODELS.map((m,i)=>[m,i])){const[x,z]=coords(i),operation=op(m.tool,x,z),pv=previewOp(s,operation);assert.equal(pv.cells.length,4);assert.equal(pv.count,1);assert.equal(pv.total,m.cost);const r=commitOp(s,operation,10000*i);assert.ok(r.ok,r.reason);assert.equal(r.spent,m.cost);assert.equal(r.events.length,1);assert.equal(r.events[0].k,m.k);const b=s.city.buildings.at(-1);assert.deepEqual([b.k,b.lv,b.v,b.size,b.x,b.z],[m.k,1,0,2,x,z]);for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++)assert.equal(s.city.occ[(z+dz)*N+x+dx],b.id);assert.equal(s.txns.at(-1).txn.snaps.length,4);}
 builtCode=saveCode(s,L.template,L.start);fs.writeFileSync(path.join(out,'built-day0.code.txt'),builtCode);const R=loaded(builtCode);assert.equal(R.replayed,true);assert.deepEqual(R.sim.city.buildings,s.city.buildings);assert.deepEqual(R.sim.city.history,s.city.history);
 assert.equal(loaded(saveCode(R.sim,R.template,R.start)).replayed,true);
 buildingRows=s.city.buildings.map(b=>({...b}));report.buildings=buildingRows;report.placeEvents=s.city.history.filter(e=>e.t==='place').length;
});
await check('native child-tile demolition and undo/refund restore complete footprints',()=>{
 assert.ok(builtCode);const L=loaded(builtCode),s=L.sim;
 for(const[m,i]of MODELS.map((m,i)=>[m,i])){const[x,z]=coords(i),before=s.money,r=commitOp(s,op('doze',x+1,z+1),i*10000);assert.ok(r.ok);for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++)assert.equal(s.city.occ[(z+dz)*N+x+dx],0);const u=undoOp(s);assert.ok(u.ok);assert.equal(s.money,before);for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++)assert.equal(s.city.occ[(z+dz)*N+x+dx],buildingRows[i].id);}
 const T=loaded(),before=T.sim.money;commitOp(T.sim,op(MODELS[0].tool,5,6),0);assert.equal(undoOp(T.sim).refund,MODELS[0].cost);assert.equal(T.sim.money,before);assert.equal(T.sim.city.occ[6*N+5],0);
 const round=loaded(saveCode(s,L.template,L.start));assert.equal(round.replayed,true);
});
await check('nine native days complete construction; regular scene owner attributes and raycast picking',()=>{
 assert.ok(builtCode);const L=loaded(builtCode),s=L.sim;for(let d=0;d<9;d++)stepDay(s);assert.ok(s.city.buildings.every(b=>b.age>=9));finishedCode=saveCode(s,L.template,L.start);fs.writeFileSync(path.join(out,'finished-day9.code.txt'),finishedCode);assert.equal(loaded(finishedCode).replayed,true);
 const con=new ConState(N),civic={shape:k=>shapeOf(k,...Array(18).fill(true)),colors:(k,lv)=>kindColors(LOOKS,k,lv,KINDS.catColor(KINDS.cat(k)))};con.setCity(s.city,k=>KINDS.cat(k));
 const built=buildCityScene(s.city,KINDS,STYLES.A,{mode:'c',plan:[]},'d',civic,con,true);
 if(built.con)con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(s.city,k=>KINDS.cat(k));
 try{assert.equal(built.owners(),8);built.scene.updateMatrixWorld(true);const owners=built.pickOwners(),meshes=built.buildingMeshes();
  for(const b of s.city.buildings){const n=owners.reduce((sum,a)=>sum+Array.from(a).filter(o=>o===b.id).length,0);assert.ok(n>0);for(let mi=0;mi<meshes.length;mi++){const a=meshes[mi].geometry.attributes.aCon;if(!a)continue;for(let ti=0;ti<owners[mi].length;ti++)if(owners[mi][ti]===b.id)for(let j=0;j<3;j++){assert.ok(a.getX(ti*3+j)>=b.x&&a.getX(ti*3+j)<b.x+2);assert.ok(a.getY(ti*3+j)>=b.z&&a.getY(ti*3+j)<b.z+2);}}
   const a=built.anchorOf(b.id);assert.ok(a);const origin=a.clone().add(new THREE.Vector3(8,6,8)),ray=new THREE.Raycaster(origin,a.clone().sub(origin).normalize()),hit=built.pick(ray);assert.equal(hit?.id,b.id,'actual scene raycast owner '+b.k);report.pickedOwners.push(b.id);assert.ok(con.has(b.z*N+b.x));assert.equal(con.uni.uNoClip.value,0);
  }
  report.nativeSceneMeshStats=built.meshStats();report.construction={normalOwnedAttributes:true,noClip:0,completedAfterNativeDays:9};
 }finally{built.dispose();con.dispose();}
});
report.complete=true;report.passed=report.checks.every(c=>c.passed);write();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,negativeControls:report.negativeControls,blockedFootprintCases:report.blockedFootprintCases,affineCases:report.affineCases,oldAcceptedModelCases:report.oldAcceptedModelCases,pickedOwners:report.pickedOwners.length}));if(!report.passed)process.exitCode=1;
