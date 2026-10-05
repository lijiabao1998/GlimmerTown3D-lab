// 城市模型（D003）：從 2D 實驗線的存檔建出本線的城市。純邏輯，不碰 DOM 與 three（CLAUDE.md 規則 2），Node 可直接跑。
// 佔地規則照實驗線 load（index.html:66900–66912、67016–67026 @d23c18d）：多格建築是以根格為左上角的 s×s 正方形，
// s＝MSZ[k]；體育場 k=9 例外，s 取建築那筆的第 6 位（缺就是 2；D012 起夾在 1–4，見 stadiumSize）。
// 世界歷史（規則 4）：匯入記成第一筆事件；2D 存檔沒有歷史，只有每棟的 age（每個模擬日 +1，施工用鋼材會加速，實驗線 55632／55671），
// 所以「約建於第幾天」＝匯入時的 day − age，只是估計。
import type { LabSave } from '../io/labcode.ts';
import { fnv1a } from './rng.ts';

// 格式 2（D010）：世界歷史多了逐日模擬的「生長」「升級」事件。格式 1 只有匯入那一筆，照讀（src/sim/replay.ts）
// 格式 3（D011）：多了玩家施工的事件——鋪路、劃區、放建築、拆除、復原（每一格一筆；g＝同一筆手勢）。格式 1、2 照讀
// 格式 4（D012）：多了讀檔時照實驗線重挑外觀的事件 restyle（src/sim/restyle.ts）。格式 1–3 照讀
// 格式 5（D019）：多了鋪配水管的事件 pipe，拆除多了水管那一層（layer 'wp'）。格式 1–4 照讀；比 5 新的不猜（src/io/save.ts）
// 格式 6（D026）：多了每天的災禍與玩家的處置——起火 fire、燒毀 burn、犯罪 crime、廢棄 abandon、生病 sick、死亡 death、處置 act（滅火、處理犯罪、治療），拆除多了焦土那一層（layer 'ruin'）。格式 1–5 照讀；比 6 新的不猜
// 格式 7（D034）：多了合併事件 merge——四棟相鄰同類二級以上住宅或商業合併成 2×2 摩天樓（k33、k34），更快樂的城九格合併成 3×3 巨廈（k105、k106）；吸收的建築成了墓碑。格式 1–6 照讀
// 格式 9（D040）：多了資源耗盡事件 depleted——油井、礦場的耗損累積到 240（一口井只記一次）。格式 1–8 照讀
// 格式 8（D039）：多了玩家決策與科技完成——政策 policy、服務預算 budget、開始研究 research、選城市方向 spec、研究完成 techdone；沒有座標，是整座城的事（碼表在下面，只往後加）。格式 1–7 照讀
export const CITY_FORMAT = 9;
// 存檔寫的格式看歷史裡有什麼（D019、D026）：有災禍事件、拆焦土才寫 6；有鋪水管、拆水管的事件寫 5；都沒有就寫 4——比這一版舊的程式（認到 4 或 5）照樣讀得回來，
// 沒有水管、沒有災禍的城存出來的碼跟 D018 以前逐位元組相同（實驗線讀回的黃金樣本照樣適用）。讀檔照舊認 1..CITY_FORMAT
export const eventFormat = (e: CityEvent) => e.t === 'depleted' ? 9 : DECISION_EVENTS.includes(e.t) ? 8 : e.t === 'merge' ? 7 : HAZARD_EVENTS.includes(e.t) || (e.t === 'doze' && e.layer === 'ruin') ? 6 : e.t === 'pipe' || (e.t === 'doze' && e.layer === 'wp') ? 5 : 4;
export const DECISION_EVENTS: readonly string[] = ['policy', 'budget', 'research', 'spec', 'techdone'];
export const HAZARD_EVENTS: readonly string[] = ['fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act'];

