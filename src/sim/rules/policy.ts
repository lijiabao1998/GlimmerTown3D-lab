// 政策與預算（D032，K）：玩家的旋鈕——三條稅率、四條服務預算、法規與政策開關。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號：政策目錄 53719–53725、預設物件與補欄位 mayorEnsurePolicy470A 53748、冷卻 53749、套用 mayorPolicyApply470A 53750–53755、
// T504 關掉時的直接路徑 policyApply504 67570（回退設定 __noPolicy504：立刻生效，但保留冷卻）、稅率按鈕 polStep 65791–65793、服務預算 setSvcBudget 52968–52973、存檔 66750、讀檔 66975、
// 災害保險 insPayout 53047–53051、緊急物資儲備 55348／55357／55388／56000、回收乘數 55257。
// 沒有亂數；政策物件入存檔（實驗線既有的可選欄位 pol），冷卻狀態不入存檔（實驗線放在 AI 市長的存檔裡，本線沒有）。純函式：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { clamp } from './lab.ts';
import type { SvcBudget } from './fields.ts';

export type PolicyType = 'tax' | 'toggle';
export interface PolicyDef { nm: string; type: PolicyType; cooldown: number }
// 53719–53725：29 條（稅率 3＋開關 26），名稱、種類、冷卻天數照抄
export const POLICY_CATALOG: Readonly<Record<string, PolicyDef>> = {
  taxR: { nm: '住宅稅', type: 'tax', cooldown: 40 }, taxC: { nm: '商業稅', type: 'tax', cooldown: 40 }, taxI: { nm: '工業稅', type: 'tax', cooldown: 40 },
  curfew: { nm: '宵禁', type: 'toggle', cooldown: 45 }, recycle: { nm: '回收宣導', type: 'toggle', cooldown: 35 }, tourPromo: { nm: '觀光推廣', type: 'toggle', cooldown: 45 }, ecoReg: { nm: '節能條例', type: 'toggle', cooldown: 45 },
  freeTransit: { nm: '免費公交', type: 'toggle', cooldown: 45 }, schoolLunch: { nm: '營養午餐', type: 'toggle', cooldown: 40 }, smokeDetect: { nm: '煙霧偵測', type: 'toggle', cooldown: 35 }, indSubsidy: { nm: '工業補貼', type: 'toggle', cooldown: 45 },
  nightMarket: { nm: '夜市', type: 'toggle', cooldown: 45 }, parkNight: { nm: '公園夜間開放', type: 'toggle', cooldown: 40 }, insurance: { nm: '災害保險', type: 'toggle', cooldown: 60 }, integratedTransit: { nm: '一票轉乘', type: 'toggle', cooldown: 35 },
  housingSubsidy: { nm: '住房補貼', type: 'toggle', cooldown: 45 }, inclusionaryHousing: { nm: '包容性住宅標準', type: 'toggle', cooldown: 50 }, stationHousing: { nm: '站城住宅優先', type: 'toggle', cooldown: 45 },
  waterConserve: { nm: '節水條例', type: 'toggle', cooldown: 40 }, reclaimPriority: { nm: '再生水優先', type: 'toggle', cooldown: 35 }, industrialPretreat: { nm: '工業污水預處理', type: 'toggle', cooldown: 40 }, spongeCity: { nm: '海綿城市標準', type: 'toggle', cooldown: 45 },
  infrastructureStimulus: { nm: '基礎建設刺激', type: 'toggle', cooldown: 45 }, consumptionSupport: { nm: '消費支持', type: 'toggle', cooldown: 40 }, industrialRelief: { nm: '產業穩崗', type: 'toggle', cooldown: 45 },
  completeStreets: { nm: '完整街道', type: 'toggle', cooldown: 45 }, parkingManagement: { nm: '停車管理', type: 'toggle', cooldown: 40 }, criticalReserve492: { nm: '關鍵備轉標準', type: 'toggle', cooldown: 50 }, emergencyStockpile492: { nm: '緊急物資儲備', type: 'toggle', cooldown: 50 },
};

