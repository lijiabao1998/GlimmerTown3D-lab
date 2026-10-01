// D033 對拍用的城：污水（H）——兩批。
//   layouts：隨機與手排的佈局（沒有推進，只讀實驗線 T472 的 SEWER_ROOT_OK472）：管網（有環、有岔、多個互不相連、鋪在路與建築底下）、污水廠（k27／k156／k157、貼一個或兩個管網元件、貼不到）、
//     各種大小的建築（1×1、2×2、3×3、4×4、角落相貼）、蛇形管網讓距離跨過 90、水務設施與發電廠（不當 root）。決定性種子（mulberry32），沒有 Math.random、現實時間。
//   runs：Q 系列（人口 ≥ 500 的自造城，連推 13 天，整條 tick 鏈逐欄比）：接管與沒接管的住宅在同一座城裡，lv2 升三級、高密度污水、污水廠減壓、人口剛好在 500 前後。
import fs from 'node:fs';
import path from 'node:path';
import { decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { ROOT } from './cdp.mjs';
import { builder } from './d021-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const range = (a, c, s = 1) => { const o = []; for (let x = a; x <= c; x += s) o.push(x); return o; };
export const SEWER_DAYS = 13;
const N = 72;

let ctx = null;
function context() {
  if (ctx) return ctx;
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), template = decodeLabCode(read('src/content/samples/newcity.code.txt').trim()).save.raw;
  return ctx = { KT, template, sizeOf: k => KT.size(k) };
}
const mk = (seed, day, name, fn) => { const { template, sizeOf } = context(), b = builder(template, sizeOf); fn(b); return b.code(seed, day, name, {}); };
const tryPut = (b, x, z, k, lv = 1, o = {}) => { try { b.put(x, z, k, lv, o); return true; } catch { return false; } };
const tryPipe = (b, x, z) => { try { b.pipeAt(x, z); return true; } catch { return false; } };
const house = (b, x, z, n = 0, lv = 1 + (n % 3)) => tryPut(b, x, z, 1, lv, { den: 1 + (n % 5), we: n % 3 });

