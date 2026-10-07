// D054 real original/candidate capture. Baseline QA branch never merges/deploys.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT,withBrowser,sleep } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { D052_SNAPSHOT } from './d052-capture.mjs';
import { tapD053 } from './d053-capture.mjs';
import { builtBase } from './d036-cities.mjs';
import { loadCode } from '../src/io/save.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { previewOp,commitOp,powerStatus } from '../src/sim/edit.ts';
import { D054_BASELINE,D054_MODES,D054_SHOTS,D054_SAVE_KEY,D054_OPS,d054Camera,d054ReviewCode,d054FixtureManifest } from './d054-scenes.mjs';
const J=JSON.stringify;
export const d054Hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
export const D054_SNAPSHOT=D052_SNAPSHOT;
export const D054_UI=`(()=>({ui:__gt.ui(),stroke:__gt.stroke(),pipes:__gt.pipesShown(),hints:__gt.resourceHints(),cost:{hidden:document.querySelector('#costTag').hidden,text:document.querySelector('#costTag').textContent},guide:document.querySelector('#siteGuide')?{text:document.querySelector('#siteGuide').textContent,label:document.querySelector('#siteGuide').getAttribute('aria-label')}:null,panel:document.querySelector('#sitePanel')?{open:!document.querySelector('#sitePanel').hidden,text:document.querySelector('#sitePanel').textContent}:null,toasts:[...document.querySelectorAll('.toast')].map(e=>e.textContent)}))()`;
export const D054_PROBE=`window.__d054Inputs=[];for(const type of ['pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture','click','keydown','keyup','blur','pagehide'])addEventListener(type,e=>{const b=e.target.closest?.('button');__d054Inputs.push({type,trusted:e.isTrusted,pointerType:e.pointerType??'',pointerId:e.pointerId??null,key:e.key??'',id:b?.id??e.target.id??'',tool:b?.dataset.c??b?.dataset.t??'',tag:e.target.tagName??''})},true);window.__d054Writes=[];{const f=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===${J(D054_SAVE_KEY)})__d054Writes.push({key:k,bytes:String(v).length});return f.call(this,k,v)}}`;
export const d054World=s=>({code:s.code,layers:s.layers,history:s.history,buildings:s.buildings,money:s.sim.money,day:s.sim.day,technology:s.technology,commission:s.commission,policy:s.policy,lastDay:s.lastDay,dayReport:s.dayReport});
export const d054Persisted=s=>({...d054World(s),saved:s.saved,storage:s.storage,journal:s.journal,journalRows:s.journalRows,journalCount:s.journalCount});
export const d054Model=code=>{const {KT,vrank}=builtBase(),r=loadCode(code,KT,vrank);assert.ok(r.ok);powerStatus(r.sim);return r;};
export async function d054Snapshot(p){await p.ev('__gt.journalFlush()');return p.ev(D054_SNAPSHOT);}
export async function d054Select(p,tool,mobile=true){
 const roads=['alley','road','coll','art','hwy'],direct=['zr','zc','zi','plant','doze'];
 const current=await p.ev('__gt.ui()');
 if(roads.includes(tool)){if(current.tool!=='road')await tapD053(p,'.tool[data-t="road"]',mobile);await tapD053(p,`#roadSub [data-r="${tool}"]`,mobile);}
 else if(direct.includes(tool)){if(current.tool!==tool)await tapD053(p,`.tool[data-t="${tool}"]`,mobile);}
 else {if(current.tool!=='civic')await tapD053(p,'.tool[data-t="civic"]',mobile);await tapD053(p,`#civicSub [data-c="${tool}"]`,mobile);}
}
export function d054CheckCamera(mode,camera){const want=d054Camera(mode);assert.equal(camera.zoom,want.zoom);assert.ok(Math.abs(camera.target[0]-want.x)<1e-8&&Math.abs(camera.target[1])<1e-8&&Math.abs(camera.target[2]-want.z)<1e-8);assert.ok(Math.abs(camera.pos[0]-camera.target[0]-115.2)<1e-8&&Math.abs(camera.pos[2]-camera.target[2]-115.2)<1e-8&&Math.abs(camera.pos[1]-94.06040612287404)<1e-8);}
export async function loadD054(p,mode,{code=d054ReviewCode(mode)}={}){
 await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem(${J(D054_SAVE_KEY)},${J(code)})`);await p.open('');
 const c=d054Camera(mode);await p.ev(`__gt.view(${c.x},${c.z},${c.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
 assert.equal(await p.ev('__gt.saveNow()'),true);await p.ev('__gt.journalFlush()');assert.equal(await p.ev('__gt.saveNow()'),true);
 assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,6000));await p.frames(2);d054CheckCamera(mode,await p.ev('__gt.cam()'));assert.equal(await p.ev('__gt.sim().playing'),false);await p.ev(D054_PROBE);
}
export async function d054Hold(p,page,op,mobile=true){
 const a=await p.cell(op.x0,op.z0),b=await p.cell(op.x1,op.z1);assert.equal(await p.hit(a),'CANVAS','start is map');assert.equal(await p.hit(b),'CANVAS','end is map');
 if(mobile)await p.drag(a,b,op.k==='tap'?2:8);
 else{await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:a[0],y:a[1],buttons:0});await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:a[0],y:a[1],button:'left',buttons:1,clickCount:1});for(let n=1;n<=8;n++){await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:a[0]+(b[0]-a[0])*n/8,y:a[1]+(b[1]-a[1])*n/8,button:'left',buttons:1});await sleep(20);}await p.frames(2);}
 const pv=(await p.ev('__gt.stroke()'))?.preview;assert.ok(pv,'native held preview');return {a,b,preview:pv};
}
export async function d054Release(p,page,at,mobile=true){if(mobile)await p.release();else{await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:at[0],y:at[1],button:'left',buttons:0,clickCount:1});await sleep(120);}await p.frames(2);}
export function d054CompareModel(actual,s,label='model'){
 assert.equal(actual.sim.money,s.money,label+' money');assert.equal(actual.sim.day,s.day,label+' day');
 for(const k of ['road','rclass','ter','el','zone','tree','rail','dock','tram','occ'])assert.deepEqual(actual.layers[k],Array.from(s.city[k]),label+' '+k);
 assert.deepEqual(actual.history,s.city.history,label+' history');const d=decodeLabCode(actual.code);assert.ok(d.ok);assert.equal(d.save.raw.wp,Array.from(s.city.wp).join(''),label+' saved pipes');const pairs=Array.from(s.res.rdep).flatMap((v,i)=>v?[[i,v]]:[]);assert.deepEqual(d.save.raw.rdep??null,pairs.length?pairs:null,label+' depletion');
}
export function d054Sources(){return Object.fromEntries(fs.readdirSync(path.join(ROOT,'src'),{recursive:true}).filter(f=>fs.statSync(path.join(ROOT,'src',f)).isFile()).sort().map(f=>['src/'+f,d054Hash(fs.readFileSync(path.join(ROOT,'src',f)))]));}
export async function captureD054Scene(p,page,mode,{phase,outDir,mobile=true}){
 const fixture=d054FixtureManifest(mode),op=D054_OPS[mode],item={mode,phase,fixture,viewport:{width:p.W,height:p.H},assertions:[],shots:[],passed:false},write=(n,v)=>fs.writeFileSync(path.join(outDir,n),typeof v==='string'||Buffer.isBuffer(v)?v:J(v,null,2)),check=(name,fn)=>{fn();item.assertions.push(name);};
 const initial=await d054Snapshot(p),model=d054Model(d054ReviewCode(mode));write(`D054-${phase}-fixture-${mode}.code.txt`,d054ReviewCode(mode));write(`D054-${phase}-fixture-${mode}.raw.json`,decodeLabCode(d054ReviewCode(mode)).save.raw);write(`D054-${phase}-state-initial-${mode}.json`,initial);
 check('original fixture money/day/rank paused',()=>{assert.equal(initial.sim.money,fixture.money);assert.equal(initial.sim.day,fixture.day);assert.equal(initial.technology.rank,21);assert.equal(initial.sim.playing,false);});
 const take=async stage=>{
  const shot=D054_SHOTS.find(s=>s.mode===mode&&s.stage===stage);if(!shot)return;assert.equal(p.W,shot.width);assert.equal(p.H,shot.height);
  await p.ev('__gt.setVisT(2.2);__gt.setDayFrac(0)');await p.frames(2);const camera=await p.ev('__gt.cam()');d054CheckCamera(mode,camera);const con=await p.ev('__gt.con()');assert.equal(con.visT,2.2);assert.equal(con.dayFrac,0);
  const filename=`D054-${phase}-${mode}-${stage}-${p.W}.png`,bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');assert.ok(bytes.length>10000);assert.equal(bytes.readUInt32BE(16),p.W);assert.equal(bytes.readUInt32BE(20),p.H);write(filename,bytes);
  const state=await d054Snapshot(p),stateFile=`D054-${phase}-state-${mode}-${stage}.json`;write(stateFile,state);item.shots.push({filename,sha256:d054Hash(bytes),bytes:bytes.length,mode,stage,viewport:item.viewport,camera,cameraSha256:d054Hash(camera),visual:{visT:2.2,dayFrac:0},fixture,stateFile,stateSha256:d054Hash(state),worldSha256:d054Hash(d054World(state)),ui:await p.ev(D054_UI)});
 };
 if(mode.startsWith('depleted-')){
  const doze={...op,tool:'doze',k:'rect'};await d054Select(p,'doze',mobile);const held=await d054Hold(p,page,doze,mobile);assert.equal(held.preview.count,1);item.demolition=commitOp(model.sim,doze,0);await d054Release(p,page,held.b,mobile);const after=await d054Snapshot(p);d054CompareModel(after,model.sim,'genuine exhausted well demolition');assert.equal(model.sim.res.rdep[op.z0*72+op.x0],240);assert.equal(model.sim.w.tiles[op.z0*72+op.x0].bld,null);assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,6000));
 }
 await d054Select(p,op.tool,mobile);const before=await d054Snapshot(p),pv=previewOp(model.sim,op);item.originalPreview=pv;
 const selectedUI=await p.ev(D054_UI);if(mode==='sewage')check('phase-specific sewage pipe visibility',()=>assert.equal(selectedUI.pipes,phase==='after'));
 const held=await d054Hold(p,page,op,mobile);check('native preview matches original authoritative preview',()=>assert.deepEqual(held.preview,{count:pv.count,total:pv.total,cells:pv.cells.length}));
 const during=await d054Snapshot(p);check('held original preview is read-only',()=>assert.deepEqual(d054Persisted(during),d054Persisted(before)));
 if(mode==='mixed-pipe')check('mixed pipe has4legal plus existing-pipe and water',()=>{assert.equal(pv.count,4);assert.equal(pv.cells.length,6);assert.equal(pv.total,42);assert.equal(pv.reason,undefined);});
 if(mode==='low-road')check('road total120 funds30 and bridge75 before later land15',()=>{assert.equal(pv.total,120);assert.equal(pv.affordable,false);assert.deepEqual(pv.cells.map(c=>c.cost),[15,75,15,15]);});
 if(mode==='low-rect')check('rectangle total240 funds180',()=>{assert.equal(pv.total,240);assert.equal(pv.affordable,false);});
 if(mode.startsWith('depleted-'))check('depleted matching resource remains legal',()=>{assert.equal(pv.count,1);assert.equal(model.sim.res.rdep[op.z0*72+op.x0],240);});
 if(mode==='sewage')check('shore legal',()=>assert.equal(pv.count,1));
 await take('preview');item.commit=commitOp(model.sim,op,0);await d054Release(p,page,held.b,mobile);const after=await d054Snapshot(p);d054CompareModel(after,model.sim,'original commit');
 if(mode==='low-road')check('real commit skips bridge and later reaches affordable land',()=>{assert.equal(item.commit.placed,2);assert.equal(item.commit.spent,30);assert.deepEqual(item.commit.events.map(e=>[e.x,e.z]),[[28,26],[30,26]]);});
 if(mode==='low-rect')check('rectangle refuses all and spends zero',()=>{assert.equal(item.commit.placed,0);assert.equal(item.commit.spent,0);assert.deepEqual(d054Persisted(after),d054Persisted(before));});
 await take('result');item.finalWorldSha256=d054Hash(d054World(after));write(`D054-${phase}-state-final-${mode}.json`,after);item.ui=await p.ev(D054_UI);item.inputs=await p.ev('__d054Inputs');
 check('all actual activation input is trusted',()=>{assert.ok(item.inputs.some(e=>e.type==='click'));assert.ok(item.inputs.every(e=>e.trusted));});check('no console errors or external requests',()=>{assert.deepEqual(page.errors,[]);assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[]);});
 item.layout=await p.ev('({width:innerWidth,scroll:document.documentElement.scrollWidth})');check('no page horizontal overflow',()=>assert.ok(item.layout.scroll<=item.layout.width));item.passed=true;return item;
}
export async function captureD054({phase='before',outDir=path.join(ROOT,'scratch/d054-'+phase),modes=D054_MODES}={}){
 assert.ok(['before','after'].includes(phase));fs.mkdirSync(outDir,{recursive:true});const report={purpose:'D054 fixed original/candidate real Chrome evidence; QA before branch never merges/deploys',phase,baseline:D054_BASELINE,qualifications:['Synthetic saved fixture setup only; no runtime money/resource/world overrides.','Genuine native CDP touch/mouse input; no DOM click dispatch.','Public snapshots include powerStatus via sim(); not claimed globally pure or a hidden RNG dump.','Chrome emulation, not Android hardware.'],cases:[],shots:[],passed:false};
 try{const html=fs.readFileSync(path.join(ROOT,'dist/index.html'));report.htmlSha256=d054Hash(html);report.sources=d054Sources();report.sourceTreeSha256=d054Hash(report.sources);if(phase==='before'){assert.equal(report.htmlSha256,D054_BASELINE.htmlSha256,'unchanged original built HTML');assert.equal(Object.keys(report.sources).length,D054_BASELINE.sourceFiles);assert.equal(report.sourceTreeSha256,D054_BASELINE.sourceTreeSha256,'all original source files unchanged');}fs.writeFileSync(path.join(outDir,`D054-${phase}-index.html`),html);fs.writeFileSync(path.join(outDir,'D054-fixture-manifest.json'),J(modes.map(d054FixtureManifest),null,2));
  for(const mode of modes){const shot=D054_SHOTS.find(s=>s.mode===mode);await withBrowser({width:960,height:900},async({page,open})=>{const p=await pageSession(page,open,{W:shot.width,H:shot.height});try{await loadD054(p,mode);const c=await captureD054Scene(p,page,mode,{phase,outDir});report.cases.push(c);report.shots.push(...c.shots);console.log(`PASS D054 ${phase} ${mode}: ${c.assertions.length} checks; ${c.shots.length} original PNGs`);}catch(e){const failure={mode,passed:false,error:String(e.stack??e)};report.cases.push(failure);console.error(failure.error);try{fs.writeFileSync(path.join(outDir,`D054-${phase}-failure-${mode}.png`),Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));fs.writeFileSync(path.join(outDir,`D054-${phase}-failure-${mode}.json`),J({ui:await p.ev(D054_UI),state:await d054Snapshot(p),inputs:await p.ev('window.__d054Inputs??[]'),errors:page.errors},null,2));}catch(debug){failure.debugError=String(debug);}}});fs.writeFileSync(path.join(outDir,'D054-fixed-capture.json'),J(report,null,2));}
  report.passed=report.cases.length===modes.length&&report.cases.every(c=>c.passed)&&report.shots.length===D054_SHOTS.filter(s=>modes.includes(s.mode)).length;return report;
 }finally{fs.writeFileSync(path.join(outDir,'D054-fixed-capture.json'),J(report,null,2));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const phase=process.argv.find(x=>x.startsWith('--phase='))?.slice(8)??'before',outDir=process.argv.find(x=>x.startsWith('--out='))?.slice(6)??path.join(ROOT,'scratch/d054-'+phase);const r=await captureD054({phase,outDir});console.log(`${r.passed?'PASS':'FAIL'} D054 ${phase}: ${r.shots.length} screenshots, ${r.cases.filter(c=>c.passed).length}/${r.cases.length} scenes`);process.exitCode=r.passed?0:1;}
