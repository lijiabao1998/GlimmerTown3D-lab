// QA-only D048 original product capture for D049. Never merge this branch.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';import {pageSession} from './smoke-d011.mjs';
import {D048_CAMERA,D048_BASELINE_CAMERA,D048_SAVE_KEY,D048_VIEWS,d048ReviewCode,d048FixtureManifest} from './d048-scenes.mjs';
const J=JSON.stringify,hash=s=>createHash('sha256').update(s).digest('hex'),OUT=path.join(ROOT,'scratch/d049-baseline');fs.mkdirSync(OUT,{recursive:true});
const expected='cbd5ea3d1235042b9407769fc7bb1d8535a09f9ea43ef5173d15907be9213cec';
assert.equal(process.env.GITHUB_REF,'refs/heads/claude/d049-baseline-capture');assert.equal(hash(fs.readFileSync(path.join(ROOT,'dist/index.html'))),expected);
const report={base:'0605e477345652fba037a428ceff460e5bd8bb1f',htmlSha256:expected,fixture:d048FixtureManifest(),shots:[],checks:[]};
for(const v of D048_VIEWS){try{await withBrowser({width:960,height:900},async({page,open})=>{
 const p=await pageSession(page,open,{W:v.width,H:v.height});await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem(${J(D048_SAVE_KEY)},${J(d048ReviewCode())})`);await p.open('');
 await p.ev(`__gt.view(${D048_CAMERA.x},${D048_CAMERA.z},${D048_CAMERA.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);await p.ev('__gt.saveNow()');await p.ev('__gt.journalFlush()');await p.ev('__gt.saveNow()');assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,5000));
 assert.deepEqual(await p.ev('__gt.cam()'),D048_BASELINE_CAMERA);assert.equal((await p.ev('__gt.sim()')).playing,false);
 await p.ev("window.__d049Touches=[];addEventListener('pointerdown',e=>__d049Touches.push({type:e.pointerType,trusted:e.isTrusted}),true)");
 await p.tapBtn('#menuBtn');await p.tapBtn('#menu [data-m="export"]');
 // Discovering menu selector incorrectly must fail rather than replacing actual touch with JS clicks.
 assert.equal(await p.ev("document.querySelector('#dlg').hidden"),false);assert.equal(await p.ev("document.querySelector('#copyStatus')===null"),true);
 const before=await p.ev('__gt.save()');assert.equal(await p.ev("document.querySelector('#dlg textarea').value"),before);
 const mode=v.width===360?'unsupported':'success';
 await p.ev(`window.__d049Copies=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:${mode==='unsupported'?'undefined':"{writeText:async text=>__d049Copies.push(text)}"}})`);
 await p.tapBtn('#dlgOk');assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,5000));await p.frames(3);
 assert.equal(await p.ev('__gt.save()'),before);const touches=await p.ev('__d049Touches');assert.ok(touches.length>=3&&touches.every(x=>x.trusted&&x.type==='touch'));
 const frame=await page.send('Page.getResourceTree'),url=frame.frameTree.frame.url,res=await page.send('Page.getResourceContent',{frameId:frame.frameTree.frame.id,url});assert.equal(hash(Buffer.from(res.content,res.base64Encoded?'base64':'utf8')),expected);
 const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'),name=`D049-${mode}-before-${v.width}x${v.height}.png`;fs.writeFileSync(path.join(OUT,name),bytes);report.shots.push({name,sha256:hash(bytes),viewport:v,mode,camera:await p.ev('__gt.cam()'),codeSha256:hash(before),touches});
 assert.deepEqual(page.errors,[]);assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[]);
 });report.checks.push({view:v.width,pass:true});console.log('OK D049 original baseline',v.width);}catch(e){report.checks.push({view:v.width,pass:false,error:e.stack});console.error('NG D049 baseline',v.width,e.stack);}}
fs.writeFileSync(path.join(OUT,'report.json'),J(report,null,2)+'\n');process.exitCode=report.checks.some(x=>!x.pass)?1:0;
