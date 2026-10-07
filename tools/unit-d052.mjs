// D052: execute the shipped cityView functions with browser/storage/rendering
// boundaries doubled. This is Node behavioral evidence, never native input,
// layout, Chrome, or Android evidence. Simulation/rules/save code are real.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { d045Load } from './d045-cities.mjs';
import { d038Runs } from './d038-cities.mjs';
import { mk } from './d034-cities.mjs';
import { builtBase } from './d036-cities.mjs';
import { loadCode, saveCode, SAVE_LIMIT } from '../src/io/save.ts';
import { packMore, PACK0 } from '../src/io/journal.ts';
import { liveBuildings } from '../src/sim/city.ts';
import { stepDay, simCounts } from '../src/sim/day.ts';
import { startResearch, chooseSpec, setPolicy, setBudget, powerStatus, canUndo, toolLock,
  ROAD_TOOLS, CIVIC_TOOLS, TOOL_PRICE, acceptCommission, dropCommission, commissionOffers, commissionState } from '../src/sim/edit.ts';
import { assignPower } from '../src/sim/rules/power.ts';
import { TECH343, TECH343_BY_ID, SPEC386, SPEC_IDS386, SPEC_MIN_RANK, techWhy, techFee } from '../src/sim/rules/tech.ts';
import { CMS_BY_ID385, NO_RIDERSHIP, cmsToast } from '../src/sim/rules/commission.ts';
import { POLICY_CATALOG, POLICY_SHOWN, POLICY_FEE, BUDGET_CATS, BUDGET_STEP, INSURANCE_TOAST, cooldownLeft, stepTax } from '../src/sim/rules/policy.ts';
import { upRegOf } from '../src/sim/rules/money.ts';
import { CITY_EVENTS } from '../src/sim/rules/events.ts';
import { RANKS } from '../src/sim/rules/rank.ts';
import { rankBuildNote } from '../src/ui/growthGuide.ts';
import { depletedToastText } from '../src/sim/decisions.ts';
import { mergesToastText } from '../src/sim/rules/merge.ts';
import { MEGA_POP, MEGA_JOBS } from '../src/sim/rules/jobs.ts';

const city = fs.readFileSync(path.join(ROOT, 'src/cityView.ts'), 'utf8');
const panelSource = fs.readFileSync(path.join(ROOT, 'src/ui/panelContent.ts'), 'utf8');
const pressPath = path.join(ROOT, 'src/ui/panelPress.ts');
const pressSource = fs.existsSync(pressPath) ? fs.readFileSync(pressPath, 'utf8') : '';
const section = (s, from, to) => {
  assert.equal(s.split(from).length, 2, 'unique source boundary: ' + from);
  const a = s.indexOf(from), b = s.indexOf(to, a);
  assert.ok(b > a, 'closing source boundary: ' + to);
  return s.slice(a, b);
};
const replaceSection = (s, from, to, replacement) => s.replace(section(s, from, to), () => replacement);
const change = (s, from, to) => {
  assert.equal(s.split(from).length, 2, 'unique behavioral mutation: ' + from);
  return s.replace(from, () => to);
};
// Every enumerable model field, Map/Set entry and typed-array byte is included.
// RNG closure state is covered separately by call tracing AND uninterrupted days.
const stateBytes = s => JSON.stringify(s, (_k, v) => {
  if (v instanceof Map) return { map: [...v] };
  if (v instanceof Set) return { set: [...v] };
  if (ArrayBuffer.isView(v)) return { type: v.constructor.name, bytes: [...new Uint8Array(v.buffer, v.byteOffset, v.byteLength)] };
  if (v instanceof ArrayBuffer) return { bytes: [...new Uint8Array(v)] };
  if (typeof v === 'function') return { function: String(v) };
  if (typeof v === 'number' && !Number.isFinite(v)) return { number: String(v) };
  return v;
});

// A small DOM boundary with real move/remove/text/attribute ownership semantics.
// In particular replaceChildren detaches descendants and clears their focus;
// tests cannot accidentally pass a destructive redraw by retaining fake focus.
// Boolean identity assertions avoid formatting the cyclic DOM on expected mutation failures.
const sameNode = (actual, expected, why = 'same DOM node') => assert.ok(actual === expected, why);
class TextNode {
  constructor(text, doc) { this.nodeType = 3; this.data = String(text); this.ownerDocument = doc; this.parentNode = null; }
  get textContent() { return this.data; }
  get nodeName() { return '#text'; }
  set textContent(v) { this.data = String(v); }
  get nodeValue() { return this.data; }
  set nodeValue(v) { this.data = String(v); }
  get nextSibling() { const a = this.parentNode?.childNodes ?? []; return a[a.indexOf(this) + 1] ?? null; }
  remove() { this.parentNode?.removeChild(this); }
}
class EventTargetDouble {
  constructor(){this.listeners=new Map();}
  addEventListener(type,fn,options=false){const list=this.listeners.get(type)??[];list.push({fn,capture:typeof options==='boolean'?options:!!options.capture});this.listeners.set(type,list);}
  removeEventListener(type,fn,options=false){const capture=typeof options==='boolean'?options:!!options.capture;this.listeners.set(type,(this.listeners.get(type)??[]).filter(l=>l.fn!==fn||l.capture!==capture));}
  fire(event,capture){for(const l of [...(this.listeners.get(event.type)??[])])if(l.capture===capture){event.currentTarget=this;l.fn.call(this,event);}}
}
class Element extends EventTargetDouble {
  constructor(tag = 'div', doc) {
    super();
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.parentNode = null;
    this.childNodes = []; this.attrs = new Map(); this.styleValues = {};
    this.style = new Proxy(this.styleValues, { set: (t,k,v) => { t[k]=String(v); this.attrs.set('style',Object.entries(t).map(([k,v])=>`${k}: ${v};`).join(' ')); return true; } });
    this.hidden = false;
    this.disabled = false; this.onclick = null; this.scrollTop = 0; this.scrollLeft = 0;
    const key = k => 'data-' + String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase());
    this.dataset = new Proxy({}, { get: (_t, k) => this.getAttribute(key(k)) ?? undefined,
      set: (_t, k, v) => { this.setAttribute(key(k), v); return true; } });
    this.classList = { add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
      contains: n => this.className.split(/\s+/).includes(n) };
  }
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get nodeName() { return this.tagName; }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { if(v)this.setAttribute('disabled','');else this.removeAttribute('disabled'); }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(v) { if(v)this.setAttribute('hidden','');else this.removeAttribute('hidden'); }
  get type() { return this.getAttribute('type') ?? ''; }
  set type(v) { this.setAttribute('type',v); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes.at(-1) ?? null; }
  get nextSibling() { const a = this.parentNode?.childNodes ?? []; return a[a.indexOf(this) + 1] ?? null; }
  get parentElement() { return this.parentNode; }
  get isConnected() { for(let n=this;n;n=n.parentNode)if(n===this.ownerDocument.body)return true;return false; }
  get className() { return this.getAttribute('class') ?? ''; }
  set className(v) { this.setAttribute('class', v); }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
    if(k==='style'){for(const key of Object.keys(this.styleValues))delete this.styleValues[key];for(const part of String(v).split(';')){const [key,value]=part.split(':');if(key?.trim()&&value)this.styleValues[key.trim()]=value.trim();}}
  }
  removeAttribute(k) { this.attrs.delete(k);if(k==='style')for(const key of Object.keys(this.styleValues))delete this.styleValues[key]; }
  hasAttribute(k) { return this.attrs.has(k); }
  matches(selector) { return selector==='button'?this.tagName==='BUTTON':selector==='[hidden]'?this.hidden:false; }
  closest(selector) { for(let n=this;n;n=n.parentNode)if(n.matches?.(selector))return n;return null; }
  get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
  set textContent(v) { this.replaceChildren(...(String(v) ? [this.ownerDocument.createTextNode(v)] : [])); }
  set innerHTML(_) { throw new Error('D052 never interprets HTML'); }
  contains(node) { return node === this || this.children.some(c => c.contains(node)) || this.childNodes.includes(node); }
  appendChild(node) { return this.insertBefore(node, null); }
  append(...nodes) { for (const n of nodes) this.appendChild(typeof n === 'string' ? this.ownerDocument.createTextNode(n) : n); }
  insertBefore(node, ref) {
    if (node === ref) return node;
    if (ref !== null) assert.ok(this.childNodes.includes(ref), 'reference child belongs to parent');
    const moved = !!node.parentNode;
    node.parentNode?.removeChild(node);
    this.childNodes.splice(ref === null ? this.childNodes.length : this.childNodes.indexOf(ref), 0, node);
    node.parentNode = this;
    // Exercise the fallback's scroll restoration against a possible reflow. This
    // is a boundary double, not a claim about measured browser scroll anchoring.
    if(moved){this.scrollTop=0;this.scrollLeft=0;}
    return node;
  }
  moveBefore(node, ref) {
    sameNode(node.parentNode,this,'atomic path is only for an already-parented row');
    if(node===ref)return;
    if(ref!==null)assert.ok(this.childNodes.includes(ref));
    // Native state-preserving move: no detach, blur or loss of pointer capture.
    this.childNodes.splice(this.childNodes.indexOf(node),1);
    this.childNodes.splice(ref===null?this.childNodes.length:this.childNodes.indexOf(ref),0,node);
    this.ownerDocument.atomicMoves++;return undefined;
  }
  removeChild(node) {
    assert.ok(this.childNodes.includes(node), 'removed child belongs to parent');
    if (node === this.ownerDocument.activeElement || node.contains?.(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = null;
    for(const [id,target]of this.ownerDocument.captures){if(target===node||node.contains?.(target)){this.ownerDocument.captures.delete(id);this.ownerDocument.captureLosses.push(id);}}
    this.childNodes.splice(this.childNodes.indexOf(node), 1); node.parentNode = null; return node;
  }
  replaceChildren(...nodes) { for (const c of [...this.childNodes]) this.removeChild(c); this.append(...nodes); }
  replaceWith(node) { const parent = this.parentNode; parent?.insertBefore(node, this); parent?.removeChild(this); }
  remove() { this.parentNode?.removeChild(this); }
  all(fn) { return this.children.flatMap(c => [...(fn(c) ? [c] : []), ...c.all(fn)]); }
  focus(options) {
    this.ownerDocument.activeElement = this;
    this.ownerDocument.focusCalls.push(options);
    if(!options?.preventScroll)for(let p=this.parentNode;p;p=p.parentNode){p.scrollTop=0;p.scrollLeft=0;}
  }
  setPointerCapture(id) { this.ownerDocument.captures.set(id,this); }
  hasPointerCapture(id) { return this.ownerDocument.captures.get(id)===this; }
  releasePointerCapture(id) { this.ownerDocument.captures.delete(id); }
  click() { if (!this.disabled) return this.ownerDocument.emit('click',{target:this}); }
}
function domDocument({ atomic = true } = {}) {
  const doc=Object.assign(new EventTargetDouble(),{activeElement:null,captures:new Map(),captureLosses:[],atomicMoves:0,focusCalls:[],visibilityState:'visible',
    createElement:tag=>{const e=new Element(tag,doc);if(!atomic)e.moveBefore=undefined;return e;},createTextNode:text=>new TextNode(text,doc)});
  doc.defaultView=new EventTargetDouble();doc.body=doc.createElement('body');
  let timerId=0;doc.timers=new Map();doc.setTimeout=fn=>{doc.timers.set(++timerId,fn);return timerId;};doc.clearTimeout=id=>doc.timers.delete(id);
  doc.runTimers=()=>{const ready=[...doc.timers];doc.timers.clear();for(const [,fn]of ready)fn();};
  doc.defaultView.setTimeout=doc.setTimeout;doc.defaultView.clearTimeout=doc.clearTimeout;
  doc.emit=(type,fields={})=>{
    const target=fields.target??doc,event={type,target,pointerId:1,pointerType:'touch',button:0,isTrusted:true,defaultPrevented:false,...fields,
      preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},composedPath(){return path;}};
    const path=[];for(let node=target;node;node=node.parentNode)path.push(node);
    if(!path.includes(doc)&&target!==doc.defaultView)path.push(doc);if(!path.includes(doc.defaultView))path.push(doc.defaultView);
    for(const node of [...path].reverse()){node.fire?.(event,true);if(event.stopped)return;}
    let result;for(const node of path){node.fire?.(event,false);if(typeof node['on'+type]==='function'){const value=node['on'+type](event);if(node===target)result=value;}if(event.stopped)break;}
    return result;
  };
  return doc;
}

