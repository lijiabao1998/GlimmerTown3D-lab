// D034 對拍用的城：摩天樓與巨廈合併（I）——M 系列自造城（人口 ≥ 500，幸福要靠真的服務自然 > .55／> .6，不繞過閘門）。
// 共同的底（同 D033 的 Q 系列）：一條主街 z=30（兩端各一座電廠）；住宅 2×2 簇貼著主街（z=28–29 北、z=31–32 南：外排離路 2 格，仍通電）；配水管沿 z=27 與主街底下（z=30）、南邊 z=33，
// 水塔在管頭、污水廠在管尾；公園（k4）每 4 格一座（住宅在兩座公園的覆蓋內：公園 +.16、多座公園 +.06）；商業夾在簇之間（就業，需求才夠）；兩所學校、幾座大農場（糧食夠）。
// 決定性：全部用座標算出來，沒有 Math.random、現實時間。
import fs from 'node:fs';
import path from 'node:path';
import { decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { ROOT } from './cdp.mjs';
import { builder, N21 } from './d021-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const range = (a, c, s = 1) => { const o = []; for (let x = a; x <= c; x += s) o.push(x); return o; };
export const MERGE_DAYS = 13;

let ctx = null;
function context() {
  if (ctx) return ctx;
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), template = decodeLabCode(read('src/content/samples/newcity.code.txt').trim()).save.raw;
  return ctx = { KT, template, sizeOf: k => KT.size(k) };
}
// 分區：builder 預設整張 0；b.zn（逐格字元）有人寫過就當存檔的 zn 蓋過去（實驗線讀檔的分區層）
export const zoneRect = (b, x0, z0, x1, z1, zone) => { b.zn ??= Array.from({ length: N21 * N21 }, () => '0'); for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) b.zn[z * N21 + x] = String(zone); };
export const mk = (seed, day, name, fn) => { const { template, sizeOf } = context(), b = builder(template, sizeOf); fn(b); return b.code(seed, day, name, b.zn ? { zn: b.zn.join('') } : {}); };
export const tryPut = (b, x, z, k, lv = 1, o = {}) => { try { b.put(x, z, k, lv, o); return true; } catch { return false; } };
const house = (b, x, z, n = 0, lv = 3) => tryPut(b, x, z, 1, lv, { den: 1 + (n % 5), we: n % 3 });

export function base(b) {
  b.road(4, 30, 66, 30, 3); b.put(3, 30, 5); b.put(67, 30, 5);
  b.put(20, 35, 7, 1).put(49, 35, 7, 1);
  [6, 12, 18, 24, 30, 36].forEach(x => tryPut(b, x, 45, 53, 2));
  return b;
}
// 一排管、水塔、污水廠
export function pipes(b, x0, x1, { tower = true, plant = true, south = false } = {}) {
  range(x0, x1).forEach(x => { b.pipeAt(x, 27); b.pipeAt(x, 30); if (south) b.pipeAt(x, 33); });
  range(27, south ? 33 : 30).forEach(z => b.pipeAt(x0, z));
  if (tower) tryPut(b, x0 - 1, 27, 10);
  if (plant) tryPut(b, x1 + 1, 27, 27);
}
// 一個 2×2 簇：左上角 (x, z)，四棟同類同級；kind＝1 住宅、2 商業
export function cluster(b, x, z, { kind = 1, lv = 3, n = 0 } = {}) {
  zoneRect(b, x, z, x + 1, z + 1, kind);   // 分區跟著簇（建築底下留著分區：塔不清、巨廈清）
  for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) {
    if (kind === 1) house(b, x + dx, z + dz, n + dx + dz * 2, lv); else tryPut(b, x + dx, z + dz, 2, lv);
  }
}
export const parksAt = (b, xs, z) => xs.forEach(x => tryPut(b, x, z, 4));

