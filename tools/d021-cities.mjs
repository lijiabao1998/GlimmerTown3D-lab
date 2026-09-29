// D021 對拍用的「自己造的城」：用本線的 encodeLabCode 生分享碼，匯入實驗線頁面、讀檔後量一次人口、推進一天再量一次（tools/d021-lab.mjs 錄、tools/unit-d021.mjs 比）。
// 做法與地圖搬自 D020 的平行實作（備份在 1938332 的 tools/d020-cities.mjs）：72×72 的平地，沒有分區＝不會長新房子，兩邊推進之後的建築完全一樣；
// 每座城一張碼：路、發電廠、住宅（等級、密度）、工業、商業、處理設施、社宅、水塔與配水管。這一張多了住宅塔與巨廈（T 系列，塔與巨廈的居民不看有沒有電）。
// 全部用固定種子的 mulberry32（本線 src/sim/rng.ts）與座標算出來，沒有 Math.random、現實時間。
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { mulberry32 } from '../src/sim/rng.ts';

export const N21 = 72;
const SIZE = { 62: 2, 111: 2, 33: 2, 34: 2, 105: 3, 106: 3, 127: 2 };   // 多格建築佔地（其餘 1×1）；本線內容表 src/content/lab-kinds.json。只是這裡排版檢查用，存檔只記根格，讀檔照內容表補 ref 格
export const FAC_K = [8, 29, 62, 88, 111];
const DEN_POP = [.70, .85, 1.00, 1.25, 1.60], POPS = [0, 8, 22, 54];

// 一座城的組裝器：template＝新城碼解出來的整份存檔 JSON（欄位齊全，實驗線讀得進來）；地形換成整張草地、沒有樹、沒有分區
export function builder(template) {
  const nn = N21 * N21, road = new Uint8Array(nn), rcl = new Uint8Array(nn), occ = new Uint8Array(nn), wp = new Uint8Array(nn), bl = [];
  const inMap = (x, z) => x >= 0 && z >= 0 && x < N21 && z < N21, at = (x, z) => z * N21 + x;
  const b = {
    bl, occ, at, inMap,
    isFree: (x, z, sz = 1) => { for (let dz = 0; dz < sz; dz++) for (let dx = 0; dx < sz; dx++) if (!inMap(x + dx, z + dz) || occ[at(x + dx, z + dz)]) return false; return true; },
    // 路：直線（同一列或同一行），rc＝道路等級（2 支路）
    road(x0, z0, x1, z1, rc = 2) {
      if (x0 !== x1 && z0 !== z1) throw new Error('road：只拉直線');
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        if (!inMap(x, z)) throw new Error(`road：(${x},${z}) 出界`);
        const i = at(x, z); if (occ[i] === 2) throw new Error(`road：(${x},${z}) 有建築`);
        road[i] = 1; rcl[i] = rc; occ[i] = 1;
      }
      return b;
    },
    // 配水管（wp 圖層，D019）：直線，拉在沒有路、沒有建築的空格上
    pipe(x0, z0, x1, z1) {
      if (x0 !== x1 && z0 !== z1) throw new Error('pipe：只拉直線');
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        if (!inMap(x, z) || occ[at(x, z)]) throw new Error(`pipe：(${x},${z}) 出界或被佔用`);
        wp[at(x, z)] = 1;
      }
      return b;
    },
    // 建築：住宅 k1 帶密度 den 與財富 we（存檔列 [i,k,lv,v,age,fire,den,we]），其餘 [i,k,lv,v,age]；多格的只記根格（讀檔補 ref 格）
    put(x, z, k, lv = 1, o = {}) {
      const sz = SIZE[k] ?? 1;
      if (!b.isFree(x, z, sz)) throw new Error(`put k${k}：(${x},${z}) 被佔用或出界`);
      for (let dz = 0; dz < sz; dz++) for (let dx = 0; dx < sz; dx++) occ[at(x + dx, z + dz)] = 2;
      bl.push(k === 1 ? [at(x, z), 1, lv, o.v ?? 0, o.age ?? 20, 0, o.den ?? 3, o.we ?? 1] : [at(x, z), k, lv, o.v ?? 0, o.age ?? 20]);
      return b;
    },
    // 一排：同一列 z 從 x0 到 x1（step 格一棟）都放同一種
    row(x0, x1, z, k, lv, o = {}, step = 1) { for (let x = x0; x <= x1; x += step) b.put(x, z, k, lv, o); return b; },
    code(seed = 5162026, day = 1, name = '清運') {
      const s2 = '2'.repeat(nn), z0 = '0'.repeat(nn);
      const o = { ...template, seed, day, money: 3000, nm: name, ter: s2, tre: z0, el: z0, zn: z0, wp: [...wp].join(''),
        rd: [...road].join(''), rcl: [...rcl].map(v => v ? String.fromCharCode(48 + v) : '0').join(''),
        bl: [...bl].sort((p, q) => p[0] - q[0]) };
      delete o.z; delete o.d3;
      return encodeLabCode(o, { deflate: true });
    },
  };
  return b;
}
// 這一格的住宅人口（根據等級、密度）：只給說明、驗算用
export const homePop = (lv, den = 3) => Math.round(POPS[lv] * DEN_POP[den - 1]);

