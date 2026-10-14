// 科技與專精（D038，backlog 支線）：T343 科技研究（四條路線、36 個節點、每天的研究進度、開始研究、存與讀）與 T386 城市方向（四選一、永久）。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。
//   專精 SPEC386 37843–37848、sq 37851、specPick386 37852；科技表 TECH343 38507–38544、狀態 38547、tq 38549、TECH_EDU343 38550、canStartTech343 38551、startTech343 38557、
//   advanceTech343 38566、techSave343 38583、techLoad343 38591；呼叫處：主計數迴圈之後 55245、存檔 66770／66772、讀檔 66928／66930。
// 效果本線早就搬了、各處收 tech（完成清單）與 spec 兩個參數（happy.ts、money.ts、hazard.ts、demand.ts、growth.ts、fields.ts、build.ts、food.ts、economy.ts、day.ts 的城市點數）；
// 這裡補的是「狀態」：完成清單（Sim.edu.tech，各處讀它）、進行中的節點與進度（Sim.tech）、每天的研究、開始研究與選方向的動作、存與讀。
// 照抄的細節：完成的清單依完成順序；讀檔整欄畸形就整個棄用回零（不挑壞的那一項）；專精的白名單驗型用普通物件取值（`SPEC386[id]` 對 'constructor' 之類也是真值，實驗線的怪癖，本線同樣）；
// 研究速度每天重算、不存檔；開始研究只設 act、進行中的舊節點進度留著（換著做不丟）；已有進度的節點再開始免費。
// 沒搬：委託（T385）的「科技」型目標（56179）、軌道運量倍率 A2／C5／hub（64067，屬公車與軌道）、AI 市長自動研究、科技樹的畫布圖（65333）、測試用強制完成 techGrant343。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；不動世界歷史。
export interface TechNode { id: string; nm: string; route: 'A' | 'B' | 'C' | 'D'; tier: number; cost: number; points: number; pre: string[]; mutex?: string; any?: string[]; minDone?: number; effect: string }
export const TECH343: readonly TechNode[] = [
  { id: 'A1', nm: '標準化生產', route: 'A', tier: 1, cost: 400, points: 40, pre: [], effect: '工業稅 ×1.04' },
  { id: 'A2', nm: '物流網絡', route: 'A', tier: 2, cost: 900, points: 55, pre: ['A1'], effect: '公交運量 ×1.12' },
  { id: 'A3', nm: '供應鏈金融', route: 'A', tier: 3, cost: 1500, points: 70, pre: ['A2'], effect: '商業稅 ×1.04' },
  { id: 'A4a', nm: '重工傾斜', route: 'A', tier: 4, cost: 2400, points: 85, pre: ['A3'], mutex: 'A4b', effect: '工業稅 ×1.08；起火 ×1.10' },
  { id: 'A4b', nm: '綠色轉型', route: 'A', tier: 4, cost: 2400, points: 85, pre: ['A3'], mutex: 'A4a', effect: '起火 ×0.85；工業稅 ×0.98' },
  { id: 'A5', nm: '精益製造', route: 'A', tier: 5, cost: 3600, points: 100, pre: [], any: ['A4a', 'A4b'], effect: '升級率 ×1.10' },
  { id: 'A6', nm: '出口擴張', route: 'A', tier: 6, cost: 5200, points: 115, pre: ['A5'], effect: '商業稅 ×1.05' },
  { id: 'A7', nm: '產業聚落', route: 'A', tier: 7, cost: 7000, points: 130, pre: ['A6'], effect: '工業需求 +0.10' },
  { id: 'A8', nm: '智慧工廠', route: 'A', tier: 8, cost: 9000, points: 150, pre: ['A7'], effect: '工業稅 ×1.06' },
  { id: 'B1', nm: '社區自治', route: 'B', tier: 1, cost: 400, points: 40, pre: [], effect: '幸福 +0.01' },
  { id: 'B2', nm: '鄰里守望', route: 'B', tier: 2, cost: 900, points: 55, pre: ['B1'], effect: '犯罪 ×0.92' },
  { id: 'B3', nm: '公共安全網', route: 'B', tier: 3, cost: 1500, points: 70, pre: ['B2'], effect: '起火 ×0.90' },
  { id: 'B4a', nm: '福利城市', route: 'B', tier: 4, cost: 2400, points: 85, pre: ['B3'], mutex: 'B4b', effect: '幸福 +0.02；政策日費 +$10' },
  { id: 'B4b', nm: '自由市場', route: 'B', tier: 4, cost: 2400, points: 85, pre: ['B3'], mutex: 'B4a', effect: '商業稅 ×1.05；犯罪 ×1.05' },
  { id: 'B5', nm: '市政效率', route: 'B', tier: 5, cost: 3600, points: 100, pre: [], any: ['B4a', 'B4b'], effect: '建造費 ×0.95' },
  { id: 'B6', nm: '全民保健', route: 'B', tier: 6, cost: 5200, points: 115, pre: ['B5'], effect: '幸福 +0.015' },
  { id: 'B7', nm: '治安現代化', route: 'B', tier: 7, cost: 7000, points: 130, pre: ['B6'], effect: '犯罪 ×0.90' },
  { id: 'B8', nm: '樂活城市', route: 'B', tier: 8, cost: 9000, points: 150, pre: ['B7'], effect: '幸福 +0.02' },
  { id: 'C1', nm: '公共閱讀', route: 'C', tier: 1, cost: 400, points: 40, pre: [], effect: '教育場 ×1.05' },
  { id: 'C2', nm: '教研合作', route: 'C', tier: 2, cost: 900, points: 55, pre: ['C1'], effect: '升級率 ×1.08' },
  { id: 'C3', nm: '文化補助', route: 'C', tier: 3, cost: 1500, points: 70, pre: ['C2'], effect: '商業稅 ×1.03' },
  { id: 'C4a', nm: '精英教育', route: 'C', tier: 4, cost: 2400, points: 85, pre: ['C3'], mutex: 'C4b', effect: '教育場 ×1.15；政策日費 +$8' },
  { id: 'C4b', nm: '普及教育', route: 'C', tier: 4, cost: 2400, points: 85, pre: ['C3'], mutex: 'C4a', effect: '教育場 ×1.08；幸福 +0.01' },
  { id: 'C5', nm: '觀光推廣', route: 'C', tier: 5, cost: 3600, points: 100, pre: [], any: ['C4a', 'C4b'], effect: '公交運量 ×1.08' },
  { id: 'C6', nm: '學術網絡', route: 'C', tier: 6, cost: 5200, points: 115, pre: ['C5'], effect: '研究速度 +1' },
  { id: 'C7', nm: '創意城市', route: 'C', tier: 7, cost: 7000, points: 130, pre: ['C6'], effect: '幸福 +0.015' },
  { id: 'C8', nm: '智庫決策', route: 'C', tier: 8, cost: 9000, points: 150, pre: ['C7'], effect: '建造費 ×0.95' },
  { id: 'D1', nm: '城市檔案', route: 'D', tier: 1, cost: 400, points: 40, pre: [], effect: '城市點數 ×1.05' },
  { id: 'D2', nm: '數據治理', route: 'D', tier: 2, cost: 900, points: 55, pre: ['D1'], effect: '研究速度 +1' },
  { id: 'D3', nm: '資本市場', route: 'D', tier: 3, cost: 1500, points: 70, pre: ['D2'], effect: '商業稅 ×1.04' },
  { id: 'D4a', nm: '巨型工程優先', route: 'D', tier: 4, cost: 2400, points: 85, pre: ['D3'], mutex: 'D4b', effect: '建造費 ×0.90' },
  { id: 'D4b', nm: '精明成長', route: 'D', tier: 4, cost: 2400, points: 85, pre: ['D3'], mutex: 'D4a', effect: '城市點數 ×1.10' },
  { id: 'D5', nm: '科研特區', route: 'D', tier: 5, cost: 3600, points: 100, pre: ['C6'], any: ['D4a', 'D4b'], effect: '研究速度 +2' },
  { id: 'D6', nm: '城市品牌', route: 'D', tier: 6, cost: 5200, points: 115, pre: ['D5'], effect: '幸福 +0.02' },
  { id: 'D7', nm: '學府之都', route: 'D', tier: 7, cost: 7000, points: 130, pre: ['D6'], effect: '教育場 ×1.10' },
  { id: 'D8', nm: '微光之巔', route: 'D', tier: 8, cost: 9000, points: 150, pre: ['D7'], minDone: 30, effect: '幸福 +0.03' },
];
export const TECH343_BY_ID: Record<string, TechNode> = Object.create(null);
for (const n of TECH343) TECH343_BY_ID[n.id] = n;
export const TECH_EDU343 = ['C1', 'C4a', 'C4b', 'D7'];                                     // 38550：完成了要重建覆蓋場的教育場科技