// 體育場（k 9）的大小存在建築那筆的第 6 位（實驗線 load 66900），沒有就是 2。實驗線只會放 2×2（51728），
// 手改的碼可能寫任何數：夾在 1–4（D012 審查：一串互相重疊的大體育場會讓讀檔配出 n³ 個附屬格，1000×1000 約要 50 秒）
export const stadiumSize = (v: unknown) => { const s = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0; return s ? Math.min(4, Math.max(1, s)) : 2; };

export interface KindTable {
  size(k: number): number;      // 佔地邊長（格）
  known(k: number): boolean;    // 實驗線有沒有這個種類
  cat(k: number): string;       // 類別字母（實驗線 kcatOf 37275：R 住宅、C 商業、I 工業、E 能源、S 市政治安、H 醫療、D 教育、T 交通、A 文化觀光、F 農業食品、G 綠地、W 環衛）；D029 夜間城市的輸入分類
}

export interface CityBuilding {
  id: number;                   // 1 起算；occ 裡存的就是它
  k: number; lv: number; v: number; age: number;
  x: number; z: number; size: number;
  abandoned: boolean;
  builtDay: number;             // 估計：匯入時的 day − age
  goneDay?: number;             // D011：拆掉（或當天復原掉）的那一天；墓碑保留編號，不從清單刪（id 就是索引）
}

