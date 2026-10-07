// D052 shared frozen screenshot actions: synthetic localStorage fixtures,
// genuine CDP touch activation, unmodified simulator, fixed camera/visual time.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { builtBase } from './d036-cities.mjs';
import { loadCode } from '../src/io/save.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { stepDay } from '../src/sim/day.ts';
import { D052_CAMERA, D052_BASELINE_CAMERA, D052_SAVE_KEY, D052_SHOTS, d052ReviewCode, d052FixtureManifest } from './d052-scenes.mjs';

const J=JSON.stringify;
export const d052Hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
export const D052_SNAPSHOT=`(async()=>({sim:__gt.sim(),layers:__gt.layers(),buildings:__gt.buildingList(),history:__gt.history(),technology:__gt.techState(),commission:__gt.simCms(),policy:__gt.policyState(),code:__gt.save(),saved:__gt.saved(),lastDay:__gt.lastDay(),dayReport:__gt.dayRep(),journal:__gt.journal(),journalRows:await __gt.journalRows(),journalCount:await __gt.journalCount(),storage:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))}))()`;
export const D052_UI=`(()=>({money:document.querySelector('.stat[data-k="money"]').textContent,power:document.querySelector('.stat[data-k="power"]').textContent,coach:{hidden:document.querySelector('#coach').hidden,text:document.querySelector('#coach').textContent},tech:__gt.techPanel(),techText:document.querySelector('#tc .body').textContent,techRows:__gt.techRows(),policy:__gt.policyPanel(),policyRows:__gt.policyRows(),commission:__gt.cmPanel(),commissionRows:__gt.cmRows(),commissionHud:{hidden:document.querySelector('#commissionHud').hidden,text:document.querySelector('#commissionHud').textContent},toasts:[...document.querySelectorAll('.toast')].map(e=>e.textContent)}))()`;
export const D052_PROBE=`window.__d052Touches=[];window.__d052Writes=[];for(const type of ['pointerdown','click'])addEventListener(type,e=>{const b=e.target.closest('button');__d052Touches.push({type,trusted:e.isTrusted,pointerType:e.pointerType,target:b?.id??e.target.id,k:b?.closest('[data-k]')?.dataset.k??'',route:b?.dataset.route??'',label:b?.textContent??''})},true);for(const name of ['setItem','removeItem','clear']){const original=Storage.prototype[name];Storage.prototype[name]=function(...args){if(this===localStorage)__d052Writes.push({name,key:args[0]??null});return original.apply(this,args)}}`;
export const D052_CAPTURE_QUALIFICATIONS=[
  'Synthetic saved fixtures; no runtime world mutation. Chrome portrait touch emulation, no Android hardware.',
  'DOM scrollIntoView only positions controls; activation uses trusted CDP touch.',
  'Only completion/progress use original __gt.simStep(1) -> simDay, explicitly recorded.',
  'Snapshots contain existing public debug observations, raw saved code, history, layers and journal, not hidden simulator/RNG internals.',
  '__gt.sim() invokes original powerStatus and can recompute road rp; this probe is not claimed globally pure.',
];

export async function tapD052(p,selector,mobile=true) {
  await p.ev(`document.querySelector(${J(selector)}).scrollIntoView({block:'center'})`);await p.frames(2);
  const c=await p.center(selector);assert.ok(c&&c[0]>=0&&c[0]<=p.W&&c[1]>=0&&c[1]<=p.H,selector);
  assert.equal(await p.ev(`document.querySelector(${J(selector)}).contains(document.elementFromPoint(${c[0]},${c[1]}))`),true,selector+' hit target');
  assert.ok(await(mobile?p.tapBtn:p.clickBtn)(selector));
}
export async function loadD052(p,mode) {
  await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem(${J(D052_SAVE_KEY)},${J(d052ReviewCode(mode))})`);await p.open('');
  await p.ev(`__gt.view(${D052_CAMERA.x},${D052_CAMERA.z},${D052_CAMERA.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
  assert.equal(await p.ev('__gt.saveNow()'),true);await p.ev('__gt.journalFlush()');assert.equal(await p.ev('__gt.saveNow()'),true);
  assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,6000),'initial toasts settle');await p.frames(2);
  assert.deepEqual(await p.ev('__gt.cam()'),D052_BASELINE_CAMERA);assert.equal(await p.ev('__gt.sim().playing'),false);await p.ev(D052_PROBE);
}
const menu=async(p,key)=>{await tapD052(p,'#menuBtn');await tapD052(p,`#menu [data-m="${key}"]`);};
const topTech=async p=>{await p.ev("document.querySelector('#tc .body').scrollTop=0");await p.frames(2);};

