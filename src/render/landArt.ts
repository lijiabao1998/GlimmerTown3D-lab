// D061 地景：地面貼圖的草、水、沙、道路、地坪與劃區顏色。純函式：不 import three、不碰 DOM、不用 Math.random／時間，同輸入同位元組。
// 為什麼要「設計在輸出色的格子上」：風格 A 的後製把每個色版量化成 12 階，ground.ts 的五個草色差不到半階，全部落進同一個輸出色，
// 地面逐像素雜訊等於沒有（新城近景整張圖只有 6 個顏色，見 docs/D061-landscape.md）。所以這裡每個顏色都先指定「輸出色」，再反推貼圖色。
// 輸出色模型：輸出色版 = 量化 12 階（sRGB（線性（貼圖色版）× 0.91）），量化平手取偶數；0.91 是受光係數，由已知的輸出色反推（落在 [0.882, 0.940]），
// 對 ground.ts 的草、格線、水、沙逐項與實拍相符（tools/unit-d061.mjs 重算；CI 的 d061 報告再用實拍輸出色量一次）。
import { hash2 } from '../sim/rng.ts';

export const LAND_MAX = 3;                       // 檔位 1 細、2 中、3 強；0＝關（legacy）
export const LAND_DEFAULT = 2;                   // 沒給旗標時的檔位：我先定的，等業主看四檔對照圖挑；要改只改這一行（守衛會紅一次，提醒同步改測試與卡面）
export const LAND_LIGHT = 0.91;
const Q = 12;
const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const enc = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const evenRound = (x: number) => { const f = Math.floor(x), d = x - f; return d < 0.5 ? f : d > 0.5 ? f + 1 : (f % 2 === 0 ? f : f + 1); };
const binOf = (v: number) => Math.max(0, Math.min(Q, Math.floor(v / 255 * Q + 0.5)));
const binValue = (b: number) => evenRound(b / Q * 255);
// 一個貼圖色 → 後製之後的輸出色（0xRRGGBB）
export function outputColor(texel: number): number {
  let o = 0;
  for (const sh of [16, 8, 0]) o = (o << 8) | binValue(binOf(Math.max(0, Math.min(255, enc(lin((texel >> sh) & 255) * LAND_LIGHT)))));
  return o;
}
// 輸出色 → 貼圖色（取輸出格子的正中央反推，受光有些微變動也不會掉到隔壁格）
export function texelFor(out: number): number {
  let t = 0;
  for (const sh of [16, 8, 0]) {
    const centre = binOf((out >> sh) & 255) / Q * 255;
    t = (t << 8) | Math.max(0, Math.min(255, Math.round(enc(lin(centre) / LAND_LIGHT))));
  }
  return t;
}
const P = texelFor;

// ---- 調色盤（輸出色；括號是它在畫面上的角色） ----
export const LAND_OUT = {
  // 草：深、偏橄欖、基底、偏黃淺色、亮草甸、淡色高光、乾草
  grass: [0x559540, 0x6a9540, 0x6aaa55, 0x80aa55, 0x80bf55, 0x95bf6a, 0x95aa55],
  flower: [0xeaeaea, 0xead455, 0xd46a95],
  stone: [0x808095, 0x6a6a55],
  // 水：深水、中層、基底（舊的水色）、淺灘、岸邊泡沫、浪頭
  water: [0x406aaa, 0x4095bf, 0x4080bf, 0x55aad4, 0xaad4d4, 0xd4eaea],
  // 沙：基底、乾沙、濕沙、深濕沙、石子
  sand: [0xd4bf80, 0xead495, 0xbfaa6a, 0xaa956a, 0x95806a],
  // 路：基底、深補丁、淺磨損、斑馬線
  road: [0x555555, 0x404040, 0x6a6a6a, 0xeaeaea],
  // 劃區：住（青綠）、商（淡紫）、工（橙褐）的空地底色與邊框。舊的 22% 混色在風格 A 讓住與工同一個輸出色（#80aa55，ΔE 0），與草基底也只差 ΔE 8；
  // 這三色與草、水、沙、路各族都至少 ΔE 20 以上（水藍被商業佔走了，所以商業用淡紫）
  zone: [[0, 0], [0x6abfaa, 0x80d4bf], [0xbf95d4, 0xd4aaea], [0xbf8040, 0xd49555]],
  // 住商工庭院地坪：住宅草坪兩色、商業鋪面兩色（磚縫）、工業碎石兩色（車位線黃）、別墅草坪
  lot: { 1: [0x6a9540, 0x80aa55, 0x559540], 2: [0x808080, 0x959595, 0x6a6a6a], 3: [0x6a6a55, 0x555555, 0xbfaa40], 4: [0x559540, 0x6a9540, 0x406a2a] } as Record<number, number[]>,
};
// D062-BEGIN season-pal
export const makeLandPal = (o: typeof LAND_OUT) => ({   // D062：同一套結構可以用別的輸出色表再做一份（四季的調色盤）
  grass: o.grass.map(P), flower: o.flower.map(P), stone: o.stone.map(P),
  water: o.water.map(P), sand: o.sand.map(P), road: o.road.map(P),
  zone: o.zone.map(z => z.map(P)),
  lot: Object.fromEntries(Object.entries(o.lot).map(([k, v]) => [k, v.map(P)])) as Record<string, number[]>,
});
export type LandPal = ReturnType<typeof makeLandPal>;
const TEX = makeLandPal(LAND_OUT), BASE_TEX = TEX;
// D062-END season-pal
// 草的色階（由深到淺）：每一檔用其中一段
const GRASS_RAMP = [0, 1, 2, 3, 4, 5];