export interface ImportEvent { day: number; t: 'import'; source: string; gameVer: string; seed: number; codeHash: string; buildings: number }
// 逐日模擬（D010）：住商工長出來（lv 1）、升一級；x、z 是根格，v 是當下挑的變體。只增不改（規則 4）
export interface GrowEvent { day: number; t: 'grow' | 'upgrade'; x: number; z: number; k: number; lv: number; v: number }
// 玩家施工（D011）：一格一筆，陣列順序就是發生順序（同一天的施工在那天的生長之後）。cost＝這一格實際扣的錢（沙盒 0）；g＝同一筆手勢的編號
export interface RoadEvent { day: number; t: 'road'; x: number; z: number; rc: number; cost: number; g: number }
export interface ZoneEvent { day: number; t: 'zone'; x: number; z: number; zone: number; cost: number; g: number }
export interface PlaceEvent { day: number; t: 'place'; x: number; z: number; k: number; lv: number; v: number; id: number; cost: number; g: number }
export interface DozeEvent { day: number; t: 'doze'; x: number; z: number; layer: 'bld' | 'road' | 'zone' | 'tree' | 'wp' | 'ruin'; k?: number; id?: number; cost: number; g: number }   // ruin（D026）：拆焦土＝ruin 清掉、分區一起清掉（51777）
// 鋪配水管（D019，實驗線 51679 t.wp＝1）：一格一筆；水管不清樹、不清分區，可以鋪在路、建築底下
export interface PipeEvent { day: number; t: 'pipe'; x: number; z: number; cost: number; g: number }
// 復原（D011）：把第 g 筆手勢碰過的格子整格還原、退回花的錢（實驗線 T460 undo 66594）；只能在同一天
export interface UndoEvent { day: number; t: 'undo'; g: number; refund: number }
export type EditEvent = RoadEvent | ZoneEvent | PlaceEvent | DozeEvent | PipeEvent | UndoEvent;
// 讀檔時照實驗線重挑外觀（D012，T531）：一棟一筆、只記換了的；x、z 是根格，v 是新的變體。不是施工，不能復原
export interface RestyleEvent { day: number; t: 'restyle'; x: number; z: number; v: number }
// 每天的災禍（D026，實驗線 55757–55865）：x、z 是根格，k 是當時的種類。起火（含蔓延）、燒毀成焦土（建築成了墓碑、格子多一個 ruin）、犯罪、因犯罪滿 15 天而廢棄（建築 abandoned）、
// 生病、死亡（住宅）。醫療覆蓋的自動治癒、死亡十天後的恢復、犯罪被警察覆蓋不算——沒有記（不改城市的樣子）。只增不改（規則 4）
export interface FireEvent { day: number; t: 'fire'; x: number; z: number; k: number }
export interface BurnEvent { day: number; t: 'burn'; x: number; z: number; k: number; id: number }
export interface CrimeEvent { day: number; t: 'crime'; x: number; z: number; k: number }
export interface AbandonEvent { day: number; t: 'abandon'; x: number; z: number; k: number; id: number }
export interface SickEvent { day: number; t: 'sick'; x: number; z: number }
export interface DeathEvent { day: number; t: 'death'; x: number; z: number }
// 玩家在建築卡上的處置（63426–63446）：滅火 $30、處理犯罪（免費）、治療 $50。不是施工，不能復原
export type ActKind = 'fire' | 'crime' | 'sick';
export const ACT_CODES: readonly ActKind[] = ['fire', 'crime', 'sick'];   // 緊湊列的動作碼：0 滅火、1 處理犯罪、2 治療（只往後加）
export interface ActEvent { day: number; t: 'act'; x: number; z: number; what: ActKind; cost: number }
export type HazardEvent = FireEvent | BurnEvent | CrimeEvent | AbandonEvent | SickEvent | DeathEvent | ActEvent;
// 合併（D034，實驗線 55688–55756）：x、z＝新建築的根格（左上角）、k＝33／34（2×2 塔）或 105／106（3×3 巨廈）、size＝邊長、v＝變體；from＝被吸收的建築編號（含公園；每一棟都是 1×1），
// 都成了墓碑（goneDay＝這一天）；巨廈另外清掉九格的分區。新建築的編號＝建築清單長度 + 1。只增不改（規則 4）
export interface MergeEvent { day: number; t: 'merge'; x: number; z: number; k: number; size: number; v: number; from: number[] }
export const MERGE_SIZE: Readonly<Record<number, number>> = { 33: 2, 34: 2, 105: 3, 106: 3 };
// 玩家的決策與科技完成（D039，城市格式 8）。沒有座標：整座城的事。只增不改（規則 4）。
// 碼表是寫死的字面量（緊湊列存的是碼）：**只往後加，既有的號不改**；守衛核對它們跟政策目錄、預算類別、科技表、專精表現在的順序一致
export const POLICY_CODES: readonly string[] = ['taxR', 'taxC', 'taxI', 'curfew', 'recycle', 'tourPromo', 'ecoReg', 'freeTransit', 'schoolLunch', 'smokeDetect', 'indSubsidy', 'nightMarket', 'parkNight', 'insurance', 'integratedTransit', 'housingSubsidy', 'inclusionaryHousing', 'stationHousing', 'waterConserve', 'reclaimPriority', 'industrialPretreat', 'spongeCity', 'infrastructureStimulus', 'consumptionSupport', 'industrialRelief', 'completeStreets', 'parkingManagement', 'criticalReserve492', 'emergencyStockpile492'];
export const BUDGET_CODES: readonly string[] = ['police', 'fire', 'health', 'edu'];
export const TECH_CODES: readonly string[] = ['A1', 'A2', 'A3', 'A4a', 'A4b', 'A5', 'A6', 'A7', 'A8', 'B1', 'B2', 'B3', 'B4a', 'B4b', 'B5', 'B6', 'B7', 'B8', 'C1', 'C2', 'C3', 'C4a', 'C4b', 'C5', 'C6', 'C7', 'C8', 'D1', 'D2', 'D3', 'D4a', 'D4b', 'D5', 'D6', 'D7', 'D8'];
export const SPEC_CODES: readonly string[] = ['ind', 'green', 'edu', 'hub'];
// 政策或稅率真的改了：稅率值 .5–2（一位小數）；開關 1＝開、0＝關。冷卻中、同值不記；from＝改之前的值
export interface PolicyEvent { day: number; t: 'policy'; key: string; from: number; value: number }   // from＝改之前的值（歷史不靠起點也讀得出「從多少調到多少」）
// 服務預算真的改了：值 .5–1.5（兩位小數）
export interface BudgetEvent { day: number; t: 'budget'; cat: string; from: number; value: number }
// 開始研究：fee＝這一次扣的錢（已有進度的免費、沙盒免費＝0）；再按正在做的節點不記
export interface ResearchEvent { day: number; t: 'research'; id: string; fee: number }
// 選定城市方向（永久、一生一次）
export interface SpecEvent { day: number; t: 'spec'; id: string }
// 研究完成（每天研究推進的結果，不是玩家按的）
export interface TechDoneEvent { day: number; t: 'techdone'; id: string }
export type DecisionEvent = PolicyEvent | BudgetEvent | ResearchEvent | SpecEvent | TechDoneEvent;
// 資源耗盡（D040，城市格式 9）：x、z＝井的格子，k＝49（油井）或 50（礦場）。一口井一生只有一筆（耗損不會下降）；讀進來就已經耗盡的井沒有事件
export interface DepletedEvent { day: number; t: 'depleted'; x: number; z: number; k: number }
export type CityEvent = ImportEvent | GrowEvent | EditEvent | RestyleEvent | HazardEvent | MergeEvent | DecisionEvent | DepletedEvent;

