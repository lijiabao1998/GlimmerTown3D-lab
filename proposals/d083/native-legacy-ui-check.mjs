// Targeted original D055 native flows; frozen full-catalogue assertion stays red.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{withBrowser}from'../../tools/cdp.mjs';import{pageSession}from'../../tools/smoke-d011.mjs';import{tapD053}from'../../tools/d053-capture.mjs';
import{D054_LAYOUT}from'../../tools/d054-layout-probe.mjs';import{d055ReviewCode,D055_CAMERA}from'../../tools/d055-scenes.mjs';import{d055Native}from'../../tools/d055-native.mjs';
const arg=(k,d)=>process.argv.find(s=>s.startsWith('--'+k+'='))?.split('=')[1]??d,width=Number(arg('width','360')),attempt=Number(arg('attempt','1'));
assert.ok([1440,412,360].includes(width));const opt={W:width,H:width===1440?1000:width===412?860:740,mobile:width!==1440};
const dir=path.resolve(`scratch/d083-native-evidence/legacy-food-${width}-attempt-${attempt}`);fs.mkdirSync(dir,{recursive:true});assert.ok(!fs.existsSync(path.join(dir,'report.json')),'preserve earlier evidence');
const report={qualification:'Original D055 native paid placement/undo/navigation/commission functions, unchanged. Does not qualify old full-catalogue count or replace complete CI.',width,sourceCommit:process.env.GITHUB_SHA??null,buildSha256:createHash('sha256').update(fs.readFileSync('dist/index.html')).digest('hex'),passed:false};
try{await withBrowser({width:Math.max(960,width),height:Math.max(900,opt.H),port:8613,root:path.resolve('dist')},async({page,open})=>{
 const p=await pageSession(page,open,opt),tap=s=>tapD053(p,s,opt.mobile);
 await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${JSON.stringify(d055ReviewCode())})`);await p.open('');
 await p.ev(`__gt.view(${D055_CAMERA.x},${D055_CAMERA.z},${D055_CAMERA.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,6000));
 await tap('.tool[data-t="civic"]');report.originalDock=await p.ev(D054_LAYOUT);assert.equal(report.originalDock.buttons.length,18);assert.equal(report.originalDock.rows,3);
 await tap('#civicGuide');await tap('#catalog [data-group="food"]');await tap('#catalog [data-tool="farm"]');
 await d055Native(p,page,{mobile:opt.mobile,item:report});assert.equal(report.native.checks.length,7);assert.equal(report.native.commissionNavigation,true);
 assert.deepEqual(page.errors,[]);report.errors=page.errors;const b=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');fs.writeFileSync(path.join(dir,'D083-original-food-flows-'+width+'.png'),b);report.shotSha256=createHash('sha256').update(b).digest('hex');
 });report.passed=true;console.log('PASS original D055 native food/undo/catalogue/commission',width);
}catch(e){report.failure=e.stack??String(e);throw e;}finally{fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));}
