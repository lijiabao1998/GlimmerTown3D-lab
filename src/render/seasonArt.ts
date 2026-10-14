// D062 四季：把模擬的季節（src/sim/rules/weather.ts 的 season(day)）畫在地面與樹上。純函式：不 import three、不碰 DOM、不用 Math.random／時間，同輸入同位元組。
// 出處（只讀）：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d `index.html`——季節函數 38125；草的四季色 60449（春 #74b258 是基準、夏 #8fce5e、秋 #b8935a、冬 #e8eef2）；
// 夏秋的草與樹疊色 45099–45108；冬天的樹冠積雪 40917–40952；春天路邊的樹換櫻花 61414；落葉色 61445。經本線輸出色模型（src/render/landArt.ts）換算：春 #6aaa55（＝D061 底色，不變）、夏 #80bf55、秋 #aa9555、冬 #d4eaea。
// 春＝基準：春季的地面與樹跟沒有季節旗標逐位元組相同；有意偏離實驗線的地方與理由寫在 docs/D062-seasons-weather.md。
import { hash2 } from '../sim/rng.ts';
import { season } from '../sim/rules/weather.ts';
import { LAND_OUT, makeLandPal, meadowField, type LandPal } from './landArt.ts';

// ---- 排程 ----
export const SEASON_BLEND_DAYS = 12;   // 轉季的窗長（天）。窗在邊界之前，邊界日起是新季純色：新遊戲第 1 天（doy 0）就是純春
export interface SeasonView { a: number; b: number; t: number }   // a＝畫面上的季；b＝正在換進來的下一季；t∈[0,1)＝進度，0＝純色
const BOUNDARIES = [100, 200, 300, 360];
export function seasonView(day: number): SeasonView {
  const doy = (((day - 1) % 360) + 360) % 360, a = season(day);
  for (const B of BOUNDARIES) {
    const from = B - SEASON_BLEND_DAYS;
    if (doy >= from && doy < B) return { a, b: (a + 1) & 3, t: (doy - from + 0.5) / SEASON_BLEND_DAYS };
  }
  return { a, b: a, t: 0 };
}
// 每一格的換季門檻（低頻草甸場為主、少量雜訊）：進度 t 超過門檻的格子先換成下一季。探索圖實測 72×72 格：窗內每天新換的格子 1.7–15.3%（慢—快—慢）
export const seasonThr = (x: number, z: number): number => Math.min(0.999, Math.max(0, 0.82 * ((meadowField(x, z) - 0.18) / 0.64) + 0.18 * hash2(x, z, 1301)));
export const seasonAt = (x: number, z: number, v: SeasonView): number => v.t > 0 && seasonThr(x, z) < v.t ? v.b : v.a;

// ---- 渲染層的輸入 ----
export interface SeasonOption { mode: 'auto' | 0 | 1 | 2 | 3; soft: boolean; day?: number }   // BlockRender.season；undefined＝關；day＝固定用第幾天算季節（?seasonDay=94，拍轉季中途的畫面用；沒給＝跟著城市的日子）
export interface SeasonSetup { view: SeasonView; soft: boolean }              // GroundCity.season：這一幀的季節（由 day 算出）
export const SEASON_STYLE_DEFAULT: 'bold' | 'soft' = 'bold';   // 全季（＝實驗線自己的色）。我先選的，業主看圖後定；要改只改這一行（守衛會紅一次，提醒同步改測試與卡面）
const SEASON_FLAG: Record<string, 0 | 1 | 2 | 3> = { '0': 0, '1': 1, '2': 2, '3': 3 };
// 網址旗標：?season=auto|off|0|1|2|3（預設 auto）、?seasonStyle=bold|soft。地景關閉（landArt=0 或任何舊 legacy 旗標）時季節一律關；只認白名單，?season=constructor 之類落到預設
export function seasonOptionOf(get: (key: string) => string | null, landLevel: number): SeasonOption | undefined {
  if (landLevel <= 0) return undefined;
  const raw = get('season') ?? '';
  if (raw === 'off') return undefined;
  const mode = Object.hasOwn(SEASON_FLAG, raw) ? SEASON_FLAG[raw] : 'auto', style = get('seasonStyle'), sd = get('seasonDay') ?? '';
  return { mode, soft: style === 'soft' ? true : style === 'bold' ? false : SEASON_STYLE_DEFAULT === 'soft', ...(/^[1-9]\d{0,5}$/.test(sd) ? { day: +sd } : {}) };
}
export const seasonSetupOf = (o: SeasonOption, day: number): SeasonSetup => ({ view: o.mode === 'auto' ? seasonView(o.day ?? day) : { a: o.mode, b: o.mode, t: 0 }, soft: o.soft });

