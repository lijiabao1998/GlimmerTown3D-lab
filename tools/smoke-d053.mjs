// D053: native Chrome/CDP acceptance, never synthetic DOM clicks or input events.
// Synthetic saves, camera positioning, focus/scroll positioning and the original
// simStep hook are explicit setup. Run only where Chrome/WebGL is supported.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { d048KeyEvents } from './smoke-d048.mjs';
import { captureD053, loadD053, tapD053, D053_SNAPSHOT, D053_UI, d053Hash, D055_FOOD_IDS, D055_CATALOG_IDS } from './d053-capture.mjs';
import { D053_MODES, D053_SHOTS, D053_TOOL_IDS, D053_SAVE_KEY, D053_SPACE_SITE, d053ReviewCode } from './d053-scenes.mjs';
import { builtBase } from './d036-cities.mjs';
import { mk } from './d034-cities.mjs';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { loadCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { CIVIC_TOOLS, FOOD_TOOLS, FACILITY_TOOLS, previewOp, commitOp, undoOp, powerStatus } from '../src/sim/edit.ts';
const J = JSON.stringify, OUT = path.join(ROOT, 'scratch/shots');
const same = (a, b, label) => assert.ok(isDeepStrictEqual(a, b), `${label}: ${d053Hash(a)} != ${d053Hash(b)}`);
assert.deepEqual(CIVIC_TOOLS.map(t=>t.id),D053_TOOL_IDS,'D055 must retain exact original civic18');
assert.deepEqual(FOOD_TOOLS.map(t=>t.id),D055_FOOD_IDS,'exact food7 additions');
assert.deepEqual(FACILITY_TOOLS.map(t=>t.id),D055_CATALOG_IDS,'exact catalogue25 union');
const GROUPS = {
  all: D055_CATALOG_IDS,
  service: ['park','fire','police','policeBox','hospital','clinic','school','library','post','cemetery'],
  utility: ['water','wpipe','dump','sewage'],
  resource: ['oilwell','mine','gaswell','megaproject'],
  food: D055_FOOD_IDS,
};
// Do not equate sim().hash with an RNG dump. Paired uninterrupted trajectories
// below test later stochastic behavior after navigation versus the untouched UI.
const world = s => ({ code:s.code, layers:s.layers, history:s.history, buildings:s.buildings,
  money:s.sim.money, day:s.sim.day, playing:s.sim.playing, technology:s.technology,
  commission:s.commission, policy:s.policy, lastDay:s.lastDay, dayReport:s.dayReport });
const persisted = s => ({ ...world(s), saved:s.saved, storage:s.storage,
  journal:s.journal, journalRows:s.journalRows, journalCount:s.journalCount });
const PROBE = `(()=>{window.__d053Extra=[];for(const type of ['pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture','keydown','keyup','click'])addEventListener(type,e=>{const b=e.target.closest?.('button');__d053Extra.push({type,trusted:e.isTrusted,pointerType:e.pointerType??'',pointerId:e.pointerId??null,key:e.key??'',id:b?.id??e.target.id??'',tool:b?.dataset.tool??'',c:b?.dataset.c??'',group:b?.dataset.group??'',target:e.target.tagName});},true);window.__d053Writes=[];const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===${J(D053_SAVE_KEY)})__d053Writes.push({key:k,length:String(v).length});return original.call(this,k,v);};})()`;
const key = async (page, value, shift=false) => { for(const e of d048KeyEvents(value,shift)) await page.send('Input.dispatchKeyEvent',e); await sleep(80); };
const tap = (p, sel, mobile=true) => tapD053(p,sel,mobile);
const hidden = (p, sel) => p.ev(`document.querySelector(${J(sel)}).hidden`);
const snap = async p => { await p.ev('__gt.journalFlush()'); return p.ev(D053_SNAPSHOT); };
const model = code => { const {KT,vrank}=builtBase(), r=loadCode(code,KT,vrank); assert.ok(r.ok); powerStatus(r.sim); return r; };
const op = (tool,x,z,x1=x,z1=z,k='tap') => ({k,tool,x0:x,z0:z,x1,z1});
async function menuRank(p,mobile=true) { await tap(p,'#menuBtn',mobile); await tap(p,'#menu [data-m="rank"]',mobile); }
async function catalog(p,mobile=true) { if(!['civic','food'].includes((await p.ev('__gt.ui()')).tool)) await tap(p,'.tool[data-t="civic"]',mobile); await tap(p,'#civicGuide',mobile); assert.equal(await hidden(p,'#catalog'),false); }
async function select(p,id,mobile=true) { await catalog(p,mobile); await tap(p,'#catalog [data-group="all"]',mobile); await tap(p,`#catalog [data-tool="${id}"]`,mobile); assert.equal(await hidden(p,'#catalog'),true); assert.equal(await p.ev('__gt.ui().civicTool'),id); }
async function position(p,sel,focus=false) { await p.ev(`(()=>{const b=document.querySelector(${J(sel)});b.scrollIntoView({block:'center'});${focus?'b.focus({preventScroll:true});':''}})()`); await p.frames(2); }
async function newCode(p,code) {
  await retain(p,'before new fixture');
  await p.open('sample=seed516&clean=1'); await p.ev(`__gt.clearSave();localStorage.setItem(${J(D053_SAVE_KEY)},${J(code)})`); await p.open('');
  await p.ev('__gt.saveNow()'); await p.ev('__gt.journalFlush()'); await p.ev('__gt.saveNow()');
  assert.ok(await p.waitFor(async()=>!(await p.toasts()).length,6000)); await p.ev(PROBE);
}
async function retain(p,phase) { (p.d053Traces??=[]).push({phase,events:await p.ev('window.__d053Extra??[]'),writes:await p.ev('window.__d053Writes??[]')}); }
async function assertModal(p,sel) {
  const a=await p.ev(`(()=>{const e=document.querySelector(${J(sel)}),label=e.getAttribute('aria-labelledby'),r=e.querySelector('.card').getBoundingClientRect();return {hidden:e.hidden,role:e.getAttribute('role'),modal:e.getAttribute('aria-modal'),label:document.getElementById(label)?.textContent,focus:e.contains(document.activeElement),canvas:document.querySelector('canvas').inert,dock:document.querySelector('#dock').closest('[inert]')!==null,w:innerWidth,h:innerHeight,doc:document.documentElement.scrollWidth,card:[r.left,r.top,r.right,r.bottom],small:[...e.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return r.width<44||r.height<44}).map(b=>b.id||b.dataset.tool||b.dataset.group),overflow:[...e.querySelectorAll('h2,h3,p,li,button')].filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.textContent)};})()`);
  assert.equal(a.hidden,false); assert.equal(a.role,'dialog'); assert.equal(a.modal,'true'); assert.ok(a.label&&a.focus&&a.canvas&&a.dock,J(a));
  assert.ok(a.doc<=a.w&&a.card[0]>=-.5&&a.card[1]>=-.5&&a.card[2]<=a.w+.5&&a.card[3]<=a.h+.5,J(a)); same(a.small,[],'44px controls'); same(a.overflow,[],'no horizontal content overflow');
}
async function assertClosed(p) {
  assert.equal(await hidden(p,'#catalog'),true); assert.equal(await hidden(p,'#rk'),true);
  const a=await p.ev(`(()=>{const e=document.activeElement,r=e.getBoundingClientRect();return {inert:document.querySelectorAll('[inert]').length,visible:!!e.getClientRects().length&&!e.closest('[hidden],[inert]')&&r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5,id:e.id,tool:e.dataset.t};})()`);
  assert.equal(a.inert,0,J(a)); assert.ok(a.visible,J(a)); assert.ok(a.id==='menuBtn'||a.id==='civicGuide'||a.tool==='civic',J(a));
}
async function focusCycle(p,page,sel) {
  const count=await p.ev(`(()=>{const d=document.querySelector(${J(sel)});return [...d.querySelectorAll('button,[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&!e.closest('[hidden]')&&e.getClientRects().length).length;})()`);
  assert.ok(count>=2);
  for(const reverse of [false,true]) for(let i=0;i<count+2;i++) {
    await key(page,'Tab',reverse);
    assert.equal(await p.ev(`document.querySelector(${J(sel)}).contains(document.activeElement)&&!document.activeElement.closest('[hidden],[inert]')`),true,'native Tab trapped');
  }
}
async function cancelClean(p,before) {
  same(persisted(await snap(p)),persisted(before),'cancel leaves code/layers/history/day/money/storage unchanged');
  assert.equal(await p.ev('__gt.stroke()'),null); assert.equal(await p.ev('__gt.previewCount()'),0); assert.equal(await p.ev('__gt.ui().pointers'),0); assert.equal((await p.rectOf('#costTag')).hidden,true);
}
async function point(p,x,z) {
  await p.ev(`__gt.view(${x+.5},${z+.5},4.4)`); await p.frames(3);
  const at=await p.cell(x,z); assert.equal(await p.hit(at),'CANVAS',`unobscured cell ${x},${z}`); return at;
}
async function hold(p,x,z) { const at=await point(p,x,z); await p.touch('touchStart',[at]); await p.frames(2); return {at,preview:(await p.ev('__gt.stroke()'))?.preview}; }
function compareModel(actual,s,label) {
  assert.equal(actual.sim.money,s.money,label+' money'); assert.equal(actual.sim.day,s.day,label+' day');
  for(const k of ['road','rclass','ter','el','zone','tree','rail','dock','tram','occ']) same(actual.layers[k],Array.from(s.city[k]),label+' '+k);
  same(actual.history,s.city.history,label+' history');
  const saved=decodeLabCode(actual.code); assert.ok(saved.ok); same(saved.save.raw.wp,Array.from(s.city.wp).join(''),label+' water-pipe save layer');
}
async function nativeOp(p,operation) {
  const {x0,z0,x1,z1}=operation;
  await p.ev(`__gt.view(${(x0+x1)/2+.5},${(z0+z1)/2+.5},4.4)`); await p.frames(3);
  const a=await p.cell(x0,z0),b=await p.cell(x1,z1); assert.equal(await p.hit(a),'CANVAS'); assert.equal(await p.hit(b),'CANVAS');
  await p.drag(a,b,operation.k==='tap'?2:8); const preview=(await p.ev('__gt.stroke()'))?.preview; assert.ok(preview); return preview;
}
export async function d053Smoke(browser,log) {
  fs.mkdirSync(OUT,{recursive:true});
  const report={title:'D053 growth navigation native acceptance',device:'Chrome CDP touch emulation at 360/412 and desktop; not Android hardware',qualifications:['Synthetic fixture saves loaded before page creation; no runtime rank/money/resource overrides.','No synthetic DOM click or keyboard/pointer events. Focus and scroll are positioning only.','Paired future trajectories are observational RNG-consumption coverage, not a hidden RNG dump.'],fixedCapture:null,checks:[],sessions:[],passed:false};
  const write=()=>fs.writeFileSync(path.join(OUT,'D053-evidence.json'),J(report,null,2));
  const check=(ok,name,detail='')=>{report.checks.push({ok,name,detail});log(ok,'D053 '+name,detail);};
  // First establish every immutable before/after scenario, including the six PNGs.
  try { report.fixedCapture=await captureD053({phase:'after',outDir:OUT}); check(report.fixedCapture.passed&&report.fixedCapture.cases.length===D053_MODES.length&&report.fixedCapture.shots.length===D053_SHOTS.length,'all 10 fixed scenes and six comparison PNGs'); }
  catch(e) { check(false,'fixed-scene capture',String(e.stack??e)); }
  for(const [from,to] of [['report.json','D053-fixed-capture.json'],['after-index.html','D053-after-index.html'],['fixture-manifest.json','D053-fixture-manifest.json']]) if(fs.existsSync(path.join(OUT,from))) fs.copyFileSync(path.join(OUT,from),path.join(OUT,to));
  for(const mode of D053_MODES) for(const ext of ['png','json']) { const from=path.join(OUT,`failure-${mode}.${ext}`); if(fs.existsSync(from)) fs.copyFileSync(from,path.join(OUT,`D053-fixed-failure-${mode}.${ext}`)); }
  write();
  const run=async(name,mode,opt,fn)=>{
    const item={name,mode,viewport:opt,passed:false}; report.sessions.push(item);
    try { await browser({width:Math.max(960,opt.W),height:900},async({page,open})=>{
      item.version=await page.send('Browser.getVersion'); const p=await pageSession(page,open,opt);
      const debug=async e=>{item.error=String(e.stack??e);check(false,name,item.error);try{const file='D053-failure-'+name.replace(/[^a-z0-9]+/gi,'-');item.failureScreenshot=file+'.png';fs.writeFileSync(path.join(OUT,item.failureScreenshot),Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));fs.writeFileSync(path.join(OUT,file+'.json'),J({state:await snap(p),ui:await p.ev(D053_UI),input:await p.ev('window.__d053Extra??[]')},null,2));}catch(d){item.debugError=String(d);}};
      try { await loadD053(p,mode); await p.ev(PROBE); await fn(p,page,item); item.passed=true; check(true,name); } catch(e) { await debug(e); }
      try { await retain(p,'final');item.traces=p.d053Traces;const all=item.traces.flatMap(t=>t.events),actual=opt.mobile===false?all.some(e=>e.type==='keydown'):all.some(e=>e.type==='pointerdown'&&e.pointerType==='touch');check(actual&&all.every(e=>e.trusted),name+' genuine native input',J({events:all.length})); } catch(e) {check(false,name+' trace',String(e));}
      item.errors=[...page.errors];item.external=page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));check(!item.errors.length&&!item.external.length,name+' zero console errors/external requests',J([...item.errors,...item.external]));
    }); } catch(e) {item.error=String(e.stack??e);check(false,name+' browser',item.error);} write();
  };
  for(const opt of [{W:360,H:740},{W:412,H:860},{W:1280,H:800,mobile:false}]) await run('layout accessibility '+opt.W,'catalog',opt,async(p,page)=>{
    const mobile=opt.mobile!==false,before=await snap(p); await menuRank(p,mobile);await assertModal(p,'#rk');await focusCycle(p,page,'#rk');
    await position(p,'#rkCatalog',true);await key(page,'Enter');assert.equal(await hidden(p,'#rk'),true);await assertModal(p,'#catalog');
    await focusCycle(p,page,'#catalog');await tap(p,'#catalog [data-group="resource"]',mobile);await position(p,'#catalog [data-tool="megaproject"]');await assertModal(p,'#catalog');
    // A native map-position touch/mouse event must hit the modal, never the canvas.
    const c=await p.cell(D053_SPACE_SITE.x,D053_SPACE_SITE.z);assert.notEqual(await p.hit(c),'CANVAS');if(mobile)await p.tapAt(c);else await p.click(c);
    if(await hidden(p,'#catalog')) await catalog(p,mobile);
    await tap(p,'#catalogRank',mobile);await assertModal(p,'#rk');await tap(p,'#rkCatalog',mobile);await assertModal(p,'#catalog');
    for(const panel of ['#catalog','#rk']) for(const how of ['button','escape','backdrop']) {
      if(panel==='#catalog'){if(await hidden(p,panel))await catalog(p,mobile);}else{if(!await hidden(p,'#catalog'))await tap(p,'#catalogRank',mobile);else await menuRank(p,mobile);}
      if(how==='button')await tap(p,panel==='#catalog'?'#catalogClose':'#rkX',mobile);
      else if(how==='escape')await key(page,'Escape');
      else { assert.equal(await p.hit([3,3]),'DIV'+panel);if(mobile)await p.tapAt([3,3]);else await p.click([3,3]); }
      await assertClosed(p);same(persisted(await snap(p)),persisted(before),panel+' '+how+' is read-only');
    }
    // The guide occupies only the three unused cells of row three. It cannot
    // add a fourth row or obscure any original facility target/map space.
    if ((await p.ev('__gt.ui()')).tool !== 'civic') await tap(p,'.tool[data-t="civic"]',mobile);
    const grid = await p.ev(`(()=>{const q=s=>document.querySelector(s).getBoundingClientRect(),g=q('#civicGuide'),w=q('#civicWrap'),c=q('#civicSub');return {guide:[g.left,g.top,g.right,g.bottom,g.width,g.height],wrap:[w.top,w.bottom],grid:[c.top,c.bottom],buttons:[...document.querySelectorAll('#civicSub button')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom];}),hit:document.querySelector('#civicGuide').contains(document.elementFromPoint(g.x+g.width/2,g.y+g.height/2))};})()`);
    assert.equal(grid.buttons.length,18); assert.equal(new Set(grid.buttons.map(b=>Math.round(b[1]))).size,3,'original three facility rows');
    assert.equal(grid.wrap[1],grid.grid[1],'guide adds no vertical dock space'); assert.ok(grid.guide[4]>=44&&grid.guide[5]>=44&&grid.hit,'guide is visible and tappable');
    assert.ok(grid.guide[0]>=0&&grid.guide[2]<=opt.W+.5&&Math.abs(grid.guide[3]-grid.grid[1])<.5,'guide fits third row');
    for(const b of grid.buttons)assert.ok(grid.guide[2]<=b[0]||grid.guide[0]>=b[2]||grid.guide[3]<=b[1]||grid.guide[1]>=b[3],'guide never overlaps a facility');
    // The direct toolbar entry has native Enter/Space behavior and never toggles play.
    await catalog(p,mobile);await key(page,'Escape');await position(p,'#civicGuide',true);await key(page,' ');await assertModal(p,'#catalog');assert.equal(await p.ev('__gt.sim().playing'),false);await key(page,'Escape');
    assert.equal(await p.ev('__d053Writes.length'),0,'navigation never calls localStorage save');
  });
  await run('all 25 selectors, unchanged 18 civic tools and exact seven-food category','space-catalog',{W:412,H:860},async(p,page,item)=>{
    const before=await snap(p);await catalog(p);
    for(const [group,ids] of Object.entries(GROUPS)) {await tap(p,`#catalog [data-group="${group}"]`);same(await p.ev("[...document.querySelectorAll('#catalog [data-tool]')].map(b=>b.dataset.tool)"),ids,'exact '+group+' catalog');assert.equal(await p.ev(`document.querySelector('#catalog [data-group="${group}"]').getAttribute('aria-pressed')`),'true');}
    item.selected=[];
    for(const t of FACILITY_TOOLS) {
      if(await hidden(p,'#catalog'))await catalog(p);await tap(p,'#catalog [data-group="all"]');
      const description=await p.ev(`document.querySelector('#catalog [data-tool="${t.id}"]').closest('li').textContent`);assert.ok(description.includes(t.name));assert.ok(description.includes('基價 $'+t.cost.toLocaleString('en-US')));
      await tap(p,`#catalog [data-tool="${t.id}"]`);assert.equal(await p.ev('__gt.ui().civicTool'),t.id);assert.equal(await p.ev('__gt.ui().tool'),D055_FOOD_IDS.includes(t.id)?'food':'civic');await assertClosed(p);
      same(persisted(await snap(p)),persisted(before),'select '+t.id+' costs no money/day/history/save');
      const hints=await p.ev('__gt.resourceHints()');if(['oilwell','gaswell','mine'].includes(t.id)){assert.ok(hints.shown>0);assert.ok(hints.cells.every(c=>c[2]===(t.id==='mine'?2:1)));}else assert.equal(hints.shown,0);
      assert.equal(await p.ev('__gt.pipesShown()'),['water','wpipe','sewage'].includes(t.id));
      assert.equal(await p.ev(`__d053Extra.filter(e=>e.type==='click'&&e.tool===${J(t.id)}&&e.trusted).length`),1,'exactly one original selection activation');item.selected.push(t.id);
    }
    assert.equal(await p.ev('__d053Writes.length'),0);same(item.selected,D055_CATALOG_IDS,'all 18 original plus seven food callbacks');await key(page,'Escape');
  });
  for(const sandbox of [false,true]) await run('rank 21 lock '+(sandbox?'sandbox':'normal'),'rank21',{W:360,H:740},async(p,page)=>{
    if(sandbox){const raw=structuredClone(decodeLabCode(d053ReviewCode('rank21')).save.raw);raw.df=3;await newCode(p,encodeLabCode(raw));assert.equal(await p.ev('__gt.techState().diff'),3);}
    const before=await snap(p),current=await p.ev('__gt.ui().civicTool');await catalog(p);await tap(p,'#catalog [data-group="resource"]');
    assert.equal(await p.ev("document.querySelector('#catalog [data-tool=megaproject]').disabled"),true);
    for(let n=0;n<2;n++)await tap(p,'#catalog [data-tool="megaproject"]');assert.equal(await p.ev('__gt.ui().civicTool'),current);assert.equal(await hidden(p,'#catalog'),false);
    await key(page,'Escape');await tap(p,'#civicSub [data-c="megaproject"]');assert.equal(await p.ev('__gt.ui().civicTool'),current);assert.ok((await p.toasts()).some(t=>/Lv\.22/.test(t)));
    same(persisted(await snap(p)),persisted(before),'catalog disabled and original dock toast retain level gate');assert.equal(await p.ev('__d053Writes.length'),0);
  });
  for(const target of ['selection','rank-button','rank-catalog-button']) await run('held promotion '+target,'rank-live',{W:412,H:860},async(p,page,item)=>{
    const inRank=target==='rank-catalog-button',panel=inRank?'#rk':'#catalog',body=inRank?'#rk .card':'#catalog .body';
    if(inRank)await menuRank(p);else {await catalog(p);await tap(p,'#catalog [data-group="service"]');}
    const sel=inRank?'#rkCatalog':target==='selection'?'#catalog [data-tool="cemetery"]':'#catalogRank';await position(p,sel,true);
    await p.ev(`window.__d053Held=document.querySelector(${J(sel)});window.__d053Scroll=document.querySelector(${J(body)}).scrollTop`);
    const rect=await p.rectOf(sel),old=await p.ev(`document.querySelector(${J(panel+' .sub')}).textContent`),at=await p.center(sel),start=await p.ev('__d053Extra.length'),expected=model(d053ReviewCode('rank-live'));
    await p.touch('touchStart',[at]);await sleep(50);stepDay(expected.sim);await p.ev('__gt.simStep(1)');
    const state=await snap(p);assert.equal(state.technology.rank,3);assert.equal(state.sim.day,51);assert.equal(state.sim.money,expected.sim.money);assert.equal(await p.ev('__gt.rankRep().points'),169);
    same(await p.rectOf(sel),rect,'held target rectangle');assert.equal(await p.ev(`__d053Held===document.querySelector(${J(sel)})&&__d053Held.isConnected&&document.activeElement===__d053Held`),true);assert.equal(await p.ev(`document.querySelector(${J(body)}).scrollTop===__d053Scroll`),true);assert.equal(await p.ev(`document.querySelector(${J(panel+' .sub')}).textContent`),old,'whole presentation deferred while held');
    const writes=await p.ev('__d053Writes.length');await p.release();await p.frames(3);
    item.release=await p.ev(`__d053Extra.slice(${start})`);const id=inRank?'rkCatalog':target==='selection'?'cemetery':'catalogRank';assert.equal(item.release.filter(e=>e.type==='click'&&e.trusted&&(e.tool===id||e.id===id)).length,1,'original release activates original callback once');
    for(const type of ['pointerdown','pointerup','click'])assert.ok(item.release.some(e=>e.type===type&&e.trusted&&(e.tool===id||e.id===id)),J(item.release));
    if(target==='selection'){assert.equal(await p.ev('__gt.ui().civicTool'),'cemetery');await assertClosed(p);await catalog(p);}else if(!inRank){await assertModal(p,'#rk');assert.match(await p.ev("document.querySelector('#rk .sub').textContent"),/第 51 天/);await tap(p,'#rkCatalog');}
    await assertModal(p,'#catalog');assert.match(await p.ev("document.querySelector('#catalog .sub').textContent"),/Lv\.4.*第 51 天/);assert.equal(await p.ev(`document.querySelector('#catalog [data-group="${inRank?'all':'service'}"]').getAttribute('aria-pressed')`),'true');
    // Promotion itself may save; native release and reopening must not add a save.
    same(world(await snap(p)),world(state),'release navigation does not alter promoted model');assert.equal(await p.ev('__d053Writes.length'),writes);await key(page,'Escape');
  });
  await run('catalog cancel and hidden live update','rank-live',{W:360,H:740},async(p,page)=>{
    await catalog(p);await tap(p,'#catalog [data-group="utility"]');const sel='#catalog [data-tool="sewage"]';await position(p,sel,true);await p.touch('touchStart',[await p.center(sel)]);await p.ev('__gt.simStep(1)');await p.touch('touchCancel',[]);await p.frames(3);
    assert.match(await p.ev("document.querySelector('#catalog .sub').textContent"),/Lv\.4.*第 51 天/);assert.equal(await p.ev('__gt.ui().civicTool'),'police');
    await position(p,sel,true);await p.touch('touchStart',[await p.center(sel)]);await p.ev('__gt.simStep(1)');await key(page,'Escape');await p.touch('touchCancel',[]);await p.frames(3);await assertClosed(p);
    const text=await p.ev("document.querySelector('#catalog').textContent");await p.ev('__gt.simStep(1)');assert.equal(await p.ev("document.querySelector('#catalog').textContent"),text,'closed catalog not repainted');await catalog(p);assert.match(await p.ev("document.querySelector('#catalog .sub').textContent"),/第 53 天/);assert.equal(await p.ev("document.querySelector('#catalog [data-group=utility]').getAttribute('aria-pressed')"),'true');await key(page,'Escape');
  });
  await run('normal playback refreshes both growth dialogs','rank-live',{W:360,H:740},async(p,page)=>{
    await tap(p,'#play');await menuRank(p);let day=await p.ev('__gt.sim().day');
    assert.equal(await p.ev('__gt.sim().playing'),true);assert.ok(await p.waitFor(async()=>await p.ev(`__gt.sim().day>${day}`),10000),'normal frame loop advances rank panel day');
    let current=await p.ev('__gt.sim().day');assert.ok((await p.ev("document.querySelector('#rk .sub').textContent")).includes(`第 ${current} 天`));await tap(p,'#rkCatalog');day=await p.ev('__gt.sim().day');
    assert.equal(await p.ev('__gt.sim().playing'),true);assert.ok(await p.waitFor(async()=>await p.ev(`__gt.sim().day>${day}`),10000),'normal frame loop advances catalog day');current=await p.ev('__gt.sim().day');assert.ok((await p.ev("document.querySelector('#catalog .sub').textContent")).includes(`第 ${current} 天`));await key(page,'Escape');await tap(p,'#play');assert.equal(await p.ev('__gt.sim().playing'),false);
  });
  await run('space native interruption cancellations','space-build',{W:412,H:860},async(p,page)=>{
    await select(p,'megaproject');const before=await snap(p),{x,z}=D053_SPACE_SITE;
    let h=await hold(p,x,z);same(h.preview,{count:1,total:4500,cells:9},'original held preview');await p.touch('touchMove',[[h.at[0]+24,h.at[1]]]);await p.frames(2);await p.release();await cancelClean(p,before);
    for(const onUI of [false,true]) {
      h=await hold(p,x,z);const other=onUI?await p.center('#menuBtn'):[h.at[0]+64,h.at[1]];await p.touch('touchStart',[[...h.at,0],[...other,1]]);await p.frames(2);assert.equal(await p.ev('__gt.stroke()'),null);await p.touch('touchEnd',[[...other,1]]);await p.touch('touchMove',[[h.at[0]+2,h.at[1],0]]);await p.release();if(!await hidden(p,'#menu'))await tap(p,'#menuX');await cancelClean(p,before);
    }
    for(const interruption of ['Escape','menu','catalog','toolbar']) {
      await select(p,'megaproject');h=await hold(p,x,z);
      if(interruption==='Escape')await key(page,'Escape');
      else {const selector=interruption==='menu'?'#menuBtn':interruption==='catalog'?'#civicGuide':'.tool[data-t="plant"]';await position(p,selector,true);await key(page,'Enter');if(interruption==='catalog')await assertModal(p,'#catalog');if(interruption==='menu')assert.equal(await hidden(p,'#menu'),false);}
      assert.equal(await p.ev('__gt.stroke()'),null);await p.release();if(!await hidden(p,'#catalog')||!await hidden(p,'#menu'))await key(page,'Escape');await cancelClean(p,before);
    }
    await select(p,'megaproject');await hold(p,x,z);await p.touch('touchCancel',[]);await p.frames(3);await cancelClean(p,before);assert.equal(await p.ev('__d053Writes.length'),0);
    // A canceled gesture must not poison the very next real build/undo.
    const expected=model(before.code),operation=op('megaproject',x,z);commitOp(expected.sim,operation,0);await hold(p,x,z);await p.release();compareModel(await snap(p),expected.sim,'build after interruption');undoOp(expected.sim);await tap(p,'#undo');compareModel(await snap(p),expected.sim,'undo after interruption');
  });
  await run('space original model build undo persistence','space-build',{W:412,H:860},async(p,page,item)=>{
    await select(p,'megaproject');const before=await snap(p),expected=model(before.code),{x,z}=D053_SPACE_SITE,operation=op('megaproject',x,z),pv=previewOp(expected.sim,operation);
    same(await nativeOp(p,operation),{count:pv.count,total:pv.total,cells:pv.cells.length},'original nine-cell4500 preview');same(persisted(await snap(p)),persisted(before),'held preview is read-only');const built=commitOp(expected.sim,operation,0);assert.equal(built.spent,4500);await p.release();const actual=await snap(p);compareModel(actual,expected.sim,'original space build');item.build=built;
    const occupied=await nativeOp(p,operation);assert.equal(occupied.count,0);assert.equal(occupied.cells,9);await p.release();same(world(await snap(p)),world(actual),'occupied footprint refuses whole build');
    undoOp(expected.sim);await tap(p,'#undo');compareModel(await snap(p),expected.sim,'original space undo');
    await nativeOp(p,operation);commitOp(expected.sim,operation,0);await p.release();await p.ev('__gt.journalFlush()');const final=await snap(p);compareModel(final,expected.sim,'second space build');await retain(p,'space saved before reload');await p.open('');await p.ev(PROBE);const reloaded=await snap(p);assert.equal(reloaded.sim.money,final.sim.money);same(reloaded.layers.occ,final.layers.occ,'real reload nine occupied cells');same(reloaded.history.filter(e=>e.t==='place'&&e.k===51),final.history.filter(e=>e.t==='place'&&e.k===51),'real reload construction history');await tap(p,'#menuBtn');await key(page,'Escape');
  });
  await run('sandbox rank22 original free placement','space-build',{W:412,H:860},async(p,page)=>{
    const raw=structuredClone(decodeLabCode(d053ReviewCode('space-build')).save.raw);raw.df=3;await newCode(p,encodeLabCode(raw));await select(p,'megaproject');assert.equal(await p.ev('__gt.techState().diff'),3);const before=await snap(p),expected=model(before.code),{x,z}=D053_SPACE_SITE,operation=op('megaproject',x,z),pv=previewOp(expected.sim,operation);const native=await nativeOp(p,operation);assert.equal(native.cells,9);assert.equal(native.total,pv.total);commitOp(expected.sim,operation,0);await p.release();compareModel(await snap(p),expected.sim,'sandbox original commit');assert.equal(expected.sim.money,before.sim.money);await key(page,'Escape');
  });
  await run('original pipe park resource and shore restrictions','space-build',{W:412,H:860},async(p,page,item)=>{
    const fixture=mk(1,150,'D053原建造限制驗收',b=>{b.road(25,30,35,30,3).put(24,30,5).put(29,29,1);b.water(30,24,31,24);b.flag('tre',27,27,1);},{rk:21,money:100000});await newCode(p,fixture);item.operations=[];
    for(const operation of [op('wpipe',28,29,31,30,'line'),op('park',26,26,28,27,'rect')]) {
      await select(p,operation.tool);const before=await snap(p),expected=model(before.code),pv=previewOp(expected.sim,operation);assert.ok(pv.count>=4);const native=await nativeOp(p,operation);same(native,{count:pv.count,total:pv.total,cells:pv.cells.length},operation.tool+' original gesture preview');commitOp(expected.sim,operation,0);await p.release();compareModel(await snap(p),expected.sim,operation.tool+' original commit');const committed=await snap(p),again=previewOp(expected.sim,operation);same(await nativeOp(p,operation),{count:again.count,total:again.total,cells:again.cells.length},operation.tool+' already occupied/skipped preview');assert.equal(again.count,0);await p.release();same(persisted(await snap(p)),persisted(committed),operation.tool+' repeat no mutation');undoOp(expected.sim);await tap(p,'#undo');compareModel(await snap(p),expected.sim,operation.tool+' original undo');item.operations.push({operation,preview:pv});
    }
    await select(p,'wpipe');const waterLine=op('wpipe',30,24,31,24,'line'),waterBefore=await snap(p),waterModel=model(waterBefore.code),waterPreview=previewOp(waterModel.sim,waterLine);assert.equal(waterPreview.count,0);same(await nativeOp(p,waterLine),{count:0,total:0,cells:waterPreview.cells.length},'pipe refuses water cells');await p.release();same(persisted(await snap(p)),persisted(waterBefore),'invalid underwater pipe preserves all state');
    for(const tool of ['oilwell','mine','gaswell','sewage']) {
      await select(p,tool);const initial=await snap(p),expected=model(initial.code),s=expected.sim,candidates=[];
      for(let z=8;z<s.w.N-8;z++)for(let x=8;x<s.w.N-8;x++){const t=s.w.tiles[z*s.w.N+x];if(t.t===0||t.road||t.bld||t.tree)continue;const operation=op(tool,x,z),pv=previewOp(s,operation);candidates.push({operation,pv});}
      const invalid=candidates.find(c=>!c.pv.count),valid=candidates.find(c=>c.pv.count===1);assert.ok(invalid&&valid,tool+' must have valid and invalid original sites');
      for(const {operation,pv} of [invalid,valid]) {
        const before=await snap(p);same(await nativeOp(p,operation),{count:pv.count,total:pv.total,cells:pv.cells.length},tool+' original restriction preview');const result=commitOp(s,operation,0);await p.release();
        if(!pv.count){same(persisted(await snap(p)),persisted(before),tool+' invalid site no mutation');assert.equal(result.ok,false);}else {assert.equal(result.ok,true);compareModel(await snap(p),s,tool+' matching-resource/shore build');undoOp(s);await tap(p,'#undo');compareModel(await snap(p),s,tool+' matching-resource/shore undo');}
        item.operations.push({operation,preview:pv,result});
      }
    }
    await key(page,'Escape');
  });
  await run('native pagehide and city switch release inert','catalog',{W:412,H:860},async(p,page,item)=>{
    await catalog(p);await p.ev(`addEventListener('pagehide',e=>sessionStorage.setItem('D053-pagehide',JSON.stringify({trusted:e.isTrusted,inert:document.querySelectorAll('[inert]').length,catalog:document.querySelector('#catalog').hidden,rank:document.querySelector('#rk').hidden})))`);await retain(p,'before genuine navigation');await p.open('');await p.ev(PROBE);item.pagehide=await p.ev("JSON.parse(sessionStorage.getItem('D053-pagehide'))");same(item.pagehide,{trusted:true,inert:0,catalog:true,rank:true},'native pagehide releases modal locks');assert.equal(await p.ev("document.querySelectorAll('[inert]').length"),0);
    await catalog(p);await key(page,'Escape');await tap(p,'#menuBtn');await tap(p,'#menu [data-m="city:seed516"]');assert.equal(await p.ev("document.querySelectorAll('[inert]').length"),0);assert.equal(await hidden(p,'#catalog'),true);assert.equal(await hidden(p,'#rk'),true);await tap(p,'#menuBtn');await key(page,'Escape');
  });
  const trajectories=[];
  for(const navigated of [false,true])await run('paired future trajectory '+(navigated?'all tools':'control'),'space-build',{W:412,H:860},async(p,page,item)=>{
    if(navigated){for(const id of D055_CATALOG_IDS)await select(p,id);await catalog(p);await tap(p,'#catalogRank');await tap(p,'#rkCatalog');await key(page,'Escape');}
    else {await tap(p,'#menuBtn');await key(page,'Escape');}
    const states=[world(await snap(p))],expected=model(d053ReviewCode('space-build'));
    for(let d=0;d<6;d++){stepDay(expected.sim);await p.ev('__gt.simStep(1)');const state=await snap(p);assert.equal(state.sim.money,expected.sim.money);assert.equal(state.technology.rank,expected.sim.rankIdx);states.push(world(state));}
    item.trajectory={days:6,snapshots:states.length,sha256:d053Hash(states)};trajectories.push(states);
  });
  try {assert.equal(trajectories.length,2);same(trajectories[0],trajectories[1],'six original uninterrupted days after every selection versus control');check(true,'paired six-day full exposed state/code/history trajectory');}catch(e){check(false,'paired six-day trajectory',String(e.stack??e));}
  report.passed=report.checks.every(c=>c.ok);write();return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){let failed=0;await d053Smoke(withBrowser,(ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)failed++;});process.exitCode=failed?1:0;}
