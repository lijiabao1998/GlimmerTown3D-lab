// D051: execute the shipped cityView functions, with DOM/storage doubles only at
// the browser boundary. These guards do not claim layout, touch or browser coverage.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { d045Load } from './d045-cities.mjs';
import { saveCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { startResearch, acceptCommission, dropCommission, commissionOffers, commissionState } from '../src/sim/edit.ts';
import { CMS385, CMS_BY_ID385, NO_RIDERSHIP, cmsToast } from '../src/sim/rules/commission.ts';
import { TECH343, TECH343_BY_ID, SPEC386, SPEC_IDS386, SPEC_MIN_RANK, techWhy, techFee } from '../src/sim/rules/tech.ts';

const city = fs.readFileSync(path.join(ROOT, 'src/cityView.ts'), 'utf8');
const section = (s, from, to) => {
  assert.equal(s.split(from).length, 2, 'unique source boundary: ' + from);
  const a = s.indexOf(from), b = s.indexOf(to, a);
  assert.ok(b > a, 'closing source boundary: ' + to);
  return s.slice(a, b);
};
const change = (s, from, to) => {
  assert.equal(s.split(from).length, 2, 'unique mutation: ' + from);
  return s.replace(from, to);
};
const active = (id = 'techC6', extra = {}) => ({ cms385: { act: id, st: 140, acc: 0, hold: 0, n: 0, done: [], ...extra } });
// Include every enumerable simulator field, Map entry, typed-array byte/value and
// function body. RNG closures are checked separately through calls and trajectories.
const stateBytes = s => JSON.stringify(s, (_k, v) => {
  if (v instanceof Map) return { map: [...v] };
  if (v instanceof Set) return { set: [...v] };
  if (ArrayBuffer.isView(v)) return { type: v.constructor.name, bytes: [...new Uint8Array(v.buffer, v.byteOffset, v.byteLength)] };
  if (v instanceof ArrayBuffer) return { bytes: [...new Uint8Array(v)] };
  if (typeof v === 'function') return { function: String(v) };
  if (typeof v === 'number' && !Number.isFinite(v)) return { number: String(v) };
  return v;
});

class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.dataset = {}; this.style = {};
    this.attrs = {}; this.className = ''; this.hidden = true; this.disabled = false;
    this._text = ''; this.onclick = null;
    this.classList = { add: name => { this.className += ' ' + name; } };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  append(...kids) { this.children.push(...kids); }
  replaceChildren(...kids) { this._text = ''; this.children = [...kids]; }
  set innerHTML(_) { throw new Error('D051 must not interpret HTML'); }
  all(fn) { return this.children.flatMap(c => [ ...(fn(c) ? [c] : []), ...c.all(fn) ]); }
  click() { if (!this.disabled) this.onclick?.({ target: this }); }
}