// ---- 雜訊 ----
const smooth = (t: number) => t * t * (3 - 2 * t);
function valueNoise(px: number, pz: number, seed: number): number {
  const ix = Math.floor(px), iz = Math.floor(pz), fx = smooth(px - ix), fz = smooth(pz - iz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}
// 低頻草甸場（格座標，0–1，大致以 .5 為中心）：9 格與 4.3 格兩層
export const meadowField = (gx: number, gz: number): number => 0.64 * valueNoise(gx / 9, gz / 9, 1101) + 0.36 * valueNoise(gx / 4.3, gz / 4.3, 1103);

// ---- 每一格的描述（一格算一次） ----
export interface LandCity { n: number; ter: Uint8Array; el: Uint8Array; road: Uint8Array }
export interface LandTile {
  level: number; S: number; x: number; z: number;
  f00: number; f10: number; f01: number; f11: number;   // 這一格四個角的草甸場
  shore: number;                                        // 水格：離岸格數 0–3（0＝貼岸）；其他格 3
  nW: number; nE: number; nN: number; nS: number;       // 四鄰地形：0 水、1 沙、2 草（地圖外當水）；N＝z−1、S＝z+1、W＝x−1、E＝x+1
  high: boolean; flowers: number; tuftU: number; tuftV: number; tuft: number;
// D062-BEGIN season-tile-pal
  pal?: LandPal;                                        // D062：這一格的季節調色盤（沒有＝基準，春天）
// D062-END season-tile-pal
}
const terAt = (c: LandCity, x: number, z: number) => x < 0 || z < 0 || x >= c.n || z >= c.n ? 0 : c.ter[z * c.n + x] === 0 ? 0 : c.ter[z * c.n + x] === 1 ? 1 : 2;
export function landTile(c: LandCity, x: number, z: number, S: number, level: number): LandTile {
  let shore = 3;
  if (c.ter[z * c.n + x] === 0) {
    for (let d = 1; d <= 3 && shore === 3; d++) for (let dz = -d; dz <= d && shore === 3; dz++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== d) continue;
      const xx = x + dx, zz = z + dz;
      if (xx >= 0 && zz >= 0 && xx < c.n && zz < c.n && c.ter[zz * c.n + xx] !== 0) { shore = d - 1; break; }
    }
  }
  const tuft = hash2(x, z, 1171);
  return {
    level, S, x, z,
    f00: meadowField(x, z), f10: meadowField(x + 1, z), f01: meadowField(x, z + 1), f11: meadowField(x + 1, z + 1),
    shore, nW: terAt(c, x - 1, z), nE: terAt(c, x + 1, z), nN: terAt(c, x, z - 1), nS: terAt(c, x, z + 1),
    high: !!c.el[z * c.n + x], flowers: hash2(x, z, 1181), tuftU: 1 + Math.floor(hash2(x, z, 1187) * (S - 3)), tuftV: 1 + Math.floor(hash2(x, z, 1193) * (S - 3)), tuft,
  };
}
const bil = (t: LandTile, u: number, v: number) => {
  const fu = (u + 0.5) / t.S, fv = (v + 0.5) / t.S;
  return (t.f00 * (1 - fu) + t.f10 * fu) * (1 - fv) + (t.f01 * (1 - fu) + t.f11 * fu) * fv;
};
const AT = (x: number, z: number, u: number, v: number, S: number, k: number) => hash2(x * S + u, z * S + v, k);

