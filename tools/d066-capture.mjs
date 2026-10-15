// D066 real production WebGL captures. Same seed516 save, camera, viewport and frozen presentation time;
// before=metropolisArt=legacy, after=landmarkArt=legacy (exact D066 release). No world editing and no generated substitute images.
//   node tools/d066-capture.mjs                 1440×1000, 360×740, 412×860
//   node tools/d066-capture.mjs --plan-only     validate the shot plan without launching a browser (NOT a capture)
//   D066_WIDTHS=1440 node tools/d066-capture.mjs
// Raw PNGs are temporary (/tmp by default); whole-city originals and three browser-composed contact sheets
// remain in scratch/d066. D066_KEEP_RAW=1 also retains every original close-up in scratch/d066.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {D057_SAME} from './d057-native.mjs';
import {METROPOLIS_BUILDINGS} from '../src/content/britishMetropolis.ts';
import {D066_KINDS,D066_OLD,d066City,d066Expected} from './unit-d066.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const OUT=path.join(ROOT,'scratch/d066'),KEEP_RAW=process.env.D066_KEEP_RAW==='1';
const WIDTHS=(process.env.D066_WIDTHS??'').split(',').filter(Boolean).map(Number);
export const D066_VIEWPORTS=[{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}];
const viewports=D066_VIEWPORTS.filter(v=>!WIDTHS.length||WIDTHS.includes(v.W));assert.ok(viewports.length,'at least one supported viewport');
for(const w of WIDTHS)assert.ok(D066_VIEWPORTS.some(v=>v.W===w),'recognized viewport '+w);
const city=d066City('seed516'),sites=METROPOLIS_BUILDINGS.map(m=>{
 const b=city.buildings.find(b=>b.k===m.k&&b.goneDay===undefined&&b.x+b.size<=city.n&&b.z+b.size<=city.n);assert.ok(b,'real seed516 site for '+m.name);
 return {...m,id:'kind-'+m.k+'-'+m.id,buildingId:b.id,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size,variant:b.v,level:b.lv,parcel:{x:b.x,z:b.z,size:b.size}};
});
assert.deepEqual(sites.map(s=>s.k),D066_KINDS);
const SHOTS=[{id:'seed516-whole-city',name:'種子城整城',x:city.n/2,z:city.n/2,size:city.n},...sites];
const zoomFor=(s,v)=>s.k?Math.min(8,.70*.84*city.n*(v.W/v.H)/(s.size*Math.SQRT2)):.54*v.W/v.H;
const world=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])`;
const digest=`(()=>{const d=__gt.sceneDigest();return JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts});})()`;
const variance=`(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let s=0,q=0,n=0;for(let i=0;i<d.length;i+=4){const l=d[i]*.3+d[i+1]*.59+d[i+2]*.11;s+=l;q+=l*l;n++;}return q/n-(s/n)**2;})()`;
async function settledCamera(p,s,v){
 await p.ev(`__gt.view(${s.x},${s.z},${zoomFor(s,v)});__gt.setVisT(2.2);__gt.setDayFrac(0)`);await p.frames(25);
 let stable=0,last=await p.ev('__gt.cam()');
 for(let i=0;i<24&&stable<2;i++){await p.frames(20);const next=await p.ev('__gt.cam()'),delta=Math.max(...next.pos.map((x,j)=>Math.abs(x-last.pos[j])));stable=delta<1e-9?stable+1:0;last=next;}
 assert.equal(stable,2,'observed a settled camera');return last;
}
async function capturePhase(v,phase,raw,expected){
 const item={viewport:v,phase,query:phase==='before'?'sample=seed516&clean=1&metropolisArt=legacy':'sample=seed516&clean=1&landmarkArt=legacy',shots:[],passed:false};
 await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:8366},async({page,open})=>{
  const p=await pageSession(page,open,v);await p.open(item.query);assert.equal(await p.ev('!!__gt.ready'),true,'production scene ready');
  assert.equal((await p.ev('__gt.sim()'))?.playing??false,false,'world clock paused');const initial=await p.ev(world),dig=await p.ev(digest),list=await p.ev('__gt.buildingList()');
  for(const s of sites){const b=list.find(b=>b[0]===s.buildingId);assert.ok(b&&b[1]===s.k&&b[2]===s.parcel.x&&b[3]===s.parcel.z&&b[4]===s.size,'capture uses an actual unmodified production building');}
  for(const s of SHOTS){
   const camera=await settledCamera(p,s,v);await p.frames(3);assert.ok(await p.ev(variance)>50,'nonblank real production canvas');
   const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
   assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),v.W);assert.equal(bytes.readUInt32BE(20),v.H);assert.ok(bytes.length>3000,'nonempty PNG');
   const file=`D066-${phase}-${s.id}-${v.W}.png`,temporary=path.join(raw,file);fs.writeFileSync(temporary,bytes);
   const retained=KEEP_RAW||!s.k;if(retained)fs.writeFileSync(path.join(OUT,file),bytes);
   assert.equal(await p.ev(world),initial,'photography leaves world/save/history untouched');assert.equal(await p.ev(digest),dig,'camera changes do not change production scene geometry');
   const info=await p.ev('__gt.renderInfo()');assert.ok(info.calls<=18,'existing draw-call ceiling');assert.equal(info.triangles,phase==='before'?expected.legacy:expected.metropolis,'actual browser triangle count agrees with Node production build');
   item.shots.push({file:retained?file:null,temporary,name:s.id,label:s.name,kind:s.k??null,buildingId:s.buildingId??null,parcel:s.parcel??null,variant:s.variant??null,sha256:sha(bytes),bytes:bytes.length,camera,render:{calls:info.calls,triangles:info.triangles},worldSha256:sha(initial)});
  }
  assert.equal(await p.ev(D057_SAME),true,'cached production scene equals a fresh scene');assert.deepEqual(page.errors,[],'no browser console/page errors');
  assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[],'no external image/assets/network requests');
  item.worldSha256=sha(initial);item.digestSha256=sha(dig);item.passed=true;
 });return item;
}
function compare(a,b,expected){
 assert.equal(a.worldSha256,b.worldSha256,'same source world in both phases');assert.equal(a.shots.length,9);assert.equal(b.shots.length,9);
 for(const x of a.shots){const y=b.shots.find(y=>y.name===x.name);assert.ok(y);assert.equal(x.worldSha256,y.worldSha256);assert.equal(x.camera.zoom,y.camera.zoom);
  for(const key of ['pos','target'])for(let j=0;j<3;j++)assert.ok(Math.abs(x.camera[key][j]-y.camera[key][j])<1e-7,'same settled camera '+key);
  assert.equal(y.render.calls,x.render.calls,'same draw calls');assert.equal(y.render.triangles-x.render.triangles,expected.delta,'exact weighted triangle delta');assert.notEqual(x.sha256,y.sha256,'real pixels change for '+x.name);
 }
}
// Composite only the captured browser PNGs. This is a review sheet, not a generated replacement scene.
async function contactSheet(c){
 const v=c.viewport,thumb=v.mobile?v.W:480,height=Math.round(thumb*v.H/v.W),panelW=thumb*2+8,panelH=height+28,columns=3,rows=3,W=columns*panelW+(columns-1)*12,H=rows*panelH+(rows-1)*12;
 const images=c.before.shots.map(x=>{const y=c.after.shots.find(y=>y.name===x.name);return {title:x.label,before:'data:image/png;base64,'+fs.readFileSync(x.temporary).toString('base64'),after:'data:image/png;base64,'+fs.readFileSync(y.temporary).toString('base64')};});
 let file;
 await withBrowser({root:'/tmp',entry:'d066-review.html',overlay:{'d066-review.html':'<!doctype html><meta charset="utf-8"><title>D066 captured image pairs</title>'},ready:'document.readyState === "complete"',width:W,height:H,gl:false,port:8366},async({page,open})=>{
  await open('');await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
  await page.evaluate(`(()=>{document.body.style.cssText='margin:0;background:#151b20;color:#fff;font:14px sans-serif;display:grid;grid-template-columns:repeat(${columns},${panelW}px);gap:12px';for(const p of ${J(images)}){const d=document.createElement('div'),title=document.createElement('div');title.textContent=p.title+' | BEFORE ← → AFTER';title.style.cssText='height:28px;line-height:28px';d.append(title);const row=document.createElement('div');row.style.cssText='display:flex;gap:8px';for(const src of [p.before,p.after]){const image=new Image();image.src=src;image.width=${thumb};image.height=${height};row.append(image);}d.append(row);document.body.append(d);}})()`);
  await page.evaluate('Promise.all([...document.images].map(i=>i.decode()))');const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64');
  file=`D066-pairs-${v.W}.png`;fs.writeFileSync(path.join(OUT,file),bytes);assert.deepEqual(page.errors,[]);c.contactSheet={file,width:W,height:H,sha256:sha(bytes),qualification:'Review sheet composed from the actual captured production PNGs; original pixel hashes are recorded in each shot.'};
 });return file;
}

fs.mkdirSync(OUT,{recursive:true});
if(process.argv.includes('--plan-only')){
 const expected=d066Expected();assert.equal(expected.seed516.legacy,D066_OLD.seed516.c[0]);
 const plan={passed:true,captured:false,qualification:'Plan and Node triangle counts validated only. No browser was launched and no screenshot exists from this command.',expected,viewports,shots:SHOTS.map(s=>({...s,zooms:Object.fromEntries(viewports.map(v=>[v.W,zoomFor(s,v)]))}))};
 fs.writeFileSync(path.join(OUT,'D066-capture-plan.json'),J(plan,null,2)+'\n');console.log('PASS D066 capture plan: 8 actual seed516 sites + whole city × '+viewports.length+' viewports × 2 phases; NO SCREENSHOTS');
}else{
 const raw=fs.mkdtempSync(path.join(os.tmpdir(),'d066-capture-')),report={sourceRef:process.env.GITHUB_SHA??'local D066 candidate',qualification:'Real production CDP WebGL PNGs, same paused seed516 world. Software WebGL plus mobile viewport/touch emulation does not certify physical Android performance.',rawDirectory:raw,htmlSha256:sha(fs.readFileSync(path.join(ROOT,'dist/index.html'))),cases:[],passed:false,captured:false};
 try{
  report.expected=d066Expected();assert.equal(report.expected.seed516.legacy,D066_OLD.seed516.c[0]);
  for(const viewport of viewports){const c={viewport,before:await capturePhase(viewport,'before',raw,report.expected.seed516),after:await capturePhase(viewport,'after',raw,report.expected.seed516)};compare(c.before,c.after,report.expected.seed516);report.cases.push(c);await contactSheet(c);console.log('PASS D066 real same-camera pairs',viewport.W,c.before.shots.length);}
  report.captured=true;report.passed=report.cases.length===viewports.length;report.originalPngs=report.cases.reduce((n,c)=>n+c.before.shots.length+c.after.shots.length,0);
 }catch(e){report.error=e.stack??String(e);report.status='blocked-or-failed';console.error(report.error);process.exitCode=1;}
 finally{fs.writeFileSync(path.join(OUT,'D066-capture.json'),J(report,null,2)+'\n');}
}