function harness(sim, source = city) {
  const nodes = new Map();
  const h = { sim, nodes, calls: [], hud: undefined, storage: new Map([['existing-save', 'unchanged']]), journal: ['existing-journal'] };
  h.node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    if (selector === '#tc .body') h.calls.push('renderTech');
    if (selector === '#cm .body') h.calls.push('renderCommission');
    return nodes.get(selector);
  };
  h.commissionBody = () => nodes.get('#cm .body');
  h.techBody = () => nodes.get('#tc .body');
  const tech = section(source, '  const TECH_ROUTES =', '  // 選城市方向');
  const commission = section(source, "  const cm = $<HTMLElement>('#cm');", '  // ☰ 選單：');
  const sync = section(source, '  function syncUi() {', '  // D040：資源圖。');
  const dependencies = { TECH343, TECH343_BY_ID, SPEC386, SPEC_IDS386, SPEC_MIN_RANK, techWhy, techFee,
    CMS_BY_ID385, NO_RIDERSHIP, cmsToast, commissionOffers, commissionState };
  const js = `"use strict";
    const {${Object.keys(dependencies).join(',')}} = d;
    let sim = x.sim, city = sim?.city ?? { name: 'read-only', gameVer: 1, day: 0, n: 1 };
    const $ = x.node, document = { createElement: tag => new x.Element(tag) };
    const own = (o, k) => Object.hasOwn(o, k);
    const localStorage = { getItem: k => x.storage.get(k), setItem: (k,v) => x.storage.set(k,v), removeItem: k => x.storage.delete(k) };
    const kickJournal = () => x.journal.push('unexpected write');
    const startResearch = (s, id) => { x.calls.push('research'); return x.startResearch(s, id); };
    const acceptCommission = (s, i) => { x.calls.push('accept'); return x.acceptCommission(s, i); };
    const dropCommission = s => { x.calls.push('drop'); return x.dropCommission(s); };
    const saveNow = () => { x.calls.push('save'); return true; };
    const bui = { toast: (...args) => { x.calls.push('toast'); x.toast = args; },
      setCommission: v => { x.calls.push('commission'); x.hud = v; }, setHud: () => x.calls.push('hud') };
    const uiSpec = () => { throw new Error('unexpected specialization action'); };
    const syncRes = () => x.calls.push('resources'), syncDock = () => x.calls.push('dock');
    const liveBuildings = () => [], powerStatus = () => ({ powered: 0, unpowered: 0, cap: 0 });
    const simCounts = () => ({ 1: [0,0,0], 2: [0,0,0], 3: [0,0,0] });
    const label = 'D051', loadDay = -1, autosaves = () => false, saveErr = '', jstore = true, jwhy = '';
    const saveWarnings = () => ({}), saveStatus = { setState() {} };
    ${stripTypeScriptTypes(tech)}
    ${stripTypeScriptTypes(commission)}
    ${stripTypeScriptTypes(sync)}
    Object.assign(x, { progress: cmProgress, sync: syncCommissionHud, render: renderCommission,
      uiTech, uiCommission, syncUi, open: openCommission,
      techRender: renderTech, route: r => { tcRoute = r; }, tip: () => tcTip,
      setSim: s => { sim = s; }, close: () => $('#cmX').click(),
      backdrop: target => cm.onclick({target: target === 'backdrop' ? cm : $('#cm .body')}) });
  `;
  new Function('x', 'd', js)(Object.assign(h, { Element, startResearch, acceptCommission, dropCommission }), dependencies);
  return h;
}

function simpleState() {
  return { day: 150, diff: 1, rankIdx: 3, pop: 51, money: 5000, cityHappy: .7,
    city: { name: 'D051', day: 150, n: 1 },
    cms: { act: 'techC6', st: 140, acc: 0, hold: 0, n: 0, done: [] },
    edu: { tech: [], spec: '' }, tech: { act: '', prog: {} }, techSpeed: 1, econ: { steel: 0, fuel: 0 } };
}
const cases = [
  ['idle, missing progress', '', {}, [], '尚未開始', 0],
  ['other research, missing target progress', 'A1', { A1: 25 }, [], '尚未開始', 0],
  ['zero target progress', 'A1', { C6: 0 }, [], '尚未開始', 0],
  ['target started at zero', 'C6', {}, [], '研究中', 0],
  ['target underway', 'C6', { C6: 50 }, [], '研究中', 0],
  ['paused target', '', { C6: 50 }, [], '待繼續', 0],
  ['switched to another target', 'A1', { C6: 50, A1: 12 }, [], '待繼續', 0],
  ['progress alone never means completed', 'A1', { C6: 115 }, [], '待繼續', 0],
  ['completed target, idle', '', {}, ['C6'], '已研究', 1],
  ['completion wins over stale active target', 'C6', { C6: 50 }, ['C6'], '已研究', 1],
  ['completed target while researching another', 'A1', { C6: 50 }, ['C6'], '已研究', 1],
];
function progressStates(source = city) {
  const s = simpleState(), h = harness(s, source), def = CMS_BY_ID385.techC6;
  for (const [name, act, prog, done, cur, p] of cases) {
    s.tech = { act, prog: { ...prog } }; s.edu.tech = [...done];
    const before = stateBytes(s);
    assert.deepEqual(h.progress(def), { cur, p }, name);
    h.sync();
    assert.deepEqual(h.hud, { label: '🔬 研究「學術網絡」', progress: cur, fraction: p, days: 190 }, name);
    assert.equal(stateBytes(s), before, 'read-only progress/HUD: ' + name);
  }
  s.edu.tech = []; s.tech = { act: '', prog: {} };
  assert.deepEqual(h.progress({ ...def, src: 'UNKNOWN' }), { cur: '尚未開始', p: 0 });
  s.cms.st = 1; s.day = 300; h.sync(); assert.equal(h.hud.days, 0);
  for (const act of ['', 'unknown-commission']) { s.cms.act = act; h.sync(); assert.equal(h.hud, null); }
  s.cms.act = 'techC6'; s.diff = 3; h.sync(); assert.equal(h.hud, null);
  h.setSim(null); h.sync(); assert.equal(h.hud, null);
}

