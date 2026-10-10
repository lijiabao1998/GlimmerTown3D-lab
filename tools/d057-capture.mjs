import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import {d057Native,D057_SAME} from './d057-native.mjs';
import{ROOT,withBrowser}from'./cdp.mjs';import{pageSession}from'./smoke-d011.mjs';
import{d057ReviewCode,D057_CAMERA,D057_SITES}from'./d057-scenes.mjs';
const phase=process.argv.find(x=>x.startsWith('--phase='))?.slice(8)??'after';
const out=path.join(ROOT,'scratch/d057-'+phase);fs.mkdirSync(out,{recursive:true});
const J=JSON.stringify,hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const code=d057ReviewCode(),report={phase,sourceRef:process.env.GITHUB_SHA??'local',htmlSha256:hash(fs.readFileSync(path.join(ROOT,phase==='before'?'scratch/d057-before/index.html':'dist/index.html'))),qualification:'Authored synthetic fixture; Chrome software WebGL; mobile touch emulation, not Android hardware.',fixtureSha256:hash(code),cases:[],passed:false};
fs.writeFileSync(path.join(out,'D057-fixture.code.txt'),code);
try{
 for(const opt of [{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}]){
  await withBrowser({width:Math.max(960,opt.W),height:Math.max(900,opt.H),port:8357,root:phase==='before'?out:undefined},async({page,open})=>{
   const zoom=opt.mobile?1.5:D057_CAMERA.zoom;const p=await pageSession(page,open,opt);await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(code)})`);await p.open('');
   await p.ev(`__gt.view(${D057_CAMERA.x},${D057_CAMERA.z},${zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);await p.waitFor(async()=>!(await p.toasts()).length,6000);await p.frames(3);
   const item={viewport:opt,shots:[],checks:[],passed:false};report.cases.push(item);
   const world=await p.ev('JSON.stringify([__gt.sim(),__gt.history(),__gt.buildingList()])');
   const take=async name=>{await p.frames(2);const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');assert.equal(bytes.readUInt32BE(16),opt.W);assert.equal(bytes.readUInt32BE(20),opt.H);const file=`D057-${phase}-${name}-${opt.W}.png`;fs.writeFileSync(path.join(out,file),bytes);item.shots.push({file,sha256:hash(bytes),bytes:bytes.length,camera:await p.ev('__gt.cam()')});};
   const camera=await p.ev('__gt.cam()');assert.equal(camera.zoom,zoom);assert.ok(Math.abs(camera.target[0]-D057_CAMERA.x)<1e-8&&Math.abs(camera.target[2]-D057_CAMERA.z)<1e-8);
   const targets=await p.ev('__gt.buildingList()');assert.equal(D057_SITES.filter(s=>targets.some(b=>b[1]===s.k&&b[2]===s.x&&b[3]===s.z)).length,8);
   item.picks=[];for(const s of D057_SITES){const b=targets.find(b=>b[1]===s.k&&b[2]===s.x&&b[3]===s.z),hit=await p.ev(`__gt.pickTopDown(${s.x+s.size/2},${s.z+s.size/2})`);assert.equal(hit.id,b[0],s.id+' top-down owner');item.picks.push({kind:s.k,want:b[0],got:hit.id});}
   item.render=await p.ev('__gt.renderInfo()');assert.ok(item.render.calls<=18&&item.render.triangles<30000,'authored district draw budget');
   const nonblank=await p.ev(`(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let sum=0,sq=0,n=0;for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3;sum+=v;sq+=v*v;n++;}return sq/n-(sum/n)**2})()`);assert.ok(nonblank>50,'nonblank render');item.pixelVariance=nonblank;
   const same=await p.ev(D057_SAME);if(!same){item.digestMismatch=await p.ev('__d057LastDigest');console.error(J(item.digestMismatch));}assert.equal(same,true,'district cached/fresh');item.checks.push('all owner geometry and queries match fresh scene');await take('district');
   {
    for(const s of D057_SITES){await p.ev(`__gt.view(${s.x+s.size/2},${s.z+s.size/2},${opt.mobile&&s.size===2?5:8})`);await take(s.id);}
   }
   assert.equal(await p.ev('JSON.stringify([__gt.sim(),__gt.history(),__gt.buildingList()])'),world);item.checks.push('camera and visual time do not mutate simulation/history/buildings');
   item.boxes=await p.ev('__gt.ownerBoxes()');item.buildings=await p.ev('__gt.buildingList()');item.scene=await p.ev('__gt.sceneStats()');item.gl=await p.ev('__gt.glInfo()');
   assert.deepEqual(page.errors,[]);assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[]);item.checks.push('zero browser errors and external requests');if(phase==='after')await d057Native(p,page,{mobile:opt.mobile,item});assert.deepEqual(page.errors,[]);item.passed=true;console.log('PASS D057',phase,opt.W,item.shots.length,'screenshots');
  });
 }
 report.passed=report.cases.length===3&&report.cases.every(x=>x.passed);
}catch(e){report.error=String(e.stack??e);throw e;}finally{fs.writeFileSync(path.join(out,'D057-capture.json'),J(report,null,2));}
