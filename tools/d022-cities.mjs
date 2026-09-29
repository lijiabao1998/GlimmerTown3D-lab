// D022 對拍用的「自己造的城」：糧食（供糧率、每棟住宅每天的加減）的各種輸入——食物來源、季節、路格數與貿易設施（額度）、觀光建築與會展中心（遊客）、沒電沒人、污水廠。
// 用本線的 encodeLabCode 生分享碼（tools/d021-cities.mjs 的組裝器），匯入實驗線頁面、推進一天，探針讀糧食那一段的輸入輸出與每一棟住宅的幸福（tools/d022-lab.mjs 錄、tools/unit-d022.mjs 比）。
// 72×72 的平地，沒有分區＝不會長新房子，兩邊推進之後的建築完全一樣；一條 z＝30 的橫路、路頭一座發電廠（k5）、路邊的住宅；食物來源、觀光建築放在遠處（不佔電）。
// 存檔的天數 day 決定季節與會展脈衝（推進一天之後 day＋1：春 1–100、夏 101–200、秋 201–300、冬 301–360；會展每 20 天一波）。
// kind：judged＝兩邊要逐項相等；measure＝實驗線有、本線沒搬的輸入（污水廠碰到工業、物流中心）：只量、只記差多少，卡面講明。
// 全部用座標算出來，沒有 Math.random、現實時間。
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { builder } from './d021-cities.mjs';

// 一排：z 這一列從 x0 起往右，每個放一種（[k, lv]，佔幾格看內容表），中間空一格；回傳下一個可放的 x
function pack(b, z, x0, items, sizeOf) {
  let x = x0;
  for (const [k, lv = 1] of items) { b.put(x, z, k, lv); x += sizeOf(k) + 1; }
  return x;
}
// 路頭一座發電廠、一條 z＝30 的橫路（x 8–40，33 格）、路邊 n 棟住宅（Lv3 密度 3，各 54 人）
function town(b, n = 10, x1 = 40) {
  b.road(8, 30, x1, 30).put(7, 30, 5);
  for (let i = 0; i < n; i++) b.put(10 + (i % 30), i < 30 ? 29 : 31, 1, 3, { den: 3 });
  return b;
}
const FOOD5 = [[53, 2], [63, 2], [97, 1], [104, 1], [120, 1]];   // 大農場 Lv2（40）、溫室 Lv2（12）、釣魚碼頭（3）、社區菜園（1）、魚塘（4）＝60（春）；農場那一項乘季節倍率

