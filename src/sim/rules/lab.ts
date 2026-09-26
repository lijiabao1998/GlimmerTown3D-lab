// 生長核心公式的共用底（D009）：實驗線的格子形狀、亂數介面、雜湊與小工具。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d（index.html 行號）。這一層逐項對拍（CLAUDE.md 規則 8），
// 所以資料形狀照實驗線的 tiles[i]／bld 原樣（欄位名也一樣）；本線城市模型怎麼接過來是 D010 的事。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { mulberry32 } from '../rng.ts';

export const clamp = (v: number, a: number, b: number) => v < a ? a : (v > b ? b : v);   // 37219

export interface Bld {
  k: number; lv: number; v: number; age: number;
  pw?: boolean; wa?: boolean; h?: number; den?: number; we?: number;
  fire?: number | boolean; crime?: number | boolean; sick?: number | boolean; death?: number | boolean;
  ref?: unknown; sz?: number;
}
export interface Tile {
  t?: number; road?: number | boolean; hw?: number | boolean; rp?: boolean; rc?: number;
  zone?: number; bld?: Bld | null; ruin?: number | boolean; office?: number | boolean;
  lv475?: number | boolean; ud475?: number | boolean;   // 手工配電線（架空／地下），也能帶電（T475）
  hv471?: number | boolean; ug471?: number | boolean;   // 高壓線（T471）：連到發電端的 k148 可啟動配電路網
  tree?: number;                                        // 樹（變體號，0＝沒有；50974 plantTreeAt597）：rebuildCov 對鄰域污染 −2（53151）
  rdec?: number | boolean; bus?: number | boolean;      // 道路裝飾、公車站（51733、51737）：rebuildCov 蓋 rdec／bus 覆蓋場（53149–53150）
  bridge?: number | boolean;                            // 水上道路（51645）
}
export interface World { N: number; tiles: Tile[] }
export const idx = (w: World, x: number, y: number) => y * w.N + x;                         // 39731
export const inMap = (w: World, x: number, y: number) => x >= 0 && y >= 0 && x < w.N && y < w.N;   // 39732

// 逐格場（實驗線的全域陣列）。COV 是各種服務的覆蓋計數；沒放置的服務在實驗線可能整個缺（undefined），這裡同樣允許缺
export interface Fields {
  COV: Record<string, ArrayLike<number> | undefined>;
  LAND: ArrayLike<number>; POL: ArrayLike<number>; NOISE: ArrayLike<number>; EDU: ArrayLike<number>;
  commutePenalty: ArrayLike<number>; METRO_TOD467B: ArrayLike<number>; ACCESS468: ArrayLike<number>;
}
export const cov = (f: Fields, name: string, i: number) => { const a = f.COV[name]; return a ? a[i] : undefined; };

// 亂數：實驗線全域 R＝mulberry32(種子)，ri(n)＝Math.floor(R()*n)（37222–37223）。log 給對拍記呼叫順序用
export interface Rng { R(): number; ri(n: number): number; log?: (string | number)[][] }
export function labRng(seed: number, withLog = false): Rng {
  const g = mulberry32(seed), log: (string | number)[][] | undefined = withLog ? [] : undefined;
  return {
    R() { log?.push(['R']); return g(); },
    ri(n: number) { log?.push(['ri', n]); return Math.floor(g() * n); },
    log,
  };
}

// 57805
export function streetHash(x: number, y: number, salt: number) {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// 49972
export function hashLocal479(a: number, b: number, c = 0) {
  let h = (Math.imul((a | 0) ^ 0x9e3779b1, 374761393) + Math.imul((b | 0) ^ c, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
// 科技：tq(id,on,off)＝解鎖了回 on，否則 off（38549）
export const tq = (tech: readonly string[], id: string, on: number, off: number) => tech.includes(id) ? on : off;
