// D020 對拍的操作劇本與本線那一半（驗收 3、4）：實驗線頁面（tools/d016-parity.mjs --set=d020）和本線（這裡的 prebuilt20／garbFromLab）吃同一份劇本，
// 格式與逐筆的做法同 tools/d011-ops.mjs（run3d、頁面裡的 apply）；量法同 tools/d011-parity-lib.mjs（同一段原始碼）。
//   預建城（d011-prebuilt.code.txt 換種子，500 人以下）：錢設 20000；住商工範圍裡照格索引找第一格「四鄰有路」的空地放垃圾場（接路），
//     再找第一格「四鄰沒有路」的空地放第二座（不接路：500 人以下容量照算，距離場不從它出發）→ 推進一天。
//     比每一筆、推進後住商工以外的格子與場、推進前就在的住商工有電、生長之前的抽取；推進前就在的每一棟住宅的幸福直接相等（只剩糧食那一項要套）；
//     垃圾量、容量、比例、全城懲罰、太遠的棟數、清運區數、評分用的比例與評分的垃圾那一項＝實驗線。
//   實驗線頁面在垃圾那一段（55257）前後各插一行探針（不加換行，行號不變）：前面記每一棟的電、水、生病、死亡、幸福與人口、工業就業、城市幸福，
//   後面記垃圾量、容量、比例、懲罰、太遠／沒清運／偏遠的棟數、評分用的比例、清運區數、正式清運與每一棟住宅的幸福。
//   本線拿「前面那一份」原樣代進 garbageDay（src/sim/rules/garbage.ts），算出來要跟「後面那一份」逐位相等——預建城與讀進來的城（AI 城 120 天、種子城）都比。
//   讀進來的城其他第 2 類系統（生病、通勤……）讓兩邊推進前的幸福與人口本來就不同，所以用實驗線自己的輸入比垃圾這一段。
import { loadCode, saveCode } from '../src/io/save.ts';
import { garbageDay, garbDecisionRatio452 } from '../src/sim/rules/garbage.ts';
import { harness, invOf, pwOf, hsOf, diffOf, row3d } from './d011-parity-lib.mjs';
import { civvOf } from './d016-ops.mjs';

// 垃圾那一段前面的輸入（實驗線頁面、本線同一段）：每一棟（根格）[格索引, k, 有電, 有水, 生病, 死亡, 幸福]
export const GB_SRC = `(tiles=>{const o=[];for(let i=0;i<tiles.length;i++){const b=tiles[i].bld;if(b&&!b.ref)o.push([i,b.k,b.pw?1:0,b.wa?1:0,b.sick?1:0,b.death?1:0,b.h===undefined?null:b.h]);}return o;})`;
export const gbOf = new Function(`return ${GB_SRC}`)();
// 實驗線頁面插的兩行（不加換行）：錨點是那一段的第一行與下一段的開頭
export const HOOK_BEFORE = ['const recycleMul452=(pol&&pol.recycle?.85:1);', 'window.__d020b&&window.__d020b(tiles,pop,jobsI,cityHappy);'];
export const HOOK_AFTER = ['computeBusRtCovPop();prepareCivicServices495(entNow489);',
  'window.__d020a&&window.__d020a({garbage,garbCap,garbRatio,garbPen409,far:garbFar409,unserved:garbUnserved445,warn:garbWarn445,dec:garbDecisionRatio452(),districts:sanDistricts452.length,formal:!!sanStat445.formal,cityHappy,tiles});'];
// 評分（56117–56121）：score 已算好、scoreParts 還沒寫之前（人口 <50 不評分就不會叫）
export const HOOK_SCORE = ['scoreParts={happy:happyScore,job:jobScore,fire:fireScore,garb:garbScore,edu:eduScore};', 'window.__d020s&&window.__d020s(score,garbScore);'];

