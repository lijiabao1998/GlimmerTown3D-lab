// D017 Node 守衛：噪音（驗收 1、2、4）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d017-noise.json（tools/lab-noise.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；
//   2. 噪音場逐格＝實驗線：實驗線原文（NOISE、NOISE_SRC、noiseSig、rebuildNoise、idx；讀檔清場那一行）在 vm 裡跑，跟本線 src/sim/rules/fields.ts rebuildNoise
//      吃同一批隨機小圖（19 種噪音源、非噪音源、多格建築的 ref 格、貼邊、疊到 255），照建築索引與整張掃兩種呼叫、同一張圖連續多次（中間加減噪音源、
//      事先把地價髒標記設成框或乾淨）：逐格 NOISE、來源簽名、landDirty、landBox 每一次都相等；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一處（半徑、強度、簽名公式、不跳過 ref 格、上限、簽名變了不清框）；
//   4. 接線：day.ts 在 day++ 之前照建築索引算噪音（實驗線 54949 在 54950 之前）；讀檔 noiseSig −1、NOISE 全 0（56934）；
//      預建城（有體育場）讀檔後第一天、之後每天：本線的地價基準＝逐字照實驗線整張重算的慢速版（fullLand）；拆掉體育場的隔天簽名變 0、噪音歸零、
//      地價基準＝整張重算、體育場那一圈的地價基準真的變了；新城（沒有噪音源）第一天簽名 −1 → 0；
//   5. 不拖慢：預建城 72×72 算一次噪音的時間、推進一天的時間（只量；判噪音那一步 < 推進一天的 10%）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as labHelpers from '../src/sim/rules/lab.ts';
import { landStaticAt } from '../src/sim/rules/land.ts';
import { allocGrids, rebuildNoise, rebuildLandBase, NOISE_SRC } from '../src/sim/rules/fields.ts';
import { loadCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { commitOp } from '../src/sim/edit.ts';
import { codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { prebuilt16, prebuilt16Ops } from './d016-ops.mjs';
import { prebuiltCheck } from './unit-d016-parity.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const PIECES = ['idx', 'NOISE', 'NOISE_SRC', 'noiseSig', 'rebuildNoise', '每天開頭', '地價髒重建', '讀檔清場'];
const KEY = { idx: 'idx', NOISE: 'NOISE', NOISE_SRC: 'NOISE_SRC', noiseSig: 'noiseSig', rebuildNoise: 'rebuildNoise', 每天開頭: 'callTick', 地價髒重建: 'callLand', 讀檔清場: 'alloc' };

export async function d017Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D017 守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 實驗線那一邊：原文在 vm 裡（strict）；set＝換一張圖，照實驗線讀檔清場那一行（56934）清 NOISE、簽名 −1
function makeLab(t) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';let N=1,tiles=[],landDirty=false,landBox=null;\n${t.idx}\n${t.NOISE}\n${t.NOISE_SRC}\n${t.noiseSig}\n${t.rebuildNoise}\n`
    + `globalThis.__api={set:(n,ts)=>{N=n;tiles=ts;\n${t.alloc.trim()}\nlandDirty=false;landBox=null;},run:l=>rebuildNoise(l),dirty:(d,b)=>{landDirty=d;landBox=b;},`
    + `get:()=>({NOISE,noiseSig,landDirty,landBox}),kinds:()=>Object.keys(NOISE_SRC).map(Number)};`, ctx, { filename: 'lab:noise' });
  return ctx.__api;
}
// 本線那一邊（fields.ts 的 rebuildNoise；突變時傳型別剝除後在 vm 裡載入的那一份）
const makeMine = (rb = rebuildNoise) => {
  let w = null, g = null; const st = { noiseSig: -1, landDirty: false, landBox: null };
  return { set: (n, ts) => { w = { N: n, tiles: ts }; g = allocGrids(n); st.noiseSig = -1; st.landDirty = false; st.landBox = null; }, run: l => rb(w, g, st, l),
    dirty: (d, b) => { st.landDirty = d; st.landBox = b; }, get: () => ({ NOISE: g.NOISE, noiseSig: st.noiseSig, landDirty: st.landDirty, landBox: st.landBox }) };
};

