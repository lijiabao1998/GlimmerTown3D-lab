// Shared D053 evidence and CLI. QA baseline branch never merges/deploys.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { builtBase } from './d036-cities.mjs';
import { loadCode } from '../src/io/save.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { stepDay } from '../src/sim/day.ts';
import { previewOp } from '../src/sim/edit.ts';
import { RANKS } from '../src/sim/rules/rank.ts';
import { D052_SNAPSHOT } from './d052-capture.mjs';
import { D053_BASELINE,D053_MODES,D053_SHOTS,D053_CAMERA,D053_BASELINE_CAMERA,D053_SAVE_KEY,D053_SPACE_SITE,D053_TOOL_IDS,d053ReviewCode,d053FixtureManifest } from './d053-scenes.mjs';
const J=JSON.stringify;
export const d053Hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
export const D053_SNAPSHOT=D052_SNAPSHOT;
export const D053_UI=`(()=>({rank:__gt.rankRep(),rankPanel:__gt.rankPanel(),rankRows:__gt.rankRows(),ui:__gt.ui(),civic:[...document.querySelectorAll('#civicSub [data-c]')].map(b=>({id:b.dataset.c,text:b.textContent,label:b.getAttribute('aria-label'),disabled:b.getAttribute('aria-disabled'),locked:b.classList.contains('locked')})),catalog:document.querySelector('#catalog')?{open:!document.querySelector('#catalog').hidden,text:document.querySelector('#catalog').textContent,tools:[...document.querySelectorAll('#catalog [data-tool]')].map(b=>({id:b.dataset.tool,text:b.textContent,disabled:b.getAttribute('aria-disabled')}))}:null,toasts:[...document.querySelectorAll('.toast')].map(e=>e.textContent)}))()`;
export const D053_PROBE=`window.__d053Input=[];for(const type of ['pointerdown','pointerup','click','keydown','keyup'])addEventListener(type,e=>{const b=e.target.closest?.('button');__d053Input.push({type,trusted:e.isTrusted,pointerType:e.pointerType??'',key:e.key??'',target:b?.id??e.target.id??'',c:b?.dataset.c??'',tool:b?.dataset.tool??'',label:b?.textContent??''})},true)`;
export const D053_CAPTURE_QUALIFICATIONS=[
 'Synthetic save fixtures only; no runtime rank, population, money or world mutation.',
 'Activation uses genuine CDP touch/mouse/keyboard. scrollIntoView only positions controls.',
 'rank-live explicitly invokes original __gt.simStep(1) -> simDay once, checked against Node original simulator.',
 'Same fixture, full realized camera, visual time and viewport before/after; image/source/state SHA256 retained.',
 'Snapshots include original public debug observations; __gt.sim() can recompute road rp through powerStatus. Not claimed globally pure or a hidden RNG dump.',
 'Chrome emulation, not Android hardware. Navigation-only cases verify code/layers/history/money/day unchanged.',
];
export async function tapD053(p,selector,mobile=true) {
 await p.ev(`document.querySelector(${J(selector)}).scrollIntoView({block:'center'})`);await p.frames(2);
 const c=await p.center(selector);assert.ok(c&&c[0]>=0&&c[0]<=p.W&&c[1]>=0&&c[1]<=p.H,selector);
 assert.equal(await p.ev(`document.querySelector(${J(selector)}).contains(document.elementFromPoint(${c[0]},${c[1]}))`),true,selector+' hit target');
 assert.ok(await(mobile?p.tapBtn:p.clickBtn)(selector));
}
export async function loadD053(p,mode) {
 await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem(${J(D053_SAVE_KEY)},${J(d053ReviewCode(mode))})`);await p.open('');
 await p.ev(`__gt.view(${D053_CAMERA.x},${D053_CAMERA.z},${D053_CAMERA.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
 assert.equal(await p.ev('__gt.saveNow()'),true);await p.ev('__gt.journalFlush()');assert.equal(await p.ev('__gt.saveNow()'),true);
 assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,6000));await p.frames(2);
 assert.deepEqual(await p.ev('__gt.cam()'),D053_BASELINE_CAMERA);assert.equal(await p.ev('__gt.sim().playing'),false);await p.ev(D053_PROBE);
}
const navWorld=s=>({code:s.code,layers:s.layers,history:s.history,buildings:s.buildings,money:s.sim.money,day:s.sim.day});
export async function captureD053Scene(p,page,mode,{phase,outDir,mobile=true}) {
 assert.ok(['before','after'].includes(phase));fs.mkdirSync(outDir,{recursive:true});
 const write=(n,v)=>fs.writeFileSync(path.join(outDir,n),typeof v==='string'||Buffer.isBuffer(v)?v:J(v,null,2));
 const shot=D053_SHOTS.find(s=>s.mode===mode),fixture=d053FixtureManifest(mode),code=d053ReviewCode(mode),decoded=decodeLabCode(code),item={mode,phase,fixture,viewport:{width:p.W,height:p.H},assertions:[],passed:false};
 const check=(name,fn)=>{fn();item.assertions.push(name);},tap=s=>tapD053(p,s,mobile);
 const menuRank=async()=>{await tap('#menuBtn');await tap('#menu [data-m="rank"]');};
 const civic=async()=>{await tap('.tool[data-t="civic"]');};
 const catalog=async()=>{if(phase==='before')await civic();else{await menuRank();await tap('#rkCatalog');}};
 const before=await p.ev(D053_SNAPSHOT);
 write(`D053-${phase}-fixture-${mode}.code.txt`,code);write(`D053-${phase}-fixture-${mode}.raw.json`,decoded.save.raw);write(`D053-${phase}-state-initial-${mode}.json`,before);
 check('paused exact saved rank/day/money',()=>{assert.equal(before.sim.playing,false);assert.equal(before.sim.day,fixture.day);assert.equal(before.sim.money,10000);assert.equal(before.technology.rank,fixture.rankIndex);});
 const take=async()=>{
  if(!shot)return;assert.deepEqual(item.viewport,{width:shot.width,height:shot.height});await p.frames(2);
  const camera=await p.ev('__gt.cam()'),con=await p.ev('__gt.con()');assert.deepEqual(camera,D053_BASELINE_CAMERA);assert.equal(con.visT,2.2);assert.equal(con.dayFrac,0);
  const filename=`D053-${phase}-${shot.scene}-${p.W}.png`,bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');assert.ok(bytes.length>10000);assert.equal(bytes.readUInt32BE(16),p.W);assert.equal(bytes.readUInt32BE(20),p.H);write(filename,bytes);
  const state=await p.ev(D053_SNAPSHOT);item.shot={filename,sha256:d053Hash(bytes),bytes:bytes.length,viewport:item.viewport,camera,cameraSha256:d053Hash(camera),visual:{visT:con.visT,dayFrac:con.dayFrac},fixture,ui:await p.ev(D053_UI),stateSha256:d053Hash(state),stateFile:`D053-${phase}-state-shot-${mode}.json`};write(item.shot.stateFile,state);
 };
 if(['rank6','rank8','rank12','rank17','space-rank'].includes(mode)) {
  await menuRank();const ui=await p.ev(D053_UI),level=fixture.rankIndex+1;
  check(`original rank ${level} is rendered`,()=>{assert.ok(ui.rankPanel.open);assert.ok(ui.rankRows.some(r=>r[0]==='等級'&&r[1].startsWith(`Lv.${level} `)));});
  check('phase-specific truthful current-line unlock explanation',()=>{
   if(phase==='before')assert.ok(ui.rankRows.some(r=>r[1]===RANKS[fixture.rankIndex].unlock));
   else if(mode==='space-rank')assert.match(J(ui.rankRows),/太空研究中心/);
   else{assert.ok(!ui.rankRows.some(r=>r[1]===RANKS[fixture.rankIndex].unlock));assert.match(J(ui.rankRows),/本線|尚未|未提供|未開放|未實裝/);}
  });await take();await tap('#rkX');await civic();
  const toolUI=await p.ev(D053_UI);check('all18 real civic tools, no unimplemented culture/landmark/research tools',()=>{assert.deepEqual(toolUI.civic.map(c=>c.id),D053_TOOL_IDS);assert.deepEqual(toolUI.civic.filter(c=>c.locked).map(c=>c.id),mode==='space-rank'?[]:['megaproject']);});
  if(!mobile){await menuRank();await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});const escaped=await p.ev(D053_UI);check('native keyboard Escape closes rank',()=>assert.equal(escaped.rankPanel.open,false));}
 }else if(mode==='catalog'||mode==='space-catalog') {
  await catalog();if(mode==='space-catalog'){const selector=phase==='before'?'#civicSub [data-c="megaproject"]':'#catalog [data-tool="megaproject"]';await p.ev(`document.querySelector(${J(selector)}).scrollIntoView({block:'center'})`);await p.frames(2);}
  const ui=await p.ev(D053_UI);check('18 original tools retained in catalog entry flow',()=>{assert.deepEqual(ui.civic.map(c=>c.id),D053_TOOL_IDS);if(phase==='after'){assert.ok(ui.catalog.open);assert.deepEqual(ui.catalog.tools.map(t=>t.id).sort(),[...D053_TOOL_IDS].sort());}});await take();
 }else if(mode==='rank21') {
  await civic();const ui=await p.ev(D053_UI);assert.ok(ui.civic.find(c=>c.id==='megaproject').locked);await tap('#civicSub [data-c="megaproject"]');
  const after=await p.ev(D053_UI);check('rank21 still genuinely refuses space selection',()=>{assert.equal(after.ui.civicTool,ui.ui.civicTool);assert.ok(after.toasts.some(t=>/Lv\.22/.test(t)));});
 }else if(mode==='space-build') {
  await catalog();await tap(phase==='before'?'#civicSub [data-c="megaproject"]':'#catalog [data-tool="megaproject"]');
  const selected=await p.ev(D053_UI);check('rank22 actual space tool selected',()=>assert.equal(selected.ui.civicTool,'megaproject'));
  const {x,z,size}=D053_SPACE_SITE,{KT,vrank}=builtBase(),control=loadCode(code,KT,vrank);assert.ok(control.ok);const op={k:'tap',tool:'megaproject',x0:x,z0:z,x1:x,z1:z};const modelPreview=previewOp(control.sim,op);assert.equal(modelPreview.total,4500);assert.equal(modelPreview.cells.length,9);assert.equal(modelPreview.count,1);
  const at=await p.cell(x,z);assert.equal(await p.hit(at),'CANVAS');await p.drag(at,at,2);item.preview=await p.ev('__gt.stroke()');
  check('trusted hold produces9cells preview costing4500',()=>{assert.equal(item.preview.preview.cells,9);assert.equal(item.preview.preview.total,4500);assert.equal(item.preview.preview.count,1);});await p.release();await p.frames(2);
  const after=await p.ev(D053_SNAPSHOT),event=after.history.at(-1);check('actual build charges4500, one k51 event and nine same occupancy cells',()=>{assert.equal(after.sim.money,5500);assert.equal(after.sim.day,before.sim.day);assert.equal(after.history.length,before.history.length+1);assert.equal(event.t,'place');assert.equal(event.k,51);assert.equal(event.x,x);assert.equal(event.z,z);assert.equal(event.cost,4500);const ids=[];for(let dz=0;dz<size;dz++)for(let dx=0;dx<size;dx++)ids.push(after.layers.occ[(z+dz)*after.layers.n+x+dx]);assert.deepEqual([...new Set(ids)],[event.id]);});
  await p.ev('__gt.setVisT(2.2);__gt.setDayFrac(0)');await take();await tap('#undo');const undone=await p.ev(D053_SNAPSHOT);check('real undo restores money, occupancy, zone and tree',()=>{assert.equal(undone.sim.money,10000);for(const key of ['occ','zone','tree'])assert.deepEqual(undone.layers[key],before.layers[key]);});item.buildEvent=event;
 }else if(mode==='rank-live') {
  await menuRank();const old=await p.ev(D053_UI),{KT,vrank}=builtBase(),control=loadCode(code,KT,vrank);assert.ok(control.ok);stepDay(control.sim);await p.ev('__gt.simStep(1);__gt.setVisT(2.2);__gt.setDayFrac(0)');const ui=await p.ev(D053_UI),state=await p.ev(D053_SNAPSHOT);
  check('one original day really promotes rank3to4 and updates money/points',()=>{assert.equal(ui.rank.day,51);assert.equal(ui.rank.idx,3);assert.equal(ui.rank.points,169);assert.deepEqual(ui.rank.promoted,[3]);assert.equal(state.sim.money,control.sim.money);});
  check('open rank panel stale before/live after',()=>{assert.ok(ui.rankPanel.open);if(phase==='before'){assert.deepEqual(ui.rankRows,old.rankRows);assert.equal(ui.rankPanel.sub,old.rankPanel.sub);assert.match(ui.rankPanel.sub,/第 50 天/);}else{assert.match(ui.rankPanel.sub,/第 51 天/);assert.ok(ui.rankRows.some(r=>r[0]==='等級'&&r[1].startsWith('Lv.4 ')));assert.ok(ui.rankRows.some(r=>r[0]==='城市點數'&&r[1]==='169'));}});await take();item.oldUI=old;
 }else throw new Error('Unknown capture mode '+mode);
 const after=await p.ev(D053_SNAPSHOT);write(`D053-${phase}-state-final-${mode}.json`,after);item.ui=await p.ev(D053_UI);item.inputs=await p.ev('__d053Input');item.beforeSha256=d053Hash(before);item.afterSha256=d053Hash(after);
 if(mode!=='space-build'&&mode!=='rank-live')check('navigation changes no saved code, layers, history, buildings, money or day',()=>assert.deepEqual(navWorld(after),navWorld(before)));
 check('all recorded activation events are genuine',()=>{assert.ok(item.inputs.some(e=>e.type==='click'&&e.trusted));assert.ok(item.inputs.every(e=>e.trusted));});
 check('zero external requests and console errors',()=>{assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[]);assert.deepEqual(page.errors,[]);});
 item.layout=await p.ev('({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight})');check('no horizontal page overflow',()=>assert.ok(item.layout.scroll<=item.layout.width));item.passed=true;return item;
}
export async function captureD053({phase='before',outDir=path.join(ROOT,'scratch/d053-'+phase),modes=D053_MODES}={}) {
 fs.mkdirSync(outDir,{recursive:true});const report={purpose:'D053 shared fixed-fixture evidence. Baseline branch never merges/deploys.',phase,baseline:D053_BASELINE,qualifications:D053_CAPTURE_QUALIFICATIONS,cases:[],shots:[],passed:false};
 try{
  const html=fs.readFileSync(path.join(ROOT,'dist/index.html'));report.htmlSha256=d053Hash(html);if(phase==='before')assert.equal(report.htmlSha256,D053_BASELINE.htmlSha256,'exact unchanged baseline HTML');fs.writeFileSync(path.join(outDir,`${phase}-index.html`),html);
  report.sources=Object.fromEntries(['src/cityView.ts','src/ui/build.ts','src/sim/edit.ts','src/sim/rules/rank.ts','tools/d053-scenes.mjs','tools/d053-capture.mjs'].filter(f=>fs.existsSync(path.join(ROOT,f))).map(f=>[f,d053Hash(fs.readFileSync(path.join(ROOT,f)))]));fs.writeFileSync(path.join(outDir,'fixture-manifest.json'),J(modes.map(d053FixtureManifest),null,2));
  for(const mode of modes){const shot=D053_SHOTS.find(s=>s.mode===mode),mobile=mode!=='rank17',width=shot?.width??(mobile?412:1280),height=shot?.height??(mobile?860:800);
   await withBrowser({width:Math.max(960,width),height:900},async({page,open})=>{const p=await pageSession(page,open,{W:width,H:height,mobile});try{await loadD053(p,mode);const item=await captureD053Scene(p,page,mode,{phase,outDir,mobile});report.cases.push(item);if(item.shot)report.shots.push(item.shot);console.log(`PASS ${mode}: ${item.assertions.length} groups${item.shot?' PNG '+item.shot.filename+' sha256='+item.shot.sha256:''}`);}catch(e){const failed={mode,passed:false,error:String(e.stack??e)};report.cases.push(failed);console.error(`FAIL ${mode}: ${failed.error}`);try{fs.writeFileSync(path.join(outDir,`failure-${mode}.json`),J({state:await p.ev(D053_SNAPSHOT),ui:await p.ev(D053_UI),errors:page.errors,inputs:await p.ev('window.__d053Input??[]')},null,2));fs.writeFileSync(path.join(outDir,`failure-${mode}.png`),Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));}catch(debug){failed.debugError=String(debug);}}});
   fs.writeFileSync(path.join(outDir,'report.json'),J(report,null,2));
  }
  report.passed=report.cases.every(c=>c.passed)&&report.cases.length===modes.length&&report.shots.length===D053_SHOTS.filter(s=>modes.includes(s.mode)).length;
  console.log(`${report.passed?'PASS':'FAIL'} D053 ${phase}: ${report.shots.length} screenshots; ${report.cases.filter(c=>c.passed).length}/${report.cases.length} scenarios.`);return report;
 }finally{fs.writeFileSync(path.join(outDir,'report.json'),J(report,null,2));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const arg=(n,d)=>process.argv.find(a=>a.startsWith('--'+n+'='))?.slice(n.length+3)??d,phase=arg('phase','before');const report=await captureD053({phase,outDir:path.resolve(ROOT,arg('out','scratch/d053-'+phase)),modes:arg('modes',D053_MODES.join(',')).split(',')});if(!report.passed)process.exitCode=1;}
