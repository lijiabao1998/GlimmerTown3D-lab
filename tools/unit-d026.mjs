// D026 Node 守衛：每日災禍——死亡前置、火災、犯罪、廢棄、疾病、死亡（驗收 1、2、7 的公式半邊、6 的突變）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d026-hazard.json（tools/lab-hazard.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；韌性常數跟本線相同；
//   2. 逐項＝實驗線：實驗線原文（55014–55036 死亡前置、55757–55797 火災、55810–55833 犯罪與廢棄、55834–55865 疾病與死亡，加上它們讀的韌性層、夜間治安、科技與專業化三元、streetHash、醫療覆蓋判斷）
//      在 vm 裡，跟本線 src/sim/rules/hazard.ts 吃同一批隨機小圖與同一條亂數流、連跑三天（旗標、焦土跨日帶）：每一棟的每一個旗標、每一格的焦土、deathPenalty 整張、治癒與滯留與病患計數、
//      提示的位置、地價髒框與污染源的呼叫、亂數抽了幾次與最後一個亂數，每一步逐位相等；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一批（每一個機率與係數、每一個覆蓋判斷、亂數的抽法、天數門檻、床位比較、焦土與污染源……），沒改的先核過全等；
//   4. 玩家的三個處置（63426–63446）：實驗線的三個按鈕處理函式在 vm 裡，跟 src/sim/act.ts 吃同一批狀態與資金（0、29、30、49、50、大額）逐項相等。
//   接線、存檔、實驗線頁面實跑：見 tools/unit-d026-live.mjs。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as HZ from '../src/sim/rules/hazard.ts';
import { allocGrids, stampPolSrc } from '../src/sim/rules/fields.ts';
import { actAt, ACT_COST } from '../src/sim/act.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const PIECES = ['clamp', 'spec386', 'sq', 'tq', 'PUMP_FLOOD_DAMAGE_MUL', 'DISASTER_CENTER_DAMAGE_MUL', 'SHELTER_CASUALTY_MUL', 'drainageLegacy454', 'waterLegacy449', 'resilience364At', 'disasterBlocked364', 'nightCrimeMul487', 'streetHash', 'civicHealthAccess495',
  'preDeath', 'fire', 'crime', 'disease', 'buttons'];
const KEY = { preDeath: 'tick 死亡前置', fire: 'tick 火災', crime: 'tick 犯罪與廢棄', disease: 'tick 疾病與死亡', buttons: '按鈕 處理犯罪、治療、滅火' };   // 樣本 pieces 的名字 → text 的鍵

export async function d026Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D026 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 實驗線那一邊：原文在 vm 裡（strict）。樁：提示、地價髒框、污染源、保險理賠只記呼叫；回退設定的開關（T495 關、舊式供水、舊式排水）；亂數是同一條 mulberry32、數呼叫次數 ----
function makeLab(T) {
  const ctx = vm.createContext({});
  ctx.__mk = seed => { const g = mulberry32(seed); return () => g(); };
  vm.runInContext(`'use strict';
let N=1,tiles=[],tickBld=[],COV={},day=1,pol=null,drought=false,civic495={ready:false},flowStat384={ok:false},nightCity487={ready:false,safety:{score:0}},tech343={done:[]};
let __alerts=[],__log=[],__n=0,R=()=>0,ri=n=>0;
const window={__noCivicServices495:true,__legacyWater449:true,__legacyDrainage454:true},DROUGHT_FIRE_MULT=2.5;
const idx=(x,y)=>y*N+x,inMap=(x,y)=>x>=0&&y>=0&&x<N&&y<N,toast=(m,k,x,y)=>{__alerts.push([m,x,y]);},sErr=()=>{},townName='',waterDiseaseRisk472=()=>0;
const stampPolSrc=(x,y,k,s)=>{__log.push(['pol',x,y,k,s]);},insPayout=(x,y)=>{__log.push(['ins',x,y]);},markLandDirty=(x,y,r)=>{__log.push(['land',x,y,r]);};
${T.clamp}
${T.spec386}
${T.sq}
${T.tq}
${T.PUMP_FLOOD_DAMAGE_MUL}
${T.DISASTER_CENTER_DAMAGE_MUL}
${T.SHELTER_CASUALTY_MUL}
${T.drainageLegacy454}
${T.waterLegacy449}
${T.resilience364At}
${T.disasterBlocked364}
${T.nightCrimeMul487}
${T.streetHash}
${T.civicHealthAccess495}
function __hazard(){
${T.preDeath}
${T.fire}
${T.crime}
${T.disease}
return {deathPenalty:Array.from(deathPenalty),cemCap,soothed,cured:medCured387,queued:medQueued387,sickN:sickN387};
}
globalThis.__api={
  init:(n,ts,cov,seed)=>{N=n;tiles=ts;COV=cov;const g=__mk(seed);__n=0;R=()=>{__n++;return g();};ri=k=>Math.floor(R()*k);},
  day:d=>{day=d.day;pol=d.pol;tech343={done:d.tech};spec386=d.spec;nightCity487=d.night;flowStat384=d.medCap===Infinity?{ok:false}:{ok:true,med:{cap:d.medCap}};__alerts=[];__log=[];
    tickBld=[];for(let i=0;i<N*N;i++)if(tiles[i].bld)tickBld.push(i);
    const r=__hazard();return {...r,alerts:__alerts.map(([m,x,y])=>[m.startsWith('🔥')?'fire':m.startsWith('🚓')?'crime':m.startsWith('🏚')?'abandon':m.startsWith('🏥')?'sick':m.startsWith('💀')?'death':m,x,y]),log:__log,n:__n};},
  tail:()=>R(),tiles:()=>tiles,nightMul:(i,b)=>nightCrimeMul487(i,b),
};`, ctx, { filename: 'lab:hazard' });
  return ctx.__api;
}