// 隨機小圖：每張一串步驟，每一步先改建築（加、拆、換種類）、先把地價髒標記設成隨機的樣子，再照建築索引或整張掃呼叫
function cases(kinds) {
  const out = [], R = mulberry32(20261017), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  const other = [1, 2, 3, 4, 5, 6, 7, 11, 12, 100, 120, 200];
  for (let m = 0; m < 400; m++) {
    const N = m < 20 ? int(2, 5) : int(4, 40), tiles = Array.from({ length: N * N }, () => ({ t: 2, bld: null })), dense = m % 9 === 0;
    const put = () => {
      const k = dense ? pick([19, 174, 19, 173]) : ch(.7) ? pick(kinds) : pick(other), sz = ch(.25) ? int(2, 4) : 1;
      const x = dense ? int(Math.max(0, (N >> 1) - 2), Math.min(N - 1, (N >> 1) + 2)) : ch(.2) ? pick([0, N - 1]) : int(0, N - 1), y = dense ? int(Math.max(0, (N >> 1) - 2), Math.min(N - 1, (N >> 1) + 2)) : int(0, N - 1);
      tiles[y * N + x].bld = { k, lv: 1, v: 0, ...(sz > 1 ? { sz } : {}) };
      for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if ((dx || dy) && x + dx < N && y + dy < N) tiles[(y + dy) * N + x + dx].bld = { k, lv: 0, v: 0, ref: [x, y] };
    };
    for (let s = 0, n = dense ? int(12, 24) : int(0, Math.min(30, N * N >> 1)); s < n; s++) put();
    const steps = [];
    for (let s = 0, n = int(3, 7); s < n; s++) {
      const edit = [];
      if (s && ch(.6)) for (let e = 0, q = int(1, 3); e < q; e++) edit.push(ch(.5) ? 'add' : ch(.5) ? 'del' : 'swap');
      const pre = ch(.4) ? [false, null] : ch(.5) ? [true, null] : [true, { x0: int(0, N - 1), y0: 0, x1: N - 1, y1: N - 1 }];
      steps.push({ edit, pre, mode: ch(.55) ? 'list' : 'all', seed: int(0, 1e9) });
    }
    out.push({ N, tiles, steps, put, dense });
  }
  return out;
}
// 跑一批：兩邊（或同一邊）照同一串步驟，逐次回 [NOISE 陣列, 簽名, landDirty, landBox]；stopAt：第一次不同就停（突變用）
function runAll(A, B, list, onStep) {
  for (const [ci, c] of list.entries()) {
    const tiles = c.tiles.map(t => ({ ...t, bld: t.bld ? { ...t.bld } : null })), N = c.N, R = mulberry32(ci + 1);
    const edit = kind => {
      const roots = []; for (let i = 0; i < N * N; i++) { const b = tiles[i].bld; if (b && !b.ref) roots.push(i); }
      if (kind === 'add' || !roots.length) { const t = tiles[Math.floor(R() * N * N)]; t.bld = { k: [9, 19, 55, 62, 1, 5][Math.floor(R() * 6)], lv: 1, v: 0 }; return; }
      const i = roots[Math.floor(R() * roots.length)];
      if (kind === 'del') tiles[i].bld = null; else tiles[i].bld = { ...tiles[i].bld, k: [9, 17, 184, 2, 11][Math.floor(R() * 5)] };
    };
    A.set(N, tiles); B.set(N, tiles);
    for (const [si, s] of c.steps.entries()) {
      for (const e of s.edit) edit(e);
      A.dirty(s.pre[0], s.pre[1] && { ...s.pre[1] }); B.dirty(s.pre[0], s.pre[1] && { ...s.pre[1] });
      const list = s.mode === 'list' ? tiles.flatMap((t, i) => t.bld ? [i] : []) : null;
      A.run(list); B.run(list);
      if (onStep(ci, si, A.get(), B.get()) === false) return { ci, si };
    }
  }
  return null;
}
const sameState = (a, b) => a.noiseSig === b.noiseSig && a.landDirty === b.landDirty && J(a.landBox) === J(b.landBox) && a.NOISE.length === b.NOISE.length && a.NOISE.every((v, i) => v === b.NOISE[i]);

