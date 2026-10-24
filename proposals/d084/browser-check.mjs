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
const out=`scratch/d084/${width}${baseline?'-baseline':''}`;fs.mkdirSync(out,{recursive:true});
const rd=Array(1024).fill('0');
const rawCode=encodeLabCode({v:1,n:32,seed:20261084,day:0,money:20000,nm:'D084 frontage',df:3,ter:'2'.repeat(1024),tre:'0'.repeat(1024),rd:rd.join(''),bl:[]},{deflate:true});
const loaded=loadCode(rawCode,KINDS,JSON.parse(fs.readFileSync('src/content/samples/d009-live.json')).vrank);assert.ok(loaded.ok,loaded.error);
const roadBuild=commitOp(loaded.sim,{k:'line',tool:'alley',x0:5,z0:7,x1:12,z1:7},0);
assert.equal(roadBuild.placed,8,'fixture roads are real native edits with history');
const code=saveCode(loaded.sim,loaded.template,loaded.start);
const replay=loadCode(code,KINDS,JSON.parse(fs.readFileSync('src/content/samples/d009-live.json')).vrank);
assert.ok(replay.ok && replay.replayed,'fixture must fully replay before browser import');
const report={width,height,source:baseline?'e0508afacaf660bc5864d0cc136c22bcedb7f5bb':process.env.GITHUB_SHA,shots:[],passed:false,errors:[]};
const record=()=>fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
record();
try {await withBrowser({width,height,port:8644,root:baseline?path.resolve('scratch/d084-baseline'):path.resolve('dist')},async({open,page})=>{
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
  const reference=JSON.parse(fs.readFileSync(`scratch/d084/${width}-baseline/report.json`));
  for(const name of ['legacy-precheck','legacy-held','legacy-near','legacy-far','legacy-cancelled']) assert.equal(report.shots.find(s=>s.name===name).sha256,reference.shots.find(s=>s.name===name).sha256,'disabled whole PNG equals published main '+name);
  report.baselineWholeFrameEqual=true;
  const a=report.shots.find(s=>s.name==='legacy-held').stats,b=report.shots.find(s=>s.name==='candidate-held').stats;
  assert.ok(b.calls<=a.calls+1,'at most one additional native draw call');assert.ok(b.triangles<=a.triangles+32,'at most 16 thin strips / 32 triangles');
  report.nativeBudgetDelta={calls:b.calls-a.calls,triangles:b.triangles-a.triangles};
 }
 report.errors=page.errors;assert.deepEqual(page.errors,[]);report.passed=true;record();
});}catch(e){report.failure=String(e.stack??e);record();throw e;}