export interface City {
  format: number;
  n: number; name: string; day: number; seed: number; gameVer: string;
  // 逐格圖層：索引 z*n+x（實驗線的 y 對到本線的 z）
  ter: Uint8Array;              // 0 水、1 沙、2 草（實驗線 genWorld）
  tree: Uint8Array;             // 樹種，0＝沒有
  road: Uint8Array;             // 0 無、1 路、2 橋、3 高速、4 高速橋（實驗線 save 66717）
  rclass: Uint8Array;           // 道路等級
  zone: Uint8Array;             // 0 無、1 住、2 商、3 工
  el: Uint8Array;               // 高地
  rail: Uint8Array; railBridge: Uint8Array; tram: Uint8Array; dock: Uint8Array; fly: Uint8Array;
  wp: Uint8Array;               // D019：配水管（實驗線存檔的 wp 圖層，0／1）
  ruin: Uint8Array;             // D026：焦土（實驗線存檔的 rn 圖層，0／1）：燒毀的建築留下的地，分區還在、要先拆掉才能再蓋
  occ: Int32Array;              // 建築 id，0＝空
  buildings: CityBuilding[];
  issues: { overlap: number; outOfMap: number; unknownKinds: number[] };
  history: CityEvent[];
}

const layer = (s: string | undefined, nn: number, dec: (c: number) => number) => {
  const a = new Uint8Array(nn);
  if (s) for (let i = 0; i < nn; i++) a[i] = dec(s.charCodeAt(i));
  return a;
};
const digit = (c: number) => (c >= 48 && c <= 57 ? c - 48 : 0);
const code48 = (c: number) => Math.max(0, c - 48);   // 實驗線 tre／rcl 用字元碼 −48（可以超過 9，例如 ':'＝10）

