// D033 Node 守衛：污水（H）——管網元件、貼著的元件、距離、電力係數逐項＝實驗線原文（驗收 1、5 的公式半邊）。
//   1. 樣本的出處：src/content/samples/d033-sewer.json（tools/lab-sewer.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；常數（90 格、水務設施集合、發電廠種類、500 人門檻、造價 500、工具名）跟本線相同；
//      接線要靠的事實在原文裡成立（SEWER_ROOT_OK472 的算式、容量只加進 scs[0]、非舊式分支以 sewerRootStatus472 為準、回退設定下 55013 的強制重算不跑、回退旗標沒有 __legacySewer451）；
//      sewer.ts 沒有 three／DOM／亂數／現實時間／外部網址。
//   2. 逐項＝實驗線：實驗線原文（buildPipeComponents472、facilityComps472、pressureDistances472、waterFacilityPowerFactor472＋常數）在 Node `vm` 裡，跟本線 sewer.ts 匯出的
//      pipeComponents、facilityComps、pipeDistances、pfOf 吃同一批隨機格子——隨機大小的地圖（6–30 格）、隨機管網（散點、走線、成團）、隨機建築（邊長 1–4）、隨機起點（含不在管網上的格）；加幾張 72×72 的蛇形管網
//      （距離跨過 122 的截斷）。元件編號逐格相同、每棟建築貼著的元件（含插入順序）、距離逐格相同。
//   3. 注入錯誤要紅：實驗線原文與本線原碼各改壞一批（斜向相鄰、四邊各一邊、腳印只認一格、截斷 +32 差一、90 差一、起點不在管網上、每步 +2……）；每個突變指定「哪一項比對要紅」、只跑那一項：沒紅＝那一項比對沒管用；沒改的先核過全等。
//   接線、實驗線頁面實跑（隨機佈局的 SEWER_ROOT_OK472 逐棟、Q 系列連推 13 天）：見 tools/unit-d033-live.mjs。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as SW from '../src/sim/rules/sewer.ts';
import { COST } from '../src/sim/rules/build.ts';
import { FALLBACK_FLAGS } from './lab-configs.mjs';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
export const KEY = {
  hops: '水循環常數 WATER_HOPS472', facilityK: '水務設施集合 WATER_FACILITY_K472', powerK: '發電廠種類 POWER_SOURCE_K450', powDir: 'POW_DIR', pipeComps: 'buildPipeComponents472', facilityComps: 'facilityComps472',
  pressure: 'pressureDistances472', powerFactor: 'waterFacilityPowerFactor472', cycle: 'ensureWaterCycle472', rootStatus: 'sewerRootStatus472', legacy: 'sewerLegacy451', required: 'sewerRequired442',
  sewConsts: '污水常數 SEWAGE_THRESHOLD442', sewNeed: 'sewNeed442', forced: '55013 強制重算', assign: '接管指派 SEW_OK442', denseSewer: '高密度污水', foodLoop: '糧食迴圈條件', relief: '污水廠減壓',
  lv3Gate: 'lv3Gate', seCount: '污水廠計數', cost: 'COST.sewage', toolDef: '工具定義', placeCost: '造價', canPlace: 'canPlace 通用判定與鄰水', doPlace: '蓋法',
};   // text 的鍵 → 樣本 pieces 的名字

