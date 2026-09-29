// D024 對拍用的城：主計數迴圈補齊（固定就業、維護費、物流「運作中」、辦公區、T475 格子旗標）。
// 每座城在 72×72 的平地上：一條路、一座發電廠、路邊幾棟住商工（base），再加這一座城要量的東西；沒有分區＝不會長新房子，兩邊推進一天之後建築完全一樣。
//   E1 電力設施 k140–150＋手工配電線／地下線／高架／立交的格子旗標｜E2 水務設施 k151–160｜E3 基建 k161–164＋旗標｜E4 車庫 k175–178｜
//   E5 物流 k165–174：貼路與不貼路、聯運樞紐旁鐵路格夠不夠、散貨碼頭與貨櫃港旁水格夠不夠（門檻剛好與差一格）｜E6 升級過的服務（升級表裡的每一種，等級 2–10）｜
//   E7 地標、旅宿與配套、科技園區、產業鏈（k69–123 的一批）｜E8 辦公區（商業蓋在 of 圖層上，就業 ×1.5）加住宅塔與巨廈、商業塔與綜合體｜
//   E9、E10、E11 每一種建築各一棟（k1–60、61–120、121–186，等級 2）｜E12、E13、E14 亂數混排（固定種子）。
// 用本線的 encodeLabCode 生分享碼（tools/d021-cities.mjs 的組裝器，D024 起多了旗標圖層與水格）。全部用座標與固定種子的 mulberry32 算出來，沒有 Math.random、現實時間。
import { decodeLabCode } from '../src/io/labcode.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { builder } from './d021-cities.mjs';
import { UP_MAX } from '../src/sim/rules/count.ts';

// 一批建築從 (x0, z0) 起往右排、每個空 gap 格；排不下（x > 66）就換到下面 rowH 列
function packWrap(b, x0, z0, kinds, sizeOf, lv = 1, gap = 2, rowH = 8) {
  let x = x0, z = z0;
  for (const k of kinds) {
    const sz = sizeOf(k);
    if (x + sz > 66) { x = x0; z += rowH; }
    b.put(x, z, k, typeof lv === 'function' ? lv(k) : lv); x += sz + gap;
  }
}
const rangeK = (a, c, skip = []) => Array.from({ length: c - a + 1 }, (_, i) => a + i).filter(k => !skip.includes(k));

// base：一條路（z=30）、發電廠、路邊的住商工各幾棟
function base(b) {
  b.road(4, 30, 66, 30).put(3, 30, 5);
  b.row(8, 13, 29, 1, 2, { den: 3 }).put(16, 29, 2, 2).put(17, 29, 2, 3).put(20, 29, 3, 2).put(21, 29, 3, 3);
}