export function prebuilt20Ops(s) {
  const n = s.w.N, T = s.w.tiles, rci = [];
  const land = i => T[i].t === 1 || T[i].t === 2, free = i => land(i) && !T[i].road && !T[i].bld && !T[i].ruin && !T[i].crater;
  const roadNear = i => { const x = i % n, z = (i / n) | 0; return [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dz]) => x + dx >= 0 && z + dz >= 0 && x + dx < n && z + dz < n && T[(z + dz) * n + x + dx].road); };
  T.forEach((t, i) => { if (t.bld && !t.bld.ref && t.bld.k >= 1 && t.bld.k <= 3) rci.push([i % n, (i / n) | 0]); });
  if (!rci.length) throw new Error('D020 預建城劇本：沒有住商工');
  const zs = rci.map(q => q[1]), xs = rci.map(q => q[0]), z0 = Math.min(...zs), z1 = Math.max(...zs), x0 = Math.min(...xs), x1 = Math.max(...xs);
  let on = -1, off = -1;
  for (let z = z0; z <= z1 && on < 0; z++) for (let x = x0; x <= x1 && on < 0; x++) { const i = z * n + x; if (free(i) && roadNear(i)) on = i; }
  for (let i = 0; i < n * n && off < 0; i++) if (free(i) && !roadNear(i) && i !== on) off = i;
  if (on < 0 || off < 0) throw new Error(`D020 預建城劇本：找不到放垃圾場的地方（接路 ${on}、不接路 ${off}）`);
  const ops = [{ k: 'money', v: 20000 }, { k: 'tap', tool: 'dump', x: on % n, z: (on / n) | 0 }, { k: 'tap', tool: 'dump', x: off % n, z: (off / n) | 0 }];
  return { ops, on, off };
}

// 預建城：劇本 → 推進一天（本線那一半）
export function prebuilt20(code, KT, vrank) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進預建城：' + L.error);
  const s = L.sim, P = prebuilt20Ops(s), h = harness(s);
  const out = { mig: L.restyled, snap0: h.head(h.snap()) };
  out.ops = h.batch(P.ops);
  const a = h.snap();
  out.snapOps = h.head(a); out.civvOps = civvOf(s.w.tiles);
  out.pwBefore = pwOf(s.w.tiles).map(r => r[0]); out.hsBefore = hsOf(s.w.tiles).map(r => r[0]);
  out.tiles0 = JSON.parse(JSON.stringify(s.w.tiles));   // 推進前的格子（代進實驗線的輸入用）
  const t = h.tick(), b = h.snap();
  out.tickDraws = t.draws; out.tickSites = t.sites; out.tickLand = t.land; out.tickExtra = t.extra; out.day1 = row3d(s); out.settle = t.rep.settle; out.garb = t.rep.garb; out.food = t.rep.food; out.pop = t.rep.pop;
  out.post = h.head(b, false); out.postChanged = diffOf(a.proj, b.proj);
  out.inv = invOf(s.w.tiles, s.g.COV, s.g.POLTREE, s.g.LANDBASE, s.g.LAND); out.pw = pwOf(s.w.tiles); out.hs = hsOf(s.w.tiles);
  out.code = saveCode(s, L.template, L.start);
  out.P = P; out.sim = s; out.load = L;
  return out;
}
// 讀進來的城：推進前的格子（讀檔之後、還沒推進）
export function sampleTiles(code, KT, vrank) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進樣本城：' + L.error);
  return JSON.parse(JSON.stringify(L.sim.w.tiles));
}

// 實驗線垃圾那一段前面的輸入（gb）代進本線 garbageDay：格子用本線自己的（路、建築位置兩邊相同，對拍過），
// 每一棟的電、水、生病、死亡、幸福換成實驗線那一刻的值；人口、工業就業、城市幸福也用實驗線的。回傳的形狀同頁面「後面那一份」
export function garbFromLab(tiles0, gb) {
  const tiles = JSON.parse(JSON.stringify(tiles0)), N = Math.round(Math.sqrt(tiles.length)), w = { N, tiles }, bad = [];
  const seen = new Set(gb.b.map(r => r[0]));
  for (const [i, k, pw, wa, sick, death, h] of gb.b) {
    const b = tiles[i]?.bld;
    if (!b || b.ref || b.k !== k) { bad.push(`第 ${i} 格：實驗線 k${k}，本線 ${b ? (b.ref ? 'ref' : 'k' + b.k) : '沒有建築'}`); continue; }
    b.pw = !!pw; b.wa = !!wa; b.sick = sick ? 1 : 0; b.death = death ? 1 : 0; if (h !== null) b.h = h;
  }
  tiles.forEach((t, i) => { if (t.bld && !t.bld.ref && !seen.has(i)) bad.push(`第 ${i} 格：本線有 k${t.bld.k}，實驗線沒有`); });
  const order = []; for (let i = 0; i < tiles.length; i++) if (tiles[i].bld) order.push(i);
  const r = garbageDay(w, order, gb.pop, gb.jobsI, gb.cityHappy, 1);
  return { bad, ga: { garbage: r.garbage, garbCap: r.garbCap, garbRatio: r.garbRatio, garbPen409: r.garbPen409, far: r.loc.far, unserved: r.loc.unserved, warn: r.loc.warn,
    dec: garbDecisionRatio452(r.san, w, r.garbRatio, 1), districts: r.san.districts.length, formal: r.san.formal, cityHappy: r.cityHappy, h: hsOf(tiles) } };
}
