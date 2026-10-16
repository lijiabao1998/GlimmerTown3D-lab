// Failure-only D067 cross-runtime geometry diagnostic. No acceptance gate or production source is changed.
// node tools/d067-diagnose.mjs --plan-only   Node/probe validation; no browser or output file
// node tools/d067-diagnose.mjs               two normal production-browser loads; writes diagnostic JSON
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {STYLES} from '../src/render/styles.ts';
import {sceneDigest,hashOf} from '../src/render/digest.ts';
import {d067City,d067Blocks,d067Civic,D067_KT} from './unit-d067.mjs';
import {createD067FrameOracle} from './d067-frame.mjs';

const QUERY='sample=seed516&clean=1&landmarkArt=legacy',VIEW={W:1440,H:1000,mobile:false};
const WORLD='JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])';
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');

// This function must be self-contained: CDP installs it before the unmodified production page starts.
export function installD067UploadProbe(){
 const proto=WebGL2RenderingContext.prototype,original={bufferData:proto.bufferData,bufferSubData:proto.bufferSubData};
 const ids=new WeakMap(),records=[],errors=[];
 const wordHash=a=>{const u=new Uint32Array(a.buffer,a.byteOffset,a.byteLength>>2);let h=0x811c9dc5;for(let i=0;i<u.length;i++)h=Math.imul(h^u[i],0x01000193)>>>0;return(Math.imul(h^u.length,0x01000193)>>>0).toString(16).padStart(8,'0');};
 const binding=(gl,target)=>target===gl.ARRAY_BUFFER?gl.getParameter(gl.ARRAY_BUFFER_BINDING):target===gl.ELEMENT_ARRAY_BUFFER?gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING):null;
 function record(gl,target){const buffer=binding(gl,target);if(!buffer)return null;let r=ids.get(buffer);if(!r){r={id:records.length,target,bytes:new Uint8Array(0),float32:false,uploads:0,subUpdates:0};ids.set(buffer,r);records.push(r);}return r;}
 function sourceBytes(data,offset=0,length=0){
  const view=ArrayBuffer.isView(data),size=view?data.BYTES_PER_ELEMENT??1:1,total=view?data.byteLength/size:data.byteLength;
  const count=length===0?total-offset:length;
  return new Uint8Array(view?data.buffer:data,(view?data.byteOffset:0)+offset*size,count*size);
 }
 proto.bufferData=function(...args){
  const result=Reflect.apply(original.bufferData,this,args);
  try{const r=record(this,args[0]);if(r){const data=args[1];r.bytes=typeof data==='number'?new Uint8Array(data):sourceBytes(data,args[3]??0,args[4]??0).slice();r.float32=data instanceof Float32Array;r.uploads++;}}
  catch(e){errors.push('bufferData capture: '+String(e));}
  return result;
 };
 proto.bufferSubData=function(...args){
  const result=Reflect.apply(original.bufferSubData,this,args);
  try{const r=record(this,args[0]);if(r){const data=sourceBytes(args[2],args[3]??0,args[4]??0);if(args[1]+data.byteLength>r.bytes.byteLength)throw Error('subData exceeds recorded GPU buffer');r.bytes.set(data,args[1]);r.float32 ||= args[2] instanceof Float32Array;r.subUpdates++;}}
  catch(e){errors.push('bufferSubData capture: '+String(e));}
  return result;
 };
 window.__d067UploadProbe={
  errors,
  summary:()=>records.map(r=>({id:r.id,target:r.target,bytes:r.bytes.byteLength,float32:r.float32,uploads:r.uploads,subUpdates:r.subUpdates})),
  select:spec=>records.filter(r=>r.float32&&r.bytes.byteLength===spec.capacity*4).map(r=>{
   const a=new Float32Array(r.bytes.buffer,r.bytes.byteOffset+spec.start*4,spec.length);
   return {id:r.id,capacity:r.bytes.byteLength/4,hash:wordHash(a),uploads:r.uploads,subUpdates:r.subUpdates};
  }).filter(r=>r.hash===spec.hash),
  bits:(id,start,length)=>{const r=records[id];if(!r)throw Error('unknown captured buffer');return Array.from(new Uint32Array(r.bytes.buffer,r.bytes.byteOffset+start*4,length));},
  stop:()=>{proto.bufferData=original.bufferData;proto.bufferSubData=original.bufferSubData;},
 };
}
export const D067_UPLOAD_PROBE='('+installD067UploadProbe.toString()+')();';

