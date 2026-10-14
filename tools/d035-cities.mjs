// D035 對拍用的城：讀檔圖層補齊（L）——兩批。
//   runs：L 系列（連推 13 天，整條 tick 鏈逐欄比，同 D034 的 M 系列）：存檔帶著公車站、路旁裝飾、輕軌、高壓線、地下高壓、污水幹管、單行道、紅綠燈、公車專用道、裝飾，
//     每一座都是「讀了這些層才跟實驗線一樣」的城（本線沒讀的那一版會差）：
//       L1 公車站與路旁裝飾（覆蓋進幸福與商業稅）；L2 輕軌與公車站（夜間城市的轉運節點）；
//       L3a／L3b／L3c 高壓線接力（發電廠不在路網上、高壓線接到開關站，遠端住宅區才有電；斷開的、地下的）；
//       L4a／L4b 污水幹管橋接兩個管網（人口 ≥ 500，右半管網沒有廠；有幹管才接管；差一格的對照）；L5 全部混在一起（再加單行道、紅綠燈、公車專用道、裝飾）。
//   layouts：污水幹管的佈局（只讀實驗線 T472 的 SEWER_ROOT_OK472，不推進）：手排與隨機的 wp 管網加 sm472 幹管——幹管橋接元件、與管混鋪、起點在幹管上、0 成本的環、距離剛好 90／91／122／123。
// 決定性：全部用座標與固定種子（mulberry32）算出來，沒有 Math.random、現實時間。
import { mulberry32 } from '../src/sim/rng.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { FLAG_LAYERS } from '../src/sim/rules/lab.ts';
import { mk, tryPut, base, pipes, cluster, parksAt, range, house, services, m1 } from './d034-cities.mjs';

export const L_DAYS = 13;
const N = 72;
const flagsAt = (b, name, pts, v = 1) => pts.forEach(([x, z]) => { try { b.flag(name, x, z, v); } catch { /* 出界就算了 */ } });
const row = (x0, x1, z, step = 1) => range(x0, x1, step).map(x => [x, z]);