export function defs22(sizeOf) {
  const P = (b, z, x0, items) => pack(b, z, x0, items, sizeOf);
  const rows = (b, count, len) => { for (let r = 0; r < count; r++) b.road(6, 2 + 3 * r, 6 + len - 1, 2 + 3 * r); };   // 互不相連的橫路（z＝2、5、8…）：count 條各 len 格，只增加路格數
  return [
    // ---- A：食物來源與季節 ----
    { id: 'A1', kind: 'judged', day: 1, note: '春：沒有食物來源，住宅 10 棟（540 人、需求 54）：本地 0、進口 3（額度 3）、供糧率 .056', build: b => town(b, 10) },
    { id: 'A2', kind: 'judged', day: 1, note: '春：農場 Lv1 兩座＋牧場 Lv1（食物 8），需求 54：本地 8＋進口 3', build: b => { town(b, 10); P(b, 10, 10, [[22, 1], [22, 1], [23, 1]]); } },
    { id: 'A3', kind: 'judged', day: 1, note: '春：大農場 Lv2（40）、溫室 Lv2（12）、釣魚碼頭（3）、社區菜園（1）、魚塘（4）＝60 ≥ 需求 54：供糧率 1（加成夾在 +.05）', build: b => { town(b, 10); P(b, 10, 10, FOOD5); } },
    { id: 'A4', kind: 'judged', day: 120, note: '夏（農場 ×1.15）：同 A3', build: b => { town(b, 10); P(b, 10, 10, FOOD5); } },
    { id: 'A5', kind: 'judged', day: 250, note: '秋（農場 ×1.4）：同 A3', build: b => { town(b, 10); P(b, 10, 10, FOOD5); } },
    { id: 'A6', kind: 'judged', day: 320, note: '冬（農場 ×.4）：同 A3，農場只剩 16、合計 36 < 54：本地 36＋進口 3', build: b => { town(b, 10); P(b, 10, 10, FOOD5); } },
    { id: 'A7', kind: 'judged', day: 1, note: '春：農場 Lv3 三座（27）＋牧場 Lv3（6）：等級加權', build: b => { town(b, 10); P(b, 10, 10, [[22, 3], [22, 3], [22, 3], [23, 3]]); } },
    { id: 'A8', kind: 'judged', day: 1, note: '春：兩棟住宅（108 人、需求 11）＋農場 Lv1＋牧場 Lv1（食物 5）：本地 5＋進口 3＝8 < 11', build: b => { town(b, 2); P(b, 10, 10, [[22, 1], [23, 1]]); } },
    { id: 'A9', kind: 'judged', day: 1, note: '春：一棟住宅（54 人、需求 6）＋農場＋牧場（5）＋魚塘（4）：供過於求、不進口', build: b => { town(b, 1); P(b, 10, 10, [[22, 1], [23, 1], [120, 1]]); } },
    // ---- B：貿易額度（路格數、貿易站、港口、倉儲、貨運；住宅 30 棟＝需求 162，進口顯出額度）。全城路格＝發電廠那條 33 格＋加的橫路；設施放在下面 z＝50 一帶 ----
    { id: 'B1', kind: 'judged', day: 1, note: '路格 80（底 min(8, 1＋⌊80/80⌋)＝2、額度最少 3）：進口 3', build: b => { town(b, 30); b.road(8, 20, 54, 20); } },
    { id: 'B2', kind: 'judged', day: 1, note: '路格 400（底 6、⌊6×.78⌋＝4）：進口 4', build: b => { town(b, 30); rows(b, 6, 61); b.road(8, 20, 8, 20); } },
    { id: 'B3', kind: 'judged', day: 1, note: '路格 560（底 8、⌊8×.78⌋＝6）：進口 6', build: b => { town(b, 30); rows(b, 8, 65); b.road(8, 25, 14, 25); } },
    { id: 'B4', kind: 'judged', day: 1, note: '路格 640（底封頂 8）：跟 560 一樣、進口 6', build: b => { town(b, 30); rows(b, 9, 66); b.road(8, 27, 20, 27); } },
    { id: 'B5', kind: 'judged', day: 1, note: '路格 560＋港口＋貿易站：（8＋4＋4）×.805＝12', build: b => { town(b, 30); rows(b, 8, 65); b.road(8, 25, 14, 25); P(b, 50, 10, [[18], [91]]); } },
    { id: 'B6', kind: 'judged', day: 1, note: '路格 560＋倉儲物流中心 2 座＋貨運站：底 8＋貨運 3＋倉儲 4，效率 .78＋.035＋.044', build: b => { town(b, 30); rows(b, 8, 65); b.road(8, 25, 14, 25); P(b, 50, 10, [[64], [64], [110]]); } },
    { id: 'B7', kind: 'judged', day: 1, note: '港口 3、貿易站 3、倉儲 3、貨運 2（路格 560）：效率加成 .075＋.066＋.07', build: b => { town(b, 30); rows(b, 8, 65); b.road(8, 25, 14, 25); P(b, 50, 10, [[18], [18], [18], [91], [91], [91]]); P(b, 54, 10, [[64], [64], [64], [110], [110]]); } },
    { id: 'B8', kind: 'judged', day: 1, note: '效率加成封頂 .26：港口 6、倉儲 5', build: b => { town(b, 30); rows(b, 8, 65); b.road(8, 25, 14, 25); P(b, 50, 10, [[18], [18], [18], [18], [18], [18]]); P(b, 54, 10, [[64], [64], [64], [64], [64]]); } },
    { id: 'B9', kind: 'judged', day: 1, note: '路格只有 3（額度最少 3、底 1）：一條 3 格的路、路頭發電廠、兩棟住宅', build: b => { b.road(8, 30, 10, 30).put(7, 30, 5).put(9, 29, 1, 3).put(10, 29, 1, 3); } },
    // ---- C：觀光與遊客 ----
    { id: 'C1', kind: 'judged', day: 1, note: '春：地標 2、博物館、動物園、遊樂園、機場、火車站＝遊客 210（遊客需求 2）', build: b => { town(b, 10); P(b, 10, 10, [[24], [24], [35], [38], [39], [19], [17]]); } },
    { id: 'C2', kind: 'judged', day: 120, note: '夏（×1.3）：文化藝術中心、國際機場、中央行政園區、科技研究園區、都會大公園、中央公園、水上樂園、天際觀景餐廳、婚禮教堂、電視塔、遊艇碼頭、度假酒店', build: b => { town(b, 10); P(b, 8, 4, [[136], [114], [137], [138]]); P(b, 15, 4, [[134], [112], [101], [103], [99], [89], [90], [83]]); } },
    { id: 'C3', kind: 'judged', day: 250, note: '秋（×1.2）：十二座地標 k69–80、鐘樓、天文台、植物園', build: b => { town(b, 10); P(b, 10, 4, [[69], [70], [71], [72], [73], [74], [75], [76], [77], [78], [79], [80], [67], [68], [47]]); } },
    { id: 'C4', kind: 'judged', day: 320, note: '冬（×.85）：劇院、水族館、電影院、婚禮教堂、植物園、水上樂園', build: b => { town(b, 10); P(b, 10, 10, [[36], [37], [40], [99], [47], [101]]); } },
    { id: 'C5', kind: 'judged', day: 19, note: '會展中心 2 座、第 19 天推進到第 20 天：脈衝 ⌊500×2×1⌋＝1000 位遊客（遊客需求 7）', build: b => { town(b, 10); P(b, 10, 10, [[44], [44]]); } },
    { id: 'C6', kind: 'judged', day: 20, note: '會展中心 2 座、第 20 天推進到第 21 天：沒有脈衝', build: b => { town(b, 10); P(b, 10, 10, [[44], [44]]); } },
    { id: 'C7', kind: 'judged', day: 119, note: '會展中心 1 座、第 119 天推進到第 120 天（夏 ×1.3）：脈衝 ⌊500×1×1.3⌋＝650', build: b => { town(b, 10); P(b, 10, 10, [[44]]); } },
    { id: 'C8', kind: 'judged', day: 1, note: '沒有路、沒有住宅：只有觀光建築與農場（不用電）：需求只來自遊客、額度 0（沒路）、本地食物 3 少於需求', build: b => { P(b, 10, 10, [[24], [35], [38], [22, 1]]); } },
    { id: 'C9', kind: 'judged', day: 120, note: '夏：觀光＋大農場＋貿易站＋港口（路格 560）：遊客需求與貿易額度一起', build: b => { town(b, 20); rows(b, 8, 65); b.road(8, 25, 14, 25); P(b, 50, 10, [[18], [91]]); P(b, 54, 10, [[53, 1], [24], [38], [39]]); } },
    // ---- D：沒人、污水廠、物流（實驗線有、本線沒搬的）----
    { id: 'D1', kind: 'judged', day: 1, note: '住宅沒有電（沒有發電廠）：人口 0、遊客 0、需求 0：供糧率 1、沒有加減', build: b => { b.road(8, 30, 40, 30); for (let i = 0; i < 10; i++) b.put(10 + i, 29, 1, 3, { den: 3 }); } },
    { id: 'D2', kind: 'judged', day: 1, note: '有污水廠（k27）、住宅旁沒有工業：實驗線 55420 那一句對住宅沒有加成（ind＝0）', build: b => { town(b, 10); b.put(30, 31, 27); } },
    { id: 'D3', kind: 'measure', day: 1, note: '有污水廠、人口不到 500（不需要污水管網：實驗線每一棟住宅都算 SEW_OK442）、住宅旁有工業：55420 每個工業 +.025（污水廠 T442 沒搬）——只量', build: b => { town(b, 5); b.put(30, 31, 27); b.put(9, 31, 3, 1).put(11, 31, 3, 1).put(13, 31, 3, 1); } },
    { id: 'D4', kind: 'measure', day: 1, note: '有貨櫃物流中心（k165，4×4，T485）貼著路邊、有電＝運作中：貨運與倉儲單位、貿易額度多一份（物流 T485 沒搬）——只量', build: b => { town(b, 10); b.put(22, 31, 165); } },
    // 碼的種子由位置定（5162026＋3×序號），所以新的城只往後加、不插隊
    { id: 'A10', kind: 'judged', day: 1, note: '額度夠拿：三棟住宅（162 人、需求 17）＋農場＋牧場（食物 5）、路格 560＋港口＋貿易站（額度 12）：缺口 12＝進口 12、供糧率 1', build: b => { town(b, 3); rows(b, 8, 65); b.road(8, 25, 14, 25); P(b, 50, 10, [[18], [91]]); P(b, 56, 10, [[22, 1], [23, 1]]); } },
    { id: 'A11', kind: 'judged', day: 1, note: '額度剛好夠：一棟住宅（54 人、需求 6）＋農場 Lv1（食物 3）：缺口 3＝進口 3（額度 3）、供糧率 1', build: b => { town(b, 1); P(b, 10, 10, [[22, 1]]); } },
    { id: 'C10', kind: 'judged', day: 1, note: '遊客剛好 321（國際機場 120、文化藝術中心 80、遊樂園 55、動物園 45、鐘樓 12、涼亭 9）：遊客需求 ⌈321/160⌉＝3（除以 161 會變 2）', build: b => { town(b, 10); P(b, 10, 4, [[114], [136], [39], [38], [67], [74]]); } },
  ];
}