function otherProgress(source = city) {
  const s = simpleState(), h = harness(s, source);
  // Expected text/fractions are frozen examples of the existing three behaviors,
  // including rounding below the target, floor inventory, overflow and legacy transit.
  const checks = [
    ['steel40', { acc: 12.345 }, {}, '12.35 / 40', 12.345 / 40],
    ['steel40', { acc: 39.999 }, {}, '39.99 / 40', 39.999 / 40],
    ['steel40', { acc: 40 }, {}, '40 / 40', 1],
    ['steel80', { acc: 99 }, {}, '80 / 80', 1],
    ['trade1200', { acc: 0 }, {}, '0 / 1200', 0],
    ['trade3000', { acc: 1499.5 }, {}, '1499.5 / 3000', 1499.5 / 3000],
    ['happy70', { hold: 12 }, {}, '12 / 30 天', .4],
    ['happy80', { hold: 46 }, {}, '46 / 45 天', 1],
    ['transit150', { hold: 0 }, {}, '0 / 30 天', 0],
    ['transit400', { hold: 22 }, {}, '22 / 45 天', 22 / 45],
    ['ct_steel60', {}, { steel: 59.99, fuel: 500 }, '59 / 60（期末驗收）', 59 / 60],
    ['ct_steel60', {}, { steel: 100 }, '100 / 60（期末驗收）', 1],
    ['ct_fuel80', {}, { fuel: 20.75, steel: 500 }, '20 / 80（期末驗收）', .25],
  ];
  for (const [id, cms, econ, cur, p] of checks) {
    Object.assign(s.cms, cms, { act: id }); Object.assign(s.econ, econ);
    const before = stateBytes(s);
    assert.deepEqual(h.progress(CMS_BY_ID385[id]), { cur, p }, id + ': ' + cur);
    h.sync(); assert.equal(h.hud.progress, cur); assert.equal(h.hud.fraction, p);
    assert.equal(stateBytes(s), before);
  }
}

function panelStates(source = city) {
  const s = simpleState(), h = harness(s, source);
  const instruction = '接受委託不會自動開始研究；請到「科技與專精」選 C6 開始或繼續研究。';
  for (const [name, act, prog, done, cur, p] of cases) {
    s.tech = { act, prog: { ...prog } }; s.edu.tech = [...done];
    h.calls.length = 0; const before = stateBytes(s);
    h.open();
    const rows = h.commissionBody().all(e => e.dataset.kind === 'act');
    assert.equal(rows.length, 1, name); const row = rows[0];
    assert.equal(row.children[0].children[1].textContent, cur, name);
    assert.equal(row.children[1].children[0].style.width, p ? '100%' : '0%', name);
    assert.equal(row.textContent.includes(instruction), !p && act !== 'C6', name);
    assert.match(row.textContent, /獎金 \$1,800｜剩餘 190 天（共 200 天）/);
    assert.deepEqual(row.all(e => e.tagName === 'button').map(e => e.textContent), ['🗑 放棄委託']);
    h.backdrop('content'); assert.equal(nodesGet(h, '#cm').hidden, false);
    h.backdrop('backdrop'); assert.equal(nodesGet(h, '#cm').hidden, true);
    h.open(); h.close(); assert.equal(nodesGet(h, '#cm').hidden, true);
    assert.ok(h.calls.every(c => c === 'renderCommission'), 'reading/closing never accepts, starts or saves');
    assert.equal(stateBytes(s), before, name);
  }
  for (const c of CMS385.filter(c => c.type !== 'tech')) {
    s.cms.act = c.id; s.tech.act = ''; s.edu.tech = []; h.render();
    assert.ok(!h.commissionBody().textContent.includes('接受委託不會自動開始研究'), c.id);
    assert.equal(h.commissionBody().textContent.includes('本線還沒有公共運量'), c.src === 'transit', c.id);
  }
  for (const setup of [() => { s.cms.act = ''; }, () => { s.diff = 3; },
    () => { s.diff = 1; s.rankIdx = 1; }, () => { s.rankIdx = 3; s.pop = 50; }]) {
    setup(); h.render(); assert.ok(!h.commissionBody().textContent.includes(instruction));
  }
}
const nodesGet = (h, key) => h.nodes.get(key);
function clickTech(h, id) {
  h.route(id[0]); h.techRender();
  const row = h.techBody().all(e => e.dataset.kind === 'tech' && e.dataset.k === id)[0];
  assert.ok(row, id + ' exists in the actual rendered route');
  const button = row.all(e => e.tagName === 'button')[0];
  assert.equal(button.disabled, false, id + ' is enabled');
  h.calls.length = 0; button.click();
}