// 離這一格哪一側的邊有多近（0＝最外一排像素）：回傳該側鄰格的地形碼與距離，沒有就 99
function edgeDist(t: LandTile, u: number, v: number, want: number): number {
  let d = 99; const S = t.S;
  if (t.nW === want) d = Math.min(d, u);
  if (t.nE === want) d = Math.min(d, S - 1 - u);
  if (t.nN === want) d = Math.min(d, v);
  if (t.nS === want) d = Math.min(d, S - 1 - v);
  return d;
}

// ---- 草 ----
// edge＝這個像素在格子最外一排（草皮格線的位置，ground.ts 原本拿它畫格線）
// D062-BEGIN season-grass-sig
export function landGrass(t: LandTile, u: number, v: number, edge: boolean, TEX: LandPal = t.pal ?? BASE_TEX): number {   // D062：參數 TEX 蓋掉模組層的 TEX（預設＝這一格的季節調色盤，沒有就是基準），函式本體逐字不變
// D062-END season-grass-sig
  const L = t.level, S = t.S, X = t.x * S + u, Z = t.z * S + v;
  const h2 = AT(t.x, t.z, u, v, S, 61), h3 = AT(t.x, t.z, u, v, S, 67);
  const f = bil(t, u, v) + (h2 - 0.5) * (L === 1 ? 0.12 : L === 2 ? 0.12 : 0.14) + (t.high ? 0.12 : 0);
  let k: number;       // GRASS_RAMP 的索引：0 深、1 橄欖、2 基底、3 偏黃淺、4 亮草甸、5 淡高光
  if (L === 1) k = f < 0.3 ? 1 : f < 0.7 ? 2 : 3;
  else if (L === 2) k = f < 0.14 ? 0 : f < 0.32 ? 1 : f < 0.6 ? 2 : f < 0.8 ? 3 : 4;
  else k = f < 0.14 ? 0 : f < 0.3 ? 1 : f < 0.52 ? 2 : f < 0.7 ? 3 : f < 0.84 ? 4 : 5;
  let col = TEX.grass[GRASS_RAMP[k]];
  // 草皮格線：留著（它是格子網格的視覺線索），但檔位越高越斷續，並比附近的草亮一階
  if (edge) {
    const keep = L === 1 ? 1 : L === 2 ? 0.75 : 0.5;
    if (h3 < keep) col = TEX.grass[GRASS_RAMP[Math.min(5, k + 1)]];
  }
  if (L >= 2) {
    // 草叢：每格有機會在一處畫三個暗像素
    const dx = u - t.tuftU, dz = v - t.tuftV;
    if (t.tuft < (L === 2 ? 0.2 : 0.3) && ((dx === 0 && dz === 0) || (dx === 1 && dz === 0) || (dx === 0 && dz === 1)) && !edge) col = TEX.grass[GRASS_RAMP[Math.max(0, k - 1)]];
    // 小花：一格一個像素
    if (t.flowers < (L === 2 ? 0.05 : 0.1) && u === 2 + Math.floor(hash2(t.x, t.z, 1201) * (S - 4)) && v === 2 + Math.floor(hash2(t.x, t.z, 1203) * (S - 4))) {
      const r = hash2(t.x, t.z, 1207); col = TEX.flower[r < 0.5 ? 0 : r < 0.8 ? 1 : 2];
    }
    if (L === 3 && t.flowers > 0.97 && u === 3 && v === 4) col = TEX.stone[(X + Z) & 1];
  }
  // 與沙、水交界：貼邊 1–2 像素的過渡（乾草、濕岸）
  const dSand = edgeDist(t, u, v, 1), dWater = edgeDist(t, u, v, 0);
  if (dSand === 0 && h2 < (L === 1 ? 0.4 : 0.8)) col = TEX.grass[6];
  else if (dSand === 1 && L >= 2 && h2 < 0.35) col = TEX.grass[6];
  if (dWater === 0 && h2 < (L === 1 ? 0.4 : 0.8)) col = TEX.grass[0];
  else if (dWater === 1 && L >= 2 && h2 < 0.3) col = TEX.grass[1];
  return col;
}