// ---- 調色盤（輸出色；春＝基準不在表裡）。順序同 landArt.ts 的 LAND_OUT：草 7 階（深、橄欖、基底、偏黃淺、亮草甸、淡高光、乾草）、花 3、石 2、水 6（深、中層、基底、淺灘、泡沫、浪頭）、沙 5 ----
// 全季（bold）：實驗線自己的色；柔（soft）：我自己的折衷（草只挪半格色階、冬天只是霜、水只在貼岸一圈結冰）。
interface SeasonSet { grass: number[]; flower: number[]; stone: number[]; water: number[]; sand: number[]; zone?: Partial<Record<1 | 2 | 3, number[]>> }
const BOLD: Record<number, SeasonSet> = {
  1: { grass: [0x6aaa40, 0x80aa40, 0x80bf55, 0x95bf55, 0x95d455, 0xaad46a, 0xaabf55], flower: LAND_OUT.flower, stone: LAND_OUT.stone, water: [0x406aaa, 0x4095bf, 0x4095bf, 0x55aad4, 0xaad4d4, 0xd4eaea], sand: LAND_OUT.sand },
  2: { grass: [0x806a55, 0x958055, 0xaa9555, 0xaaaa55, 0xbfaa55, 0xd4bf6a, 0xaa8040], flower: [0xd46a40, 0xd49540, 0xbf4040], stone: LAND_OUT.stone, water: [0x406a95, 0x4080aa, 0x4080aa, 0x5595bf, 0xaabfbf, 0xd4d4d4], sand: [0xead495, 0xead4aa, 0xd4bf80, 0xbfaa6a, 0xaa956a], zone: { 3: [0xd4552a, 0xea8055] } },
  3: { grass: [0xaabfaa, 0xbfd4d4, 0xd4eaea, 0xeaeaea, 0xeaeaea, 0xeaeaea, 0xbfd4bf], flower: [0xeaeaea, 0xd4eaea, 0xbfd4ea], stone: [0x959580, 0x80806a], water: [0x6a95bf, 0x80aad4, 0x95bfea, 0xaad4ea, 0xeaeaea, 0xeaeaea], sand: [0xd4bf95, 0xead4aa, 0xbfaa80, 0xaa956a, 0x95806a] },
};
const SOFT: Record<number, SeasonSet> = {
  1: { grass: [0x6a9540, 0x6aaa55, 0x80aa55, 0x80bf55, 0x95bf6a, 0xaad480, 0x95bf55], flower: LAND_OUT.flower, stone: LAND_OUT.stone, water: LAND_OUT.water, sand: LAND_OUT.sand },
  2: { grass: [0x6a8040, 0x809540, 0x95aa55, 0xaaaa55, 0xbfaa55, 0xbfbf6a, 0xaa9540], flower: [0xd4bf80, 0xd49540, 0xbf6a40], stone: LAND_OUT.stone, water: [0x406a95, 0x4080aa, 0x4080aa, 0x55aad4, 0xaad4d4, 0xd4eaea], sand: LAND_OUT.sand },
  3: { grass: [0x95aa95, 0xaabfaa, 0xbfd4bf, 0xd4eaea, 0xeaeaea, 0xeaeaea, 0xaabfaa], flower: [0xeaeaea, 0xd4eaea, 0xbfd4ea], stone: [0x959580, 0x80806a], water: [0x406a95, 0x4080aa, 0x4095bf, 0xaad4ea, 0xeaeaea, 0xeaeaea], sand: [0xd4bf95, 0xead4aa, 0xbfaa80, 0xaa956a, 0x95806a] },
};
export const SEASON_TABLES = { bold: BOLD, soft: SOFT };   // 守衛逐表檢查（可讀性、輸出色格子）；表是常數，不可改
const palCache = new Map<number, LandPal | null>();
// 某一季的整套調色盤；春（沒有表）回 undefined＝照舊的 D061 色。草地坪（住宅 1、別墅 4 的草坪色）跟著草的對應走；道路、斑馬線、其他地坪不動
export function seasonPal(sea: number, soft: boolean): LandPal | undefined {
  const key = sea * 2 + (soft ? 1 : 0);
  let p = palCache.get(key);
  if (p === undefined) {
    const S = (soft ? SOFT : BOLD)[sea];
    if (!S) p = null;
    else {
      const g = new Map<number, number>();
      LAND_OUT.grass.forEach((c, i) => g.set(c, S.grass[i]));
      const lawn = (list: number[]) => list.map(c => g.get(c) ?? c);
      const zone = LAND_OUT.zone.map((z, k) => S.zone?.[k as 1 | 2 | 3] ?? z);
      p = makeLandPal({ ...LAND_OUT, grass: S.grass, flower: S.flower, stone: S.stone, water: S.water, sand: S.sand, zone, lot: { ...LAND_OUT.lot, 1: lawn(LAND_OUT.lot[1]), 4: lawn(LAND_OUT.lot[4]) } });
    }
    palCache.set(key, p);
  }
  return p ?? undefined;
}
export const seasonPalAt = (s: SeasonSetup, x: number, z: number): LandPal | undefined => seasonPal(seasonAt(x, z, s.view), s.soft);