// Frozen original action handlers from main c1ac6154, not reimplemented simulator
// rules. The paired control uses these original handlers with the same boundary
// doubles/saveNow. Rendering remains the candidate's read-only presentation.
const ORIGINAL_ACTIONS = {
  "uiPolicy": "  function uiPolicy(k: string, value: unknown) {\n    if (!sim || !own(POLICY_CATALOG, k)) return null;\n    const cfg = POLICY_CATALOG[k], old = polVal(k), left = cooldownLeft(sim.polLast, sim.day, k), r = setPolicy(sim, k, value);\n    if (r.ok) {\n      const now = polVal(k); plTip = '';\n      bui.toast(`📜 ${cfg.nm}：${cfg.type === 'tax' ? `${(old as number).toFixed(1)}× → ${(now as number).toFixed(1)}×` : now ? '開啟' : '關閉'}`, 'gold');\n      saveNow();\n    } else plTip = left > 0 ? `${cfg.nm}：冷卻中，還剩 ${left} 天才能再調（防止每天開關；實驗線是靜默不動）` : cfg.type === 'tax' ? `${cfg.nm}已經是 ${(old as number).toFixed(1)}×（範圍 0.5–2.0×）` : '';\n    renderPolicy();\n    return r;\n  }\n",
  "uiBudget": "  function uiBudget(cat: string, dir: 1 | -1) {\n    if (!sim) return false;\n    const c = BUDGET_CATS.find(q => q.id === cat); if (!c || !setBudget(sim, cat, dir * BUDGET_STEP)) return false;\n    bui.toast(`🎚️ ${c.nm}預算 ×${sim.budget[c.id].toFixed(1)}${dir > 0 ? '（覆蓋更廣、更貴）' : '（省錢、覆蓋縮水）'}`); plTip = '';\n    saveNow(); renderPolicy();\n    return true;\n  }\n",
  "uiTech": "  function uiTech(id: string) {\n    if (!sim || !own(TECH343_BY_ID, id)) return null;\n    const n = TECH343_BY_ID[id], was = sim.tech.act, r = startResearch(sim, id);\n    if (r.ok) {\n      tcTip = ''; if (was !== id) bui.toast(`🔬 開始研究：${n.nm}${r.fee > 0 ? `（−$${r.fee.toLocaleString()}）` : ''}`, 'gold');\n      saveNow();\n    } else tcTip = `${n.nm}：${r.why ?? '開始不了'}`;\n    renderTech(); syncCommissionHud(); return r;\n  }\n"
};
const ACTION_SHA = {
  "uiPolicy": "2a841ba6516fc3aaaf0c18c039451e37628a660a97c61ed395e21a712bac290f",
  "uiBudget": "61176138a5294a7abe0d2262afd034133ab1f25675d0761205fc611187cb0c8f",
  "uiTech": "7c5af0f505e233cdf92affe9e9b198dd6610a17ea3c4203707b93aa7d3916e86"
};
function originalActions(source) {
  for (const [name, body] of Object.entries(ORIGINAL_ACTIONS)) {
    const end = { uiPolicy: '  // 服務預算', uiBudget: '  function openPolicy()', uiTech: '  // 選城市方向' }[name];
    source = replaceSection(source, '  function ' + name + '(', end, body);
  }
  return source;
}