// ---- 手排的佈局 ----
const HAND = [
  { id: 'H1-straight', note: '一條橫管、廠貼在管頭；兩側的住宅（貼著、只有角落相貼、底下有管、差一格）', build: b => {
    range(10, 60).forEach(x => b.pipeAt(x, 30)); tryPut(b, 9, 30, 27);
    [12, 16, 20].forEach((x, n) => house(b, x, 29, n)); [14, 18, 22].forEach((x, n) => house(b, x, 31, n));
    house(b, 30, 28); house(b, 31, 32);            // 差一格：沒貼著
    house(b, 40, 30); house(b, 44, 29); house(b, 61, 29); house(b, 62, 31);   // 管上的、管頭角落相貼、管尾外一格
    tryPut(b, 50, 31, 2); tryPut(b, 52, 29, 3);
  } },
  { id: 'H2-two-comps', note: '廠夾在兩條互不相連的管之間：容量只加進先插入的那個元件（上邊），下邊的住宅看得到廠、距離夠、卻不接管', build: b => {
    tryPut(b, 36, 36, 27);
    range(36, 50).forEach(x => b.pipeAt(x, 35)); range(36, 50).forEach(x => b.pipeAt(x, 37));
    [38, 42, 46].forEach((x, n) => { house(b, x, 34, n); house(b, x, 38, n + 1); });
  } },
  { id: 'H3-left-right', note: '廠左右各貼一條管（沒有上邊與下邊）：先插入左邊那個元件', build: b => {
    tryPut(b, 36, 36, 27);
    range(25, 35).forEach(x => b.pipeAt(x, 36)); range(37, 47).forEach(x => b.pipeAt(x, 36));
    [28, 32].forEach((x, n) => house(b, x, 35, n)); [40, 44].forEach((x, n) => house(b, x, 37, n));
  } },
  { id: 'H4-no-plant', note: '管網裡沒有污水廠：全部不接管（容量 0）', build: b => {
    range(10, 40).forEach(x => b.pipeAt(x, 20)); range(21, 30).forEach(z => b.pipeAt(25, z));
    [12, 20, 30, 38].forEach((x, n) => house(b, x, 19, n)); house(b, 26, 25); house(b, 24, 28);
    tryPut(b, 50, 50, 27); house(b, 49, 51);       // 另一座廠旁邊沒有管
  } },
  { id: 'H5-no-pipe', note: '沒有任何管：廠與住宅各自孤立；還有一格之差的管', build: b => {
    tryPut(b, 20, 20, 27); house(b, 21, 20); house(b, 20, 21); house(b, 22, 22);
    b.pipeAt(30, 30); house(b, 31, 31); house(b, 30, 32); house(b, 28, 30);
  } },
  { id: 'H6-far-serpentine', note: '蛇形管網（列距 3）：住宅貼在沿管走 60、80、86、88–93、95、100、115、120、123、125、128、140 格的地方（超過 90 不接管；超過 122 的距離算不到）', build: b => {
    const path = []; let x = 4, z = 4, dir = 1;
    path.push([x, z]);
    for (let row = 0; row < 9; row++) {
      for (let i = 0; i < 62; i++) { x += dir; path.push([x, z]); }
      if (row === 8) break;
      for (let i = 0; i < 3; i++) { z++; path.push([x, z]); }
      dir = -dir;
    }
    tryPut(b, 3, 4, 27);
    for (const [px, pz] of path) b.pipeAt(px, pz);
    const onPath = new Set(path.map(([px, pz]) => px + ',' + pz));
    for (const [n, j] of [60, 80, 86, 88, 89, 90, 91, 92, 93, 95, 100, 115, 120, 123, 125, 128, 140, 170].entries()) {
      const [px, pz] = path[Math.min(j, path.length - 1)];
      for (const [dx, dz] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) { const hx = px + dx, hz = pz + dz; if (onPath.has(hx + ',' + hz)) continue; if (house(b, hx, hz, n)) break; }
    }
  } },
  { id: 'H7-big-buildings', note: '2×2 社宅、3×3 巨廈、4×4 高級污水廠貼管的邊與角；提升站；腳印底下有管', build: b => {
    range(8, 62).forEach(x => b.pipeAt(x, 30));
    tryPut(b, 10, 31, 156);           // 4×4 高級污水廠，貼管的下邊
    tryPut(b, 20, 28, 127, 1, {}); tryPut(b, 26, 31, 127); tryPut(b, 32, 27, 105); tryPut(b, 40, 31, 33); tryPut(b, 46, 28, 127);
    tryPut(b, 52, 31, 2); tryPut(b, 56, 29, 3); tryPut(b, 14, 25, 157);
    b.pipeAt(40, 31); b.pipeAt(41, 32);   // 腳印底下的管
    house(b, 60, 27); house(b, 6, 29);
  } },
  { id: 'H8-facilities', note: '水務設施（水塔、淨水廠、海水淡化、供水加壓站）與發電廠貼著管：不當 root；住宅照常', build: b => {
    range(10, 50).forEach(x => b.pipeAt(x, 30)); tryPut(b, 9, 30, 27);
    tryPut(b, 14, 31, 10); tryPut(b, 18, 28, 129); tryPut(b, 24, 31, 153); tryPut(b, 30, 28, 155); tryPut(b, 33, 31, 5); tryPut(b, 36, 28, 58); tryPut(b, 44, 31, 140);
    [16, 22, 28, 34, 40, 48].forEach((x, n) => house(b, x, 29, n));
  } },
  { id: 'H9-border', note: '地圖邊緣：廠在角落、管沿著邊、住宅貼著邊', build: b => {
    tryPut(b, 0, 0, 27); range(1, 30).forEach(x => b.pipeAt(x, 0)); range(1, 20).forEach(z => b.pipeAt(0, z));
    [4, 10, 16].forEach((x, n) => house(b, x, 1, n)); [4, 10].forEach((z, n) => house(b, 1, z + 4, n));
    tryPut(b, 71, 71, 27); range(60, 70).forEach(x => b.pipeAt(x, 71)); house(b, 65, 70); house(b, 62, 70);
  } },
  { id: 'H10-ring', note: '環狀管網＋兩個出口、廠在環內：沿環繞過去的距離（BFS 最短）', build: b => {
    for (let i = 20; i <= 40; i++) { b.pipeAt(i, 20); b.pipeAt(i, 40); b.pipeAt(20, i); b.pipeAt(40, i); }
    tryPut(b, 30, 20, 27);
    [22, 28, 34, 38].forEach((x, n) => { house(b, x, 19, n); house(b, x, 41, n + 2); }); [24, 32].forEach((z, n) => { house(b, 19, z, n); house(b, 41, z, n + 1); });
    range(41, 60).forEach(x => b.pipeAt(x, 30));
    house(b, 55, 29); house(b, 58, 31);
  } },
  { id: 'H11-plant-on-pipe', note: '管鋪在廠的腳印底下、廠周圍的角也有管', build: b => {
    tryPut(b, 30, 30, 27); b.pipeAt(30, 30); b.pipeAt(29, 29); b.pipeAt(31, 31);
    range(25, 28).forEach(x => b.pipeAt(x, 29)); range(32, 36).forEach(z => b.pipeAt(31, z));
    house(b, 26, 28); house(b, 32, 34); house(b, 28, 31);
  } },
  { id: 'H12-power-pf', note: '同一個管網上放兩座廠（容量加總）；一座廠貼兩個元件、另一座貼一個', build: b => {
    range(10, 30).forEach(x => b.pipeAt(x, 30)); range(10, 30).forEach(x => b.pipeAt(x, 33));
    tryPut(b, 20, 31, 27); tryPut(b, 20, 34, 27); tryPut(b, 9, 33, 27);
    [12, 16, 24, 28].forEach((x, n) => { house(b, x, 29, n); house(b, x, 32, n); house(b, x, 35, n); });
  } },
];

