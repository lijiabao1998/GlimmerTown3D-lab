// D041 量緊急車輛用的城（V 系列）：跟 D026 的 H 系列不同，這幾座有真的道路網——橫路每 3 格一條（z＝33、36、…、63）、三條直路（x＝6、36、66）接上 z＝30 的底路；
// 建築排在兩條橫路之間的兩列（每一棟至少有一邊貼著路，T455 的「frontage」才有路可走），消防局、警察局、救護站放在同樣的列裡、也貼路。
// 旗標只撒一種（V1／V1h 火、V2 犯罪、V3 疾病、V4 三種都撒、各 3％），好分開量每一種車的效果。全部用座標與固定種子的 mulberry32，沒有 Math.random、現實時間。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { builder, N21 } from './d021-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
// 住商工混排的一格（同 D026 的 mix：依座標決定，沒有亂數）
const mix = (x, z) => { const h = (x * 7 + z * 13) % 10; return h < 5 ? [1, 1 + ((x + z) % 3), { den: 1 + ((x * 3 + z) % 5), we: (x + 2 * z) % 3 }] : h < 8 ? [3, 1 + ((x * 2 + z) % 3)] : [2, 1 + ((x + 3 * z) % 3)]; };
export const BAND_ROWS = Array.from({ length: 10 }, (_, j) => [34 + 3 * j, 35 + 3 * j]).flat();   // 建築的列：34、35、37、38、…、61、62
export const VERT = [6, 36, 66];
function grid(b, stations, fill) {
  for (let j = 0; j <= 10; j++) b.road(6, 33 + 3 * j, 66, 33 + 3 * j);
  for (const x of VERT) b.road(x, 31, x, 63);
  b.road(4, 30, 66, 30).put(3, 30, 5);                         // 底：z＝30 的路加發電廠（同 D026 的 base）
  for (const [k, x, z] of stations) b.put(x, z, k, 1);
  for (const z of BAND_ROWS) for (let x = 7; x <= 65; x++) { if (VERT.includes(x) || !b.isFree(x, z, 1)) continue; const q = fill(x, z); if (q) b.put(x, z, q[0], q[1] ?? 1, q[2] ?? {}); }
}
// 旗標：燃燒天數是存檔列（bl）的第 6 位；犯罪 cm／cmd、生病 sk／skd 是逐格圖層
function sprinkle(b, R, rate) {
  for (const r of [...b.bl].sort((p, q) => p[0] - q[0])) {
    const i = r[0], k = r[1], u = R();
    if (k > 3) continue;
    const x = i % N21, z = (i / N21) | 0;
    if (rate.fire && u < rate.fire) r[5] = 1 + Math.floor(R() * 5);
    else if (rate.crime && u < (rate.fire ?? 0) + rate.crime) { b.flag('cm', x, z, 1); const d = Math.floor(R() * 21); if (d) b.flag('cmd', x, z, Math.min(15, d)); }
    else if (k === 1 && rate.sick && u < (rate.fire ?? 0) + (rate.crime ?? 0) + rate.sick) { b.flag('sk', x, z, 1); const d = Math.floor(R() * 10); if (d) b.flag('skd', x, z, Math.min(9, d)); }
  }
}
const FIRE_ST = [[6, 20, 34], [6, 50, 43], [6, 30, 58], [30, 60, 37]];
const POLICE_ST = [[11, 16, 34], [11, 46, 49], [52, 30, 61]];
const AMB_ST = [[28, 20, 40], [28, 50, 55], [28, 12, 59]];
export const V_DEFS = [
  { id: 'V1', note: '火：4％ 起火（燃燒天數 1–5），消防局三座＋高級消防一座（都貼路），預設 3 輛消防車', st: FIRE_ST, rate: { fire: .04 }, seed: 20261201 },
  { id: 'V1h', note: '火（重）：12％ 起火，同 V1 的消防局——車隊 3 輛不夠用（目標比車多）', st: FIRE_ST, rate: { fire: .12 }, seed: 20261202 },
  { id: 'V2', note: '犯罪：5％（天數 0–20），警察局兩座＋派出所一座（貼路），預設 2 輛警車', st: POLICE_ST, rate: { crime: .05 }, seed: 20261203 },
  { id: 'V3', note: '疾病：6％（天數 0–9），救護站三座（貼路、沒有診所醫院），預設 2 輛救護車', st: AMB_ST, rate: { sick: .06 }, seed: 20261204 },
  { id: 'V4', note: '三種旗標各 3％，消防局、警察局、救護站各幾座（貼路）', st: [...FIRE_ST.slice(0, 2), ...POLICE_ST.slice(0, 2), ...AMB_ST.slice(0, 2)], rate: { fire: .03, crime: .03, sick: .03 }, seed: 20261205 },
];
export function vCities() {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), newcity = read('src/content/samples/newcity.code.txt');
  const template = decodeLabCode(newcity.trim()).save.raw, sizeOf = k => KT.size(k);
  return V_DEFS.map((c, i) => {
    const b = builder(template, sizeOf);
    grid(b, c.st, mix);
    sprinkle(b, mulberry32(c.seed), c.rate);
    return { id: c.id, note: c.note, code: b.code(5162026 + 17 * i, 100 + 7 * i, '車輛', {}), days: 30 };
  });
}