export function cities24(newcityCode, KT) {
  const template = decodeLabCode(newcityCode.trim()).save.raw, sizeOf = k => KT.size(k);
  const known = k => KT.known(k);
  const defs = [
    { id: 'E1', note: '電力設施 k140–150 排一排，加手工配電線（lvl475）、地下線（udl475）、高架（fly475）、立交（ix475 2、3）的格子旗標', build: b => {
      packWrap(b, 6, 34, rangeK(140, 150), sizeOf, 1);
      b.flagRect('lvl475', 6, 50, 14, 50).flagRect('udl475', 16, 50, 20, 50).flagRect('fly475', 22, 50, 26, 51).flag('ix475', 30, 50, 2).flag('ix475', 31, 50, 3).flag('lvl475', 40, 60);
    } },
    { id: 'E2', note: '水務設施 k151–160 排兩排', build: b => { packWrap(b, 6, 34, rangeK(151, 160), sizeOf, 1); } },
    { id: 'E3', note: '基建 k161–164 各兩座，加格子旗標（高架、立交、配電線）散在各處', build: b => {
      packWrap(b, 6, 34, [161, 162, 163, 164, 161, 162, 163, 164], sizeOf, 1);
      b.flagRect('fly475', 6, 46, 20, 46).flagRect('ix475', 22, 46, 26, 46, 1).flagRect('ix475', 28, 46, 30, 46, 3).flagRect('lvl475', 6, 48, 40, 48).flagRect('udl475', 6, 50, 40, 50);
    } },
    { id: 'E4', note: '車庫 k175–178（公車、輕軌、鐵路、地鐵）各兩座', build: b => { packWrap(b, 6, 34, [175, 176, 177, 178, 175, 176, 177, 178], sizeOf, 1); } },
    { id: 'E5', note: '物流 k165–174：第一條路（z=40）旁的「有貼路」各一座（聯運樞紐旁 3 格鐵路、散貨碼頭旁 8 格水、貨櫃港旁 12 格水）、離路遠的「不貼路」各一座、'
      + '第二條路（z=62）旁「貼路但門檻差一格」的聯運樞紐（1 格鐵路）、散貨碼頭（3 格水）、貨櫃港（4 格水）', build: b => {
      b.road(4, 40, 70, 40).road(4, 62, 70, 62);
      const at = [[165, 6], [166, 12], [167, 18], [168, 23], [169, 27], [170, 31], [171, 36], [172, 41], [173, 46], [174, 52]];
      for (const [k, x] of at) b.put(x, 40 - sizeOf(k), k, 1);                                      // 貼路（建築下緣是路）
      b.flag('rl', 16, 34).flag('rl', 17, 34).flag('rl', 18, 34);                                   // 聯運樞紐（k166，根格 (12,36)）半徑 6 內 3 格鐵路
      b.water(44, 31, 47, 32);                                                                     // 散貨碼頭（k173，根格 (46,36)）半徑 5 內 8 格水
      b.water(50, 31, 55, 32);                                                                     // 貨櫃港（k174，根格 (52,35)）半徑 6 內 12 格水（z=30 是 base 的路，水從 31 起）
      for (const [k, x] of at) b.put(x, 52, k, 1);                                                  // 不貼路（離路 ≥ 2 格）
      b.put(10, 58, 166, 1).flag('rl', 14, 56);                                                     // 貼路（z=62 的路）但半徑 6 內只有 1 格鐵路
      b.put(30, 58, 173, 1).water(25, 53, 26, 53).water(29, 53, 29, 53);                            // 貼路但半徑 5 內只有 3 格水（(25,53)(26,53)(29,53)；同一列其餘格被不貼路那批佔著）
      b.put(50, 57, 174, 1).water(48, 51, 51, 51);                                                  // 貼路但半徑 6 內只有 4 格水
    } },
    { id: 'E6', note: '升級過的服務：升級表（UP_MAX）裡的每一種，等級從 2 到 10 輪流', build: b => {
      const ks = Object.keys(UP_MAX).map(Number).filter(known);
      packWrap(b, 6, 34, ks, sizeOf, k => Math.min(UP_MAX[k], 2 + (k % 9)));
    } },
    { id: 'E7', note: '地標 k69–80、旅宿與配套 k81–104、科技與研究 k107–116、產業鏈 k117–123 各一棟', build: b => {
      packWrap(b, 6, 34, [...rangeK(69, 80), ...rangeK(81, 104), ...rangeK(107, 123)].filter(known), sizeOf, 1, 1, 6);
    } },
    { id: 'E8', note: '辦公區：商業蓋在 of 圖層上（就業 ×1.5）；住宅塔、巨廈、商業塔、綜合體、購物中心、社宅', build: b => {
      b.put(24, 29, 2, 2).put(25, 29, 2, 3).put(26, 29, 2, 1).flag('of', 24, 29).flag('of', 25, 29).flag('of', 27, 29);
      b.put(30, 33, 33, 3).put(34, 33, 34, 3).put(38, 33, 105, 3).put(44, 33, 106, 3).put(50, 33, 65, 2).put(56, 33, 127, 1);
      b.put(6, 31, 2, 3).put(7, 31, 2, 3).flag('of', 6, 31).flag('of', 7, 31).flag('of', 40, 60);
    } },
    { id: 'E9', note: '每一種建築各一棟：k1–60（等級 2）', build: b => { packWrap(b, 4, 34, rangeK(1, 60).filter(known), sizeOf, 2, 1, 7); } },
    { id: 'E10', note: '每一種建築各一棟：k61–120（等級 2）', build: b => { packWrap(b, 4, 34, rangeK(61, 120).filter(known), sizeOf, 2, 1, 7); } },
    { id: 'E11', note: '每一種建築各一棟：k121–186（等級 2）', build: b => { packWrap(b, 4, 34, rangeK(121, 186).filter(known), sizeOf, 2, 1, 7); } },
  ];
  // 亂數混排三座（固定種子）：60 棟隨機種類、隨機等級、兩條隨機路、隨機旗標與水
  for (let j = 0; j < 3; j++) {
    defs.push({ id: `E${12 + j}`, note: `亂數混排（種子 ${20261201 + j * 7919}）：隨機種類與等級、兩條隨機路、隨機旗標與水格`, build: b => {
      const R = mulberry32(20261201 + j * 7919), int = (a, c) => a + Math.floor(R() * (c - a + 1)), all = KT.data.kinds.map(r => r.k);
      // 等級要在這一種的合法範圍內：住商工 1–3（POPS、JOBSC、JOBSI 用等級當索引，超出＝實驗線的收入算出 NaN）、升級表（UP_MAX）裡的服務 1 到它的上限、其他種類只有 1
      const maxLv = k => k <= 3 ? 3 : UP_MAX[k] ?? 1;
      for (let i = 0; i < 90; i++) { const k = all[int(0, all.length - 1)], sz = sizeOf(k), x = int(4, 66 - sz), z = int(34, 66 - sz); if (b.isFree(x, z, sz)) b.put(x, z, k, R() < .4 ? 1 : int(1, maxLv(k))); }
      for (let i = 0; i < 60; i++) { const x = int(0, 71), z = int(32, 70); if (b.isFree(x, z, 1)) { const q = ['lvl475', 'udl475', 'fly475', 'ix475', 'rl'][int(0, 4)]; b.flag(q, x, z, q === 'ix475' ? int(1, 3) : 1); } }
      for (let i = 0; i < 2; i++) { const x = int(0, 60), z = int(34, 64), w = int(2, 6), h = int(2, 4); if (b.isFree(x, z, 1) && [...Array(w * h)].every((_, q) => b.isFree(x + (q % w), z + ((q / w) | 0), 1))) b.water(x, z, x + w - 1, z + h - 1); }
    } });
  }
  return defs.map((c, i) => {
    const b = builder(template, sizeOf);
    base(b); c.build(b);
    return { id: c.id, note: c.note, code: b.code(5162026 + 5 * i, 1, '計數') };
  });
}