// ---- 版型 ----
// 共同：服務——消防局、醫院、警察局（燒毀、生病、犯罪會讓人口與簇散掉，十幾天的連推要看得到合併）
const services = b => { tryPut(b, 44, 25, 6); tryPut(b, 30, 25, 12); tryPut(b, 20, 25, 11); };
// M1：2×2 塔。北邊 z=28–29 八組住宅簇＋八組商業簇交錯（就業夠、需求高），管網通到污水廠（全部接管）；南邊 z=31–32 兩組住宅簇＋兩組商業簇，管只到 z=30（外排 z=32 沒貼管：不接管、不合格）。
//    公園每 4 格一座（z=26、z=34）：幸福 .6–.8
function m1(b, { parks = true, fireAt = null } = {}) {
  base(b); pipes(b, 5, 50); services(b);
  [10, 14, 18, 22, 26, 30, 34, 38].forEach((x, n) => { cluster(b, x, 28, { kind: 1, lv: 3, n }); cluster(b, x + 2, 28, { kind: 2, lv: 3 }); });
  [10, 14].forEach((x, n) => { cluster(b, x, 31, { kind: 1, lv: 3, n: n + 4 }); cluster(b, x + 2, 31, { kind: 2, lv: 3 }); });
  if (parks) { parksAt(b, range(10, 42, 4), 26); parksAt(b, range(10, 18, 4), 34); }
  if (fireAt) { const [fx, fz] = fireAt; b.put(fx, fz, 1, 3, { den: 3, we: 1, fire: 1 }); }
}
// M2：3×3 巨廈。z=30 主街、z=34 第二條街（x=4 的短路接起來給電），住宅窗在 z=31–33，管在 z=30 與 z=33（窗內每棟貼著管、離路 ≤ 2 格有電）。
//    六個窗：A 九棟 lv3；B 六棟 lv3＋兩棟 lv1＋一座公園；C 五棟 lv2＋三塊空地（沒分區的草地）＋一座公園；D 混了一棟商業（不合格）；E 只有四棟實質（< 5，不合格）；F 七棟＋兩塊空地。
//    北邊 z=28–29 照 M1 擺幾組住宅簇＋商業簇（就業與需求）
function m2(b) {
  base(b); b.road(4, 34, 66, 34, 3); b.road(4, 31, 4, 33, 3); b.road(66, 31, 66, 33, 3);
  pipes(b, 5, 50); range(5, 50).forEach(x => b.pipeAt(x, 33)); range(31, 33).forEach(z => b.pipeAt(5, z)); services(b);
  tryPut(b, 4, 28, 10); tryPut(b, 4, 29, 10); tryPut(b, 3, 32, 5); tryPut(b, 67, 32, 5);   // 水塔每座供 80 棟、電廠每座 75 棟：多放幾座，窗裡的建築才不會排到容量外
  range(8, 52, 2).forEach(x => cluster(b, x, 28, { kind: 2, lv: 3 }));   // 就業：商業簇一路排（沒有住宅簇，人口只有下面的窗）
  const win = (x0, cells) => { zoneRect(b, x0, 31, x0 + 2, 33, 1); [...cells].forEach((c, q) => { const dx = q % 3, dz = (q / 3) | 0, x = x0 + dx, z = 31 + dz; if (c === 'H') house(b, x, z, q, 3); else if (c === 'h') house(b, x, z, q, 2); else if (c === 'l') house(b, x, z, q, 1); else if (c === 'P') tryPut(b, x, z, 4); else if (c === 'C') tryPut(b, x, z, 2, 3); }); };
  win(8, 'HHHHHHHHH'); win(12, 'HHHHlPHHl'); win(16, 'hhhh_Phl_'); win(20, 'HHHHCHHHH'); win(24, 'HHHH___H_'); win(28, 'HHHHHHH__');
  parksAt(b, range(8, 36, 4), 36); parksAt(b, range(10, 34, 8), 26);
}
// M3：幸福夾在 .55–.6 附近（只有一排公園、沒有第二座的加成）；其中一組住宅簇有一棟在燃燒（起火的不合格）
// M4：沒有公園、住宅簇貼著電廠（電廠鄰近、污染）：幸福 ≤ .55，整段零消耗
function m3(b) { m1(b, { parks: false, fireAt: [42, 28] }); parksAt(b, [10, 22, 34], 26); }
function m5(b) { m1(b, { parks: false }); parksAt(b, range(10, 42, 8), 26); }
function m4(b) { base(b); pipes(b, 5, 50); services(b); [6, 10, 14].forEach((x, n) => cluster(b, x, 28, { kind: 1, lv: 3, n })); [6, 8, 10, 12, 14, 16].forEach(x => cluster(b, x, 31, { kind: 2, lv: 3 })); tryPut(b, 5, 26, 5); tryPut(b, 5, 34, 5); }
const DEFS = [
  { id: 'M1', note: '塔：北邊八組住宅簇＋八組商業簇交錯、全部接管、幸福 .6–.8；南邊外排沒貼管（不接管）', build: b => m1(b) },
  { id: 'M3', note: '幸福夾在 .55–.6 附近：一排稀疏的公園；有一棟在燃燒（起火的不合格）', build: m3 },
  { id: 'M5', note: '幸福在 .55–.6 之間：公園每 8 格一座（多數住宅只在一座公園的覆蓋內）；只掃塔、不掃巨廈', build: m5 },
  { id: 'M4', note: '幸福 ≤ .55：沒有公園、住宅簇旁有電廠；候選簇都合格、閘門擋住，亂數零消耗', build: m4 },
  { id: 'M2', note: '巨廈：六個 3×3 窗（九棟 lv3、含 lv1 與公園、五棟 lv2＋空地、混商業、只有四棟實質、七棟＋空地）；北邊住宅簇與商業簇', build: m2 },
];
export function d034Runs() {
  return DEFS.flatMap((d, i) => [0, 1, 2].map(k => ({ id: `${d.id}${'abc'[k]}`, note: d.note, code: mk(5164000 + 37 * i + 5 * k, 150, '合併', d.build), days: MERGE_DAYS })));
}
