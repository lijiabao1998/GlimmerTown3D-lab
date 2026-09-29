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
export const CITY_FORMAT = 5;
// 存檔寫的格式看歷史裡有什麼（D019）：有鋪水管、拆水管的事件才寫 5，沒有就寫 4——比這一版舊的程式（認到 4）照樣讀得回來，
// 沒有水管的城存出來的碼跟 D018 以前逐位元組相同（實驗線讀回的黃金樣本照樣適用）。讀檔照舊認 1..CITY_FORMAT
export const eventFormat = (e: CityEvent) => e.t === 'pipe' || (e.t === 'doze' && e.layer === 'wp') ? 5 : 4;

// 體育場（k 9）的大小存在建築那筆的第 6 位（實驗線 load 66900），沒有就是 2。實驗線只會放 2×2（51728），
// 手改的碼可能寫任何數：夾在 1–4（D012 審查：一串互相重疊的大體育場會讓讀檔配出 n³ 個附屬格，1000×1000 約要 50 秒）
export const stadiumSize = (v: unknown) => { const s = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0; return s ? Math.min(4, Math.max(1, s)) : 2; };

export interface KindTable {
  size(k: number): number;      // 佔地邊長（格）
  known(k: number): boolean;    // 實驗線有沒有這個種類
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
export interface DozeEvent { day: number; t: 'doze'; x: number; z: number; layer: 'bld' | 'road' | 'zone' | 'tree' | 'wp'; k?: number; id?: number; cost: number; g: number }
// 鋪配水管（D019，實驗線 51679 t.wp＝1）：一格一筆；水管不清樹、不清分區，可以鋪在路、建築底下
export interface PipeEvent { day: number; t: 'pipe'; x: number; z: number; cost: number; g: number }
// 復原（D011）：把第 g 筆手勢碰過的格子整格還原、退回花的錢（實驗線 T460 undo 66594）；只能在同一天
export interface UndoEvent { day: number; t: 'undo'; g: number; refund: number }
export type EditEvent = RoadEvent | ZoneEvent | PlaceEvent | DozeEvent | PipeEvent | UndoEvent;
// 讀檔時照實驗線重挑外觀（D012，T531）：一棟一筆、只記換了的；x、z 是根格，v 是新的變體。不是施工，不能復原
export interface RestyleEvent { day: number; t: 'restyle'; x: number; z: number; v: number }
export type CityEvent = ImportEvent | GrowEvent | EditEvent | RestyleEvent;

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
    tram: layer(L.tr, nn, digit), dock: layer(L.dk, nn, digit), fly: layer(L.fly475, nn, digit), wp: layer(L.wp, nn, digit),
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