export interface SpecDef { nm: string; ic: string; fx: string }
export const SPEC386: Record<string, SpecDef> = {                                          // 37843
  ind: { nm: '工業港城', ic: '🏭', fx: '工業稅+6%・造船港金+25%｜起火+8%' },
  green: { nm: '綠色城市', ic: '🌿', fx: '起火-10%・觀光+15%｜工業稅-8%' },
  edu: { nm: '教育科技城', ic: '🎓', fx: '教育場+8%・研究速度+1｜政策日費+$12' },
  hub: { nm: '交通樞紐', ic: '🚉', fx: '運量+12%・商業稅+3%｜建造費+5%' },
};
export const SPEC_IDS386 = ['ind', 'green', 'edu', 'hub'];                                 // 37849
export const SPEC_MIN_RANK = 9;                                                           // 37853（T394b：Lv.6 → Lv.9）：城市等級 rankIdx + 1 ≥ 9 才能選

// 進行中的節點與進度（完成的清單是 Sim.edu.tech，不在這裡）
export interface TechProg { act: string; prog: Record<string, number> }
export const emptyTech = (): TechProg => ({ act: '', prog: {} });                         // 38546 emptyTech343

const has = (done: readonly string[], id: string) => done.indexOf(id) >= 0;                // 38548 hasTech343

