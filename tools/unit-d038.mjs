// D038 Node 守衛：科技與專精（T343／T386）——科技表、開始研究、每天的研究、存與讀、選城市方向逐項＝實驗線原文（驗收 1、2 的公式半邊與突變）。實驗線頁面實跑、動作、接線、存檔、介面：見 tools/unit-d038-live.mjs。
//   1. 出處：src/content/samples/d038-tech.json（tools/lab-tech.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；接線要靠的事實在原文裡成立（每天的研究在主計數迴圈之後、存檔欄位名 tech343／spec386、
//      零狀態不落欄位、讀檔先於 rebuildCov 的位置在 day.ts 註解裡、sq 與 tq 的形狀）；tech.ts 沒有 three／DOM／亂數／現實時間／外部網址；表裡每個 id 都有人用（tq／sq 的呼叫處用到的 id 都在表內）；
//   2. 逐項＝實驗線：實驗線原文在 Node `vm` 裡跟本線 tech.ts 吃同一批輸入——
//      表：36 個節點逐欄相等（id、名稱、路線、層級、cost、points、pre、mutex、any、minDone、effect）、專精四個方向、教育場科技四個 id；
//      開始的條件：300 個隨機狀態 × 36 個節點的 canStart；開始研究：隨機狀態 × 隨機節點 × 資金 × 難度（沙盒免費、已有進度免費、錢不夠）的回傳、資金、狀態；
//      每天的研究：150 個隨機狀態、隨機的六個計數、專精，連推 40 天：逐天狀態、速度、完成的節點與「完成教育場科技要重建覆蓋場」；
//      存與讀：techSave 的濾除與零狀態、techLoad 吃 ≥ 700 個欄位（合法的、各種畸形、單一破壞）逐項相等（含整個棄用回零）；專精讀檔的白名單（含 'constructor' 的怪癖）；選方向：專精 × 難度 × 城市等級 × 編號。
//   3. 注入錯誤要紅：實驗線原文與本線原碼各改壞一批（速度的每一項與上限、完成條件差一、完成不清 act、教育場重建、互斥、前置、any、minDone、費用與免費條件、錢不夠的比較、讀檔的每一種驗型、
//      存檔的進度濾除、選方向的三個條件）；每個突變指定「哪一項比對要紅」、只跑那一項；沒改的先核過全等。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as TK from '../src/sim/rules/tech.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
export const KEY = {
  table: '科技表 TECH343', byId: 'TECH343_BY_ID', empty: 'emptyTech343', state: '狀態 tech343', has: 'hasTech343', tq: 'tq', eduIds: 'TECH_EDU343', canStart: 'canStartTech343', start: 'startTech343', advance: 'advanceTech343',
  save: 'techSave343', load: 'techLoad343', spec: '專精表 SPEC386', specIds: 'SPEC_IDS386', specVar: 'spec386 變數', sq: 'sq', pick: 'specPick386', callAdvance: '每天的研究呼叫', saveTech: '存檔 tech343', saveSpec: '存檔 spec386',
  loadTech: '讀檔 tech343', loadSpec: '讀檔 spec386',
};   // text 的鍵 → 樣本 pieces 的名字