async function guards(log) {
  const gold = JSON.parse(read('src/content/samples/d017-noise.json')), t = gold.text ?? {};
  // ---- 1. 出處 ----
  {
    const bad = [];
    if (gold.source?.commit !== PINNED) bad.push('commit');
    if (J((gold.pieces ?? []).map(p => p.name)) !== J(PIECES)) bad.push(`片段清單 ${(gold.pieces ?? []).map(p => p.name).join(',')}`);
    for (const p of gold.pieces ?? []) if (crypto.createHash('sha256').update(t[KEY[p.name]] ?? '').digest('hex') !== p.sha) bad.push(`${p.name} 原文雜湊`);
    const lines = Object.fromEntries((gold.pieces ?? []).map(p => [p.name, p.line]));
    if (lines.NOISE_SRC !== 53021 || lines.rebuildNoise !== 53023 || lines['每天開頭'] !== 54949 || lines['地價髒重建'] !== 54997 || lines['讀檔清場'] !== 56934) bad.push(`行號 ${J(lines)}`);
    log(!bad.length, 'D017 噪音樣本：實驗線 d23c18d 的 8 段原文（NOISE 53020、NOISE_SRC 53021、noiseSig 53022、rebuildNoise 53023–53043、idx、每天開頭 54949、地價髒重建 54997、讀檔清場 56934），sha256 逐段＝錨點記錄',
      bad.join('；') || gold.pieces.map(p => `${p.name} ${p.sha.slice(0, 8)}`).join('、'));
  }
  // ---- 2. 逐格相等 ----
  const lab = makeLab(t), kinds = lab.kinds(), list = cases(kinds);
  {
    const bad = [], tally = { steps: 0, sigSame: 0, sigChanged: 0, keptBox: 0, sat: 0, refs: 0, edge: 0, nz: 0, maps: list.length };
    const srcBad = J(Object.keys(NOISE_SRC).map(Number).sort((a, b) => a - b)) !== J([...kinds].sort((a, b) => a - b));
    let prevSig = null;
    runAll(lab, makeMine(), list, (ci, si, a, b) => {
      tally.steps++;
      if (!sameState(a, b)) { bad.push(`第 ${ci} 張第 ${si} 步：實驗線 簽名 ${a.noiseSig} 髒 ${a.landDirty} 框 ${J(a.landBox)} ≠ 本線 ${b.noiseSig} ${b.landDirty} ${J(b.landBox)}${a.NOISE.every((v, i) => v === b.NOISE[i]) ? '' : '（NOISE 不同）'}`); return bad.length < 5; }
      if (si && a.noiseSig === prevSig) { tally.sigSame++; if (a.landBox) tally.keptBox++; } else tally.sigChanged++;
      prevSig = a.noiseSig;
      if (a.NOISE.some(v => v === 255)) tally.sat++;
      tally.nz += a.NOISE.filter(v => v).length;
      return true;
    });
    for (const c of list) { if (c.tiles.some(q => q.bld?.ref)) tally.refs++; if (c.tiles.some((q, i) => q.bld && !q.bld.ref && NOISE_SRC[q.bld.k] && (i % c.N === 0 || i % c.N === c.N - 1))) tally.edge++; }
    const covered = tally.sigSame > 50 && tally.sigChanged > 300 && tally.keptBox > 10 && tally.sat > 10 && tally.refs > 50 && tally.edge > 50;
    log(!bad.length && !srcBad && covered, 'D017 驗收 1：噪音場逐格＝實驗線——400 張隨機小圖、每張 3–7 步（中間加減噪音源、事先把地價髒標記設成框或乾淨），照建築索引與整張掃兩種呼叫：逐格 NOISE、來源簽名、landDirty、landBox 每一步都相等；19 種噪音源＝實驗線的表；簽名沒變不動地價、變了整張重算、疊到 255、多格建築的 ref 格、貼邊都出現過',
      bad.slice(0, 2).join('；') || (srcBad ? '噪音源的種類≠實驗線' : `${tally.steps} 步；簽名沒變 ${tally.sigSame}（其中框留著 ${tally.keptBox}）、變了 ${tally.sigChanged}；疊到 255 的步 ${tally.sat}；有 ref 格的圖 ${tally.refs}、噪音源貼邊的圖 ${tally.edge}；非零格累計 ${tally.nz.toLocaleString()}`));
  }
  // ---- 3. 注入錯誤 ----
  {
    const LAB_MUT = [
      ['體育場半徑 5→6', 'NOISE_SRC', '9:{r:5,p:26}', '9:{r:6,p:26}'],
      ['k19 強度 50→49', 'NOISE_SRC', '19:{r:8,p:50}', '19:{r:8,p:49}'],
      ['簽名 i*31→i*37', 'rebuildNoise', 'sig=(sig+i*31+b.k)>>>0;', 'sig=(sig+i*37+b.k)>>>0;'],
      ['不跳過 ref 格', 'rebuildNoise', 'if(!b||b.ref)return;', 'if(!b)return;'],
      ['上限 255→254', 'rebuildNoise', 'NOISE[j]=nv<255?nv:255;', 'NOISE[j]=nv<254?nv:254;'],
      ['簽名變了不清框', 'rebuildNoise', 'noiseSig=sig;landDirty=true;landBox=null;', 'noiseSig=sig;landDirty=true;'],
      ['距離用曼哈頓', 'rebuildNoise', 'const d=Math.max(Math.abs(dx),Math.abs(dy));', 'const d=Math.abs(dx)+Math.abs(dy);'],
    ];
    const MINE_MUT = [
      ['體育場半徑 5→6', '9: { r: 5, p: 26 }', '9: { r: 6, p: 26 }'],
      ['簽名 i*31→i*29', 'sig = (sig + i * 31 + b.k) >>> 0;', 'sig = (sig + i * 29 + b.k) >>> 0;'],
      ['不跳過 ref 格', "if (!b || b.ref) return;\n    const cfg = NOISE_SRC", "if (!b) return;\n    const cfg = NOISE_SRC"],
      ['上限 255→254', 'NOISE[j] = nv < 255 ? nv : 255;', 'NOISE[j] = nv < 254 ? nv : 254;'],
      ['簽名變了不清框', 'st.noiseSig = sig; st.landDirty = true; st.landBox = null;', 'st.noiseSig = sig; st.landDirty = true;'],
      ['強度四捨五入改無條件捨去', 'const v = Math.round(cfg.p * (1 - d / (cfg.r + 1)));', 'const v = Math.floor(cfg.p * (1 - d / (cfg.r + 1)));'],
    ];
    const caught = [], missed = [];
    const probe = (name, A, B) => { const d = runAll(A, B, list, (ci, si, a, b) => sameState(a, b)); (d ? caught : missed).push(d ? `${name}（第 ${d.ci} 張第 ${d.si} 步）` : name); };
    for (const [name, key, from, to] of LAB_MUT) {
      const k = KEY[key], parts = (t[k] ?? '').split(from);
      if (parts.length !== 2) { missed.push(`${name}：錨點不是剛好一處`); continue; }
      probe(`實驗線 ${name}`, makeLab({ ...t, [k]: parts.join(to) }), makeMine());
    }
    const src = read('src/sim/rules/fields.ts');
    const load = s => { const js = stripTypeScriptTypes(s).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''); const ctx = vm.createContext({ ...labHelpers, landStaticAt });
      vm.runInContext(`${js}\n;globalThis.__m = { rebuildNoise, allocGrids };`, ctx, { filename: 'mutant:fields.ts' }); return ctx.__m; };
    const base = load(src);
    const baseOk = !runAll(lab, makeMine(base.rebuildNoise), list.slice(0, 80), (ci, si, a, b) => sameState(a, b));
    for (const [name, from, to] of MINE_MUT) {
      const parts = src.split(from);
      if (parts.length !== 2) { missed.push(`本線 ${name}：錨點不是剛好一處（${parts.length - 1}）`); continue; }
      probe(`本線 ${name}`, lab, makeMine(load(parts.join(to)).rebuildNoise));
    }
    log(baseOk && !missed.length, `D017 驗收 1：注入錯誤要紅——實驗線原文 ${LAB_MUT.length} 個、本線原碼 ${MINE_MUT.length} 個（半徑、強度、簽名公式、不跳過 ref 格、上限、簽名變了不清框、距離、四捨五入）都比出差異（沒改的本線原碼在 vm 裡載入先核過相等）`,
      !baseOk ? '沒改的 fields.ts 在 vm 裡就不同' : missed.length ? `沒抓到：${missed.join('、')}` : caught.join('、'));
  }
  // ---- 4. 接線 ----
  {
    const bad = [], KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
    const day = read('src/sim/day.ts'), a = day.indexOf('rebuildNoise(w, g, s, tickBld)'), b = day.indexOf('s.day++;');
    if (!(a > 0 && b > a && day.split('rebuildNoise(w,').length === 2)) bad.push('day.ts 要在 s.day++ 之前、只呼叫一次 rebuildNoise（照建築索引）');
    const pre = codeWithSeed(read('src/content/samples/d011-prebuilt.code.txt').trim(), 5162026), newc = codeWithSeed(read('src/content/samples/newcity.code.txt').trim(), 5162026);
    const L1 = loadCode(pre, KT, vrank), L2 = loadCode(pre, KT, vrank), s1 = L1.sim, s2 = L2.sim;   // s2＝逐字照實驗線整張重算的慢速版
    if (s1.noiseSig !== -1 || s1.g.NOISE.some(v => v)) bad.push(`讀檔後 noiseSig ${s1.noiseSig}、NOISE 非零 ${s1.g.NOISE.filter(v => v).length} 格（要 −1、全 0）`);
    const n = s1.w.N, stad = s1.w.tiles.findIndex(q => q.bld && !q.bld.ref && q.bld.k === 9);
    const fresh = s => { const g = allocGrids(n); g.COV = s.g.COV; g.POL = s.g.POL; g.EDU = s.g.EDU; g.NOISE = s.g.NOISE; rebuildLandBase(s.w, g); return g.LANDBASE; };
    const eq = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
    let nzMax = 0, before = null;
    for (let d = 1; d <= 6; d++) {
      if (d === 4) {   // 第 4 天開頭之前拆體育場（框選拆除它的根格；一級不用確認）
        before = s1.g.LANDBASE.slice();
        for (const s of [s1, s2]) commitOp(s, { k: 'rect', tool: 'doze', x0: stad % n, z0: (stad / n) | 0, x1: stad % n, z1: (stad / n) | 0 }, 0);
      }
      stepDay(s1); stepDay(s2, { fullLand: true });
      nzMax = Math.max(nzMax, s1.g.NOISE.filter(v => v).length);
      if (!eq(s1.g.LANDBASE, s2.g.LANDBASE)) bad.push(`第 ${d} 天：地價基準（只算 stale）≠ 整張重算`);
      if (!eq(s1.g.LANDBASE, fresh(s1))) bad.push(`第 ${d} 天：地價基準 ≠ 照現在的場從頭算`);
      if (d === 1 && s1.noiseSig !== (stad * 31 + 9) >>> 0) bad.push(`第 1 天簽名 ${s1.noiseSig}（體育場在 ${stad}）`);
      if (d === 4 && (s1.noiseSig !== 0 || s1.g.NOISE.some(v => v))) bad.push(`拆掉體育場的隔天：簽名 ${s1.noiseSig}、NOISE 非零 ${s1.g.NOISE.filter(v => v).length} 格`);
    }
    const changed = before ? before.filter((v, i) => v !== s1.g.LANDBASE[i]).length : 0;
    const nc = loadCode(newc, KT, vrank).sim; stepDay(nc);
    if (nc.noiseSig !== 0) bad.push(`新城第 1 天簽名 ${nc.noiseSig}（要 0）`);
    if (!(stad >= 0 && nzMax > 0 && changed > 0)) bad.push(`體育場 ${stad}、噪音非零格最多 ${nzMax}、拆了之後地價基準變了 ${changed} 格`);
    log(!bad.length, 'D017 驗收 2：接線——day.ts 在 day++ 之前照建築索引算噪音（實驗線 54949 在 54950 之前）；讀檔 noiseSig −1、NOISE 全 0（56934）；預建城讀檔後 6 天每天的地價基準＝逐字照實驗線整張重算＝照當下的場從頭算；第 4 天拆掉體育場，隔天簽名 0、噪音歸零、體育場那一圈的地價基準變回來；新城第 1 天簽名 −1 → 0',
      bad.slice(0, 3).join('；') || `體育場在第 ${stad} 格；噪音非零 ${nzMax} 格；拆了之後地價基準變了 ${changed} 格`);
  }
  // ---- 6. 實驗線頁面實跑（驗收 3）：預建城留著體育場，蓋九種設施、拆診所再復原、推進一天（tools/d016-parity.mjs --set=d017 → d017-lab.json）----
  {
    const file = 'src/content/samples/d017-lab.json';
    if (!fs.existsSync(path.join(ROOT, file))) log(false, 'D017 驗收 3：實驗線頁面實跑', `${file} 不存在：跑 tools/d016-parity.mjs --set=d017`);
    else {
      const lab = JSON.parse(read(file)), seeds = lab.seeds ?? [], KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
      const prebuilt = read('src/content/samples/d011-prebuilt.code.txt').trim(), bad = [];
      if (lab.source?.commit !== PINNED || lab.keepNoise !== true || seeds.length < 8 || seeds.some(s => !lab.prebuilt?.[s]?.inv || !lab.prebuilt[s].probe)) bad.push('樣本的出處、keepNoise、種子數或欄位不齊（重跑 tools/d016-parity.mjs --set=d017）');
      const P = prebuilt16Ops(loadCode(codeWithSeed(prebuilt, seeds[0] ?? 5162026), KT, vrank).sim, true), pre = {};
      if (P.ops.some(o => o.k === 'rect' && o.tool === 'doze' && P.at.every(([, x, z]) => x !== o.x0 || z !== o.z0))) bad.push('劇本拆了噪音源（D017 要留著體育場）');
      for (const seed of seeds) pre[seed] = prebuilt16(codeWithSeed(prebuilt, seed), KT, vrank, {}, false, true);
      const r = bad.length ? { bad: [], moved: [], noisy: [] } : prebuiltCheck(seeds, pre, lab.prebuilt, P, seed => new Map(prebuilt16(codeWithSeed(prebuilt, seed), KT, vrank, {}, true, true).hs));
      bad.push(...r.bad);
      if (!bad.length && !r.noisy.every(v => v > 0)) bad.push(`有種子推進前就在的住宅沒有一棟在噪音裡：${r.noisy.join('、')}`);
      log(!bad.length, `D017 驗收 3：實驗線頁面實跑（${seeds.length} 個種子，${lab.source?.commit?.slice(0, 7)}）——預建城留著體育場，蓋九種設施、拆診所再復原、推進一天：每一筆逐項相等；推進後住商工以外的格子、覆蓋、地價 LANDBASE／LAND（含噪音那一項）、推進前就在的住商工有電、生長之前的抽取相等；推進前就在的每一棟住宅，實驗線的幸福＝本線的幸福依序套垃圾與糧食（含噪音那一項），逐位相等；每個種子都有住宅在體育場的噪音裡`,
        bad.slice(0, 3).join('；') || `住在噪音裡的住宅 ${r.noisy.join('、')} 棟；幸福被設施改到的 ${r.moved.join('、')} 棟`);
    }
  }
  // ---- 5. 不拖慢 ----
  {
    const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
    const s = loadCode(codeWithSeed(read('src/content/samples/d011-prebuilt.code.txt').trim(), 5162026), KT, vrank).sim, n = s.w.N;
    const list = s.w.tiles.flatMap((q, i) => q.bld ? [i] : []), st = { noiseSig: -1, landDirty: false, landBox: null };
    for (let k = 0; k < 50; k++) rebuildNoise(s.w, s.g, st, list);
    let t0 = performance.now(); for (let k = 0; k < 500; k++) rebuildNoise(s.w, s.g, st, list); const perNoise = (performance.now() - t0) / 500;
    for (let k = 0; k < 5; k++) stepDay(s);
    t0 = performance.now(); for (let k = 0; k < 40; k++) stepDay(s); const perDay = (performance.now() - t0) / 40;
    log(perNoise < perDay * .1, `D017 驗收 4：不拖慢——預建城 ${n}×${n}：算一次噪音（含清場與簽名）＜ 推進一天的 10%`, `噪音 ${(perNoise * 1000).toFixed(1)} µs、推進一天 ${perDay.toFixed(2)} ms（${(perNoise / perDay * 100).toFixed(1)}%）`);
  }
}