function nodeScene(){
 const city=d067City('seed516'),blocks=d067Blocks(city),con=new ConState(city.n);
 const built=buildCityScene(city,D067_KT,STYLES.A,blocks,'d',d067Civic(false),con,true);
 con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(city,k=>D067_KT.cat(k));built.setTreeAges(i=>con.siteAge(i));
 con.uni.uDayFrac.value=0;con.uni.uTime.value=2.2;
 const digest=sceneDigest(built),meshes=built.buildingMeshes(),owners=built.pickOwners();
 const ownerInfo=owner=>{
  const b=owner>0?city.buildings.find(b=>b.id===owner):owner<0?blocks.plan[-owner-1]:null;
  return {owner,category:owner>0?'facility':owner<0?'block':'unowned',kind:b?.k??null,level:b?.lv??null,variant:b?.v??null,
   parcel:b?{x:b.x,z:b.z,w:b.w??b.size,h:b.h??b.size}:null};
 };
 return {city,blocks,built,digest,meshes,owners,ownerInfo,dispose:()=>{built.dispose();con.dispose();}};
}
const numberText=n=>Object.is(n,-0)?'-0':String(n);
const bitsHex=n=>(n>>>0).toString(16).padStart(8,'0');
// Compare actual uploaded Float32 words. Pre-Float32 JavaScript intermediates cannot be recovered from a GPU upload.
export function compareD067Words(expected,actualBits,{itemSize,start=0,owners,ownerInfo}){
 assert.equal(actualBits.length,expected.length,'equal live attribute length');
 const actualWords=Uint32Array.from(actualBits),actual=new Float32Array(actualWords.buffer),expectedWords=new Uint32Array(expected.buffer,expected.byteOffset,expected.length);
 let total=0,maxAbs=0;const examples=[],byOwner={};
 for(let i=0;i<expected.length;i++)if(actualWords[i]!==expectedWords[i]){
  total++;const globalIndex=start+i,vertex=Math.floor(globalIndex/itemSize),triangle=Math.floor(vertex/3),owner=owners[triangle];
  assert.ok(owner!==undefined,'confirmed owner map covers differing triangle');byOwner[owner]=(byOwner[owner]??0)+1;
  const abs=Math.abs(actual[i]-expected[i]);if(Number.isFinite(abs))maxAbs=Math.max(maxAbs,abs);
  if(examples.length<16)examples.push({index:i,bufferIndex:globalIndex,triangle,vertex,vertexInTriangle:vertex%3,component:globalIndex%itemSize,...ownerInfo(owner),
   node:{value:expected[i],text:numberText(expected[i]),float32Bits:bitsHex(expectedWords[i])},browser:{value:actual[i],text:numberText(actual[i]),float32Bits:bitsHex(actualWords[i])},absoluteDifference:abs,rawWordDistance:Math.abs(actualWords[i]-expectedWords[i])});
 }
 return {totalDifferences:total,maxAbsoluteDifference:maxAbs,first:examples[0]??null,examples,byOwner,actualHash:hashOf(actual),nodeHash:hashOf(expected),preFloat32IntermediatesAvailable:false};
}