// ---- 本線那一邊（hazard.ts；突變時傳改壞的一份）----
function makeMine(M) {
  let w, g, f, rng, n = 0, g0 = null, N = 1, lab = null;
  return {
    init(N0, ts, cov, seed, labApi) {
      lab = labApi; N = N0; w = { N, tiles: ts }; g = allocGrids(N); for (const k of Object.keys(cov)) g.COV[k].set(cov[k]); g.POLBASE.fill(100); g.POL.fill(100);
      f = { COV: g.COV }; const r = mulberry32(seed); n = 0; rng = { R() { n++; return r(); }, ri(k) { n++; return Math.floor(r() * k); } };
    },
    day(d) {
      const order = []; for (let i = 0; i < N * N; i++) if (w.tiles[i].bld) order.push(i);
      g0 = { POLBASE: g.POLBASE.slice(), POL: g.POL.slice() };
      const hx = { pol: d.pol, spec: d.spec, nightCrimeMul: d.night.ready ? (i, b) => lab.nightMul(i, b) : undefined };
      const dp = M.deathPre(w, f, order);
      const fr = M.fireStep(w, g, f, rng, order, d.day, d.tech, hx);
      const cr = M.crimeStep(w, f, rng, order, d.tech, hx);
      const ab = M.abandonStep(w, rng, order);
      const ds = M.diseaseStep(w, f, rng, order, d.medCap);
      const dh = M.deathStep(w, rng, order);
      const at = i => [i % N, (i / N) | 0], alerts = [];
      for (const [kind, i] of [['fire', fr.first], ['crime', cr.first], ['abandon', ab.first], ['sick', ds.first], ['death', dh.first]]) if (i >= 0) alerts.push([kind, ...at(i)]);
      const lg = [];
      for (const b of fr.burned) { const [x, y] = at(b.i); if (b.k === 3) lg.push(['pol', x, y, 3, -1]); lg.push(['ins', x, y]); }   // 燒毀的順序：撤污染源、再理賠（實驗線 55796）
      for (const i of cr.crimes) { const [x, y] = at(i); lg.push(['land', x, y, 4]); }
      return { deathPenalty: Array.from(dp.penalty), cemCap: dp.cemCap, soothed: dp.soothed, cured: ds.cured, queued: ds.queued, sickN: dh.sickN, alerts, log: lg, n,
        ev: { ignited: fr.ignited, spread: fr.spread, burned: fr.burned, crimes: cr.crimes, abandons: ab.abandons, sicks: ds.sicks, cures: ds.cures, deaths: dh.deaths, ended: dp.ended } };
    },
    tail: () => rng.R(),
    tiles: () => w.tiles,
    // 污染源：實驗線那邊只記了 stampPolSrc 的呼叫，這裡把它們照本線的 stampPolSrc 蓋一遍，跟本線實際蓋出來的污染場逐格比
    polOk(labLog) { const e = { N, POLBASE: g0.POLBASE.slice(), POL: g0.POL.slice(), POLTREE: new Uint8Array(N * N) }; for (const q of labLog) if (q[0] === 'pol') stampPolSrc(e, q[1], q[2], q[3], q[4]); return J(Array.from(e.POLBASE)) === J(Array.from(g.POLBASE)) && J(Array.from(e.POL)) === J(Array.from(g.POL)); },
  };
}

// ---- 隨機輸入 ----
const COV_KEYS = ['fire', 'fire2', 'fireHQ', 'firewatch', 'police', 'police2', 'prison', 'court', 'hospital', 'ambulance', 'megahosp', 'medcamp', 'clinic', 'cemetery', 'cem2', 'crem', 'pump', 'resilience', 'shelter'];
// hot＝住商工的等級拉到 20–200（實驗線不夾等級）：起火、犯罪、生病的機率跟等級成正比，等級小的話 .0005 這種機率在小圖上幾乎抽不到，乘數（科技、專業化、政策、覆蓋）改了也看不出來
const FAMS = ['mix', 'fire', 'crime', 'sick', 'death', 'ind', 'cover', 'mix2', 'hot', 'hotFire', 'hotCrime', 'hotSick', 'hotSick'];
const TECHS = ['A4a', 'A4b', 'B3', 'B2', 'B4b', 'B7'];
function cases26(count = 800) {
  const R = mulberry32(20261210), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)], f3 = () => Math.round(R() * 1000) / 1000, out = [];
  for (let m = 0; m < count; m++) {
    const fam = FAMS[m % FAMS.length], hot = fam.startsWith('hot'), N = int(6, 13), tiles = Array.from({ length: N * N }, () => ({ t: 2, bld: null })), at = (x, y) => tiles[y * N + x];
    // 覆蓋：每個場一個密度（0、稀、密、全滿）；有的家族偏向某幾個
    const dens = {}; for (const k of COV_KEYS) dens[k] = pick([0, 0, .15, .5, .9, 1]);
    if (hot) { dens.police = fam === 'hotCrime' ? pick([0, 0, .1]) : pick([0, .5]); dens.police2 = pick([0, 0, .1]); dens.prison = pick([0, 0, .2]); dens.hospital = fam === 'hotSick' ? pick([0, .1]) : pick([0, .5]); dens.clinic = fam === 'hotSick' ? pick([0, .3]) : pick([0, .5]);
      dens.fire = pick([0, .3]); dens.fire2 = pick([0, 0, .2]); dens.fireHQ = pick([0, 0, .2]); dens.firewatch = pick([0, .4]); dens.court = pick([0, .5]); dens.resilience = pick([0, .4]); dens.shelter = pick([0, .4]); }
    if (fam === 'fire' || fam === 'ind') { dens.fire = pick([0, .3, .7]); dens.fire2 = pick([0, 0, .2]); dens.fireHQ = 0; dens.firewatch = pick([0, .5, .9]); dens.resilience = pick([0, .5, 1]); dens.shelter = pick([0, .5, 1]); }
    if (fam === 'crime') { dens.police = pick([0, 0, .2]); dens.police2 = pick([0, 0, .2]); dens.prison = pick([0, .3]); dens.court = pick([0, .5, 1]); }
    if (fam === 'sick') { dens.hospital = pick([0, .2, .6]); dens.clinic = pick([0, .3, .8]); dens.ambulance = pick([0, 0, .3]); dens.megahosp = pick([0, 0, .2]); dens.medcamp = pick([0, 0, .2]); }
    if (fam === 'death') { dens.cemetery = pick([0, .2, .6]); dens.cem2 = pick([0, 0, .3]); dens.crem = pick([0, 0, .3]); }
    const cov = {}; for (const k of COV_KEYS) cov[k] = Uint8Array.from({ length: N * N }, () => R() < dens[k] ? 1 : 0);
    // 建築
    const put = (k, sz, extra) => {
      for (let a = 0; a < 40; a++) {
        const x = int(0, N - sz), y = int(0, N - sz); let free = true;
        for (let dy = 0; dy < sz && free; dy++) for (let dx = 0; dx < sz; dx++) if (at(x + dx, y + dy).bld) { free = false; break; }
        if (!free) continue;
        at(x, y).bld = { k, lv: hot ? int(20, 200) : int(1, 3), v: 0, age: int(0, 40), pw: true, h: .6, ...(sz > 1 ? { sz } : {}), ...extra };
        for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (dx || dy) at(x + dx, y + dy).bld = { k, ref: [x, y] };
        return;
      }
    };
    const nb = int(4, Math.floor(N * N * .7));
    for (let q = 0; q < nb; q++) {
      const r = R();
      let k = r < .35 ? 1 : r < .5 ? 2 : r < .68 ? 3 : pick([4, 5, 7, 12, 13, 11, 6, 28, 48, 135, 16, 16, 107, 33, 105, 127, 54]);
      if (fam === 'fire' || fam === 'ind') k = ch(.5) ? 3 : ch(.6) ? pick([1, 2]) : pick([1, 3, 5]);
      if (fam === 'sick' || fam === 'death') k = ch(.75) ? 1 : pick([1, 2, 3, 12, 13, 16, 54, 107, 28, 48]);
      if (fam === 'crime' || fam === 'hotCrime') k = pick([1, 2, 3, 1, 2]);
      if (fam === 'hotFire') k = ch(.5) ? 3 : pick([1, 2]);
      if (fam === 'hotSick') k = ch(.85) ? 1 : pick([2, 3, 12, 13]);
      const extra = {};
      if (k <= 3) {
        const F = fam === 'fire' || fam === 'ind' ? .3 : hot ? .03 : fam === 'mix' || fam === 'mix2' ? .1 : .04;
        if (ch(F)) extra.fire = pick([1, 1, 2, 3, 4]);
        const C = fam === 'crime' ? .4 : hot ? .03 : .08; if (ch(C)) { extra.crime = 1; if (ch(.85)) extra.crimeDays = pick([0, 1, 5, 12, 13, 14, 14, 15, 16]); }
        if ((fam === 'crime' && ch(.15)) || ch(.03)) extra.abandoned = 1;
      }
      if (k === 1) {
        const S = fam === 'sick' ? .35 : hot ? .03 : .08; if (ch(S)) { extra.sick = 1; if (ch(.85)) extra.sickDays = pick([0, 1, 2, 2, 3, 4]); }
        const D = fam === 'death' ? .35 : .06; if (ch(D)) { extra.death = 1; if (ch(.9)) extra.deathAge = pick([0, 1, 5, 8, 9, 9, 10, 11]); if (ch(.3)) extra.sick = 1; }
        extra.den = int(1, 5); extra.we = int(0, 2);
      }
      put(k, k === 54 ? 2 : k === 33 ? 2 : k === 105 ? 3 : 1, extra);
    }
    const seed = int(1, 2 ** 30), steps = [];
    let day0 = ch(.3) ? 0 : int(1, 5000);
    for (let s = 0; s < 3; s++) {
      const techs = TECHS.filter(() => ch(.35)), medCap = ch(.4) ? Infinity : ch(.2) ? 0 : int(1, 6);
      steps.push({ day: day0 + s + 1, tech: techs, spec: pick(['', '', 'ind', 'green']), pol: ch(.5) ? null : { smokeDetect: ch(.5), curfew: ch(.5), nightMarket: ch(.5), parkNight: ch(.5) }, night: ch(.65) ? { ready: false } : { ready: true, safety: { score: f3() } }, medCap });
    }
    out.push({ fam, N, tiles, cov, seed, steps });
  }
  return out;
}
const cloneTiles = tiles => tiles.map(t => ({ ...t, bld: t.bld ? { ...t.bld, ...(t.bld.ref ? { ref: [...t.bld.ref] } : {}) } : null }));
const snap = tiles => tiles.map(t => { const b = t.bld; return [t.ruin ? 1 : 0, b ? [b.k, b.ref ? 1 : 0, +(b.fire || 0), +(b.crime || 0), b.crimeDays ?? -1, +(b.sick || 0), b.sickDays ?? -1, +(b.death || 0), b.deathAge ?? -1, +(b.abandoned || 0)] : null]; });

