// D052: unchanged simulation rules, real Chrome touch/keyboard, deterministic fixtures.
// UI positioning and the existing simStep hook are explicit test setup, not gestures.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { d048KeyEvents } from './smoke-d048.mjs';
import { D048_IDB_BLOCK } from './d048-scenes.mjs';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { builtBase } from './d036-cities.mjs';
import { mk } from './d034-cities.mjs';
import { loadCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { d052ReviewCode, D052_SHOTS, D052_SAVE_KEY } from './d052-scenes.mjs';
import { loadD052, captureD052Scene, tapD052 } from './d052-capture.mjs';
const J = JSON.stringify, OUT = path.join(ROOT,'scratch/shots');
const sha = v => createHash('sha256').update(typeof v === 'string'||Buffer.isBuffer(v)?v:J(v)).digest('hex');
const same = (a,b,n) => assert.ok(isDeepStrictEqual(a,b),`${n}: ${sha(a)} != ${sha(b)}`);
const TECH = '#tc li[data-kind="tech"]';
const WORLD = `({tech:__gt.techState(),policy:__gt.policyState(),layers:__gt.layers(),buildings:__gt.buildingList(),history:__gt.history(),commission:__gt.simCms(),code:__gt.save(),lastDay:__gt.lastDay(),report:__gt.dayRep()})`;
const INPUT = `window.__d052Extra=[];for(const type of ['pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture','keydown','click'])addEventListener(type,e=>{const b=e.target.closest?.('button');__d052Extra.push({type,trusted:e.isTrusted,key:e.key,pointerType:e.pointerType,id:b?.id??'',k:b?.closest('[data-k]')?.dataset.k??'',route:b?.dataset.route??''});},true);`;
const STORAGE = `(()=>{const original=Storage.prototype.setItem;window.__d052Storage={original,fault:false,attempts:0};Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===${J(D052_SAVE_KEY)}){__d052Storage.attempts++;if(__d052Storage.fault)throw new DOMException('D052 controlled quota fault','QuotaExceededError');}return original.call(this,k,v);};})()`;
async function keys(page,k){for(const e of d048KeyEvents(k))await page.send('Input.dispatchKeyEvent',e);await sleep(60);}
async function openPanel(p,id,mobile=true){await tapD052(p,'#menuBtn',mobile);await tapD052(p,`#menu [data-m="${id}"]`,mobile);}
async function research(p,route,id,mobile=true){await tapD052(p,`#tc [data-route="${route}"]`,mobile);await tapD052(p,`${TECH}[data-k="${id}"] button`,mobile);}
async function cash(p){const v=await p.ev(`({money:__gt.techState().money,hud:Number(document.querySelector('#stats').dataset.money),sub:__gt.techPanel().sub,day:__gt.techState().day})`);assert.equal(v.hud,v.money);return v;}
async function layout(p,id){const v=await p.ev(`(()=>{const box=document.querySelector(${J(id)}),r=box.querySelector('.card').getBoundingClientRect();return {w:innerWidth,h:innerHeight,doc:document.documentElement.scrollWidth,card:[r.left,r.top,r.right,r.bottom],small:[...box.querySelectorAll('button')].filter(b=>{const q=b.getBoundingClientRect();return q.width<44||q.height<44}).map(b=>b.textContent),overflow:[...box.querySelectorAll('.note,h3,.sub,.tip')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)};})()`);assert.ok(v.doc<=v.w,J(v));assert.ok(v.card[0]>=0&&v.card[1]>=0&&v.card[2]<=v.w+.1&&v.card[3]<=v.h+.1,J(v));assert.equal(v.small.length,0,J(v));assert.equal(v.overflow.length,0,J(v));}
async function dismissals(p,page,kind,id,mobile=true){const before=await p.ev(WORLD);for(const how of ['close','escape','backdrop']){await openPanel(p,kind,mobile);await layout(p,id);if(how==='close')await tapD052(p,`${id}X`,mobile);else if(how==='escape')await keys(page,'Escape');else if(mobile)await p.tapAt([3,3]);else await p.click([3,3]);assert.equal(await p.ev(`document.querySelector(${J(id)}).hidden`),true);same(await p.ev(WORLD),before,kind+' '+how+' preserves state');}}
async function retainInput(p,phase){const events=await p.ev('window.__d052Extra??[]');(p.d052Traces??=[]).push({phase,events});}
async function loadFixtureInput(p,mode){await retainInput(p,'before fixture '+mode);await loadD052(p,mode);await p.ev(INPUT);}
async function selectCode(p,code){await retainInput(p,'before custom fixture');await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem(${J(D052_SAVE_KEY)},${J(code)})`);await p.open('');await p.ev(INPUT);}
export async function d052Smoke(browser,log){
  fs.mkdirSync(OUT,{recursive:true});
  const report={title:'D052 decision and daily-research feedback',device:'real Chrome CDP 360/412 touch emulation and desktop; no Android hardware',syntheticFixtures:true,shots:[],captureCases:[],checks:[],sessions:[]};
  const write=()=>fs.writeFileSync(path.join(OUT,'D052-evidence.json'),J(report,null,2));
  const check=(ok,name,detail='')=>{report.checks.push({ok,name,detail});log(ok,'D052 '+name,detail);};
  const run=async(name,mode,opt,fn)=>{try{await browser({width:Math.max(960,opt.W),height:900},async({open,page})=>{
    const version=await page.send('Browser.getVersion'),p=await pageSession(page,open,opt);if(opt.fallback)await page.send('Page.addScriptToEvaluateOnNewDocument',{source:D048_IDB_BLOCK});await loadD052(p,mode);await p.ev(INPUT);
    try{await fn(p,page);check(true,name);}catch(e){check(false,name,e.stack);}
    await page.send('Runtime.evaluate',{expression:'0',returnByValue:true});
    await retainInput(p,'final');const traces=p.d052Traces,trace=traces.flatMap(t=>t.events),external=page.requests.filter(u=>! /^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    check(!page.errors.length&&!external.length,name+' zero errors/external requests',J([...page.errors,...external]));
    const actual=opt.mobile===false?trace.some(e=>e.type==='keydown'):trace.some(e=>e.type==='pointerdown'&&e.pointerType==='touch');
    check(actual&&trace.every(e=>e.trusted),name+' trusted input',J({count:trace.length}));report.sessions.push({name,mode,version,traces,trace,errors:[...page.errors],external});
  });}catch(e){check(false,name+' browser',e.stack);}write();};
  for(const shot of D052_SHOTS)await run('comparison '+shot.scene,shot.mode,{W:shot.width,H:shot.height},async(p,page)=>{const result=await captureD052Scene(p,page,shot.mode,{phase:'after',outDir:OUT});report.captureCases.push(result);report.shots.push(result.shot);});
  for(const fault of ['normal','quota','fallback'])await run('paid/repeat/save '+fault,'paid',{W:412,H:860,fallback:fault==='fallback'},async(p,page)=>{
    await p.ev(STORAGE);if(fault==='quota')await p.ev('__d052Storage.fault=true');
    const day=(await p.ev('__gt.techState()')).day,history=await p.ev('__gt.history()');
    await openPanel(p,'tech');await research(p,'C','C6');assert.ok(await p.ev("__d052Extra.some(e=>e.type==='click'&&e.k==='C6'&&e.trusted&&e.pointerType==='touch')"),'paid action itself is trusted touch');const now=await cash(p);assert.equal(now.money,4800);assert.equal(now.day,day);
    assert.match(now.sub,/資金 \$4,800/);assert.match(await p.ev("document.querySelector('#commissionHud').textContent"),/研究中/);
    same((await p.ev('__gt.history()')).slice(history.length),[{day,t:'research',id:'C6',fee:5200}],'one research event');
    const before=await p.ev(WORLD);await tapD052(p,`${TECH}[data-k="C6"] button`);same(await p.ev(WORLD),before,'disabled trusted repeat');
    await keys(page,'Escape');await openPanel(p,'tech');assert.equal((await cash(p)).money,4800);await keys(page,'Escape');
    if(fault==='quota'){assert.ok(await p.ev('__gt.ui().saveError'));await p.ev('__d052Storage.fault=false;__gt.saveNow()');assert.equal(await p.ev('__gt.ui().saveError'),'');}
    await p.ev('__gt.journalFlush()');const saved=decodeLabCode(await p.ev('__gt.saved()'));assert.ok(saved.ok);assert.equal(saved.save.money,4800);
    if(fault==='fallback')assert.equal(saved.save.raw.d3.hv,2);
    const tech=await p.ev('__gt.techState()'),cms=await p.ev('__gt.simCms()');await retainInput(p,'paid before reload');await p.open('');await p.ev(INPUT);same(await p.ev('__gt.techState()'),tech,'real reload research');same(await p.ev('__gt.simCms()'),cms,'real reload commission');await openPanel(p,'tech');await cash(p);await keys(page,'Escape');
    check(true,'paused money/save/repeat '+fault);
  });
  await run('failed and free fees','resume',{W:360,H:740},async(p,page)=>{
    await openPanel(p,'tech');let row=await p.ev(`__gt.techRows().find(r=>r.kind==='tech'&&r.k==='A1')`);assert.match(row.note,/續研免費/);assert.doesNotMatch(row.note,/\$400/);
    await research(p,'A','A1');assert.equal((await cash(p)).money,10000);await research(p,'B','B1');assert.equal((await cash(p)).money,10000);await keys(page,'Escape');
    await loadFixtureInput(p,'sandbox');await openPanel(p,'tech');row=await p.ev(`__gt.techRows().find(r=>r.kind==='tech'&&r.k==='A1')`);assert.match(row.note,/沙盒免費/);await research(p,'A','A1');assert.equal((await p.ev('__gt.techState()')).money,10000);await keys(page,'Escape');
    const raw=structuredClone(decodeLabCode(d052ReviewCode('paid')).save.raw);raw.money=300;await selectCode(p,encodeLabCode(raw));await openPanel(p,'tech');const before=await p.ev(WORLD);await research(p,'C','C6');same(await p.ev(WORLD),before,'unaffordable action');await cash(p);assert.match((await p.ev('__gt.techPanel()')).tip,/錢不夠/);await keys(page,'Escape');await dismissals(p,page,'tech','#tc');
    check(true,'free resume/sandbox/insufficient funds and cancellation');
  });
  for(const edge of ['high','low'])await run('four budget limits '+edge,'budget-'+edge,{W:edge==='high'?360:412,H:edge==='high'?740:860},async(p,page)=>{
    await openPanel(p,'policy');const initial=await p.ev('__gt.policyState()'),history=await p.ev('__gt.history()');
    for(const cat of ['police','fire','health','edu']){const sel=`#pl li[data-k="${cat}"] button:${edge==='high'?'last':'first'}-child`;await tapD052(p,sel);await tapD052(p,sel);const toast=(await p.toasts()).at(-1);assert.match(toast,new RegExp(edge==='high'?'預算已是上限':'預算已是下限'));assert.doesNotMatch(toast,/覆蓋更廣|省錢|覆蓋縮水/);assert.equal((await p.ev('__gt.policyState()')).budget[cat],edge==='high'?1.5:.5);}
    same(await p.ev('__gt.history()'),history,'limits no budget event');assert.equal((await p.ev('__gt.policyState()')).money,initial.money);await layout(p,'#pl');await keys(page,'Escape');await dismissals(p,page,'policy','#pl');
    check(true,'all four '+edge+' limit copy, repeat and no extra spend/history');
  });
  await run('native focus and held touch across daily update','progress',{W:412,H:860},async(p,page)=>{
    await openPanel(p,'tech');assert.match(await p.ev("document.querySelector('#tc .body').textContent"),/速度待結算/);assert.doesNotMatch(await p.ev("document.querySelector('#tc li[data-kind=act]').textContent"),/還要 \d+ 天/);
    await p.ev('__gt.simStep(1)');assert.match(await p.ev("document.querySelector('#tc .body').textContent"),/最近結算 \+1／天/);
    const target='#tc .tabs [data-route="B"]';await p.ev(`document.querySelector(${J(target)}).scrollIntoView({block:'center'});window.__held=document.querySelector(${J(target)});__held.focus();window.__scroll=document.querySelector('#tc .body').scrollTop`);await p.frames(2);
    const at=await p.center(target),start=await p.ev('__d052Extra.length');await p.touch('touchStart',[at]);await sleep(50);await p.ev('__gt.simStep(1)');
    assert.equal(await p.ev(`__held===document.querySelector(${J(target)})&&__held.isConnected`),true,'same connected button while held');assert.equal(await p.ev('document.activeElement===__held'),true,'native focus remains');assert.equal(await p.ev("document.querySelector('#tc .body').scrollTop===__scroll"),true,'scroll preserved');
    await p.touch('touchEnd',[]);await sleep(220);assert.equal((await p.ev('__gt.techPanel()')).route,'B','original native release activates route');
    const trace=await p.ev(`__d052Extra.slice(${start})`);assert.ok(trace.some(e=>e.type==='pointerdown'&&e.trusted&&e.route==='B'));assert.equal(trace.filter(e=>e.type==='click'&&e.route==='B'&&e.trusted).length,1);assert.ok(trace.some(e=>e.type==='gotpointercapture'&&e.route==='B'&&e.trusted));assert.ok(trace.some(e=>e.type==='lostpointercapture'&&e.route==='B'&&e.trusted));
    assert.equal((await p.ev('__gt.techState()')).prog.A1,7);assert.match((await p.ev('__gt.techPanel()')).sub,/第 152 天/);await layout(p,'#tc');await keys(page,'Escape');
    const text=await p.ev("document.querySelector('#tc .body').textContent");await p.ev('__gt.simStep(1)');assert.equal(await p.ev("document.querySelector('#tc .body').textContent"),text,'closed panel not repainted');await openPanel(p,'tech');assert.match((await p.ev('__gt.techPanel()')).sub,/第 153 天/);await keys(page,'Escape');
    check(true,'original trusted held-touch release, stable node/focus/scroll and closed panel');
  });
  await run('commission reorder held touch','progress',{W:412,H:860},async(p,page)=>{
    const code=mk(1,50,'委託換位驗收',b=>{b.road(4,30,60,30,3).put(3,30,5);for(let x=10;x<=41;x++)b.put(x,29,1,1,{den:3});},{rk:2,money:10000});
    await selectCode(p,code);await p.ev('__gt.saveNow()');await p.ev('__gt.journalFlush()');await openPanel(p,'commission');
    same(await p.ev("__gt.cmRows().filter(r=>r.kind==='offer').map(r=>r.k)"),['trade1200','happy70'],'original initial offer order');
    const selector='#cm li[data-kind="offer"][data-k="happy70"] button';
    await p.ev(`document.querySelector(${J(selector)}).scrollIntoView({block:'center'});window.__offer=document.querySelector(${J(selector)});__offer.focus();window.__offerScroll=document.querySelector('#cm .body').scrollTop`);await p.frames(2);
    assert.equal(await p.ev('typeof Element.prototype.moveBefore'),'function','Chrome state-preserving DOM move is available');
    const at=await p.center(selector),start=await p.ev('__d052Extra.length');await p.touch('touchStart',[at]);await sleep(50);await p.ev('__gt.simStep(1)');
    same(await p.ev("__gt.cmRows().filter(r=>r.kind==='offer').map(r=>r.k)"),['happy70','steel40','trade1200'],'one original day actually promotes and reorders');
    assert.equal((await p.ev('__gt.techState()')).rank,3);assert.equal((await p.ev('__gt.techState()')).day,51);
    assert.equal(await p.ev(`__offer===document.querySelector(${J(selector)})&&__offer.isConnected&&document.activeElement===__offer`),true,'moved offer keeps identity and focus');
    assert.equal(await p.ev("document.querySelector('#cm .body').scrollTop===__offerScroll"),true,'moved offer keeps scroll');
    await p.touch('touchEnd',[]);await sleep(200);assert.equal((await p.ev('__gt.simCms()')).act,'happy70','native release accepts same offer using updated index0');
    const trace=await p.ev(`__d052Extra.slice(${start})`);for(const type of ['pointerdown','gotpointercapture','pointerup','lostpointercapture','click'])assert.ok(trace.some(e=>e.type===type&&e.trusted&&e.k==='happy70'),J(trace));
    assert.equal(trace.filter(e=>e.type==='click'&&e.k==='happy70').length,1);assert.equal(await p.ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='accept'&&e.id==='happy70').length"),1);await keys(page,'Escape');
    check(true,'genuine promotion retains moved offer focus/capture and accepts exactly its fresh index');
  });
  await run('normal playback refresh','progress',{W:360,H:740},async(p,page)=>{
    await tapD052(p,'#play');await openPanel(p,'tech');const initial=(await p.ev('__gt.techState()')).day;
    assert.ok(await p.waitFor(async()=>await p.ev(`__gt.techState().day>${initial}`),10000),'normal animation frame advances a day');
    const view=await p.ev(`({state:__gt.techState(),panel:__gt.techPanel(),row:__gt.techRows().find(r=>r.kind==='act'),head:document.querySelector('#tc .body h3').textContent})`);
    assert.ok(view.panel.sub.includes(`第 ${view.state.day} 天`));assert.ok(view.row.note.includes('按最近速度估計'));assert.ok(view.head.includes(`最近結算 +${view.state.speed}／天`));
    await keys(page,'Escape');await tapD052(p,'#play');assert.equal(await p.ev('__gt.sim().playing'),false);await openPanel(p,'tech');await layout(p,'#tc');await keys(page,'Escape');
    check(true,'actual play button and animation-frame daily refresh');
  });
  await run('desktop keyboard budget and research','budget-high',{W:1280,H:800,mobile:false},async(p,page)=>{
    await openPanel(p,'policy',false);const target='#pl li[data-k="edu"] button:first-child';await p.ev(`window.__focused=document.querySelector(${J(target)});__focused.scrollIntoView({block:'center'});__focused.focus()`);
    await keys(page,'Enter');assert.equal((await p.ev('__gt.policyState()')).budget.edu,1.4);assert.equal(await p.ev('document.activeElement===__focused&&__focused.isConnected'),true);
    await keys(page,' ');assert.equal((await p.ev('__gt.policyState()')).budget.edu,1.3);await keys(page,'Escape');
    await loadFixtureInput(p,'resume');await openPanel(p,'tech',false);const button=`${TECH}[data-k="A1"] button`;await p.ev(`document.querySelector(${J(button)}).scrollIntoView({block:'center'});document.querySelector(${J(button)}).focus()`);await keys(page,'Enter');assert.equal(await p.ev("__d052Extra.filter(e=>e.type==='click'&&e.k==='A1'&&e.trusted).length"),1,'research activation itself is native keyboard click');assert.equal((await p.ev('__gt.techState()')).act,'A1');assert.equal((await cash(p)).money,10000);await keys(page,'Escape');await dismissals(p,page,'tech','#tc',false);
    check(true,'native Enter/Space, updated handler, focus and Escape');
  });
  const trajectories=[];
  for(const shown of [false,true])await run('daily trajectory '+(shown?'open panel':'closed control'),'completion',{W:412,H:860},async(p,page)=>{
    if(shown)await openPanel(p,'tech');else await p.tapBtn('#cityName');
    const {KT,vrank}=builtBase(),expected=loadCode(d052ReviewCode('completion'),KT,vrank);assert.ok(expected.ok);const states=[await p.ev(WORLD)];for(let d=0;d<12;d++){stepDay(expected.sim);await p.ev('__gt.simStep(1)');states.push(await p.ev(WORLD));const actual=await p.ev('__gt.techState()');assert.equal(actual.money,expected.sim.money);same(actual.done,expected.sim.edu.tech,'original simulator tech');if(shown){const s=await p.ev('__gt.techState()');assert.ok((await p.ev('__gt.techPanel()')).sub.includes(`第 ${s.day} 天`));assert.equal((await p.ev('__gt.techRows()')).find(r=>r.kind==='act').st,'idle');}}
    trajectories.push(states);const done=await p.ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='done'&&e.id==='techC6')");assert.equal(done.length,1);assert.equal(done[0].bonus,1800);if(shown)await keys(page,'Escape');
  });
  try{assert.equal(trajectories.length,2);for(let i=0;i<13;i++)same(trajectories[0][i],trajectories[1][i],'uninterrupted UI/control day '+i);report.trajectory={days:12,snapshots:13,sha256:sha(trajectories[0])};check(true,'12 uninterrupted days: same complete exposed states/history/code; one commission award');}catch(e){check(false,'12-day trajectory',e.stack);}write();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){let bad=0;await d052Smoke(withBrowser,(ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)bad++;});process.exitCode=bad?1:0;}