function actionWiring(source = city) {
  // A synthetic, prerequisite-ready city proves the paid first start while paused.
  const paid = d045Load({ ...active(), tech343: { act: '', prog: {}, done: ['C5'] } }, 10000);
  const s = paid.sim, h = harness(s, source), day = s.day, money = s.money, history = s.city.history.length;
  h.syncUi(); assert.ok(h.hud, 'normal syncUi must publish the active commission'); assert.equal(h.hud.progress, '尚未開始');
  clickTech(h, 'C6');
  assert.deepEqual(h.calls, ['research', 'toast', 'save', 'renderTech', 'commission']);
  assert.equal(h.hud.progress, '研究中'); assert.equal(h.hud.fraction, 0);
  assert.equal(s.money, money - 5200); assert.equal(s.day, day);
  assert.deepEqual(s.city.history.slice(history), [{ day, t: 'research', id: 'C6', fee: 5200 }]);
  const stable = stateBytes(s); h.calls.length = 0; h.uiTech('C6');
  assert.deepEqual(h.calls, ['research', 'save', 'renderTech', 'commission']);
  assert.equal(stateBytes(s), stable, 'repeat preserves the existing save but never adds a fee/event');
  clickTech(h, 'A1');
  assert.deepEqual(h.calls, ['research', 'toast', 'save', 'renderTech', 'commission']);
  assert.equal(h.hud.progress, '尚未開始', 'switch away before any day has produced C6 points');
  assert.equal(s.money, money - 5600); assert.equal(s.day, day);

  const resumed = d045Load({ ...active(), tech343: { act: 'A1', prog: { C6: 50, A1: 5 }, done: ['C5'] } }, 10000);
  const r = resumed.sim, rh = harness(r, source), originalMoney = r.money;
  rh.syncUi(); assert.equal(rh.hud.progress, '待繼續');
  for (const [id, text] of [['C6', '研究中'], ['A1', '待繼續'], ['C6', '研究中']]) {
    clickTech(rh, id);
    assert.deepEqual(rh.calls, ['research', 'toast', 'save', 'renderTech', 'commission']);
    assert.equal(rh.hud.progress, text); assert.equal(rh.hud.fraction, 0);
    assert.equal(r.money, originalMoney); assert.equal(r.day, day);
  }
  for (const failed of [d045Load(active()).sim,
    d045Load({ ...active(), tech343: { act: 'A1', prog: {}, done: ['C5'] } }, 1).sim]) {
    const fh = harness(failed, source), bytes = stateBytes(failed);
    fh.hud = { progress: 'stale sentinel' }; fh.calls.length = 0;
    assert.equal(fh.uiTech('C6').ok, false);
    assert.deepEqual(fh.calls, ['research', 'renderTech', 'commission']);
    assert.equal(fh.hud.progress, '尚未開始', 'failed attempt must still refresh stale HUD');
    assert.ok(fh.tip().includes('學術網絡：')); assert.equal(stateBytes(failed), bytes);
    fh.calls.length = 0; assert.equal(fh.uiTech('UNKNOWN'), null); assert.deepEqual(fh.calls, []);
    fh.setSim(null); assert.equal(fh.uiTech('C6'), null); assert.deepEqual(fh.calls, []);
  }
}