// 全部的城（碼）：newcityCode＝src/content/samples/newcity.code.txt（存檔 JSON 拿來當樣板）；KT＝內容表（多格建築佔幾格）
export function cities22(newcityCode, KT, ai120Code) {
  const template = decodeLabCode(newcityCode.trim()).save.raw, sizeOf = k => KT.size(k);
  const own = defs22(sizeOf).map((d, j) => {
    const b = builder(template, sizeOf); d.build(b);
    return { id: d.id, kind: d.kind, note: d.note, day: d.day, code: b.code(5162026 + 3 * j, d.day, '糧食') };
  });
  // AI 城 120 天拿掉污水廠（k27）與所有政策：污水廠碰到工業的那一句（55420）與「公園夜間開放」（parkNight：有公園覆蓋的住宅 +.02）本線都沒搬，
  // 原樣的 AI 城因此 127 棟住宅各差 .02（只量）；拿掉之後整座城（128 棟住宅、食物 121）本線與實驗線逐棟相等
  if (ai120Code) {
    const raw = decodeLabCode(ai120Code.trim()).save.raw, pol = Object.fromEntries(Object.entries(raw.pol ?? {}).map(([k, v]) => [k, v === true ? false : v]));
    own.push({ id: 'ai120-plain', kind: 'judged', note: 'AI 城 120 天拿掉污水廠（k27）與所有政策：其餘一切照舊', day: raw.day, code: encodeLabCode({ ...raw, pol, bl: raw.bl.filter(row => row[1] !== 27) }, { deflate: true }) });
  }
  return own;
}