// 38551 canStartTech343：存在、沒完成、互斥的另一個沒做／沒在做／沒進度、前置都完成、any 至少完成一個、minDone 夠
export function canStartTech(n: TechNode | undefined, st: TechProg, done: readonly string[]): boolean {
  if (!n || has(done, n.id) || (n.mutex && (has(done, n.mutex) || st.act === n.mutex || st.prog[n.mutex] > 0))) return false;
  if (n.pre && n.pre.some(id => !has(done, id))) return false;
  if (n.any && n.any.length && !n.any.some(id => has(done, id))) return false;
  return !(n.minDone && done.length < n.minDone);
}
// 介面用：開始不了的原因（講給玩家聽）；空字串＝canStartTech 成立。每個分支對應 canStartTech 的一個條件，順序同
export function techWhy(n: TechNode | undefined, st: TechProg, done: readonly string[]): string {
  if (!n) return '沒有這個科技';
  if (has(done, n.id)) return '已完成';
  if (n.mutex && (has(done, n.mutex) || st.act === n.mutex || st.prog[n.mutex] > 0)) return `與「${TECH343_BY_ID[n.mutex].nm}」二選一（${has(done, n.mutex) ? '已完成' : st.act === n.mutex ? '研究中' : '已有進度'}）`;
  const lack = (n.pre ?? []).filter(id => !has(done, id));
  if (lack.length) return `前置還沒完成：${lack.map(id => TECH343_BY_ID[id].nm).join('、')}`;
  if (n.any && n.any.length && !n.any.some(id => has(done, id))) return `要先完成其中一個：${n.any.map(id => TECH343_BY_ID[id].nm).join('、')}`;
  if (n.minDone && done.length < n.minDone) return `要先完成 ${n.minDone} 個科技（現在 ${done.length} 個）`;
  return '';
}
// 38561：費用＝沙盒（diff 3）或這個節點已有進度 → 0，否則 cost
export const techFee = (n: TechNode, st: TechProg, diff: number) => (diff === 3 || st.prog[n.id] > 0) ? 0 : n.cost;
// 38557 startTech343：回傳是否成功與扣了多少（已經在做它＝成功、不再付錢）。只設 act；原本進行中的節點的進度留在 prog
export function startTech(id: string, st: TechProg, done: readonly string[], money: number, diff: number): { ok: boolean; fee: number } {
  const n = TECH343_BY_ID[id];
  if (!canStartTech(n, st, done)) return { ok: false, fee: 0 };
  if (st.act === id) return { ok: true, fee: 0 };
  const fee = techFee(n, st, diff);
  if (money < fee) return { ok: false, fee: 0 };
  st.act = id;
  return { ok: true, fee };
}