// ---- 水 ----
// D062-BEGIN season-water-sig
export function landWater(t: LandTile, u: number, v: number, h: number, TEX: LandPal = t.pal ?? BASE_TEX): number {
// D062-END season-water-sig
  const L = t.level, S = t.S, X = t.x * S + u, Z = t.z * S + v;
  const h2 = AT(t.x, t.z, u, v, S, 61);
  let tone: number;                        // LAND_OUT.water 的索引：0 深、1 中層、2 基底、3 淺灘
  if (L === 1) tone = t.shore === 0 ? 3 : 2;
  else tone = t.shore === 0 ? 3 : t.shore === 1 ? 1 : t.shore === 2 ? 2 : 0;
  if (L === 2 && t.shore === 2) tone = 2;
  let col = TEX.water[tone];
  // 浪紋：沿斜向的細帶，亮一階（L2 稀、L3 密）
  if (L >= 2) {
    const band = (X + 2 * Z) % (L === 2 ? 13 : 9);
    if (band === 0 && h2 < (L === 2 ? 0.55 : 0.8)) col = TEX.water[Math.min(3, tone + 1)];
  }
  // 貼岸的泡沫：與陸地相鄰的邊 1 像素
  if (t.shore === 0) {
    const dLand = Math.min(edgeDist(t, u, v, 1), edgeDist(t, u, v, 2));
    if (dLand === 0 && h2 < (L === 1 ? 0.3 : L === 2 ? 0.7 : 0.85)) col = TEX.water[4];
    else if (dLand === 1 && L >= 3 && h2 < 0.25) col = TEX.water[4];
  }
  // 亮點：舊的 7% 撒鹽，改成較少、較亮
  if (h < (L === 1 ? 0.05 : L === 2 ? 0.035 : 0.03)) col = TEX.water[5];
  return col;
}

// ---- 沙 ----
// D062-BEGIN season-sand-sig
export function landSand(t: LandTile, u: number, v: number, TEX: LandPal = t.pal ?? BASE_TEX): number {
// D062-END season-sand-sig
  const L = t.level, S = t.S;
  const h2 = AT(t.x, t.z, u, v, S, 61), h3 = AT(t.x, t.z, u, v, S, 67);
  const f = bil(t, u, v);
  let col = TEX.sand[0];
  if (f > (L === 1 ? 0.62 : 0.56)) col = TEX.sand[1];                               // 乾沙
  const dWater = edgeDist(t, u, v, 0);
  if (dWater <= (L === 1 ? 0 : 2)) col = dWater === 0 && L >= 2 ? TEX.sand[3] : TEX.sand[2];   // 濕沙（鄰水變暗）
  if (L >= 2 && h3 < 0.02) col = TEX.sand[4];                                        // 石子
  const dGrass = edgeDist(t, u, v, 2);
  if (dGrass === 0 && h2 < (L === 1 ? 0.2 : 0.4)) col = TEX.grass[2];                // 草鑽進沙
  return col;
}

// ---- 劃區：空地上的分區記號（舊的 22% 混色在風格 A 讓住與工同一個輸出色，ΔE 0）----
// 底下仍是自然草色（草甸、草叢照常），分區用「記號」疊上去：格線（邊）用邊框色，格內用疏點（住）、橫短線（商）、斜紋（工）。
// 整塊實心色板在 ai120 這種有大片已劃區空地的城裡太吵（試過：滿城橘色）；第二版記號佔四分之一像素、邊框八成，近景仍像一張橘網（舊畫法是柔和的淡色塊）；
// 第三版內部記號壓到八分之一、邊框隨機三到五成，近景像隨機撒的橘色碎屑；第四版邊框改成規律的虛線，整體像刻意畫的地圖填紋。顏色與草、水、沙、路各族至少 ΔE 20。
// D062-BEGIN season-zone-sig
export function landZone(zone: number, edge: boolean, u: number, v: number, x: number, z: number, S: number, base: number, level: number, TEX: LandPal = BASE_TEX): number {
// D062-END season-zone-sig
  const Z = TEX.zone[zone];
  if (!Z) return base;
  const X = x * S + u, Y = z * S + v, h = hash2(X, Y, 1401);
  if (edge) return (level === 1 ? (u + v) % 8 === 0 : level === 2 ? (u + v) % 4 === 0 : (u + v) % 4 < 2) ? Z[1] : base;   // 邊框：規律的虛線（1 檔八格一點、2 檔四格一點、3 檔兩點兩空）
  const mark = zone === 1 ? (X + Y) % 4 === 0 && (u & 1) === 0 : zone === 2 ? v % 4 === 2 && u % 4 < 2 : (X + Y) % 8 === 1;   // 三種都是八分之一的像素：住＝疏點、商＝短橫線、工＝斜紋
  if (mark && (level > 1 || h < 0.6)) return Z[0];
  return level === 3 && h < 0.1 ? Z[0] : base;
}