export async function d033Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D033 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 實驗線那一邊：原文在 vm 裡 ----
function makeLab(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';let N=0,tiles=[];const inMap=(x,y)=>x>=0&&y>=0&&x<N&&y<N,idx=(x,y)=>y*N+x,assetAvailability493=()=>1;
${T.hops}
${T.powDir}
${T.pipeComps}
${T.facilityComps}
${T.pressure}
${T.powerFactor}
globalThis.__api={init:(n,ts)=>{N=n;tiles=ts;},comps:()=>buildPipeComponents472(t=>!!t.wp),fac:(root,arr)=>facilityComps472(root,arr,t=>!!t.wp),press:(arr,seeds)=>pressureDistances472(arr,[],seeds,t=>!!t.sm472),pf:(b,root)=>waterFacilityPowerFactor472(b,root)};`, ctx, { filename: 'lab:sewer' });
  const A = ctx.__api;
  return { init: (n, ts) => A.init(n, ts), comps: () => { const [arr, comps] = A.comps(); return { comp: Array.from(arr), n: comps.length }; }, fac: (root, comp) => Array.from(A.fac(root, Int32Array.from(comp))), press: (comp, seeds) => Array.from(A.press(Int32Array.from(comp), seeds)), pf: (b, root) => A.pf(b, root) };
}
// 本線那一邊：sewer.ts（突變時傳改壞的那份）
function portSide(M) {
  return { comps: w => { const { comp, n } = M.pipeComponents(w); return { comp: Array.from(comp), n }; }, fac: (w, comp, root, sz) => M.facilityComps(w, Int32Array.from(comp), root, sz),
    press: (w, comp, seeds) => Array.from(M.pipeDistances(w, Int32Array.from(comp), seeds)), pf: b => M.pfOf(b) };
}

// ---- 隨機格子 ----
function gridCase(k) {
  const g = mulberry32(0x33d + k * 977), ri = n => Math.floor(g() * n), r = () => g();
  const N = 6 + ri(25), nn = N * N, tiles = Array.from({ length: nn }, () => ({ wp: 0 })), D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const walks = 1 + ri(6);
  for (let n = 0; n < walks; n++) { let x = ri(N), y = ri(N), d = ri(4); for (let s = 0, L = 3 + ri(40); s < L; s++) { tiles[y * N + x].wp = 1; if (r() < .25) d = ri(4); x = Math.max(0, Math.min(N - 1, x + D[d][0])); y = Math.max(0, Math.min(N - 1, y + D[d][1])); } }
  for (let i = 0; i < nn; i++) if (r() < .06) tiles[i].wp = 1;
  const roots = [];
  for (let n = 0, B = 1 + ri(10); n < B; n++) { const sz = 1 + ri(4), x = ri(N), y = ri(N), i = y * N + x; if (!tiles[i].bld) { tiles[i].bld = { k: 1, lv: 1, v: 0, age: 0, sz }; roots.push([i, sz]); } }
  const seeds = []; for (let n = 0, S = ri(6); n < S; n++) seeds.push(ri(nn));
  return { N, tiles, roots, seeds };
}
function snakeCase(v) {
  const N = 72, nn = N * N, tiles = Array.from({ length: nn }, () => ({ wp: 0 })), rowLen = [60, 66, 50, 62][v % 4], rows = 8 + (v % 3);
  let x = 4, y = 4, dir = 1; const path = [[x, y]];
  for (let row = 0; row < rows; row++) { for (let i = 0; i < rowLen; i++) { x += dir; path.push([x, y]); } if (row === rows - 1) break; for (let i = 0; i < 3; i++) { y++; path.push([x, y]); } dir = -dir; }
  for (const [px, py] of path) if (py < N) tiles[py * N + px].wp = 1;
  const roots = []; for (const j of [30, 88, 89, 90, 91, 92, 120, 121, 122, 123, 124, 200]) { const [px, py] = path[Math.min(j, path.length - 1)]; const hx = px, hy = py - 1, i = hy * N + hx; if (hy >= 0 && !tiles[i].wp && !tiles[i].bld) { tiles[i].bld = { k: 1, lv: 1, v: 0, age: 0, sz: 1 }; roots.push([i, 1]); } }
  return { N, tiles, roots, seeds: [4 + 4 * N, 5 + 4 * N] };
}
const CASES = [...Array.from({ length: 420 }, (_, k) => gridCase(k)), ...Array.from({ length: 8 }, (_, v) => snakeCase(v))];

// 一份實驗線＋一份本線，逐案比：元件、每棟貼著的元件、距離。回傳第一個不同（沒有＝null）。only＝只比哪一項（突變用）
function compare(lab, port, only = null) {
  for (let c = 0; c < CASES.length; c++) {
    const { N, tiles, roots, seeds } = CASES[c], w = { N, tiles };
    lab.init(N, tiles);
    const L = lab.comps(), P = port.comps(w);
    if (!only || only === 'comps') if (J(L) !== J(P)) return `元件 案例 ${c}`;
    if (!only || only === 'fac') for (const [i, sz] of roots) { const a = lab.fac(i, L.comp), b = port.fac(w, L.comp, i, sz); if (J(a) !== J(b)) return `貼著的元件 案例 ${c} 根格 ${i} 邊長 ${sz}：實驗線 ${J(a)} 本線 ${J(b)}`; }
    if (!only || only === 'press') { const a = lab.press(L.comp, seeds), b = port.press(w, L.comp, seeds); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return `距離 案例 ${c} 格 ${i}：實驗線 ${a[i]} 本線 ${b[i]}`; }
  }
  return null;
}

const edit = (t, a, b) => { if (t.split(a).length !== 2) throw new Error(`錨點要剛好一處：${a.slice(0, 50)}（${t.split(a).length - 1} 處）`); return t.replace(a, b); };

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d033-sewer.json')), T = S.text;
  const sha = s => crypto.createHash('sha256').update(s).digest('hex');
  const src = read('src/sim/rules/sewer.ts');

  // ---- 1. 出處與接線要靠的事實 ----
  {
    const bad = [];
    if (S.source?.commit !== PINNED) bad.push(`出處不是 ${PINNED.slice(0, 7)}：${S.source?.commit}`);
    const byName = Object.fromEntries(S.pieces.map(p => [p.name, p]));
    for (const [k, name] of Object.entries(KEY)) { const p = byName[name]; if (!p) bad.push(`缺 ${name}`); else if (sha(T[k]) !== p.sha) bad.push(`${name} 的 sha256 跟錨點記錄不同`); }
    if (S.pieces.length !== Object.keys(KEY).length) bad.push(`樣本 ${S.pieces.length} 段、守衛認得 ${Object.keys(KEY).length} 段`);
    const has = (k, s) => { if (!T[k].includes(s)) bad.push(`${KEY[k]} 裡沒有「${s.slice(0, 60)}」`); };
    has('hops', 'WATER_HOPS472=90');
    has('cycle', 'SEWER_ROOT_OK472[r]=(best<=WATER_HOPS472&&sc.volumeCap>0)?1:0');
    has('cycle', 'if(b.k===27&&scs.length){SC[scs[0]].volumeCap+=180*pf;');
    has('cycle', 'if(b.k===156&&scs.length){SC[scs[0]].volumeCap+=340*pf;');
    has('cycle', 'if([27,156,157].includes(b.k)&&waterFacilityPowerFactor472(b,i)>.3)');
    has('cycle', 'if(!WATER_FACILITY_K472.has(b.k)&&!isPowerSource450(b.k)){');
    has('cycle', 'if(scs.length)SC[scs[0]].roots.push(i);else disconnectedSewerRoots.push(i);');
    has('cycle', 'for(let dy=-1;dy<=sz;dy++)for(let dx=-1;dx<=sz;dx++)');
    has('assign', 'if(sewNeed442){if(sewerLegacy451())sewOk442=hasSewerNear442(x,y,2)&&sewered442<sewCap;else{allocateSewer451(x,y,2);sewOk442=!!sewerRootStatus472(si442)?.served;}}');
    has('assign', 'SEW_OK442[si442]=sewOk442?1:0;');
    has('forced', 'if(!waterLegacy449())ensureWaterCycle472(true);');
    has('legacy', 'window.__legacySewer451||window.__noSewerDistrict451');
    has('rootStatus', 'ensureWaterCycle472();');
    has('lv3Gate', '(!sewNeed442||SEW_OK442[i])');
    has('denseSewer', '(sewNeed442&&b.k===1&&b.lv>=3&&!SEW_OK442[ci])?-.04:0');
    has('foodLoop', 'foodCoreNeed482>0||se>0');
    has('relief', 'ind*.025');
    has('relief', 'countNear(i%N,(i/N)|0,3,tt=>tt.bld&&tt.bld.k===3)');
    has('canPlace', "if(toolId==='port'||toolId==='sewage'){if(countNear(x,y,1,tt=>tt.t===0)<2)return '需鄰近水域(≥2格)';}");
    has('doPlace', 't.bld={k:27,lv:1,v:ri(3),age:0,pw:true,h:1};t.tree=0;t.zone=0;t.deco=0;');
    // 回退旗標：供水是舊式、污水不是舊式（所以走 T451 非舊式分支、T472 說了算）
    if (!FALLBACK_FLAGS.includes('__legacyWater449')) bad.push('回退旗標沒有 __legacyWater449');
    if (FALLBACK_FLAGS.includes('__legacySewer451') || FALLBACK_FLAGS.includes('__noSewerDistrict451')) bad.push('回退旗標有舊式污水的旗標（接線的前提變了）');
    // 常數跟本線相同
    const num = (s, re) => { const m = re.exec(s); return m ? +m[1] : NaN; };
    if (SW.WATER_HOPS472 !== num(T.hops, /WATER_HOPS472=(\d+)/)) bad.push('WATER_HOPS472 不同');
    if (SW.SEWAGE_THRESHOLD442 !== num(T.sewConsts, /SEWAGE_THRESHOLD442=(\d+)/)) bad.push('SEWAGE_THRESHOLD442 不同');
    const setOf = (s, name) => J([...new Set(/new Set\(\[([\d,]+)\]\)/.exec(s)[1].split(',').map(Number))].sort((a, b) => a - b));
    if (setOf(T.facilityK) !== J([...SW.WATER_FACILITY_K472].sort((a, b) => a - b))) bad.push('水務設施集合不同');
    if (setOf(T.powerK) !== J([...SW.POWER_SOURCE_K450].sort((a, b) => a - b))) bad.push('發電廠種類不同');
    if (COST.sewage !== num(T.cost, /sewage:(\d+)/)) bad.push('污水廠造價不同');
    if (!T.toolDef.includes("nm:'污水廠'")) bad.push('工具名不是污水廠');
    // 純邏輯
    const code = src.replace(/\/\/.*$/gm, '');   // 註解裡可以提這些字
    for (const bannedRe of [/from 'three'/, /document\./, /window\./, /Math\.random/, /Date\.now/, /performance\.now/, /https?:\/\//]) if (bannedRe.test(code)) bad.push(`sewer.ts 有 ${bannedRe}`);
    log(!bad.length, `D033 污水原文：實驗線 ${PINNED.slice(0, 7)} 的 ${S.pieces.length} 段（水循環常數與水務設施集合與發電廠種類、管網元件／貼著的元件／距離／電力係數四個函式、ensureWaterCycle472 整段與 sewerRootStatus472、sewNeed 與接管指派、高密度污水、污水廠減壓、lv3Gate、污水廠計數、工具名與造價與鄰水判定與蓋法）逐段 sha256＝錨點記錄；常數跟本線相同；接線要靠的事實在原文裡成立；sewer.ts 是純函式`,
      bad.slice(0, 6).join('；') || `${S.pieces.length} 段、行號 ${S.pieces.map(p => p.line).sort((a, b) => a - b)[0]}–${S.pieces.map(p => p.endLine).sort((a, b) => b - a)[0]}；回退旗標有 __legacyWater449、沒有 __legacySewer451；WATER_HOPS472＝${SW.WATER_HOPS472}、門檻 ${SW.SEWAGE_THRESHOLD442}、造價 ${COST.sewage}`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const lab0 = makeLab(T), port0 = portSide(SW);
  {
    const d = compare(lab0, port0);
    let roots = 0, wpTiles = 0, comps = 0;
    for (const c of CASES) { roots += c.roots.length; for (const t of c.tiles) wpTiles += t.wp; }
    const seen = { pf: 0 }; const pfBad = [];
    for (const k of [27, 156, 157]) for (const pw of [true, false, undefined]) { const b = { k, pw }, a = lab0.pf(b, -1), c = port0.pf(b); seen.pf++; if (!Object.is(a, c)) pfBad.push(`k${k} pw ${pw}：實驗線 ${a} 本線 ${c}`); }
    for (const c of CASES.slice(0, 40)) { lab0.init(c.N, c.tiles); comps += lab0.comps().n; }
    log(d === null && !pfBad.length, `D033 驗收 2：管網與距離逐項＝實驗線——實驗線原文（buildPipeComponents472、facilityComps472、pressureDistances472、waterFacilityPowerFactor472）在 vm 裡跟本線 sewer.ts 吃 ${CASES.length} 張格子（420 張隨機 6–30 格、8 張 72×72 蛇形管網跨過距離的截斷）：元件編號逐格、每棟貼著的元件（含插入順序）、多源距離逐格、電力係數（k27／k156／k157 × pw 真假缺）逐位相等`,
      d ?? (pfBad.join('；') || `${CASES.length} 張、管網格 ${wpTiles}、建築 ${roots} 棟、電力係數 ${seen.pf} 組全等`));
  }

  // ---- 3. 注入錯誤要紅 ----
  {
    const ok0 = compare(lab0, port0) === null;
    const labMut = [   // [名稱, 鍵, from, to, 哪一項要紅]
      ['斜向也相鄰', 'powDir', '[[0,-1],[1,0],[0,1],[-1,0]]', '[[0,-1],[1,0],[0,1],[-1,0],[1,1]]', 'comps'],
      ['上邊差一格', 'facilityComps', 'add(x+d,y-1)', 'add(x+d,y-2)', 'fac'], ['下邊差一格', 'facilityComps', 'add(x+d,y+sz)', 'add(x+d,y+sz-1)', 'fac'],
      ['左邊差一格', 'facilityComps', 'add(x-1,y+d)', 'add(x-2,y+d)', 'fac'], ['右邊差一格', 'facilityComps', 'add(x+sz,y+d)', 'add(x+sz+1,y+d)', 'fac'],
      ['腳印只認一格', 'facilityComps', 'for(let dx=0;dx<sz;dx++)add(x+dx,y+dy);', 'for(let dx=0;dx<1;dx++)add(x+dx,y+dy);', 'fac'],
      ['截斷差一', 'pressure', 'nd<=WATER_HOPS472+32', 'nd<=WATER_HOPS472+31', 'press'], ['90 變 89', 'hops', 'WATER_HOPS472=90', 'WATER_HOPS472=89', 'press'],
      ['起點不看在不在管網上', 'pressure', 'if(i<0||i>=N*N||compArr[i]<0)continue;', 'if(i<0||i>=N*N)continue;', 'press'],
      ['每步 +2', 'pressure', 'const nd=d+(mainField(tiles[z])?0:1);', 'const nd=d+(mainField(tiles[z])?0:2);', 'press'],
      ['pw 為 false 的係數 .18 變 .5', 'powerFactor', 'b.pw===false?.18:1', 'b.pw===false?.5:1', 'pf'],
    ];
    const portMut = [
      ['元件連到非管網格', "if (comp[z] < 0 && tiles[z].wp) { comp[z] = n; q[m++] = z; }", "if (comp[z] < 0) { comp[z] = n; q[m++] = z; }", 'comps'],
      ['斜向也相鄰', 'const POW_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];', 'const POW_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1]];', 'comps'],
      ['上邊差一格', 'add(x + d, y - 1);', 'add(x + d, y - 2);', 'fac'], ['下邊差一格', 'add(x + d, y + sz);', 'add(x + d, y + sz - 1);', 'fac'],
      ['左邊差一格', 'add(x - 1, y + d);', 'add(x - 2, y + d);', 'fac'], ['右邊差一格', 'add(x + sz, y + d);', 'add(x + sz + 1, y + d);', 'fac'],
      ['腳印只認一格', 'for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) add(x + dx, y + dy);', 'for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < 1; dx++) add(x + dx, y + dy);', 'fac'],
      ['插入順序反過來', 'if (c >= 0 && !set.includes(c)) set.push(c);', 'if (c >= 0 && !set.includes(c)) set.unshift(c);', 'fac'],
      ['截斷差一', 'cutoff = WATER_HOPS472 + 32', 'cutoff = WATER_HOPS472 + 31', 'press'], ['90 變 89', 'export const WATER_HOPS472 = 90;', 'export const WATER_HOPS472 = 89;', 'press'],
      ['起點不看在不在管網上', 'if (i < 0 || i >= n || comp[i] < 0 || dist[i] === 0) continue;', 'if (i < 0 || i >= n || dist[i] === 0) continue;', 'press'],
      ['每步 +2', 'const nd = d + 1;', 'const nd = d + 2;', 'press'],
      ['pw 為 false 的係數 .18 變 .5', 'b.pw === false ? .18 : 1', 'b.pw === false ? .5 : 1', 'pf'],
    ];
    const missed = [], names = [];
    for (const [name, key, from, to, only] of labMut) {
      const T2 = { ...T, [key]: edit(T[key], from, to) };
      if (key === 'hops') T2.hops = edit(T.hops, from, to);
      const lab = makeLab(T2);
      let red;
      if (only === 'pf') { red = !Object.is(lab.pf({ k: 27, pw: false }, -1), port0.pf({ k: 27, pw: false })); }
      else red = compare(lab, port0, only) !== null;
      if (!red) missed.push(`實驗線 ${name}`); names.push(`實驗線：${name}`);
    }
    for (const [name, from, to, only] of portMut) {
      let M; try { M = await loadMod('src/sim/rules/sewer.ts', [[from, to]]); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      const port = portSide(M);
      let red;
      if (only === 'pf') red = !Object.is(lab0.pf({ k: 27, pw: false }, -1), port.pf({ k: 27, pw: false }));
      else red = compare(lab0, port, only) !== null;
      if (!red) missed.push(`本線 ${name}`); names.push(`本線：${name}`);
    }
    log(ok0 && !missed.length, `D033 驗收 5（突變）：注入錯誤要紅——實驗線原文 ${labMut.length} 個、本線原碼 ${portMut.length} 個（斜向相鄰、貼著的元件四邊各差一格、腳印只認一格、插入順序、起點不在管網上、每步 +2、截斷 +32 差一、90 差一、電力係數）；每個突變指定哪一項比對要紅、只跑那一項；沒改的先核過全等`,
      ok0 ? (missed.join('；') || `${names.length} 個全紅：${names.join('、')}`) : '沒改的就不等（上一項已紅）');
  }
}
