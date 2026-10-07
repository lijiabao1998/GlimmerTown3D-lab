// D051: actual Chrome/CDP touch and native keys. Synthetic save fixtures only;
// no research/commission implementation is injected or overridden.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { d048KeyEvents } from './smoke-d048.mjs';
import { builtBase } from './d036-cities.mjs';
import { loadCode } from '../src/io/save.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { stepDay } from '../src/sim/day.ts';
import { d051ReviewCode, d051FixtureManifest, D051_CAMERA, D051_BASELINE_CAMERA, D051_SAVE_KEY, D051_BASELINE } from './d051-scenes.mjs';

const J = JSON.stringify, OUT = path.join(ROOT, 'scratch/shots');
const hash = x => createHash('sha256').update(typeof x === 'string' || Buffer.isBuffer(x) ? x : J(x)).digest('hex');
const same = (a, b, why) => assert.ok(isDeepStrictEqual(a, b), `${why}: ${hash(a)} != ${hash(b)}`);
const WORLD = `({sim:__gt.sim(),tech:__gt.techState(),layers:__gt.layers(),buildings:__gt.buildingList(),history:__gt.history(),commission:__gt.simCms(),code:__gt.save(),lastDay:__gt.lastDay(),dayReport:__gt.dayRep()})`;
const SNAP = `({...${WORLD},saved:__gt.saved(),url:location.href,historyLength:history.length,storage:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))})`;
const HUD = `(()=>{const b=document.querySelector('#commissionHud');return {hidden:b.hidden,text:b.querySelector('.progressText').textContent,label:b.getAttribute('aria-label'),bar:b.querySelector('.meter i').style.width};})()`;
const ROW = `__gt.cmRows().find(r=>r.kind==='act')`;
const PROBE = `window.__d051={pointers:[],keys:[],clicks:[]};addEventListener('pointerdown',e=>__d051.pointers.push({trusted:e.isTrusted,type:e.pointerType}),true);addEventListener('keydown',e=>__d051.keys.push({trusted:e.isTrusted,key:e.key}),true);addEventListener('click',e=>{const b=e.target.closest('button');if(b)__d051.clicks.push({trusted:e.isTrusted,id:b.id,k:b.closest('[data-k]')?.dataset.k??'',disabled:b.disabled})},true);`;
const EXPECT = { idle: '尚未開始', paused: '待繼續', researching: '研究中', complete: '已研究' };