function harness(fixture, source = city, options = {}) {
  const doc = domDocument({atomic:options.atomic!==false});
  const h = { fixture, sim: fixture.sim, nodes: new Map(), doc, calls: [], toasts: [], storage: new Map([['existing-save', 'unchanged']]),
    journal: [], rngCalls: [], options: { autosave: true, ...options }, reports: [] };
  h.node = selector => {
    if (!h.nodes.has(selector)) {
      const e=doc.createElement(/X$/.test(selector)?'button':'div');h.nodes.set(selector,e);
      const child=selector.match(/^#(pl|tc|cm)(?:\s|X)/);
      if(child)h.node('#'+child[1]).append(e);else{e.hidden=true;doc.body.append(e);}
    }
    if (selector === '#tc .body') h.calls.push('renderTech');
    if (selector === '#cm .body') h.calls.push('renderCommission');
    return h.nodes.get(selector);
  };
  for (const key of ['R', 'ri']) {
    const original = fixture.sim.rng[key];
    fixture.sim.rng[key] = (...args) => { h.rngCalls.push([key, args]); return original(...args); };
  }
  const dependencies = { TECH343, TECH343_BY_ID, SPEC386, SPEC_IDS386, SPEC_MIN_RANK, techWhy, techFee,
    CMS_BY_ID385, NO_RIDERSHIP, cmsToast, commissionOffers, commissionState, chooseSpec,
    POLICY_CATALOG, POLICY_SHOWN, POLICY_FEE, BUDGET_CATS, BUDGET_STEP, INSURANCE_TOAST, cooldownLeft, stepTax, upRegOf,
    saveCode, SAVE_LIMIT, packMore, PACK0, liveBuildings, simCounts, powerStatus, canUndo, toolLock, ROAD_TOOLS, CIVIC_TOOLS, TOOL_PRICE,
    CITY_EVENTS, RANKS, rankBuildNote, depletedToastText, mergesToastText, MEGA_POP, MEGA_JOBS,
  };
  const chunks = [
    section(source, '  function saveNow() {', '  // D013：把還沒確定'),
    section(source, '  function kickJournal() {', "  addEventListener('visibilitychange'"),
    section(source, "  const pl = $<HTMLElement>('#pl');", '  // D038：'),
    section(source, "  const tc = $<HTMLElement>('#tc');", '  // D039：☰'),
    section(source, '  function openTech() {', '  // D045：'),
    section(source, "  const cm = $<HTMLElement>('#cm');", '  // ☰ 選單：'),
    section(source, '  function syncUi() {', '  // D040：資源圖。'),
    section(source, '  function syncDock() {', '  // 分區格的中心'),
    section(source, '  function simDay() {', '  function setPlaying'),
    section(source, '  function advance(dtFixed?: number)', '  // 換下來的場景'),
  ];
  const js = `"use strict";
    const {${Object.keys(dependencies).join(',')}} = d;
    const HTMLElement = x.Element, Element = x.Element;
    ${stripTypeScriptTypes(options.panelSource ?? panelSource).replace('export function updatePanelContent','function updatePanelContent')}
    let sim = x.sim, city = sim.city, lastRep = null;
    const $ = x.node, document = x.doc, window = document.defaultView, own = (o,k) => Object.hasOwn(o,k);
    const setTimeout = document.setTimeout, clearTimeout = document.clearTimeout;
    const addEventListener = window.addEventListener.bind(window), removeEventListener = window.removeEventListener.bind(window);
    ${stripTypeScriptTypes(options.pressSource ?? pressSource).replace('export function createPanelUpdateGate','function createPanelUpdateGate')}
    const startResearch = (s,id) => { x.calls.push('research'); return x.startResearch(s,id); };
    const setPolicy = (s,k,v) => { x.calls.push('policy'); return x.setPolicy(s,k,v); };
    const setBudget = (s,k,v) => { x.calls.push('budget'); return x.setBudget(s,k,v); };
    const acceptCommission = (s,i) => { x.calls.push('accept'); return x.acceptCommission(s,i); };
    const dropCommission = s => { x.calls.push('drop'); return x.dropCommission(s); };
    const stepDay = s => { x.calls.push('stepDay'); const r = x.stepDay(s); x.reports.push(r); return r; };
    const bui = { toast: (...v) => { x.calls.push('toast'); x.toasts.push(v); },
      setHud: v => { x.calls.push('hud'); x.hud = v; }, setCommission: v => { x.calls.push('commission'); x.commission = v; },
      setDock: v => { x.calls.push('dock'); x.dock = v; }, setDay: v => { x.dayText = v; }, setCoach: v => { x.coach = v; } };
    const localStorage = { getItem: k => x.storage.get(k), removeItem: k => x.storage.delete(k), setItem: (k,v) => {
      x.calls.push('storageWrite'); if (x.options.quota) throw Object.assign(new Error('quota'), {name:'QuotaExceededError'}); x.storage.set(k,v);
    } };
    const template = x.fixture.template, startCode = x.fixture.start, SAVE_KEY = 'gt3d.v1.save';
    const autosaves = () => x.options.autosave;
    const store = { append: (id, from, rows) => ({ then: (ok, bad) => {
      x.calls.push('journalAppend'); if (x.options.journal === 'fail') bad(new Error('fixture journal unavailable'));
      else { assertJournal(from); x.journal.push(...rows); ok(); }
    } }) };
    const assertJournal = from => { if (from !== x.journal.length) throw new Error('journal append offset'); };
    let jstore = x.options.journal ? store : null, jid = x.options.journal ? 'd052-journal' : '', jwhy = '', jConf = PACK0, jBusy = false, jSaved = 0;
    const dropped = new Set(); let daysSinceSave = 0, saveErr = '', sampleId = 'mine';
    const label = 'D052', loadDay = sim.day, clean = false, tool = null, roadTool = 'road', civicTool = 'power';
    const saveWarnings = () => ({ error: saveErr }), saveStatus = { setState: s => { x.saveStatus = s; } };
    // D053 unrelated closed navigation surfaces are DOM boundary doubles.
    const rk = { hidden: true }, catalog = { root: { hidden: true } }, renderRank = () => {};
    const syncRes = () => x.calls.push('resources'), timing = {}, focusTile = () => {};
    const ALERT_TEXT = new Proxy({}, { get: () => () => 'unrelated hazard notification' });
    let playing = true, lastT = 0, simAcc = 0, visT = 0, speed = 0, dirtyScene = false, urgentRebuild = false, daysSinceBuild = 0;
    const SPEEDS = [1], SAVE_DAYS = 5, REBUILD_DAYS = 5, con = null, siteInfo = { tris:0 };
    const needBody = () => false, rebuildScene = () => { x.calls.push('scene'); daysSinceBuild = 0; dirtyScene = false; urgentRebuild = false; }, syncCon = () => {}, invalidate = () => {};
    ${chunks.map(c => stripTypeScriptTypes(c)).join('\n')}
    const originalSave = saveNow; saveNow = () => { x.calls.push('save'); return originalSave(); };
    Object.assign(x, { uiTech, uiSpec, uiPolicy, uiBudget, uiCommission, syncUi, syncDock, coachText, saveNow,
      openTech, renderTech, openPolicy, renderPolicy, openCommission, renderCommission, simDay, advance,
      route: r => { tcRoute = r; }, setSim: s => { sim = s; }, tip: () => tcTip, pick: () => tcPick,
      lastReport: () => lastRep, saveError: () => saveErr, journalState: () => ({jwhy,jConf,jBusy,jSaved,enabled:!!jstore}) });
    if (typeof closeDecisionPanels === 'function') x.closeDecisionPanels = closeDecisionPanels;
  `;
  new Function('x', 'd', js)(Object.assign(h, { Element, startResearch, setPolicy, setBudget, acceptCommission, dropCommission, stepDay }), dependencies);
  return h;
}

const active = (id = 'techC6') => ({ cms385: { act: id, st: 140, acc: 0, hold: 0, n: 0, done: [] } });
const count = (h, name) => h.calls.filter(c => c === name).length;
const rows = (h, panel, kind) => h.node('#' + panel + ' .body').all(e => e.dataset.kind === kind);
const row = (h, panel, kind, id) => {
  const found = rows(h, panel, kind).find(e => e.dataset.k === id);
  assert.ok(found, `${panel} ${kind} row ${id}`); return found;
};
const buttons = e => e.all(c => c.tagName === 'BUTTON');
const techRow = (h, id) => { h.route(id[0]); h.renderTech(); return row(h, 'tc', 'tech', id); };
const clickTech = (h, id) => { const b = buttons(techRow(h, id))[0]; assert.equal(b.disabled, false, id + ' actionable'); h.calls.length = 0; return b.click(); };
const resetCalls = (...hs) => hs.forEach(h => { h.calls.length = 0; h.rngCalls.length = 0; });
const pair = (make, source = city, options = {}) => {
  const a = harness(make(), source, options), b = harness(make(), originalActions(source), options);
  a.syncUi(); b.syncUi(); resetCalls(a,b); return [a,b];
};
function equalModels(a, b, why) {
  assert.equal(stateBytes(a.sim), stateBytes(b.sim), why + ': all model/Map/typed-array/history bytes');
  assert.equal(saveCode(a.sim, a.fixture.template, a.fixture.start), saveCode(b.sim, b.fixture.template, b.fixture.start), why + ': serialized save bytes');
  assert.deepEqual(a.rngCalls, b.rngCalls, why + ': hidden RNG consumption');
  assert.equal(stateBytes(a.storage), stateBytes(b.storage), why + ': storage bytes');
  assert.equal(stateBytes(a.journal), stateBytes(b.journal), why + ': journal rows');
  for (const call of ['research','policy','budget','accept','drop','stepDay','save','storageWrite','journalAppend']) assert.equal(count(a,call), count(b,call), why + ': original ' + call + ' count');
}
function pausedMoney(source = city) {
  for (const options of [{}, { quota:true }, { journal:'fail' }, { journal:'ok' }]) {
    const [h,c] = pair(() => d045Load({ ...active(), tech343:{act:'',prog:{},done:['C5']} },10000),source,options);
    const day = h.sim.day, history = h.sim.city.history.length;
    for (const [id,fee] of [['C6',5200],['C6',0],['A1',400]]) {
      const money = h.sim.money; resetCalls(h,c);
      if (id !== h.sim.tech.act) clickTech(h,id); else h.uiTech(id);
      c.uiTech(id); equalModels(h,c,'paused ' + id + ' ' + JSON.stringify(options));
      assert.equal(h.sim.money,money-fee); assert.equal(h.hud.money,h.sim.money,'money HUD matches paid/repeat action before return');
      assert.equal(h.sim.day,day); assert.equal(count(h,'research'),1);
      assert.equal(count(h,'save'),options.journal === 'fail' && id === 'C6' && fee ? 2 : 1,'existing fallback/success save cadence');
      assert.match(h.node('#tc .sub').textContent,new RegExp(Math.floor(h.sim.money).toLocaleString()));
      assert.equal(h.commission.progress,id === 'C6'?'研究中':'尚未開始');
    }
    assert.deepEqual(h.sim.city.history.slice(history).map(e=>[e.t,e.id,e.fee]),[['research','C6',5200],['research','A1',400]]);
    if (options.quota) { assert.match(h.saveError(),/儲存空間/); h.options.quota = c.options.quota = false; }
    resetCalls(h,c); assert.equal(h.saveNow(),true); assert.equal(c.saveNow(),true); equalModels(h,c,'later successful save');
    h.node('#tcX').click(); h.openTech(); assert.equal(h.hud.money,h.sim.money); equalModels(h,c,'close/reopen only');
  }
  const [h,c] = pair(() => d045Load({ ...active(),tech343:{act:'A1',prog:{A1:5,C6:50},done:['C5']} },10000),source);
  for (const id of ['C6','A1','C6']) { resetCalls(h,c); clickTech(h,id); c.uiTech(id); equalModels(h,c,'free resumed ' + id); assert.equal(h.hud.money,10000); }
  const [zero,zeroControl] = pair(()=>d045Load({tech343:{act:'',prog:{},done:['C5']}},20000),source);
  for(const [id,fee]of [['C6',5200],['A1',400],['C6',5200]]){
    const money=zero.sim.money;resetCalls(zero,zeroControl);clickTech(zero,id);zeroControl.uiTech(id);equalModels(zero,zeroControl,'zero-progress switch/return '+id);
    assert.equal(money-zero.sim.money,fee,'zero progress keeps inherited first-start fee on return');assert.equal(zero.hud.money,zero.sim.money);
  }
  const failures = [
    [{},399,'A1'], [{},10000,'C6'], [{tech343:{act:'',prog:{},done:['A1','A2','A3','A4a']}},10000,'A4b'],
    [{},10000,'D8'], [{tech343:{act:'',prog:{},done:['A1']}},10000,'A1'],
  ];
  for (const [extra,money,id] of failures) {
    const [a,b] = pair(()=>d045Load(extra,money),source); a.hud.money = -1;
    const r = a.uiTech(id); assert.equal(r.ok,false); assert.deepEqual(r,b.uiTech(id)); equalModels(a,b,'rejected '+id);
    assert.equal(a.hud.money,a.sim.money,'failed action refreshes stale display'); assert.equal(count(a,'save'),0);
    assert.ok(a.tip().includes(r.why));
  }
  const [a,b] = pair(()=>d045Load({df:3},100),source,{autosave:false});
  clickTech(a,'A1'); b.uiTech('A1'); equalModels(a,b,'sandbox'); assert.equal(a.sim.money,100); assert.equal(count(a,'save'),1); assert.equal(count(a,'storageWrite'),0);
  resetCalls(a,b); assert.equal(a.uiTech('UNKNOWN'),null); a.setSim(null); assert.equal(a.uiTech('A1'),null); assert.equal(a.calls.length,0);
}

function capacityFixture(on = false) {
  const {KT,vrank} = builtBase();
  const code = mk(5167052,50,'D052 paused capacity',b => {
    b.road(4,30,60,30,3).put(3,30,5); b.flagRect('zn',5,29,43,29,1); b.flagRect('zn',5,31,43,31,1); b.flag('zn',43,31,2);
    for(let x=5;x<=43;x++){ b.put(x,29,1); b.put(x,31,x===43?2:1); }
  },{money:10000,pol:on?{ecoReg:true}:null});
  const f = loadCode(code,KT,vrank); assert.equal(f.ok,true);
  // Initial synthetic assignment is explicit. No powerStatus calls are made by
  // snapshot assertions: that function recomputes road rp and is not a pure probe.
  powerStatus(f.sim); assignPower(f.sim.w,[...f.sim.root.values()].map(b=>b.z*f.sim.w.N+b.x),on?80:75);
  return f;
}
function policyCapacity(source = city) {
  for (const on of [false,true]) {
    const [h,c] = pair(()=>capacityFixture(on),source), s = h.sim, day = s.day, money = s.money;
    const flags = s.w.tiles.map(t=>t.bld?.pw), history = s.city.history.length;
    assert.deepEqual(h.hud.power,[78,on?80:75]); assert.equal(!!h.coach,!on);
    h.openPolicy(); c.openPolicy(); resetCalls(h,c);
    buttons(row(h,'pl','toggle','ecoReg'))[0].click(); c.uiPolicy('ecoReg',!on);
    equalModels(h,c,'ecoReg accepted '+!on); assert.deepEqual(h.hud.power,[78,on?75:80],'capacity HUD refreshes paused');
    assert.equal(!!h.coach,on,'coach and capacity agree'); assert.equal(s.day,day); assert.equal(s.money,money);
    assert.deepEqual(s.w.tiles.map(t=>t.bld?.pw),flags,'accepted setting does not assign power before next day');
    assert.equal(s.city.history.length,history+1); assert.equal(count(h,'save'),1); assert.equal(count(h,'stepDay'),0);
    resetCalls(h,c); assert.deepEqual(h.uiPolicy('ecoReg',on),c.uiPolicy('ecoReg',on)); equalModels(h,c,'cooldown rejected'); assert.equal(count(h,'save'),0);
    assert.match(h.node('#pl .tip').textContent,/冷卻/);
  }
  for (const [k,v] of [['schoolLunch',true],['taxR',1.1],['taxR',1],['recycle',true]]) {
    const [h,c] = pair(()=>d045Load({},10000),source); assert.deepEqual(h.uiPolicy(k,v),c.uiPolicy(k,v)); equalModels(h,c,'policy control '+k);
  }
}

function budgetBoundaries(source = city) {
  for (const {id} of BUDGET_CATS) for (const [bound,dir] of [[1.5,1],[.5,-1]]) {
    const make = () => d045Load({sb:{police:1,fire:1,health:1,edu:1,[id]:bound}},10000);
    const [h,c] = pair(make,source), n = h.sim.city.history.length;
    // Existing recoverCov behavior must still execute at an unchanged clamp.
    for (const q of [h,c]) { q.sim.landDirty=true; q.sim.landBox=[2,3,4,5]; q.sim.stale.fill(1); q.openPolicy(); }
    resetCalls(h,c); buttons(row(h,'pl','budget',id))[dir>0?1:0].click(); c.uiBudget(id,dir);
    equalModels(h,c,id+' clamp '+bound); assert.equal(h.sim.budget[id],bound); assert.equal(h.sim.city.history.length,n);
    assert.equal(count(h,'budget'),1); assert.equal(count(h,'save'),1); assert.equal(h.sim.landDirty,false); assert.equal(h.sim.landBox,null); assert.ok(h.sim.stale.every(v=>v===0));
    const msg = h.toasts.at(-1)[0]; assert.match(msg,dir>0?/上限/:/下限/); assert.doesNotMatch(msg,/覆蓋更廣|更貴|省錢|覆蓋縮水/);
    resetCalls(h,c); assert.equal(h.uiBudget(id,-dir),true); c.uiBudget(id,-dir); equalModels(h,c,id+' adjacent change');
    assert.equal(h.sim.budget[id],+(bound-dir*.1).toFixed(1)); assert.equal(h.sim.city.history.length,n+1);
    assert.match(h.toasts.at(-1)[0],dir>0?/省錢.*覆蓋縮水/:/覆蓋更廣.*更貴/);
  }
  const [h,c] = pair(()=>d045Load({pol:{schoolLunch:true},sb:{police:1,fire:1,health:1,edu:1.5}},10000),source);
  const before = stateBytes(h.sim.g.EDU), n = h.sim.city.history.length;
  h.uiBudget('edu',1); c.uiBudget('edu',1); equalModels(h,c,'loaded schoolLunch clamp coverage quirk');
  assert.notEqual(stateBytes(h.sim.g.EDU),before,'unchanged budget still rebuilds loaded schoolLunch coverage');
  assert.equal(h.sim.budget.edu,1.5); assert.equal(h.sim.city.history.length,n); assert.equal(count(h,'save'),1);
  resetCalls(h,c); assert.equal(h.uiBudget('UNKNOWN',1),false); assert.equal(h.calls.length,0);
}

function feeTruth(source = city) {
  const cases = [
    ['paid',{},'A1',400,/開始/],
    ['resumed',{tech343:{act:'B1',prog:{A1:5},done:[]}},'A1',0,/繼續|續研|進度/],
    ['sandbox',{df:3},'A1',0,/沙盒/],
    ['active-zero',{tech343:{act:'A1',prog:{},done:[]}},'A1',0,/研究中/],
    ['done',{tech343:{act:'',prog:{},done:['A1']}},'A1',0,/已完成|✔/],
    ['locked',{},'C6',5200,/前置|先/],
  ];
  for (const [name,extra,id,fee,why] of cases) {
    const h = harness(d045Load(extra,10000),source); h.syncUi(); const before = stateBytes(h.sim), code = saveCode(h.sim,h.fixture.template,h.fixture.start);
    const r = techRow(h,id), b = buttons(r)[0], note = r.all(e=>e.classList.contains('note'))[0].textContent;
    assert.match(r.textContent,why,name+' reason');
    if (name === 'active-zero' || name === 'done') { assert.equal(b.disabled,true); assert.doesNotMatch(note,/(?:本次|要|費用|花|付)\s*\$/,'active/done never asks for a new charge'); }
    else if (fee === 0) { assert.match(note,/免費/); assert.match(note,why); assert.doesNotMatch(note,/(?:要|費用|花|付)\s*\$[1-9]/); assert.match(b.getAttribute('aria-label'),/免費/); }
    else { assert.match(note,new RegExp('\\$'+fee.toLocaleString())); if (name==='paid') assert.match(b.textContent,new RegExp('\\$'+fee.toLocaleString())); }
    assert.equal(stateBytes(h.sim),before,'fee render preserves raw model'); assert.equal(saveCode(h.sim,h.fixture.template,h.fixture.start),code);
    if (!b.disabled) { const money=h.sim.money; resetCalls(h); b.click(); assert.equal(money-h.sim.money,fee,name+' actual charge'); assert.equal(count(h,'research'),1); }
  }
}

function commissionThreshold(source = city) {
  for (const pop of [49,50,51]) for (const rankIdx of [1,2,3]) {
    const [h,c] = pair(()=>{const f=d045Load();Object.assign(f.sim,{pop,rankIdx,seed:0});return f;},source);
    h.openCommission(); c.openCommission(); const offered = rows(h,'cm','offer');
    if (rankIdx<2) { assert.equal(offered.length,0); assert.match(h.node('#cm .body').textContent,/等級 3/); }
    else if (pop<=50) { assert.equal(offered.length,0); assert.match(h.node('#cm .body').textContent,/人口.*超過\s*50/,'text agrees with >50 boundary'); }
    else assert.deepEqual(offered.map(e=>e.dataset.k),commissionOffers(h.sim).map(c=>c.id),'real offer order and variable count');
    resetCalls(h,c); const a=h.uiCommission('accept',0), b=c.uiCommission('accept',0); assert.equal(a,b); equalModels(h,c,`accept pop ${pop} rank ${rankIdx}`);
    assert.equal(a!==null,pop>50&&rankIdx>=2); assert.equal(count(h,'save'),a?1:0);
  }
  for (const [extra,diff,pop,rankIdx] of [[active('transit150'),1,0,0],[active(),3,100,5]]) {
    const [h,c] = pair(()=>{const f=d045Load({...extra,df:diff});Object.assign(f.sim,{pop,rankIdx});return f;},source);
    h.openCommission(); assert.equal(rows(h,'cm','act').length,diff===3?0:1,'old active priority/sandbox');
    if(diff!==3){resetCalls(h,c);buttons(rows(h,'cm','act')[0])[0].click();c.uiCommission('drop');equalModels(h,c,'legacy ridership drop');assert.equal(h.sim.cms.act,'');}
  }
}

function dailyResearch(source = city) {
  for (const [extra,id,before,after] of [
    [{tech343:{act:'A1',prog:{A1:5},done:[]}},'A1','5／40','6／40'],
    [{...active(),tech343:{act:'C6',prog:{C6:114},done:['C5']}},'C6','114／115',null],
  ]) {
    const [h,c] = pair(()=>d045Load(extra,10000),source); h.openTech(); h.openCommission(); c.openCommission();
    const day=h.sim.day; assert.match(rows(h,'tc','act')[0].textContent,new RegExp(before)); resetCalls(h,c);
    h.advance(1); c.advance(1); equalModels(h,c,'one original daily settlement '+id); assert.equal(count(h,'stepDay'),1);
    assert.equal(h.sim.day,day+1); assert.match(h.node('#tc .sub').textContent,new RegExp('第 '+(day+1)+' 天'));
    assert.equal(h.hud.money,h.sim.money); assert.ok(count(h,'renderTech')>0,'open panel refreshed by day');
    if(after) assert.match(rows(h,'tc','act')[0].textContent,new RegExp(after));
    else {
      assert.equal(rows(h,'tc','act')[0].dataset.st,'idle'); assert.match(h.node('#tc .body').textContent,/已完成 2／36/);
      const r=techRow(h,'C6'); assert.equal(r.dataset.st,'done'); assert.equal(buttons(r)[0].disabled,true);
      assert.equal(techRow(h,'C7').dataset.st,'can','new prerequisite unlock'); assert.equal(h.commission,null);
      assert.equal(h.sim.cms.done.filter(c=>c==='techC6').length,1); assert.equal(h.reports[0].commission.bonus,1800);
      assert.equal(h.sim.techSpeed,1,'C6 completion day retains the rate actually used');assert.match(h.node('#tc .body').textContent,/最近結算.*\+1/);
    }
    const visible=h.node('#tc .body').textContent; h.node('#tcX').click(); h.openTech(); assert.equal(h.node('#tc .body').textContent,visible,'reopen agrees with already refreshed panel');
    h.node('#tcX').click(); resetCalls(h,c); h.advance(1); c.advance(1); equalModels(h,c,'closed panel next day'); assert.equal(count(h,'renderTech'),0,'closed research panel is not redrawn');
    if(id==='C6')assert.equal(h.sim.techSpeed,2,'completed C6 increases the following day rate');
  }
}

function rateSemantics(source = city) {
  const fns=[()=>d045Load({spec386:'edu',tech343:{act:'A1',prog:{A1:5},done:['C6']}},10000),()=>{const {KT,vrank}=builtBase();const f=loadCode(d038Runs().find(r=>r.id==='S3').code,KT,vrank);assert.equal(f.ok,true);return f;}];
  for (let i=0;i<fns.length;i++) {
    const [h,c]=pair(fns[i],source); h.openTech(); assert.equal(h.lastReport(),null); assert.equal(h.sim.techSpeed,1,'preserve load default');
    const before=h.node('#tc .body').textContent;
    assert.match(before,/尚未|待.*結算|結算後/,'pending last-settlement data explained'); assert.doesNotMatch(before,/(?:每天進度|最近結算)\s*\+1/,'default is not a measured rate');
    assert.doesNotMatch(rows(h,'tc','act')[0].textContent,/(?:還要|估計|約)\s*\d+\s*天/,'no confident ETA before settlement');
    resetCalls(h,c);h.advance(1);c.advance(1);equalModels(h,c,'pending to settled speed');
    const speed=i?6:3;assert.equal(h.sim.techSpeed,speed);assert.match(h.node('#tc .body').textContent,new RegExp('最近結算.*\\+'+speed));
    const id=h.sim.tech.act,n=TECH343_BY_ID[id],days=Math.max(1,Math.ceil((n.points-h.sim.tech.prog[id])/speed));
    assert.match(rows(h,'tc','act')[0].textContent,new RegExp('(?:估計|約).*'+days+'\\s*天'));
  }
  // A specialization chosen while paused changes the next settlement, not the
  // stored last-settlement rate. Arm survives daily rendering as well.
  const [h,c]=pair(()=>d045Load({rk:8,tech343:{act:'A1',prog:{A1:5},done:[]}},10000),source);
  h.openTech();h.advance(1);c.advance(1);assert.equal(h.sim.techSpeed,1);
  h.uiSpec(2);c.uiSpec(2);assert.equal(h.pick(),2);h.advance(1);c.advance(1);assert.equal(h.pick(),2,'daily refresh retains armed specialization');
  assert.deepEqual(h.uiSpec(2),c.uiSpec(2));equalModels(h,c,'paused specialization');assert.equal(h.sim.techSpeed,1);
  assert.match(h.node('#tc .body').textContent,/最近結算.*\+1/);h.advance(1);c.advance(1);equalModels(h,c,'specialization next settlement');assert.equal(h.sim.techSpeed,2);
}

function trajectories(source = city) {
  const [h,c]=pair(()=>d045Load({...active(),tech343:{act:'A1',prog:{C6:110,A1:5},done:['C5']}},10000),source);
  for(const id of ['C6','C6','A1','C6']){h.uiTech(id);c.uiTech(id);equalModels(h,c,'paired initial action '+id);}
  const before=stateBytes(h.sim),code=saveCode(h.sim,h.fixture.template,h.fixture.start),storage=stateBytes(h.storage),journal=stateBytes(h.journal);
  resetCalls(h,c);
  for(let n=0;n<4;n++){h.openTech();h.openPolicy();h.openCommission();h.syncUi();h.node('#tcX').click();h.node('#plX').click();h.node('#cmX').click();}
  assert.equal(stateBytes(h.sim),before,'read-only views preserve complete raw state');assert.equal(saveCode(h.sim,h.fixture.template,h.fixture.start),code);
  assert.equal(stateBytes(h.storage),storage);assert.equal(stateBytes(h.journal),journal);assert.deepEqual(h.rngCalls,[]);assert.equal(count(h,'save'),0);
  // Never load/reseed between compared days: hidden RNG closures must stay in step.
  let payouts=0;
  for(let n=0;n<20;n++){
    h.openTech();h.openCommission();h.openPolicy();resetCalls(h,c);h.advance(1);c.advance(1);
    assert.deepEqual(h.reports.at(-1),c.reports.at(-1),'entire daily report '+n);equalModels(h,c,'uninterrupted day '+n);
    if(h.reports.at(-1).commission?.t==='done'){payouts++;assert.equal(h.reports.at(-1).commission.bonus,1800);}
  }
  assert.equal(payouts,1);assert.equal(h.sim.city.history.filter(e=>e.t==='cms'&&e.ev==='done'&&e.id==='techC6').length,1);
}

function stableControls(source = city, helper = panelSource) {
  const h=harness(d045Load({rk:8,tech343:{act:'A1',prog:{A1:5},done:[]}},10000),source,{panelSource:helper});h.syncUi();h.openTech();
  const b=buttons(techRow(h,'B1'))[0],body=h.node('#tc .body');b.focus();body.scrollTop=320;body.scrollLeft=7;
  h.advance(1);sameNode(buttons(row(h,'tc','tech','B1'))[0],b,'unchanged actionable button retains identity across day');
  sameNode(h.doc.activeElement,b,'focused unchanged control remains focused');assert.equal(body.scrollTop,320);assert.equal(body.scrollLeft,7);
  const money=h.sim.money;resetCalls(h);b.click();assert.equal(h.sim.tech.act,'B1');assert.equal(h.sim.money,money-400);assert.equal(count(h,'research'),1,'retained control fires once with current handler');
  const [a,c]=pair(()=>capacityFixture(),source);a.openPolicy();c.openPolicy();const plus=buttons(row(a,'pl','budget','edu'))[1];plus.focus();
  a.uiPolicy('ecoReg',true);c.uiPolicy('ecoReg',true);sameNode(buttons(row(a,'pl','budget','edu'))[1],plus,'unrelated policy refresh retains budget control');sameNode(a.doc.activeElement,plus);equalModels(a,c,'stable policy rendering');
}

function helperBehavior(helper = panelSource, atomic = true) {
  const update = new Function('HTMLElement',stripTypeScriptTypes(helper).replace('export function updatePanelContent','function updatePanelContent')+'; return updatePanelContent;')(Element);
  const doc=domDocument({atomic}),parent=doc.createElement('div');
  let calls=[];
  const make=(id,text,disabled,action,width)=>{
    const r=doc.createElement('li');r.dataset.kind='tech';r.dataset.k=id;r.setAttribute('data-old','remove-me');
    const b=doc.createElement('button');b.textContent=text;b.disabled=disabled;b.onclick=()=>calls.push(action);b.setAttribute('aria-label',text);
    const bar=doc.createElement('i');bar.style.width=width;r.append(b,bar);return r;
  };
  const a=make('A1','locked',true,'old-a','5%'),b=make('B1','ready',false,'old-b','0%');update(parent,a,b);
  const button=a.children[0],bar=a.children[1];button.focus();parent.scrollTop=150;
  const freshA=make('A1','start',false,'new-a','25%');freshA.removeAttribute('data-old');
  update(parent,freshA,make('B1','ready',false,'new-b','0%'));
  sameNode(parent.children[0],a);sameNode(a.children[0],button);sameNode(a.children[1],bar);
  sameNode(doc.activeElement,button);assert.equal(parent.scrollTop,150);assert.equal(a.hasAttribute('data-old'),false);
  assert.equal(button.disabled,false);assert.equal(button.getAttribute('aria-label'),'start');assert.equal(button.textContent,'start');assert.equal(bar.style.width,'25%');
  button.click();assert.deepEqual(calls,['new-a'],'reused button gets newest handler exactly once');
  const movedButton=b.children[0];movedButton.focus();movedButton.setPointerCapture(7);parent.scrollTop=150;parent.scrollLeft=11;
  update(parent,make('B1','ready',false,'newest-b','100%'),make('A1','active',true,'newest-a','30%'));
  sameNode(parent.children[0],b,'keyed reorder retains correct identity');sameNode(parent.children[1],a);
  sameNode(doc.activeElement,movedButton,'retained reordered control keeps focus');assert.equal(parent.scrollTop,150);assert.equal(parent.scrollLeft,11);
  if(atomic){assert.ok(doc.atomicMoves>0,'native atomic move is exercised');assert.equal(movedButton.hasPointerCapture(7),true,'atomic reordered control keeps capture');assert.deepEqual(doc.captureLosses,[]);}
  else{assert.equal(doc.atomicMoves,0);assert.equal(movedButton.hasPointerCapture(7),false,'legacy detach cannot preserve capture');assert.deepEqual(doc.focusCalls.at(-1),{preventScroll:true},'legacy restores focus without scrolling');}
  assert.equal(b.children[0].disabled,false);assert.equal(a.children[0].disabled,true);b.children[0].click();assert.deepEqual(calls,['new-a','newest-b']);
  update(parent,make('B1','done',true,'unused','100%'));assert.equal(b.children[0].disabled,true);b.children[0].click();assert.deepEqual(calls,['new-a','newest-b']);assert.equal(a.parentNode,null,'removed row detaches');assert.equal(parent.children.length,1);
  const text=doc.createTextNode('plain');update(parent,text);sameNode(parent.firstChild,text,'incompatible element is replaced by text');
  update(parent,doc.createTextNode('updated'));sameNode(parent.firstChild,text);assert.equal(text.nodeValue,'updated');
  const span=doc.createElement('span'),strong=doc.createElement('strong');span.textContent='a';strong.textContent='b';update(parent,span);update(parent,strong);
  sameNode(parent.firstChild,strong,'different element names cannot be reused');
}

function promotionFixture(seed=1) {
  const {KT,vrank}=builtBase();
  const code=mk(seed,50,'D052 real daily promotion',b=>{
    b.road(4,30,60,30,3).put(3,30,5);
    for(let x=10;x<42;x++)b.put(x,29,1,1,{den:3});
  },{rk:2,money:10000,cms385:{act:'',st:0,acc:0,hold:0,n:0,done:[]}});
  const f=loadCode(code,KT,vrank);assert.equal(f.ok,true);return f;
}
function promotedCommission(source=city,helper=panelSource,atomic=true) {
  // Rank, seed, population and offers all come from a saved fixture and one real
  // simDay. No runtime rank/pop override and no reread/reseed in the comparison.
  const [h,c]=pair(promotionFixture,source,{panelSource:helper,atomic});h.openCommission();
  assert.equal(h.sim.rankIdx,2);assert.equal(h.sim.pop,256);
  assert.deepEqual(rows(h,'cm','offer').map(e=>e.dataset.k),['trade1200','happy70']);
  const oldHappy=row(h,'cm','offer','happy70'),button=buttons(oldHappy)[0],offers=oldHappy.parentNode;
  button.focus();button.setPointerCapture(11);offers.scrollTop=87;offers.scrollLeft=9;
  resetCalls(h,c);h.advance(1);c.advance(1);equalModels(h,c,'commission actual rank promotion');
  assert.equal(h.sim.rankIdx,3);assert.equal(h.sim.cityPoints,169);assert.deepEqual(h.reports.at(-1).rank.promoted,[3]);
  assert.deepEqual(rows(h,'cm','offer').map(e=>e.dataset.k),['happy70','steel40','trade1200']);
  sameNode(row(h,'cm','offer','happy70'),oldHappy);sameNode(buttons(oldHappy)[0],button);
  sameNode(h.doc.activeElement,button,'real reordered offer retains active control');assert.equal(offers.scrollTop,87);assert.equal(offers.scrollLeft,9);
  assert.equal(button.hasPointerCapture(11),atomic,'capture retained only by real atomic path');
  const history=h.sim.city.history.length;button.releasePointerCapture(11);resetCalls(h,c);button.click();c.uiCommission('accept',0);
  assert.equal(h.sim.cms.act,'happy70','retained button uses its new offer index, not the old index for steel40');
  equalModels(h,c,'promoted offer current acceptance handler');assert.equal(count(h,'accept'),1);assert.equal(count(h,'save'),1);
  assert.deepEqual(h.sim.city.history.slice(history),[{day:51,t:'cms',ev:'accept',id:'happy70'}]);
}

function panelGateCases(source=pressSource) {
  const create=new Function('HTMLElement','Element',stripTypeScriptTypes(source).replace('export function createPanelUpdateGate','function createPanelUpdateGate')+'; return createPanelUpdateGate;')(Element,Element);
  const setup=()=>{
    const doc=domDocument(),panel=doc.createElement('div'),button=doc.createElement('button'),other=doc.createElement('button');
    doc.body.append(panel,other);panel.append(button);const gate=create(panel),events=[];
    const send=(type,id=1,target=button)=>doc.emit(type,{target,pointerId:id});
    const defer=label=>{assert.equal(gate.defer(()=>events.push(label)),true);};
    return{doc,panel,button,other,gate,events,send,defer};
  };
  {
    const q=setup();assert.equal(q.gate.defer(()=>q.events.push('unexpected')),false);
    q.button.disabled=true;q.send('pointerdown');assert.equal(q.gate.defer(()=>{}),false);q.button.disabled=false;
    q.doc.emit('pointerdown',{target:q.button,button:2});assert.equal(q.gate.defer(()=>{}),false);
    q.send('pointerdown',1,q.other);assert.equal(q.gate.defer(()=>{}),false);
    q.panel.hidden=true;q.send('pointerdown');assert.equal(q.gate.defer(()=>{}),false);q.panel.hidden=false;
    q.send('pointerdown');q.defer('superseded');q.defer('latest');q.send('pointerup');
    assert.deepEqual(q.events,[],'pointerup cannot shift geometry before native click');
    q.send('lostpointercapture');assert.deepEqual(q.events,[],'lost capture cannot trigger a pre-click render');
    q.button.onclick=()=>{q.events.push('original action');q.defer('latest after action');};
    q.send('click');assert.deepEqual(q.events,['original action','latest after action'],'target action runs before click-bubble latest render');
    q.doc.runTimers();assert.deepEqual(q.events,['original action','latest after action'],'release fallback cannot duplicate successful click flush');
  }
  {
    const q=setup();q.button.onclick=()=>q.events.push('unexpected activation');q.send('pointerdown');q.defer('latest');q.send('pointerup');assert.deepEqual(q.events,[]);
    q.doc.runTimers();assert.deepEqual(q.events,['latest'],'released pointer with no click recovers in next task');assert.equal(q.gate.defer(()=>{}),false);
  }
  {
    const q=setup();q.send('pointerdown',1);q.send('pointerdown',2);q.defer('both');q.send('pointerup',1);q.send('click',1);
    q.doc.runTimers();assert.deepEqual(q.events,[],'second held pointer keeps the panel stationary');q.send('pointerup',2);q.send('click',2);assert.deepEqual(q.events,['both']);
  }
  {
    const q=setup();q.send('pointerdown',1);q.defer('old');q.send('pointerup',1);
    const oldTimer=[...q.doc.timers.values()][0];q.send('pointerdown',2);q.defer('new');oldTimer();
    assert.deepEqual(q.events,[],'stale no-click timer cannot unlock a newer press');q.send('pointerup',2);q.send('click',2);q.doc.runTimers();assert.deepEqual(q.events,['new']);
  }
  for(const reason of ['pointercancel','blur','pagehide','visibilitychange']){
    const q=setup();q.button.onclick=()=>q.events.push('unexpected activation');q.send('pointerdown');q.defer(reason);
    if(reason==='visibilitychange'){q.doc.hidden=true;q.doc.visibilityState='hidden';q.doc.emit(reason,{target:q.doc});}
    else q.doc.emit(reason,{target:reason==='pointercancel'?q.button:q.doc.defaultView,pointerId:1});
    q.doc.runTimers();assert.deepEqual(q.events,[reason],reason+' releases pending latest view without activation');assert.equal(q.gate.defer(()=>{}),false);
  }
  {
    const q=setup();q.send('pointerdown');q.defer('stale');q.send('pointerup');const oldTimer=[...q.doc.timers.values()][0];
    q.gate.cancel();q.panel.hidden=true;oldTimer();q.send('click');q.doc.runTimers();assert.deepEqual(q.events,[],'close/cancel discards delayed presentation');
    q.panel.hidden=false;q.send('pointerdown',2);q.defer('reopened');q.send('pointerup',2);q.send('click',2);q.doc.runTimers();assert.deepEqual(q.events,['reopened']);
  }
}

const panelText=(h,id)=>['.body','.sub','.tip'].map(k=>h.node('#'+id+' '+k).textContent);
function heldPanelPresentation(source=city,gateSource=pressSource) {
  const [h,c]=pair(promotionFixture,source,{pressSource:gateSource});h.openCommission();
  const button=buttons(row(h,'cm','offer','happy70'))[0],before=panelText(h,'cm'),history=h.sim.city.history.length;
  h.doc.emit('pointerdown',{target:button,pointerId:8});resetCalls(h,c);h.advance(1);c.advance(1);
  equalModels(h,c,'held promotion still settles exact original model');assert.equal(h.sim.rankIdx,3);assert.equal(h.hud.money,h.sim.money);
  assert.deepEqual(panelText(h,'cm'),before,'held promotion freezes body, sub and tip, not only node identity');
  assert.deepEqual(rows(h,'cm','offer').map(e=>e.dataset.k),['trade1200','happy70'],'held old order remains until activation');
  h.doc.emit('pointerup',{target:button,pointerId:8});h.doc.emit('lostpointercapture',{target:button,pointerId:8});
  assert.deepEqual(panelText(h,'cm'),before,'pointerup/lostcapture cannot reorder before click');
  resetCalls(h,c);h.doc.emit('click',{target:button,pointerId:8});c.uiCommission('accept',0);h.doc.runTimers();
  assert.equal(h.sim.cms.act,'happy70','frozen offer resolves its current ID, not its old index');equalModels(h,c,'held offer exact one action/save');
  assert.equal(count(h,'accept'),1);assert.equal(count(h,'save'),1);assert.deepEqual(h.sim.city.history.slice(history).filter(e=>e.t==='cms'),[{day:51,t:'cms',ev:'accept',id:'happy70'}]);
  assert.notDeepEqual(panelText(h,'cm'),before);assert.equal(rows(h,'cm','act').length,1,'latest panel flushes after acceptance');

  const [gone,goneControl]=pair(()=>promotionFixture(5),source,{pressSource:gateSource});gone.openCommission();
  const goneButton=buttons(row(gone,'cm','offer','happy70'))[0];gone.doc.emit('pointerdown',{target:goneButton,pointerId:9});
  gone.advance(1);goneControl.advance(1);assert.equal(gone.sim.rankIdx,3);assert.ok(!commissionOffers(gone.sim).some(c=>c.id==='happy70'),'saved seed5 promotion removes the pressed offer');
  gone.doc.emit('pointerup',{target:goneButton,pointerId:9});resetCalls(gone,goneControl);gone.doc.emit('click',{target:goneButton,pointerId:9});goneControl.uiCommission('accept',-1);gone.doc.runTimers();
  equalModels(gone,goneControl,'disappeared pressed offer keeps original reject -1 semantics');assert.equal(gone.sim.cms.act,'');assert.equal(count(gone,'accept'),1);assert.equal(count(gone,'save'),0);assert.match(gone.node('#cm .tip').textContent,/接不了/);

  const [tech,techControl]=pair(()=>d045Load({rk:8,tech343:{act:'A1',prog:{A1:5},done:[]}},10000),source,{pressSource:gateSource});
  tech.openTech();const target=tech.node('#tc .body').all(e=>e.dataset.route==='B')[0],techBefore=panelText(tech,'tc');
  tech.doc.emit('pointerdown',{target,pointerId:2});resetCalls(tech,techControl);tech.advance(1);techControl.advance(1);
  equalModels(tech,techControl,'held research progresses immediately');assert.equal(tech.sim.tech.prog.A1,6);assert.deepEqual(panelText(tech,'tc'),techBefore,'held research keeps all presentation fixed');
  tech.doc.emit('pointerup',{target,pointerId:2});assert.deepEqual(panelText(tech,'tc'),techBefore);tech.doc.runTimers();assert.match(tech.node('#tc .sub').textContent,/第 151 天/);

  const [policy,policyControl]=pair(()=>capacityFixture(),source,{pressSource:gateSource});policy.openPolicy();const plus=buttons(row(policy,'pl','budget','edu'))[1],policyBefore=panelText(policy,'pl');
  policy.doc.emit('pointerdown',{target:plus,pointerId:3});resetCalls(policy,policyControl);policy.uiPolicy('ecoReg',true);policyControl.uiPolicy('ecoReg',true);
  equalModels(policy,policyControl,'held policy keeps immediate original action');assert.deepEqual(policy.hud.power,[78,80]);assert.equal(policy.coach,null);assert.deepEqual(panelText(policy,'pl'),policyBefore,'held policy keeps body/sub/tip fixed');
  policy.doc.emit('pointercancel',{target:plus,pointerId:3});policy.doc.runTimers();assert.notDeepEqual(panelText(policy,'pl'),policyBefore);
}

function gatePanelLifecycle(source=city) {
  for(const close of ['button','backdrop','city']){
    const h=harness(promotionFixture(),source);h.syncUi();h.openCommission();const button=buttons(row(h,'cm','offer','happy70'))[0];
    h.doc.emit('pointerdown',{target:button,pointerId:3});h.advance(1);const stale=panelText(h,'cm');
    h.doc.emit('pointerup',{target:button,pointerId:3});const timer=[...h.doc.timers.values()][0];
    if(close==='button')h.node('#cmX').click();else if(close==='backdrop')h.doc.emit('click',{target:h.node('#cm'),pointerId:99});else h.closeDecisionPanels();
    assert.equal(h.node('#cm').hidden,true);timer();h.doc.runTimers();assert.deepEqual(panelText(h,'cm'),stale,'closed panel cannot replay stale queued render: '+close);
    h.openCommission();assert.deepEqual(rows(h,'cm','offer').map(e=>e.dataset.k),['happy70','steel40','trade1200']);
    const fresh=buttons(row(h,'cm','offer','happy70'))[0];resetCalls(h);h.doc.emit('pointerdown',{target:fresh,pointerId:4});h.renderCommission();h.doc.emit('pointerup',{target:fresh,pointerId:4});h.doc.emit('click',{target:fresh,pointerId:4});h.doc.runTimers();
    assert.equal(h.sim.cms.act,'happy70');assert.equal(count(h,'accept'),1);assert.equal(count(h,'save'),1);
  }
}

// Short independent probes keep mutations affordable; broad guards above cover
// all states. Syntax errors/unknown identifiers never count as killed mutations.
function mutationMoney(source, failed = false) {
  const [h,c]=pair(()=>d045Load({...active(),tech343:{act:'',prog:{},done:['C5']}},failed?1:10000),source);
  h.hud.money=-1;const r=h.uiTech('C6');assert.deepEqual(r,c.uiTech('C6'));equalModels(h,c,'mutation money');
  assert.equal(r.ok,!failed);assert.equal(h.hud.money,h.sim.money);assert.equal(count(h,'research'),1);assert.equal(count(h,'save'),failed?0:1);
}
function mutationPolicy(source) {
  const [h,c]=pair(()=>capacityFixture(),source);h.uiPolicy('ecoReg',true);c.uiPolicy('ecoReg',true);equalModels(h,c,'mutation policy');
  assert.deepEqual(h.hud.power,[78,80]);assert.equal(h.coach,null);assert.equal(h.sim.day,50);assert.equal(h.sim.money,10000);
  assert.equal(h.sim.w.tiles.filter(t=>t.bld&&!t.bld.ref&&t.bld.k<=3&&t.bld.pw).length,75);
}
function mutationBudget(source) {
  const [h,c]=pair(()=>d045Load({pol:{schoolLunch:true},sb:{police:1,fire:1,health:1,edu:1.5}},10000),source);
  h.uiBudget('edu',1);c.uiBudget('edu',1);equalModels(h,c,'mutation budget');assert.equal(count(h,'budget'),1);assert.equal(count(h,'save'),1);
  assert.match(h.toasts.at(-1)?.[0]??'',/上限/);assert.doesNotMatch(h.toasts.at(-1)?.[0]??'',/更廣|更貴|省錢|縮水/);
}
function mutationReadOnly(source) {
  const h=harness(d045Load({...active(),tech343:{act:'A1',prog:{A1:5},done:['C5']}},10000),source,{journal:'ok'});h.syncUi();resetCalls(h);
  const state=stateBytes(h.sim),code=saveCode(h.sim,h.fixture.template,h.fixture.start),store=stateBytes(h.storage),journal=stateBytes(h.journal);
  h.openTech();h.openCommission();h.openPolicy();h.node('#tcX').click();h.node('#cmX').click();h.node('#plX').click();
  assert.equal(stateBytes(h.sim),state);assert.equal(saveCode(h.sim,h.fixture.template,h.fixture.start),code);
  assert.equal(stateBytes(h.storage),store);assert.equal(stateBytes(h.journal),journal);assert.deepEqual(h.rngCalls,[]);assert.equal(count(h,'save'),0);
}
function mutateFunction(source,name,from,to) {
  const start='  function '+name+'(',ends={uiPolicy:'  // 服務預算',uiBudget:'  function openPolicy()',uiTech:'  // 選城市方向',renderTech:'  // 開始研究',simDay:'  function setPlaying',techEta:'  function renderTech()'};
  const body=section(source,start,ends[name]);return source.replace(body,()=>change(body,from,to));
}
function staleOfferIndex(source) {
  return change(change(source,'commissionOffers(s).forEach(c => {','commissionOffers(s).forEach((c, i) => {'),
    'sim ? commissionOffers(sim).findIndex(now => now.id === c.id) : -1','i');
}
function pressMutations(source=city) {
  const views=[
    ['commission held presentation gate removed','if (cmGate.defer(renderCommission)) return;'],
    ['research held presentation gate removed','if (tcGate.defer(renderTech)) return;'],
    ['policy held presentation gate removed','if (plGate.defer(renderPolicy)) return;'],
  ];
  for(const [name,from]of views)assert.throws(()=>heldPanelPresentation(change(source,from,'void 0;')),e=>e?.code==='ERR_ASSERTION',name);
  const gates=[
    ['pointerup eagerly flushes before click','presses.set(event.pointerId, true); releaseFallback();','presses.delete(event.pointerId); flush();'],
    ['lost capture incorrectly flushes before click',"  doc.addEventListener('click', event => {","  doc.addEventListener('lostpointercapture', () => { presses.clear(); flush(); });\n  doc.addEventListener('click', event => {"],
    ['only obsolete first pending render retained','pending = renderLatest; return true;','pending ??= renderLatest; return true;'],
    ['cancel replays stale pending render','presses.clear(); pending = null;','presses.clear(); flush();'],
    ['no-click fallback remains locked','if (released) presses.delete(id);','if (false) presses.delete(id);'],
  ];
  for(const [name,from,to]of gates)assert.throws(()=>panelGateCases(change(pressSource,from,to)),e=>e?.code==='ERR_ASSERTION',name);
  return `${views.length+gates.length} additional actual gate/wiring mutations rejected`;
}
function mutations(source=city) {
  const list=[
    ['paid research HUD refresh removed',()=>mutateFunction(source,'uiTech','renderTech(); syncUi(); return r;','renderTech(); syncCommissionHud(); return r;'),mutationMoney],
    ['failed research HUD refresh omitted',()=>mutateFunction(source,'uiTech','renderTech(); syncUi(); return r;','renderTech(); if (r.ok) syncUi(); return r;'),s=>mutationMoney(s,true)],
    ['duplicate research action',()=>mutateFunction(source,'uiTech','r = startResearch(sim, id);','r = (startResearch(sim, id), startResearch(sim, id));'),mutationMoney],
    ['successful research save omitted',()=>mutateFunction(source,'uiTech','saveNow();','void 0;'),mutationMoney],
    ['research adds save before action',()=>mutateFunction(source,'uiTech','r = startResearch(sim, id);','r = (saveNow(), startResearch(sim, id));'),mutationMoney],
    ['policy capacity/coach refresh omitted',()=>mutateFunction(source,'uiPolicy','renderPolicy(); syncUi();','renderPolicy();'),mutationPolicy],
    ['presentation charges daily money early',()=>mutateFunction(source,'uiPolicy','renderPolicy(); syncUi();','sim.money -= 1; renderPolicy(); syncUi();'),mutationPolicy],
    ['budget boundary falsely reports change',()=>mutateFunction(source,'uiBudget','const unchanged = sim.budget[c.id] === before;','const unchanged = false;'),mutationBudget],
    ['clamped budget skips recoverCov/save',()=>mutateFunction(source,'uiBudget','const before = sim.budget[c.id];','if (sim.budget[c.id] === 1.5) return true; const before = sim.budget[c.id];'),mutationBudget],
    ['budget action accidentally repeated',()=>mutateFunction(source,'uiBudget','const unchanged =','setBudget(sim, cat, dir * BUDGET_STEP); const unchanged ='),mutationBudget],
    ['resume/sandbox claims catalogue payment',()=>mutateFunction(source,'renderTech','const cost = fee > 0 ?', 'const cost = n.cost > 0 ?').replace('`本次 $${fee.toLocaleString()}`','`本次 $${n.cost.toLocaleString()}`'),feeTruth],
    ['active research asks for new payment',()=>change(source,'...(isDone || isAct ? [] : [cost])','...(isDone ? [] : [cost])'),feeTruth],
    ['population boundary copy off by one',()=>change(source,'人口超過 50 解鎖','人口 50 解鎖'),commissionThreshold],
    ['open research daily refresh omitted',()=>change(source,'if (!tc.hidden) renderTech();','if (false) renderTech();'),dailyResearch],
    ['closed research redraws unnecessarily',()=>change(source,'if (!tc.hidden) renderTech();','renderTech();'),dailyResearch],
    ['daily settlement accidentally repeated',()=>mutateFunction(source,'simDay','rep = stepDay(sim!);','rep = (stepDay(sim!), stepDay(sim!));'),dailyResearch],
    ['load default described as measured',()=>change(source,'const rate = lastRep ?','const rate = true ?'),rateSemantics],
    ['load default supplies confident ETA',()=>mutateFunction(source,'techEta',"if (!lastRep) return '推進一天後顯示速度與估計天數';",'if (false) return \'unused\';'),rateSemantics],
    ['render mutates money',()=>mutateFunction(source,'renderTech','if (!sim) return;','if (!sim) return; sim.money--;'),mutationReadOnly],
    ['render mutates typed-array byte',()=>mutateFunction(source,'renderTech','if (!sim) return;','if (!sim) return; sim.g.EDU[0] += 1;'),mutationReadOnly],
    ['render mutates Map',()=>mutateFunction(source,'renderTech','if (!sim) return;','if (!sim) return; sim.root.delete(sim.root.keys().next().value);'),mutationReadOnly],
    ['render consumes hidden RNG',()=>mutateFunction(source,'renderTech','if (!sim) return;','if (!sim) return; sim.rng.R();'),mutationReadOnly],
    ['render writes browser storage',()=>mutateFunction(source,'renderTech','if (!sim) return;','if (!sim) return; localStorage.setItem("existing-save","changed");'),mutationReadOnly],
    ['render writes journal',()=>mutateFunction(source,'renderTech','if (!sim) return;','if (!sim) return; kickJournal();'),mutationReadOnly],
    ['daily controls destructively replaced',()=>change(source,'updatePanelContent(box, ...actKids, ...routeKids, ...specKids);','box.replaceChildren(...actKids, ...routeKids, ...specKids);'),stableControls],
  ];
  for(const [name,mutate,test] of list){const altered=mutate();assert.throws(()=>test(altered),e=>e?.code==='ERR_ASSERTION',name);}
  const helpers=[
    ['helper always replaces controls', 'const node = old ?? fresh;', 'const node = fresh;'],
    ['helper retains stale handlers','old.onclick = fresh.onclick;','void 0;'],
    ['helper retains stale disabled/ARIA/style attributes','old.setAttribute(attr.name, attr.value);','void 0;'],
    ['helper fails to clear disabled attribute','old.removeAttribute(attr.name);','void 0;'],
    ['helper keeps stale text','old.nodeValue = fresh.nodeValue;','void 0;'],
    ['helper ignores keyed identities','&& keyOf(a) === keyOf(b)','&& true'],
  ];
  for(const [name,from,to]of helpers){const altered=change(panelSource,from,to);assert.throws(()=>helperBehavior(altered),e=>e?.code==='ERR_ASSERTION',name);}
  const reorderMutations=[
    ['atomic move regresses to detaching insertion',change(panelSource,'parent.moveBefore(node, reference);','parent.insertBefore(node, reference);'),s=>helperBehavior(s,true)],
    ['legacy move omits focus recovery',change(panelSource,'if (restoreFocus) active.focus({ preventScroll: true });','void 0;'),s=>helperBehavior(s,false)],
    ['legacy move omits pre-move scroll restoration',change(panelSource,'parent.scrollTop = top; parent.scrollLeft = left;','void 0;'),s=>helperBehavior(s,false)],
    // Stable-ID handlers intentionally remain correct even if an old handler is
    // retained. Regress the real old-index behavior while the gate freezes it.
    ['held promoted real offer uses its stale index',staleOfferIndex(source),s=>heldPanelPresentation(s)],
  ];
  for(const [name,altered,test]of reorderMutations)assert.throws(()=>test(altered),e=>e?.code==='ERR_ASSERTION',name);
  return `${list.length+helpers.length+reorderMutations.length} valid actual-source/helper mutations rejected by behavioral assertions`;
}

export function d052Guards(log, source = city) {
  const test=(name,fn)=>{try{log(true,'D052 '+name,fn(source));}catch(e){log(false,'D052 '+name,e.stack);}};
  test('original main action controls retain their independently verified c1ac6154 SHA256 fingerprints',()=>{
    for(const [name,body]of Object.entries(ORIGINAL_ACTIONS))assert.equal(createHash('sha256').update(body).digest('hex'),ACTION_SHA[name],name+' immutable original main handler');
  });
  test('paused paid/free/repeat/failure research, real successful/quota/journal-fallback saves and exact original action effects',pausedMoney);
  test('ecoReg capacity and coach refresh together; original cooldown, allocation, raw roads and state retained',policyCapacity);
  test('four budgets at both clamps and adjacent steps; real recoverCov, schoolLunch load quirk, history and saves retained',budgetBoundaries);
  test('actual fee/label/accessibility text: paid, resume, sandbox, active, completed and prerequisite lock',feeTruth);
  test('population 49/50/51 and Lv.3 exact eligibility; sandbox, active legacy drop and offer ordering preserved',commissionThreshold);
  test('real advance/simDay updates open panel progress, completion, unlocks, funds/date and single commission payout',dailyResearch);
  test('pending load rate/ETA and recent settlement estimates; facilities, C6 and paused specialization preserve original speed',rateSemantics);
  test('complete raw model/save/storage/journal/RNG read-only checks and 20 uninterrupted paired daily trajectories',trajectories);
  test('stable unchanged button identities, focus and scroll with current one-shot actions at DOM boundary',stableControls);
  test('actual reconciliation helper retains keyed identities, current handlers/attributes/styles/text and removes obsolete rows',()=>helperBehavior());
  test('legacy keyed moves restore focus and scroll while honestly losing unavailable atomic pointer capture',()=>helperBehavior(panelSource,false));
  test('one original daily promotion reorders actual offers, retaining moved control focus/capture and its new acceptance index',()=>{
    promotedCommission(source);promotedCommission(source,panelSource,false);
  });
  test('actual press gate handles click ordering, latest render, no-click/cancel, two pointers, new-press timer race and lifecycle',()=>panelGateCases());
  test('held panels freeze all presentation while model/HUD/save remain immediate; real promoted offer accepts by current ID',heldPanelPresentation);
  test('actual close/backdrop/city cleanup discards queued render and reopening accepts exactly once',gatePanelLifecycle);
  test('valid behavior mutations are rejected by independent assertions',mutations);
  test('actual press gate and renderer wiring mutations are rejected',pressMutations);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  let bad=0;const log=(ok,name,detail)=>{console.log(ok?'OK':'NG',name,detail??'');if(!ok)bad++;};
  if(process.argv[2]==='--press'){
    for(const [name,fn]of [['gate',()=>panelGateCases()],['held original functions',()=>heldPanelPresentation()],['cleanup',()=>gatePanelLifecycle()],['gate mutations',()=>pressMutations()],['stale offer index',()=>assert.throws(()=>heldPanelPresentation(staleOfferIndex(city)),e=>e?.code==='ERR_ASSERTION')]]){
      try{log(true,'D052 focused press '+name,fn());}catch(e){log(false,'D052 focused press '+name,e.stack);}
    }
  }else if(process.argv[2]==='--baseline'){
    const source=fs.readFileSync(process.argv[3],'utf8');
    assert.equal(createHash('sha256').update(source).digest('hex'),'1dbdcc057c68d7c8589614a4dbc75bd62297af811829d17e24abca11a8c243b5','unaltered original main cityView');
    for(const [name,check]of [['paid HUD',pausedMoney],['policy capacity/coach',policyCapacity],['budget boundary',budgetBoundaries],['free fee text',feeTruth],['population threshold text',commissionThreshold],['open daily research',dailyResearch],['last-settlement rate/ETA',rateSemantics]]){
      try{let reason='';assert.throws(()=>check(source),e=>{reason=e.message;return e?.code==='ERR_ASSERTION';},name+' must fail for behavioral reasons');log(true,'D052 old main rejected: '+name,reason.split('\n')[0]);}catch(e){log(false,name,e.stack);}
    }
  }else d052Guards(log,process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):city);
  process.exitCode=bad?1:0;
}
