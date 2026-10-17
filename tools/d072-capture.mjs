// D072 actual production WebGL pairs. Never substitute manufactured cities or pictures.
// Three original cities × native and render-only copied saved v0/v1/v2 × three viewports.
// Ten distinct campus saved slots, four existing kinds; not ten native placement tools.
// node tools/d072-capture.mjs retains the original 132 views, any necessary Node-audited alternate angles, and labelled pair sheets.
// --plan-only validates the plan in Node and never launches a browser.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {D057_SAME} from './d057-native.mjs';
import {pathToFileURL} from 'node:url';
import {CAMPUS_BUILDINGS,CAMPUS_KINDS} from '../src/content/britishCampuses.ts';
import {D072_OLD,d072City,d072Expected} from './unit-d072.mjs';
import {createD072FrameOracle,assertD072Frame,assertD072CampusCamera,D072_FRAME_WHOLE} from './d072-frame.mjs';
import {D067_UPLOAD_PROBE} from './d067-diagnose.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const OUT=path.join(ROOT,'scratch/d072'),PORT=+(process.env.GT_PORT??8370);
export const D072_VIEWPORTS=[{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}];
const WIDTHS=(process.env.D072_WIDTHS??'').split(',').map(w=>w.trim()).filter(Boolean).map(Number);
for(const w of WIDTHS)assert.ok(D072_VIEWPORTS.some(v=>v.W===w),'recognized viewport '+w);
const viewports=D072_VIEWPORTS.filter(v=>!WIDTHS.length||WIDTHS.includes(v.W));assert.ok(viewports.length,'at least one supported viewport');
// These are ten distinct existing saved kind/variant slots, never ten native tools.
export const D072_SLOTS=Object.freeze([
 {k:109,v:1,name:'Low-rise innovation workshops'}, {k:109,v:2,name:'Research tower and incubator'},
 {k:48,v:0,name:'Pavilion general hospital'}, {k:48,v:1,name:'District hospital courtyard'}, {k:48,v:2,name:'Hospital ward tower and clinics'},
 {k:115,v:0,name:'Civic assembly rotunda'}, {k:115,v:1,name:'Interwar civic forum'}, {k:115,v:2,name:'Neighbourhood civic campus'},
 {k:31,v:0,name:'Low prison courtyard compound'}, {k:31,v:1,name:'Radial Victorian prison'},
].map(Object.freeze));
const KINDS=[109,48,115,31];
assert.deepEqual(CAMPUS_BUILDINGS.map(m=>[m.k,m.v]),D072_SLOTS.map(m=>[m.k,m.v]),'complete and ordered production ten-slot catalogue');
assert.deepEqual([...CAMPUS_KINDS],KINDS,'exactly four existing kinds implement the ten saved slots');
// Appended real production spin views. Angles are chosen by the Node owner-ray audit,
// without changing any scene object, neighbor, parcel, visibility or camera clipping plane.
export const D072_ALTERNATE_VIEWS=Object.freeze({});
const active=(city,b)=>b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n;
export const D072_CAPTURE_SOURCES=['gallery','seed516','ai120'].flatMap(sample=>[null,0,1,2].map(force=>{
 const city=d072City(sample),targets=city.buildings.filter(b=>active(city,b)&&KINDS.includes(b.k)),variant=force===null?'native':'v'+force;
 assert.equal(targets.length,sample==='gallery'?4:0,sample+' exact existing campus-kind owners');
 const id=sample+'-'+(force===null?'native-existing-city':'copied-saved-variant-'+variant+'-showcase');
 const label=force===null?sample.toUpperCase()+' NATIVE EXISTING CITY':sample.toUpperCase()+' COPIED SAVED-VARIANT '+variant+' SHOWCASE · NOT TEN NATIVE TOOLS';
 const qualification=force===null?'Original paused '+sample+' city with original saved variants.':
  'Original paused '+sample+' city. __gt.campusV('+force+') makes render-only copies only for the ten supported saved kind/variant slots; unsupported requests keep the original building record (k109 force0 keeps native v0; k31 force2 keeps native v0). Original world records remain unchanged. Four existing kinds supply ten distinct saved kind/variant slots across v0/v1/v2; this is not ten native placement tools.';
 const slots=sample==='gallery'&&force!==null?D072_SLOTS.filter(s=>s.v===force):[];
 const sites=slots.map(m=>{
  const b=targets.find(b=>b.k===m.k);assert.ok(b,'existing source building for k'+m.k);
  return {...m,id:id+'-k'+m.k+'-v'+m.v,buildingId:b.id,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size,sourceVariant:b.v,renderedVariant:m.v,level:b.lv,parcel:{x:b.x,z:b.z,size:b.size}};
 });
 const shots=[{id:id+'-overview',name:force===null?'Native existing-city overview':'Copied saved-variant '+variant+' overview (not ten native tools)',x:city.n/2,z:city.n/2,size:city.n},...sites];
 for(const site of sites){const extra=D072_ALTERNATE_VIEWS[site.k+':'+site.v];if(extra)shots.push({...site,id:site.id+'-'+extra.name,name:site.name+' · '+extra.label+' / ADDITIONAL CAMERA VIEW',additionalView:extra.name,spinRadians:extra.spinRadians});}
 return {sample,id,label,qualification,force,variant,n:city.n,sites,shots,targets:targets.map(b=>({id:b.id,k:b.k,x:b.x,z:b.z,size:b.size,lv:b.lv,v:b.v})),sampleSha256:sha(fs.readFileSync(path.join(ROOT,'src/content/samples/'+sample+'.code.txt')))};
}));
const SOURCES=D072_CAPTURE_SOURCES;
assert.equal(SOURCES.length,12,'three original cities × native and three copied variant previews');
assert.deepEqual(SOURCES.flatMap(s=>s.sites.map(x=>x.k+':'+x.v)).sort(),D072_SLOTS.map(s=>s.k+':'+s.v).sort(),'each of the ten saved slots has exactly one closeup per viewport/phase');
assert.equal(SOURCES.reduce((n,s)=>n+s.shots.filter(x=>!x.additionalView).length,0),22,'all original ten slot closeups and twelve overviews are retained');
const ADDITIONAL_ANGLES=Object.keys(D072_ALTERNATE_VIEWS).length;
assert.equal(SOURCES.reduce((n,s)=>n+s.shots.filter(x=>x.additionalView).length,0),ADDITIONAL_ANGLES,'one appended view for each independently diagnosed occluded slot');
assert.equal(SOURCES.reduce((n,s)=>n+s.shots.length,0),22+ADDITIONAL_ANGLES,'original 22 shots plus necessary unoccluded alternatives');
const ORIGINALS_PER_VIEWPORT=2*SOURCES.reduce((n,s)=>n+s.shots.length,0);
const COMPLETE_ORIGINALS=D072_VIEWPORTS.length*ORIGINALS_PER_VIEWPORT;
assert.equal(COMPLETE_ORIGINALS,132+6*ADDITIONAL_ANGLES,'all 132 original views plus both phases and three widths for each alternate');
const zoomFor=(source,s,v)=>s.k?Math.min(8,.70*.84*source.n*(v.W/v.H)/(s.size*Math.SQRT2)):Math.max(.6,.54*v.W/v.H);
// Sample saves can be null. Include every world layer, the source building list, stats and history as well.
const WORLD=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])`;
const DIGEST=`(()=>{const d=__gt.sceneDigest();return JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts});})()`;
const PIXELS=`(async()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=c.width;k.height=c.height;const x=k.getContext('2d');x.drawImage(c,0,0);const d=x.getImageData(0,0,k.width,k.height).data;let s=0,q=0,n=0;for(let i=0;i<d.length;i+=4){const l=d[i]*.3+d[i+1]*.59+d[i+2]*.11;s+=l;q+=l*l;n++;}const hash=await crypto.subtle.digest('SHA-256',d);return {width:k.width,height:k.height,variance:q/n-(s/n)**2,sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};})()`;
const externalRequests=requests=>requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
const jsonWrite=(file,value)=>fs.writeFileSync(path.join(OUT,file),J(value,null,2)+'\n');
function expectedBudgets(){
 const expected=d072Expected();
 for(const s of SOURCES){const e=expected[s.variant][s.sample];assert.equal(e.legacy,D072_OLD[s.variant][s.sample].c[0],s.id+' exact immutable D071 baseline');assert.equal(e.campus-e.legacy,e.delta);assert.ok(e.delta<=0,s.id+' no triangle growth');for(const phase of ['legacy','campus'])assert.equal(e[phase],D072_FRAME_WHOLE[s.variant][s.sample][phase],s.id+' exact immutable '+phase+' frame pin');}
 return expected;
}
export function d072CapturePlan(expected=expectedBudgets()){
 return {passed:true,captured:false,qualification:'Source coverage, camera plan and Node triangle counts only. This plan file is not screenshot evidence; --plan-only never launches a browser.',expected,viewports,
  plannedOriginalPngs:viewports.length*ORIGINALS_PER_VIEWPORT,completeThreeViewportOriginalPngs:COMPLETE_ORIGINALS,preservedOriginalViews:132,additionalCampusViews:6*ADDITIONAL_ANGLES,sources:SOURCES.map(s=>({...s,shots:s.shots.map(shot=>({...shot,zooms:Object.fromEntries(viewports.map(v=>[v.W,zoomFor(s,shot,v)]))}))}))};
}
async function sourceLabel(p,source,shot){
 // The same factual caption appears in both phases. It never supplies the changed-pixels evidence.
 const detail=(shot.k?'k'+shot.k+':v'+shot.renderedVariant+' · '+shot.name+' · owner '+shot.buildingId+' · source v'+shot.sourceVariant+' unchanged':shot.name);
 await p.ev(`(()=>{let label=document.getElementById('d072-source-label');if(!label){label=document.createElement('div');label.id='d072-source-label';label.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;box-sizing:border-box;padding:8px 12px;background:rgba(15,22,29,.90);color:#fff;font:12px/1.45 sans-serif;pointer-events:none;white-space:pre-line';document.body.append(label);}label.textContent=${J(source.label+'\n'+detail)};})()`);
}
async function settledCamera(p,source,shot,v){
 await p.ev(`__gt.view(${shot.x},${shot.z},${zoomFor(source,shot,v)});__gt.setVisT(2.2);__gt.setDayFrac(0)`);await p.frames(25);
 let stable=0,last=await p.ev('__gt.cam()');
 for(let i=0;i<24&&stable<2;i++){await p.frames(20);const next=await p.ev('__gt.cam()'),delta=Math.max(...['pos','target'].flatMap(k=>next[k].map((x,j)=>Math.abs(x-last[k][j]))),Math.abs(next.zoom-last.zoom));stable=delta<1e-9?stable+1:0;last=next;}
 assert.equal(stable,2,'observed a settled camera');
 if(shot.additionalView){
  assert.ok(D072_SLOTS.some(s=>s.k===shot.k&&s.v===shot.renderedVariant),'alternate is an exact supported campus slot');
  assert.ok(Number.isFinite(shot.spinRadians)&&shot.spinRadians!==0,'nonzero audited production spin angle');
  const initial=last;
  // spin is an existing production OrbitControls hook. Synchronous zero-angle updates drain
  // damping deterministically; no direct camera assignment, scene edit or clipping change is used.
  await p.ev('__gt.spin('+shot.spinRadians+');for(let i=0;i<900;i++)__gt.spin(0)');
  last=await p.ev('__gt.cam()');assertD072CampusCamera(last,initial,shot.spinRadians);
  await p.frames(20);assert.deepEqual(await p.ev('__gt.cam()'),last,'additional camera is at an exact damping fixed point');
 }
 return last;
}
async function uploadState(p){
 return p.ev(`(()=>{const r=__gt.renderInfo(),a=__gt.renderInfoAll();return {world:${WORLD},digest:__gt.sceneDigest(),camera:__gt.cam(),render:{calls:r.calls,triangles:r.triangles},renderAll:{calls:a.calls,triangles:a.triangles}};})()`);
}
async function verifyUploadedGeometry(p,oracle,item){
 const before=await uploadState(p),words={};
 item.rawSceneDigest=before.digest;
 assert.deepEqual(await p.ev('__d067UploadProbe.errors'),[],'pass-through upload probe has no capture errors');
 for(const [name,spec] of Object.entries(oracle.normalSpecs)){
  const hash=before.digest.meshes[name].attrs.normal;
  if(hash===spec.hash)continue;
  const candidates=await p.ev(`__d067UploadProbe.select(${J({...spec,hash})})`);
  assert.ok(candidates.length,'captured normal upload reproduces browser hash: '+name);
  words[name]=await p.ev(`__d067UploadProbe.bits(${candidates[0].id},${spec.start},${spec.length})`);
  for(const duplicate of candidates.slice(1))assert.deepEqual(await p.ev(`__d067UploadProbe.bits(${duplicate.id},${spec.start},${spec.length})`),words[name],'same-hash normal buffers have identical live words');
 }
 item.geometryComparison=oracle.assertBrowserGeometry(before.digest,words);
 item.normalArithmetic={node:[4,5].map(i=>{const angle=i*(Math.PI*2/6);return {angle,cos:Math.cos(angle),sin:Math.sin(angle)};}),browser:await p.ev('[4,5].map(i=>{const angle=i*(Math.PI*2/6);return {angle,cos:Math.cos(angle),sin:Math.sin(angle)};})')};
 // The pass-through probe remains live until native and copied geometries have both been verified.
 assert.deepEqual(await uploadState(p),before,'normal inspection/restoration preserves world, raw geometry, camera and submitted geometry');
 item.uploadProbe={worldGeometryCameraAndSubmissionsUnchanged:true};
 item.geometrySha256=sha(before.digest);
}
async function capturePhase(v,phase,source,expected,item){
 Object.assign(item,{viewport:v,phase,sample:source.sample,variant:source.variant,force:source.force,sourceQualification:source.qualification,query:`sample=${source.sample}&clean=1`+(phase==='before'?'&campusArt=legacy':'&campusArt=legacy'),shots:[],passed:false});
 const oracle=createD072FrameOracle(source.sample,phase==='after',source.force);
 try{await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:PORT},async({page,open})=>{
  try{
   const p=await pageSession(page,open,v);
   await page.send('Page.addScriptToEvaluateOnNewDocument',{source:D067_UPLOAD_PROBE});
   await p.open(item.query);
   assert.equal(await p.ev('!!__gt.ready'),true,'production scene ready');assert.equal(await p.ev('__gt.sample'),source.sample,'requested source sample');
   assert.equal(await p.ev('__gt.webgl2'),true,'real WebGL2 production renderer');assert.equal((await p.ev('__gt.sim()'))?.playing??false,false,'world clock paused');
   assert.equal(await p.ev('__gt.blockMode()'),'c','the same default block mode as the Node budget');
   await p.ev('document.fonts.ready');
   await p.ev('__gt.setVisT(2.2);__gt.setDayFrac(0)');await p.frames(6);
   item.webgl=await p.ev(`(()=>{const gl=document.querySelector('canvas').getContext('webgl2');return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),contextLost:gl.isContextLost()};})()`);
   assert.equal(item.webgl.contextLost,false,'WebGL context is live');
   await settledCamera(p,source,source.shots[0],v);
   const initial=await p.ev(WORLD),nativeDigest=await p.ev(DIGEST),list=await p.ev('__gt.buildingList()');
   item.worldSha256=sha(initial);item.nativeDigestSha256=sha(nativeDigest);
   item.nativeGeometry={};
   const nativeOracle=createD072FrameOracle(source.sample,phase==='after',null);
   try{await verifyUploadedGeometry(p,nativeOracle,item.nativeGeometry);}finally{nativeOracle.dispose();}
   if(source.force!==null){
    const camera=await p.ev('__gt.cam()');
    assert.equal(await p.ev('__gt.campusV('+source.force+')'),source.force,'explicit render-only copied saved-variant showcase hook');await p.frames(6);
    assert.equal(await p.ev(WORLD),initial,'forcing copied saved variants never mutates the source world');
    assert.deepEqual(await p.ev('__gt.cam()'),camera,'forcing copied saved variants preserves the settled camera');
   }
   const dig=await p.ev(DIGEST);item.digestSha256=sha(dig);
   if(source.force===null||source.force===0||source.sample!=='gallery')assert.equal(dig,nativeDigest,'native/v0 or no-target copied preview equals exact native geometry');
   // Raw browser attributes remain recorded. Only the three source-proven D060 kiln-face
   // numerical-zero normals can be canonicalized in cloned comparison data; no source is changed.
   await verifyUploadedGeometry(p,oracle,item);
   const probeBefore=await uploadState(p);await p.ev('__d067UploadProbe.stop()');
   assert.deepEqual(await uploadState(p),probeBefore,'restoring upload functions preserves world, geometry, camera and submissions');
   item.uploadProbe.restored=true;item.nativeGeometry.uploadProbe.restored=true;
   const actualTargets=list.filter(b=>KINDS.includes(b[1]));
   assert.deepEqual(actualTargets.map(b=>b[0]).sort((a,b)=>a-b),source.targets.map(b=>b.id).sort((a,b)=>a-b),'browser contains exactly the source target owners');
   for(const b of source.targets){const row=list.find(row=>row[0]===b.id);assert.deepEqual(row.slice(0,7),[b.id,b.k,b.x,b.z,b.size,b.lv,b.v],'actual unmodified source building, variant and level');}
   for(const s of source.shots){
    const camera=await settledCamera(p,source,s,v);await sourceLabel(p,source,s);await p.frames(3);
    const info=await p.ev('__gt.renderInfo()'),all=await p.ev('__gt.renderInfoAll()');
    assert.ok(info.calls<=18,'existing base draw-call ceiling');assert.ok(all.calls<=20,'existing all-content draw-call ceiling');
    // Independently predict color and shadow submissions from actual production geometry and camera.
    // Existing-city negative controls and all gallery views retain their actual independent frusta.
    // Whole-scene budgets remain immutable; rendered counts must match the exact frustum, not a relaxed ceiling.
    const frameExpected=oracle.measure(camera,v);
    assert.equal(frameExpected.wholeTriangles,phase==='before'?expected.legacy:expected.campus,'unchanged exact whole-scene budget');
    assertD072Frame(info,frameExpected,'browser base frame');
    const ownerVisibility=s.k?oracle.ownerVisibility(camera,v,s.buildingId):null;
    if(s.additionalView)assert.equal(ownerVisibility.blockedRays,0,'actual additional camera retains the audited unoccluded owner silhouette');
    const pixels=await p.ev(PIXELS);assert.ok(pixels.variance>50,'nonblank real production canvas');assert.equal(pixels.width,v.W);assert.equal(pixels.height,v.H);
    const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),v.W);assert.equal(bytes.readUInt32BE(20),v.H);assert.ok(bytes.length>3000,'nonempty full-resolution PNG');
    const file=`D072-${phase}-${s.id}-${v.W}.png`;fs.writeFileSync(path.join(OUT,file),bytes);
    // Hash the WebGL canvas itself, excluding DOM captions; a different label cannot fake art changes.
    assert.equal((await p.ev(PIXELS)).sha256,pixels.sha256,'paused canvas stayed pixel-stable during screenshot');
    assert.equal(await p.ev(WORLD),initial,'photography leaves every world layer/save/history untouched');assert.equal(await p.ev(DIGEST),dig,'photography does not change scene geometry');
    const con=await p.ev('__gt.con()');assert.equal(con.visT,2.2,'frozen presentation time');assert.equal(con.dayFrac,0,'frozen fraction of day');
    item.shots.push({file,name:s.id,label:s.name,source:source.sample,sourceQualification:source.qualification,kind:s.k??null,additionalView:s.additionalView??null,spinRadians:s.spinRadians??0,buildingId:s.buildingId??null,parcel:s.parcel??null,sourceVariant:s.sourceVariant??null,renderedVariant:s.renderedVariant??null,level:s.level??null,
     sha256:sha(bytes),bytes:bytes.length,width:v.W,height:v.H,canvasSha256:pixels.sha256,canvasVariance:pixels.variance,camera,frameExpected,ownerVisibility,render:{calls:info.calls,triangles:info.triangles},renderAll:{calls:all.calls,triangles:all.triangles},presentation:{visT:con.visT,dayFrac:con.dayFrac},worldSha256:sha(initial)});
   }
   for(const site of source.sites)assert.ok(item.shots.some(s=>s.kind===site.k&&s.renderedVariant===site.v&&s.ownerVisibility?.unoccluded),'every requested saved slot has an actual unoccluded before/after camera');
   if(source.force!==null){
    const camera=await p.ev('__gt.cam()');
    assert.equal(await p.ev('__gt.campusV('+source.force+')'),source.force,'reapplying the copied-variant hook is deterministic');await p.frames(3);
    assert.equal(await p.ev(DIGEST),dig,'fresh repeated forced showcase has identical geometry');assert.deepEqual(await p.ev('__gt.cam()'),camera,'reapplying the hook preserves the settled camera');
    assert.equal(await p.ev('__gt.campusV(null)'),null,'clear the render-only saved-variant hook');await p.frames(3);
    assert.equal(await p.ev(DIGEST),nativeDigest,'clearing the hook restores original city geometry byte for byte');
    assert.deepEqual(await p.ev('__gt.cam()'),camera,'restoring the original city preserves the settled camera');
    assert.equal(await p.ev(WORLD),initial,'forcing, reapplying and clearing copied variants preserves every source world field');
    item.campusHook={forced:source.force,repeatedGeometryExact:true,restored:true,worldAndCameraUnchanged:true};
   }
   assert.equal(await p.ev(D057_SAME),true,'unforced cached production scene equals a fresh scene');assert.equal(await p.ev(WORLD),initial,'fresh-scene verification leaves the world untouched');
   assert.deepEqual(page.errors,[],'no browser console/page errors');assert.deepEqual(externalRequests(page.requests),[],'no external assets/network requests');
   item.passed=true;
  }finally{item.browserErrors=[...page.errors];item.externalRequests=externalRequests(page.requests);item.requestCount=page.requests.length;}
 });}finally{oracle.dispose();}
}
function compare(a,b,source,expected){
 assert.equal(a.worldSha256,b.worldSha256,'same source world in both phases');if(source.sample!=='gallery')assert.equal(a.nativeDigestSha256,b.nativeDigestSha256,'no-target native geometry stays byte-exact across D072 phases');else assert.notEqual(a.nativeDigestSha256,b.nativeDigestSha256,'native v0 target art changes and both phases are independently pinned');assert.equal(a.shots.length,source.shots.length);assert.equal(b.shots.length,source.shots.length);
 for(const x of a.shots){const y=b.shots.find(y=>y.name===x.name);assert.ok(y);assert.equal(x.worldSha256,y.worldSha256);assert.equal(x.camera.zoom,y.camera.zoom);
  assert.deepEqual(y.camera,x.camera,'byte-exact settled camera in both artwork phases');
  assert.deepEqual(y.presentation,x.presentation,'same frozen visual time');
  for(const key of ['render','renderAll']){assert.equal(y[key].calls,x[key].calls,'same '+key+' draw calls');assert.equal(y[key].triangles-x[key].triangles,expected.delta,'exact '+key+' weighted triangle delta');assert.ok(y[key].triangles<=x[key].triangles,'no '+key+' triangle growth');}
  if(source.sample==='gallery'){assert.notEqual(x.canvasSha256,y.canvasSha256,'actual WebGL canvas pixels change for '+x.name);assert.notEqual(x.sha256,y.sha256,'original PNG pixels change for '+x.name);}
  else {assert.equal(x.canvasSha256,y.canvasSha256,'zero-target city canvas remains exactly unchanged');assert.equal(x.sha256,y.sha256,'zero-target city original PNG remains exactly unchanged');}
 }
}
// Review sheets compose ONLY the full-resolution screenshots above. Originals always remain in OUT.
async function contactSheet(c,source){
 const v=c.viewport,thumb=v.mobile?v.W:480,height=Math.round(thumb*v.H/v.W),panelW=thumb*2+8,panelH=height+48,columns=source.sample==='gallery'?3:1,rows=Math.ceil(c.before.shots.length/columns),header=140,W=columns*panelW+(columns-1)*12,H=header+rows*panelH+(rows-1)*12;
 const images=c.before.shots.map(x=>{const y=c.after.shots.find(y=>y.name===x.name);return {title:(x.kind?'k'+x.kind+':v'+x.renderedVariant+' · ':'')+x.label,before:'data:image/png;base64,'+fs.readFileSync(path.join(OUT,x.file)).toString('base64'),after:'data:image/png;base64,'+fs.readFileSync(path.join(OUT,y.file)).toString('base64')};});
 await withBrowser({root:OUT,entry:'d072-review.html',overlay:{'d072-review.html':'<!doctype html><meta charset="utf-8"><title>D072 actual WebGL image pairs</title>'},ready:'document.readyState === "complete"',width:W,height:H,gl:false,port:PORT},async({page,open})=>{
  await open('');await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
  await page.evaluate(`(()=>{document.body.style.cssText='margin:0;background:#151b20;color:#fff;font:14px/1.4 sans-serif';const h=document.createElement('header');h.style.cssText='height:${header}px;box-sizing:border-box;padding:10px 12px;white-space:pre-line';h.textContent=${J('D072 · '+source.label+'\n'+source.qualification+'\n'+v.W+' × '+v.H+' · BEFORE = D071 / campusArt=legacy; AFTER = D072 default · Actual WebGL PNGs')};document.body.append(h);const grid=document.createElement('main');grid.style.cssText='display:grid;grid-template-columns:repeat('+${columns}+',${panelW}px);gap:12px';for(const p of ${J(images)}){const d=document.createElement('section'),title=document.createElement('div');title.textContent=p.title+' | BEFORE ← → AFTER';title.style.cssText='height:48px;line-height:24px;box-sizing:border-box;padding:0 4px';d.append(title);const row=document.createElement('div');row.style.cssText='display:flex;gap:8px';for(const src of [p.before,p.after]){const image=new Image();image.src=src;image.width=${thumb};image.height=${height};row.append(image);}d.append(row);grid.append(d);}document.body.append(grid);})()`);
  await page.evaluate('Promise.all([...document.images].map(i=>i.decode()))');await page.evaluate('document.fonts.ready');
  const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64'),file=`D072-pairs-${source.id}-${v.W}.png`;
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),W);assert.equal(bytes.readUInt32BE(20),H);
  fs.writeFileSync(path.join(OUT,file),bytes);assert.deepEqual(page.errors,[]);assert.deepEqual(externalRequests(page.requests),[]);
  c.contactSheet={file,width:W,height:H,sha256:sha(bytes),qualification:'Review sheet composed only from actual captured WebGL PNGs, with factual source and phase labels. All full-resolution originals and canvas pixel hashes are retained.'};
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
fs.mkdirSync(OUT,{recursive:true});
if(process.argv.includes('--plan-only')){
 const plan=d072CapturePlan(expectedBudgets());jsonWrite('D072-capture-plan.json',plan);
 console.log('PASS D072 capture plan: 10 saved-slot closeups + 12 native/copied city overviews + '+ADDITIONAL_ANGLES+' additional audited campus angles × '+viewports.length+' viewports × 2 phases; NO SCREENSHOTS');
}else{
 const report={sourceRef:process.env.GITHUB_SHA??'local D072 candidate',qualification:'Real production CDP WebGL PNGs of unchanged paused source worlds. Three original cities are each shown natively and with copied saved-variant v0/v1/v2 previews. Four existing kinds supply ten distinct saved slots, not ten native placement tools. Every preview restores its phase-specific exact native scene digest. All 132 original views remain. Every requested owner silhouette is audited against all production meshes. Any necessary additional campus angles use the existing production spin hook, without removing or clipping neighboring buildings. Their actual images still require visual review. seed516 and ai120 contain no target kinds and remain negative controls. Mobile overviews respect production minimum zoom 0.6 and crop map corners. Software WebGL plus mobile viewport/touch emulation does not certify physical Android performance.',
  baseline:'f689c35d8d061498779321149ccce4443f0ce6de',before:'campusArt=legacy (D071)' ,after:'default D072',allOriginalsRetained:true,sources:SOURCES.map(({sites,shots,...s})=>s),cases:[],passed:false,captured:false};
 try{
  report.htmlSha256=sha(fs.readFileSync(path.join(ROOT,'dist/index.html')));report.expected=expectedBudgets();jsonWrite('D072-capture-plan.json',d072CapturePlan(report.expected));
  for(const viewport of viewports)for(const source of SOURCES){
   const c={viewport,sample:source.sample,variant:source.variant,force:source.force,sourceQualification:source.qualification,before:{},after:{},passed:false};report.cases.push(c);
   await capturePhase(viewport,'before',source,report.expected[source.variant][source.sample],c.before);jsonWrite('D072-capture.json',report);
   await capturePhase(viewport,'after',source,report.expected[source.variant][source.sample],c.after);compare(c.before,c.after,source,report.expected[source.variant][source.sample]);
   await contactSheet(c,source);c.passed=true;jsonWrite('D072-capture.json',report);console.log('PASS D072 real same-world/camera pairs',source.sample,viewport.W,c.before.shots.length);
  }
  // Every copied source is also compared to a separately captured native control in its same phase.
  for(const c of report.cases)for(const phase of ['before','after']){
   const native=report.cases.find(n=>n.viewport.W===c.viewport.W&&n.sample===c.sample&&n.variant==='native');assert.ok(native,'separate native control was captured');
   assert.equal(c[phase].worldSha256,native[phase].worldSha256,'every copied preview retains the separately captured native world');
   assert.equal(c[phase].nativeDigestSha256,native[phase].nativeDigestSha256,'every restored native digest equals the separately captured native control');
  }
  const originals=report.cases.flatMap(c=>[...c.before.shots,...c.after.shots]);
  assert.equal(originals.length,viewports.length*ORIGINALS_PER_VIEWPORT,'all required original WebGL PNGs captured');
  assert.equal(new Set(originals.map(s=>s.file)).size,originals.length,'every original has a unique retained PNG');
  for(const s of originals){const bytes=fs.readFileSync(path.join(OUT,s.file));assert.equal(bytes.length,s.bytes,'retained original byte length');assert.equal(sha(bytes),s.sha256,'retained original exact PNG digest');assert.equal(bytes.readUInt32BE(16),s.width);assert.equal(bytes.readUInt32BE(20),s.height);}
  report.captured=true;report.passed=report.cases.length===viewports.length*SOURCES.length&&report.cases.every(c=>c.passed);
 }catch(e){report.error=e.stack??String(e);report.status='blocked-or-failed';console.error(report.error);process.exitCode=1;}
 finally{report.originalPngs=report.cases.reduce((n,c)=>n+(c.before.shots?.length??0)+(c.after.shots?.length??0),0);jsonWrite('D072-capture.json',report);}
}

}