function acceptReachability(source = city) {
  // Explicit boundary fixture only: original d045Load has no tech; set the offer
  // seed/rank/pop, then advance its round through real accept/drop actions.
  const L = d045Load(), s = L.sim;
  assert.deepEqual(s.tech, { act: '', prog: {} }); assert.deepEqual(s.edu.tech, []);
  Object.assign(s, { seed: 0, rankIdx: 3, pop: 51 });
  const h = harness(s, source), initialHistory = s.city.history.length;
  const money = s.money, start = stateBytes(s);
  const savedCms = structuredClone(s.cms), savedHistory = structuredClone(s.city.history);
  const clickOffer = id => {
    h.open(); const row = h.commissionBody().all(e => e.dataset.kind === 'offer' && e.dataset.k === id)[0];
    assert.ok(row, 'real offered ' + id); row.all(e => e.tagName === 'button')[0].click();
  };
  const first = commissionOffers(s)[0].id;
  clickOffer(first);
  h.commissionBody().all(e => e.tagName === 'button')[0].click();
  assert.equal(s.cms.n, 1); assert.equal(s.cms.act, '');
  assert.ok(commissionOffers(s).some(c => c.id === 'techC6'));
  clickOffer('techC6');
  assert.equal(s.cms.act, 'techC6'); assert.equal(s.cms.st, s.day);
  assert.equal(h.hud.progress, '尚未開始'); assert.equal(h.hud.fraction, 0); assert.equal(h.hud.days, 200);
  assert.equal(s.money, money); assert.deepEqual(s.tech, { act: '', prog: {} });
  assert.deepEqual(s.edu.tech, []); assert.ok(!h.calls.includes('research'));
  assert.deepEqual(s.city.history.slice(initialHistory), [
    { day: s.day, t: 'cms', ev: 'accept', id: first },
    { day: s.day, t: 'cms', ev: 'drop', id: first },
    { day: s.day, t: 'cms', ev: 'accept', id: 'techC6' },
  ]);
  assert.equal(stateBytes({ ...s, cms: savedCms, city: { ...s.city, history: savedHistory } }), start,
    'real offer acceptance/drop may change only cms and append cms history');
  const bytes = stateBytes(s); h.calls.length = 0;
  assert.equal(h.uiCommission('accept', 0), null);
  assert.equal(stateBytes(s), bytes); assert.ok(!h.calls.includes('save'));
}

function readonlyBytes(source = city) {
  const L = d045Load({ ...active(), tech343: { act: 'A1', prog: { C6: 50 }, done: ['C5'] } });
  const s = L.sim, h = harness(s, source), rngCalls = [];
  for (const key of ['R', 'ri']) {
    const original = s.rng[key]; s.rng[key] = (...args) => { rngCalls.push(key); return original(...args); };
  }
  const before = stateBytes(s), code = saveCode(s, L.template, L.start), storage = stateBytes(h.storage), journal = stateBytes(h.journal);
  for (let n = 0; n < 3; n++) { h.progress(CMS_BY_ID385.techC6); h.sync(); h.syncUi(); h.open(); h.close(); }
  assert.equal(stateBytes(s), before, 'all simulator bytes, world arrays, money and history are unchanged');
  assert.equal(saveCode(s, L.template, L.start), code, 'share-code bytes unchanged');
  assert.equal(stateBytes(h.storage), storage); assert.equal(stateBytes(h.journal), journal);
  assert.deepEqual(rngCalls, [], 'read-only UI must not consume hidden RNG state');
  assert.ok(h.calls.every(c => ['resources', 'hud', 'commission', 'dock', 'renderCommission'].includes(c)), 'no action/save from read-only UI');
}

function pairedDays() {
  const fields = { ...active(), tech343: { act: 'A1', prog: { C6: 110, A1: 5 }, done: ['C5'] } };
  const a = d045Load(fields, 10000), b = d045Load(fields, 10000), h = harness(a.sim);
  // Independent loads only at the start; never reload/reseed within the comparison.
  for (const id of ['C6', 'C6', 'A1', 'C6']) {
    assert.deepEqual(h.uiTech(id), startResearch(b.sim, id));
    assert.equal(stateBytes(a.sim), stateBytes(b.sim));
  }
  let payouts = 0;
  for (let n = 0; n < 20; n++) {
    h.open(); h.close(); h.sync();
    const ra = stepDay(a.sim), rb = stepDay(b.sim);
    assert.deepEqual(ra, rb, 'full daily report ' + n);
    assert.equal(stateBytes(a.sim), stateBytes(b.sim), 'all simulator fields after day ' + n);
    if (ra.commission?.t === 'done') { payouts++; assert.equal(ra.commission.id, 'techC6'); assert.equal(ra.commission.bonus, 1800); }
  }
  assert.equal(payouts, 1); assert.equal(a.sim.cms.act, ''); assert.ok(a.sim.cms.done.includes('techC6'));
  assert.equal(a.sim.city.history.filter(e => e.t === 'cms' && e.ev === 'done' && e.id === 'techC6').length, 1);
  assert.equal(saveCode(a.sim, a.template, a.start), saveCode(b.sim, b.template, b.start));
}

