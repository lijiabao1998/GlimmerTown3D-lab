// D025 對拍用的城：經濟（貿易池、商品庫存、零售與購買力、稅乘數、進口費、出口金、船、太空研究中心）。
// 同 D024：每座城在 72×72 的平地上，一條路（z=30）、一座發電廠、路邊幾棟住商工（base），再加這一座城要量的東西；沒有分區＝不會長新房子，
// 兩邊推進之後建築不變（施工中的房屋只長屋齡）。存檔欄位 extra 直接蓋庫存與船（sup、gds、fuel364、steel364、shipCount、shipProgress）與資金。
//   G1 零售與購買力：住宅（財富級 0／1／2、密度輪流）、商業、住宅塔、社宅、巨廈｜G2 貨物生產與出口：工業、倉儲物流中心、貿易站、港口，貨物與供應品有存量｜
//   G3 缺貨與進口：商業與住宅多、幾乎沒有工業｜G4 物流九種（貼路與不貼路、門檻剛好與差一格）＋貨運中心、倉儲、港口，燃料與鋼有存量｜
//   G5 船與造船廠：造船廠、港口、煉鋼廠，船超過港口×2、船進度 27｜G6 煉油、煉鋼與貨運耗油｜G7 太空研究中心（第 24 天、供應品 400）｜
//   G8 施工中的房屋與煉鋼廠加速施工｜G9 糧食加工與出口（農場、牧場、溫室、廚房、農貿、食品加工、釀酒、貿易站、穀倉、冷鏈）｜
//   G10 資金 −500（破產不補燃料、鋼、供應品）｜G11 資金剛好 0（有償付能力）｜G12 路 600 格（貿易額度的路底封頂 8）｜G13、G14 亂數混排（固定種子，庫存與資金與日子也亂數）｜
//   G15、G16 資源回收廠產貨物（舊式與正式清運）｜G17 遊客與商業（會展中心那一波、動物園）。日子各不相同（季節、外部價格的正弦）。
// 用本線的 encodeLabCode 生分享碼（tools/d021-cities.mjs 的組裝器）。全部用座標與固定種子的 mulberry32 算出來，沒有 Math.random、現實時間。
import { decodeLabCode } from '../src/io/labcode.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { builder } from './d021-cities.mjs';

function base(b) {
  b.road(4, 30, 66, 30).put(3, 30, 5);
  b.row(8, 13, 29, 1, 2, { den: 3 }).put(16, 29, 2, 2).put(17, 29, 2, 3).put(20, 29, 3, 2).put(21, 29, 3, 3);
}
// 一批建築從 (x0, z0) 起往右排、每個空 gap 格；排不下（x > 66）就換到下面 rowH 列
function packWrap(b, x0, z0, kinds, sizeOf, lv = 1, gap = 1, rowH = 6, o = {}) {
  let x = x0, z = z0;
  for (const k of kinds) {
    const sz = sizeOf(k);
    if (x + sz > 66) { x = x0; z += rowH; }
    b.put(x, z, k, typeof lv === 'function' ? lv(k) : lv, typeof o === 'function' ? o(k) : o); x += sz + gap;
  }
}