// ---- 道路細部（只改柏油像素；車道線、人行道、護欄原樣）----
export function landRoad(level: number, u: number, v: number, x: number, z: number, S: number, col: number, asphalt: readonly number[]): number {
  if (!asphalt.includes(col)) return col;
  const h = AT(x, z, u, v, S, 61);
  const patch = hash2(x, z, 1301) < (level === 1 ? 0.05 : level === 2 ? 0.08 : 0.1) && u >= 2 && u <= 4 && v >= 1 && v <= 3;
  if (patch) return TEX.road[1];
  // 柏油大多是基底灰，只撒少量深色與淺色（第一版深色佔三分之一，近景像斑駁的水泥，標線反而不清楚）
  const base = level === 2 ? (h < 0.84 ? TEX.road[0] : h < 0.94 ? TEX.road[1] : TEX.road[2]) : (h < 0.78 ? TEX.road[0] : h < 0.9 ? TEX.road[1] : TEX.road[2]);
  return level === 1 ? (h < 0.88 ? TEX.road[0] : TEX.road[1]) : base;
}
// 斑馬線：直路的前方（或後方）是路口時，在靠路口那一端畫白條
export function landCrosswalk(u: number, v: number, S: number, ns: boolean, toEnd: boolean, toStart: boolean): number {
  const along = ns ? v : u, across = ns ? u : v;
  const inBand = (toStart && along >= 1 && along <= 2) || (toEnd && along >= S - 3 && along <= S - 2);
  if (!inBand) return -1;
  return across >= 1 && across <= S - 2 && across % 2 === 1 ? TEX.road[3] : -1;
}

// ---- 地坪（街區底下的庭院）----
// D062-BEGIN season-lot-sig
export function landLot(level: number, lot: number, u: number, v: number, x: number, z: number, S: number, edge: boolean, legacy: number, TEX: LandPal = BASE_TEX): number {
// D062-END season-lot-sig
  const T = TEX.lot[lot];
  if (!T) return legacy;
  const h = AT(x, z, u, v, S, 61);
  const X = x * S + u, Y = z * S + v;
  if (lot === 1 || lot === 4) return edge && level >= 2 ? T[2] : level === 1 && h < 0.08 ? T[2] : ((v >> 1) + (x + z)) & 1 ? T[1] : T[0];   // 割草條紋，格邊是樹籬（2 檔起；1 檔只在條紋上撒一點深色，色數不少於舊畫法）
  if (lot === 2) {   // 鋪面：1 檔維持舊的雜點（加一點深色），2 檔 4×4 像素的石板棋盤，3 檔再加磚縫
    if (level === 1) return h < 0.12 ? T[0] : h > 0.94 ? T[2] : T[1];
    if (edge || (level === 3 && (u % 4 === 3 || v % 4 === 3))) return T[2];   // 磚縫：2 檔只在格邊，3 檔每 4 像素
    return ((u >> 2) + (v >> 2) + x + z) & 1 ? T[0] : T[1];
  }
  if (lot === 3) return level >= 2 && (X % 16 === 0) && Y % 8 < 5 ? T[2] : h < 0.3 ? T[1] : level === 1 && h > 0.96 ? TEX.lot[2][0] : T[0];  // 碎石與車位線（1 檔撒一點淺碎石）
  return legacy;
}

// ---- 天空四階色帶（由上到下；每一階是風格 A 量化 12 階之後的輸出色。連續漸層會在量化時三個色版各自跳階，出現偏紫與偏青的怪帶）----
export const LAND_SKY: Record<number, number[]> = { 1: [0xaad4ea, 0xaad4ea, 0xbfd4ea, 0xbfd4ea], 2: [0x95bfea, 0xaad4ea, 0xbfd4ea, 0xbfeaea], 3: [0x80aaea, 0x95bfea, 0xaad4ea, 0xbfeaea] };

// ---- 網址旗標：?landArt=0|1|2|3|legacy；沒給＝LAND_DEFAULT（2）；任何更早的 legacy 旗標一併關掉（歷史畫面照舊）。只認白名單，?landArt=constructor 之類的值只會落到預設 ----
const LAND_FLAG: Record<string, number> = { '0': 0, '1': 1, '2': 2, '3': 3 };
export const LAND_LEGACY_KEYS = ['landArt', 'industryArt', 'villageArt', 'streetArt', 'britishArt', 'heritageArt'];
export function landLevelOf(get: (key: string) => string | null): number {
  if (LAND_LEGACY_KEYS.some(key => get(key) === 'legacy')) return 0;
  const raw = get('landArt') ?? '';
  return Object.hasOwn(LAND_FLAG, raw) ? LAND_FLAG[raw] : LAND_DEFAULT;
}
