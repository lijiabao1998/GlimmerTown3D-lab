// D036 對拍用的城：資源開採（M）——W 系列自造城（連推 13 天，W4 連推 60 天），加一批只讀資源圖的種子城（不推進）。
// 共同的底＝D034 的 M1（人口 ≥ 500 的一座城，幸福 .6–.8，管網、電廠、公園、服務都有）；井擺在本線算出來的資源圖上：先用空城讀一次（資源圖只看種子與地形，不看建築），
// 再把油井 k49 擺在油田格（RESOURCE＝1）、礦場 k50 擺在礦藏格（＝2），另外擺對不上種類的（油井在礦藏上、礦場在油田上）與沒有資源的格子，看它們不抽。
//   W1 井的基本款（抽、不抽、種類對不上、沒電的照抽）；W2 加煉油廠、鋼鐵廠、造船廠、燃料儲運站、鋼材物流場（有電、貼路：油分流成燃料、礦分流成鋼材，容量封頂）；
//   W3 耗盡（存檔裡預先帶 rdep：幾口井剩 1、2、0，還有一口只剩一半）；W4 同 W2、連推 60 天（耗損累積、庫存封頂）；W5 壞的 rdep（不是配對、長度不夠、出界、≤ 0、小數、字串、超過 240）。
// 決定性：全部用座標與固定種子算出來，沒有 Math.random、現實時間。
import { decodeLabCode } from '../src/io/labcode.ts';
import * as realDay from '../src/sim/day.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { mk, tryPut, base, pipes, cluster, parksAt, range, services, m1 } from './d034-cities.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';

export const W_DAYS = 13, W_LONG = 60;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let kt = null;
const ctx = () => kt ??= { KT: kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank: JSON.parse(read('src/content/samples/d009-live.json')).vrank };

// 某個種子（空城）的資源圖：{ oil: [格索引…], ore: [...], none: [陸地上沒有資源的格子], n }
export function resourceOf(seed) {
  const code = mk(seed, 150, '資源', () => {}), { KT, vrank } = ctx();
  const s = realDay.simFromSave(decodeLabCode(code).save, code, KT, vrank), N = s.w.N, oil = [], ore = [], none = [];
  for (let i = 0; i < N * N; i++) { const r = s.res.resource[i], t = s.w.tiles[i].t; if (r === 1) oil.push(i); else if (r === 2) ore.push(i); else if (t === 1 || t === 2) none.push(i); }
  return { oil, ore, none, N };
}

// 這座城佔著的區域（M1 的範圍、新鋪的路與廠房）：井不要擺進去，免得 tryPut 失敗
const reserved = (x, z) => (z >= 24 && z <= 36 && x >= 2 && x <= 68) || (z >= 44 && z <= 46 && x >= 4 && x <= 40) || (x >= 3 && x <= 5 && z >= 30 && z <= 58) || (z >= 50 && z <= 58 && x >= 3 && x <= 42);
const free = (R, list) => list.map(i => [i % R.N, (i / R.N) | 0]).filter(([x, z]) => !reserved(x, z));

// 煉油廠、鋼鐵廠、造船廠（3×3）、燃料儲運站（3×3）、鋼材物流場（2×2）沿著一條接主街的路（z=52）擺：有電、貼路
function plant(b) {
  b.road(4, 31, 4, 52, 3); b.road(5, 52, 40, 52, 3);
  [[8, 53, 121], [14, 53, 122], [20, 53, 123], [26, 53, 170], [32, 53, 172]].forEach(([x, z, k]) => tryPut(b, x, z, k));
}

function wells(b, R, { extra = true, n = 6 } = {}) {
  const oil = free(R, R.oil), ore = free(R, R.ore), none = free(R, R.none), put = [];
  let q = 0;
  for (const [x, z] of oil) { if (q >= n) break; if (tryPut(b, x, z, 49)) { put.push(['oil', x, z]); q++; } }
  q = 0; for (const [x, z] of ore) { if (q >= n - 1) break; if (tryPut(b, x, z, 50)) { put.push(['ore', x, z]); q++; } }
  if (extra) {
    q = 0; for (const [x, z] of none) { if (q >= 2) break; if (tryPut(b, x, z, 49)) { put.push(['oil-on-none', x, z]); q++; } }
    q = 0; for (const [x, z] of none.slice(40)) { if (q >= 2) break; if (tryPut(b, x, z, 50)) { put.push(['ore-on-none', x, z]); q++; } }
    q = 0; for (const [x, z] of oil.slice(n + 4)) { if (q >= 2) break; if (tryPut(b, x, z, 50)) { put.push(['mine-on-oil', x, z]); q++; } }   // 礦場在油田上：種類對不上、不抽
    q = 0; for (const [x, z] of ore.slice(n + 4)) { if (q >= 2) break; if (tryPut(b, x, z, 49)) { put.push(['well-on-ore', x, z]); q++; } }   // 油井在礦藏上：不抽
  }
  return put;
}