// 政策物件：三條稅率（預設 1）＋ 26 個開關（預設 false）。讀進來的物件原樣留著（缺欄位＝undefined，各消費者都容錯），所以型別全是可選
export interface Pol {
  taxR: number; taxC: number; taxI: number;
  curfew: boolean; recycle: boolean; tourPromo: boolean; ecoReg: boolean; freeTransit: boolean; schoolLunch: boolean; smokeDetect: boolean; indSubsidy: boolean; nightMarket: boolean; parkNight: boolean;
  insurance: boolean; integratedTransit: boolean; housingSubsidy: boolean; inclusionaryHousing: boolean; stationHousing: boolean; waterConserve: boolean; reclaimPriority: boolean; industrialPretreat: boolean;
  spongeCity: boolean; infrastructureStimulus: boolean; consumptionSupport: boolean; industrialRelief: boolean; completeStreets: boolean; parkingManagement: boolean; criticalReserve492: boolean; emergencyStockpile492: boolean;
}
export type PolState = Partial<Pol>;

// 53748：預設物件（欄位順序＝存檔裡的順序）
export function defaultPol(): Pol {
  return { taxR: 1, taxC: 1, taxI: 1, curfew: false, recycle: false, tourPromo: false, ecoReg: false, freeTransit: false, schoolLunch: false, smokeDetect: false, indSubsidy: false, nightMarket: false, parkNight: false, insurance: false,
    integratedTransit: false, housingSubsidy: false, inclusionaryHousing: false, stationHousing: false, waterConserve: false, reclaimPriority: false, industrialPretreat: false, spongeCity: false, infrastructureStimulus: false,
    consumptionSupport: false, industrialRelief: false, completeStreets: false, parkingManagement: false, criticalReserve492: false, emergencyStockpile492: false };
}
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

// 53748：沒有物件就建預設，有物件就把 undefined 的欄位補成預設（其他欄位原樣留著，包括目錄以外的）。回傳新物件，不動傳進來的
export function ensurePol(pol: PolState | null): PolState {
  const o: Record<string, unknown> = pol == null ? defaultPol() as unknown as Record<string, unknown> : { ...(pol as Record<string, unknown>) };
  for (const k of Object.keys(POLICY_CATALOG)) if (o[k] === undefined) o[k] = POLICY_CATALOG[k].type === 'tax' ? 1 : false;
  return o as PolState;
}

// 66975 讀檔：`if(d.pol)pol=d.pol`——實驗線把任何真值整個收下、下一天 pol.taxR.toFixed 丟例外；本線只收物件（非物件一律當沒有政策）——唯一的差。物件原樣留著（複製一份，不跟存檔物件共用）
export function polOfSave(raw: unknown): PolState | null {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } as PolState : null;
}

export interface PolicyEffects { coverage: boolean; sanitation: boolean; power: boolean }   // 53754：schoolLunch → rebuildCov；recycle → sanDirty445；ecoReg → markPowerDirty450（本線的清運與電力每天重算，只有教育場要在按下的當下重算）
export interface PolicyResult { ok: boolean; pol: PolState; last: Record<string, number>; effects: PolicyEffects }
const NO_EFFECT: PolicyEffects = { coverage: false, sanitation: false, power: false };

// 53749：冷卻（day − 最後一次套用的日子 ≥ 冷卻天數；沒套用過＝−999）
export function cooldownReady(last: Readonly<Record<string, number>>, day: number, k: string): boolean {
  if (!has(POLICY_CATALOG, k)) return false;
  return day - (last[k] ?? -999) >= POLICY_CATALOG[k].cooldown;
}
// 冷卻還剩幾天（介面用；0＝可以按）
export function cooldownLeft(last: Readonly<Record<string, number>>, day: number, k: string): number {
  if (!has(POLICY_CATALOG, k)) return 0;
  return Math.max(0, POLICY_CATALOG[k].cooldown - (day - (last[k] ?? -999)));
}

