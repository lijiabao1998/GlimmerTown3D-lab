// D054 executes shipped UI modules and cityView functions with the established
// D052/D053 DOM boundary. These are not native browser or Android claims.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { d044Load, BLOCKS } from './d044-cities.mjs';
import { saveCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { CIVIC_TOOLS, ROAD_TOOLS, labToolOf, gestureOf, previewOp, commitOp, undoOp } from '../src/sim/edit.ts';
import { FOREIGN_LAYERS } from '../src/sim/rules/build.ts';
import * as Site from '../src/ui/siteDiagnostics.ts';

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const panelSource = read('src/ui/sitePanel.ts'), citySource = read('src/cityView.ts');
const strip = source => stripTypeScriptTypes(source).replace(/^import .*?;\s*$/gm, '').replace(/\bexport (?=(?:function|const)\b)/g, '');
const section = (s, start, end) => { assert.equal(s.split(start).length, 2, 'unique boundary ' + start); const from = s.indexOf(start), to = s.indexOf(end, from); assert.ok(to > from, 'closing boundary ' + end); return s.slice(from, to); };
const change = (s, from, to) => { assert.equal(s.split(from).length, 2, 'unique mutation ' + from); return s.replace(from, () => to); };
const stateBytes = value => JSON.stringify(value, (_key, v) => {
  if (v instanceof Map) return { map: [...v] }; if (v instanceof Set) return { set: [...v] };
  if (ArrayBuffer.isView(v)) return { type: v.constructor.name, bytes: [...new Uint8Array(v.buffer, v.byteOffset, v.byteLength)] };
  if (v instanceof ArrayBuffer) return { bytes: [...new Uint8Array(v)] };
  if (typeof v === 'function') return { function: String(v) }; return v;
});
const raw = f => stateBytes(f.sim), saved = f => saveCode(f.sim, f.template, f.start);
const [X, Z] = BLOCKS.C;
const at = (s, x = X, z = Z) => s.w.tiles[z * s.w.N + x];
function fixture() {
  const f = d044Load(), s = f.sim; s.money = 10000; s.diff = 1; s.edu.tech = []; s.edu.spec = null;
  for (let z = Z - 1; z <= Z + 4; z++) for (let x = X - 1; x <= X + 6; x++) {
    const i = z * s.w.N + x; Object.assign(at(s, x, z), { t: 2, road: 0, rc: 0, hw: 0, bridge: 0, bld: null, zone: 0, tree: 0, wp: 0, ruin: 0, crater: 0, ...Object.fromEntries(FOREIGN_LAYERS.map(k => [k, 0])) });
    for (const key of ['road', 'rclass', 'zone', 'tree', 'wp', 'ruin', 'occ']) s.city[key][i] = 0;
    s.city.ter[i] = 2; s.res.resource[i] = 0; s.res.rdep[i] = 0;
  }
  return f;
}
const operation = (tool, x1 = X, z1 = Z) => ({ k: gestureOf(tool), tool, x0: X, z0: Z, x1, z1 });
const stroke = (x1 = X, z1 = Z, pid = 1) => ({ pid, a: [X, Z], b: [x1, z1], x: 100, y: 150, moved: false });
function instrumentRng(s) { const calls = []; for (const key of ['R', 'ri']) { const old = s.rng[key]; s.rng[key] = (...args) => { const out = old(...args); calls.push([key, args, out]); return out; }; } return calls; }
function same(a, b, ar, br, label) { assert.equal(raw(a), raw(b), label + ' full state/history/transactions'); assert.equal(saved(a), saved(b), label + ' save bytes'); assert.deepEqual(ar, br, label + ' RNG calls/results'); }
function makeDom() {
  // Reuse the actual existing boundary implementation, without modifying it.
  const body = section(read('tools/unit-d053.mjs'), 'function makeDom() {', 'function catalogHarness(');
  return new Function('read', 'section', 'assert', body + ';return makeDom();')(read, section, assert);
}
function compilePanel(doc, Element, source = panelSource) {
  const dependencies = { ...Site, document: doc, HTMLElement: Element, Element };
  const js = [read('src/ui/panelContent.ts'), read('src/ui/panelPress.ts'), source].map(strip).join('\n');
  return new Function(...Object.keys(dependencies), js + ';return {createSitePanel,siteCostText};')(...Object.values(dependencies));
}
function panelHarness(source = panelSource) {
  const { doc, Element } = makeDom(), { createSitePanel, siteCostText } = compilePanel(doc, Element, source), closes = [];
  const panel = createSitePanel({ close: () => { closes.push('close'); panel.reset(); panel.root.hidden = true; } }); doc.body.append(panel.root);
  return { doc, panel, closes, siteCostText, node: selector => panel.root.querySelector(selector) };
}
function panelBehavior(source = panelSource) {
  const h = panelHarness(source), f = fixture(), s = f.sim; at(s, X + 1).wp = 1;
  const estimate = Site.diagnoseSite(s, operation('wpipe', X + 2)), actual = commitOp(s, operation('wpipe', X + 2), 0), result = Site.diagnoseSiteResult(estimate, actual);
  const state = { tool: 'wpipe', day: s.day, funds: s.money, sandbox: false, estimate, result, notice: '' }, p = h.panel;
  p.root.hidden = false; p.update(state);
  assert.equal(p.root.getAttribute('role'), 'dialog'); assert.equal(p.root.getAttribute('aria-modal'), 'true'); assert.equal(p.root.getAttribute('aria-labelledby'), p.title.id);
  assert.match(p.title.textContent, /配水管.*拉線/); assert.match(h.node('#siteEstimate').textContent, /可建 2、略過 1/); assert.match(h.node('#siteEstimate').textContent, /已有水管/); assert.match(h.node('#siteResult').textContent, /完成 2／未完成 1/); assert.match(h.node('#siteResult').textContent, /原選區略過 1：已有水管/);
  const close = h.node('#siteClose'), body = h.node('.body'), estimateRow = h.node('#siteEstimate').children[1]; body.scrollTop = 77; close.focus({ preventScroll: true }); close.setPointerCapture(81);
  p.update({ ...state, day: 151, funds: 900.125 }); assert.ok(h.node('#siteClose') === close); assert.ok(h.node('#siteEstimate').children[1] === estimateRow, 'retained generated row identity'); assert.ok(h.doc.activeElement === close); assert.equal(close.hasPointerCapture(81), true); assert.equal(body.scrollTop, 77); assert.match(h.node('#siteCurrent').textContent, /151.*900.125/);
  const held = p.root.textContent; h.doc.emit('pointerdown', { target: close, pointerId: 81 }); p.update({ ...state, day: 152, funds: 800 }); p.update({ ...state, day: 153, funds: 700 }); assert.equal(p.root.textContent, held, 'held close freezes entire panel presentation');
  h.doc.emit('pointerup', { target: close, pointerId: 81 }); assert.equal(p.root.textContent, held); h.doc.emit('click', { target: close, pointerId: 81 }); h.doc.runTimers(); assert.equal(h.closes.length, 1); assert.equal(p.root.hidden, true); assert.equal(p.root.textContent, held, 'close/reset prevents stale flush');
  p.root.hidden = false; p.update({ ...state, day: 154, funds: 600 });
  h.doc.emit('pointerdown', { target: close, pointerId: 82 }); h.doc.emit('pointerdown', { target: close, pointerId: 83 }); const twoHeld = p.root.textContent; p.update({ ...state, day: 155, funds: 500 });
  h.doc.emit('pointercancel', { target: close, pointerId: 82 }); h.doc.runTimers(); assert.equal(p.root.textContent, twoHeld, 'second pointer keeps presentation held'); h.doc.emit('pointercancel', { target: close, pointerId: 83 }); h.doc.runTimers(); assert.match(h.node('#siteCurrent').textContent, /155.*500/); assert.equal(h.closes.length, 1);
  for (const event of ['blur', 'pagehide']) { h.doc.emit('pointerdown', { target: close, pointerId: 84 }); p.update({ ...state, day: 156, funds: 400 }); h.doc.emit(event, { target: h.doc.defaultView }); h.doc.runTimers(); assert.match(h.node('#siteCurrent').textContent, /156.*400/); }
  p.update({ ...state, tool: 'mine', day: 157, funds: 300 }); assert.match(p.title.textContent, /礦場/); assert.match(h.node('#siteEstimate').textContent, /最近選址・配水管.*第 150 天/s); assert.match(h.node('#siteResult').textContent, /第 150 天・配水管/);
  h.doc.emit('click', { target: p.root }); assert.equal(h.closes.length, 2); assert.equal(p.root.hidden, true);
  return 'actual sitePanel accessible shell, captured/current distinction, held updates/latest flush, row/button/focus/scroll/capture retention, second pointer, cancel, blur/pagehide, close/backdrop';
}
function costBehavior(source = panelSource) {
  const h = panelHarness(source), f = fixture(), s = f.sim; s.money = 10; at(s, X + 1).wp = 1; at(s, X + 2).t = 0;
  const d = Site.diagnoseSite(s, operation('wpipe', X + 3)), text = h.siteCostText(d);
  assert.match(text, /配水管・可建 2／略過 2/); assert.match(text, /估價 \$20・現有 \$10・缺 \$10/); assert.match(text, /已有水管/); assert.match(text, /只能鋪在陸地上/); assert.match(text, /逐格.*後面.*便宜/);
  const rect = h.siteCostText(Site.diagnoseSite(s, operation('park', X + 1))); assert.match(rect, /整批/);
  s.diff = 3; s.money = -.25; assert.match(h.siteCostText(Site.diagnoseSite(s, operation('park'))), /資金為負.*\$0/);
  s.diff = 1; s.money = 10000; s.res.resource[Z * s.w.N + X] = 1; s.res.rdep[Z * s.w.N + X] = 240;
  assert.match(h.siteCostText(Site.diagnoseSite(s, operation('oilwell'))), /油田餘量 0／240.*可建但不再產出/); assert.doesNotMatch(h.siteCostText(Site.diagnoseSite(s, operation('gaswell'))), /餘量|耗盡/);
  at(s, X + 1).wp = 0; at(s, X - 1, Z - 1).t = at(s, X + 1, Z - 1).t = 0; assert.match(h.siteCostText(Site.diagnoseSite(s, operation('sewage'))), /尚未貼管網.*鄰水/);
  return 'actual cost text preserves counts/mixed reasons/exact money/gesture funding rule/negative sandbox/resource/gas/network qualifications';
}
function cityHarness(f, source = citySource, panel = panelSource, options = {}) {
  const { doc, Element } = makeDom(), { createSitePanel, siteCostText } = compilePanel(doc, Element, panel), calls = [], toasts = [], guides = [], costs = [], previews = [];
  const x = { sim: f.sim, calls, toasts, guides, costs, previews, saved: [], clock: 1000, idle: [], delays: [], diagnoses: [], labels: [], visiblePreview: [], visibleCost: null, failDiagnosis: '' };
  if (options.idle !== false) doc.defaultView.requestIdleCallback = task => { x.idle.push(task); };
  const deps = { ...Site, CIVIC_TOOLS, ROAD_TOOLS, labToolOf, gestureOf, previewOp, commitOp, undoOp, createSitePanel,
    diagnoseSite: (...args) => { const d = Site.diagnoseSite(...args); x.diagnoses.push({ op: args[1], provided: !!args[2], d }); if (x.failDiagnosis === args[1].tool) throw new Error('forced warm diagnosis failure'); return d; },
    siteCostText: d => { x.labels.push(d); return siteCostText(d); }, document: doc, HTMLElement: Element, Element };
  const chunks = [section(source, '  function warmEdit() {', '  // 換城：'), section(source, '  // D054: ephemeral UI snapshots only', '  // D053: keep imported rank rules'), section(source, '  function syncUi() {', '  // D040：資源圖。'), section(source, '  let pipesShown = false;', '  const toolColor'), section(source, '  function opOf(', '  // 鍵盤：對話框')];
  const js = `let sim=x.sim,city=sim.city,tool='road',roadTool='alley',civicTool='police',stroke=null,lastPreview=null,down=null,needsRender=false;
    const ui=document.createElement('div');document.body.append(ui);
    const timing={},performance={now:()=>x.clock};
    const window=document.defaultView,setTimeout=(task,delay)=>{x.delays.push(delay);return window.setTimeout(task,delay);},siteCenter=()=>[${X},${Z}];
    const bui={setSiteGuide:(...a)=>x.guides.push(a),showCost:(...a)=>{x.costs.push(a);x.visibleCost=a;},hideCost:()=>{x.calls.push('hideCost');x.visibleCost=null;},toast:(...a)=>x.toasts.push(a),menuOpen:()=>x.calls.push('menuClose'),setHud:()=>x.calls.push('hud')};
    const preview={clear:()=>{x.calls.push('previewClear');x.visiblePreview=[];},set:(...a)=>{x.previews.push(a);x.visiblePreview=a[0];}},tileTop=()=>0;
    const THREE={Vector3:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}},TOUCH:{ROTATE:'rotate'},MOUSE:{ROTATE:'rotate'}};
    const screenOf=p=>[p.x,p.z],toolColor=()=> '#fff',controls={touches:{ONE:'rotate'},mouseButtons:{LEFT:'rotate'}};
    const invalidate=()=>x.calls.push('invalidate'),closeCard=()=>x.calls.push('closeCard'),rebuildScene=()=>x.calls.push('rebuild'),draw=()=>x.calls.push('draw');
    const saveNow=()=>{x.calls.push('save');x.saved.push(saveFixture());},KINDS={name:k=>String(k)};
    const closeDecisionPanels=()=>x.calls.push('decisionClose'),saveModal={isOpen:()=>false},closeSavePanels=()=>x.calls.push('savePanelClose'),rkGate={cancel:()=>x.calls.push('rankReset')},catalog={root:{hidden:true},reset:()=>x.calls.push('catalogReset')};
    const growthModal={show:(root,title)=>{root.hidden=false;title.focus({preventScroll:true});x.calls.push('show');},close:()=>{sitePanel.root.hidden=true;x.calls.push('close');}};
    const closeGrowth=(restoreFocus=true)=>{rkGate.cancel();catalog.reset();sitePanel.reset();growthModal.close(restoreFocus);};
    const syncRes=()=>{},liveBuildings=()=>[],powerStatus=()=>({powered:0,unpowered:0,cap:0}),simCounts=()=>[[0],[0,0,0],[0,0,0],[0,0,0]],label='test',loadDay=sim.day,autosaves=()=>true,saveErr='',jstore=null,jwhy='',saveWarnings=()=>({}),saveStatus={setState:()=>{}},syncCommissionHud=()=>{},syncDock=()=>x.calls.push('dock'),rk={hidden:true},renderRank=()=>{};
    ${chunks.map(strip).join('\n')}
    return {sitePanel,renderSite,syncSite,syncUi,openSite,runOp,doUndo,updatePreview,commitStroke,cancelStroke,interruptBuild,syncPipes,setTool,warmEdit,
      setStroke:s=>{stroke=s;},choose:id=>{if(ROAD_TOOLS.some(t=>t.id===id)){roadTool=id;setTool('road');}else if(CIVIC_TOOLS.some(t=>t.id===id)){civicTool=id;setTool('civic');}else setTool(id);},
      state:()=>({siteEstimate,siteResult,siteNotice,stroke,lastPreview,pipesShown,tool,roadTool,civicTool}),timing:()=>({...timing}),setSim:s=>{sim=s;city=s?.city;}};`;
  return { ...new Function('x', 'saveFixture', ...Object.keys(deps), js)(x, () => saved(f), ...Object.values(deps)), doc, calls, toasts, guides, costs, previews, saves: x.saved, trace: x, runWarm: () => { for (const task of x.idle.splice(0)) task(); doc.runTimers(); } };
}
function integration(source = citySource) {
  const cases = [
    ['mixed pipe', 'wpipe', s => { at(s, X + 1).wp = 1; at(s, X + 2).t = 0; }, X + 3],
    ['bridge then cheap', 'alley', s => { s.money = 16; at(s, X + 1).t = 0; }, X + 2],
    ['failed rect', 'park', s => { s.money = 60; }, X + 1],
    ['none eligible', 'wpipe', s => { at(s).wp = 1; }, X],
    ['armed demolition', 'doze', s => { at(s).bld = { k: 1, lv: 2, v: 0, age: 0, pw: true, h: 1 }; }, X],
    ['fractional exact funds', 'park', s => { s.edu.tech = ['B5', 'C8', 'D4a']; s.edu.spec = 'hub'; s.money = 60 * .95 * .95 * .9 * 1.05; }, X],
    ['free sandbox success', 'park', s => { s.diff = 3; s.money = 0; }, X + 1],
    ['grouped footprint demolition', 'doze', s => { assert.equal(commitOp(s, operation('megaproject'), 0).placed, 1); }, X + 2, Z + 2],
  ];
  for (const [label, id, setup, end, endZ = Z] of cases) {
    const a = fixture(), b = fixture(); setup(a.sim); setup(b.sim); const ar = instrumentRng(a.sim), br = instrumentRng(b.sim), h = cityHarness(a, source), q = operation(id, end, endZ);
    h.choose(id); h.setStroke(stroke(end, endZ)); h.updatePreview(); same(a, b, ar, br, label + ' shipped preview');
    const before = h.state().siteEstimate; assert.deepEqual(before, Site.diagnoseSite(b.sim, q)); assert.ok(h.costs.at(-1)[2].includes(before.name));
    h.setStroke(null); const r = h.runOp(q), original = commitOp(b.sim, q, 1000); assert.deepEqual(r, original); same(a, b, ar, br, label + ' shipped runOp');
    assert.deepEqual(h.state().siteEstimate, before, label + ' snapshot captured before actual commit'); assert.deepEqual(h.state().siteResult, Site.diagnoseSiteResult(before, original));
    if (original.spent) {
      const expected = '−$' + original.spent.toLocaleString() + (original.placed > 1 ? `（${original.placed} 格）` : '');
      assert.deepEqual(h.toasts.filter(([text]) => text.startsWith('−')).map(([text]) => text), [expected], label + ' transient debit preserves original compact number formatting, without full-precision expansion, result counts or CTA');
      assert.doesNotMatch(expected, /未完成|現場|可查/);
      if (label === 'fractional exact funds') assert.notEqual('$' + original.spent.toLocaleString(), Site.formatSiteMoney(original.spent), 'fractional fixture discriminates original compact popup from exact persistent display');
    }
    if (original.placed && !original.spent && !original.skipped) assert.deepEqual(h.toasts, [], label + ' original free success emits no new wide result toast');
    if (before.groupedDemolition) { assert.equal(h.state().siteResult.unfinished, null); assert.ok(h.toasts.every(([text]) => !/未完成|null/.test(text)), 'grouped actual toast cannot invent unfinished cells'); }
    assert.equal(h.saves.length, original.placed || original.spent ? 1 : 0, label + ' original save triggering'); if (h.saves.length) assert.equal(h.saves[0], saved(b));
    h.openSite(); assert.equal(h.sitePanel.root.hidden, false); assert.match(h.sitePanel.root.textContent, /最近一次施工/); same(a, b, ar, br, label + ' opened details read-only');
    const detail = h.sitePanel.root.querySelector('#siteResult').textContent;
    assert.ok(detail.includes(h.state().siteResult.summary), label + ' full actual result remains in persistent details');
    assert.equal(h.state().siteResult.spent, original.spent, label + ' compact notification cannot round the stored actual charge');
    assert.ok(detail.includes('實扣 ' + Site.formatSiteMoney(original.spent)), label + ' persistent details retain exact full-precision actual amount');
    for (const reason of before.reasons) assert.ok(detail.includes(`原選區略過 ${reason.count}：${reason.reason}`), label + ' mixed blocked reasons survive compact notification');
    const undo = h.doUndo(), controlUndo = undoOp(b.sim); assert.deepEqual(undo, controlUndo); same(a, b, ar, br, label + ' original undo');
    if (undo.ok) {
      assert.equal(h.state().siteEstimate, null); assert.equal(h.state().siteResult, null);
      assert.equal(h.state().siteNotice, `上一筆施工已復原，退回 ${Site.formatSiteMoney(undo.refund)}。`, label + ' persistent undo notice retains exact refund');
      assert.equal(h.toasts.at(-1)[0], '↩ 已復原' + (undo.refund ? '，退回 $' + undo.refund.toLocaleString() : ''), label + ' transient undo toast preserves original compact number formatting');
      assert.ok(h.sitePanel.root.querySelector('#siteResult').textContent.includes(h.state().siteNotice), label + ' exact refund remains accessible after compact toast');
    } else assert.notEqual(h.state().siteResult, null, 'failed undo keeps actual last outcome');
  }
  return cases.length + ' real preview→runOp→actual result→open details→undo wrappers paired with unchanged simulation; exact models/history/saves/costs/RNG and original save triggers';
}
function refreshAndWarmup(source = citySource) {
  const a = fixture(), b = fixture(), ar = instrumentRng(a.sim), br = instrumentRng(b.sim), h = cityHarness(a, source);
  h.choose('wpipe'); h.setStroke(stroke(X + 2, Z, -1)); h.updatePreview(); assert.equal(h.state().siteEstimate, null, 'fake prewarming stroke cannot become user selection'); assert.equal(h.state().siteResult, null);
  h.setStroke(stroke(X + 2)); h.updatePreview(); const first = h.state().siteEstimate; assert.equal(first.day, 150); assert.equal(first.total, 30);
  a.sim.money = b.sim.money = 9.125; a.sim.day = b.sim.day = 151; h.syncUi(); assert.equal(h.state().siteEstimate.day, 151); assert.equal(h.state().siteEstimate.funds, 9.125); assert.equal(h.state().siteEstimate.shortfall, 20.875); same(a, b, ar, br, 'real syncUi refreshes active stroke without writing');
  h.openSite(); assert.equal(h.state().stroke, null); assert.equal(h.state().lastPreview, null); assert.equal(h.sitePanel.root.hidden, false); const close = h.sitePanel.root.querySelector('#siteClose');
  h.doc.emit('pointerdown', { target: close, pointerId: 9 }); const held = h.sitePanel.root.textContent;
  assert.deepEqual(stepDay(a.sim), stepDay(b.sim)); h.syncUi(); same(a, b, ar, br, 'day proceeds while details close held'); assert.equal(h.sitePanel.root.textContent, held);
  h.doc.emit('pointercancel', { target: close, pointerId: 9 }); h.doc.runTimers(); assert.match(h.sitePanel.root.querySelector('#siteCurrent').textContent, /152/); assert.match(h.sitePanel.root.querySelector('#siteEstimate').textContent, /第 151 天/);
  close.click(); assert.equal(h.sitePanel.root.hidden, true); const closed = h.sitePanel.root.textContent; a.sim.day = b.sim.day = 153; h.syncUi(); assert.equal(h.sitePanel.root.textContent, closed, 'closed details do not redraw');
  h.choose('water'); assert.equal(h.state().pipesShown, true); const rebuilds = h.calls.filter(c => c === 'rebuild').length; h.choose('sewage'); assert.equal(h.state().pipesShown, true); assert.equal(h.calls.filter(c => c === 'rebuild').length, rebuilds, 'water→sewage stays in existing pipe layer'); h.choose('police'); assert.equal(h.state().pipesShown, false);
  h.setStroke(stroke(X, Z)); const model = raw(a), code = saved(a), rng = stateBytes(ar); assert.equal(h.commitStroke({ ...stroke(), moved: true }), null, 'dragged tap cancels'); assert.equal(raw(a), model); assert.equal(saved(a), code); assert.equal(stateBytes(ar), rng);
  return 'actual warmup pid−1 exclusion, held-stroke day/funds refresh, open interruption, held close across real day, captured estimate age, closed-panel quietness, water→sewage→other layer, dragged tap cancellation';
}
function idleWarmup(source = citySource) {
  for (const idle of [true, false]) {
    const a = fixture(), b = fixture(), ar = instrumentRng(a.sim), br = instrumentRng(b.sim), h = cityHarness(a, source, panelSource, { idle });
    if (!idle) {
      // An already recorded real operation must survive a later idle callback.
      assert.deepEqual(h.runOp(operation('wpipe')), commitOp(b.sim, operation('wpipe'), 1000));
      h.choose('gaswell');
    } else h.choose('coll');
    const before = stateBytes(h.state()), estimate = h.state().siteEstimate, result = h.state().siteResult;
    const diagnosisCount = h.trace.diagnoses.length, labelCount = h.trace.labels.length, costCount = h.costs.length, effects = [h.saves.length, h.toasts.length, h.guides.length, h.calls.filter(v => v === 'rebuild').length];
    const expectedFirst = h.state().roadTool;
    h.warmEdit(); assert.equal(h.trace.diagnoses.length, diagnosisCount, 'warmEdit schedules, never synchronously taxes the load/action stack');
    assert.equal(stateBytes(h.state()), before, 'scheduling does not alter UI state');
    if (idle) assert.equal(h.trace.idle.length, 1); else assert.equal(h.trace.delays.at(-1), 300, 'existing timer fallback remains bounded');
    h.runWarm();
    const diagnoses = h.trace.diagnoses.slice(diagnosisCount), labels = h.trace.labels.slice(labelCount), costs = h.costs.slice(costCount);
    assert.deepEqual(diagnoses.map(q => q.op.tool), [expectedFirst, 'zr', 'plant', 'doze', 'sewage', 'wpipe', 'oilwell', 'mine'], 'normal product idle work covers all eight actual preview paths');
    assert.ok(diagnoses.every(q => q.provided), 'warm diagnostics reuse the actual authoritative preview');
    assert.equal(labels.length, 8, 'every idle pass executes actual multiline siteCostText, not old fallback text'); assert.equal(costs.length, 8);
    for (let i = 0; i < 8; i++) { assert.ok(labels[i] === diagnoses[i].d, 'the same local diagnosis reaches real label formatting'); assert.ok(costs[i][2].includes(labels[i].name)); assert.match(costs[i][2], /估價.*現有/); }
    assert.equal(stateBytes(h.state()), before, 'tools, road/civic selection, pipe layer, snapshots and notices survive every pass');
    assert.ok(h.state().siteEstimate === estimate && h.state().siteResult === result, 'real recorded objects are retained, never replaced by fake warmup');
    assert.equal(h.trace.visibleCost, null); assert.deepEqual(h.trace.visiblePreview, []); assert.equal(h.state().stroke, null); assert.equal(h.state().lastPreview, null);
    assert.equal(Number.isFinite(h.timing().warm), true); assert.equal('preview' in h.timing(), false, 'idle timing cannot masquerade as a native sample');
    assert.deepEqual([h.saves.length, h.toasts.length, h.guides.length, h.calls.filter(v => v === 'rebuild').length], effects, 'idle preparation cannot save, toast, change the selected-tool label or rebuild the city');
    same(a, b, ar, br, 'product idle warmup full purity');
    for (let day = 0; day < 3; day++) { assert.deepEqual(stepDay(a.sim), stepDay(b.sim)); same(a, b, ar, br, 'uninterrupted post-warm day ' + day); }
  }
  const a = fixture(), b = fixture(), ar = instrumentRng(a.sim), br = instrumentRng(b.sim), h = cityHarness(a, source);
  h.choose('wpipe'); h.warmEdit(); const held = stroke(X + 2); h.setStroke(held); h.updatePreview();
  const heldState = stateBytes(h.state()), visible = stateBytes([h.trace.visiblePreview, h.trace.visibleCost]), count = h.trace.diagnoses.length;
  h.runWarm(); assert.equal(h.trace.diagnoses.length, count, 'queued warmup skips an intervening genuine stroke'); assert.equal(stateBytes(h.state()), heldState); assert.equal(stateBytes([h.trace.visiblePreview, h.trace.visibleCost]), visible); assert.ok(h.state().stroke === held);
  h.cancelStroke(); h.choose('gaswell'); const safeState = stateBytes(h.state()); h.trace.failDiagnosis = 'sewage'; h.warmEdit(); assert.throws(() => h.runWarm(), /forced warm diagnosis failure/);
  assert.equal(stateBytes(h.state()), safeState, 'finally restores original selection and clears transient preview after failure'); assert.equal(h.trace.visibleCost, null); assert.deepEqual(h.trace.visiblePreview, []); same(a, b, ar, br, 'warm failure cannot write simulation/history/save/RNG');
  h.trace.failDiagnosis = ''; h.setSim(null); const unloaded = stateBytes(h.state()), observed = h.trace.diagnoses.length; h.warmEdit(); h.runWarm(); assert.equal(h.trace.diagnoses.length, observed); assert.equal(stateBytes(h.state()), unloaded, 'queued idle preparation cannot revive an unloaded city');
  return 'actual eight-pass idle and timer-fallback preparation; same local diagnostics/text path; tools/snapshots/model/history/save/RNG unchanged, six paired future days, genuine-stroke skip, failure/unloaded cleanup, native timing untouched';
}
function mutations() {
  panelBehavior(); costBehavior(); integration(); refreshAndWarmup(); idleWarmup();
  const panels = [
    ['held gate removed', 'if (!state || gate.defer(render)) return;', 'if (!state) return;', panelBehavior],
    ['latest update ignored', 'state = s; render();', 'state ??= s; render();', panelBehavior],
    ['retained estimate rows replaced', "updatePanelContent($('siteEstimate'), ...estimate);", "$('siteEstimate').replaceChildren(...estimate);", panelBehavior],
    ['mixed reasons omitted from cost label', 'if (d.reasons.length) rows.push(reasonsText(d));', '', costBehavior],
    ['close callback disabled', "$('siteClose').onclick = on.close;", "$('siteClose').onclick = () => {};", panelBehavior],
  ];
  for (const [name, from, to, check] of panels) assert.throws(() => check(change(panelSource, from, to)), e => e?.code === 'ERR_ASSERTION', name);
  const city = [
    ['precommit snapshot captured after commit', 'const before = diagnoseSite(sim!, op);\n    const res = commitOp(sim!, op, performance.now());', 'const res = commitOp(sim!, op, performance.now());\n    const before = diagnoseSite(sim!, op);', integration],
    ['actual result count replaced by preview', 'diagnoseSiteResult(before, res)', 'diagnoseSiteResult(before, { ...res, placed: before.eligible })', integration],
    ['fake warmup creates persistent estimate', 'if (stroke.pid >= 0) siteEstimate =', 'siteEstimate =', refreshAndWarmup],
    ['active stroke never refreshes in syncSite', 'if (stroke) updatePreview();', 'if (false) updatePreview();', refreshAndWarmup],
    ['undo retains stale result', "siteEstimate = null; siteResult = null; siteNotice = `上一筆施工已復原", "siteNotice = `上一筆施工已復原", integration],
    ['closed panel still redraws', 'if (!sitePanel.root.hidden) renderSite();', 'renderSite();', refreshAndWarmup],
    ['sewage does not show pipe layer', " || civicTool === 'sewage'", '', refreshAndWarmup],
    ['inspection charges hidden fee', 'function renderSite() {\n    if (!sim) return;', 'function renderSite() {\n    if (!sim) return; sim.money--;', integration],
    ['compact debit expands fractional precision', '−$${res.spent.toLocaleString()}', '−${formatSiteMoney(res.spent)}', integration],
    ['compact refund expands fractional precision', '，退回 $${r.refund.toLocaleString()}', '，退回 ${formatSiteMoney(r.refund)}', integration],
    ['compact format leaks into persistent actual amount', 'siteResult = diagnoseSiteResult(before, res);', 'siteResult = { ...diagnoseSiteResult(before, res), spent: Math.round(res.spent * 1000) / 1000 };', integration],
    ['compact format leaks into persistent refund notice', 'siteNotice = `上一筆施工已復原，退回 ${formatSiteMoney(r.refund)}。`;', 'siteNotice = `上一筆施工已復原，退回 $${r.refund.toLocaleString()}。`;', integration],
    ['grouped demolition result invents unfinished count', 'siteResult = diagnoseSiteResult(before, res);', 'siteResult = { ...diagnoseSiteResult(before, res), unfinished: before.selected - res.placed };', integration],
    ['compact debit re-expands into result CTA', "${res.placed > 1 ? `（${res.placed} 格）` : ''}`);", "${res.placed > 1 ? `（${res.placed} 格）` : ''}・完成 ${res.placed}／未完成 ${siteResult.unfinished}，點「現場」可查`);", integration],
    ['sandbox gains an unrequested result toast', 'if (res.spent && sim!.diff !== 3) bui.toast(', 'if (res.placed && !res.spent) bui.toast(siteResult.summary); if (res.spent && sim!.diff !== 3) bui.toast(', integration],
    ['idle sewage branch remains cold', "['civic', 'sewage'], ", '', idleWarmup],
    ['idle preview uses old price text', 'placeCostTag(diagnosis);', 'placeCostTag();', idleWarmup],
    ['idle callback overwrites an active user stroke', 'if (!sim || !city || stroke) return;', 'if (!sim || !city) return;', idleWarmup],
    ['idle callback forgets original civic selection', 'tool = t0; civicTool = civic0;', 'tool = t0;', idleWarmup],
    ['idle callback stores last fake preview timing', 'delete timing.preview;', 'void timing.preview;', idleWarmup],
    ['idle callback consumes simulation RNG', 'const run = () => {', 'const run = () => { if (sim) sim.rng.R();', idleWarmup],
  ];
  for (const [name, from, to, check] of city) assert.throws(() => check(change(citySource, from, to)), e => e?.code === 'ERR_ASSERTION', name);
  return panels.length + city.length + ' real-source panel/render/close/commit/undo/warmup/refresh/layer/purity mutations rejected by behavioral assertions';
}
export function d054UiGuards(log, match = '') {
  const tests = [['actual site panel content and retained-control lifecycle', panelBehavior], ['actual on-map diagnostic wording', costBehavior], ['actual commit and undo integration parity', integration], ['actual warmup refresh interruption and pipe-layer integration', refreshAndWarmup], ['actual idle product preparation purity', idleWarmup], ['actual UI mutation sensitivity', mutations]];
  if (match && !tests.some(([name]) => name.includes(match))) { log(false, 'D054 UI test selection', 'No test matched: ' + match); return; }
  for (const [name, fn] of tests) if (!match || name.includes(match)) try { log(true, 'D054 UI ' + name, fn()); } catch (error) { log(false, 'D054 UI ' + name, error.stack); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { let bad = 0; d054UiGuards((ok, name, detail) => { console.log(ok ? 'OK' : 'NG', name, detail ?? ''); if (!ok) bad++; }, process.argv[2] ?? ''); process.exitCode = bad ? 1 : 0; }