// 每座城：{ id, kind:'formal'|'small'|'random', note, build(b) }。build 只用座標，不用亂數（random 那幾座用 mulberry32 自己的種子）
export const CITY_DEFS = [
  // ---- 500 人以上：正式清運 ----
  { id: 'F1', note: '單一路網、一座垃圾場夠用（負載 < 1）；有黃色距離（13–18 格）與太遠（> 18）的住宅', build: b => {
    b.road(8, 30, 56, 30).put(7, 30, 5).put(26, 29, 8);
    b.row(10, 21, 29, 1, 3, { den: 3 }).row(52, 56, 31, 1, 1);
  } },
  { id: 'F2', note: '超載：一座垃圾場（容量 40）、住宅垃圾 51.6（負載 1.29），全區住宅扣 (負載−1)×.15', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(24, 29, 8);
    b.row(10, 21, 29, 1, 3, { den: 5 });
  } },
  { id: 'F2c', note: '超載到比例夾在 2：21 棟高密度住宅 1806 人（垃圾 90.3、負載 2.26），一座垃圾場', build: b => {
    b.road(6, 30, 34, 30).put(5, 30, 5).put(20, 31, 8);
    b.row(8, 28, 29, 1, 3, { den: 5 });
  } },
  { id: 'F3', note: '兩張斷開的路網各有各的設施：A 網一座垃圾場超載（1.29）、B 網一座焚化廠（容量 100）閒置；評分看最壞的一區', build: b => {
    b.road(8, 15, 40, 15).put(7, 15, 5).put(20, 14, 8).row(22, 33, 14, 1, 3, { den: 5 });
    b.road(8, 50, 40, 50).put(7, 50, 5).put(20, 48, 62).row(24, 33, 49, 1, 3, { den: 3 });
  } },
  { id: 'F4', note: '死路網：B 網有發電廠、有人住、沒有處理設施（整區沒容量、住宅 −.06、評分的比例 2）；另有一座離線的垃圾場；A 網正常', build: b => {
    b.road(8, 15, 40, 15).put(7, 15, 5).put(20, 14, 8).row(22, 31, 14, 1, 3);
    b.road(8, 50, 30, 50).put(7, 50, 5).row(10, 20, 49, 1, 3).put(16, 46, 8);
  } },
  { id: 'F5', note: '接不到路的住宅：兩排之外的住宅有電（路在兩格內）但四鄰沒有路（沒有路：−.06、垃圾記在沒路的那一筆）；全城比例 > 1、沒有超載的區', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(24, 29, 8);
    b.row(10, 20, 29, 1, 3).row(10, 14, 28, 1, 3);
  } },
  { id: 'F6', note: '五種處理設施：垃圾場、回收中心（30）、堆肥場（60）、資源回收廠（2×2、40）在路邊上線，另一座垃圾場離線；多源 BFS 有平手', build: b => {
    b.road(8, 30, 56, 30).put(7, 30, 5);
    b.put(16, 29, 8).put(30, 29, 29).put(40, 29, 88).put(46, 28, 111).put(20, 20, 8);
    b.row(10, 24, 31, 1, 3);
  } },
  { id: 'F7', note: '焚化廠（2×2）貼著兩段斷開的路（西段、東段）：場內動線互通、合併成同一區、容量 100 兩段共用；焚化廠自己發電給兩段', build: b => {
    b.road(8, 30, 19, 30).road(22, 30, 35, 30).put(20, 30, 62);
    b.row(9, 18, 29, 1, 3).row(23, 34, 29, 1, 3);
  } },
  { id: 'F8', note: '長距離：一條長路、一座垃圾場，住宅離它 2、10、12、13（黃）、17、18（黃）、19（太遠）、20……50 格', build: b => {
    b.road(4, 36, 67, 36).put(3, 36, 5).put(10, 35, 8);
    for (const x of [12, 13, 20, 22, 23, 27, 28, 29, 30, 40, 50, 60]) b.put(x, 37, 1, 3, { den: 4 });
  } },
  { id: 'F9', note: '平手：兩條平行的路（A 網 z=20、B 網 z=22，斷開）各一座垃圾場、等距，一排住宅夾在中間、同時貼兩區——挑區號小的；B 網往東再往北拉到最上面，所以 B 是 0 區、A 是 1 區（區號的順序跟路格索引的順序相反：B 超載、A 閒置）', build: b => {
    b.road(8, 20, 30, 20).road(8, 22, 33, 22).road(33, 5, 33, 21).put(7, 20, 8).put(7, 22, 8).put(31, 20, 5).put(8, 23, 5);
    b.row(10, 29, 21, 1, 3).row(10, 13, 19, 1, 3).row(10, 13, 23, 1, 3);
  } },
  { id: 'F10', note: '工業與商業：兩座設施（垃圾場、焚化廠）分擔；有電的工業算垃圾（就業×.08）、商業不算', build: b => {
    b.road(8, 30, 50, 30).put(7, 30, 5).put(51, 30, 5).put(12, 29, 8).put(30, 28, 62);
    b.row(10, 30, 31, 1, 2, { den: 4 }).row(14, 24, 29, 3, 3).row(32, 40, 31, 2, 2);
  } },
  { id: 'F11', note: '完全沒有處理設施的正式城：整個路網容量 0、負載無限大、每棟 −.06、評分的比例 2', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5);
    b.row(10, 21, 29, 1, 3);
  } },
  { id: 'F12', note: '一張 L 形路網、三座設施（垃圾場與回收中心共用同一格路邊：距離 0 的平手靠先來的；另一座回收中心在遠端，同一區）；轉角的住宅貼兩格同區的路、挑距離近的', build: b => {
    b.road(8, 12, 30, 12).road(30, 13, 30, 26).put(7, 12, 5).put(8, 11, 8).put(8, 13, 29).put(31, 26, 29);
    b.row(10, 28, 11, 1, 3).put(29, 13, 1, 3).put(29, 14, 1, 3).put(29, 15, 1, 3);
    for (let z = 14; z <= 24; z++) b.put(31, z, 1, 3);
  } },
  { id: 'B500', note: '剛好 500 人（門檻 pop ≥ 500）：正式清運', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(24, 29, 8);
    b.row(10, 18, 29, 1, 3).put(19, 29, 1, 1, { den: 1 }).put(20, 29, 1, 1, { den: 3 });
  } },
  { id: 'B499', kind: 'small', note: '499 人：500 人前的舊分支（同一份配置只差 1 人）', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(24, 29, 8);
    b.row(10, 18, 29, 1, 3).put(19, 29, 1, 1, { den: 1 }).put(20, 29, 1, 1, { den: 2 });
  } },
  { id: 'F13', kind: 'small', note: '社會住宅（k127，2×2，76 人）沒有水：實驗線讀檔時 wa 沒設、k127 要電也要水才算人口＝讀檔後 pop 只有 8 棟 Lv3（432），推進時也是 432（500 人前）', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(24, 29, 8);
    b.row(10, 17, 29, 1, 3).put(10, 31, 127).put(13, 31, 127).put(16, 31, 127);
  } },
  { id: 'F14', note: '社會住宅有水（水塔＋配水管）：讀檔後 pop 432（讀檔時 wa 沒設）、推進時 3 棟社宅各 76 人進來＝660（正式清運）；社宅的垃圾量（人口×.05）與清運客戶（k127）都算', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(24, 29, 8);
    b.row(10, 17, 29, 1, 3).put(10, 31, 127).put(13, 31, 127).put(16, 31, 127);
    b.pipe(8, 33, 20, 33).put(7, 33, 10);
  } },
  // ---- 500 人以下：舊分支 ----
  { id: 'S1', kind: 'small', note: '小城：一座接路的垃圾場、全容量、離垃圾場道路距離 > 18 的住宅 −.045（只有那些；距離剛好 18 不扣、19 扣）', build: b => {
    b.road(8, 30, 48, 30).put(7, 30, 5).put(14, 29, 8);
    b.row(16, 23, 29, 1, 3).put(46, 31, 1, 1).put(32, 31, 1, 1).put(33, 31, 1, 1);
  } },
  { id: 'S2', kind: 'small', note: '小城：只有回收中心（容量 30；小城照算容量，卻不是距離的來源）、垃圾 > 容量（比例 1.57，全城池扣 (比例−1)×.15）；全部住宅 −.045', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(20, 29, 29);
    b.row(10, 18, 29, 1, 3).row(24, 29, 31, 3, 3);
  } },
  { id: 'S3', kind: 'small', note: '小城：垃圾多到比例夾在 2（容量 30、垃圾 62）', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(20, 29, 29);
    b.row(10, 18, 29, 1, 3).row(20, 29, 31, 3, 3);
  } },
  { id: 'S4', kind: 'small', note: '小城：垃圾場離線（沒接路）、容量照算、沒有距離的來源＝所有住宅 −.045', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(20, 20, 8);
    b.row(10, 18, 29, 1, 3);
  } },
  { id: 'S6', kind: 'small', note: '人口 44（< 50 不評分）：垃圾場接路、住宅在近處', build: b => {
    b.road(8, 30, 30, 30).put(7, 30, 5).put(14, 29, 8).put(10, 29, 1, 2).put(11, 29, 1, 2);
  } },
  { id: 'S5', kind: 'small', note: '小城：焚化廠（2×2）貼著兩段路，兩邊的住宅離它的距離不同（T119 焚化廠的每一格四鄰都是來源）', build: b => {
    b.road(8, 30, 19, 30).road(22, 30, 46, 30).put(20, 30, 62);
    b.row(9, 18, 29, 1, 2).row(23, 26, 29, 1, 3).put(44, 29, 1, 3);
  } },
  // ---- D021：住宅塔（k33，2×2）、巨廈（k105，3×3）的居民不看有沒有電，算進人口（55108、55110、55246）----
  { id: 'T1', note: '塔與巨廈有電：兩座塔、一座巨廈與 5 棟住宅，一座發電廠；讀檔後與推進後的人口都含塔與巨廈', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5);
    b.put(10, 31, 33).put(14, 31, 105).put(19, 31, 33).row(10, 14, 29, 1, 3);
  } },
  { id: 'T2', note: '塔與巨廈沒有電、沒有路：居民照算（不看有沒有電）；沒有住宅、沒有發電廠', build: b => {
    b.put(10, 10, 33).put(14, 10, 33).put(20, 10, 105);
  } },
  { id: 'T3', note: '一座塔加 5 棟住宅剛好過 500 人（正式清運靠塔的人口）', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(24, 29, 8);
    b.put(10, 31, 33).row(12, 16, 29, 1, 3);
  } },
  { id: 'T4', kind: 'small', note: '一座塔加 4 棟住宅、不到 500 人（塔的人口少了就是小城）', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5).put(24, 29, 8);
    b.put(10, 31, 33).row(12, 15, 29, 1, 3);
  } },
  { id: 'T5', note: '商業塔（k34）與商業綜合體（k106）不住人：只有這兩種＋一棟住宅，人口只有那一棟；固定就業本線沒搬（不影響人口）', build: b => {
    b.road(8, 30, 40, 30).put(7, 30, 5);
    b.put(10, 31, 34).put(14, 31, 106).put(12, 29, 1, 3);
  } },
];