// Requires a freshly loadD052-loaded page at the viewport in D052_SHOTS.
// Supplemental modes budget-low/sandbox/progress return evidence without a PNG.
export async function captureD052Scene(p,page,mode,{phase,outDir}) {
  assert.ok(['before','after'].includes(phase));fs.mkdirSync(outDir,{recursive:true});
  const write=(name,value)=>fs.writeFileSync(path.join(outDir,name),typeof value==='string'||Buffer.isBuffer(value)?value:J(value,null,2));
  const shot=D052_SHOTS.find(s=>s.mode===mode),fixture=d052FixtureManifest(mode),code=d052ReviewCode(mode),decoded=decodeLabCode(code);
  const item={mode,phase,fixture,viewport:{width:p.W,height:p.H},assertions:[],passed:false};
  const check=(name,fn)=>{fn();item.assertions.push(name);};
  const before=await p.ev(D052_SNAPSHOT),beforeUI=await p.ev(D052_UI);
  write(`D052-${phase}-fixture-${mode}.code.txt`,code);write(`D052-${phase}-fixture-${mode}.raw.json`,decoded.save.raw);write(`D052-${phase}-state-initial-${mode}.json`,before);
  check('paused exact fixture day, technology and commission',()=>{assert.equal(before.sim.playing,false);assert.equal(before.sim.day,fixture.day);assert.deepEqual({act:before.technology.act,prog:before.technology.prog,done:before.technology.done},fixture.technology);assert.deepEqual(before.commission,fixture.commission);});
  const take=async()=>{
    if(!shot)return;
    assert.deepEqual({width:p.W,height:p.H},{width:shot.width,height:shot.height},'frozen scene viewport');
    await p.frames(2);const camera=await p.ev('__gt.cam()');assert.deepEqual(camera,D052_BASELINE_CAMERA);const con=await p.ev('__gt.con()');assert.equal(con.visT,2.2);assert.equal(con.dayFrac,0);
    const filename=`D052-${phase}-${shot.scene}-${p.W}.png`,bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
    assert.ok(bytes.length>10000);assert.equal(bytes.readUInt32BE(16),p.W);assert.equal(bytes.readUInt32BE(20),p.H);write(filename,bytes);
    const state=await p.ev(D052_SNAPSHOT);item.shot={filename,sha256:d052Hash(bytes),bytes:bytes.length,viewport:item.viewport,camera,cameraSha256:d052Hash(camera),visual:{visT:con.visT,dayFrac:con.dayFrac},fixture,ui:await p.ev(D052_UI),stateSha256:d052Hash(state),stateFile:`D052-${phase}-state-shot-${mode}.json`};write(item.shot.stateFile,state);
  };
  if(mode==='paid') {
    await menu(p,'tech');await tapD052(p,'#tc .tabs [data-route="C"]');await tapD052(p,'#tc li[data-kind="tech"][data-k="C6"] button');
    const after=await p.ev(D052_SNAPSHOT),ui=await p.ev(D052_UI);
    check('actual paid C6 click deducts5200 and records one research event',()=>{assert.equal(after.sim.money,4800);assert.equal(after.sim.day,150);assert.equal(after.technology.act,'C6');assert.deepEqual(after.history.slice(before.history.length),[{day:150,t:'research',id:'C6',fee:5200}]);});
    check('cash HUD and actual tech sub observed',()=>{assert.match(ui.money,phase==='before'?/10,000/:/4,800/);assert.match(ui.tech.sub,/4,800/);});
    await tapD052(p,'#tcX');await take();const closed=await p.ev(D052_UI);check('closed-panel cash HUD',()=>assert.match(closed.money,phase==='before'?/10,000/:/4,800/));
  } else if(mode==='power') {
    check('honest load capacity, flags and coach precondition',()=>{assert.equal(before.sim.day,50);assert.deepEqual(before.sim.power,{cap:75,powered:78,unpowered:0});assert.match(beforeUI.power,/78\/75/);assert.equal(beforeUI.coach.hidden,false);assert.match(beforeUI.coach.text,/電不夠/);assert.equal(before.layers.zone.filter(v=>v>0).length,78);});
    await menu(p,'policy');await tapD052(p,'#pl li[data-k="ecoReg"] button');const after=await p.ev(D052_SNAPSHOT),ui=await p.ev(D052_UI);
    check('real ecoReg cap80 without day advance or power reassignment',()=>{assert.equal(after.policy.pol.ecoReg,true);assert.equal(after.sim.day,50);assert.equal(after.sim.money,10000);assert.deepEqual(after.sim.power,{cap:80,powered:78,unpowered:0});});
    check('capacity HUD and coach after accepted policy',()=>{assert.match(ui.power,phase==='before'?/78\/75/:/78\/80/);assert.equal(ui.coach.hidden,phase==='after');if(phase==='before')assert.equal(ui.coach.text,beforeUI.coach.text);});
    await tapD052(p,'#plX');await take();
  } else if(mode.startsWith('budget-')) {
    await menu(p,'policy');const high=mode==='budget-high',bound=high?1.5:.5;item.budgetCases=[];
    for(const cat of ['police','fire','health','edu']) {
      const prior=await p.ev(D052_SNAPSHOT);await tapD052(p,`#pl li[data-k="${cat}"] button:${high?'last':'first'}-child`);const after=await p.ev(D052_SNAPSHOT),ui=await p.ev(D052_UI);
      check(`${cat} budget${bound} clamp with actual toast`,()=>{assert.equal(after.policy.budget[cat],bound);assert.equal(after.sim.money,prior.sim.money);assert.equal(after.sim.day,prior.sim.day);assert.equal(after.history.length,prior.history.length);assert.ok(ui.toasts.some(t=>t.includes(phase==='before'?(high?'覆蓋更廣、更貴':'省錢、覆蓋縮水'):(high?'上限':'下限'))));});
      item.budgetCases.push({cat,before:prior.policy,after:after.policy,toasts:ui.toasts});
      if(cat==='police'&&shot) {
        // Notices render below the modal. Close through its real button so the
        // limit message itself is visible in both before and after screenshots.
        await tapD052(p,'#plX');await take();await menu(p,'policy');
      }
    }
  } else if(mode==='resume'||mode==='sandbox') {
    await menu(p,'tech');const row=(await p.ev('__gt.techRows()')).find(r=>r.kind==='tech'&&r.k==='A1');
    check('free action button and note',()=>{assert.match(row.btn,/免費/);if(phase==='before')assert.match(row.note,/要 \$400/);else {assert.doesNotMatch(row.note,/要 \$400/);assert.match(row.note,/免費/);}});
    await topTech(p);await take();await tapD052(p,'#tc li[data-kind="tech"][data-k="A1"] button');const after=await p.ev(D052_SNAPSHOT);
    check('genuine free action switches research for0 and same day',()=>{assert.equal(after.technology.act,'A1');assert.equal(after.sim.money,before.sim.money);assert.equal(after.sim.day,before.sim.day);assert.equal(after.history.at(-1).fee,0);});
  } else if(mode==='pop50') {
    check('real fixture derives exactly50 people at Lv3',()=>{assert.equal(before.sim.pop,50);assert.equal(before.technology.rank,2);});await menu(p,'commission');const ui=await p.ev(D052_UI);
    check('population50 remains actually locked with phase-specific explanation',()=>{assert.match(J(ui.commissionRows),phase==='before'?/人口 50 解鎖/:/超過 50/);assert.equal(ui.commission.state,'pop');assert.equal(ui.commissionRows.filter(r=>r.kind==='offer').length,0);});await take();
  } else if(mode==='completion'||mode==='progress') {
    await menu(p,'tech');await topTech(p);const panelBefore=await p.ev(D052_UI);const {KT,vrank}=builtBase();const expected=loadCode(code,KT,vrank);assert.equal(expected.ok,true);
    const controlRaw=structuredClone(decoded.save.raw);controlRaw.cms385={act:'',st:0,acc:0,hold:0,n:0,done:[]};const control=loadCode(encodeLabCode(controlRaw,{deflate:true}),KT,vrank);assert.equal(control.ok,true);
    const originalReport=stepDay(expected.sim);stepDay(control.sim);await p.ev('__gt.simStep(1);__gt.setVisT(2.2);__gt.setDayFrac(0)');const after=await p.ev(D052_SNAPSHOT),ui=await p.ev(D052_UI);
    check('one original simDay, exact simulator money and technology',()=>{assert.equal(after.sim.day,151);assert.equal(after.sim.money,expected.sim.money);assert.deepEqual(after.technology.prog,expected.sim.tech.prog);assert.deepEqual(after.technology.done,expected.sim.edu.tech);});
    check('open panel date and progress after actual day',()=>{if(phase==='before'){assert.equal(ui.techText,panelBefore.techText);assert.equal(ui.tech.sub,panelBefore.tech.sub);assert.match(ui.tech.sub,/第 150 天/);}else {assert.notEqual(ui.techText,panelBefore.techText);assert.match(ui.tech.sub,/第 151 天/);}});
    if(mode==='completion')check('C6 completion and one1800 payout while panel observed',()=>{assert.equal(after.technology.act,'');assert.ok(after.technology.done.includes('C6'));assert.deepEqual(after.commission.done,['techC6']);assert.equal(after.sim.money-control.sim.money,1800);assert.equal(after.history.filter(e=>e.t==='cms'&&e.ev==='done'&&e.id==='techC6').length,1);if(phase==='before')assert.match(ui.techText,/114／115/);else assert.doesNotMatch(ui.techText,/114／115/);});
    else check('normal A1 day advances5to6 with observed panel',()=>{assert.equal(after.technology.prog.A1,6);assert.match(ui.techText,phase==='before'?/5／40/:/6／40/);});item.originalDayReport=originalReport;item.controlMoney=control.sim.money;await take();
  } else throw new Error('Unknown D052 capture mode: '+mode);
  const after=await p.ev(D052_SNAPSHOT);write(`D052-${phase}-state-final-${mode}.json`,after);item.beforeSha256=d052Hash(before);item.afterSha256=d052Hash(after);item.ui=await p.ev(D052_UI);item.touches=await p.ev('__d052Touches');item.storageWrites=await p.ev('__d052Writes');
  check('trusted touch activation recorded',()=>assert.ok(item.touches.some(e=>e.type==='click'&&e.trusted&&e.pointerType==='touch')));
  if(mode==='paid'||mode==='power')check('action target received trusted touch',()=>assert.ok(item.touches.some(e=>e.type==='click'&&e.trusted&&e.pointerType==='touch'&&e.k===(mode==='paid'?'C6':'ecoReg'))));
  check('zero external requests and zero console errors',()=>{assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[]);assert.deepEqual(page.errors,[]);});
  item.layout=await p.ev('({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight})');check('no horizontal document overflow',()=>assert.ok(item.layout.scroll<=item.layout.width));item.passed=true;return item;
}
