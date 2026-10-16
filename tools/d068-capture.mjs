// D068 real production WebGL pairs. No world edits, manufactured cities, or substitute pictures.
// seed516 and ai120 have zero D068 targets; all ten models use the existing read-only gallery.
// Every gallery PNG is labelled MODEL SHOWCASE / NOT A PLAYABLE CITY, including uncomposited originals.
//   node tools/d068-capture.mjs                 1440×1000, 360×740, 412×860; all 78 originals retained
//   node tools/d068-capture.mjs --plan-only     Node coverage/budget validation only, NOT a capture
//   D068_WIDTHS=1440 node tools/d068-capture.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {D057_SAME} from './d057-native.mjs';
import {FACILITY_BUILDINGS} from '../src/content/britishCommerceFacilities.ts';
import {D068_KINDS,D068_OLD,d068City,d068Expected} from './unit-d068.mjs';
import {createD068FrameOracle,assertD068Frame} from './d068-frame.mjs';
import {D067_UPLOAD_PROBE} from './d067-diagnose.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const OUT=path.join(ROOT,'scratch/d068'),PORT=+(process.env.GT_PORT??8368);
export const D068_VIEWPORTS=[{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}];
const WIDTHS=(process.env.D068_WIDTHS??'').split(',').map(w=>w.trim()).filter(Boolean).map(Number);
for(const w of WIDTHS)assert.ok(D068_VIEWPORTS.some(v=>v.W===w),'recognized viewport '+w);
const viewports=D068_VIEWPORTS.filter(v=>!WIDTHS.length||WIDTHS.includes(v.W));assert.ok(viewports.length,'at least one supported viewport');
assert.deepEqual(D068_KINDS,[65,86,91,98,99,57,64,110,167,168],'the approved ten kinds');
assert.deepEqual(FACILITY_BUILDINGS.map(m=>m.k),D068_KINDS,'complete and ordered model catalogue');

