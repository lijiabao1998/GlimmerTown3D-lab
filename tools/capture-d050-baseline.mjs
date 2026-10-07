// QA-only D049 original product capture for D050. Never merge or deploy this branch.
// Portrait Chrome/CDP touch emulation, not Android hardware. Input.insertText is
// genuine trusted CDP text input, not a native OS clipboard paste or clipboard read.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {decodeLabCode} from '../src/io/labcode.ts';
import {D048_CAMERA,D048_BASELINE_CAMERA,D048_SAVE_KEY,D048_VIEWS,d048ReviewCode,d048FixtureManifest} from './d048-scenes.mjs';
const J=JSON.stringify,hash=s=>createHash('sha256').update(typeof s==='string'||Buffer.isBuffer(s)?s:J(s)).digest('hex');
const OUT=path.join(ROOT,'scratch/d050-baseline');fs.mkdirSync(OUT,{recursive:true});
const base='71bf40db307663c2713ec6a83c2aa4c327e5c7ca';
const expected='68d825da457c2f64dec5b72da04fbda0dac131fbe8ff9f00b785f1a21f6bb000';
assert.equal(process.env.GITHUB_REF,'refs/heads/claude/d050-baseline-capture');
assert.equal(hash(fs.readFileSync(path.join(ROOT,'dist/index.html'))),expected);
const SNAP=`({sim:__gt.sim(),layers:__gt.layers(),buildings:__gt.buildingList(),history:__gt.history(),commission:__gt.simCms(),code:__gt.save(),saved:__gt.saved(),lastDay:__gt.lastDay(),dayReport:__gt.dayRep(),url:location.href,historyLength:history.length,storage:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))})`;
const INPUT=`(()=>{const t=document.querySelector('#dlg textarea'),e=document.querySelector('#dlg .err');return {value:t.value,error:e.textContent,invalid:t.getAttribute('aria-invalid'),describedBy:t.getAttribute('aria-describedby'),errorId:e.id,errorRole:e.getAttribute('role')};})()`;
const PROBE=`window.__d050={pointers:[],inputs:[],submits:[]};
addEventListener('pointerdown',e=>__d050.pointers.push({pointerType:e.pointerType,trusted:e.isTrusted,target:e.target.id||e.target.tagName}),true);
for(const type of ['beforeinput','input'])addEventListener(type,e=>{if(e.target.matches('#dlg textarea'))__d050.inputs.push({type,trusted:e.isTrusted,inputType:e.inputType,data:e.data,value:e.target.value})},true);
addEventListener('click',e=>{if(e.target.closest('#dlgOk'))__d050.submits.push({trusted:e.isTrusted,value:document.querySelector('#dlg textarea').value})},true);`;
const fixture=d048ReviewCode();assert.equal(decodeLabCode(fixture).ok,true);
const report={base,tree:'32226116bbe345d3415a00f309d9b851a3c8651f',htmlSha256:expected,qaCommit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,device:'Chrome CDP portrait touch emulation; no Android hardware',textInput:'CDP Input.insertText; not native OS clipboard paste',fixture:{...d048FixtureManifest(),baseline:{commit:base,htmlSha256:expected}},shots:[],checks:[]};
for(const v of D048_VIEWS){try{await withBrowser({width:960,height:900},async({page,open})=>{
 const p=await pageSession(page,open,{W:v.width,H:v.height});
 await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem(${J(D048_SAVE_KEY)},${J(fixture)})`);await p.open('');
 await p.ev(`__gt.view(${D048_CAMERA.x},${D048_CAMERA.z},${D048_CAMERA.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
 await p.ev('__gt.saveNow()');await p.ev('__gt.journalFlush()');await p.ev('__gt.saveNow()');
 assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,5000));
 assert.deepEqual(await p.ev('__gt.cam()'),D048_BASELINE_CAMERA);assert.equal((await p.ev('__gt.sim()')).playing,false);
 const before=await p.ev(SNAP),journalBefore=await p.ev('__gt.journalRows()');await p.ev(PROBE);
 assert.ok(await p.tapBtn('#menuBtn'));assert.ok(await p.tapBtn('#menu [data-m="paste"]'));
 assert.equal(await p.ev("document.querySelector('#dlg').hidden"),false);
 assert.equal(await p.ev("document.querySelector('#dlgTitle').textContent"),'貼上分享碼');
 assert.equal((await p.ev(INPUT)).value,'');
 const mode=v.width===360?'edited-empty-error':'invalid-error';let expectedField,expectedError;
 if(v.width===360){
  await p.tapBtn('#dlgOk');assert.equal((await p.ev(INPUT)).error,'分享碼是空的');
  assert.ok(await p.tapBtn('#dlg textarea'));await page.send('Input.insertText',{text:fixture});
  expectedField=fixture;expectedError='分享碼是空的'; // Do not resubmit the now-filled field.
 }else{
  assert.ok(await p.tapBtn('#dlg textarea'));await page.send('Input.insertText',{text:'!!!'});await p.tapBtn('#dlgOk');
  expectedField='!!!';const decoded=decodeLabCode(expectedField);assert.equal(decoded.ok,false);expectedError=decoded.error;
 }
 await p.frames(3);const field=await p.ev(INPUT);assert.equal(field.value,expectedField);assert.equal(field.error,expectedError);
 assert.equal(field.invalid,null);assert.equal(field.describedBy,null);assert.equal(field.errorId,'');assert.equal(field.errorRole,'alert');
 const after=await p.ev(SNAP),journalAfter=await p.ev('__gt.journalRows()');
 assert.deepEqual(after,before,'world, money, history, saved code, localStorage and URL remain exactly unchanged');
 assert.deepEqual(journalAfter,journalBefore,'journal bytes remain unchanged');
 const probe=await p.ev('__d050');assert.ok(probe.pointers.length>=4&&probe.pointers.every(e=>e.trusted&&e.pointerType==='touch'));
 assert.equal(probe.inputs.filter(e=>e.type==='input').length,1);assert.ok(probe.inputs.every(e=>e.trusted&&e.inputType==='insertText'));
 assert.equal(probe.inputs.find(e=>e.type==='input').value,expectedField);assert.equal(probe.inputs.find(e=>e.type==='input').data,expectedField);
 assert.deepEqual(probe.submits,[{trusted:true,value:v.width===360?'':'!!!'}]);
 const frame=await page.send('Page.getResourceTree'),url=frame.frameTree.frame.url;
 const res=await page.send('Page.getResourceContent',{frameId:frame.frameTree.frame.id,url});
 const actualHtmlSha256=hash(Buffer.from(res.content,res.base64Encoded?'base64':'utf8'));assert.equal(actualHtmlSha256,expected);
 assert.deepEqual(await p.ev('__gt.cam()'),D048_BASELINE_CAMERA);assert.deepEqual(page.errors,[]);
 assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[]);
 const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64');
 const name=`D050-${mode}-before-${v.width}x${v.height}.png`;fs.writeFileSync(path.join(OUT,name),bytes);
 const stateName=`D050-state-${v.width}.json`;fs.writeFileSync(path.join(OUT,stateName),J({before,after,journalBefore,journalAfter},null,2)+'\n');
 report.shots.push({name,sha256:hash(bytes),viewport:v,mode,camera:await p.ev('__gt.cam()'),actualHtmlSha256,field,fieldSha256:hash(field.value),fieldByteLength:Buffer.byteLength(field.value),worldSaveBeforeSha256:hash(before),worldSaveAfterSha256:hash(after),journalBeforeSha256:hash(journalBefore),journalAfterSha256:hash(journalAfter),stateName,probe});
 });report.checks.push({view:v.width,pass:true});console.log('OK D050 original baseline',v.width);
 }catch(e){report.checks.push({view:v.width,pass:false,error:e.stack});console.error('NG D050 baseline',v.width,e.stack);}}
fs.writeFileSync(path.join(OUT,'report.json'),J(report,null,2)+'\n');process.exitCode=report.checks.some(x=>!x.pass)?1:0;