// ---- 樹：整棵樹的實例色往目標色染（cityScene 用 THREE.Color.lerp 套）。春＝基準，只有「3×3 內有路」的闊葉樹換櫻花粉 ----
const hslHex = (h: number, s: number, l: number): number => {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = ((t % 1) + 1) % 1; return Math.round(255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p)); };
  return (f(h + 1 / 3) << 16) | (f(h) << 8) | f(h - 1 / 3);
};
export interface TreeTint { hex: number; a: number }
// sea＝這棵樹所在格的季節；cone＝針葉；h1＝這棵樹的色相抖動（0–1）；roadNear＝3×3 內有路
export function treeTint(sea: number, soft: boolean, cone: boolean, x: number, z: number, h1: number, roadNear: boolean): TreeTint | null {
  const A = soft ? 0.5 : 1;
  if (sea === 0) return !cone && roadNear ? { hex: hslHex(0.93 + h1 * 0.05, 0.55, 0.72), a: A } : null;
  if (sea === 1) return { hex: 0xa8e070, a: (cone ? 0.18 : 0.22) * A };
  if (sea === 2) {
    if (cone) return { hex: 0xd8722c, a: 0.06 * A };   // 常綠針葉：只染一點，保持常綠（α.12 量到平均色相 0.243，已經偏黃；α.06 是 0.294）
    const r = hash2(x, z, 22);
    return { hex: r < 0.45 ? 0xd8722c : r < 0.75 ? 0xe0a030 : 0xc0402a, a: 0.62 * A };   // 闊葉：實驗線的落葉色（橘、金、紅）
  }
  return { hex: 0xeef4f8, a: (cone ? 0.5 : 0.55) * A };   // 冬：樹冠染雪（實驗線是頂 40% 積雪；這裡沒有逐頂點的雪頂）
}