const active=(city,b)=>b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n;
const SOURCES=[
 {sample:'gallery',id:'gallery-model-showcase',label:'MODEL SHOWCASE · NOT A PLAYABLE CITY',qualification:'Existing sample=gallery: read-only all-kind model showcase, not a playable built city.',kinds:D068_KINDS},
 {sample:'seed516',id:'seed516-existing-city',label:'SEED516 EXISTING CITY · D068: NO TARGETS',qualification:'Unmodified existing seed516 sample: zero D068 kinds. This is an unchanged-city negative control, not a ten-model showcase.',kinds:[]},
 {sample:'ai120',id:'ai120-existing-city',label:'AI120 EXISTING CITY · D068: NO TARGETS',qualification:'Unmodified existing ai120 sample: zero D068 kinds. This is an unchanged-city negative control, not a ten-model showcase.',kinds:[]},
].map(source=>{
 const city=d068City(source.sample),live=city.buildings.filter(b=>active(city,b)),targets=live.filter(b=>D068_KINDS.includes(b.k));
 assert.equal(targets.length,source.kinds.length,source.sample+' exact number of existing target buildings');
 assert.deepEqual(targets.map(b=>b.k).sort((a,b)=>a-b),[...source.kinds].sort((a,b)=>a-b),source.sample+' exact kind coverage');
 const sites=source.kinds.map(k=>{
  const m=FACILITY_BUILDINGS.find(m=>m.k===k),b=targets.find(b=>b.k===k);assert.ok(m&&b,'existing source building for k'+k);
  return {...m,id:source.id+'-kind-'+k+'-'+m.id,name:m.name,buildingId:b.id,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size,variant:b.v,level:b.lv,parcel:{x:b.x,z:b.z,size:b.size}};
 });
 const shots=[{id:source.id+'-overview',name:source.sample==='gallery'?'展示樣本廣角（手機裁切地圖邊角）':source.sample+' 廣角（手機裁切邊角；本波零目標）',x:city.n/2,z:city.n/2,size:city.n},...sites];
 return {...source,n:city.n,sites,shots,sampleSha256:sha(fs.readFileSync(path.join(ROOT,`src/content/samples/${source.sample}.code.txt`)))};
});
assert.equal(SOURCES.reduce((n,s)=>n+s.shots.length,0),13,'ten gallery closeups, gallery overview, seed516 overview and ai120 overview');
const zoomFor=(source,s,v)=>s.k?Math.min(8,.70*.84*source.n*(v.W/v.H)/(s.size*Math.SQRT2)):Math.max(.6,.54*v.W/v.H);
// Sample saves can be null. Include every world layer, the source building list, stats and history as well.
const WORLD=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])`;
const DIGEST=`(()=>{const d=__gt.sceneDigest();return JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts});})()`;
const PIXELS=`(async()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=c.width;k.height=c.height;const x=k.getContext('2d');x.drawImage(c,0,0);const d=x.getImageData(0,0,k.width,k.height).data;let s=0,q=0,n=0;for(let i=0;i<d.length;i+=4){const l=d[i]*.3+d[i+1]*.59+d[i+2]*.11;s+=l;q+=l*l;n++;}const hash=await crypto.subtle.digest('SHA-256',d);return {width:k.width,height:k.height,variance:q/n-(s/n)**2,sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};})()`;
const externalRequests=requests=>requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
const jsonWrite=(file,value)=>fs.writeFileSync(path.join(OUT,file),J(value,null,2)+'\n');
function expectedBudgets(){
 const expected=d068Expected();
 for(const s of SOURCES){const e=expected[s.sample];assert.equal(e.legacy,D068_OLD[s.sample].c[0],s.sample+' exact immutable D067 baseline');assert.equal(e.facility-e.legacy,e.delta);assert.ok(e.delta<=0,s.sample+' no triangle growth');}
 return expected;
}
function capturePlan(expected){
 return {passed:true,captured:false,qualification:'Source coverage, camera plan and Node triangle counts only. This plan file is not screenshot evidence; --plan-only never launches a browser.',expected,viewports,
  plannedOriginalPngs:viewports.length*26,sources:SOURCES.map(s=>({...s,shots:s.shots.map(shot=>({...shot,zooms:Object.fromEntries(viewports.map(v=>[v.W,zoomFor(s,shot,v)]))}))}))};
}
async function sourceLabel(p,source,shot){
 // The same factual caption appears in both phases. It never supplies the changed-pixels evidence.
 const detail=(shot.k?'k'+shot.k+' · '+shot.name+' · owner '+shot.buildingId:shot.name);
 await p.ev(`(()=>{let label=document.getElementById('d068-source-label');if(!label){label=document.createElement('div');label.id='d068-source-label';label.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;box-sizing:border-box;padding:8px 12px;background:rgba(15,22,29,.90);color:#fff;font:12px/1.45 sans-serif;pointer-events:none;white-space:pre-line';document.body.append(label);}label.textContent=${J(source.label+'\n'+detail)};})()`);
}
async function settledCamera(p,source,shot,v){
 await p.ev(`__gt.view(${shot.x},${shot.z},${zoomFor(source,shot,v)});__gt.setVisT(2.2);__gt.setDayFrac(0)`);await p.frames(25);
 let stable=0,last=await p.ev('__gt.cam()');
 for(let i=0;i<24&&stable<2;i++){await p.frames(20);const next=await p.ev('__gt.cam()'),delta=Math.max(...['pos','target'].flatMap(k=>next[k].map((x,j)=>Math.abs(x-last[k][j]))),Math.abs(next.zoom-last.zoom));stable=delta<1e-9?stable+1:0;last=next;}
 assert.equal(stable,2,'observed a settled camera');return last;
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
 await p.ev('__d067UploadProbe.stop()');
 assert.deepEqual(await uploadState(p),before,'normal inspection/restoration preserves world, raw geometry, camera and submitted geometry');
 item.uploadProbe={restored:true,worldGeometryCameraAndSubmissionsUnchanged:true};
 item.geometrySha256=sha(before.digest);
}
async function capturePhase(v,phase,source,expected,item){
 Object.assign(item,{viewport:v,phase,sample:source.sample,sourceQualification:source.qualification,query:`sample=${source.sample}&clean=1`+(phase==='before'?'&facilityArt=legacy':'&commerceVariantArt=legacy'),shots:[],passed:false});
 const oracle=createD068FrameOracle(source.sample,phase==='after');
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
   const initial=await p.ev(WORLD),dig=await p.ev(DIGEST),list=await p.ev('__gt.buildingList()');item.worldSha256=sha(initial);item.digestSha256=sha(dig);
   // Raw browser attributes remain recorded. Only the three source-proven D060 kiln-face
   // numerical-zero normals can be canonicalized in cloned comparison data; no source is changed.
   await verifyUploadedGeometry(p,oracle,item);
   const actualTargets=list.filter(b=>D068_KINDS.includes(b[1]));
   assert.deepEqual(actualTargets.map(b=>b[0]).sort((a,b)=>a-b),source.sites.map(s=>s.buildingId).sort((a,b)=>a-b),'browser contains exactly the source target owners');
   for(const s of source.sites){const b=list.find(b=>b[0]===s.buildingId);assert.deepEqual(b.slice(0,7),[s.buildingId,s.k,s.parcel.x,s.parcel.z,s.size,s.level,s.variant],'actual unmodified source building, variant and level');}
   for(const s of source.shots){
    const camera=await settledCamera(p,source,s,v);await sourceLabel(p,source,s);await p.frames(3);
    const info=await p.ev('__gt.renderInfo()'),all=await p.ev('__gt.renderInfoAll()');
    assert.ok(info.calls<=18,'existing base draw-call ceiling');assert.ok(all.calls<=20,'existing all-content draw-call ceiling');
    // Independently predict color and shadow submissions from actual production geometry and camera.
    // Existing-city negative controls and all gallery views retain their actual independent frusta.
    // Whole-scene budgets remain immutable; rendered counts must match the exact frustum, not a relaxed ceiling.
    const frameExpected=oracle.measure(camera,v);
    assert.equal(frameExpected.wholeTriangles,phase==='before'?expected.legacy:expected.facility,'unchanged exact whole-scene budget');
    assertD068Frame(info,frameExpected,'browser base frame');
    const pixels=await p.ev(PIXELS);assert.ok(pixels.variance>50,'nonblank real production canvas');assert.equal(pixels.width,v.W);assert.equal(pixels.height,v.H);
    const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),v.W);assert.equal(bytes.readUInt32BE(20),v.H);assert.ok(bytes.length>3000,'nonempty full-resolution PNG');
    const file=`D068-${phase}-${s.id}-${v.W}.png`;fs.writeFileSync(path.join(OUT,file),bytes);
    // Hash the WebGL canvas itself, excluding DOM captions; a different label cannot fake art changes.
    assert.equal((await p.ev(PIXELS)).sha256,pixels.sha256,'paused canvas stayed pixel-stable during screenshot');
    assert.equal(await p.ev(WORLD),initial,'photography leaves every world layer/save/history untouched');assert.equal(await p.ev(DIGEST),dig,'photography does not change scene geometry');
    const con=await p.ev('__gt.con()');assert.equal(con.visT,2.2,'frozen presentation time');assert.equal(con.dayFrac,0,'frozen fraction of day');
    item.shots.push({file,name:s.id,label:s.name,source:source.sample,sourceQualification:source.qualification,kind:s.k??null,buildingId:s.buildingId??null,parcel:s.parcel??null,variant:s.variant??null,level:s.level??null,
     sha256:sha(bytes),bytes:bytes.length,canvasSha256:pixels.sha256,canvasVariance:pixels.variance,camera,frameExpected,render:{calls:info.calls,triangles:info.triangles},renderAll:{calls:all.calls,triangles:all.triangles},presentation:{visT:con.visT,dayFrac:con.dayFrac},worldSha256:sha(initial)});
   }
   assert.equal(await p.ev(D057_SAME),true,'cached production scene equals a fresh scene');assert.equal(await p.ev(WORLD),initial,'fresh-scene verification leaves the world untouched');
   assert.deepEqual(page.errors,[],'no browser console/page errors');assert.deepEqual(externalRequests(page.requests),[],'no external assets/network requests');
   item.passed=true;
  }finally{item.browserErrors=[...page.errors];item.externalRequests=externalRequests(page.requests);item.requestCount=page.requests.length;}
 });}finally{oracle.dispose();}
}
function compare(a,b,source,expected){
 assert.equal(a.worldSha256,b.worldSha256,'same source world in both phases');assert.equal(a.shots.length,source.shots.length);assert.equal(b.shots.length,source.shots.length);
 for(const x of a.shots){const y=b.shots.find(y=>y.name===x.name);assert.ok(y);assert.equal(x.worldSha256,y.worldSha256);assert.equal(x.camera.zoom,y.camera.zoom);
  for(const key of ['pos','target'])for(let j=0;j<3;j++)assert.ok(Math.abs(x.camera[key][j]-y.camera[key][j])<1e-7,'same settled camera '+key);
  assert.deepEqual(y.presentation,x.presentation,'same frozen visual time');
  for(const key of ['render','renderAll']){assert.equal(y[key].calls,x[key].calls,'same '+key+' draw calls');assert.equal(y[key].triangles-x[key].triangles,expected.delta,'exact '+key+' weighted triangle delta');assert.ok(y[key].triangles<=x[key].triangles,'no '+key+' triangle growth');}
  if(source.kinds.length){assert.notEqual(x.canvasSha256,y.canvasSha256,'actual WebGL canvas pixels change for '+x.name);assert.notEqual(x.sha256,y.sha256,'original PNG pixels change for '+x.name);}
  else {assert.equal(x.canvasSha256,y.canvasSha256,'zero-target city canvas remains exactly unchanged');assert.equal(x.sha256,y.sha256,'zero-target city original PNG remains exactly unchanged');}
 }
}
// Review sheets compose ONLY the full-resolution screenshots above. Originals always remain in OUT.
async function contactSheet(c,source){
 const v=c.viewport,thumb=v.mobile?v.W:480,height=Math.round(thumb*v.H/v.W),panelW=thumb*2+8,panelH=height+48,columns=source.sample==='gallery'?3:1,rows=Math.ceil(c.before.shots.length/columns),header=140,W=columns*panelW+(columns-1)*12,H=header+rows*panelH+(rows-1)*12;
 const images=c.before.shots.map(x=>{const y=c.after.shots.find(y=>y.name===x.name);return {title:(x.kind?'k'+x.kind+' · ':'')+x.label,before:'data:image/png;base64,'+fs.readFileSync(path.join(OUT,x.file)).toString('base64'),after:'data:image/png;base64,'+fs.readFileSync(path.join(OUT,y.file)).toString('base64')};});
 await withBrowser({root:OUT,entry:'d068-review.html',overlay:{'d068-review.html':'<!doctype html><meta charset="utf-8"><title>D068 actual WebGL image pairs</title>'},ready:'document.readyState === "complete"',width:W,height:H,gl:false,port:PORT},async({page,open})=>{
  await open('');await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
  await page.evaluate(`(()=>{document.body.style.cssText='margin:0;background:#151b20;color:#fff;font:14px/1.4 sans-serif';const h=document.createElement('header');h.style.cssText='height:${header}px;box-sizing:border-box;padding:10px 12px;white-space:pre-line';h.textContent=${J('D068 · '+source.label+'\n'+source.qualification+'\n'+v.W+' × '+v.H+' · BEFORE = D067 / facilityArt=legacy; AFTER = D068 default · Actual WebGL PNGs')};document.body.append(h);const grid=document.createElement('main');grid.style.cssText='display:grid;grid-template-columns:repeat('+${columns}+',${panelW}px);gap:12px';for(const p of ${J(images)}){const d=document.createElement('section'),title=document.createElement('div');title.textContent=p.title+' | BEFORE ← → AFTER';title.style.cssText='height:48px;line-height:24px;box-sizing:border-box;padding:0 4px';d.append(title);const row=document.createElement('div');row.style.cssText='display:flex;gap:8px';for(const src of [p.before,p.after]){const image=new Image();image.src=src;image.width=${thumb};image.height=${height};row.append(image);}d.append(row);grid.append(d);}document.body.append(grid);})()`);
  await page.evaluate('Promise.all([...document.images].map(i=>i.decode()))');await page.evaluate('document.fonts.ready');
  const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64'),file=`D068-pairs-${source.id}-${v.W}.png`;
  fs.writeFileSync(path.join(OUT,file),bytes);assert.deepEqual(page.errors,[]);assert.deepEqual(externalRequests(page.requests),[]);
  c.contactSheet={file,width:W,height:H,sha256:sha(bytes),qualification:'Review sheet composed only from actual captured WebGL PNGs, with factual source and phase labels. All full-resolution originals and canvas pixel hashes are retained.'};
 });
}