// 53750–53755 mayorPolicyApply470A（回退設定下玩家按鈕的直接路徑：policyApply504 → __noPolicy504 → 這一支，試行關掉）：
// 先補預設物件（就算這一次沒套用成功，物件也已經建出來——實驗線的行為）；不認得的鍵、冷卻沒到、同值都不動；稅率 clamp(round(v×10)/10, .5, 2)（0、NaN、空字串當 1）；開關轉布林
export function applyPolicy(pol0: PolState | null, last0: Readonly<Record<string, number>>, day: number, k: string, value: unknown): PolicyResult {
  const pol = ensurePol(pol0);
  if (!has(POLICY_CATALOG, k) || !cooldownReady(last0, day, k)) return { ok: false, pol, last: { ...last0 }, effects: NO_EFFECT };
  const cfg = POLICY_CATALOG[k], old = (pol as Record<string, unknown>)[k];
  const v = cfg.type === 'tax' ? clamp(Math.round((+(value as number) || 1) * 10) / 10, .5, 2) : !!value;
  if (old === v) return { ok: false, pol, last: { ...last0 }, effects: NO_EFFECT };
  (pol as Record<string, unknown>)[k] = v;
  return { ok: true, pol, last: { ...last0, [k]: day }, effects: { coverage: k === 'schoolLunch', sanitation: k === 'recycle', power: k === 'ecoReg' } };
}

// 65792 稅率按鈕（polStep 的 d*.1）與 65800 預算按鈕（budStep 的 d*.1）的一格
export const TAX_STEP = .1;
export const BUDGET_STEP = .1;
// 65792 稅率按鈕：倍率 ± 一格（範圍 .5–2，取到小數兩位），再交給 applyPolicy（取整到 .1）
export const stepTax = (cur: number, dir: number): number => Math.max(.5, Math.min(2, Math.round((cur + dir * TAX_STEP) * 100) / 100));

// 52968–52973 setSvcBudget：夾 .5–1.5、toFixed(2)；不認得的類別原樣回傳。改完要 rebuildCov（呼叫端）。沒有冷卻
export function stepBudget(b: SvcBudget, cat: string, delta: number): SvcBudget {
  if (!has(b, cat)) return b;
  return { ...b, [cat]: clamp(+((b as unknown as Record<string, number>)[cat] + delta).toFixed(2), .5, 1.5) } as SvcBudget;
}

// 55257：回收宣導的垃圾乘數
export const recycleMulOf = (pol: PolState | null): number => (pol && pol.recycle ? .85 : 1);
// 53047：災害保險——每戶被毀的建築理賠 $35（一棟一棟加，跟實驗線逐次 money+=35 的浮點順序一樣）；沒投保＝不理賠
export const INSURANCE_PAYOUT = 35;
export const INSURANCE_TOAST = '🛡️ 災害保險理賠 +$35／戶';   // 53050：同一天只提示一次（介面用；實驗線的 insToastDay 是執行時變數，不入存檔）
export const insuredOf = (pol: PolState | null): boolean => !!(pol && pol.insurance);

// 介面用：每個政策的法規日費（55972，跟 money.ts 的 upRegOf 一致；守衛核對）與介面給開的 11 個（本線有效果的；其餘 15 個沒有對應的系統，存讀照舊、日費照付，介面不給開——免費公交也在內：它的效果要有公車站〔COV.bus＞0 的幸福項、票收入〕，本線沒有公車與票務，按了不會有任何變化）
export const POLICY_FEE: Readonly<Record<string, number>> = { recycle: 8, tourPromo: 10, schoolLunch: 12, smokeDetect: 6, parkNight: 5, insurance: 18, emergencyStockpile492: 8 };
export const POLICY_SHOWN = { law: ['curfew', 'recycle', 'tourPromo', 'ecoReg'], policy: ['schoolLunch', 'smokeDetect', 'indSubsidy', 'nightMarket', 'parkNight', 'insurance', 'emergencyStockpile492'] } as const;
export const BUDGET_CATS: readonly { id: keyof SvcBudget; nm: string }[] = [{ id: 'police', nm: '警察' }, { id: 'fire', nm: '消防' }, { id: 'health', nm: '醫療' }, { id: 'edu', nm: '教育' }];
