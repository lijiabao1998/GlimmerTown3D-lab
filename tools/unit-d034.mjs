// D034 Node 守衛：摩天樓與巨廈合併（I）——合併段逐項＝實驗線原文（驗收 1、2、5 的公式半邊）。
//   1. 樣本的出處：src/content/samples/d034-merge.json（tools/lab-merge.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；常數（兩個幸福閘門 .55／.6、需求門檻 .25／.3、機率 .04／.02、實質門檻 5、
//      地價髒框半徑 8、巨廈人口與就業）與本線相同；接線要靠的事實在原文裡成立（合併段在財富移級之後、火災之前；開發用的繞過閘門只在開發沙盒的覆寫旗標開著才為真、預設關）；
//      merge.ts 沒有 three／DOM／亂數／現實時間／外部網址。
//   2. 逐項＝實驗線：實驗線原文合併段（連同開發用的繞過閘門與覆寫判斷、巨廈人口常數、T、COVR；樁：亂數是劇本、markLandDirty／stampCov／toast／pickV406 記呼叫）在 Node `vm` 裡，跟本線 merge.ts
//      的 mergeDay 吃同一批隨機小圖（5–12 格，含 2×2 與 3×3 的合格簇、混類、含 lv1、含公園、含空地與焦土與路、起火、沒電沒水、沒接管、ref 格；幸福與需求剛好在閘門上下）與同一份亂數劇本：
//      合併後每一格的 bld（全部欄位）與 zone、亂數呼叫序列（R／ri 的順序與數量）、覆蓋印撤除、地價髒框、pickV406 的引數、提示的字與座標逐位相等。
//   3. 注入錯誤要紅：實驗線原文與本線原碼各改壞一批（兩個閘門、需求門檻、機率、實質門檻、定類取最後一個、吸收規則各支、先標 mgDone、清分區、ri(4)、尺寸、起火、接管、通電、掃描順序、髒框……）；沒改的先核過全等。
//   接線、實驗線頁面實跑、歷史與存檔：見 tools/unit-d034-live.mjs。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as MG from '../src/sim/rules/merge.ts';
import { POPS, JOBSC, MEGA_POP, MEGA_JOBS } from '../src/sim/rules/jobs.ts';
import { COVR } from '../src/sim/rules/fields.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
export const KEY = {
  hook: '合併段前一行（devBeforeSkyline516B 呼叫）', merge: '合併整段', fireStart: '火災段起點', devGod: 'devGod516B', devOverride: 'devOverride516B', devBypass: 'devSkylineBypass516B', devBefore: 'devBeforeSkyline516B',
  towerMult: 'TOWER_MULT', towerPop: 'TOWER_POP', megaPop: 'MEGA_POP', megaJobs: 'MEGA_JOBS', T: 'T', markLand: 'markLandDirty', stampCov: 'stampCov', covr: 'COVR',
};   // text 的鍵 → 樣本 pieces 的名字

export async function d034Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D034 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 亂數劇本：兩邊吃同一串值（R 與 ri 各吃一個）。值取在機率門檻兩邊（.02、.04）附近，讓成功與失敗都常出現
const SCRIPT_VALUES = [.001, .015, .0199, .02, .025, .039, .04, .045, .2, .5, .7, .99, .0005, .0301];
const scriptOf = (g, n = 400) => Array.from({ length: n }, () => SCRIPT_VALUES[Math.floor(g() * SCRIPT_VALUES.length)]);
const stubPick = (k, lv, x, y, fb) => fb * 1000 + k * 17 + lv * 3 + x * 101 + y * 7;   // pickV406 的樁：引數順序與值都看得出來

