// 讀檔照實驗線重挑住商工的外觀變體（D012，T531）：實驗線 load() 的最後一步 ensureVariety531(true)（67035 → 66848–66862 @d23c18d）。
// 依格索引順序走過每一棟住商工根格（k 1／2／3，跳過 ref），v ← pickV406(k, lv||1, x, y, v)（53185，本線 src/sim/rules/land.ts）。
// 不抽亂數，不動 k、lv、屋齡，只改 v。v 只影響畫面（模擬沒有一條規則讀它），但會改變街區切分：1 級住宅 v 是 0／5／10 時是別墅，不跟鄰居併。
// 兩邊一起改：格子（模擬與存檔讀）和城市建築（畫面讀）。只改城市，隔天會被格子蓋回去；只改格子，下次讀檔的重播跟存檔對不上。
// 換了的記成 restyle 事件（規則 4：只增不改），一棟一筆，日子＝讀檔那一天。
// 地價用讀檔時算的（simFromSave 的 rebuildCov）。實驗線讀檔時的地價還看存檔的服務預算、犯罪旗標與上一個世界殘留的噪音場，本線沒搬（D012 卡）。
// 純邏輯。
import type { Sim } from './day.ts';
import { fieldsOf } from './rules/fields.ts';
import { pickV406 } from './rules/land.ts';

export function restyle531(s: Sim): number {
  const w = s.w, f = fieldsOf(s.g), N = w.N;
  let changed = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    const b = w.tiles[i].bld;
    if (!b || b.ref) continue;
    const k = b.k | 0;
    if (k !== 1 && k !== 2 && k !== 3) continue;
    const x = i % N, z = (i / N) | 0, v0 = b.v | 0;
    const v = pickV406(w, f, s.vrank, k, b.lv || 1, x, z, v0);
    if (v === v0) continue;                                              // 66857：沒換就不寫
    b.v = v;                                                             // 格子照實驗線改
    changed++;
    // 城市建築：正常只有一棟、就是這一格的根。手改的碼可能同一格有兩筆建築：格子留後一筆（同實驗線 load），城市留前一筆；
    // 那時城市那一棟不是這一棟，不改它、也不記事件（D012 審查：之前會把住宅的新變體寫進同一格的學校）
    const cb = s.root.get(i);
    if (!cb || (cb.k | 0) !== k || cb.x !== x || cb.z !== z) continue;   // k 一律 |0，同上面與重播（審查：巨大的 k 值兩邊判斷不一致）
    cb.v = v;
    s.city.history.push({ day: s.day, t: 'restyle', x, z, v });
  }
  return changed;
}