function mutations() {
  const list = [
    ['complete priority', "has ? '已研究'", "false ? '已研究'", progressStates],
    ['unrelated research', "s.tech.act === c.src ? '研究中'", "s.tech.act ? '研究中'", progressStates],
    ['zero progress', "(s.tech.prog[c.src] ?? 0) > 0 ? '待繼續'", "(s.tech.prog[c.src] ?? 0) >= 0 ? '待繼續'", progressStates],
    ['tech fraction', ': has ? 1 : 0;', ': has ? 1 : .5;', progressStates],
    ['overdue clamp', 'Math.max(0, activeCommission.days', 'Math.max(1, activeCommission.days', progressStates],
    ['acc premature completion', 'v < target ? target - .01 : target', 'target', otherProgress],
    ['hold denominator', 'st.hold / (c.holdN as number)', 'st.hold / (c.target as number)', otherProgress],
    ['stock rounding', "c.type === 'stock' ? Math.floor", "c.type === 'stock' ? Math.ceil", otherProgress],
    ['instruction removed', '${researchNote}', '', panelStates],
    ['instruction while researching', "p < 1 && s.tech.act !== c.src ?", "p < 1 && s.tech.act === c.src ?", panelStates],
    ['instruction after completion', "c.type === 'tech' && p < 1 &&", "c.type === 'tech' && p <= 1 &&", panelStates],
    ['instruction on wrong types', "c.type === 'tech' && p < 1 &&", "c.type !== 'tech' && p < 1 &&", panelStates],
    ['paused HUD removed', 'renderTech(); syncCommissionHud(); return r;', 'renderTech(); return r;', actionWiring],
    ['failed HUD stale', 'renderTech(); syncCommissionHud(); return r;', 'renderTech(); if (r.ok) syncCommissionHud(); return r;', actionWiring],
    ['research repeated', 'r = startResearch(sim, id);', 'r = (startResearch(sim, id), startResearch(sim, id));', actionWiring],
    ['save before research', 'r = startResearch(sim, id);', 'r = (saveNow(), startResearch(sim, id));', actionWiring],
    ['normal HUD removed', '    syncCommissionHud();\n    syncDock();', '    syncDock();', actionWiring],
    ['read changes funds', 'const s = sim!, st = s.cms', 'const s = sim!, st = (s.money--, s.cms)', readonlyBytes],
    ['read consumes RNG', 'const s = sim!, st = s.cms', 'const s = sim!, st = (s.rng.R(), s.cms)', readonlyBytes],
    ['read writes storage', 'const s = sim!, st = s.cms', "const s = sim!, st = (localStorage.setItem('existing-save', 'changed'), s.cms)", readonlyBytes],
    ['read writes journal', 'const s = sim!, st = s.cms', 'const s = sim!, st = (kickJournal(), s.cms)', readonlyBytes],
  ];
  for (const [name, from, to, check] of list) {
    const mutated = change(city, from, to);
    // A compile/runtime typo is not a killed behavioral mutation.
    assert.throws(() => check(mutated), e => e?.code === 'ERR_ASSERTION', name);
  }
  return list.length + ' valid source mutations rejected by behavioral assertions';
}

export function d051Guards(log) {
  const test = (name, fn) => { try { log(true, 'D051 ' + name, fn()); } catch (e) { log(false, 'D051 ' + name, e.stack); } };
  test('actual progress/HUD: four research states, completion priority, unknown/zero progress, no partial fraction', () => progressStates());
  test('all existing acc/hold/stock definitions retain exact text and fractions', () => otherProgress());
  test('actual commission DOM: instruction only when incomplete and not researching target; open/close stays read-only', () => panelStates());
  test('actual rendered tech buttons/uiTech: immediate paused HUD, paid/free/repeat/failed paths and original call order', () => actionWiring());
  test('real offers/accept/drop reach techC6 without prerequisites; acceptance only changes cms/history', () => acceptReachability());
  test('read-only functions preserve full state and share-code bytes, storage, journal and hidden RNG calls', () => readonlyBytes());
  test('UI/control research actions then 20 uninterrupted days: full states/reports equal; one $1,800 completion', () => pairedDays());
  test('independent actual-source behavioral mutations are detected', () => mutations());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let bad = 0;
  d051Guards((ok, name, detail) => { console.log(ok ? 'OK' : 'NG', name, detail ?? ''); if (!ok) bad++; });
  process.exitCode = bad ? 1 : 0;
}