async function key(page, value, shift = false) {
  for (const event of d048KeyEvents(value, shift)) await page.send('Input.dispatchKeyEvent', event);
  await sleep(70);
}
async function settle(p) { assert.ok(await p.waitFor(async () => !(await p.toasts()).length, 6000), 'notifications settle'); }
async function flush(p) { await p.ev('__gt.journalFlush()'); await p.ev('__gt.saveNow()'); await p.ev('__gt.journalFlush()'); }
async function load(p, mode) {
  const previousProbe = await p.ev('window.__d051 ?? null');
  if (previousProbe) (p.d051EarlierProbes ??= []).push(previousProbe);
  await p.open('sample=seed516&clean=1');
  await p.ev(`__gt.clearSave();localStorage.setItem(${J(D051_SAVE_KEY)},${J(d051ReviewCode(mode))})`);
  await p.open('');
  await p.ev(`__gt.view(${D051_CAMERA.x},${D051_CAMERA.z},${D051_CAMERA.zoom});__gt.setVisT(2.2);__gt.setDayFrac(0)`);
  await p.ev('__gt.saveNow()'); await flush(p); await settle(p);
  same(await p.ev('__gt.cam()'), D051_BASELINE_CAMERA, 'fixed camera');
  assert.equal(await p.ev('__gt.sim().playing'), false);
  await p.ev(PROBE);
}
async function hud(p, text, fraction = '0%') {
  const v = await p.ev(HUD);
  assert.equal(v.hidden, false); assert.ok(v.text.startsWith(text + ' · '), J(v));
  assert.ok(v.label.includes('，' + text + '，'), J(v)); assert.equal(v.bar, fraction);
  return v;
}
async function panel(p, text, fraction = '0%') {
  assert.equal(await p.ev('__gt.cmPanel().open'), true);
  const row = await p.ev(ROW); assert.equal(row.val, text); assert.equal(row.bar, fraction);
  assert.match(row.note, /獎金 \$1,800｜剩餘 \d+ 天（共 200 天）/);
  const needsGuide = text === '尚未開始' || text === '待繼續';
  assert.equal(row.note.includes('接受委託不會自動開始研究'), needsGuide);
  if (needsGuide) assert.match(row.note, /「科技與專精」選 C6 開始或繼續研究/);
  await hud(p, text, fraction); return row;
}
async function layout(p) {
  const v = await p.ev(`(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,scroll:e.scrollWidth,client:e.clientWidth};};
    const cm=document.querySelector('#cm');return {width:innerWidth,height:innerHeight,doc:document.documentElement.scrollWidth,hud:rect(document.querySelector('#commissionHud')),progress:rect(document.querySelector('#commissionHud .progressText')),card:cm.hidden?null:rect(cm.querySelector('.card')),buttons:cm.hidden?[]:[...cm.querySelectorAll('button')].map(rect),note:cm.hidden?null:rect(cm.querySelector('li[data-kind="act"] .note'))};})()`);
  assert.ok(v.doc <= v.width, J(v));
  for (const r of [v.hud, v.progress, v.card, v.note].filter(Boolean)) assert.ok(r.l >= 0 && r.r <= v.width + .1 && r.t >= 0 && r.b <= v.height + .1 && r.scroll <= r.client + 1, J(v));
  for (const b of v.buttons) assert.ok(b.w >= 44 && b.h >= 44 && b.b <= v.height, J(v));
}
async function tapVisible(p, selector, mobile = true) {
  // Existing long tech/menu panels need positioning before actual trusted input.
  // This DOM scroll is test positioning, not a claimed physical swipe.
  await p.ev(`document.querySelector(${J(selector)}).scrollIntoView({block:'center'})`);
  await p.frames(2);
  const c = await p.center(selector);
  assert.ok(c && c[0] >= 0 && c[0] <= p.W && c[1] >= 0 && c[1] <= p.H, selector);
  assert.equal(await p.ev(`document.querySelector(${J(selector)}).contains(document.elementFromPoint(${c[0]},${c[1]}))`), true, selector + ' hit target');
  assert.ok(await (mobile ? p.tapBtn : p.clickBtn)(selector));
}
async function openTech(p, mobile = true) {
  await tapVisible(p, '#menuBtn', mobile);
  await tapVisible(p, '#menu [data-m="tech"]', mobile);
  assert.equal(await p.ev('__gt.techPanel().open'), true);
}
async function chooseResearch(p, route, id, mobile = true) {
  await tapVisible(p, `#tc .tabs [data-route="${route}"]`, mobile);
  await tapVisible(p, `#tc li[data-kind="tech"][data-k="${id}"] button`, mobile);
}
async function readOnlyLoop(p, page, text, fraction = '0%', mobile = true) {
  const before = await p.ev(SNAP), journal = await p.ev('__gt.journalRows()');
  for (const how of ['close', 'escape', 'backdrop']) {
    assert.ok(await (mobile ? p.tapBtn : p.clickBtn)('#commissionHud'));
    await panel(p, text, fraction); await layout(p);
    if (how === 'close') await (mobile ? p.tapBtn : p.clickBtn)('#cmX');
    else if (how === 'escape') await key(page, 'Escape');
    else if (mobile) await p.tapAt([4, 4]); else await p.click([4, 4]);
    assert.equal(await p.ev('__gt.cmPanel().open'), false);
    same(await p.ev(SNAP), before, 'read-only panel dismissal ' + how);
    same(await p.ev('__gt.journalRows()'), journal, 'read-only journal ' + how);
  }
}