export async function d038Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D038 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 實驗線那一邊：原文在 vm 裡 ----
function makeLab(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';let money=0,diff=1,rankIdx=0,rebuilt=0;const rebuildCov=()=>{rebuilt++;},toast=()=>{},sFanfare=()=>{};
${T.table}
${T.byId}
${T.empty}
${T.state}
${T.has}
${T.tq}
${T.eduIds}
${T.canStart}
${T.start}
${T.advance}
${T.save}
${T.load}
${T.spec}
${T.specIds}
${T.specVar}
${T.sq}
${T.pick}
const snap=()=>({act:tech343.act,prog:{...tech343.prog},done:tech343.done.slice()});
globalThis.__api={
  table:()=>JSON.parse(JSON.stringify(TECH343)),edu:()=>TECH_EDU343.slice(),specTable:()=>JSON.parse(JSON.stringify(SPEC386)),specIds:()=>SPEC_IDS386.slice(),
  set:(st,spec,m,df,rk)=>{tech343={act:st.act,prog:{...st.prog},done:st.done.slice()};techSpeed343=1;spec386=spec;money=m;diff=df;rankIdx=rk;rebuilt=0;},
  can:id=>canStartTech343(TECH343_BY_ID[id]),
  start:id=>{const ok=startTech343(id);return {ok,money,st:snap()};},
  adv:c=>{const r0=rebuilt;advanceTech343(c[0],c[1],c[2],c[3],c[4],c[5],c[6]);return {speed:techSpeed343,st:snap(),rebuilt:rebuilt-r0};},
  save:()=>techSave343(),
  load:raw=>{tech343=techLoad343(raw);return snap();},
  pick:i=>{const r0=rebuilt,ok=specPick386(i);return {ok,spec:spec386,rebuilt:rebuilt-r0};},
  specLoad:raw=>{const d={spec386:raw};${T.loadSpec}
    return spec386;},
};`, ctx, { filename: 'lab:tech' });
  const A = ctx.__api, c = x => JSON.parse(J(x ?? null));
  return { table: () => A.table(), edu: () => A.edu(), specTable: () => A.specTable(), specIds: () => A.specIds(), set: (...a) => A.set(...a), can: id => A.can(id), start: id => c(A.start(id)), adv: cs => c(A.adv(cs)), save: () => c(A.save()), load: raw => c(A.load(raw)), pick: i => c(A.pick(i)), specLoad: raw => A.specLoad(raw) };
}
// 本線那一邊：tech.ts（突變時傳改壞的那份）。狀態一律用 { act, prog, done } 這個形狀（本線的 st＋done 清單）
const norm = (st, done) => ({ act: st.act, prog: { ...st.prog }, done: done.slice() });
function portSide(M) {
  let st = M.emptyTech(), done = [], spec = '', money = 0, diff = 1, rank = 0;
  return {
    set: (s, sp, m, df, rk) => { st = { act: s.act, prog: { ...s.prog } }; done = s.done.slice(); spec = sp; money = m; diff = df; rank = rk; },
    can: id => M.canStartTech(M.TECH343_BY_ID[id], st, done),
    start: id => { const r = M.startTech(id, st, done, money, diff); if (r.ok) money -= r.fee; return { ok: r.ok, money, st: norm(st, done) }; },
    adv: c => { const r = M.advanceTech(st, done, { inN: c[0], un: c[1], tpk342: c[2], cam342: c[3], dtc342: c[4], mgN: c[5], res466: c[6] }, spec || null); return { speed: r.speed, st: norm(st, done), rebuilt: r.finished && M.TECH_EDU343.includes(r.finished) ? 1 : 0 }; },
    save: () => M.techSave(st, done),
    load: raw => { const r = M.techLoad(raw); return norm(r.st, r.done); },
    pick: i => { const id = M.pickSpec(i, spec || null, diff, rank); if (id) spec = id; return { ok: !!id, spec, rebuilt: id === 'edu' ? 1 : 0 }; },
    specLoad: raw => M.specOfSave(raw),
  };
}

// ---- 隨機輸入 ----
const IDS = TK.TECH343.map(n => n.id);
function gen(k) {
  const g = mulberry32(0x38a + k * 977), ri = n => Math.floor(g() * n), r = () => g();
  const done = []; for (const id of IDS) if (r() < (k % 4 === 0 ? .1 : k % 4 === 1 ? .5 : .85)) done.push(id);
  for (let i = done.length - 1; i > 0; i--) { const j = ri(i + 1); [done[i], done[j]] = [done[j], done[i]]; }   // 完成的順序是亂的（讀檔不排序）
  const prog = {}; for (const n of TK.TECH343) if (r() < .12) prog[n.id] = r() < .85 ? 1 + ri(n.points - 1) : [0, n.points, n.points + 3, -2, 1.5][ri(5)];
  const act = r() < .5 ? '' : IDS[ri(IDS.length)];
  return { st: { act, prog, done }, spec: ['', 'ind', 'green', 'edu', 'hub'][ri(5)], money: [0, 399, 400, 2400, 9000, 1e6][ri(6)], diff: [1, 2, 3][ri(3)], rank: ri(12) };
}
const STATES = Array.from({ length: 300 }, (_, k) => gen(k));
// 點名的狀態：零狀態（存檔要回 null）、只有不合格的進度（濾掉之後也是零狀態）、每一對二選一的兩個方向（正在做一邊、只有進度、已完成）
{
  const E = { act: '', prog: {}, done: [] }, mk = (st, m = 6000) => ({ st, spec: '', money: m, diff: 1, rank: 8 });
  STATES.push(mk(E), mk({ act: '', prog: { A1: 0, A2: 99, A3: 1.5 }, done: [] }), mk({ act: '', prog: { A1: 40 }, done: [] }));
  for (const n of TK.TECH343) if (n.mutex) {
    const pre = n.pre.length ? n.pre : [], done = [...pre, ...(n.pre[0] ? TK.TECH343.filter(q => q.route === n.route && q.tier < n.tier).map(q => q.id) : [])];
    STATES.push(mk({ act: n.id, prog: {}, done: [...new Set(done)] }), mk({ act: '', prog: { [n.id]: 3 }, done: [...new Set(done)] }), mk({ act: '', prog: {}, done: [...new Set([...done, n.id])] }));
  }
}
// 一個「合法」的狀態（互斥只做一邊、前置不管；進度在範圍內、act 沒完成）：給 techLoad 的破壞用
function validState(k) {
  const g = mulberry32(0x38b + k * 733), ri = n => Math.floor(g() * n), r = () => g();
  const done = [], seen = new Set();
  for (const n of TK.TECH343) { if (r() < .5 && !(n.mutex && seen.has(n.mutex))) { done.push(n.id); seen.add(n.id); } }
  const prog = {}; let act = '';
  for (const n of TK.TECH343) if (!seen.has(n.id) && !(n.mutex && (seen.has(n.mutex) || prog[n.mutex] !== undefined)) && r() < .2) prog[n.id] = 1 + ri(n.points - 1);
  const live = Object.keys(prog); if (live.length && r() < .6) act = live[ri(live.length)];
  else if (r() < .3) { const free = TK.TECH343.filter(n => !seen.has(n.id) && prog[n.id] === undefined && !(n.mutex && (seen.has(n.mutex) || prog[n.mutex] !== undefined))); if (free.length) act = free[ri(free.length)].id; }
  return { act, prog, done };
}
const BREAK = [
  s => { s.act = 5; }, s => { delete s.act; }, s => { s.prog = []; }, s => { s.prog = null; }, s => { s.done = {}; }, s => { delete s.done; }, s => { s.act = 'ZZ'; },
  s => { if (s.done.length) s.done.push(s.done[0]); else s.done.push('A1', 'A1'); }, s => { s.done.push('NOPE'); }, s => { s.done.push(5); }, s => { s.done.push(['A1']); }, s => { s.done.push('constructor'); },
  s => { s.prog.A1 = 1.5; }, s => { s.prog.A1 = 0; }, s => { s.prog.A1 = -3; }, s => { s.prog.A1 = 40; }, s => { s.prog.A1 = 41; }, s => { s.prog.A1 = '5'; }, s => { s.prog.ZZ = 3; }, s => { s.prog.A4a = 10; s.prog.A4b = 10; },
  s => { s.done.push('A4a', 'A4b'); }, s => { s.done.push('A4a'); s.prog.A4b = 5; }, s => { s.done.push('A1'); s.prog.A1 = 5; }, s => { s.act = 'A4a'; s.done.push('A4b'); }, s => { s.act = 'A4a'; s.prog.A4b = 5; },
  s => { s.act = 'A1'; if (!s.done.includes('A1')) s.done.push('A1'); }, s => { s.act = 'A4b'; s.prog.A4a = 5; },
];
const GARBAGE = [undefined, null, 0, 1, 'x', true, [], {}, { act: '' }, { act: '', prog: {} }, { act: '', prog: {}, done: [] }, { act: '', prog: {}, done: 'A1' }, { act: 3, prog: {}, done: [] }, { act: '', prog: [], done: [] },
  { act: 'A1', prog: {}, done: [] }, { act: 'A1', prog: { A1: 10 }, done: [] }, { act: '', prog: { A1: 10 }, done: [] }, { act: '', prog: {}, done: ['A1'] }, { act: '', prog: {}, done: ['A1', 'A2', 'A3'] }, { act: '', prog: {}, done: ['A2'] },
  { act: '', prog: {}, done: ['A4a', 'A4b'] }, { act: 'A4a', prog: { A4b: 5 }, done: [] }, { act: 'A4b', prog: { A4a: 5 }, done: [] }, { act: 'A4a', prog: {}, done: ['A4b'] }, { extra: 1, act: '', prog: {}, done: ['A1'] }];
function loadCases() {
  const out = GARBAGE.map(v => v);
  for (let k = 0; k < 720; k++) { const s = validState(k); if (k % 3) { const n = 1 + (k % 2); for (let q = 0; q < n; q++) { try { BREAK[(k * 7 + q * 5) % BREAK.length](s); } catch { /* 前一個破壞已經把欄位弄成不能再改的形狀 */ } } } out.push(JSON.parse(J(s))); }
  return out;
}
const LOADS = loadCases();
const SPEC_LOADS = [undefined, null, '', 'ind', 'green', 'edu', 'hub', 'IND', ' ind', 'constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 5, {}, [], ['ind'], true];
const PICKS = (() => { const o = []; for (const sp of ['', 'ind', 'edu']) for (const df of [1, 3]) for (const rk of [0, 7, 8, 9, 20]) for (const i of [-1, 0, 1, 2, 3, 4, 1.5]) o.push([sp, df, rk, i]); return o; })();
const ADV_STATES = (() => { const o = []; for (let k = 0; o.length < 150 && k < 600; k++) { const s = validState(900 + k); if (!s.act) continue; o.push({ s, spec: ['', 'ind', 'green', 'edu', 'hub'][k % 5] }); } return o; })();

// 一份實驗線＋一份本線，逐項比。回傳第一個不同（沒有＝null）。only＝只比哪一項（突變用）
function compare(lab, port, only = null) {
  try { return compare1(lab, port, only); } catch (e) { return `例外：${String(e.message).slice(0, 80)}`; }   // 改壞的版本丟例外也算「不同」
}
function compare1(lab, port, only) {
  if (!only || only === 'table') {
    const canon = x => J(x.map(n => ({ id: n.id, nm: n.nm, route: n.route, tier: n.tier, cost: n.cost, points: n.points, pre: n.pre, mutex: n.mutex ?? null, any: n.any ?? null, minDone: n.minDone ?? null, effect: n.effect })));
    if (canon(lab.table()) !== canon(TK.TECH343)) return '科技表不同';
    if (J(lab.edu()) !== J(TK.TECH_EDU343) || J(lab.specIds()) !== J(TK.SPEC_IDS386) || J(Object.keys(lab.specTable())) !== J(Object.keys(TK.SPEC386))) return '教育場科技或專精清單不同';
    for (const [id, d] of Object.entries(lab.specTable())) if (J(d) !== J(TK.SPEC386[id])) return `專精 ${id} 不同`;
  }
  if (!only || only === 'can') for (let k = 0; k < STATES.length; k++) { const q = STATES[k]; lab.set(q.st, q.spec, q.money, q.diff, q.rank); port.set(q.st, q.spec, q.money, q.diff, q.rank); for (const id of IDS) { const a = lab.can(id), b = port.can(id); if (a !== b) return `canStart 狀態 ${k} 節點 ${id}：實驗線 ${a} 本線 ${b}`; } }
  if (!only || only === 'start') for (let k = 0; k < STATES.length; k++) {
    const q = STATES[k], g = mulberry32(0x38c + k);
    for (let t = 0; t < 3; t++) {
      const id = g() < .1 ? 'ZZ' : IDS[Math.floor(g() * IDS.length)];
      lab.set(q.st, q.spec, q.money, q.diff, q.rank); port.set(q.st, q.spec, q.money, q.diff, q.rank);
      const a = lab.start(id), b = port.start(id); if (J(a) !== J(b)) return `start 狀態 ${k} 節點 ${id}（資金 ${q.money}、難度 ${q.diff}）：實驗線 ${J(a).slice(0, 140)} 本線 ${J(b).slice(0, 140)}`;
    }
  }
  if (!only || only === 'adv') for (let k = 0; k < ADV_STATES.length; k++) {
    const { s, spec } = ADV_STATES[k], g = mulberry32(0x38d + k);
    lab.set(s, spec, 0, 1, 0); port.set(s, spec, 0, 1, 0);
    for (let d = 0; d < 40; d++) {
      const cs = [0, 0, 0, 0, 0, 0, 0].map((_, i) => g() < .5 ? 0 : Math.floor(g() * (i === 5 ? 3 : 5)));
      const a = lab.adv(cs), b = port.adv(cs); if (J(a) !== J(b)) return `adv 狀態 ${k} 第 ${d + 1} 天（計數 ${J(cs)}、專精 ${spec}）：實驗線 ${J(a).slice(0, 160)} 本線 ${J(b).slice(0, 160)}`;
      if (!a.st.act && g() < .5) { const free = IDS.filter(id => lab.can(id)); if (free.length) { const id = free[Math.floor(g() * free.length)]; lab.start(id); port.start(id); } }
    }
  }
  if (!only || only === 'save') for (let k = 0; k < STATES.length; k++) { const q = STATES[k]; lab.set(q.st, q.spec, q.money, q.diff, q.rank); port.set(q.st, q.spec, q.money, q.diff, q.rank); const a = lab.save(), b = port.save(); if (J(a) !== J(b)) return `save 狀態 ${k}：實驗線 ${J(a)?.slice(0, 120)} 本線 ${J(b)?.slice(0, 120)}`; }
  if (!only || only === 'load') for (let k = 0; k < LOADS.length; k++) { const raw = LOADS[k], a = lab.load(raw), b = port.load(raw); if (J(a) !== J(b)) return `load 案例 ${k}（${J(raw)?.slice(0, 100)}）：實驗線 ${J(a).slice(0, 100)} 本線 ${J(b).slice(0, 100)}`; }
  if (!only || only === 'spec') {
    for (const raw of SPEC_LOADS) { const a = lab.specLoad(raw), b = port.specLoad(raw); if (a !== b) return `專精讀檔 ${J(raw)}：實驗線 ${J(a)} 本線 ${J(b)}`; }
    for (const [sp, df, rk, i] of PICKS) { lab.set({ act: '', prog: {}, done: [] }, sp, 0, df, rk); port.set({ act: '', prog: {}, done: [] }, sp, 0, df, rk); const a = lab.pick(i), b = port.pick(i); if (J(a) !== J(b)) return `選方向 專精 ${sp || '無'} 難度 ${df} 等級 ${rk} 編號 ${i}：實驗線 ${J(a)} 本線 ${J(b)}`; }
  }
  return null;
}
const edit = (t, a, b) => { if (t.split(a).length !== 2) throw new Error(`錨點要剛好一處：${a.slice(0, 50)}（${t.split(a).length - 1} 處）`); return t.replace(a, b); };

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d038-tech.json')), T = S.text;
  const sha = s => crypto.createHash('sha256').update(s).digest('hex');
  const src = read('src/sim/rules/tech.ts');

  // ---- 1. 出處與接線要靠的事實 ----
  {
    const bad = [];
    if (S.source?.commit !== PINNED) bad.push(`出處不是 ${PINNED.slice(0, 7)}：${S.source?.commit}`);
    const byName = Object.fromEntries(S.pieces.map(p => [p.name, p]));
    for (const [k, name] of Object.entries(KEY)) { const p = byName[name]; if (!p) bad.push(`缺 ${name}`); else if (sha(T[k]) !== p.sha) bad.push(`${name} 的 sha256 跟錨點記錄不同`); }
    if (S.pieces.length !== Object.keys(KEY).length) bad.push(`樣本 ${S.pieces.length} 段、守衛認得 ${Object.keys(KEY).length} 段`);
    const has = (k, s) => { if (!T[k].includes(s)) bad.push(`${KEY[k]} 裡沒有「${s.slice(0, 60)}」`); };
    has('advance', 'techSpeed343=1+Math.min(7,instituteN+universityN+techParkN*2+campusN*2+dataCenterN+megaProjectN*2+grandResearchN*3)+tq(\'C6\',1,0)+tq(\'D2\',1,0)+tq(\'D5\',2,0)+sq(\'edu\',1,0);');
    has('advance', 'if(next<n.points){tech343.prog[n.id]=next;return;}'); has('advance', 'delete tech343.prog[n.id];tech343.done.push(n.id);tech343.act=\'\';'); has('advance', 'if(TECH_EDU343.includes(n.id))rebuildCov();');
    has('start', 'const fee=(diff===3||tech343.prog[n.id]>0)?0:n.cost;'); has('start', 'if(tech343.act===id)return true;'); has('start', 'money-=fee;tech343.act=id;');
    has('pick', 'if(spec386||diff===3||rankIdx+1<9)return false;'); has('pick', "if(id==='edu')rebuildCov();");
    has('save', 'if(!tech343.act&&!tech343.done.length&&!Object.keys(prog).length)return null;'); has('save', 'v>0&&v<n.points');
    has('callAdvance', 'advanceTech343(inN,un,tpk342,cam342,dtc342,mgN,res466);'); has('saveTech', 'data.tech343=tq343'); has('saveSpec', 'data.spec386=spec386');
    has('loadTech', 'tech343=techLoad343(d.tech343);'); has('loadSpec', "(typeof d.spec386==='string'&&SPEC386[d.spec386])?d.spec386:''");
    has('tq', '(tech343&&tech343.done.includes(id))?on:off'); has('sq', 'spec386===id?on:off');
    if (/\bR\(\)|\bri\(|Math\.random/.test(Object.values(T).join('\n').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))) bad.push('實驗線的科技段落用了亂數（接線的前提變了）');
    // 表裡每個 id 都有人用：實驗線 index.html 裡 tq('X'、sq('x' 的 id 都在表內（守衛用樣本裡的原文段落只能核表本身；這裡核本線 src 裡 tq／sq 用到的 id）
    const ids = new Set(IDS), specs = new Set(Object.keys(TK.SPEC386)), stray = [];
    const srcDir = path.join(ROOT, 'src/sim');
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.ts') ? [path.join(d, e.name)] : []);
    for (const f of walk(srcDir)) { const t = fs.readFileSync(f, 'utf8'); for (const m of t.matchAll(/\btq\((?:[A-Za-z.]+, )?'([A-Z][0-9a-z]*)'/g)) if (!ids.has(m[1])) stray.push(`${path.basename(f)} tq '${m[1]}'`); for (const m of t.matchAll(/\bsq\((?:[A-Za-z.]+, )?'([a-z]+)'/g)) if (!specs.has(m[1])) stray.push(`${path.basename(f)} sq '${m[1]}'`); }
    if (stray.length) bad.push(`本線 src 用到表裡沒有的 id：${stray.slice(0, 4).join('、')}`);
    const code = src.replace(/\/\/.*$/gm, '');
    for (const bannedRe of [/from 'three'/, /document\./, /window\./, /Math\.random/, /Date\.now/, /performance\.now/, /https?:\/\//]) if (bannedRe.test(code)) bad.push(`tech.ts 有 ${bannedRe}`);
    log(!bad.length, `D038 科技原文：實驗線 ${PINNED.slice(0, 7)} 的 ${S.pieces.length} 段（科技表、狀態與 hasTech／tq／TECH_EDU343、canStartTech343、startTech343、advanceTech343、techSave343、techLoad343、專精表與 sq 與 specPick386、每天的研究呼叫、存檔與讀檔的四行）逐段 sha256＝錨點記錄；接線要靠的事實在原文裡成立；本線 src 的 tq／sq 用到的 id 都在表內；tech.ts 是純函式`,
      bad.slice(0, 6).join('；') || `${S.pieces.length} 段、行號 ${S.pieces.map(p => p.line).sort((a, b) => a - b)[0]}–${S.pieces.map(p => p.endLine).sort((a, b) => b - a)[0]}；${IDS.length} 個節點、4 個專精`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const lab0 = makeLab(T), port0 = portSide(TK);
  {
    const d = compare(lab0, port0);
    let can = 0, started = 0, finished = 0, eduFin = 0, zeroLoads = 0, okLoads = 0;
    for (let k = 0; k < STATES.length; k++) { const q = STATES[k]; port0.set(q.st, q.spec, q.money, q.diff, q.rank); for (const id of IDS) if (port0.can(id)) can++; }
    for (const { s, spec } of ADV_STATES) { port0.set(s, spec, 0, 1, 0); for (let day = 0; day < 40; day++) { const r = port0.adv([1, 0, 0, 0, 0, 0, 0]); if (r.rebuilt) eduFin++; if (!r.st.act) finished++; } }
    for (const raw of LOADS) { const r = port0.load(raw); if (r.done.length || r.act || Object.keys(r.prog).length) okLoads++; else zeroLoads++; }
    for (let k = 0; k < STATES.length; k++) { const q = STATES[k]; port0.set(q.st, q.spec, q.money, q.diff, q.rank); if (port0.start(IDS[k % IDS.length]).ok) started++; }
    const bad = [];
    if (can < 1000 || started < 20 || finished < 100 || okLoads < 200 || zeroLoads < 100) bad.push(`案例太單薄（可開始 ${can}、開始成功 ${started}、研究完成 ${finished}、合法讀檔 ${okLoads}、整欄棄用 ${zeroLoads}）`);
    log(d === null && !bad.length, `D038 驗收 1、2（公式半邊）：科技表、開始研究、每天的研究、存與讀、選方向逐項＝實驗線——實驗線原文在 vm 裡跟本線 tech.ts 吃：36 個節點逐欄、300 個隨機狀態 × 36 節點的 canStart、隨機狀態 × 節點 × 資金 × 難度的 startTech、${ADV_STATES.length} 個進行中的狀態連推 40 天的 advanceTech（逐天狀態、速度、完成與教育場重建）、techSave（${STATES.length} 個狀態）、techLoad（${LOADS.length} 個欄位：合法與各種畸形）、專精讀檔白名單（${SPEC_LOADS.length} 個值）、選方向（${PICKS.length} 組）：全部逐項相等`,
      d ?? (bad.join('；') || `可開始 ${can}、開始成功 ${started}、研究完成 ${finished} 次（其中教育場科技 ${eduFin} 次重建）、讀檔合法 ${okLoads}／整欄棄用 ${zeroLoads}，全等`));
  }

  // ---- 3. 注入錯誤要紅 ----
  {
    const ok0 = compare(lab0, port0) === null;
    const lm = [   // [名稱, 鍵, from, to, 哪一項要紅]
      ['速度少算研究院', 'advance', 'instituteN+universityN+', 'universityN+', 'adv'], ['速度少算大學', 'advance', '+universityN+techParkN*2', '+techParkN*2', 'adv'], ['科技園 ×2 變 ×1', 'advance', 'techParkN*2', 'techParkN*1', 'adv'], ['校園 ×2 變 ×1', 'advance', 'campusN*2', 'campusN*1', 'adv'],
      ['資料中心不算', 'advance', '+dataCenterN+', '+', 'adv'], ['大型工程 ×2 變 ×3', 'advance', 'megaProjectN*2', 'megaProjectN*3', 'adv'], ['研究機構 ×3 變 ×2', 'advance', 'grandResearchN*3', 'grandResearchN*2', 'adv'],
      ['速度上限 7 變 8', 'advance', 'Math.min(7,', 'Math.min(8,', 'adv'], ["C6 的 +1 變 +2", 'advance', "tq('C6',1,0)", "tq('C6',2,0)", 'adv'], ["D2 不算", 'advance', "+tq('D2',1,0)", '', 'adv'], ["D5 的 +2 變 +1", 'advance', "tq('D5',2,0)", "tq('D5',1,0)", 'adv'],
      ['專精 edu 的 +1 不算', 'advance', "+sq('edu',1,0);", ';', 'adv'], ['完成條件差一（< 變 <=）', 'advance', 'if(next<n.points)', 'if(next<=n.points)', 'adv'], ['完成不清 act', 'advance', "tech343.done.push(n.id);tech343.act='';", 'tech343.done.push(n.id);', 'adv'],
      ['完成不刪進度', 'advance', 'delete tech343.prog[n.id];', '', 'adv'], ['完成教育場科技不重建', 'advance', 'if(TECH_EDU343.includes(n.id))rebuildCov();', '', 'adv'], ['任何完成都重建', 'advance', 'if(TECH_EDU343.includes(n.id))rebuildCov();', 'rebuildCov();', 'adv'],
      ['互斥不看進度', 'canStart', '||tech343.prog[n.mutex]>0)))return false;', ')))return false;', 'can'], ['互斥不看進行中', 'canStart', '||tech343.act===n.mutex', '', 'can'], ['前置不檢查', 'canStart', 'if(n.pre&&n.pre.some(id=>!hasTech343(id)))return false;', '', 'can'],
      ['any 不檢查', 'canStart', 'if(n.any&&n.any.length&&!n.any.some(id=>hasTech343(id)))return false;', '', 'can'], ['minDone 差一', 'canStart', 'tech343.done.length<n.minDone', 'tech343.done.length<=n.minDone', 'can'], ['已完成也能開始', 'canStart', '||hasTech343(n.id)||(n.mutex', '||(n.mutex', 'can'],
      ['費用：沙盒不免費', 'start', 'diff===3||', '', 'start'], ['費用：已有進度不免費', 'start', '||tech343.prog[n.id]>0', '', 'start'], ['錢不夠的比較差一（< 變 <=）', 'start', 'if(money<fee)', 'if(money<=fee)', 'start'], ['已在做它還要付錢', 'start', 'if(tech343.act===id)return true;', '', 'start'],
      ['開始不扣錢', 'start', 'money-=fee;', '', 'start'], ['開始不設 act', 'start', ';tech343.act=id;', ';', 'start'],
      ['存檔進度濾除少 < points', 'save', 'v>0&&v<n.points', 'v>0', 'save'], ['存檔進度濾除少整數', 'save', 'Number.isInteger(v)&&', '', 'save'], ['存檔零狀態也落欄位', 'save', 'if(!tech343.act&&!tech343.done.length&&!Object.keys(prog).length)return null;', '', 'save'],
      ['讀檔不驗 act 是字串', 'load', "typeof raw.act!=='string'||", '', 'load'], ['讀檔 prog 接受陣列', 'load', '||Array.isArray(raw.prog)||', '||', 'load'], ['讀檔不驗 done 是陣列', 'load', '||!Array.isArray(raw.done))return zero;', ')return zero;', 'load'],
      ['讀檔 act 不認得也收', 'load', 'if(raw.act&&!TECH343_BY_ID[raw.act])return zero;', '', 'load'], ['讀檔 done 重複也收', 'load', '||seen[id]||(n.mutex&&seen[n.mutex]))return zero;', '||(n.mutex&&seen[n.mutex]))return zero;', 'load'], ['讀檔 done 互斥雙在也收', 'load', '||seen[id]||(n.mutex&&seen[n.mutex])', '||seen[id]', 'load'],
      ['讀檔進度 v>= points 也收', 'load', '||v>=n.points||seen[id])return zero;', '||seen[id])return zero;', 'load'], ['讀檔進度小數也收', 'load', '!Number.isInteger(v)||', '', 'load'], ['讀檔進度與完成並存也收', 'load', '||v>=n.points||seen[id]', '||v>=n.points', 'load'],
      ['讀檔 act 已完成也收', 'load', 'if(raw.act&&(seen[raw.act]||', 'if(raw.act&&(', 'load'], ['讀檔進度互斥衝突也收', 'load', '(seen[m]||prog[m]!==undefined||raw.act===m)', '(seen[m])', 'load'],
      ['選方向：Lv.9 變 Lv.8', 'pick', 'rankIdx+1<9', 'rankIdx+1<8', 'spec'], ['選方向：沙盒也能選', 'pick', '||diff===3||', '||', 'spec'], ['選方向：已選過還能再選', 'pick', 'if(spec386||', 'if(', 'spec'], ['選 edu 不重建', 'pick', "if(id==='edu')rebuildCov();", '', 'spec'],
      ['專精讀檔不驗型', 'loadSpec', "typeof d.spec386==='string'&&", '', 'spec'],
    ];
    const pm = [
      ['速度少算研究院', 'c.inN + c.un + ', 'c.un + ', 'adv'], ['速度少算大學', '+ c.un + c.tpk342 * 2', '+ c.tpk342 * 2', 'adv'], ['科技園 ×2 變 ×1', 'c.tpk342 * 2', 'c.tpk342 * 1', 'adv'], ['校園 ×2 變 ×1', 'c.cam342 * 2', 'c.cam342 * 1', 'adv'],
      ['資料中心不算', '+ c.dtc342 +', '+', 'adv'], ['大型工程 ×2 變 ×3', 'c.mgN * 2', 'c.mgN * 3', 'adv'], ['研究機構 ×3 變 ×2', 'c.res466 * 3', 'c.res466 * 2', 'adv'], ['速度上限 7 變 8', 'Math.min(7,', 'Math.min(8,', 'adv'],
      ["C6 的 +1 變 +2", "(has(done, 'C6') ? 1 : 0)", "(has(done, 'C6') ? 2 : 0)", 'adv'], ["D5 的 +2 變 +1", "(has(done, 'D5') ? 2 : 0)", "(has(done, 'D5') ? 1 : 0)", 'adv'], ['專精 edu 的 +1 不算', "(spec === 'edu' ? 1 : 0);", '0;', 'adv'],
      ['完成條件差一（< 變 <=）', 'if (next < n.points)', 'if (next <= n.points)', 'adv'], ['完成不清 act', "done.push(n.id); st.act = '';", 'done.push(n.id);', 'adv'], ['完成不刪進度', 'delete st.prog[n.id]; ', '', 'adv'],
      ['互斥不看進度', '|| st.prog[n.mutex] > 0))) return false;', '))) return false;', 'can'], ['互斥不看進行中', '|| st.act === n.mutex || st.prog[n.mutex] > 0))) return false;', '|| st.prog[n.mutex] > 0))) return false;', 'can'], ['前置不檢查', 'if (n.pre && n.pre.some(id => !has(done, id))) return false;', '', 'can'],
      ['any 不檢查', 'if (n.any && n.any.length && !n.any.some(id => has(done, id))) return false;', '', 'can'], ['minDone 差一', 'return !(n.minDone && done.length < n.minDone);', 'return !(n.minDone && done.length <= n.minDone);', 'can'], ['已完成也能開始', '!n || has(done, n.id) || (n.mutex', '!n || (n.mutex', 'can'],
      ['費用：沙盒不免費', '(diff === 3 || st.prog[n.id] > 0) ? 0 : n.cost', '(st.prog[n.id] > 0) ? 0 : n.cost', 'start'], ['費用：已有進度不免費', '(diff === 3 || st.prog[n.id] > 0) ? 0 : n.cost', '(diff === 3) ? 0 : n.cost', 'start'], ['錢不夠的比較差一（< 變 <=）', 'if (money < fee)', 'if (money <= fee)', 'start'],
      ['已在做它還要付錢', 'if (st.act === id) return { ok: true, fee: 0 };', '', 'start'], ['開始不設 act', '  st.act = id;\n  return { ok: true, fee };', '  return { ok: true, fee };', 'start'],
      ['存檔進度濾除少 < points', 'v > 0 && v < n.points', 'v > 0', 'save'], ['存檔進度濾除少整數', 'Number.isInteger(v) && v > 0', 'v > 0', 'save'], ['存檔零狀態也落欄位', 'if (!st.act && !done.length && !Object.keys(prog).length) return null;', '', 'save'],
      ['讀檔不驗 act 是字串', "typeof r.act !== 'string' || ", '', 'load'], ['讀檔 prog 接受陣列', '|| Array.isArray(r.prog) ||', '||', 'load'], ['讀檔不驗 done 是陣列', '|| !Array.isArray(r.done)) return zero();', ') return zero();', 'load'],
      ['讀檔 act 不認得也收', 'if (act && !TECH343_BY_ID[act]) return zero();', '', 'load'], ['讀檔 done 重複也收', '|| seen[id] || (n.mutex && seen[n.mutex])) return zero();', '|| (n.mutex && seen[n.mutex])) return zero();', 'load'], ['讀檔 done 互斥雙在也收', '|| seen[id] || (n.mutex && seen[n.mutex])', '|| seen[id]', 'load'],
      ['讀檔進度 v>= points 也收', '|| (v as number) >= n.points || seen[id]) return zero();', '|| seen[id]) return zero();', 'load'], ['讀檔進度小數也收', '!Number.isInteger(v) || ', '', 'load'], ['讀檔進度與完成並存也收', '|| (v as number) >= n.points || seen[id]', '|| (v as number) >= n.points', 'load'],
      ['讀檔 act 已完成也收', 'if (act && (seen[act] || (', 'if (act && ((', 'load'], ['讀檔進度互斥衝突也收', '(seen[m] || prog[m] !== undefined || act === m)', '(seen[m])', 'load'],
      ['選方向：Lv.9 變 Lv.8', 'rankIdx + 1 < SPEC_MIN_RANK', 'rankIdx + 1 < SPEC_MIN_RANK - 1', 'spec'], ['選方向：沙盒也能選', 'if (spec || diff === 3 ||', 'if (spec ||', 'spec'], ['選方向：已選過還能再選', 'if (spec || diff === 3', 'if (diff === 3', 'spec'],
      ['專精讀檔不驗型', "typeof raw === 'string' && (SPEC386", '(SPEC386', 'spec'],
    ];
    const missed = [], names = [];
    for (const [name, key, from, to, only] of lm) {
      let lab; try { lab = makeLab({ ...T, [key]: edit(T[key], from, to) }); } catch (e) { missed.push(`實驗線「${name}」載入失敗 ${e.message.slice(0, 80)}`); continue; }
      if (compare(lab, port0, only) === null) missed.push(`實驗線 ${name}`); names.push(`實驗線：${name}`);
    }
    for (const [name, from, to, only] of pm) {
      let M; try { M = await loadMod('src/sim/rules/tech.ts', [[from, to]]); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message.slice(0, 80)}`); continue; }
      if (compare(lab0, portSide(M), only) === null) missed.push(`本線 ${name}`); names.push(`本線：${name}`);
    }
    log(ok0 && !missed.length, `D038 驗收 2（突變）：注入錯誤要紅——實驗線原文 ${lm.length} 個、本線原碼 ${pm.length} 個（速度的每一項與上限、完成條件與收尾、教育場重建、互斥、前置、any、minDone、費用與免費條件、錢不夠的比較、讀檔的每一種驗型、存檔的進度濾除與零狀態、選方向的三個條件與專精讀檔驗型）；每個突變指定哪一項比對要紅、只跑那一項；沒改的先核過全等`,
      ok0 ? (missed.join('；') || `${names.length} 個全紅`) : '沒改的就不等（上一項已紅）');
  }
}