// 38567 研究速度：1 ＋ min(7, 研究院＋大學＋科技園×2＋校園×2＋資料中心＋大型工程×2＋研究機構×3) ＋ C6（+1）＋ D2（+1）＋ D5（+2）＋ 專精 edu（+1）
export interface ResearchIn { inN: number; un: number; tpk342: number; cam342: number; dtc342: number; mgN: number; res466: number }
export const techSpeed = (c: ResearchIn, done: readonly string[], spec: string | null) =>
  1 + Math.min(7, c.inN + c.un + c.tpk342 * 2 + c.cam342 * 2 + c.dtc342 + c.mgN * 2 + c.res466 * 3) + (has(done, 'C6') ? 1 : 0) + (has(done, 'D2') ? 1 : 0) + (has(done, 'D5') ? 2 : 0) + (spec === 'edu' ? 1 : 0);
// 38566 advanceTech343：每天一次。進行中的節點 prog += 速度；累積 ≥ points 就完成（prog 刪、done 加、act 清）。回傳速度與完成的節點（沒有＝null）；完成的是教育場科技時呼叫端要重建覆蓋場
export function advanceTech(st: TechProg, done: string[], c: ResearchIn, spec: string | null): { speed: number; finished: string | null } {
  const speed = techSpeed(c, done, spec), n = TECH343_BY_ID[st.act];
  if (!n) return { speed, finished: null };
  const next = (st.prog[n.id] || 0) + speed;
  if (next < n.points) { st.prog[n.id] = next; return { speed, finished: null }; }
  delete st.prog[n.id]; done.push(n.id); st.act = '';
  return { speed, finished: n.id };
}

// 38583 techSave343：零狀態（沒有 act、沒有完成、沒有進度）回 null（不落欄位）；prog 只收「整數、> 0、< points」的（依表的順序）
export function techSave(st: TechProg, done: readonly string[]): { act: string; prog: Record<string, number>; done: string[] } | null {
  const prog: Record<string, number> = {};
  for (const n of TECH343) { const v = st.prog[n.id]; if (Number.isInteger(v) && v > 0 && v < n.points) prog[n.id] = v; }
  if (!st.act && !done.length && !Object.keys(prog).length) return null;
  return { act: st.act, prog, done: done.slice() };
}
// 38591 techLoad343：缺欄位／畸形欄位整個棄用回零（不挑壞的那一項）
export function techLoad(raw: unknown): { st: TechProg; done: string[] } {
  const zero = () => ({ st: emptyTech(), done: [] as string[] });
  if (raw === undefined) return zero();
  const r = raw as { act?: unknown; prog?: unknown; done?: unknown };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof r.act !== 'string' || !r.prog || typeof r.prog !== 'object' || Array.isArray(r.prog) || !Array.isArray(r.done)) return zero();
  const act = r.act, rprog = r.prog as Record<string, unknown>, rdone = r.done as unknown[];
  if (act && !TECH343_BY_ID[act]) return zero();
  const done: string[] = [], seen: Record<string, number> = {};
  for (const id of rdone) {
    const n = typeof id === 'string' ? TECH343_BY_ID[id] : undefined;
    if (typeof id !== 'string' || !n || seen[id] || (n.mutex && seen[n.mutex])) return zero();
    seen[id] = 1; done.push(id);
  }
  const prog: Record<string, number> = {};
  for (const id of Object.keys(rprog)) {
    const n = TECH343_BY_ID[id], v = rprog[id];
    if (!n || !Number.isInteger(v) || (v as number) <= 0 || (v as number) >= n.points || seen[id]) return zero();
    prog[id] = v as number;
  }
  for (const id of Object.keys(prog)) { const m = TECH343_BY_ID[id].mutex; if (m && (seen[m] || prog[m] !== undefined || act === m)) return zero(); }
  if (act && (seen[act] || (TECH343_BY_ID[act].mutex && (seen[TECH343_BY_ID[act].mutex as string] || prog[TECH343_BY_ID[act].mutex as string] !== undefined)))) return zero();
  return { st: { act, prog }, done };
}

// 66930 讀檔的專精：字串且「白名單取值為真」才收（普通物件取值，'constructor' 也算真，實驗線的怪癖）；否則 ''（沒有）
export const specOfSave = (raw: unknown): string => (typeof raw === 'string' && (SPEC386 as Record<string, unknown>)[raw]) ? raw : '';
// 37852 specPick386：還沒選過、不是沙盒、城市等級 ≥ Lv.9、編號在 0–3；回傳選到的方向 id（不行＝null）。選 edu 時呼叫端要重建覆蓋場
export function pickSpec(i: number, spec: string | null, diff: number, rankIdx: number): string | null {
  if (spec || diff === 3 || rankIdx + 1 < SPEC_MIN_RANK) return null;
  return SPEC_IDS386[i] ?? null;
}