fs.mkdirSync(OUT,{recursive:true});
if(process.argv.includes('--plan-only')){
 const plan=capturePlan(expectedBudgets());jsonWrite('D068-capture-plan.json',plan);
 console.log('PASS D068 capture plan: 10 gallery model closeups + gallery overview + unchanged seed516 and ai120 overviews × '+viewports.length+' viewports × 2 phases; NO SCREENSHOTS');
}else{
 const report={sourceRef:process.env.GITHUB_SHA??'local D068 candidate',qualification:'Real production CDP WebGL PNGs of unchanged, paused source samples. Gallery is a model showcase, not a playable built city. seed516 and ai120 contain no D068 targets and are unchanged-city negative controls. Mobile wide views respect the production minimum zoom 0.6 and crop map corners; they are not complete whole-map views. Software WebGL with mobile viewport/touch emulation does not certify physical Android performance.',
  baseline:'3527859dfa4d802fda0eaa4a0d96aa05e1471a2d',before:'facilityArt=legacy (D067)',after:'default D068',allOriginalsRetained:true,sources:SOURCES.map(({sites,shots,...s})=>s),cases:[],passed:false,captured:false};
 try{
  report.htmlSha256=sha(fs.readFileSync(path.join(ROOT,'dist/index.html')));report.expected=expectedBudgets();jsonWrite('D068-capture-plan.json',capturePlan(report.expected));
  for(const viewport of viewports)for(const source of SOURCES){
   const c={viewport,sample:source.sample,sourceQualification:source.qualification,before:{},after:{},passed:false};report.cases.push(c);
   await capturePhase(viewport,'before',source,report.expected[source.sample],c.before);jsonWrite('D068-capture.json',report);
   await capturePhase(viewport,'after',source,report.expected[source.sample],c.after);compare(c.before,c.after,source,report.expected[source.sample]);
   await contactSheet(c,source);c.passed=true;jsonWrite('D068-capture.json',report);console.log('PASS D068 real same-world/camera pairs',source.sample,viewport.W,c.before.shots.length);
  }
  report.captured=true;report.passed=report.cases.length===viewports.length*SOURCES.length&&report.cases.every(c=>c.passed);
 }catch(e){report.error=e.stack??String(e);report.status='blocked-or-failed';console.error(report.error);process.exitCode=1;}
 finally{report.originalPngs=report.cases.reduce((n,c)=>n+(c.before.shots?.length??0)+(c.after.shots?.length??0),0);jsonWrite('D068-capture.json',report);}
}