// ---- runs ----
// L1：M1 的城（幸福 .6–.8、人口夠）＋主街 z=30 上的公車站（半徑 6）與路旁裝飾（半徑 2）：北邊 z=28–29 的住宅簇與商業簇一路被覆蓋到一半
function l1(b) {
  m1(b);
  flagsAt(b, 'bs', [[10, 30], [18, 30], [26, 30], [34, 30]]);
  flagsAt(b, 'rc', [[14, 30], [22, 30], [30, 30], [38, 30]]);
}
// L2：輕軌沿主街鋪（路格上的輕軌各算 .35 個轉運節點）＋三個公車站：夜間照明、安全隔天回到幸福與犯罪
function l2(b) {
  m1(b, { parks: false });
  parksAt(b, range(10, 42, 8), 26);
  flagsAt(b, 'tr', row(6, 64, 30));
  flagsAt(b, 'bs', [[12, 30], [30, 30], [48, 30]]);
}
// L3：發電廠（3,30）只供主街 R1（z=30，x 4–28）；第二條路 R2（z=36，x 30–66）離主街四格、沒有路相連。
//   高壓線：從發電廠下面 (3,31) 下到 z=33、往東到 x=40、再往下 (40,34) 貼著開關站 k148（2×2，(40,34)–(41,35)）——線的元件貼著發電廠（起點）又貼著開關站，開關站就是配電起點；
//   開關站貼著 R2 的路格（它的下邊 z=36）。R2 兩側的住宅（z=35 北排貼著開關站的左右、z=37 南排）靠它才有電。
//   gap：斷開一格（線的元件沒碰到發電廠，開關站不是起點，R2 全黑）；ug：中間一段用地下高壓（ug471）接，同樣通
function l3(b, { gap = false, ug = false } = {}) {
  b.road(4, 30, 28, 30, 3); b.put(3, 30, 5); b.put(29, 30, 5);
  b.road(30, 36, 66, 36, 3);   // R2：兩端都沒有發電廠，靠高壓線接力才有電
  b.put(10, 28, 7, 1); b.put(50, 38, 7, 1);
  tryPut(b, 40, 34, 148);      // 開關站 k148（2×2）先放：下邊 z=36 貼著 R2；第二座開關站 k128 沒有高壓線：不接力
  tryPut(b, 56, 34, 128);
  range(6, 26, 4).forEach((x, n) => { tryPut(b, x, 29, 1, 3, { den: 1 + (n % 5), we: n % 3 }); tryPut(b, x, 31, 2, 3); });
  range(36, 64, 2).forEach((x, n) => { tryPut(b, x, 35, 1, 3, { den: 1 + (n % 5), we: n % 3 }); tryPut(b, x, 37, n % 3 === 2 ? 2 : 1, 3, { den: 2 + (n % 4), we: n % 3 }); });
  // 高壓線：(3,31) 貼著發電廠，往下到 z=33、往東到 x=40、(39,34) 貼著開關站的左邊
  const line = [[3, 31], [3, 32], ...row(3, 40, 33), [39, 34]];
  const dead = gap ? line.filter(([x, z]) => !(x === 20 && z === 33)) : line;
  const under = ug ? dead.filter(([x, z]) => z === 33 && x >= 12 && x <= 24) : [];
  flagsAt(b, 'hvl471', dead.filter(p => !under.some(q => q[0] === p[0] && q[1] === p[1])));
  flagsAt(b, 'ugc471', under);
}
// L4：M1 的底（一條管網 z=27／z=30，住宅簇貼著管）拆成左右兩段：左段 x 5–18（水塔在管頭、污水廠 (19,27) 貼管尾），右段 x 23–50（沒有廠）；
//   中間 x 19–22 沒有管。a：z=30 上鋪 sm472（污水幹管）19–22 把兩段接成一個元件（廠的容量才到得了右半）；b：差一格（x=21 缺），沒接上
function l4city(b, { bridged = true } = {}) {
  base(b); services(b);
  range(5, 18).forEach(x => { b.pipeAt(x, 27); b.pipeAt(x, 30); }); range(27, 30).forEach(z => b.pipeAt(5, z));
  range(23, 50).forEach(x => { b.pipeAt(x, 27); b.pipeAt(x, 30); }); range(27, 30).forEach(z => b.pipeAt(23, z));
  tryPut(b, 4, 27, 10); tryPut(b, 22, 27, 10); tryPut(b, 19, 27, 27);
  [10, 14, 18, 22, 26, 30, 34, 38].forEach((x, n) => { cluster(b, x, 28, { kind: 1, lv: 3, n }); cluster(b, x + 2, 28, { kind: 2, lv: 3 }); });
  [10, 14].forEach((x, n) => { cluster(b, x, 31, { kind: 1, lv: 3, n: n + 4 }); cluster(b, x + 2, 31, { kind: 2, lv: 3 }); });
  parksAt(b, range(10, 42, 4), 26); parksAt(b, range(10, 18, 4), 34);
  flagsAt(b, 'smn472', range(19, 22).filter(x => bridged || x !== 21).map(x => [x, 30]));
}
// L5：全部混在一起。M1 的城＋公車站、路旁裝飾、輕軌、單行道、紅綠燈、公車專用道、裝飾（空地上）、一條沒接到任何東西的高壓線、一小段幹管、一小段水幹管（回退設定走舊式供水，沒有讀者，只看格子）
function l5(b) {
  m1(b);
  flagsAt(b, 'bs', [[8, 30], [24, 30], [40, 30], [56, 30]]);
  flagsAt(b, 'rc', [[12, 30], [28, 30], [44, 30]]);
  flagsAt(b, 'tr', row(16, 36, 30));
  flagsAt(b, 'ow', [[46, 30], [47, 30], [48, 30]]); flagsAt(b, 'tl', [[20, 30], [52, 30]]); flagsAt(b, 'bln', row(58, 62, 30));
  flagsAt(b, 'dc', [...row(8, 60, 40, 4), ...row(8, 60, 44, 6)], 3); flagsAt(b, 'dc', row(9, 61, 41, 8), 1);
  flagsAt(b, 'hvl471', row(8, 30, 52)); flagsAt(b, 'ugc471', row(31, 36, 52));
  flagsAt(b, 'smn472', row(5, 8, 27)); flagsAt(b, 'wmn472', row(20, 30, 56));
}
const DEFS = [
  { id: 'L1', note: '公車站（半徑 6）與路旁裝飾（半徑 2）：覆蓋內的住宅幸福 +.04／+.03、覆蓋內商業的稅 ×1.1', build: l1 },
  { id: 'L2', note: '輕軌沿主街、三個公車站：夜間城市的轉運節點（路格上的輕軌 .35 個）進照明與安全，隔天回到幸福與犯罪', build: l2 },
  { id: 'L3a', note: '高壓線接力：發電廠只供主街，第二條路靠高壓線接到開關站 k148 才有電', build: b => l3(b) },
  { id: 'L3b', note: '高壓線斷開一格：線的元件碰不到發電廠，開關站不是起點，第二條路全黑', build: b => l3(b, { gap: true }) },
  { id: 'L3c', note: '中間一段是地下高壓線（ug471）：同樣接得通', build: b => l3(b, { ug: true }) },
  { id: 'L4a', note: '污水幹管橋接左右兩個管網（人口 ≥ 500）：廠的容量到得了右半，右半住宅接管、lv2 升得了三級', build: b => l4city(b, { bridged: true }) },
  { id: 'L4b', note: '幹管缺一格（x=21）：沒有橋接，右半沒有廠、不接管（對照）', build: b => l4city(b, { bridged: false }) },
  { id: 'L5', note: '全部混在一起：公車站、路旁裝飾、輕軌、單行道、紅綠燈、公車專用道、裝飾、孤立的高壓線與幹管', build: l5 },
];
export function d035Runs() {
  return DEFS.map((d, i) => ({ id: d.id, note: d.note, code: mk(5165000 + 41 * i, 150, '圖層', d.build), days: L_DAYS }));
}