export async function d051Smoke(browser, log) {
  fs.mkdirSync(OUT, { recursive: true });
  const report = {
    baseline: D051_BASELINE, candidateHtmlSha256: hash(fs.readFileSync(path.join(ROOT, 'dist/index.html'))),
    fixtures: ['idle', 'paused', 'researching', 'complete'].map(d051FixtureManifest),
    mode: 'Genuine Chrome CDP touch emulation and native desktop keyboard; not Android hardware',
    injections: 'Synthetic save fixtures, read-only probes and fixed camera only. Long-panel DOM scrolling is test positioning. Daily advances use the real simulator.',
    checks: [], sessions: [], shots: [],
  };
  const check = (ok, name, detail) => { report.checks.push({ok, name, detail}); log(ok, 'D051 ' + name, detail); };
  const saveReport = () => fs.writeFileSync(path.join(OUT, 'D051-evidence.json'), J(report, null, 2) + '\n');
  const run = async (name, mode, opt, fn) => {
    try {
      await browser({width: Math.max(opt.W, 960), height: 900}, async ({open, page}) => {
        const p = await pageSession(page, open, opt); await load(p, mode);
        const shot = async label => {
          await p.frames(3); await layout(p);
          same(await p.ev('__gt.cam()'), D051_BASELINE_CAMERA, 'shot camera');
          const bytes = Buffer.from((await page.send('Page.captureScreenshot', {format:'png'})).data, 'base64');
          const file = `D051-${label}-${p.W}x${p.H}.png`; fs.writeFileSync(path.join(OUT, file), bytes);
          report.shots.push({file, sha256:hash(bytes), viewport:[p.W,p.H], camera:await p.ev('__gt.cam()'), fixture:d051FixtureManifest(mode), technology:await p.ev('__gt.techState()'), commission:await p.ev('__gt.simCms()'), hud:await p.ev(HUD), row:await p.ev(ROW)});
        };
        try { await fn(p, page, shot); check(true, name); } catch (e) { check(false, name, e.stack); }
        await page.send('Runtime.evaluate', {expression:'0', returnByValue:true});
        const probes = [...(p.d051EarlierProbes ?? []), await p.ev('__d051')];
        const probe = Object.fromEntries(['pointers','keys','clicks'].map(k => [k, probes.flatMap(v => v[k])]));
        const external = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
        check(page.errors.length === 0 && external.length === 0, name + ' zero app errors and external requests', [...page.errors,...external].join('\n'));
        const trusted = opt.mobile === false ? probe.keys.length > 0 && probe.keys.every(e => e.trusted) : probe.pointers.length > 0 && probe.pointers.every(e => e.trusted && e.type === 'touch');
        check(trusted && probe.clicks.every(e=>e.trusted), name + ' trusted input', J({pointers:probe.pointers.length,keys:probe.keys.length,clicks:probe.clicks.length}));
        report.sessions.push({name, mode, probe, probes, errors:[...page.errors], external});
      });
    } catch (e) { check(false, name + ' browser', e.stack); }
    saveReport();
  };
  await run('idle portrait 360', 'idle', {W:360,H:740}, async (p,page,shot) => {
    await hud(p,'尚未開始'); const before=await p.ev(SNAP);
    await p.tapBtn('#commissionHud'); await panel(p,'尚未開始'); await shot('idle-panel-after'); await p.tapBtn('#cmX');
    same(await p.ev(SNAP),before,'idle screenshot does not start research');
    await readOnlyLoop(p,page,'尚未開始');
  });
  await run('paused target portrait 412', 'paused', {W:412,H:860}, async (p,page,shot) => {
    await hud(p,'待繼續'); await shot('paused-hud-after');
    const t=await p.ev('__gt.techState()');assert.equal(t.act,'A1');assert.equal(t.prog.C6,50);
    await p.tapBtn('#commissionHud'); await panel(p,'待繼續'); await shot('paused-panel-after'); await p.tapBtn('#cmX');
    await readOnlyLoop(p,page,'待繼續');
    await flush(p);const saved=await p.ev('__gt.techState()'),cms=await p.ev('__gt.simCms()');
    (p.d051EarlierProbes ??= []).push(await p.ev('__d051'));
    await p.open('');await settle(p);same(await p.ev('__gt.techState()'),saved,'real save/reload research');same(await p.ev('__gt.simCms()'),cms,'real save/reload commission');await hud(p,'待繼續');
    // Reinstall a fresh observer after navigation for the final trusted-input check.
    await p.ev(PROBE);await p.tapBtn('#commissionHud');await panel(p,'待繼續');await p.tapBtn('#cmX');
  });
  await run('target researching portrait 360', 'researching', {W:360,H:740}, async (p,page,shot) => {
    await hud(p,'研究中');await shot('researching-hud-after');await readOnlyLoop(p,page,'研究中');
  });
  await run('target complete portrait 412', 'complete', {W:412,H:860}, async (p,page,shot) => {
    const {KT,vrank}=builtBase(), expected=loadCode(d051ReviewCode('complete'),KT,vrank);
    const raw=structuredClone(decodeLabCode(d051ReviewCode('complete')).save.raw);
    raw.cms385={act:'',st:0,acc:0,hold:0,n:0,done:[]};
    const control=loadCode(encodeLabCode(raw),KT,vrank);
    assert.ok(expected.ok&&control.ok);assert.equal((await p.ev('__gt.sim()')).money,expected.sim.money);
    await hud(p,'已研究','100%');await p.tapBtn('#commissionHud');await panel(p,'已研究','100%');await shot('complete-panel-after');await p.tapBtn('#cmX');
    await readOnlyLoop(p,page,'已研究','100%');
    stepDay(expected.sim);stepDay(control.sim);assert.equal(expected.sim.money-control.sim.money,1800,'independent first-day credit versus no-commission control');await p.ev('__gt.simStep(1)');assert.equal((await p.ev('__gt.sim()')).money,expected.sim.money,'actual first-day money matches unchanged simulator including completion credit');assert.equal((await p.ev(HUD)).hidden,true);
    const done=await p.ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='done'&&e.id==='techC6')");assert.equal(done.length,1);assert.equal(done[0].bonus,1800);
    assert.ok((await p.ev('__gt.simCms()')).done.includes('techC6'));
    stepDay(expected.sim);stepDay(control.sim);assert.equal(expected.sim.money-control.sim.money,1800,'no second credit versus no-commission control');await p.ev('__gt.simStep(1)');assert.equal((await p.ev('__gt.sim()')).money,expected.sim.money,'actual second-day money has no repeat completion credit');assert.equal(await p.ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='done'&&e.id==='techC6').length"),1);
  });
  await run('paused-city native research switching', 'idle', {W:412,H:860}, async (p,page) => {
    const before=await p.ev('__gt.techState()'),hist=await p.ev('__gt.history()');await openTech(p);
    await chooseResearch(p,'C','C6');await hud(p,'研究中');
    let now=await p.ev('__gt.techState()');assert.equal(now.day,before.day);assert.equal(now.act,'C6');assert.equal(now.money,before.money-5200);
    let events=await p.ev('__gt.history()');same(events.slice(0,hist.length),hist,'research history prefix');same(events.slice(hist.length),[{day:before.day,t:'research',id:'C6',fee:5200}],'exact initial research event');
    await tapVisible(p,'#tc li[data-kind="tech"][data-k="C6"] button');same(await p.ev('__gt.techState()'),now,'disabled repeat cannot spend');same(await p.ev('__gt.history()'),events,'disabled repeat cannot append');
    await chooseResearch(p,'A','A1');await hud(p,'尚未開始');assert.equal((await p.ev('__gt.techState()')).prog.C6??0,0);
    await p.tapBtn('#tcX');await p.tapBtn('#commissionHud');await panel(p,'尚未開始');await p.tapBtn('#cmX');
    // A persisted partial target tests free resume, then switching away while paused.
    await load(p,'paused');await openTech(p);const partial=await p.ev('__gt.techState()');
    await chooseResearch(p,'C','C6');await hud(p,'研究中');now=await p.ev('__gt.techState()');assert.equal(now.money,partial.money);assert.equal(now.day,partial.day);assert.equal(now.prog.C6,50);
    await chooseResearch(p,'A','A1');await hud(p,'待繼續');now=await p.ev('__gt.techState()');assert.equal(now.money,partial.money);assert.equal(now.day,partial.day);assert.equal(now.prog.C6,50);
    await p.tapBtn('#tcX');await p.tapBtn('#commissionHud');await panel(p,'待繼續');await p.tapBtn('#cmX');
    await openTech(p);await chooseResearch(p,'C','C6');await hud(p,'研究中');await key(page,'Escape');assert.equal(await p.ev('__gt.techPanel().open'),false);
    await p.tapBtn('#commissionHud');await panel(p,'研究中');await p.tapBtn('#cmX');
  });
  await run('desktop keyboard commission and research', 'paused', {W:1280,H:800,mobile:false}, async (p,page) => {
    await p.ev("document.querySelector('#commissionHud').focus()");await key(page,'Enter');await panel(p,'待繼續');await key(page,'Escape');assert.equal(await p.ev('__gt.cmPanel().open'),false);
    await openTech(p,false);await tapVisible(p,'#tc .tabs [data-route="C"]',false);
    const target='#tc li[data-kind="tech"][data-k="C6"] button';await p.ev(`document.querySelector(${J(target)}).scrollIntoView({block:'center'});document.querySelector(${J(target)}).focus()`);
    const before=await p.ev('__gt.techState()');await key(page,'Enter');await hud(p,'研究中');assert.equal((await p.ev('__gt.techState()')).money,before.money);await key(page,'Escape');
    await readOnlyLoop(p,page,'研究中','0%',false);
  });
  const trajectories=[];
  for(const interactive of [false,true])await run('RNG '+(interactive?'read':'control'),'paused',{W:412,H:860},async(p,page)=>{
    const before=await p.ev(SNAP);
    if(interactive)await readOnlyLoop(p,page,'待繼續');else await p.tapBtn('#cityName');
    same(await p.ev(SNAP),before,'no world writes before trajectory');
    const states=[await p.ev(WORLD)];for(let i=0;i<20;i++){await p.ev('__gt.simStep(1)');states.push(await p.ev(WORLD));}trajectories.push(states);
  });
  try {assert.equal(trajectories.length,2);assert.equal(trajectories[0].length,21);for(let i=0;i<21;i++)same(trajectories[0][i],trajectories[1][i],'full no-reload trajectory day '+i);report.rng={days:20,snapshots:21,sha256:hash(trajectories[0])};check(true,'20-day full no-reload trajectory');}catch(e){check(false,'20-day full no-reload trajectory',e.stack);}saveReport();
}
export function d051ImportImageGuard(log) {
  const expected={
    'D050-edited-empty-error-after-360x740.png':'2cba29c16c5b1480fd0a70cd1ff809e9718e31ed6abf067ba2e1392a6dc02303',
    'D050-invalid-error-after-412x860.png':'a1ae835dc4a47b94553d7c4784a1c8a5df122526e921b028fd4f876c18f45327',
    'D050-retry-new-error-after-412x860.png':'3e4af08ec3cd79bfb531ed7ac6676180b3c64a1c2e98716fa22dcb654bf6af11',
    'D050-reopened-after-360x740.png':'d05388dc4f424a41607971e6e552cb94c10b68f6b4e4b600546ec62860f70f02',
  };
  try{for(const [file,sha]of Object.entries(expected))assert.equal(hash(fs.readFileSync(path.join(OUT,file))),sha,file);log(true,'D051 all four approved D050 import PNGs remain byte-identical');}catch(e){log(false,'D051 prior import PNG regression',e.stack);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){let bad=0;await d051Smoke(withBrowser,(ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)bad++;});console.log('D051 focused only; the complete aggregate also checks all four D050 PNGs');process.exitCode=bad?1:0;}