// 蛇形管網（列距 3）的參數化版本：plant 在起點旁邊；houses 貼在沿管走 idxs 格的地方
function snakeLayout(ox, oz, rowLen, rows, idxs, flip = false) {
  return b => {
    const path = []; let x = ox + 1, z = oz, dir = 1;
    path.push([x, z]);
    for (let row = 0; row < rows; row++) {
      for (let i = 0; i < rowLen; i++) { x += dir; path.push([x, z]); }
      if (row === rows - 1) break;
      for (let i = 0; i < 3; i++) { z++; path.push([x, z]); }
      dir = -dir;
    }
    const P = ([px, pz]) => flip ? [pz, px] : [px, pz];
    tryPut(b, ...P([ox, oz]), 27);
    for (const q of path) { const [px, pz] = P(q); tryPipe(b, px, pz); }
    const onPath = new Set(path.map(q => P(q).join(',')));
    for (const [n, j] of idxs.entries()) {
      const [px, pz] = P(path[Math.min(j, path.length - 1)]);
      for (const [dx, dz] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) { const hx = px + dx, hz = pz + dz; if (onPath.has(hx + ',' + hz)) continue; if (house(b, hx, hz, n)) break; }
    }
  };
}
// 廠夾在兩條管之間（容量只加進先插入的那個元件）：向上下或左右、住宅每邊 8 棟
function twoCompsLayout(v) {
  return b => {
    const x0 = 6 + (v % 3) * 8, z0 = 20 + (v % 4) * 6, horiz = v % 2 === 0;
    const P = (x, z) => horiz ? [x, z] : [z, x];
    tryPut(b, ...P(x0, z0), 27);
    for (let i = 0; i < 40; i++) { tryPipe(b, ...P(x0 + i, z0 - 1)); tryPipe(b, ...P(x0 + i, z0 + 1)); }
    for (let n = 0; n < 8; n++) { house(b, ...P(x0 + 2 + n * 4, z0 - 2), n); house(b, ...P(x0 + 2 + n * 4, z0 + 2), n + 1); }
  };
}
const FAMILIES = [
  ...[[4, 4, 62, 9, false], [6, 3, 58, 9, true], [3, 6, 66, 8, false], [8, 8, 50, 10, false], [5, 5, 60, 9, true], [10, 4, 54, 9, false]].map(([ox, oz, rl, rows, flip], v) => ({
    id: `FAR${v}`, note: '蛇形管網：住宅貼在沿管走 60–170 格的地方，門檻 90 前後各幾棟', build: snakeLayout(ox, oz, rl, rows, [40, 70, 84, 86, 88, 89, 90, 91, 92, 94, 98, 110, 121, 124, 130, 150, 190, 230], flip) })),
  ...range(0, 5).map(v => ({ id: `TWO${v}`, note: '廠夾在兩條管之間（向上下或左右）：先插入的那個元件拿容量', build: twoCompsLayout(v) })),
];
// ---- 隨機佈局 ----
function randomLayout(i) {
  const rng = mulberry32(0x5e3 + i * 7919), r = () => rng(), ri = n => Math.floor(r() * n), pick = a => a[ri(a.length)];
  return b => {
    const pipes = [];
    const nNet = 1 + ri(3);
    for (let n = 0; n < nNet; n++) {                                // 管網：隨機走線
      let x = 4 + ri(N - 8), z = 4 + ri(N - 8), dir = ri(4), len = 6 + ri(50);
      const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (let s = 0; s < len; s++) {
        if (tryPipe(b, x, z)) pipes.push([x, z]);
        if (r() < .22) dir = ri(4);
        x += D[dir][0]; z += D[dir][1];
        if (x < 0 || z < 0 || x >= N || z >= N) { x = Math.max(0, Math.min(N - 1, x)); z = Math.max(0, Math.min(N - 1, z)); dir = ri(4); }
      }
    }
    for (let n = ri(3); n > 0; n--) {                               // 路：直線、有的底下鋪管
      const z = 4 + ri(N - 8), x0 = ri(N - 20), x1 = x0 + 8 + ri(40);
      try { b.road(x0, z, Math.min(N - 1, x1), z, 2 + ri(3)); } catch { /* 撞到建築就算了 */ }
      if (r() < .5) for (let x = x0; x <= Math.min(N - 1, x1); x++) tryPipe(b, x, z);
    }
    const near = () => { if (!pipes.length || r() < .25) return [ri(N), ri(N)]; const [px, pz] = pick(pipes); return [px + ri(7) - 3, pz + ri(7) - 3]; };
    const nPlant = r() < .15 ? 0 : 1 + ri(3);
    for (let n = 0; n < nPlant; n++) { const [x, z] = near(); const kk = r() < .72 ? 27 : r() < .6 ? 156 : 157; if (x >= 0 && z >= 0) tryPut(b, x, z, kk); }
    const KINDS = [1, 1, 1, 1, 1, 1, 2, 3, 127, 33, 105, 22, 4, 12, 7];
    const nB = 6 + ri(30);
    for (let n = 0; n < nB; n++) { const [x, z] = near(); if (x >= 0 && z >= 0 && x < N && z < N) tryPut(b, x, z, pick(KINDS), 1 + ri(3), { den: 1 + ri(5), we: ri(3) }); }
    if (r() < .35) for (let n = 1 + ri(3); n > 0; n--) { const [x, z] = near(); if (x >= 0 && z >= 0 && x < N && z < N) tryPut(b, x, z, pick([10, 129, 153, 154, 155, 130, 163, 5, 58, 140, 145, 150, 158, 159])); }
  };
}
// 後加的手排佈局（接在隨機佈局之後，前面各筆的種子不動）：距離起點的兩條規則——廠貼著的每一個元件都有起點（不只第一個）；提升站（k157）沒有容量、但是起點
const EXTRA = [
  { id: 'H13-seed-second-comp', note: '廠 A 夾在兩個元件之間（容量加給上面那個）；下面那個元件很長，它自己的廠 B 在另一頭（沿管走超過 90 格）：A 那頭的住宅靠 A 的起點（廠貼著的每一個元件都有起點）才接得到', build: b => {
    tryPut(b, 10, 30, 27); range(6, 14).forEach(x => b.pipeAt(x, 29));
    const path = []; let x = 9, z = 31, dir = 1; path.push([x, z]);
    for (let row = 0; row < 3; row++) { for (let i = 0; i < 58; i++) { x += dir; path.push([x, z]); } if (row === 2) break; for (let i = 0; i < 3; i++) { z++; path.push([x, z]); } dir = -dir; }
    for (const [px, pz] of path) b.pipeAt(px, pz);
    const end = path.at(-1); tryPut(b, end[0] + dir, end[1], 27);
    const onPath = new Set(path.map(q => q.join(',')));
    for (const [n, j] of [3, 6, 10, 14, 20, 40, 60, 80, 100, 130, 150].entries()) { const [px, pz] = path[j]; for (const [dx, dz] of [[0, 1], [0, -1]]) { const hx = px + dx, hz = pz + dz; if (onPath.has(hx + ',' + hz)) continue; if (house(b, hx, hz, n)) break; } }
  } },
  { id: 'H14-lift-seed', note: '長管網：污水廠在一頭、提升站（k157，沒有容量）在沿管走 100 格的地方：提升站旁的住宅靠提升站的起點接得到（距離廠超過 90）', build: b => {
    tryPut(b, 4, 4, 27);
    const path = []; let x = 5, z = 4, dir = 1; path.push([x, z]);
    for (let row = 0; row < 3; row++) { for (let i = 0; i < 62; i++) { x += dir; path.push([x, z]); } if (row === 2) break; for (let i = 0; i < 3; i++) { z++; path.push([x, z]); } dir = -dir; }
    for (const [px, pz] of path) b.pipeAt(px, pz);
    const [lx, lz] = path[100]; tryPut(b, lx, lz + 1, 157);
    const onPath = new Set(path.map(q => q.join(',')));
    for (const [n, j] of [96, 98, 100, 102, 104, 110, 120].entries()) { const [px, pz] = path[j]; for (const [dx, dz] of [[0, -1], [0, 1]]) { const hx = px + dx, hz = pz + dz; if (onPath.has(hx + ',' + hz)) continue; if (house(b, hx, hz, n)) break; } }
  } },
];
export const LAYOUT_RANDOM = 330;
let layCache = null;
export function d033Layouts() {
  if (layCache) return layCache;
  const out = [...HAND, ...FAMILIES].map((h, i) => ({ id: h.id, note: h.note, code: mk(5163300 + i, 100, '污水', h.build) }));
  for (let i = 0; i < LAYOUT_RANDOM; i++) out.push({ id: `R${String(i).padStart(3, '0')}`, note: '隨機佈局', code: mk(5163400 + i, 100, '污水', randomLayout(i)) });
  EXTRA.forEach((h, j) => out.push({ id: h.id, note: h.note, code: mk(5163800 + j, 100, '污水', h.build) }));
  return layCache = out;
}