const SEEDS = { W1: 5166004, W2: 5166006, W3: 5166001, W4: 5166009, W5: 5166004 };
const cache = {};
const resFor = id => cache[id] ??= resourceOf(SEEDS[id]);

// 每座城的建造函式；回傳放了哪些井（給 rdep 與守衛用）
const BUILD = {
  W1: b => { m1(b); return wells(b, resFor('W1')); },
  W2: b => { m1(b); plant(b); return wells(b, resFor('W2')); },
  W3: b => { m1(b); return wells(b, resFor('W3'), { n: 6 }); },
  W4: b => { m1(b); plant(b); return wells(b, resFor('W4'), { n: 8 }); },
  W5: b => { m1(b); return wells(b, resFor('W5'), { n: 6 }); },
};
const NOTE = {
  W1: '井的基本款：油井在油田上抽、礦場在礦藏上抽；擺在沒有資源的格子上、種類對不上的不抽（沒電的井照抽）；供應品、油、礦進經濟',
  W2: 'W1 加煉油廠、鋼鐵廠、造船廠、燃料儲運站、鋼材物流場（有電、貼路）：油分流成燃料、礦分流成鋼材，倉容量封頂',
  W3: '耗盡：存檔的 rdep 預先帶著——有的井只剩 1、2、剛好滿 240、一半；隔天停產、最後一天只抽剩下的',
  W4: 'W2 連推 60 天：耗損累積、庫存封頂、煉油廠與鋼鐵廠的速率限制',
  W5: '壞的 rdep：不是配對、長度不夠、索引出界、量 ≤ 0、小數、字串、超過 240——實驗線的讀法（|0、夾 240、略過壞項）',
};
// 預先帶的 rdep（依「放了哪些井」算）；W5 的壞項夾在裡面
function rdepOf(id, put, R) {
  const at = (name, q = 0) => { const p = put.filter(x => x[0] === name)[q]; return p ? p[2] * R.N + p[1] : -1; };
  if (id === 'W3') return [[at('oil', 0), 239], [at('oil', 1), 238], [at('oil', 2), 240], [at('ore', 0), 239], [at('ore', 1), 120], [at('ore', 2), 239], [at('oil', 3), 3], [at('oil-on-none', 0), 100], [at('mine-on-oil', 0), 50]].filter(p => p[0] >= 0);
  if (id === 'W5') {
    const a = at('oil', 0), c = at('oil', 1), d = at('ore', 0), e = at('ore', 1), f = at('oil', 2);
    return [[a, 5], [3], 'x', [99999, 4], [-1, 7], [c, -3], [d, 999], [e, 1.7], [f, '7'], null, [10, 0], [R.N * R.N, 5]];
  }
  return null;
}
const DEFS = ['W1', 'W2', 'W3', 'W4', 'W5'];
export function d036Runs() {
  return DEFS.map((id, i) => {
    const R = resFor(id);
    let put = [];
    const code = mk(SEEDS[id], 150, '開採', b => { put = BUILD[id](b); }, () => { const r = rdepOf(id, put, R); return r ? { rdep: r } : {}; });
    return { id, note: NOTE[id], code, days: id === 'W4' ? W_LONG : W_DAYS, put, seed: SEEDS[id] };
  });
}

// 只讀資源圖的種子城：空城（不推進，實驗線讀進來之後記 RESOURCE 的雜湊）
export const SEED_CITIES = 60;
export function d036Seeds() {
  const out = [];
  for (let i = 0; i < SEED_CITIES; i++) {
    const seed = i < 12 ? 5166000 + i : i < 24 ? -(1000 + i * 977) : i < 36 ? 2147483000 + i * 31 : 5166100 + i * 53;   // 含負的、接近 2^31 的、一般的
    out.push({ id: `S${String(i).padStart(2, '0')}`, seed, code: mk(seed, 150, '資源圖', () => {}) });
  }
  return out;
}
void base; void pipes; void cluster; void parksAt; void range; void services;