// ---- 實驗線那一邊：原文在 vm 裡 ----
function makeLab(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';
let N=0,tiles=[],cityHappy=0,dem={},sewNeed442=false,SEW_OK442=[],SEQ=[],SI=0,LOG=null,money=0;
const devState516B={sandbox:false,god:false,overrides:{}},POPS=${J(POPS)},JOBSC=${J(JOBSC)};
const idx=(x,y)=>y*N+x;
const nextV=()=>SEQ[SI++%SEQ.length];
const R=()=>{LOG.rng.push(['R']);return nextV();};
const ri=n=>{LOG.rng.push(['ri',n]);return Math.floor(nextV()*n);};
const stampCov=(f,x,y,r,d)=>LOG.cov.push([f,x,y,r,d]);
const markLandDirty=(x,y,r)=>LOG.land.push([x,y,r]);
const toast=(m,c,x,y)=>LOG.toast.push([m,c,x,y]);
const sFanfare=()=>{};
const pickV406=(k,lv,x,y,fb)=>{LOG.pick.push([k,lv,x,y,fb]);return (${stubPick.toString()})(k,lv,x,y,fb);};
const dem0=()=>dem;
${T.covr}
${T.megaPop}
${T.megaJobs}
${T.T}
${T.devGod}
${T.devOverride}
${T.devBypass}
${T.devBefore}
function __run(){
${T.hook}
${T.merge}
}
globalThis.__api={init:(c)=>{N=c.N;tiles=JSON.parse(JSON.stringify(c.tiles));cityHappy=c.cityHappy;dem=c.dem;sewNeed442=c.sewNeed;SEW_OK442=c.sewOk;SEQ=c.seq;SI=0;LOG={rng:[],cov:[],land:[],toast:[],pick:[]};},run:()=>{__run();return JSON.stringify({tiles,log:LOG});},covrPark:()=>COVR.park,megaPop:()=>MEGA_POP,megaJobs:()=>MEGA_JOBS};
`, ctx, { filename: 'lab:d034' });
  return ctx.__api;
}

// ---- 本線那一邊：merge.ts（突變時傳改壞的那份）----
function runPort(M, c) {
  const tiles = JSON.parse(JSON.stringify(c.tiles)), LOG = { rng: [], cov: [], land: [], toast: [], pick: [] };
  let si = 0; const nextV = () => c.seq[si++ % c.seq.length];
  const rng = { R() { LOG.rng.push(['R']); return nextV(); }, ri(n) { LOG.rng.push(['ri', n]); return Math.floor(nextV() * n); } };
  const recs = M.mergeDay({ N: c.N, tiles }, {
    cityHappy: c.cityHappy, dem: c.dem, sewNeed: c.sewNeed, sewOk: c.sewOk, rng,
    pickV: (k, lv, x, y, fb) => { LOG.pick.push([k, lv, x, y, fb]); return stubPick(k, lv, x, y, fb); },
    unstampPark: (x, y) => LOG.cov.push(['park', x, y, COVR.park, -1]),
    markLand: (x, y, r) => LOG.land.push([x, y, r]),
  });
  for (const r of recs) LOG.toast.push([M.mergeToastText(r.k, MEGA_POP, MEGA_JOBS), 'gold', r.x, r.z]);
  return { out: { tiles, log: LOG }, recs };
}
const canon = v => J(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(q => [q, x[q]])) : x);

// ---- 隨機小圖 ----
const HAPPY = [.5, .55, .5501, .58, .6, .6001, .63, .9], DEMS = [-.2, .2, .25, .2501, .3, .3001, .6];
function mergeCase(k) {
  const g = mulberry32(0x34d + k * 7919), ri = n => Math.floor(g() * n), r = () => g();
  const N = 5 + ri(8), nn = N * N, K = [1, 1, 1, 2, 2, 3, 4];
  const tiles = Array.from({ length: nn }, () => {
    const t = { t: r() < .9 ? 2 : (r() < .6 ? 1 : 0), zone: r() < .5 ? 0 : 1 + ri(3), road: r() < .06 ? 1 : 0, ruin: r() < .03 ? 1 : 0, bld: null };
    if (!t.road && !t.ruin && r() < .35) t.bld = { k: K[ri(K.length)], lv: [1, 2, 2, 3, 3][ri(5)], v: ri(4), age: ri(30), pw: r() < .93, wa: r() < .93, h: .6, fire: r() < .04 ? 3 : 0 };
    return t;
  });
  const put = (x, y, b) => { if (x >= 0 && y >= 0 && x < N && y < N) { const t = tiles[y * N + x]; t.bld = b; t.road = 0; t.ruin = 0; } };
  const clear = (x, y, zone) => { if (x >= 0 && y >= 0 && x < N && y < N) { const t = tiles[y * N + x]; t.bld = null; t.road = 0; t.ruin = 0; t.zone = zone; t.t = r() < .9 ? 2 : 1; } };
  const blocks = 2 + ri(4);
  for (let n = 0; n < blocks; n++) {
    const sz = r() < .5 ? 2 : 3, x0 = ri(Math.max(1, N - sz + 1)), y0 = ri(Math.max(1, N - sz + 1)), kk = 1 + ri(2), mix = r() < .15;
    for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {
      const x = x0 + dx, y = y0 + dy;
      const roll = sz === 3 ? r() : 1;
      if (sz === 3 && roll < .08) put(x, y, { k: 4, lv: 1, v: 0, age: 3, pw: true, h: 1 });
      else if (sz === 3 && roll < .16) put(x, y, { k: kk, lv: 1, v: ri(4), age: 5, pw: r() < .9, wa: r() < .9, h: .6, fire: r() < .1 ? 2 : 0 });
      else if (sz === 3 && roll < .24) clear(x, y, r() < .6 ? kk : 0);
      else if (sz === 3 && roll < .27) { const t = tiles[y * N + x]; t.bld = null; t.road = 1; }
      else if (sz === 3 && roll < .29) { const t = tiles[y * N + x]; t.bld = null; t.ruin = 1; t.road = 0; }
      else put(x, y, { k: mix && r() < .3 ? 3 - kk : kk, lv: r() < .85 ? 2 + ri(2) : 1, v: ri(4), age: 9, pw: r() < .96, wa: r() < .96, h: .6, fire: r() < .03 ? 2 : 0 });
    }
  }
  if (r() < .1) put(ri(N), ri(N), { k: 1, ref: [0, 0] });
  return { N, tiles, cityHappy: HAPPY[ri(HAPPY.length)], dem: { 1: DEMS[ri(DEMS.length)], 2: DEMS[ri(DEMS.length)], 3: .5 }, sewNeed: r() < .5, sewOk: Array.from({ length: nn }, () => (r() < .75 ? 1 : 0)), seq: scriptOf(g) };
}
const COUNT = 3000;
const CASES = Array.from({ length: COUNT }, (_, k) => mergeCase(k));

// 一份實驗線＋一份本線，逐案比；回傳第一個不同（沒有＝null）與覆蓋統計
function compare(lab, M, only = null) {
  const cov = { tower: 0, mega: 0, megaPark: 0, gateLow: 0, gateMid: 0, gateHigh: 0, rolls: 0, ri4: 0, towerRoll: 0, megaRoll: 0 };
  for (let k = 0; k < CASES.length; k++) {
    const c = CASES[k];
    lab.init(c);
    const L = JSON.parse(lab.run()), P = runPort(M, c).out;
    const ls = canon(L.tiles), ps = canon(P.tiles);
    if ((!only || only === 'tiles') && ls !== ps) return { text: `案例 ${k} 的格子不同`, cov };
    for (const key of ['rng', 'cov', 'land', 'toast', 'pick']) if ((!only || only === key) && canon(L.log[key]) !== canon(P.log[key])) return { text: `案例 ${k} 的 ${key} 不同：實驗線 ${canon(L.log[key]).slice(0, 160)} 本線 ${canon(P.log[key]).slice(0, 160)}`, cov };
    if (c.cityHappy <= .55) cov.gateLow++; else if (c.cityHappy <= .6) cov.gateMid++; else cov.gateHigh++;
    cov.rolls += L.log.rng.length; cov.ri4 += L.log.pick.length;
    for (const t of L.log.toast) { if (/巨廈|綜合體/.test(t[0])) cov.mega++; else cov.tower++; }
    cov.megaPark += L.log.cov.length ? 1 : 0;
  }
  return { text: null, cov };
}

const edit = (t, a, b) => { if (t.split(a).length !== 2) throw new Error(`錨點要剛好一處：${a.slice(0, 50)}（${t.split(a).length - 1} 處）`); return t.replace(a, b); };

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d034-merge.json')), T = S.text;
  const sha = s => crypto.createHash('sha256').update(s).digest('hex');
  const src = read('src/sim/rules/merge.ts');

  // ---- 1. 出處與接線要靠的事實 ----
  {
    const bad = [];
    if (S.source?.commit !== PINNED) bad.push(`出處不是 ${PINNED.slice(0, 7)}：${S.source?.commit}`);
    const byName = Object.fromEntries(S.pieces.map(p => [p.name, p]));
    for (const [k, name] of Object.entries(KEY)) { const p = byName[name]; if (!p) bad.push(`缺 ${name}`); else if (sha(T[k]) !== p.sha) bad.push(`${name} 的 sha256 跟錨點記錄不同`); }
    if (S.pieces.length !== Object.keys(KEY).length) bad.push(`樣本 ${S.pieces.length} 段、守衛認得 ${Object.keys(KEY).length} 段`);
    const has = (k, s) => { if (!T[k].includes(s)) bad.push(`${KEY[k]} 裡沒有「${s.slice(0, 60)}」`); };
    has('merge', "if(cityHappy>.55||(typeof devSkylineBypass516B==='function'&&devSkylineBypass516B())){");
    has('merge', "if(cityHappy>.6||(typeof devSkylineBypass516B==='function'&&devSkylineBypass516B())){");
    has('merge', 'for(let y=0;y<N-2;y++)for(let x=0;x<N-2;x++){');
    has('merge', 'for(let y=0;y<N-1;y++)for(let x=0;x<N-1;x++){');
    has('merge', 'dem[kk]<=.25');
    has('merge', 'dem[kk]<=.3');
    has('merge', 'subst<5');
    has('merge', 'R()<.04');
    has('merge', 'R()<.02');
    has('merge', 'const mk2=kk===1?105:106;');
    has('merge', 'const tk=kk===1?33:34;');
    has('merge', "stampCov('park',px2,py2,COVR.park,-1)");
    has('merge', 'markLandDirty(x+1,y+1,8);');
    has('merge', "(!sewNeed442||SEW_OK442[qi])&&!qb.fire");
    has('merge', "(sewNeed442&&!SEW_OK442[qi])||qb.fire");
    has('merge', 'v:pickV406(tk,1,x,y,ri(4))');
    has('merge', "{k:mk2,lv:1,v:0,age:0,pw:true,wa:true,h:1,sz:3}");
    has('merge', "{k:tk,lv:1,v:pickV406(tk,1,x,y,ri(4)),age:0,pw:true,wa:true,h:1,sz:2}");
    has('merge', 'jt.zone=0;');
    has('hook', 'devBeforeSkyline516B()');
    has('fireStart', '火災（升級段之後）');
    has('devBypass', "return devOverride516B('skyline');");
    has('devOverride', 'devGod516B()&&devState516B.overrides[k]');
    has('devGod', 'devState516B.sandbox&&devState516B.god');
    has('devBefore', 'if(!devGod516B())return;');
    if (!S.facts?.devDefault) bad.push('事實：開發沙盒的預設狀態不是關的');
    if (S.facts?.bypassDefinitions !== 1) bad.push(`事實：devSkylineBypass516B 的定義有 ${S.facts?.bypassDefinitions} 處（要 1）`);
    // 位置：合併段在財富移級之後、火災之前（片段的行號）
    if (!(byName[KEY.hook].line < byName[KEY.merge].line && byName[KEY.merge].endLine < byName[KEY.fireStart].line)) bad.push('合併段的位置不在 hook 之後、火災之前');
    // 常數跟本線相同
    const num = (s, re) => { const m = re.exec(s); return m ? +m[1] : NaN; };
    if (MG.HAPPY_TOWER !== .55 || MG.HAPPY_MEGA !== .6 || MG.DEM_MEGA !== .25 || MG.DEM_TOWER !== .3 || MG.P_MEGA !== .04 || MG.P_TOWER !== .02 || MG.MEGA_SUBST_MIN !== 5 || MG.MEGA_LAND_R !== 8) bad.push('merge.ts 的常數跟原文不同');
    const lab0 = makeLab(T);
    if (lab0.covrPark() !== COVR.park) bad.push(`COVR.park 實驗線 ${lab0.covrPark()} 本線 ${COVR.park}`);
    if (lab0.megaPop() !== MEGA_POP || lab0.megaJobs() !== MEGA_JOBS) bad.push(`MEGA_POP／MEGA_JOBS 實驗線 ${lab0.megaPop()}／${lab0.megaJobs()} 本線 ${MEGA_POP}／${MEGA_JOBS}`);
    // 純邏輯
    const code = src.replace(/\/\/.*$/gm, '');
    for (const bannedRe of [/from 'three'/, /document\./, /window\./, /Math\.random/, /Date\.now/, /performance\.now/, /https?:\/\//]) if (bannedRe.test(code)) bad.push(`merge.ts 有 ${bannedRe}`);
    log(!bad.length, `D034 合併原文：實驗線 ${PINNED.slice(0, 7)} 的 ${S.pieces.length} 段（合併整段、開發用的繞過閘門與覆寫判斷、巨廈人口與就業常數、T、markLandDirty、stampCov、覆蓋半徑表）逐段 sha256＝錨點記錄；常數跟本線相同；`
      + '接線要靠的事實在原文裡成立（合併段在財富移級之後、火災之前；繞過閘門只有開發沙盒的覆寫旗標開著才為真、預設關）；merge.ts 是純函式',
      bad.slice(0, 6).join('；') || `${S.pieces.length} 段、行號 ${Math.min(...S.pieces.map(p => p.line))}–${Math.max(...S.pieces.map(p => p.endLine))}；兩個閘門 .55／.6、需求 .25／.3、機率 .04／.02、實質 5、髒框半徑 8、MEGA_POP ${MEGA_POP}、MEGA_JOBS ${MEGA_JOBS}`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const lab0 = makeLab(T);
  {
    const { text, cov } = compare(lab0, MG);
    const need = [['塔合併', cov.tower, 60], ['巨廈合併', cov.mega, 30], ['吸收公園的巨廈', cov.megaPark, 10], ['幸福 ≤ .55 的案例', cov.gateLow, 100], ['幸福在 .55–.6 的案例', cov.gateMid, 100], ['幸福 > .6 的案例', cov.gateHigh, 300]];
    const short = need.filter(([, n, m]) => n < m).map(([nm, n, m]) => `${nm} ${n}／${m}`);
    log(text === null && !short.length,
      `D034 驗收 2：合併逐項＝實驗線——實驗線原文合併段在 vm 裡跟本線 merge.ts 吃 ${COUNT} 張隨機小圖（5–12 格：2×2 與 3×3 的合格簇、混類、含 lv1、含公園、含空地與焦土與路、起火、沒電沒水、沒接管、ref 格；幸福與需求剛好在閘門上下）與同一份亂數劇本：`
      + '合併後每一格的 bld 與 zone、亂數呼叫序列、覆蓋印撤除、地價髒框、pickV406 的引數、提示的字與座標逐位相等',
      text ?? (short.join('；') || `${COUNT} 張全等：塔 ${cov.tower}、巨廈 ${cov.mega}（吸收公園 ${cov.megaPark}）；幸福 ≤ .55 ${cov.gateLow}、.55–.6 ${cov.gateMid}、> .6 ${cov.gateHigh}；亂數呼叫 ${cov.rolls} 次、塔的 ri(4) ${cov.ri4} 次`));
  }

  // ---- 3. 注入錯誤要紅 ----
  {
    const ok0 = compare(lab0, MG).text === null;
    const MERGE_START = "if(cityHappy>.55||(typeof devSkylineBypass516B==='function'&&devSkylineBypass516B())){";
    const labMut = [   // [名稱, from, to]（都改 T.merge）
      ['塔的幸福閘門 .55→.5', MERGE_START, MERGE_START.replace('.55', '.5')],
      ['巨廈的幸福閘門 .6→.55', "if(cityHappy>.6||(typeof", "if(cityHappy>.55||(typeof"],
      ['巨廈需求門檻 .25→.2', 'dem[kk]<=.25', 'dem[kk]<=.2'], ['塔的需求門檻 .3→.25', 'dem[kk]<=.3&&', 'dem[kk]<=.25&&'],
      ['實質門檻 5→4', 'subst<5', 'subst<4'], ['巨廈機率 .04→.05', 'R()<.04', 'R()<.05'], ['塔機率 .02→.03', 'R()<.02', 'R()<.03'],
      ['巨廈不吸收 lv1 舊屋', 'if(qb&&!qb.ref&&qb.k===kk&&qb.lv===1&&!qb.fire)continue;', ''],
      ['巨廈不吸收公園', 'if(qb&&!qb.ref&&qb.k===4){parks341.push([x+dx,y+dy]);continue;}', ''],
      ['巨廈空地不看沒分區的草地', '(qt.zone===kk||(!qt.zone&&qt.t===2))', '(qt.zone===kk)'],
      ['巨廈擲骰前不先標 mgDone', 'for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++)mgDone[idx(x+dx,y+dy)]=1; /* T342c', '/* T342c'],
      ['巨廈不清分區', 'jt.zone=0;', ''], ['巨廈髒框半徑 8→7', 'markLandDirty(x+1,y+1,8);', 'markLandDirty(x+1,y+1,7);'], ['巨廈髒框中心不加 1', 'markLandDirty(x+1,y+1,8);', 'markLandDirty(x,y,8);'],
      ['巨廈尺寸 3→2', "{k:mk2,lv:1,v:0,age:0,pw:true,wa:true,h:1,sz:3}", "{k:mk2,lv:1,v:0,age:0,pw:true,wa:true,h:1,sz:2}"],
      ['塔不看起火', "(sewNeed442&&!SEW_OK442[qi])||qb.fire)", "(sewNeed442&&!SEW_OK442[qi]))"], ['塔不看接管', "(sewNeed442&&!SEW_OK442[qi])||qb.fire", "false||qb.fire"],
      ['塔不看通電', '||!qb.pw||!qb.wa||(sewNeed442&&!SEW_OK442[qi])', '||!qb.wa||(sewNeed442&&!SEW_OK442[qi])'],
      ['塔的 ri(4) 變 ri(5)', 'pickV406(tk,1,x,y,ri(4))', 'pickV406(tk,1,x,y,ri(5))'], ['塔尺寸 2→3', "age:0,pw:true,wa:true,h:1,sz:2}", "age:0,pw:true,wa:true,h:1,sz:3}"],
      ['塔掃描改成先 x 後 y', 'for(let y=0;y<N-1;y++)for(let x=0;x<N-1;x++){', 'for(let x=0;x<N-1;x++)for(let y=0;y<N-1;y++){'],
      ['塔根格要 lv ≥ 3', "(b0.lv<2&&!(typeof devSkylineBypass516B==='function'&&devSkylineBypass516B()))", "(b0.lv<3&&!(typeof devSkylineBypass516B==='function'&&devSkylineBypass516B()))"],
    ];
    const portMut = [   // [名稱, from, to]（都改 merge.ts）
      ['塔的幸福閘門 .55→.5', 'export const HAPPY_TOWER = .55;', 'export const HAPPY_TOWER = .5;'], ['巨廈的幸福閘門 .6→.55', 'export const HAPPY_MEGA = .6;', 'export const HAPPY_MEGA = .55;'],
      ['巨廈需求門檻 .25→.2', 'export const DEM_MEGA = .25;', 'export const DEM_MEGA = .2;'], ['塔的需求門檻 .3→.25', 'export const DEM_TOWER = .3;', 'export const DEM_TOWER = .25;'],
      ['實質門檻 5→4', 'export const MEGA_SUBST_MIN = 5;', 'export const MEGA_SUBST_MIN = 4;'], ['巨廈機率 .04→.05', 'export const P_MEGA = .04;', 'export const P_MEGA = .05;'], ['塔機率 .02→.03', 'export const P_TOWER = .02;', 'export const P_TOWER = .03;'],
      ['巨廈不吸收 lv1 舊屋', 'if (qb && !qb.ref && qb.k === kk && qb.lv === 1 && !qb.fire) { from.push(qi); continue; }', ''],
      ['巨廈不吸收公園', 'if (qb && !qb.ref && qb.k === 4) { parks.push([x + dx, y + dy]); from.push(qi); continue; }', ''],
      ['巨廈空地不看沒分區的草地', '(qt.zone === kk || (!qt.zone && qt.t === 2))', '(qt.zone === kk)'],
      ['巨廈擲骰前不先標 mgDone', "for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) mgDone[idx(w, x + dx, y + dy)] = 1;\n      if (c.rng.R() < P_MEGA) {", 'if (c.rng.R() < P_MEGA) {'],
      ['巨廈不清分區', 'jt.zone = 0;', ''], ['巨廈髒框半徑 8→7', 'export const MEGA_LAND_R = 8;', 'export const MEGA_LAND_R = 7;'], ['巨廈髒框中心不加 1', 'c.markLand(x + 1, y + 1, MEGA_LAND_R);', 'c.markLand(x, y, MEGA_LAND_R);'],
      ['巨廈不撤公園覆蓋', 'for (const [px, py] of parks) c.unstampPark(px, py);', ''],
      ['巨廈尺寸 3→2', "{ k: mk2, lv: 1, v: 0, age: 0, pw: true, wa: true, h: 1, sz: 3 }", "{ k: mk2, lv: 1, v: 0, age: 0, pw: true, wa: true, h: 1, sz: 2 }"],
      ['塔不看起火', '(c.sewNeed && !c.sewOk[qi]) || qb.fire) { ok = false; break; }', '(c.sewNeed && !c.sewOk[qi])) { ok = false; break; }'],
      ['塔不看接管', '(c.sewNeed && !c.sewOk[qi]) || qb.fire) { ok = false; break; }', 'false || qb.fire) { ok = false; break; }'],
      ['塔不看通電', '|| !qb.pw || !qb.wa || (c.sewNeed && !c.sewOk[qi]) || qb.fire', '|| !qb.wa || (c.sewNeed && !c.sewOk[qi]) || qb.fire'],
      ['塔的 ri(4) 變 ri(5)', 'c.pickV(tk, 1, x, y, c.rng.ri(4))', 'c.pickV(tk, 1, x, y, c.rng.ri(5))'], ['塔尺寸 2→3', "age: 0, pw: true, wa: true, h: 1, sz: 2 }", "age: 0, pw: true, wa: true, h: 1, sz: 3 }"],
      ['塔掃描改成先 x 後 y', 'for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {', 'for (let x = 0; x < N - 1; x++) for (let y = 0; y < N - 1; y++) {'],
      ['塔根格要 lv ≥ 3', '(b0.k !== 1 && b0.k !== 2) || b0.lv < 2', '(b0.k !== 1 && b0.k !== 2) || b0.lv < 3'],
    ];
    const missed = [], names = [];
    for (const [name, from, to] of labMut) {
      let T2; try { T2 = { ...T, merge: edit(T.merge, from, to) }; } catch (e) { missed.push(`實驗線「${name}」${e.message}`); continue; }
      const lab = makeLab(T2);
      if (compare(lab, MG).text === null) missed.push(`實驗線 ${name}`); names.push(`實驗線：${name}`);
    }
    for (const [name, from, to] of portMut) {
      let M; try { M = await loadMod('src/sim/rules/merge.ts', [[from, to]]); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      if (compare(lab0, M).text === null) missed.push(`本線 ${name}`); names.push(`本線：${name}`);
    }
    log(ok0 && !missed.length, `D034 驗收 2、5（突變）：注入錯誤要紅——實驗線原文 ${labMut.length} 個、本線原碼 ${portMut.length} 個（兩個閘門、需求門檻、機率、實質門檻、吸收規則各支、先標 mgDone、清分區、髒框、尺寸、起火、接管、通電、掃描順序、ri(4)）都使逐項比對轉紅；沒改的先核過全等`,
      ok0 ? (missed.join('；') || `${names.length} 個全紅`) : '沒改的就不等（上一項已紅）');
  }
}