// 隨機的城：固定種子的 mulberry32 排出 1–3 張路網（各占一條橫帶），每張網有發電廠（多半）、0–2 座處理設施（含離線的）、路邊的住宅、工業、商業、兩格外的住宅
export function randomDef(seed) {
  return { id: `R${seed - 20260929}`, kind: 'random', note: `隨機種子 ${seed}`, build: b => {
    const R = mulberry32(seed), int = (lo, hi) => lo + Math.floor(R() * (hi - lo + 1)), ch = p => R() < p;
    const nets = int(1, 3), bands = [[6, 18], [28, 40], [50, 62]];
    for (let k = 0; k < nets; k++) {
      const z = int(bands[k][0] + 3, bands[k][1] - 3), x0 = int(8, 14), x1 = Math.min(N21 - 8, x0 + int(14, 44));
      b.road(x0, z, x1, z);
      if (ch(.4)) { const bx = int(x0 + 2, x1 - 2), len = int(4, 9), up = ch(.5); if (up ? z - len - 3 >= 2 : z + len + 3 < N21 - 1) { b.road(bx, up ? z - len : z, bx, up ? z : z + len); } }
      if (ch(.85)) b.put(x0 - 1, z, 5);
      for (let f = int(0, 2); f > 0; f--) {
        const k2 = FAC_K[int(0, FAC_K.length - 1)], sz = SIZE[k2] ?? 1, off = ch(.2), x = int(x0 + 2, x1 - 3);
        const zz = off ? z - 6 - int(0, 3) : (ch(.5) ? z - sz : z + 1);
        if (b.isFree(x, zz, sz)) b.put(x, zz, k2);
      }
      for (let x = x0; x <= x1; x++) for (const dz of [-1, 1]) {
        if (!ch(.5) || !b.isFree(x, z + dz)) continue;
        const r = R();
        if (r < .12) b.put(x, z + dz, 3, int(1, 3)); else if (r < .17) b.put(x, z + dz, 2, int(1, 3)); else b.put(x, z + dz, 1, int(1, 3), { den: int(1, 5) });
      }
      for (let x = x0; x <= x1; x++) if (ch(.08) && b.isFree(x, z - 2) && !b.isFree(x, z - 1)) b.put(x, z - 2, 1, int(1, 3), { den: int(1, 5) });   // 兩格外：有電、四鄰沒有路
    }
  } };
}
export const RANDOM_SEEDS = [20260930, 20260931, 20260932, 20260933, 20260934, 20260935];


// 全部的城（碼）：newcityCode＝src/content/samples/newcity.code.txt（存檔 JSON 拿來當樣板）；samples＝{ ai120, seed516, gallery } 三張樣本碼。順序：樣本城、造的城
export function cities21(newcityCode, samples) {
  const template = decodeLabCode(newcityCode.trim()).save.raw;
  const own = [...CITY_DEFS, ...RANDOM_SEEDS.map(randomDef)].map((d, j) => {
    const b = builder(template); d.build(b);
    return { id: d.id, kind: d.kind ?? 'formal', note: d.note, code: b.code(5162026 + 3 * j) };
  });
  const smp = [{ id: 'ai120', kind: 'sample', note: 'AI 城 120 天（人口 1,116、沒有塔）', code: samples.ai120.trim() },
    { id: 'seed516', kind: 'sample', note: '種子城（945 棟，含 3 座住宅塔、1 座巨廈；讀檔後 5,436、推進一天後 1,400）', code: samples.seed516.trim() },
    { id: 'gallery', kind: 'sample', note: '全種類樣張城（183 棟，含住宅塔、巨廈各 1 座）', code: samples.gallery.trim() }];
  return [...smp, ...own];
}