// Prove local hook semantics with a fake WebGL receiver; no socket or renderer is used in plan-only mode.
function validateProbe(){
 class GL{
  ARRAY_BUFFER=34962;ELEMENT_ARRAY_BUFFER=34963;ARRAY_BUFFER_BINDING=34964;ELEMENT_ARRAY_BUFFER_BINDING=34965;
  bound={};calls=[];getParameter(){return this.bound;}
  bufferData(...args){this.calls.push({name:'data',receiver:this,args});return 'original-data-result';}
  bufferSubData(...args){this.calls.push({name:'sub',receiver:this,args});return 'original-sub-result';}
 }
 const before={data:GL.prototype.bufferData,sub:GL.prototype.bufferSubData},sandbox={window:{},WebGL2RenderingContext:GL,Float32Array,Uint32Array,Uint8Array,ArrayBuffer,WeakMap,Math,Reflect};
 vm.runInNewContext(D067_UPLOAD_PROBE,sandbox);
 const gl=new GL(),a=new Float32Array([5,1,-0,3,7]),u=new Float32Array([9,2,8]);
 assert.equal(gl.bufferData(gl.ARRAY_BUFFER,a,35044,1,3),'original-data-result');
 assert.equal(gl.bufferSubData(gl.ARRAY_BUFFER,4,u,1,1),'original-sub-result');
 assert.equal(gl.calls.length,2);assert.equal(gl.calls[0].receiver,gl);assert.equal(gl.calls[0].args[1],a);assert.equal(gl.calls[1].args[2],u);
 const p=sandbox.window.__d067UploadProbe,target=new Float32Array([1,2,3]),hits=p.select({capacity:3,start:0,length:3,hash:hashOf(target)});
 assert.equal(hits.length,1);assert.deepEqual(Array.from(p.bits(hits[0].id,0,3)),Array.from(new Uint32Array(target.buffer)));assert.equal(p.errors.length,0);
 gl.bound={};gl.bufferData(gl.ARRAY_BUFFER,12,35044);gl.bufferSubData(gl.ARRAY_BUFFER,0,target);
 assert.equal(p.select({capacity:3,start:0,length:3,hash:hashOf(target)}).length,2,'numeric allocation plus subData reconstructed');
 p.stop();assert.equal(GL.prototype.bufferData,before.data);assert.equal(GL.prototype.bufferSubData,before.sub);
 const changed=new Uint32Array(target.buffer.slice(0));changed[1]++;
 const diff=compareD067Words(target,changed,{itemSize:3,owners:new Int32Array([71]),ownerInfo:owner=>({owner,kind:116})});
 assert.equal(diff.totalDifferences,1);assert.equal(diff.first.index,1);assert.equal(diff.first.owner,71);assert.equal(diff.first.kind,116);assert.equal(diff.first.rawWordDistance,1);
 return {passThroughCalls:true,offsetAndSubDataCapture:true,restoration:true,exactWordComparator:true};
}
export function d067DiagnosisPlan(){
 const local=validateProbe(),n=nodeScene(),o=createD067FrameOracle('seed516',false);
 try{
  assert.deepEqual(Object.fromEntries(Object.entries(n.digest.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),o.geometry.meshes,'diagnostic Node scene matches frame oracle');
  return {qualification:'Node-only diagnostic validation, not browser or acceptance evidence.',query:QUERY,viewport:VIEW,local,wholeTriangles:o.wholeTriangles,nodeMeshes:n.digest.meshes,
   plannedProbe:'Pass-through WebGL2 bufferData/SubData; compare exact Float32 words only after owner-order hash equality.',browserAttempted:false};
 }finally{n.dispose();o.dispose();}
}

async function browserState(p){
 return p.ev(`(()=>{const counts=x=>({calls:x.calls,triangles:x.triangles});return {
  submissions:{base:counts(__gt.renderInfo()),all:counts(__gt.renderInfoAll())},camera:__gt.cam(),
  digest:__gt.sceneDigest(),world:${WORLD},ready:!!__gt.ready,sample:__gt.sample
 };})()`);
}
async function openProduction({probe,inspect}){
 return withBrowser({root:path.join(ROOT,'dist'),width:1440,height:1000,port:+(process.env.GT_PORT??8377)},async({page,open})=>{
  const p=await pageSession(page,open,VIEW);
  if(probe)await page.send('Page.addScriptToEvaluateOnNewDocument',{source:D067_UPLOAD_PROBE});
  await p.open(QUERY);assert.equal(await p.ev('!!__gt.webgl2'),true,'actual production WebGL2');
  await p.ev('__gt.setVisT(2.2);__gt.setDayFrac(0)');await p.frames(6);
  const state=await browserState(p);assert.equal(state.ready,true);assert.equal(state.sample,'seed516');
  const result=await inspect(p,state);
  assert.deepEqual(page.errors,[],'diagnostic has no browser errors');
  assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[],'no external diagnostic requests');
  return result;
 });
}
export async function runD067Diagnosis(){
 const out=path.join(ROOT,'scratch/d067/D067-diagnose.json');fs.mkdirSync(path.dirname(out),{recursive:true});
 const report={qualification:'Failure-only diagnosis. This report is not acceptance evidence and does not relax any gate.',query:QUERY,viewport:VIEW,nodeVersion:process.version,status:'running',attributes:[]};
 const n=nodeScene();
 try{
  report.nodeMeshes=n.digest.meshes;report.probeValidation=validateProbe();
  const control=await openProduction({probe:false,inspect:async(_p,state)=>state});
  report.control={worldSha256:sha(control.world),digest:control.digest,submissions:control.submissions,camera:control.camera};
  await openProduction({probe:true,inspect:async(p,state)=>{
   report.browser={worldSha256:sha(state.world),digest:state.digest,submissions:state.submissions,camera:state.camera};
   assert.equal(state.world,control.world,'probe leaves every world layer unchanged');
   assert.deepEqual(state.digest,control.digest,'probe leaves every production scene digest unchanged');
   assert.deepEqual(state.submissions,control.submissions,'probe leaves actual submitted calls and triangles unchanged');
   assert.deepEqual(state.camera,control.camera,'probe leaves camera unchanged');
   report.probeTransparency={worldUnchanged:true,digestUnchanged:true,submittedCallsAndTrianglesUnchanged:true,cameraUnchanged:true};
   report.byOwnerMismatches=Object.keys(n.digest.meshes).filter(k=>state.digest.meshes[k]?.byOwner!==n.digest.meshes[k].byOwner);
   report.uploads=await p.ev('__d067UploadProbe.summary()');assert.deepEqual(await p.ev('__d067UploadProbe.errors'),[],'buffer capture succeeds');
   for(const [mi,name] of ['walls','other','dress'].entries()){
    const nodeDigest=n.digest.meshes[name],browserDigest=state.digest.meshes[name],mesh=n.meshes[mi];
    assert.ok(browserDigest,'browser includes '+name);assert.equal(browserDigest.tris,nodeDigest.tris,name+' live triangle count');
    // Never attribute a GPU value to a Node owner unless the complete live owner sequence agrees.
    assert.equal(browserDigest.owners,nodeDigest.owners,name+' exact owner-order hash before owner mapping');
    assert.deepEqual(browserDigest.ownerTris,nodeDigest.ownerTris,name+' per-owner triangle counts');
    const g=mesh.geometry,vertexStart=g.drawRange.start,vertexEnd=Math.min(g.attributes.position.count,vertexStart+g.drawRange.count);
    for(const [attr,browserHash] of Object.entries(browserDigest.attrs)){
     if(browserHash===nodeDigest.attrs[attr])continue;
     const a=g.attributes[attr];assert.ok(a?.array instanceof Float32Array,'known Float32 attribute '+name+'.'+attr);
     const spec={capacity:a.array.length,start:vertexStart*a.itemSize,length:(vertexEnd-vertexStart)*a.itemSize,hash:browserHash};
     const candidates=await p.ev(`__d067UploadProbe.select(${JSON.stringify(spec)})`);
     const row={mesh:name,attribute:attr,itemSize:a.itemSize,nodeHash:nodeDigest.attrs[attr],browserHash,ownersHash:browserDigest.owners,spec,candidates};report.attributes.push(row);
     if(!candidates.length){row.error='No captured full-capacity buffer matches the browser live attribute hash';continue;}
     const words=await p.ev(`__d067UploadProbe.bits(${candidates[0].id},${spec.start},${spec.length})`);
     for(const duplicate of candidates.slice(1))assert.deepEqual(await p.ev(`__d067UploadProbe.bits(${duplicate.id},${spec.start},${spec.length})`),words,'same-hash candidate buffers must have identical live words');
     row.difference=compareD067Words(a.array.subarray(spec.start,spec.start+spec.length),words,{itemSize:a.itemSize,start:spec.start,owners:n.owners[mi],ownerInfo:n.ownerInfo});
     assert.equal(row.difference.actualHash,browserHash,'captured words reproduce browser attribute hash');
     assert.equal(row.difference.nodeHash,nodeDigest.attrs[attr],'Node live words reproduce Node attribute hash');
    }
   }
   const after=await browserState(p);assert.equal(after.world,state.world,'inspection does not change world');assert.deepEqual(after.digest,state.digest,'inspection does not change geometry');
   assert.deepEqual(after.submissions,state.submissions,'inspection does not change submitted calls or triangles');assert.deepEqual(after.camera,state.camera,'inspection does not change camera');
   await p.ev('__d067UploadProbe.stop()');report.probeRestored=true;
  }});
  report.totalDifferentComponents=report.attributes.reduce((s,a)=>s+(a.difference?.totalDifferences??0),0);
  report.status=report.attributes.some(a=>a.error)?'incomplete-buffer-match':report.totalDifferentComponents?'diagnosed-differences':'no-attribute-difference';
 }catch(e){report.status='blocked-or-diagnostic-error';report.error=e.stack??String(e);}
 finally{n.dispose();fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
 return {report,file:out};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.includes('--plan-only'))console.log(JSON.stringify(d067DiagnosisPlan(),null,2));
 else{const {report,file}=await runD067Diagnosis();console.log(JSON.stringify({status:report.status,file,totalDifferentComponents:report.totalDifferentComponents,firstDifferences:report.attributes.map(a=>({mesh:a.mesh,attribute:a.attribute,first:a.difference?.first,error:a.error})),error:report.error},null,2));process.exitCode=['blocked-or-diagnostic-error','incomplete-buffer-match'].includes(report.status)?1:0;}
}
