// Real production WebGL screenshots. No conceptual/generated picture substitutes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {D057_SAME} from './d057-native.mjs';
import {d054Snapshot,d054Model,d054CompareModel,d054World} from './d054-capture.mjs';
import {tapD053} from './d053-capture.mjs';
import {previewOp,commitOp,undoOp} from '../src/sim/edit.ts';
import {stepDay} from '../src/sim/day.ts';
import {D059_BASELINE,D059_VIEWPORTS,D059_SITES,D059_BONUS,D059_CAMERA,d059ReviewCode,d059FixtureProof,d059Selectors} from './d059-scenes.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const phase=process.argv.find(x=>x.startsWith('--phase='))?.slice(8)??'after';assert.ok(['before','after'].includes(phase));
const out=path.join(ROOT,'scratch/d059-'+phase),root=phase==='before'?out:path.join(ROOT,'dist');
const selectedWidths=(process.env.D059_WIDTHS??'').split(',').filter(Boolean).map(Number);
const views=D059_VIEWPORTS.filter(v=>!selectedWidths.length||selectedWidths.includes(v.W));assert.ok(views.length);
const code=d059ReviewCode(),proof=d059FixtureProof(code),query=phase==='before'?'villageArt=legacy':'';
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'D059-fixture.code.txt'),code);
const report={phase,sourceRef:phase==='before'?D059_BASELINE:process.env.GITHUB_SHA??'local uncommitted D059 candidate',htmlSha256:sha(fs.readFileSync(path.join(root,'index.html'))),fixtureSha256:sha(code),fixture:proof,qualification:'Human-authored city. Production save load/restyle/render. Real CDP PNG; Chrome software WebGL. Mobile touch emulation, not Android hardware.',cases:[],passed:false};
const world=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])`;
const digest=`(()=>{const d=__gt.sceneDigest();return JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts});})()`;
const variance=`(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3;sum+=v;sq+=v*v;n++;}return sq/n-(sum/n)**2})()`;
function ownerProbe(s){
 const model=s.model??s.id,uv=phase==='after'?(model==='church'?[.42,.81]:model==='oast'?[.29,.48]:[.5,.5]):[.5,.5];
 return [s.x+s.w*uv[0],s.z+s.h*uv[1]];
}
async function camera(p,x,z,zoom,turn=0){
 await p.ev(`__gt.view(${x},${z},${zoom});__gt.spin(${turn*Math.PI/2});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
 await p.frames(30);let stable=0,last=await p.ev('__gt.cam()');
 for(let i=0;i<24&&stable<2;i++){await p.frames(25);const next=await p.ev('__gt.cam()'),delta=Math.max(...next.pos.map((x,j)=>Math.abs(x-last.pos[j])));stable=delta<1e-9?stable+1:0;last=next;}
 assert.equal(stable,2,'observed settled camera');
}
async function selectors(p){return d059Selectors((await p.ev('__gt.blockInfo()')).plan,await p.ev('__gt.buildingList()'));}
async function native(p,page,opt,item){
 const snap=await d054Snapshot(p),model=d054Model(snap.code).sim;d054CompareModel(snap,model,'initial native model');
 await p.ev(`window.__d059Inputs=[];for(const type of ['pointerdown','pointerup','pointercancel','click'])addEventListener(type,e=>__d059Inputs.push({type,trusted:e.isTrusted,pointerType:e.pointerType??''}),true)`);
 const results=[];
 for(const t of [{id:'cemetery',k:16,size:1},{id:'farm',k:22,size:2}]){
  const before=await d054Snapshot(p),ui=await p.ev('__gt.ui()');if(!['civic','food'].includes(ui.tool))await tapD053(p,'.tool[data-t="civic"]',opt.mobile);
  await tapD053(p,'#civicGuide',opt.mobile);await tapD053(p,'#catalogClose',opt.mobile);
  assert.deepEqual(d054World(await d054Snapshot(p)),d054World(before),'cancel catalogue leaves world unchanged');
  await tapD053(p,'#civicGuide',opt.mobile);
  await tapD053(p,t.id==='farm'?'#catalog [data-group="food"]':'#catalog [data-group="service"]',opt.mobile);
  await tapD053(p,`#catalog [data-tool="${t.id}"]`,opt.mobile);assert.equal((await p.ev('__gt.ui()')).civicTool,t.id);
  await camera(p,30.5,18.5,opt.mobile?3.3:5.5);
  const op={k:'tap',tool:t.id,x0:30,z0:18,x1:30,z1:18},pv=previewOp(model,op),at=await p.cell(30,18);
  assert.equal(pv.count,1);assert.equal(pv.affordable,true);assert.equal(await p.hit(at),'CANVAS');
  if(opt.mobile){await p.touch('touchStart',[at]);await p.frames(2);assert.ok(await p.ev('__gt.stroke()'));await p.touch('touchCancel',[]);await p.frames(2);d054CompareModel(await d054Snapshot(p),model,t.id+' touch cancellation');}
  if(opt.mobile)await p.touch('touchStart',[at]);else await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:at[0],y:at[1],button:'left',buttons:1,clickCount:1});
  await p.frames(2);assert.deepEqual((await p.ev('__gt.stroke()')).preview,{count:1,total:pv.total,cells:t.size*t.size});
  assert.ok(commitOp(model,op,0).ok);
  if(opt.mobile)await p.release();else await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:at[0],y:at[1],button:'left',buttons:0,clickCount:1});await p.frames(3);
  d054CompareModel(await d054Snapshot(p),model,t.id+' native placement');assert.equal(await p.ev(D057_SAME),true,'placed cached/fresh');
  const placed=(await p.ev('__gt.buildingList()')).find(b=>b[2]===30&&b[3]===18);assert.equal(placed[1],t.k);
  const probe=ownerProbe({id:t.id==='cemetery'?'church':'oast',x:30,z:18,w:t.size,h:t.size}),hit=await p.ev(`__gt.pickTopDown(${probe[0]},${probe[1]})`);assert.equal(hit?.id,placed[0]);
  await tapD053(p,'#undo',opt.mobile);assert.ok(undoOp(model).ok);d054CompareModel(await d054Snapshot(p),model,t.id+' native undo');assert.equal(await p.ev(D057_SAME),true,'undo cached/fresh');
  results.push({tool:t.id,kind:t.k,cost:pv.total,placement:true,undo:true,picking:true,pickProbe:probe,touchCancel:opt.mobile});
 }
 const inputs=await p.ev('__d059Inputs');assert.ok(inputs.length>=8&&inputs.every(e=>e.trusted));
 assert.ok(inputs.some(e=>e.pointerType===(opt.mobile?'touch':'mouse')));if(opt.mobile)assert.ok(inputs.some(e=>e.type==='pointercancel'));
 await p.key('Escape');assert.equal(await p.ev('__gt.saveNow()'),true);await p.ev('__gt.journalFlush()');assert.equal(await p.ev('__gt.saveNow()'),true);
 await p.open(query);d054CompareModel(await d054Snapshot(p),model,'native save/reload');assert.equal(await p.ev(D057_SAME),true);
 const dayBefore=model.day;stepDay(model);await p.ev('__gt.simStep(1)');
 const future=await d054Snapshot(p);assert.equal(model.day,dayBefore+1);d054CompareModel(future,model,'one simulated day');assert.equal(await p.ev(D057_SAME),true,'one-day cached/fresh');
 item.native={results,inputs,saveReload:true,modelCompared:true,oneDayCompared:true,oneDay:{from:dayBefore,to:model.day,money:model.money,worldSha256:sha(d054World(future))},importOnlyKinds:[66,100]};
}
try{
 for(const opt of views)await withBrowser({root,width:Math.max(960,opt.W),height:Math.max(900,opt.H),port:8359},async({page,open})=>{
  const p=await pageSession(page,open,opt),item={viewport:opt,shots:[],checks:[],passed:false};report.cases.push(item);
  await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(code)})`);await p.open(query);
  assert.equal(await p.ev('__gt.sim().playing'),false);assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,6000));
  item.selectors=await selectors(p);item.restyled=await p.ev('__gt.restyled()');assert.equal(item.restyled,proof.restyled);
  const list=await p.ev('__gt.buildingList()');for(const s of D059_BONUS){const b=list.find(b=>b[1]===s.k&&b[2]===s.x&&b[3]===s.z);assert.ok(b);assert.equal(b[4],s.w);}
  const initial=await p.ev(world);item.worldSha256=sha(initial);
  const take=async name=>{
   await p.frames(3);const pixelVariance=await p.ev(variance);assert.ok(pixelVariance>50,name+' nonblank production canvas');
   const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D059-${phase}-${name}-${opt.W}.png`;
   assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),opt.W);assert.equal(bytes.readUInt32BE(20),opt.H);assert.ok(bytes.length>10000);
   assert.equal(await p.ev(world),initial,'photography never alters world');fs.writeFileSync(path.join(out,file),bytes);
   item.shots.push({file,sha256:sha(bytes),bytes:bytes.length,camera:await p.ev('__gt.cam()'),worldSha256:sha(initial),pixelVariance});
  };
  await camera(p,D059_CAMERA.x,D059_CAMERA.z,D059_CAMERA.zoom*(opt.mobile?.43:1));await take('overview');
  item.render=await p.ev('__gt.renderInfo()');assert.ok(item.render.calls<=18,'existing draw-call budget');assert.ok(item.render.triangles<70000,'authored eight-model district triangle bound');
  for(const s of [...D059_SITES,...D059_BONUS])for(const turn of [0,2]){
   // Fixed 72-cell fixture uses the production 0.42*N vertical half-span.
   // Fit the oblique footprint to roughly 70% phone width / 650 desktop pixels.
   const span=(s.w+s.h)*Math.SQRT1_2,zoom=Math.min(opt.mobile?8:16,(opt.mobile?opt.W*.70:650)/(opt.H/(72*.84)*span));
   await camera(p,s.x+s.w/2,s.z+s.h/2,zoom,turn);await take(s.id+'-'+(turn===0?'se':'nw'));
  }
  assert.equal(item.shots.length,17);assert.equal(await p.ev(D057_SAME),true,'actual cached scene equals fresh scene');
  item.picks={blocks:await p.ev('__gt.blockPickTest(100)'),native:[]};assert.deepEqual(item.picks.blocks.bad,[]);
  for(const s of [...D059_SITES.filter(s=>s.k>3),...D059_BONUS]){
   const b=list.find(b=>b[1]===s.k&&b[2]===s.x&&b[3]===s.z),probe=ownerProbe(s),hit=await p.ev(`__gt.pickTopDown(${probe[0]},${probe[1]})`);
   assert.equal(hit?.id,b[0],s.id+' real geometry owner');item.picks.native.push({id:s.id,kind:s.k,probe,want:b[0],got:hit.id});
  }
  item.modes={};for(const mode of ['a','b','c']){
   await p.ev(`__gt.setBlocks(${J(mode)})`);await p.frames(3);assert.equal(await p.ev(world),initial);
   assert.equal(await p.ev(D057_SAME),true,'mode '+mode+' cached/fresh');
   if(mode==='a')assert.deepEqual(await p.ev('__gt.facadeBlocks()'),[]);else await selectors(p);
   item.modes[mode]={digestSha256:sha(await p.ev(digest)),worldSha256:sha(await p.ev(world)),selectors:mode==='a'?[]:await selectors(p)};
  }
  item.checks.push('six selectors after production decode/restyle','authored merged lots and large native/imported variants','se/nw real PNG per model','zero world changes during photography and mode switches','all cached/fresh scene geometry and owner picks','B/C selectors and A legacy evidence');
  if(phase==='after'){await native(p,page,opt,item);item.checks.push('genuine mouse/touch native cemetery/farm placement, cancellation, undo, save/reload','one-day original simulator parity');}
  item.sceneStats=await p.ev('__gt.sceneStats()');assert.equal(item.sceneStats.arenas.length,3);item.gl=await p.ev('__gt.glInfo()');
  assert.deepEqual(page.errors,[]);item.externalRequests=page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));assert.deepEqual(item.externalRequests,[]);
  item.errors=[...page.errors];item.checks.push('zero browser errors and external requests');item.passed=true;console.log('PASS D059',phase,opt.W,item.shots.length,'actual PNG');
 });
 report.passed=report.cases.length===3&&report.cases.every(x=>x.passed);
}catch(e){report.error=e.stack??String(e);throw e;}finally{fs.writeFileSync(path.join(out,'D059-capture.json'),J(report,null,2));}