// ---- 玩家的三個處置：實驗線的三個按鈕處理函式在 vm 裡 ----
function makeButtons(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';let N=1,tiles=[],money=0,__log=[],__H={};
const inMap=(x,y)=>x>=0&&y>=0&&x<N&&y<N,idx=(x,y)=>y*N+x,T=i=>tiles[i],markLandDirty=(x,y,r)=>{__log.push(['land',x,y,r]);},toast=(m,k)=>{__log.push(['toast',m]);},updHud=()=>{},hideInfo=()=>{},sErr=()=>{};
const $=sel=>({addEventListener:(ev,h)=>{__H[sel]=h;}});
function __bind(x,y){
${T.buttons}
}
globalThis.__api={init:(n,ts,m)=>{N=n;tiles=ts;money=m;__log=[];__H={};},bind:(x,y)=>__bind(x,y),click:sel=>{if(__H[sel])__H[sel]();return {money,log:__log,has:!!__H[sel]};}};`, ctx, { filename: 'lab:buttons' });
  return ctx.__api;
}

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d026-hazard.json')), T = S.text;

  // ---- 1. 出處與常數 ----
  {
    const bad = [], names = (S.pieces ?? []).map(p => p.name), want = PIECES.map(n => KEY[n] ?? n);
    if (S.source?.commit !== PINNED) bad.push(`commit ${S.source?.commit}`);
    if (J(names) !== J(want)) bad.push(`段落 ${names.join('、')}`);
    for (const p of S.pieces ?? []) {
      const txt = S.text[Object.keys(KEY).find(k => KEY[k] === p.name) ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    const lab = vm.runInNewContext(`${T.PUMP_FLOOD_DAMAGE_MUL}\n${T.DISASTER_CENTER_DAMAGE_MUL}\n${T.SHELTER_CASUALTY_MUL}\n[DISASTER_CENTER_DAMAGE_MUL,DISASTER_CENTER_RECOVERY_CHANCE,SHELTER_CASUALTY_MUL]`);
    const mine = [HZ.DISASTER_CENTER_DAMAGE_MUL, HZ.DISASTER_CENTER_RECOVERY_CHANCE, HZ.SHELTER_CASUALTY_MUL];
    if (J(lab) !== J(mine)) bad.push(`韌性常數：實驗線 ${J(lab)}≠本線 ${J(mine)}`);
    log(!bad.length, `D026 災禍原文：實驗線 ${PINNED.slice(0, 7)} 的 ${PIECES.length} 段（死亡前置 55014–55036、火災 55757–55797、犯罪與廢棄 55810–55833、疾病與死亡 55834–55865、韌性讀取層 53568–53580 與係數 39656–39658、夜間治安 37344、科技與專業化三元、streetHash、醫療覆蓋判斷、三個按鈕 63426–63446）逐段 sha256＝錨點記錄；韌性常數跟本線相同`,
      bad.join('；') || `災害應變中心 損害 ×${HZ.DISASTER_CENTER_DAMAGE_MUL}、恢復 ${HZ.DISASTER_CENTER_RECOVERY_CHANCE}；避難公園 ×${HZ.SHELTER_CASUALTY_MUL}`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const C = cases26();
  const runCase = (c, lab, mine) => {
    const A = cloneTiles(c.tiles), B = cloneTiles(c.tiles), recs = [];   // burnedOk：本線回報的燒毀（種類、等級、屋齡）＝燒毀前那一格的建築（實驗線燒完格子就空了，只能拿前一刻的建築核）
    lab.init(c.N, A, c.cov, c.seed); mine.init(c.N, B, c.cov, c.seed, lab);
    for (const d of c.steps) {
      const before = snap(A), pre = mine.tiles().map(t => t.bld ? [t.bld.k, t.bld.lv, t.bld.age] : null), a = lab.day(d), b = mine.day(d), sa = snap(lab.tiles()), sb = snap(mine.tiles());
      const { ev, ...bb } = b;
      recs.push({ a: J({ ...a, snap: sa }), b: J({ ...bb, snap: sb }), pol: mine.polOk(a.log) && ev.burned.every(q => J([q.k, q.lv, q.age]) === J(pre[q.i])), before, after: sa, ev, d });
    }
    recs.push({ tail: [lab.tail(), mine.tail()] });
    return recs;
  };
  const compare = (lab, mine, stopAtFirst = false) => {
    const st = { steps: 0, diffs: 0, first: '', cnt: {} };
    const bump = (k, v = 1) => { if (v) st.cnt[k] = (st.cnt[k] ?? 0) + v; };
    for (let m = 0; m < C.length; m++) {
      for (const q of runCase(C[m], lab, mine)) {
        if (q.tail) { if (q.tail[0] !== q.tail[1]) { st.diffs++; st.first ||= `第 ${m} 張（${C[m].fam}）最後一個亂數 實驗線 ${q.tail[0]}≠本線 ${q.tail[1]}`; if (stopAtFirst) return st; } continue; }
        st.steps++;
        const e = q.ev, N = C[m].N;
        bump('ignite', e.ignited.length); bump('spread', e.spread.length); bump('burn', e.burned.length); bump('burnInd', e.burned.filter(b => b.k === 3).length);
        bump('crime', e.crimes.length); bump('abandon', e.abandons.length); bump('sick', e.sicks.length); bump('cure', e.cures.length); bump('death', e.deaths.length); bump('deathEnded', e.ended.length);
        for (let i = 0; i < N * N; i++) {
          const p = q.before[i][1], n2 = q.after[i][1];
          if (p && n2 && p[2] > 0 && n2[2] > 0 && n2[2] < p[2]) bump('fireDown');   // 韌性：燃燒天數倒退
          if (p && n2 && p[5] === 1 && n2[5] === 0 && p[7] === 0) bump('sickGone');
        }
        if (q.pol === false) { st.diffs++; st.first ||= `第 ${m} 張（${C[m].fam}）第 ${st.steps} 步：污染源的效果跟實驗線的呼叫對不上，或燒毀回報的種類、等級、屋齡不是燒毀前的樣子`; if (stopAtFirst) return st; }
        if (q.a !== q.b) {
          st.diffs++;
          if (!st.first) {
            const x = JSON.parse(q.a), y = JSON.parse(q.b);
            st.first = `第 ${m} 張（${C[m].fam}，N=${N}）第 ${st.steps} 步：${Object.keys(x).filter(k => J(x[k]) !== J(y[k])).slice(0, 4).map(k => `${k} 實驗線 ${J(x[k]).slice(0, 80)}≠本線 ${J(y[k]).slice(0, 80)}`).join('；')}`;
          }
          if (stopAtFirst) return st;
        }
        const r = JSON.parse(q.a);
        bump('alerts', r.alerts.length); bump('soothed', r.soothed > 0 ? 1 : 0); bump('penaltyCells', r.deathPenalty.filter(Boolean).length > 0 ? 1 : 0); bump('queued', r.queued > 0 ? 1 : 0); bump('cured', r.cured > 0 ? 1 : 0);
        bump('landMark', r.log.filter(x => x[0] === 'land').length); bump('polMark', r.log.filter(x => x[0] === 'pol').length);
      }
    }
    return st;
  };
  const NEED = { ignite: 500, spread: 200, burn: 200, burnInd: 100, crime: 500, abandon: 100, sick: 200, cure: 200, death: 50, deathEnded: 100, fireDown: 100, sickGone: 200, alerts: 1000, soothed: 100, penaltyCells: 200, queued: 50, cured: 200, landMark: 500, polMark: 100 };
  const base = compare(makeLab(T), makeMine(HZ));
  const lacking = Object.entries(NEED).filter(([k, v]) => (base.cnt[k] ?? 0) < v).map(([k, v]) => `${k} ${(base.cnt[k] ?? 0)}<${v}`);
  log(base.diffs === 0 && !lacking.length,
    `D026 驗收 2：災禍逐項＝實驗線——實驗線原文在 vm 裡跟本線 hazard.ts 吃 ${C.length} 張隨機小圖、每張連三天共 ${base.steps} 步（旗標與焦土跨日帶；死亡前置、火災、犯罪、廢棄、疾病、死亡同一條亂數流；覆蓋 19 個場、科技與專業化與政策與夜間治安與床位都隨機）：`
      + `每一棟的每一個旗標、每一格的焦土、deathPenalty 整張、治癒與滯留與病患計數、提示的位置、地價髒框與污染源的呼叫、亂數抽了幾次與最後一個亂數，每一步逐位相等`,
    base.first || (lacking.length ? `覆蓋不夠：${lacking.join('、')}｜${J(base.cnt)}` : `${base.steps} 步全等；` + Object.keys(NEED).map(k => `${k} ${base.cnt[k]}`).join('、')));

  // ---- 3. 注入錯誤要紅 ----
  {
    const missed = [], KILLS = process.env.D026_KILLS ? [] : null;
    const kill = (name, n) => { KILLS?.push([n, name]); return n; };
    for (const [name, key, from, to] of LAB_MUTANTS) {
      const t2 = { ...T };
      if (typeof t2[key] !== 'string' || t2[key].split(from).length !== 2) { missed.push(`實驗線「${name}」錨點不唯一（${t2[key] === undefined ? '沒有這段' : t2[key].split(from).length - 1}）`); continue; }
      t2[key] = t2[key].replace(from, to);
      let d; try { d = kill(`實驗線 ${name}`, compare(makeLab(t2), makeMine(HZ), !KILLS).diffs); } catch (e) { missed.push(`實驗線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`實驗線「${name}」`);
    }
    for (const [name, from, to] of MINE_MUTANTS) {
      let M; try { M = await loadMod('src/sim/rules/hazard.ts', [[from, to]]); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = kill(`本線 ${name}`, compare(makeLab(T), makeMine(M), !KILLS).diffs); } catch (e) { missed.push(`本線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`本線「${name}」`);
    }
    if (KILLS) console.error('擊殺次數（少→多，前 45）：\n' + KILLS.sort((a, b) => a[0] - b[0]).slice(0, 45).map(([n, name]) => `${String(n).padStart(6)}  ${name}`).join('\n'));
    const baseOk = !compare(makeLab(T), makeMine(await loadMod('src/sim/rules/hazard.ts', [])), true).diffs;
    log(baseOk && !missed.length, `D026 驗收 6：注入錯誤要紅——實驗線原文 ${LAB_MUTANTS.length} 個、本線原碼 ${MINE_MUTANTS.length} 個（每一個機率與係數、每一個覆蓋判斷、亂數的抽法與順序、天數門檻、床位比較、焦土與污染源、地價髒框……）；沒改的先核過全等`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }

  // ---- 4. 玩家的三個處置 ----
  {
    const lab = makeButtons(T), bad = [], cnt = { ok: 0, lackFire: 0, lackSick: 0, nothing: 0, crime: 0 }, R = mulberry32(20261211), pick = a => a[Math.floor(R() * a.length)];
    for (let m = 0; m < 600; m++) {
      const N = 6, mk = () => Array.from({ length: N * N }, () => ({ bld: null })), tl = mk(), tm = mk(), x = 2, y = 3, i = y * N + x;
      const b = pick([null, { k: 1, lv: 1, age: 0 }, { k: 2, lv: 2, age: 0 }, { k: 4, lv: 1, age: 0 }, { k: 1, lv: 1, ref: [0, 0] }]);
      if (b) { if (R() < .6) b.fire = pick([1, 3, 4]); if (R() < .6) b.crime = 1, b.crimeDays = pick([0, 5, 14]); if (R() < .6) b.sick = 1, b.sickDays = pick([0, 2]); tl[i].bld = { ...b }; tm[i].bld = { ...b }; }
      const money = pick([0, 29, 30, 49, 50, 51, 3000, -5]), sel = { fire: '#fireBtn', crime: '#crimeBtn', sick: '#sickBtn' };
      for (const what of ['fire', 'crime', 'sick']) {
        lab.init(N, cloneTiles(tl), money); lab.bind(x, y); const r = lab.click(sel[what]), lt = lab.init && 0;
        void lt;
        const sim = { w: { N, tiles: cloneTiles(tm) }, money, day: 7, city: { history: [] }, landDirty: false, landBox: null, stale: new Uint8Array(N * N) }, res = actAt(sim, x, y, what);
        // 實驗線的處理函式看的是 vm 裡那份格子：拿出來對
        const labTile = r.has ? null : null; void labTile;
        const lb = tl[i].bld ? null : null; void lb;
        const A = { money: r.money, log: r.log.filter(q => q[0] === 'land') };
        const B = { money: sim.money, log: sim.landBox ? [['land', x, y, 4]] : [] };
        if (J(A) !== J(B)) bad.push(`第 ${m} 組 ${what}：錢／髒框 實驗線 ${J(A)}≠本線 ${J(B)}`);
        if (res.ok) { cnt.ok++; if (what === 'crime') cnt.crime++; } else if (res.reason) { if (what === 'fire') cnt.lackFire++; else cnt.lackSick++; } else cnt.nothing++;
      }
    }
    // 旗標的變化：另跑一次逐格比（vm 那份格子）
    const flags = (lab2, sim2, what, N, x, y, money, b0) => {
      const lt = [...Array(N * N)].map(() => ({ bld: null })); if (b0) lt[y * N + x].bld = { ...b0 };
      lab2.init(N, lt, money); lab2.bind(x, y); lab2.click({ fire: '#fireBtn', crime: '#crimeBtn', sick: '#sickBtn' }[what]);
      const mt = [...Array(N * N)].map(() => ({ bld: null })); if (b0) mt[y * N + x].bld = { ...b0 };
      const s2 = { w: { N, tiles: mt }, money, day: 7, city: { history: [] }, landDirty: false, landBox: null, stale: new Uint8Array(N * N) };
      actAt(s2, x, y, what);
      return [J(lt[y * N + x].bld), J(mt[y * N + x].bld)];
    };
    for (const what of ['fire', 'crime', 'sick']) for (const money of [0, 29, 30, 49, 50, 51, 3000]) for (const b0 of [null, { k: 1, lv: 1, age: 0, fire: 2, crime: 1, crimeDays: 9, sick: 1, sickDays: 2 }, { k: 2, lv: 1, age: 0, fire: 1 }, { k: 1, lv: 1, age: 0, sick: 1 }, { k: 3, lv: 1, age: 0, crime: 1, crimeDays: 3 }, { k: 1, lv: 1, ref: [0, 0] }]) {
      const [a, b] = flags(lab, null, what, 6, 2, 3, money, b0);
      if (a !== b) bad.push(`${what}、錢 ${money}、${J(b0)}：格子 實驗線 ${a}≠本線 ${b}`);
    }
    log(!bad.length && cnt.ok > 300 && cnt.lackFire > 20 && cnt.lackSick > 20 && cnt.nothing > 100 && cnt.crime > 50,
      `D026 驗收 7（處置）：實驗線的三個按鈕處理函式（63426–63446）在 vm 裡，跟 src/sim/act.ts 吃同一批狀態與資金逐項相等——滅火 $${ACT_COST.fire}（資金 ≥ 30 才行）、治療 $${ACT_COST.sick}（≥ 50）、處理犯罪免費（標地價髒框半徑 4、天數歸零）；沒有東西可處置就什麼都不發生；資金不夠回原文的字、旗標不動；治療不動 sickDays`,
      bad.slice(0, 3).join('；') || `成功 ${cnt.ok}、滅火錢不夠 ${cnt.lackFire}、治療錢不夠 ${cnt.lackSick}、沒東西 ${cnt.nothing}、處理犯罪 ${cnt.crime}；旗標逐格比 ${3 * 7 * 6} 組全等`);
  }
}

// ---- 突變清單（實驗線原文：[名字, 段, 原文, 改成]；本線：[名字, 原文, 改成]）----
const LAB_MUTANTS = [
  // 死亡前置（55014–55036）
  ['墓園容量 ×3→×4', 'preDeath', 'cemCount*3+bigCem*24', 'cemCount*4+bigCem*24'],
  ['大墓園容量 24→23', 'preDeath', 'bigCem*24+cremPre342*40', 'bigCem*23+cremPre342*40'],
  ['火葬場容量 40→39', 'preDeath', 'cremPre342*40', 'cremPre342*39'],
  ['死亡恢復天數 10→9', 'preDeath', 'if(b.deathAge>=10)', 'if(b.deathAge>=9)'],
  ['喪事範圍 6→5', 'preDeath', 'for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++)', 'for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++)'],
  ['安撫容量 <→<=', 'preDeath', 'covered&&soothed<cemCap', 'covered&&soothed<=cemCap'],
  ['墓園覆蓋不含大墓園', 'preDeath', 'COV.cemetery[i]>0||COV.cem2[i]>0||', 'COV.cemetery[i]>0||'],
  ['墓園覆蓋不含火葬場', 'preDeath', '||(COV.crem&&COV.crem[i]>0);', ';'],
  ['死亡天數不加', 'preDeath', 'b.deathAge=(b.deathAge||0)+1;', 'b.deathAge=(b.deathAge||0);'],
  ['恢復不清病', 'preDeath', 'b.death=0;b.deathAge=0;b.sick=0;continue;', 'b.death=0;b.deathAge=0;continue;'],
  ['喪事鄰居不排除死亡的', 'preDeath', 'if(nb&&nb.k===1&&!nb.death)deathPenalty[j]=1;', 'if(nb&&nb.k===1)deathPenalty[j]=1;'],
  // 火災（55757–55797）
  ['起火率 .0005→.0006', 'fire', 'let p=.0005*', 'let p=.0006*'],
  ['工業起火 ×3→×2', 'fire', '(b.k===3?3:1)*b.lv;', '(b.k===3?2:1)*b.lv;'],
  ['起火不乘等級', 'fire', '(b.k===3?3:1)*b.lv;', '(b.k===3?3:1);'],
  ['煙霧偵測 ×.6→×.7', 'fire', 'p*=.6;', 'p*=.7;'],
  ['消防覆蓋 ×.15→×.2', 'fire', 'p*=.15;', 'p*=.2;'],
  ['消防覆蓋不含總局', 'fire', '||(COV.fireHQ&&COV.fireHQ[i]>0)))p*=.15', '))p*=.15'],
  ['瞭望塔 ×.45→×.5', 'fire', 'p*=.45;', 'p*=.5;'],
  ['瞭望塔也疊加', 'fire', 'else if(COV.firewatch', 'if(COV.firewatch'],
  ['韌性不乘', 'fire', '{const r364=resilience364At(x,y,b);p*=r364.damageMul*r364.casualtyMul;}', '{const r364=resilience364At(x,y,b);p*=r364.damageMul;}'],
  ['科技 A4a 1.10→1.2', 'fire', "tq('A4a',1.10,1)", "tq('A4a',1.2,1)"],
  ['科技 A4b .85→.9', 'fire', "tq('A4b',.85,1)", "tq('A4b',.9,1)"],
  ['科技 B3 .90→.95', 'fire', "tq('B3',.90,1)", "tq('B3',.95,1)"],
  ['專業化 ind 1.08→1.1', 'fire', "sq('ind',1.08,1)", "sq('ind',1.1,1)"],
  ['專業化 green .90→.95', 'fire', "sq('green',.90,1)", "sq('green',.95,1)"],
  ['蔓延機率 .20→.25', 'fire', 'if(R()<.20){', 'if(R()<.25){'],
  ['蔓延不看已燃', 'fire', 'if(nb&&nb.k<=3&&!nb.fire)opts.push([ni,nb]);', 'if(nb&&nb.k<=3)opts.push([ni,nb]);'],
  ['蔓延選第一個', 'fire', 'opts[ri(opts.length)]', 'opts[0]'],
  ['蔓延擋不到', 'fire', '!disasterBlocked364(ni%N,(ni/N)|0,nb,36484)', 'true'],
  ['蔓延擋用別的鹽', 'fire', 'nb,36484)', 'nb,36485)'],
  ['燒毀天數 5→4', 'fire', 'if(b.fire>=5){', 'if(b.fire>=4){'],
  ['燃燒不推進', 'fire', 'else b.fire++;', 'else b.fire+=0;'],
  ['韌性恢復 −1→−2', 'fire', 'b.fire=Math.max(0,b.fire-1)', 'b.fire=Math.max(0,b.fire-2)'],
  ['韌性恢復用別的鹽', 'fire', 'day+36485', 'day+36486'],
  ['燒毀工業不撤污染', 'fire', 'if(b.k===3)stampPolSrc(x,y,3,-1);', ''],
  ['燒毀不留焦土', 'fire', 't.bld=null;t.ruin=1;', 't.bld=null;'],
  ['燒毀不理賠', 'fire', 'insPayout(x,y);}', '}'],
  // 犯罪與廢棄（55810–55833）
  ['犯罪率 .001→.002', 'crime', 'R()<.001*(b.k===2?2:1)', 'R()<.002*(b.k===2?2:1)'],
  ['商業犯罪 ×2→×1', 'crime', '(b.k===2?2:1)*b.lv*(pol', '(b.k===2?1:1)*b.lv*(pol'],
  ['犯罪不乘等級', 'crime', '(b.k===2?2:1)*b.lv*(pol', '(b.k===2?2:1)*(pol'],
  ['宵禁 .6→.7', 'crime', 'pol.curfew?.6:1', 'pol.curfew?.7:1'],
  ['夜市 1.15→1.2', 'crime', 'pol.nightMarket?1.15:1', 'pol.nightMarket?1.2:1'],
  ['公園夜間 1.05→1.1', 'crime', 'pol.parkNight?1.05:1', 'pol.parkNight?1.1:1'],
  ['法院 .5→.6', 'crime', 'COV.court[i]>0)?.5:1', 'COV.court[i]>0)?.6:1'],
  ['科技 B2 .92→.95', 'crime', "tq('B2',.92,1)", "tq('B2',.95,1)"],
  ['科技 B4b 1.05→1.1', 'crime', "tq('B4b',1.05,1)", "tq('B4b',1.1,1)"],
  ['科技 B7 .90→.95', 'crime', "tq('B7',.90,1)", "tq('B7',.95,1)"],
  ['夜間治安不用', 'crime', '*nightCrimeMul487(i,b))', ')'],
  ['派出所不擋犯罪', 'crime', 'if(COV.police[i]>0||COV.police2[i]>0)continue;', 'if(COV.police[i]>0)continue;'],
  ['監獄不擋犯罪', 'crime', '!(COV.prison&&COV.prison[i]>0)&&R()<', 'R()<'],
  ['犯罪不標髒框', 'crime', 'b.crime=1;markLandDirty(x,y,4);', 'b.crime=1;'],
  ['髒框半徑 4→3', 'crime', 'markLandDirty(x,y,4)', 'markLandDirty(x,y,3)'],
  ['廢棄天數 15→14', 'crime', 'b.crimeDays>=15&&', 'b.crimeDays>=14&&'],
  ['廢棄機率 .05→.06', 'crime', 'R()<.05){', 'R()<.06){'],
  ['犯罪天數不加', 'crime', 'b.crimeDays=(b.crimeDays||0)+1;', 'b.crimeDays=(b.crimeDays||0);'],
  ['已廢棄還再算', 'crime', '||!b.crime||b.abandoned)continue;', '||!b.crime)continue;'],
  // 疾病與死亡（55834–55865）
  ['醫院不含救護站', 'disease', '(COV.ambulance&&COV.ambulance[i]>0)||', ''],
  ['醫院不含綜合醫院', 'disease', '(COV.megahosp&&COV.megahosp[i]>0)||', ''],
  ['醫院不含醫療營', 'disease', '||(COV.medcamp&&COV.medcamp[i]>0)', ''],
  ['診所康復 .5→.6', 'disease', 'clinic&&R()<.5', 'clinic&&R()<.6'],
  ['診所康復不抽亂數', 'disease', 'else if(clinic&&R()<.5)', 'else if(clinic)'],
  ['床位比較（醫院）<→<=', 'disease', 'if(hospital){if(medCured387<medCap387)', 'if(hospital){if(medCured387<=medCap387)'],
  ['床位比較（診所）<→<=', 'disease', 'R()<.5){if(medCured387<medCap387)', 'R()<.5){if(medCured387<=medCap387)'],
  ['醫院不看床位', 'disease', 'if(hospital){if(medCured387<medCap387){b.sick=0;medCured387++;}else medQueued387++;}', 'if(hospital){b.sick=0;medCured387++;}'],
  ['沒床位不計滯留', 'disease', 'else medQueued387++;} // T387b：床位門檻', '} // T387b：床位門檻'],
  ['有診所也會生病', 'disease', 'if(!covered&&R()<', 'if(!hospital&&R()<'],
  ['生病率 .001→.002', 'disease', 'R()<.001*b.lv+', 'R()<.002*b.lv+'],
  ['生病不乘等級', 'disease', 'R()<.001*b.lv+', 'R()<.001+'],
  ['死亡天數門檻 3→2', 'disease', 'b.sickDays>=3&&', 'b.sickDays>=2&&'],
  ['死亡機率 .10→.15', 'disease', 'R()<.10){', 'R()<.15){'],
  ['死亡不歸零病天數', 'disease', 'b.death=1;b.deathAge=0;b.sick=0;b.sickDays=0;', 'b.death=1;b.deathAge=0;b.sick=0;'],
  ['病天數不加', 'disease', 'sickN387++;b.sickDays=(b.sickDays||0)+1;', 'sickN387++;b.sickDays=(b.sickDays||0);'],
  ['治癒歸零病天數', 'disease', 'R()<.5){if(medCured387<medCap387){b.sick=0;medCured387++;}', 'R()<.5){if(medCured387<medCap387){b.sick=0;b.sickDays=0;medCured387++;}'],
  ['死亡後不清病', 'disease', 'b.death=1;b.deathAge=0;b.sick=0;', 'b.death=1;b.deathAge=0;'],
  ['床位讀今天的（不讀昨天的）', 'disease', '((flowStat384&&flowStat384.ok&&flowStat384.med)?flowStat384.med.cap:Infinity)', 'Infinity'],
];
const MINE_MUTANTS = [
  // 死亡前置
  ['墓園容量 ×3→×4', 'cemCount * 3 + bigCem * 24', 'cemCount * 4 + bigCem * 24'],
  ['大墓園容量 24→23', 'bigCem * 24 + cremPre342 * 40', 'bigCem * 23 + cremPre342 * 40'],
  ['火葬場容量 40→39', 'cremPre342 * 40', 'cremPre342 * 39'],
  ['死亡恢復天數 10→9', 'b.deathAge >= 10', 'b.deathAge >= 9'],
  ['喪事範圍 6→5', 'for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++)', 'for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++)'],
  ['安撫容量 <→<=', 'covered && soothed < cemCap', 'covered && soothed <= cemCap'],
  ['墓園覆蓋不含大墓園', '(COV.cemetery![i] as number) > 0 || (COV.cem2![i] as number) > 0 ||', '(COV.cemetery![i] as number) > 0 ||'],
  ['墓園覆蓋不含火葬場', ' || (COV.crem && (COV.crem[i] as number) > 0);', ';'],
  ['恢復不清病', 'b.death = 0; b.deathAge = 0; b.sick = 0; ended.push(i);', 'b.death = 0; b.deathAge = 0; ended.push(i);'],
  ['喪事鄰居不排除死亡的', 'if (nb && nb.k === 1 && !nb.death) penalty[j] = 1;', 'if (nb && nb.k === 1) penalty[j] = 1;'],
  // 火災
  ['起火率 .0005→.0006', 'let p = .0005 *', 'let p = .0006 *'],
  ['工業起火 ×3→×2', '(b.k === 3 ? 3 : 1) * b.lv', '(b.k === 3 ? 2 : 1) * b.lv'],
  ['起火不乘等級', '(b.k === 3 ? 3 : 1) * b.lv', '(b.k === 3 ? 3 : 1)'],
  ['煙霧偵測 ×.6→×.7', 'p *= .6;', 'p *= .7;'],
  ['消防覆蓋 ×.15→×.2', 'p *= .15;', 'p *= .2;'],
  ['消防覆蓋不含總局', ' || (COV.fireHQ && (COV.fireHQ[i] as number) > 0)) p *= .15', ') p *= .15'],
  ['瞭望塔 ×.45→×.5', 'p *= .45;', 'p *= .5;'],
  ['瞭望塔也疊加', 'else if (COV.firewatch', 'if (COV.firewatch'],
  ['韌性不乘', 'p *= r364.damageMul * r364.casualtyMul;', 'p *= r364.damageMul;'],
  ['科技 A4a 1.10→1.2', "tq(tech, 'A4a', 1.10, 1)", "tq(tech, 'A4a', 1.2, 1)"],
  ['科技 B3 .90→.95', "tq(tech, 'B3', .90, 1)", "tq(tech, 'B3', .95, 1)"],
  ['專業化 ind 1.08→1.1', "sq(spec, 'ind', 1.08, 1)", "sq(spec, 'ind', 1.1, 1)"],
  ['專業化 green .90→.95', "sq(spec, 'green', .90, 1)", "sq(spec, 'green', .95, 1)"],
  ['蔓延機率 .20→.25', 'if (rng.R() < .20) {', 'if (rng.R() < .25) {'],
  ['蔓延不看已燃', 'if (nb && nb.k <= 3 && !nb.fire) opts.push([ni, nb]);', 'if (nb && nb.k <= 3) opts.push([ni, nb]);'],
  ['蔓延選第一個', 'opts[rng.ri(opts.length)]', 'opts[0]'],
  ['蔓延擋不到', '!disasterBlocked364(w, f, ni % N, (ni / N) | 0, nb, 36484)', 'true'],
  ['燒毀天數 5→4', "if ((b.fire as number) >= 5) {", "if ((b.fire as number) >= 4) {"],
  ['燃燒不推進', 'else b.fire = (b.fire as number) + 1;', 'else b.fire = (b.fire as number) + 0;'],
  ['韌性恢復 −1→−2', 'Math.max(0, (b.fire as number) - 1)', 'Math.max(0, (b.fire as number) - 2)'],
  ['韌性恢復用別的鹽', 'day + 36485', 'day + 36486'],
  ['燒毀工業不撤污染', 'if (b.k === 3) stampPolSrc(g, bx, by, 3, -1);', ''],
  ['燒毀不留焦土', 't.bld = null; t.ruin = 1;', 't.bld = null;'],
  ['燒毀不記屋齡', 'burned.push({ i, k: b.k, lv: b.lv, age: b.age });', 'burned.push({ i, k: b.k, lv: b.lv, age: 0 });'],
  // 犯罪與廢棄
  ['犯罪率 .001→.002', 'rng.R() < .001 * (b.k === 2 ? 2 : 1)', 'rng.R() < .002 * (b.k === 2 ? 2 : 1)'],
  ['商業犯罪 ×2→×1', '(b.k === 2 ? 2 : 1) * b.lv * (pol', '(b.k === 2 ? 1 : 1) * b.lv * (pol'],
  ['犯罪不乘等級', '(b.k === 2 ? 2 : 1) * b.lv * (pol', '(b.k === 2 ? 2 : 1) * (pol'],
  ['宵禁 .6→.7', 'pol.curfew ? .6 : 1', 'pol.curfew ? .7 : 1'],
  ['夜市 1.15→1.2', 'pol.nightMarket ? 1.15 : 1', 'pol.nightMarket ? 1.2 : 1'],
  ['公園夜間 1.05→1.1', 'pol.parkNight ? 1.05 : 1', 'pol.parkNight ? 1.1 : 1'],
  ['法院 .5→.6', '> 0) ? .5 : 1)', '> 0) ? .6 : 1)'],
  ['科技 B2 .92→.95', "tq(tech, 'B2', .92, 1)", "tq(tech, 'B2', .95, 1)"],
  ['科技 B7 .90→.95', "tq(tech, 'B7', .90, 1)", "tq(tech, 'B7', .95, 1)"],
  ['夜間治安不用', '* (x?.nightCrimeMul ? x.nightCrimeMul(i, b) : 1)', ''],
  ['派出所不擋犯罪', ' || (COV.police2![i] as number) > 0) continue;', ') continue;'],
  ['監獄不擋犯罪', '!(COV.prison && (COV.prison[i] as number) > 0) && rng.R() <', 'rng.R() <'],
  ['廢棄天數 15→14', 'b.crimeDays >= 15 &&', 'b.crimeDays >= 14 &&'],
  ['廢棄機率 .05→.06', 'rng.R() < .05)', 'rng.R() < .06)'],
  ['犯罪天數不加', 'b.crimeDays = (b.crimeDays || 0) + 1;', 'b.crimeDays = (b.crimeDays || 0);'],
  ['已廢棄還再算', '!b.crime || b.abandoned) continue;', '!b.crime) continue;'],
  // 疾病與死亡
  ['醫院不含救護站', ' || (COV.ambulance && (COV.ambulance[i] as number) > 0)', ''],
  ['醫院不含綜合醫院', ' || (COV.megahosp && (COV.megahosp[i] as number) > 0)', ''],
  ['醫院不含醫療營', ' || (COV.medcamp && (COV.medcamp[i] as number) > 0);', ';'],
  ['診所康復 .5→.6', 'clinic && rng.R() < .5', 'clinic && rng.R() < .6'],
  ['床位比較（醫院）<→<=', 'if (hospital) { if (cured < medCap)', 'if (hospital) { if (cured <= medCap)'],
  ['床位比較（診所）<→<=', 'rng.R() < .5) { if (cured < medCap)', 'rng.R() < .5) { if (cured <= medCap)'],
  ['沒床位不計滯留', 'else queued++; }                                    // T387b：床位門檻（這一支沒有亂數）', '}'],
  ['有診所也會生病', '!covered && rng.R()', '!hospital && rng.R()'],
  ['生病率 .001→.002', 'rng.R() < .001 * (b.lv as number)', 'rng.R() < .002 * (b.lv as number)'],
  ['生病不乘等級', 'rng.R() < .001 * (b.lv as number)', 'rng.R() < .001'],
  ['死亡天數門檻 3→2', 'b.sickDays >= 3 &&', 'b.sickDays >= 2 &&'],
  ['死亡機率 .10→.15', 'rng.R() < .10)', 'rng.R() < .15)'],
  ['死亡不歸零病天數', 'b.death = 1; b.deathAge = 0; b.sick = 0; b.sickDays = 0;', 'b.death = 1; b.deathAge = 0; b.sick = 0;'],
  ['治癒歸零病天數', 'if (cured < medCap) { b.sick = 0; cured++; cures.push(i); } else queued++; }                                    // T387b', 'if (cured < medCap) { b.sick = 0; b.sickDays = 0; cured++; cures.push(i); } else queued++; }                                    // T387b'],
];