// ---- layouts：污水幹管 ----
const HAND = [
  { id: 'S1-bridge', note: '兩條管中間隔 4 格，幹管橋接成一個元件；廠在左段；左右兩側住宅', build: b => {
    range(6, 20).forEach(x => b.pipeAt(x, 30)); range(25, 45).forEach(x => b.pipeAt(x, 30)); tryPut(b, 5, 30, 27);
    range(21, 24).forEach(x => b.flag('smn472', x, 30));
    [8, 12, 16, 28, 32, 36, 40, 44].forEach((x, n) => { house(b, x, 29, n, 1 + (n % 3)); house(b, x, 31, n + 1, 1 + (n % 3)); });
  } },
  { id: 'S2-gap', note: '幹管差一格：沒有橋接（對照 S1）', build: b => {
    range(6, 20).forEach(x => b.pipeAt(x, 30)); range(25, 45).forEach(x => b.pipeAt(x, 30)); tryPut(b, 5, 30, 27);
    [21, 22, 24].forEach(x => b.flag('smn472', x, 30));
    [8, 12, 16, 28, 32, 36, 40, 44].forEach((x, n) => { house(b, x, 29, n, 1 + (n % 3)); house(b, x, 31, n + 1, 1 + (n % 3)); });
  } },
  { id: 'S3-zero-cost', note: '蛇形管網（列距 3）旁邊一條直的幹管：沿管走 100 格才到的住宅，靠幹管只要幾格（0 成本）', build: b => {
    const path = []; let x = 6, z = 20, dir = 1; path.push([x, z]);
    for (let rr = 0; rr < 5; rr++) { for (let i = 0; i < 56; i++) { x += dir; path.push([x, z]); } if (rr === 4) break; for (let i = 0; i < 3; i++) { z++; path.push([x, z]); } dir = -dir; }
    tryPut(b, 5, 20, 27); path.forEach(([px, pz]) => b.pipeAt(px, pz));
    range(20, 32).forEach(zz => b.flag('smn472', 62, zz)); // 右端一條直幹管：貼著蛇形各列的端點
    path.forEach(([px, pz], j) => { if (j % 40 === 20) { for (const [dx, dz] of [[0, -1], [0, 1]]) { if (house(b, px + dx, pz + dz, j)) break; } } });
  } },
  { id: 'S4-main-seed', note: '廠貼著的是幹管（不是 wp）：起點在幹管格上、0 成本往外', build: b => {
    tryPut(b, 20, 30, 27); range(21, 30).forEach(x => b.flag('smn472', x, 30)); range(31, 50).forEach(x => b.pipeAt(x, 30));
    [24, 28, 33, 40, 48].forEach((x, n) => { house(b, x, 29, n); house(b, x, 31, n + 1); });
  } },
  { id: 'S5-main-ring', note: '幹管圍成環、環上一格有 wp 住宅貼著：0 成本的環（距離不會因為繞圈變小或變 0 以外的值）', build: b => {
    for (let i = 20; i <= 30; i++) { b.flag('smn472', i, 20); b.flag('smn472', i, 30); b.flag('smn472', 20, i); b.flag('smn472', 30, i); }
    tryPut(b, 25, 19, 27); range(31, 50).forEach(x => b.pipeAt(x, 25)); b.pipeAt(30, 25);
    [22, 26, 34, 40, 46].forEach((x, n) => { house(b, x, 24, n); house(b, x, 26, n + 1); });
  } },
  { id: 'S6-exact-90', note: '距離剛好 90／91／122／123：蛇形 wp 管網，其中一段換成幹管（後面的住宅距離平移）', build: b => {
    const path = []; let x = 4, z = 4, dir = 1; path.push([x, z]);
    for (let rr = 0; rr < 9; rr++) { for (let i = 0; i < 62; i++) { x += dir; path.push([x, z]); } if (rr === 8) break; for (let i = 0; i < 3; i++) { z++; path.push([x, z]); } dir = -dir; }
    tryPut(b, 3, 4, 27); path.forEach(([px, pz]) => b.pipeAt(px, pz));
    path.forEach(([px, pz], j) => { if (j >= 20 && j < 60) b.flag('smn472', px, pz); });   // 前 20–60 格是幹管：後面的距離少 40
    const on = new Set(path.map(q => q.join(',')));
    for (const [n, j] of [95, 120, 128, 130, 131, 132, 133, 150, 160, 162, 163, 164, 200].entries()) {
      const [px, pz] = path[Math.min(j, path.length - 1)];
      for (const [dx, dz] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) { const hx = px + dx, hz = pz + dz; if (on.has(hx + ',' + hz)) continue; if (house(b, hx, hz, n)) break; }
    }
  } },
  { id: 'S7-main-only', note: '只有幹管、沒有 wp：幹管自己是管網（元件、距離、貼著）', build: b => {
    tryPut(b, 10, 30, 27); range(11, 40).forEach(x => b.flag('smn472', x, 30));
    [14, 20, 26, 32, 38].forEach((x, n) => { house(b, x, 29, n); house(b, x, 31, n + 1); });
  } },
  { id: 'S8-two-comps-main', note: '廠夾在兩個元件之間，其中一個靠幹管與第三個元件合併：容量只加進先插入的那一個', build: b => {
    tryPut(b, 36, 36, 27);
    range(25, 35).forEach(x => b.pipeAt(x, 36)); range(37, 47).forEach(x => b.pipeAt(x, 37)); range(48, 56).forEach(x => b.flag('smn472', x, 37)); range(57, 64).forEach(x => b.pipeAt(x, 37));
    [28, 32, 40, 44, 52, 60, 63].forEach((x, n) => { house(b, x, 35, n); house(b, x, 38, n + 1); });
  } },
  { id: 'S9-main-under-bld', note: '幹管鋪在建築與路底下、住宅蓋在幹管上', build: b => {
    tryPut(b, 10, 30, 27); b.road(11, 30, 40, 30, 2); range(11, 40).forEach(x => b.flag('smn472', x, 30));
    [14, 20, 26, 32].forEach((x, n) => { house(b, x, 29, n); house(b, x, 31, n + 1); }); tryPut(b, 18, 33, 2); b.flag('smn472', 18, 33); b.flag('smn472', 18, 32); b.flag('smn472', 18, 31);
  } },
  { id: 'S10-border', note: '地圖邊緣的幹管', build: b => {
    tryPut(b, 0, 0, 27); range(1, 30).forEach(x => b.flag('smn472', x, 0)); range(1, 20).forEach(z => b.pipeAt(0, z));
    [4, 10, 16].forEach((x, n) => house(b, x, 1, n)); [4, 10].forEach((z, n) => house(b, 1, z + 4, n));
  } },
];
function randomLayout(i) {
  const rng = mulberry32(0x35a + i * 6007), r = () => rng(), ri = n => Math.floor(r() * n), pick = a => a[ri(a.length)];
  const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  return b => {
    const cells = [];
    const walk = (cb, nNet, lenMax) => { for (let n = 0; n < nNet; n++) { let x = 4 + ri(N - 8), z = 4 + ri(N - 8), dir = ri(4); const len = 6 + ri(lenMax); for (let s = 0; s < len; s++) { cb(x, z); cells.push([x, z]); if (r() < .22) dir = ri(4); x += D[dir][0]; z += D[dir][1]; if (x < 0 || z < 0 || x >= N || z >= N) { x = Math.max(0, Math.min(N - 1, x)); z = Math.max(0, Math.min(N - 1, z)); dir = ri(4); } } } };
    walk((x, z) => { try { b.pipeAt(x, z); } catch { /* 出界 */ } }, 1 + ri(3), 50);
    walk((x, z) => { try { b.flag('smn472', x, z); } catch { /* 出界 */ } }, ri(4), 40);
    for (let n = ri(3); n > 0; n--) { const z = 4 + ri(N - 8), x0 = ri(N - 20), x1 = x0 + 8 + ri(40); try { b.road(x0, z, Math.min(N - 1, x1), z, 2 + ri(3)); } catch { /* 撞到建築 */ } if (r() < .5) for (let x = x0; x <= Math.min(N - 1, x1); x++) { try { (r() < .5 ? b.pipeAt(x, z) : b.flag('smn472', x, z)); } catch { /* 出界 */ } } }
    const near = () => { if (!cells.length || r() < .25) return [ri(N), ri(N)]; const [px, pz] = pick(cells); return [px + ri(7) - 3, pz + ri(7) - 3]; };
    const nPlant = r() < .15 ? 0 : 1 + ri(3);
    for (let n = 0; n < nPlant; n++) { const [x, z] = near(); const kk = r() < .72 ? 27 : r() < .6 ? 156 : 157; if (x >= 0 && z >= 0) tryPut(b, x, z, kk); }
    const KINDS = [1, 1, 1, 1, 1, 1, 2, 3, 127, 33, 105, 22, 4, 12, 7];
    const nB = 6 + ri(30);
    for (let n = 0; n < nB; n++) { const [x, z] = near(); if (x >= 0 && z >= 0 && x < N && z < N) tryPut(b, x, z, pick(KINDS), 1 + ri(3), { den: 1 + ri(5), we: ri(3) }); }
    if (r() < .35) for (let n = 1 + ri(3); n > 0; n--) { const [x, z] = near(); if (x >= 0 && z >= 0 && x < N && z < N) tryPut(b, x, z, pick([10, 129, 153, 154, 155, 130, 163, 5, 58, 140, 145, 150, 158, 159])); }
  };
}
export const LAYOUT_RANDOM_35 = 150;
let layCache = null;
export function d035Layouts() {
  if (layCache) return layCache;
  const out = HAND.map((h, i) => ({ id: h.id, note: h.note, code: mk(5165500 + i, 100, '幹管', h.build) }));
  for (let i = 0; i < LAYOUT_RANDOM_35; i++) out.push({ id: `T${String(i).padStart(3, '0')}`, note: '隨機佈局（wp 管網加 sm472 幹管）', code: mk(5165600 + i, 100, '幹管', randomLayout(i)) });
  return layCache = out;
}

// 拿掉十一層（碼 → 碼）：「沒讀這些層」的那一版的城（守衛要它跟實驗線不同；煙霧拿它核畫面沒變）。only＝只拿掉這幾個存檔鍵
export function strippedCode(code, only = null) {
  const d = decodeLabCode(code); if (!d.ok) throw new Error('strippedCode：' + d.error);
  const raw = JSON.parse(JSON.stringify(d.save.raw));
  for (const [r] of FLAG_LAYERS) if ((!only || only.includes(r)) && typeof raw[r] === 'string') raw[r] = '0'.repeat(raw[r].length);
  return encodeLabCode(raw, { deflate: true });
}
