// D023 對拍用的城：服務預算 sb（四類：police、fire、health、edu；存檔欄位，實驗線 load() 66964 讀進來）。
// 每座城在 72×72 的平地上排滿「預算縮放的服務」（警察局、警察分局、法院、消防站、高級消防、消防總局、醫院、診所、救護站、綜合醫院、醫學中心、學校、大學、圖書館、
// 圖書總館、研究院、科技研究園區——tools 的內容表 src/sim/rules/fields.ts SVC_BUDGET_CAT），另一條路、一座發電廠、路邊幾棟住宅；只有 sb 不同：
//   B1 全 .5（半徑進位的邊界）、B2 全 .7、B3 全 1.25、B4 全 1.5、B5 混合 {警 .9、消防 1.1、醫療 .6、教育 1.4}、B6 超出範圍 {警 .3→.5、消防 2→1.5、醫療 1.5、教育 .5}、
//   B7 非數字 {警 "0.9"（字串）、消防 null、醫療 true、教育 .8}：只有教育收、其餘保留 1、B8 只給一個鍵 {醫療 .8}、B9 沒有 sb。
// 用本線的 encodeLabCode 生分享碼（tools/d021-cities.mjs 的組裝器）。全部用座標算出來，沒有 Math.random、現實時間。
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { builder } from './d021-cities.mjs';

export const SERVICE_KINDS = [11, 52, 43, 6, 30, 61, 12, 13, 28, 48, 135, 7, 32, 14, 41, 45, 138];
// 一批建築從 (x0, z0) 起往右排、每個空 3 格；排不下（x > 66）就換到下面 14 列
function packWrap(b, x0, z0, kinds, sizeOf) {
  let x = x0, z = z0;
  for (const k of kinds) {
    const sz = sizeOf(k);
    if (x + sz > 66) { x = x0; z += 14; }
    b.put(x, z, k, 1); x += sz + 3;
  }
}
export const SB_CASES = [
  { id: 'B1', sb: { police: .5, fire: .5, health: .5, edu: .5 }, note: '四項全 .5：半徑乘 .5 進位（Math.round 對 .5 進位）' },
  { id: 'B2', sb: { police: .7, fire: .7, health: .7, edu: .7 }, note: '四項全 .7' },
  { id: 'B3', sb: { police: 1.25, fire: 1.25, health: 1.25, edu: 1.25 }, note: '四項全 1.25：半徑變大' },
  { id: 'B4', sb: { police: 1.5, fire: 1.5, health: 1.5, edu: 1.5 }, note: '四項全 1.5（上限）' },
  { id: 'B5', sb: { police: .9, fire: 1.1, health: .6, edu: 1.4 }, note: '混合：各項不同' },
  { id: 'B6', sb: { police: .3, fire: 2, health: 1.5, edu: .5 }, note: '超出範圍：警 .3→.5、消防 2→1.5（夾住）' },
  { id: 'B7', sb: { police: '0.9', fire: null, health: true, edu: .8 }, note: '非數字（字串、null、true）不理、保留 1；只有教育 .8 收' },
  { id: 'B8', sb: { health: .8 }, note: '只給一個鍵：醫療 .8，其餘保留 1' },
  { id: 'B9', sb: undefined, note: '沒有 sb：全 1' },
];

// 全部的城（碼）：newcityCode＝newcity.code.txt（存檔 JSON 當樣板）；KT＝內容表（多格建築佔幾格）
export function cities23(newcityCode, KT) {
  const template = decodeLabCode(newcityCode.trim()).save.raw, sizeOf = k => KT.size(k);
  return SB_CASES.map((c, j) => {
    const b = builder(template, sizeOf);
    b.road(8, 30, 40, 30).put(7, 30, 5);
    for (let i = 0; i < 6; i++) b.put(10 + i, 29, 1, 3, { den: 3 });
    packWrap(b, 4, 4, SERVICE_KINDS, sizeOf);
    const raw = decodeLabCode(b.code(5162026 + 3 * j, 1, '預算')).save.raw, o = { ...raw };
    if (c.sb === undefined) delete o.sb; else o.sb = c.sb;
    return { id: c.id, note: c.note, sb: c.sb, code: encodeLabCode(o, { deflate: true }) };
  });
}
