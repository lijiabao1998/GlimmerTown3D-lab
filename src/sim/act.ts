// 玩家在建築卡上的三個處置（D026）：滅火 $30、治療 $50、處理犯罪（免費）。照實驗線的三個按鈕處理函式（index.html 63426–63446 @ d23c18d，逐項對拍 tools/unit-d026.mjs）：
//   滅火：建築在燒、`money >= 30` 才行，扣 30、`fire＝0`；治療：生病中、`money >= 50` 才行，扣 50、`sick＝0`（`sickDays` 不動）；
//   處理犯罪：犯罪中，`crime＝0、crimeDays＝0`、`markLandDirty(x,y,4)`（犯罪影響地價，隔天只重算那個框）；免費。
// 錢不夠不動，回實驗線的字（「資金不足！滅火需 $30」「資金不足！治療需 $50」）。沙盒（diff 3）照扣：實驗線這三個按鈕沒有沙盒例外（沙盒不動錢的只有稅收結算，56053）。
// 不是施工：不進復原堆疊（實驗線同）；但照規則 4 記成 act 事件（只增不改）。純邏輯：不碰 three、DOM、Math.random、現實時間。
import type { ActKind, ActEvent } from './city.ts';
import { markStale, type Sim } from './day.ts';
import { markLandDirty } from './rules/build.ts';

export const ACT_COST: Record<ActKind, number> = { fire: 30, crime: 0, sick: 50 };
const LACK: Record<ActKind, string> = { fire: '資金不足！滅火需 $30', sick: '資金不足！治療需 $50', crime: '' };
export const ACT_DONE: Record<ActKind, string> = { fire: '火勢已撲滅！', crime: '犯罪已處理', sick: '病情已控制' };   // 實驗線的提示字（63431、63437、63444；犯罪那句「🚓 犯罪已處理」、治療「🏥 病情已控制」、滅火「🧯 火勢已撲滅！」的圖示由介面加）

export interface ActResult { ok: boolean; cost: number; reason?: string; event?: ActEvent }
export function actAt(s: Sim, x: number, z: number, what: ActKind): ActResult {
  const N = s.w.N;
  if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= N || z >= N) return { ok: false, cost: 0 };
  const b = s.w.tiles[z * N + x].bld;
  if (!b || !(what === 'fire' ? b.fire : what === 'crime' ? b.crime : b.sick)) return { ok: false, cost: 0 };       // 沒有東西可處置：什麼都不發生（實驗線 return）
  const cost = ACT_COST[what];
  if (cost > 0 && s.money < cost) return { ok: false, cost, reason: LACK[what] };                                   // money>=30／>=50 才行；處理犯罪免費、不看資金（63426–63431 沒有 money 判斷）
  s.money -= cost;
  if (what === 'fire') b.fire = 0;
  else if (what === 'sick') b.sick = 0;
  else { b.crime = 0; b.crimeDays = 0; markLandDirty(s, x, z, 4); markStale(s, x, z, 4); }
  const event: ActEvent = { day: s.day, t: 'act', x, z, what, cost };
  s.city.history.push(event);
  return { ok: true, cost, event };
}
