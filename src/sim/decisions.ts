// 玩家決策的歷史讀法（D039）：世界歷史裡的 policy／budget／research／spec／techdone 五種事件（城市格式 8，src/sim/city.ts）折成「到某一天為止的」狀態，
// 與給☰「大事記」面板的逐筆文字。**歷史是紀錄、不是第二個真相來源**：模擬的政策、預算、科技、方向仍從存檔欄位讀；這裡只給守衛核對（重播＝模擬）與面板顯示。
// 起點＝匯入那一刻的狀態（2D 存檔讀進來時已有的政策、完成的科技沒有事件）。純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { DECISION_EVENTS, type CityEvent, type DecisionEvent } from './city.ts';
import { ensurePol, POLICY_CATALOG, BUDGET_CATS, type PolState } from './rules/policy.ts';
import { TECH343_BY_ID, SPEC386 } from './rules/tech.ts';

export interface DecisionState {
  pol: PolState;                        // 補齊的政策物件（ensurePol）
  budget: Record<string, number>;       // 四類服務預算
  done: string[];                       // 完成的科技（完成順序）
  act: string;                          // 進行中的節點（空字串＝沒有）
  spec: string;                         // 城市方向（空字串＝沒選）
}
export const isDecision = (e: CityEvent): e is DecisionEvent => DECISION_EVENTS.includes(e.t);

// 把一筆決策事件套到狀態上（就地）。回傳這一筆的白話（面板用）
function apply(st: DecisionState, e: DecisionEvent): string {
  switch (e.t) {
    case 'policy': {
      const cfg = POLICY_CATALOG[e.key], pol = st.pol as Record<string, unknown>;
      if (cfg.type === 'tax') { pol[e.key] = e.value; return `${cfg.nm}：${e.from.toFixed(1)}× → ${e.value.toFixed(1)}×`; }
      pol[e.key] = e.value === 1; return `${cfg.nm}：${e.value === 1 ? '開啟' : '關閉'}`;
    }
    case 'budget': {
      const nm = BUDGET_CATS.find(c => c.id === e.cat)?.nm ?? e.cat;
      st.budget[e.cat] = e.value; return `${nm}預算：×${e.from.toFixed(1)} → ×${e.value.toFixed(1)}`;
    }
    case 'research': {
      const n = TECH343_BY_ID[e.id]; st.act = e.id;
      return `開始研究：${n.nm}（${e.fee > 0 ? `−$${e.fee.toLocaleString()}` : '免費'}）`;
    }
    case 'techdone': {
      const n = TECH343_BY_ID[e.id]; st.done.push(e.id); if (st.act === e.id) st.act = '';
      return `學會了：${n.nm}（${n.effect}）`;
    }
    case 'spec': { const d = SPEC386[e.id]; st.spec = e.id; return `城市方向：${d.ic} ${d.nm}（${d.fx}）`; }
  }
}
const fresh = (start: { pol: PolState | null; budget: Readonly<Record<string, number>>; done: readonly string[]; act: string; spec: string | null }): DecisionState =>
  ({ pol: ensurePol(start.pol), budget: { ...start.budget }, done: [...start.done], act: start.act, spec: start.spec ?? '' });

// 到 upToDay（含）為止的決策狀態
export function decisionsOf(history: readonly CityEvent[], start: Parameters<typeof fresh>[0], upToDay = Infinity): DecisionState {
  const st = fresh(start);
  for (const e of history) if (isDecision(e) && e.day <= upToDay) apply(st, e);
  return st;
}
// ☰「大事記」：決策與科技完成，發生順序（面板再倒過來），每筆一行
export interface ChronicleLine { day: number; kind: DecisionEvent['t'] | 'depleted'; text: string }
// 不需要起點：政策與預算的事件自己帶著「改之前的值」，白話文字讀得出「從多少調到多少」
export function chronicleOf(history: readonly CityEvent[]): ChronicleLine[] {   // D040：資源耗盡（油井、礦場停產）也列，是這座城的大事
  const st = fresh({ pol: null, budget: { police: 1, fire: 1, health: 1, edu: 1 }, done: [], act: '', spec: null }), out: ChronicleLine[] = [];
  for (const e of history) {
    if (isDecision(e)) out.push({ day: e.day, kind: e.t, text: apply(st, e) });
    else if (e.t === 'depleted') out.push({ day: e.day, kind: 'depleted', text: `資源耗盡：${e.k === 49 ? '油井' : '礦場'}（${e.x}, ${e.z}）停產` });
  }
  return out;
}

// 當天耗盡的井合成一則通知（D040；介面發 toast）：一口＝「資源耗盡：油井（x, z）停產」，多口＝「資源耗盡：油井 2 口、礦場 1 口停產」。點一下鏡頭過去的那一格是第一口
export function depletedToastText(list: readonly { x: number; z: number; k: number }[]): string {
  if (list.length === 1) { const q = list[0]; return `資源耗盡：${q.k === 49 ? '油井' : '礦場'}（${q.x}, ${q.z}）停產`; }
  const oil = list.filter(q => q.k === 49).length, ore = list.length - oil;
  return `資源耗盡：${[oil ? `油井 ${oil} 口` : '', ore ? `礦場 ${ore} 口` : ''].filter(Boolean).join('、')}停產`;
}
