import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withBrowser} from '../../tools/cdp.mjs';
import {encodeLabCode} from '../../src/io/labcode.ts';
import {loadCode,saveCode} from '../../src/io/save.ts';
import {commitOp} from '../../src/sim/edit.ts';
import {KINDS} from '../../src/content/kinds.ts';
const width=Number(process.argv.find(s=>s.startsWith('--width='))?.split('=')[1]??1440),height=width===1440?1000:860;
const baseline=process.argv.includes('--baseline');
const out=`scratch/d085/${width}${baseline?'-baseline':''}`;fs.mkdirSync(out,{recursive:true});
const rd=Array(1024).fill('0');
const rawCode=encodeLabCode({v:1,n:32,seed:20261084,day:0,money:20000,nm:'D084 frontage',df:3,ter:'2'.repeat(1024),tre:'0'.repeat(1024),rd:rd.join(''),bl:[]},{deflate:true});
const loaded=loadCode(rawCode,KINDS,JSON.parse(fs.readFileSync('src/content/samples/d009-live.json')).vrank);assert.ok(loaded.ok,loaded.error);
const roadBuild=commitOp(loaded.sim,{k:'line',tool:'alley',x0:5,z0:7,x1:12,z1:7},0);
assert.equal(roadBuild.placed,8,'fixture roads are real native edits with history');
const code=saveCode(loaded.sim,loaded.template,loaded.start);
const replay=loadCode(code,KINDS,JSON.parse(fs.readFileSync('src/content/samples/d009-live.json')).vrank);
assert.ok(replay.ok && replay.replayed,'fixture must fully replay before browser import');
const report={width,height,source:baseline?'1e7b43e96097969fac33b57c37fe02444cefb15c':process.env.GITHUB_SHA,shots:[],passed:false,errors:[]};
const record=()=>fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
record();
try {await withBrowser({width,height,port:8644,root:baseline?path.resolve('scratch/d085-baseline'):path.resolve('dist')},async({open,page})=>{
 const settle=()=>page.evaluate('for(let i=0;i<160;i++)__gt.spin(0);new Promise(r=>{let n=0;function f(){if(++n===8)r();else requestAnimationFrame(f)}requestAnimationFrame(f)})');
 const shot=async(name)=>{await settle();await page.evaluate(`new Promise((resolve,reject)=>{const start=performance.now();function check(){if(document.querySelector('#toasts')?.childElementCount===0 && !document.getAnimations().some(a=>a.playState==='running'))setTimeout(resolve,500);else if(performance.now()-start>10000)reject(new Error('Native UI did not settle'));else setTimeout(check,50)}check()})`);const png=Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64');fs.writeFileSync(`${out}/${name}.png`,png);report.shots.push({name,sha256:createHash('sha256').update(png).digest('hex'),stats:await page.evaluate('__gt.renderInfoAll()')});record();};
 for (const enabled of (baseline?[false]:[false,true])) {
  report.phase='open '+(enabled?'existing isolated city':'new isolated city');record();
  let openTimer;try{await Promise.race([open('sample='+(enabled?'mine':'newcity')+'&streetFrontage='+(enabled?'1':'0')),new Promise((_,reject)=>{openTimer=setTimeout(()=>reject(new Error('Open timed out; no modal accepted')),90000)})]);}finally{clearTimeout(openTimer);}
  await page.evaluate('document.fonts.ready');
  if(width!==1440)await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  assert.equal(await page.evaluate('__gt.webgl2'),true);
  await page.evaluate('__gt.simPlay(false);__gt.clearSave();__gt.menu("paste")');
  await page.evaluate(`document.querySelector('#dlg textarea').value=${JSON.stringify(code)}`);
  const button=await page.evaluate("(()=>{const r=document.querySelector('#dlgOk').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()");
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:button[0],y:button[1],button:'left',buttons:1,clickCount:1});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:button[0],y:button[1],button:'left',buttons:0,clickCount:1});await settle();
  assert.equal(await page.evaluate('__gt.ui().dock'),'build','paste UI creates an editable city');
  report.importNotices=await page.evaluate("Array.from(document.querySelectorAll('#toasts .toast')).map(t=>({text:t.textContent,bad:t.classList.contains('bad')}))");assert.ok(!report.importNotices.some(t=>t.bad),'native import must not warn of history mismatch');record();
  await page.evaluate('__gt.simPlay(false);__gt.view(9,9,2);__gt.tool("civic","heritageGranary")');await settle();
  const before=await page.evaluate('JSON.stringify([__gt.save(),__gt.history()])');
  const [x,y]=await page.evaluate('__gt.cellScreen(8,8)');
  assert.ok(x>0&&x<width&&y>0&&y<height);
  if(width===1440)await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
  else await page.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1,radiusX:1,radiusY:1,force:1}]});await settle();
  report.pointer=await page.evaluate(`({ui:__gt.ui(),stroke:__gt.stroke(),hit:document.elementFromPoint(${x},${y})?.tagName})`);record();
  await shot(enabled?'candidate-precheck':'legacy-precheck');
  assert.equal(await page.evaluate('__gt.previewCount()'),4,'actual native footprint');
  assert.equal(await page.evaluate('__gt.frontageCount?.() ?? 0'),enabled?2:0,'only the two shared north edges');
  assert.equal(await page.evaluate('JSON.stringify([__gt.save(),__gt.history()])'),before,'held preview changes no world');
  await shot(enabled?'candidate-held':'legacy-held');
  for(const [label,zoom]of [['near',3],['far',.8]]){await page.evaluate(`__gt.view(9,9,${zoom})`);await shot((enabled?'candidate-':'legacy-')+label);}
  await page.evaluate('__gt.view(9,9,2)');await settle();
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  if(width===1440)await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});
  else await page.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
  assert.equal(await page.evaluate('__gt.frontageCount?.() ?? 0'),0,'cancel clears strips');
  assert.equal(await page.evaluate('JSON.stringify([__gt.save(),__gt.history()])'),before,'cancel preserves world');
  await shot(enabled?'candidate-cancelled':'legacy-cancelled');
 }
 if(!baseline){
  const reference=JSON.parse(fs.readFileSync(`scratch/d085/${width}-baseline/report.json`));
  for(const name of ['legacy-precheck','legacy-held','legacy-near','legacy-far','legacy-cancelled']) assert.equal(report.shots.find(s=>s.name===name).sha256,reference.shots.find(s=>s.name===name).sha256,'disabled whole PNG equals published main '+name);
  report.baselineWholeFrameEqual=true;
  const a=report.shots.find(s=>s.name==='legacy-held').stats,b=report.shots.find(s=>s.name==='candidate-held').stats;
  assert.ok(b.calls<=a.calls+1,'at most one additional native draw call');assert.ok(b.triangles<=a.triangles+32,'at most 16 thin strips / 32 triangles');
  report.nativeBudgetDelta={calls:b.calls-a.calls,triangles:b.triangles-a.triangles};
  // D085: real native menu button, not the __gt.menu test shortcut.
  const click=async(selector)=>{
    const [cx,cy]=await page.evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)throw Error('Missing native control');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return[r.x+r.width/2,r.y+r.height/2]})()`);
    await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:cx,y:cy,button:'left',buttons:1,clickCount:1});
    await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:cx,y:cy,button:'left',buttons:0,clickCount:1});await settle();
  };
  await open('sample=mine&streetFrontageControl=1');await page.evaluate('document.fonts.ready;__gt.simPlay(false)');await settle();
  const stable=await page.evaluate('JSON.stringify([__gt.save(),__gt.history()])');
  await click('#menuBtn');assert.match(await page.evaluate(`document.querySelector('[data-m="frontage"]').textContent`),/開啟道路共邊/);await page.evaluate(`document.querySelector('[data-m="frontage"]').scrollIntoView({block:'center'})`);await shot('control-off-menu');
  await click('[data-m="frontage"]');
  await page.evaluate('__gt.view(9,9,2);__gt.tool("civic","heritageGranary")');await settle();
  const hold=async()=>{const [hx,hy]=await page.evaluate('__gt.cellScreen(8,8)');await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:hx,y:hy,button:'left',buttons:1,clickCount:1});await settle();return[hx,hy];};
  let [hx,hy]=await hold();assert.equal(await page.evaluate('__gt.frontageCount()'),2);await shot('control-enabled-held');
  // Keyboard opens the actual menu while pointer is held: interruption must clear the preview.
  await page.evaluate('document.querySelector("#menuBtn").focus()');
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await settle();
  assert.equal(await page.evaluate('document.querySelector("#menu").hidden'),false);
  assert.equal(await page.evaluate('__gt.frontageCount()'),0,'opening native menu cancels held gold');
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:hx,y:hy,button:'left',buttons:0,clickCount:1});
  await page.evaluate(`document.querySelector('[data-m="frontage"]').scrollIntoView({block:'center'})`);await shot('control-on-menu');await click('[data-m="frontage"]');
  [hx,hy]=await hold();assert.equal(await page.evaluate('__gt.frontageCount()'),0,'disabled real preview has no gold');
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:hx,y:hy,button:'left',buttons:0,clickCount:1});await settle();
  assert.equal(await page.evaluate('JSON.stringify([__gt.save(),__gt.history()])'),stable,'UI toggles preserve save/history bytes');
  await click('#menuBtn');await click('[data-m="frontage"]');[hx,hy]=await hold();assert.equal(await page.evaluate('__gt.frontageCount()'),2);
  await page.evaluate('__gt.tool("road","alley")');assert.equal(await page.evaluate('__gt.frontageCount()'),0,'tool switch clears gold');
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:hx,y:hy,button:'left',buttons:0,clickCount:1});
  await open('sample=mine&streetFrontageControl=1');await page.evaluate('__gt.simPlay(false)');await settle();
  assert.equal(await page.evaluate('__gt.frontageCount()'),0,'reload has no orphan gold');
  await click('#menuBtn');assert.match(await page.evaluate(`document.querySelector('[data-m="frontage"]').textContent`),/開啟道路共邊/);await page.evaluate(`document.querySelector('[data-m="frontage"]').scrollIntoView({block:'center'})`);await shot('control-reloaded-off');await click('#menuX');
  // Native export/import transition while enabled must clear transient render state.
  await click('#menuBtn');await click('[data-m="frontage"]');
  await page.evaluate('__gt.tool("civic","heritageGranary");__gt.view(9,9,2)');[hx,hy]=await hold();assert.equal(await page.evaluate('__gt.frontageCount()'),2);
  await page.evaluate('document.querySelector("#menuBtn").focus()');
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await settle();
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:hx,y:hy,button:'left',buttons:0,clickCount:1});
  await click('[data-m="paste"]');
  await page.evaluate(`document.querySelector('#dlg textarea').value=${JSON.stringify(code)}`);await click('#dlgOk');
  assert.equal(await page.evaluate('__gt.frontageCount()'),0,'import scene contains no orphan gold');
  assert.equal(await page.evaluate('__gt.previewCount()'),0,'import clears held preview');await shot('control-import-cleared');
  report.nativeControl={liveToggle:true,heldMenuCancel:true,toolSwitch:true,reloadDefaultOff:true,importSceneClear:true,worldBytesUnchanged:true};

 }
 report.errors=page.errors;assert.deepEqual(page.errors,[]);report.passed=true;record();
});}catch(e){report.failure=String(e.stack??e);record();throw e;}