export function cities25(newcityCode, KT) {
  const template = decodeLabCode(newcityCode.trim()).save.raw, sizeOf = k => KT.size(k), known = k => KT.known(k);
  const defs = [
    { id: 'G1', note: '零售與購買力：路南 30 棟住宅（財富級與密度輪流）、路北 19 棟二三級商業、住宅塔、社宅、巨廈', build: b => {
      for (let i = 0; i < 30; i++) b.put(8 + i, 31, 1, 1 + (i % 3), { den: 1 + (i % 5), we: i % 3 });
      for (let i = 0; i < 19; i++) b.put(22 + i, 29, 2, 2 + (i % 2));
      b.put(40, 32, 33, 3).put(44, 32, 127, 1).put(48, 32, 105, 3);
    } },
    { id: 'G2', note: '貨物生產與出口：路北 10 棟二三級工業、倉儲物流中心（一級與三級）、貿易站兩座、港口、幾棟商業；供應品 200、貨物 150', build: b => {
      for (let i = 0; i < 10; i++) b.put(22 + i, 29, 3, 2 + (i % 2));
      b.put(6, 32, 64, 1).put(10, 32, 64, 3).put(16, 32, 91, 1).put(20, 32, 91, 1).put(26, 32, 18, 1);
      for (let i = 0; i < 3; i++) b.put(33 + i, 29, 2, 2); for (let i = 0; i < 6; i++) b.put(8 + i, 31, 1, 2, { den: 3 });
    }, extra: { sup: 200, gds: 150 }, day: 30 },
    { id: 'G3', note: '缺貨與進口：24 棟二三級商業、24 棟住宅、只有 base 的兩棟工業', build: b => {
      for (let i = 0; i < 24; i++) b.put(22 + i, 29, 2, 2 + (i % 2));
      for (let i = 0; i < 24; i++) b.put(8 + i, 31, 1, 2 + (i % 2), { den: 4 + (i % 2) });
    }, day: 45 },
    { id: 'G4', note: '物流九種：路（z=40）旁貼路各一座（聯運樞紐旁鐵路格、散貨碼頭與貨櫃港旁水格）、不貼路各一座、第二條路（z=62）旁差一格的三座；貨運中心三座、倉儲、港口兩座；燃料 50、鋼 40', build: b => {
      b.road(4, 40, 70, 40).road(4, 62, 70, 62);
      const at = [[165, 6], [166, 12], [167, 18], [168, 23], [169, 27], [170, 31], [171, 36], [172, 41], [173, 46], [174, 52]];
      for (const [k, x] of at) b.put(x, 40 - sizeOf(k), k, 1);
      b.flag('rl', 16, 34).flag('rl', 17, 34).flag('rl', 18, 34);
      b.water(44, 31, 47, 32); b.water(50, 31, 55, 32);
      for (const [k, x] of at) b.put(x, 52, k, 1);
      b.put(10, 58, 166, 1).flag('rl', 14, 56); b.put(30, 58, 173, 1).water(25, 53, 26, 53).water(29, 53, 29, 53); b.put(50, 57, 174, 1).water(48, 51, 51, 51);
      b.put(58, 28, 110, 1).put(60, 28, 110, 1).put(62, 28, 110, 1).put(6, 32, 64, 2).put(60, 32, 18, 1).put(64, 32, 18, 1);
    }, extra: { fuel364: 50, steel364: 40 }, day: 60 },
    { id: 'G5', note: '船與造船廠：造船廠兩座、港口兩座、煉鋼廠；鋼 20、船 5（超過港口×2 要被截到 4）、船進度 27', build: b => {
      b.put(6, 32, 123, 1).put(10, 32, 123, 1).put(16, 32, 18, 1).put(22, 32, 18, 1).put(28, 32, 122, 1);
      for (let i = 0; i < 4; i++) b.put(22 + i, 29, 3, 2); for (let i = 0; i < 6; i++) b.put(8 + i, 31, 1, 2, { den: 3 });
    }, extra: { steel364: 20, shipCount: 5, shipProgress: 27 }, day: 75 },
    { id: 'G6', note: '煉油、煉鋼與貨運耗油：煉油廠兩座、煉鋼廠兩座、貨運中心四座、貿易站；燃料 15、鋼 5', build: b => {
      b.put(6, 32, 121, 1).put(10, 32, 121, 1).put(14, 32, 122, 1).put(18, 32, 122, 1).put(30, 26, 110, 1).put(32, 26, 110, 1).put(34, 26, 110, 1).put(36, 26, 110, 1).put(24, 32, 91, 1);
      for (let i = 0; i < 4; i++) b.put(22 + i, 29, 3, 2);
    }, extra: { fuel364: 15, steel364: 5 }, day: 90 },
    { id: 'G7', note: '太空研究中心：兩座、工業 6 棟、貿易站兩座、港口；第 24 天、供應品 400', build: b => {
      b.put(6, 32, 51, 1).put(12, 32, 51, 1).put(20, 32, 91, 1).put(24, 32, 91, 1).put(28, 32, 18, 1);
      for (let i = 0; i < 6; i++) b.put(22 + i, 29, 3, 2 + (i % 2));
    }, extra: { sup: 400 }, day: 23 },
    { id: 'G8', note: '施工中與煉鋼廠加速：煉鋼廠三座、造船廠；住宅 20 棟屋齡 0–8、商業 6 棟屋齡 2、工業 6 棟屋齡 5；鋼 30', build: b => {
      b.put(6, 32, 122, 1).put(10, 32, 122, 1).put(14, 32, 122, 1).put(18, 32, 123, 1);
      for (let i = 0; i < 20; i++) b.put(8 + i, 31, 1, 1 + (i % 2), { den: 3, age: i % 9 });
      for (let i = 0; i < 6; i++) b.put(22 + i, 29, 2, 2, { age: 2 }); for (let i = 0; i < 6; i++) b.put(30 + i, 29, 3, 2, { age: 5 });
    }, extra: { steel364: 30 }, day: 110 },
    { id: 'G9', note: '糧食加工與出口：農場六座（等級 1–3）、大農場、牧場兩座、溫室兩座、廚房兩座、農貿兩座、食品加工廠、釀酒兩座、貿易站三座、穀倉與冷鏈各一座（貼路）、住宅十棟', build: b => {
      const kinds = [22, 22, 22, 22, 22, 22, 53, 23, 23, 63, 63, 119, 119, 87, 87, 57, 100, 100, 91, 91, 91].filter(known);
      packWrap(b, 6, 33, kinds, sizeOf, k => 1 + (k % 3), 1, 6);
      b.put(24, 30 - sizeOf(168), 168, 1).put(30, 30 - sizeOf(169), 169, 1);
      for (let i = 0; i < 10; i++) b.put(8 + i, 31, 1, 2, { den: 3 });
    }, day: 100 },
    { id: 'G10', note: '資金 −500（破產）：造船廠、煉鋼廠、工業 6 棟、貨運中心三座、貿易站兩座——燃料、鋼、供應品都缺，但破產不補', build: b => {
      b.put(6, 32, 123, 1).put(10, 32, 122, 1).put(14, 32, 91, 1).put(18, 32, 91, 1).put(30, 26, 110, 1).put(32, 26, 110, 1).put(34, 26, 110, 1);
      for (let i = 0; i < 6; i++) b.put(22 + i, 29, 3, 2); for (let i = 0; i < 4; i++) b.put(8 + i, 31, 1, 2, { den: 3 });
    }, extra: { money: -500 }, day: 130 },
    { id: 'G11', note: '資金剛好 0（有償付能力）：跟 G10 同一座城', build: b => {
      b.put(6, 32, 123, 1).put(10, 32, 122, 1).put(14, 32, 91, 1).put(18, 32, 91, 1).put(30, 26, 110, 1).put(32, 26, 110, 1).put(34, 26, 110, 1);
      for (let i = 0; i < 6; i++) b.put(22 + i, 29, 3, 2); for (let i = 0; i < 4; i++) b.put(8 + i, 31, 1, 2, { den: 3 });
    }, extra: { money: 0 }, day: 130 },
    { id: 'G12', note: '路 600 格（10 條長路）：貿易額度的路底封頂 8；路旁商業與住宅', build: b => {
      for (let j = 0; j < 9; j++) b.road(4, 33 + j * 4, 63, 33 + j * 4);
      for (let j = 0; j < 9; j++) { b.put(8, 32 + j * 4, 2, 2); b.put(9, 32 + j * 4, 2, 3); b.put(12, 34 + j * 4, 1, 2, { den: 4 }); b.put(13, 34 + j * 4, 1, 2, { den: 4 }); }
    }, day: 200 },
    { id: 'G15', note: '資源回收（舊式，人口不到 500）：資源回收廠兩座貼路、垃圾場、住宅 12 棟；貨物 20', build: b => {
      b.put(30, 28, 111, 1).put(33, 28, 111, 1).put(38, 29, 8, 1);
      for (let i = 0; i < 12; i++) b.put(8 + i, 31, 1, 2, { den: 3 });
    }, extra: { gds: 20 }, day: 12 },
    { id: 'G16', note: '資源回收（正式清運，人口超過 500）：資源回收廠兩座貼路、垃圾場、住宅 60 棟（三級、密度 5）', build: b => {
      b.put(30, 28, 111, 1).put(33, 28, 111, 1).put(38, 29, 8, 1);
      for (let i = 0; i < 30; i++) { b.put(8 + i, 31, 1, 3, { den: 5 }); b.put(8 + i, 32, 1, 3, { den: 5 }); }
    }, day: 33 },
    { id: 'G17', note: '遊客與商業：會展中心（第 20 天那一波 1000 人）、動物園、二三級商業 12 棟、住宅 10 棟、貿易站兩座、港口', build: b => {
      b.put(6, 33, 44, 1).put(12, 33, 38, 1).put(20, 33, 91, 1).put(24, 33, 91, 1).put(28, 33, 18, 1);
      for (let i = 0; i < 12; i++) b.put(22 + i, 29, 2, 2 + (i % 2)); for (let i = 0; i < 10; i++) b.put(8 + i, 31, 1, 2, { den: 3 });
    }, day: 19 },
  ];
  // 亂數混排兩座（固定種子）：經濟相關的種類隨機排、庫存與船與資金也隨機
  const ECON_K = [1, 2, 3, 18, 22, 23, 51, 53, 57, 63, 64, 65, 87, 91, 100, 110, 119, 121, 122, 123, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174].filter(known);
  for (let j = 0; j < 2; j++) {
    const seed = 20261211 + j * 7919, R = mulberry32(seed), int = (a, c) => a + Math.floor(R() * (c - a + 1));
    const extra = { sup: R() < .5 ? 0 : int(0, 400), gds: R() < .5 ? 0 : int(0, 300), fuel364: R() < .5 ? 0 : int(0, 200), steel364: R() < .5 ? 0 : int(0, 200), shipCount: R() < .6 ? 0 : int(0, 8), shipProgress: R() < .6 ? 0 : int(0, 29), money: R() < .3 ? -int(1, 800) : int(0, 5000) };
    for (const k of Object.keys(extra)) if (extra[k] === 0 && k !== 'money') delete extra[k];
    const day = int(1, 400);
    defs.push({ id: `G${13 + j}`, note: `亂數混排（種子 ${seed}）：經濟相關的種類、兩條隨機路、庫存與船與資金也隨機；第 ${day} 天`, extra, day, build: b => {
      b.road(4, 40, 66, 40);
      for (let i = 0; i < 70; i++) {
        const k = ECON_K[int(0, ECON_K.length - 1)], sz = sizeOf(k), x = int(4, 66 - sz), z = R() < .5 ? int(31, 38) : int(41, 66 - sz), lv = k <= 3 ? int(1, 3) : 1;
        if (b.isFree(x, z, sz)) b.put(x, z, k, lv, k === 1 ? { den: int(1, 5), we: int(0, 2), age: int(0, 12) } : { age: int(0, 12) });
      }
    } });
  }
  return defs.map((c, i) => {
    const b = builder(template, sizeOf);
    base(b); c.build(b);
    return { id: c.id, note: c.note, code: b.code(5162026 + 11 * i, c.day ?? 1, '經濟', c.extra ?? {}) };
  });
}