// ---- Q 系列：人口 ≥ 500 的自造城（連推 13 天）----
// 共同的底：一條主街 z=30（兩端各一座電廠）；住宅貼著主街兩側（z=29、z=31：主街給電、也是通勤的入口）；管在住宅外側（z=28、z=32：貼著住宅、水塔給水、廠收污水）；
// 商業夾在住宅之間（就業要近：通勤罰看到最近就業區的路距）；兩所學校（覆蓋住宅區）；幾座大農場（糧食夠，幸福不被飢餓拉低）。
function base(b) {
  b.road(4, 30, 66, 30, 3); b.put(3, 30, 5); b.put(67, 30, 5);
  b.put(20, 35, 7, 1).put(49, 35, 7, 1);
  [6, 12, 18, 24, 30, 36].forEach(x => tryPut(b, x, 45, 53, 2));
  return b;
}
// 一條管網：x0..x1 的上下兩排管（z=28、z=32）加兩端的連接，住宅在 z=29（北排，lv 取 nLv）與 z=31（南排，lv 取 sLv），每四格一座商業；tower＝水塔位置、plant＝污水廠位置（貼在管頭或管尾外面）
function net(b, x0, x1, { tower, plant, nLv = 3, sLv = 2, den = 3, noHouse = false } = {}) {
  range(x0, x1).forEach(x => { b.pipeAt(x, 28); b.pipeAt(x, 32); });
  [x0, x1].forEach(x => [29, 30, 31].forEach(z => b.pipeAt(x, z)));
  if (tower) tryPut(b, tower[0], tower[1], 10);
  if (plant) tryPut(b, plant[0], plant[1], 27);
  if (noHouse) return;
  let n = 0, slot = 0;
  for (let x = x0 + 2; x <= x1 - 2; x += 2, slot++) {                // 隔一格一座商業（就業要比人口多，住宅需求才是正的，lv2 才升得了級）
    if (slot % 2 === 1) { tryPut(b, x, 29, 2, 3); tryPut(b, x, 31, 2, 3); continue; }
    house(b, x, 29, n, nLv); house(b, x, 31, n + 1, sLv); n++;
  }
}
const QDEFS = [
  { id: 'Q1', day: 150, note: '同一座城裡接管與沒接管並存：左半一條管（水塔＋污水廠）、右半另一條管（水塔、沒有廠）；左右各有 lv3 高密度住宅（pop > 500）與 lv2 住宅（有學校、有水、有電、有就業）——lv2 升三級只有左半過得了閘門、右半的 lv3 住宅有高密度污水 −.04', build: b => {
    base(b);
    net(b, 5, 33, { tower: [4, 28], plant: [34, 28], nLv: 2 });
    net(b, 37, 65, { tower: [36, 28] });
  } },
  { id: 'Q3', day: 120, note: '人口 < 500 的小城有污水廠、沒有管：所有住宅都算接管，污水廠減壓（近旁每座工業 +.025）照吃', build: b => {
    base(b); tryPut(b, 30, 33, 27);
    [8, 11, 14, 17, 20, 23, 26].forEach((x, n) => house(b, x, 29, n, 2)); [8, 11, 14, 17, 20, 23].forEach((x, n) => house(b, x, 31, n, 1 + (n % 3)));
    [10, 13, 16].forEach(x => tryPut(b, x, 27, 3, 1)); [22, 25].forEach(x => tryPut(b, x, 33, 3, 1));
  } },
  { id: 'Q4', day: 180, note: '人口 > 500、廠與管接好、近旁有工業：接管的住宅吃污水廠減壓；另一排住宅貼著沒有廠的管、同樣在工業旁，不吃', build: b => {
    base(b);
    net(b, 5, 33, { tower: [4, 28], plant: [34, 28], nLv: 2, den: 5 });
    net(b, 37, 65, { tower: [36, 28], nLv: 2 });
    [10, 22, 34].forEach(x => tryPut(b, x, 34, 3, 1)); [40, 52, 62].forEach(x => tryPut(b, x, 34, 3, 1));   // 管的外側（z=32）隔一格的工業，半徑 3 內
  } },
  { id: 'Q5', day: 160, note: '人口剛好在 500 上下：接管的住宅（右半）加一排沒接管的 lv3（左半、沒有廠）；右半一棟 lv3 帶著燃燒天數，第 4 天燒毀——人口從 500 以上掉到 500 以下，隔天起 sewNeed 關掉、沒接管的 lv3 的高密度污水 −.04 消失、lv2 的升級門檻回到小城的樣子', build: b => {
    base(b);
    net(b, 37, 65, { tower: [36, 28], plant: [66, 28], noHouse: true });
    [39, 47].forEach((x, n) => house(b, x, 29, n, 3)); tryPut(b, 63, 29, 1, 3, { den: 3, we: 1, fire: 1 });
    [41, 45, 51, 55].forEach((x, n) => house(b, x, 31, n, 2));
    range(5, 20).forEach(x => b.pipeAt(x, 28)); tryPut(b, 4, 28, 10);                             // 左：只有水塔和一條管（沒有廠）
    [6, 9, 12, 15, 18].forEach((x, n) => house(b, x, 29, n, 3));
  } },
  { id: 'Q7', day: 140, note: '人口 > 500、完全沒有污水廠：全部不接管（lv2 卡在二級、lv3 住宅 −.04）——D033 之前本線一樣', build: b => {
    base(b);
    net(b, 5, 33, { tower: [4, 28] });
    net(b, 37, 65, { tower: [36, 28] });
  } },
  { id: 'Q2', day: 120, note: '人口 < 500 的小城沒有污水廠、住宅旁有工業：所有住宅都算接管（sewNeed 關著），但沒有廠（se = 0）就沒有污水廠減壓——跟 Q3（有廠）對照', build: b => {
    base(b);
    [8, 11, 14, 17, 20, 23, 26].forEach((x, n) => house(b, x, 29, n, 2)); [8, 11, 14, 17, 20, 23].forEach((x, n) => house(b, x, 31, n, 1 + (n % 3)));
    [10, 13, 16].forEach(x => tryPut(b, x, 27, 3, 1)); [22, 25].forEach(x => tryPut(b, x, 33, 3, 1));
  } },
];
let qCache = null;
export function d033Runs() {
  if (qCache) return qCache;
  return qCache = QDEFS.map((q, i) => ({ id: q.id, note: q.note, code: mk(5163350 + 19 * i, q.day, '污水', q.build), days: SEWER_DAYS }));
}