export function cityFromLab(save: LabSave, kinds: KindTable, code: string): City {
  const n = save.n, nn = n * n, L = save.layers;
  const c: City = {
    format: CITY_FORMAT, n, name: save.nm || '（沒有名字的城市）', day: save.day, seed: save.seed, gameVer: save.gameVer,
    ter: layer(L.ter, nn, digit), tree: layer(L.tre, nn, code48), road: layer(L.rd, nn, digit), rclass: layer(L.rcl, nn, code48),
    zone: layer(L.zn, nn, digit), el: layer(L.el, nn, digit), rail: layer(L.rl, nn, digit), railBridge: layer(L.rb, nn, digit),
    tram: layer(L.tr, nn, digit), dock: layer(L.dk, nn, digit), fly: layer(L.fly475, nn, digit), wp: layer(L.wp, nn, digit), ruin: layer(L.rn, nn, digit),
    occ: new Int32Array(nn), buildings: [], issues: { overlap: 0, outOfMap: 0, unknownKinds: [] },
    history: [],
  };
  const ab = L.ab, unknown = new Set<number>();
  for (const r of save.bl) {
    const [i, k, lv, v, age] = r;
    const x = i % n, z = (i / n) | 0;
    if (!kinds.known(k)) unknown.add(k);
    const size = k === 9 ? stadiumSize(r[5]) : kinds.size(k);
    const b: CityBuilding = {
      id: c.buildings.length + 1, k, lv, v, age, x, z, size,
      abandoned: k <= 3 && !!ab && ab.charCodeAt(i) === 49,   // 實驗線只把住商工的 ab 還原成廢棄（load 66921）
      builtDay: save.day - age,
    };
    c.buildings.push(b);
    for (let dz = 0; dz < size; dz++) for (let dx = 0; dx < size; dx++) {
      const tx = x + dx, tz = z + dz;
      if (tx >= n || tz >= n) { c.issues.outOfMap++; continue; }
      const j = tz * n + tx;
      if (c.occ[j]) { c.issues.overlap++; continue; }
      c.occ[j] = b.id;
    }
  }
  c.issues.unknownKinds = [...unknown].sort((a, b) => a - b);
  c.history.push({ day: save.day, t: 'import', source: 'GlimmerTown-lab', gameVer: save.gameVer, seed: save.seed, codeHash: fnv1a(code), buildings: c.buildings.length });
  return c;
}

// 對帳數字：格式跟 tools/lab-extract.mjs 在實驗線執行期量的 expect 完全一樣，才能逐項比
export function cityStats(c: City) {
  const nn = c.n * c.n;
  const live = c.buildings.filter(b => b.goneDay === undefined);   // D011：墓碑不算（實驗線沒有拆掉的建築這回事）
  const s = { n: c.n, ter: [0, 0, 0, 0], road: [0, 0, 0, 0, 0], zone: [0, 0, 0, 0], trees: 0, el: 0, rail: 0, tram: 0, dock: 0, abandoned: 0,
    kinds: {} as Record<string, number>, buildings: live.length, roots: [] as number[][] };
  for (let i = 0; i < nn; i++) {
    s.ter[c.ter[i]]++; s.road[c.road[i]]++; s.zone[c.zone[i]]++;
    if (c.tree[i]) s.trees++; if (c.el[i]) s.el++; if (c.rail[i]) s.rail++; if (c.tram[i]) s.tram++; if (c.dock[i]) s.dock++;
  }
  // 根格照格索引排序（實驗線是逐格掃描，順序就是格索引）；佔地格數＝實際落在地圖裡、沒被別棟先佔的格
  const cells = new Map<number, number>();
  for (let i = 0; i < nn; i++) if (c.occ[i]) cells.set(c.occ[i], (cells.get(c.occ[i]) || 0) + 1);
  for (const b of [...live].sort((a, b) => (a.z * c.n + a.x) - (b.z * c.n + b.x))) {
    s.kinds[b.k] = (s.kinds[b.k] || 0) + 1;
    if (b.abandoned) s.abandoned++;
    s.roots.push([b.z * c.n + b.x, b.k, b.lv, b.age, cells.get(b.id) || 0]);
  }
  return s;
}

export const buildingAt = (c: City, x: number, z: number): CityBuilding | null =>
  x < 0 || z < 0 || x >= c.n || z >= c.n ? null : c.buildings[c.occ[z * c.n + x] - 1] ?? null;

// 還在的建築（D011 起有墓碑：拆掉的留在清單裡、occ 已清空）
export const liveBuildings = (c: City) => c.buildings.filter(b => b.goneDay === undefined);

// 路圖層的編碼（實驗線 save 66717）：0 無、1 路、2 橋、3 高速、4 高速橋
export const roadCode = (road: unknown, hw: unknown, bridge: unknown) => road ? (hw ? (bridge ? 4 : 3) : (bridge ? 2 : 1)) : 0;
