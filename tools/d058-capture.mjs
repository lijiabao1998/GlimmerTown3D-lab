// Real game screenshots only. Requires supported Chromium WebGL; never substitutes a mock render.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';import {pageSession} from './smoke-d011.mjs';
import {D058_SCENES,d058Code} from './d058-scenes.mjs';import {D057_SAME} from './d057-native.mjs';
import {d054Snapshot,d054Model,d054CompareModel,d054Select,d054Hold,d054Release} from './d054-capture.mjs';
import {tapD053} from './d053-capture.mjs';import {commitOp,undoOp} from '../src/sim/edit.ts';import {stepDay} from '../src/sim/day.ts';
const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const phase=process.argv.find(x=>x.startsWith('--phase='))?.slice(8)??'after';assert.ok(['before','after'].includes(phase));
const root=phase==='before'?path.join(ROOT,'scratch/d058-before'):path.join(ROOT,'dist'),out=path.join(ROOT,'scratch/d058-'+phase);fs.mkdirSync(out,{recursive:true});
const report={phase,sourceRef:phase==='before'?'6f30f83faf4c4f4b02d1e3416d968a133f7da0b9':process.env.GITHUB_SHA??'local uncommitted candidate',htmlSha256:sha(fs.readFileSync(path.join(root,'index.html'))),qualification:'Authored save fixtures, production decode/restyle/render. Chrome software WebGL. Mobile touch emulation, not Android hardware.',cases:[],passed:false};
async function camera(p,x,z,zoom,turn=0){await p.ev(`__gt.view(${x},${z},${zoom});__gt.spin(${turn*Math.PI/2});__gt.setVisT(2.2);__gt.setDayFrac(0)`);await p.frames(30);let stable=0,last=await p.ev('__gt.cam()');for(let i=0;i<24&&stable<2;i++){await p.frames(25);const next=await p.ev('__gt.cam()'),delta=Math.max(...next.pos.map((x,j)=>Math.abs(x-last.pos[j])));stable=delta<1e-9?stable+1:0;last=next;}assert.equal(stable,2,'camera reached observed sub-nanounit stability');}
const world=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])`;
try{
 for(const opt of[{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}])for(const scene of D058_SCENES){
  await withBrowser({root,width:Math.max(960,opt.W),height:Math.max(900,opt.H),port:8358},async({page,open})=>{
   const p=await pageSession(page,open,opt),code=d058Code(scene),item={scene:scene.id,viewport:opt,fixtureSha256:sha(code),shots:[],checks:[],passed:false};report.cases.push(item);
   fs.writeFileSync(path.join(out,`D058-${scene.id}.code.txt`),code);
   await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(code)})`);await p.open('');
   assert.equal(await p.ev('__gt.sim().playing'),false);assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,6000));
   const plan=await p.ev('__gt.blockInfo().plan'),facades=await p.ev('__gt.facadeBlocks()');
   for(const t of scene.targets){const b=facades.find(b=>b.x===t.x&&b.z===t.z);assert.ok(b);assert.equal(b.path,t.path);assert.equal(b.w,t.w);assert.equal(b.h,t.h);}
   const zoom=scene.camera.zoom*(opt.mobile ? .50 : 1);await camera(p,scene.camera.x,scene.camera.z,zoom);
   const initialWorld=await p.ev(world),render=await p.ev('__gt.renderInfo()');assert.ok(render.calls<=18);assert.ok(render.triangles<40000);item.render=render;
   const nonblank=await p.ev(`(()=>{const c=document.querySelector('canvas'),q=document.createElement('canvas');q.width=96;q.height=60;const x=q.getContext('2d');x.drawImage(c,0,0,96,60);const a=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<a.length;i+=4){const v=(a[i]+a[i+1]+a[i+2])/3;sum+=v;sq+=v*v;n++;}return sq/n-(sum/n)**2})()`);assert.ok(nonblank>50);item.pixelVariance=nonblank;
   const take=async name=>{await p.frames(3);const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'),file=`D058-${phase}-${scene.id}-${name}-${opt.W}.png`;assert.equal(bytes.readUInt32BE(16),opt.W);assert.equal(bytes.readUInt32BE(20),opt.H);assert.ok(bytes.length>10000);fs.writeFileSync(path.join(out,file),bytes);item.shots.push({file,sha256:sha(bytes),bytes:bytes.length,camera:await p.ev('__gt.cam()'),worldSha256:sha(await p.ev(world))});};
   for(let turn=0;turn<4;turn++){await camera(p,scene.camera.x,scene.camera.z,zoom,turn);await take(['se','ne','nw','sw'][turn]);}
   await camera(p,scene.camera.x,scene.camera.z,zoom*.58);await take('far');
   const targets=scene.id==='highstreet'?scene.targets.slice(0,1):scene.targets;
   for(const t of targets)for(let turn=0;turn<(opt.mobile?1:4);turn++){await camera(p,t.x+t.w/2,t.z+t.h/2,opt.mobile?5.2:11,turn);await take(t.path+'-'+['se','ne','nw','sw'][turn]);}
   assert.equal(await p.ev(world),initialWorld,'camera/visual changes never modify world');assert.equal(await p.ev(D057_SAME),true,'same actual scene from fresh and incremental build');
   item.checks.push('production fixture archetypes','zero world changes during all views','nonblank real WebGL','four camera directions','fresh/incremental scene equality');
   const picks=await p.ev('__gt.blockPickTest(100)');assert.deepEqual(picks.bad,[]);item.picks=picks;
   if(phase==='after'){
    const snap=await d054Snapshot(p),model=d054Model(snap.code).sim;d054CompareModel(snap,model,'initial model');
    await p.ev(`window.__d058Inputs=[];for(const type of ['pointerdown','pointerup','pointercancel','click'])addEventListener(type,e=>__d058Inputs.push({type,trusted:e.isTrusted,pointerType:e.pointerType??null}),true)`);
    await camera(p,scene.camera.x,6.4,opt.mobile?3.3:7.5);
    const x=scene.id==='highstreet'?17:22,op={k:'rect',tool:'doze',x0:x,z0:6,x1:x+3,z1:6};
    await d054Select(p,'doze',opt.mobile);
    if(opt.mobile){const cancelled=await d054Hold(p,page,op,true);assert.equal(cancelled.preview.count,4);await p.touch('touchCancel',[]);await p.frames(2);d054CompareModel(await d054Snapshot(p),model,'cancelled road edit');}
    for(let repeat=0;repeat<2;repeat++){
     const held=await d054Hold(p,page,op,opt.mobile);assert.equal(held.preview.count,4);assert.ok(commitOp(model,op,0).ok);await d054Release(p,page,held.b,opt.mobile);
     d054CompareModel(await d054Snapshot(p),model,'road removed');assert.equal(await p.ev(D057_SAME),true,'road orientation changes invalidate cache');
     const changedPicks=await p.ev('__gt.blockPickTest(100)');assert.deepEqual(changedPicks.bad,[]);
     await tapD053(p,'#undo',opt.mobile);assert.ok(undoOp(model).ok);d054CompareModel(await d054Snapshot(p),model,'undo road edit');assert.equal(await p.ev(D057_SAME),true);
    }
    const inputs=await p.ev('__d058Inputs');assert.ok(inputs.length>=8&&inputs.every(e=>e.trusted),'genuine trusted browser input');for(const type of['pointerdown','pointerup'])assert.ok(inputs.filter(e=>e.type===type).length>=4);assert.ok(inputs.some(e=>e.pointerType===(opt.mobile?'touch':'mouse')));if(opt.mobile)assert.ok(inputs.some(e=>e.type==='pointercancel'));item.inputs=inputs;
    await p.key('Escape');assert.equal(await p.ev('__gt.saveNow()'),true);await p.ev('__gt.journalFlush()');assert.equal(await p.ev('__gt.saveNow()'),true);await p.open('');d054CompareModel(await d054Snapshot(p),model,'save/reload');
    stepDay(model);await p.ev('__gt.simStep(1)');d054CompareModel(await d054Snapshot(p),model,'one simulated day');assert.equal(await p.ev(D057_SAME),true);
    item.native={roadRemoveUndoRepeats:2,touchCancel:opt.mobile,saveReload:true,simulationCompared:true};item.checks.push('genuine mouse/touch doze and undo','save/reload','one-day original simulator parity');
   }
   item.sceneStats=await p.ev('__gt.sceneStats()');assert.equal(item.sceneStats.arenas.length,3);item.gl=await p.ev('__gt.glInfo()');
   assert.deepEqual(page.errors,[]);assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[]);
   item.checks.push('zero browser errors and external requests');item.passed=true;console.log('PASS D058',phase,scene.id,opt.W,item.shots.length,'real screenshots');
  });
 }
 report.passed=report.cases.length===6&&report.cases.every(x=>x.passed);
}catch(e){report.error=e.stack??String(e);throw e;}finally{fs.writeFileSync(path.join(out,'D058-capture.json'),J(report,null,2));}