// ---- 煙霧測試用（D033 驗收 8）：一座人口 ≥ 500、四種接管狀態的住宅都有、東邊有一個小水塘的城 ----
//   左網（水塔＋污水廠）→ 已接管；右網（水塔、沒有廠）→ 管網裡沒有污水廠；(12,38) 的住宅不貼任何水管 → 沒貼管線；
//   北邊一條蛇形管網（污水廠在起點，住宅貼在沿管走 40／70／100／130 格的地方）→ 已接管與超過 90 格。
//   水塘在右網東端外面（(66,27)、(67,27)、(67,28)）：玩家在 (66,28) 蓋污水廠剛好貼著右網的管、也鄰水（3×3 內 3 格水）——「蓋了廠，右網住宅從沒接管變接管」。
export const SMOKE_POND = [66, 28];
export function d033SmokeCity() {
  return mk(5163399, 150, '污水煙霧', b => {
    base(b);
    b.water(66, 27, 67, 27).water(67, 28, 67, 28);
    net(b, 5, 33, { tower: [4, 28], plant: [34, 28], nLv: 3, sLv: 2 });
    net(b, 37, 65, { tower: [36, 28], nLv: 3, sLv: 2 });
    house(b, 12, 38, 0, 2);
    snakeLayout(4, 4, 60, 5, [40, 70, 100, 130], false)(b);
  });
}
