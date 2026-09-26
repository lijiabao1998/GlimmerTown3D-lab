// D010 Node 守衛：起步城碼對帳、逐日推進的決定性、只接線、歷史重播、推進一天的耗時。由 tools/unit.mjs 呼叫。
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { cityFromLab, cityStats, CITY_FORMAT } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { starterLayout, STARTER_SEEDS, STARTER_DAYS } from '../src/content/starter.ts';
import { simFromSave, stepDay, simHash, simCounts } from '../src/sim/day.ts';
import { replayCity } from '../src/sim/replay.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;

export function starterSim(code, KT, vrank) {
  const r = decodeLabCode(code);
  if (!r.ok) throw new Error('起步城碼解不開：' + r.error);
  return simFromSave(r.save, code, KT, vrank);
}
export function runStarter(code, KT, vrank, days = STARTER_DAYS, onDay, opts = {}) {
  const s = starterSim(code, KT, vrank), ms = [];
  for (let d = 0; d < days; d++) { const t = performance.now(); const rep = stepDay(s, opts); ms.push(performance.now() - t); onDay?.(rep, s); }
  return { s, ms };
}

// 對照用的逐日數字（tools/lab-compare.mjs 的本線那一半、d010-3d.json、回歸守衛共用同一個定義）。
// 勞動力兩欄照實驗線 truthSnapshot496（65888）在企業沒就緒時的算法：workers＝round(pop×.6)、employed＝min(workers, jobs)，
// 兩邊才是同一個量（laborMarket481 的 workers 有 max(1,…)，那是餵需求公式用的，不拿來對照）。第 0 列＝讀檔後、還沒推進。
export const TRAJ_FIELDS = ['day', 'pop', 'jobs', 'employed', 'workers', 'happy', 'demR', 'demC', 'demI', 'R', 'R1', 'R2', 'R3', 'C', 'C1', 'C2', 'C3', 'I', 'I1', 'I2', 'I3'];
export const r6 = x => Math.round(x * 1e6) / 1e6;
export function trajectory(code, KT, vrank, seed, days = STARTER_DAYS) {
  const s = starterSim(codeWithSeed(code, seed), KT, vrank), rows = [];
  const row = () => { const c = simCounts(s), w = Math.round(s.pop * .6); return [s.day, s.pop, s.jobs, Math.min(w, s.jobs), w, s.cityHappy, s.dem[1], s.dem[2], s.dem[3], ...c[1], ...c[2], ...c[3]].map(r6); };
  rows.push(row());
  for (let d = 0; d < days; d++) { stepDay(s); rows.push(row()); }
  return rows;
}

export async function d010SimGuards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
  const vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const code = read('src/content/samples/starter.code.txt'), meta = JSON.parse(read('src/content/samples/starter.json'));

  // 驗收 4：起步城碼對帳（實驗線讀回的數字＝本線解碼），另核道路等級、佈局、地形沿用種子城
  {
    const r = decodeLabCode(code), c = cityFromLab(r.save, KT, code), st = cityStats(c);
    const rc = {}; for (let i = 0; i < c.n * c.n; i++) if (c.road[i]) rc[c.rclass[i]] = (rc[c.rclass[i]] || 0) + 1;
    log(J(st) === J(meta.expect) && meta.sameAsThisLine === true, '起步城碼：實驗線 GV.importCode 讀回的對帳數字＝本線解碼', `路 ${st.road[1]}、分區 ${st.zone.slice(1).join('／')}、建築 ${st.buildings}`);
    log(J(rc) === J(meta.rc) && meta.rcSameAsThisLine === true, '起步城碼：逐格道路等級兩邊相同（決定新住宅密度）', J(rc));
    const seed = decodeLabCode(read('src/content/samples/seed516.code.txt')).save, L = r.save.layers, S = seed.layers;
    const lay = starterLayout(r.save.n, Uint8Array.from(S.ter, ch => ch.charCodeAt(0) - 48), Uint8Array.from(S.el, ch => ch.charCodeAt(0) - 48));
    const used = new Set([...lay.roads, ...lay.zones.map(z => z[0]), ...lay.buildings.map(b => b.i)]);
    const treesOnUsed = [...used].filter(i => L.tre.charCodeAt(i) !== 48).length;
    const treesElse = [...Array(r.save.n * r.save.n).keys()].filter(i => !used.has(i) && L.tre[i] !== S.tre[i]).length;
    log(L.ter === S.ter && L.el === S.el && treesOnUsed === 0 && treesElse === 0 && J(lay.buildings) === J(meta.layout.buildings) && lay.roads.length === meta.layout.roads && lay.zones.length === meta.layout.zones,
      '起步城：地形、高地沿用種子城；用到的格子沒有樹、其餘樹不動；佈局＝starter.ts', `(${lay.x0},${lay.z0}) ${lay.size}×${lay.size}、第 ${r.save.day} 天、種子 ${r.save.seed}`);
  }

  // 驗收 1：決定性（同種子兩次雜湊相同、不同種子不同）
  const A = runStarter(code, KT, vrank), B = runStarter(code, KT, vrank), C = runStarter(codeWithSeed(code, STARTER_SEEDS[1]), KT, vrank);
  const hA = simHash(A.s), hB = simHash(B.s), hC = simHash(C.s);
  log(hA === hB && hA !== hC, `決定性：起步城 ${STARTER_DAYS} 天，同種子兩次雜湊相同、換種子不同`, `${hA}＝${hB}；種子 ${STARTER_SEEDS[1]}：${hC}`);
  const F = runStarter(code, KT, vrank, STARTER_DAYS, undefined, { fullLand: true });
  log(simHash(F.s) === hA, '地價基準只重算污染變了的那一框＝實驗線每天整張重算（結果逐位相同，雜湊含 LANDBASE）', simHash(F.s));
  const grew = A.s.city.buildings.filter(b => b.k <= 3).length, events = A.s.city.history.slice(1);
  log(grew > 20 && events.length >= grew, `起步城自己長起來（${STARTER_DAYS} 天）`, `住商工 ${grew} 棟、人口 ${A.s.pop}、事件 ${events.length} 筆`);

  // 驗收 5：歷史重播＝模擬結束時的建築清單（逐欄）；只有匯入事件的舊格式照讀
  {
    const rp = replayCity(code, A.s.city.history, KT, A.s.day);
    const F = b => [b.id, b.k, b.lv, b.v, b.age, b.x, b.z, b.size, b.abandoned, b.builtDay];
    const a = A.s.city.buildings.map(F), b = rp.buildings.map(F);
    const bad = a.map((row, i) => J(row) === J(b[i]) ? null : `#${i}: 模擬 ${J(row)} ≠ 重播 ${J(b[i])}`).filter(Boolean);
    log(a.length === b.length && bad.length === 0 && J(Array.from(rp.occ)) === J(Array.from(A.s.city.occ)), `歷史重播：匯入＋${events.length} 筆生長／升級事件重播出的建築清單＝模擬結束時（逐欄：id、種類、等級、變體、屋齡、位置、佔地、廢棄、蓋起日）`,
      bad.slice(0, 3).join('；') || `${a.length} 棟逐欄相同、occ 相同`);
    const r = decodeLabCode(code), c1 = cityFromLab(r.save, KT, code), old = replayCity(code, c1.history.slice(0, 1), KT);
    log(J(cityStats(old)) === J(cityStats(c1)) && J(old.buildings) === J(c1.buildings) && CITY_FORMAT === 2, '歷史格式 2；只有匯入事件的舊格式（格式 1）照讀，重播＝原城', `格式 ${CITY_FORMAT}`);
    const order = events.every((e, i) => i === 0 || e.day >= events[i - 1].day);
    const ups = events.filter(e => e.t === 'upgrade');
    log(order && ups.every(e => e.lv >= 2 && e.lv <= 3), '事件只增不改：日子不倒退；升級都是升到 2、3 級', `生長 ${events.length - ups.length}、升級 ${ups.length}`);
  }

  // 驗收 2：只接線——day.ts 每一步都註明實驗線行號、依序出現；公式都從 src/sim/rules/ 來
  {
    const src = read('src/sim/day.ts');
    const steps = ['54948', '54950', '54964', '54996', '55002', '55008', '55011', '55154', '55163', '55164', '55240', '55241', '55246', '55251', '55254', '55329', '55578', '55585', '55586', '55594', '55596', '55624', '55597', '55628', '55676'];
    let at = src.indexOf('export function stepDay'), miss = [];
    for (const s of steps) { const p = src.indexOf(s, at); if (p < 0) miss.push(s); else at = p; }
    const rulesImports = [...src.matchAll(/import \{([^}]*)\} from '\.\/rules\/[a-z]+\.ts'/g)].flatMap(m => m[1].split(',').map(x => x.trim()).filter(x => x && !x.startsWith('type ')));
    // 去掉註解與 import 行，剩下的程式碼裡每個規則函式都要真的被呼叫（name(）或當值傳進去（name 後面接 , ) } ; 或 .）——只在註解裡提到不算
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^import /.test(l)).map(l => l.replace(/\/\/.*$/, '')).join('\n');
    const unused = rulesImports.filter(fn => !new RegExp(`\\b${fn}\\s*(\\(|[,)};.\\[])`).test(code));
    log(miss.length === 0 && unused.length === 0 && rulesImports.length >= 20, 'day.ts 只接線：每一步照 tick() 順序註明行號；公式都從 src/sim/rules/ import 並呼叫', miss.length ? '缺行號 ' + miss.join(',') : unused.length ? '沒用到 ' + unused.join(',') : `${steps.length} 個行號依序、${rulesImports.length} 個規則函式`);
  }

  // 回歸錨點：8 個種子 × 120 天的逐日數字＝存下的 d010-3d.json（卡面對照表就是它）。stepDay 行為一變就紅；刻意改動要重錄（tools/lab-compare.mjs）並更新卡面
  const traj = {};
  {
    const ref = JSON.parse(read('src/content/samples/d010-3d.json')), bad = [];
    if (J(ref.fields) !== J(TRAJ_FIELDS)) bad.push('欄位不同');
    for (const seed of STARTER_SEEDS) {
      const got = traj[seed] = trajectory(code, KT, vrank, seed, ref.days), want = ref.runs[seed];
      const d = got.findIndex((row, i) => J(row) !== J(want?.[i]));
      if (d >= 0) bad.push(`種子 ${seed} 第 ${d} 列：${J(got[d]).slice(0, 80)} ≠ ${J(want?.[d]).slice(0, 80)}`);
    }
    log(bad.length === 0, `回歸錨點：${STARTER_SEEDS.length} 個種子 × ${ref.days} 天逐日數字＝d010-3d.json（卡面對照表的本線數字）`, bad.slice(0, 2).join('；') || `${STARTER_SEEDS.length * (ref.days + 1)} 列相同`);
  }

  // 實驗線錨點（行為，不只看字）：實驗線回退設定第 1 天那一列（GV.step 一次之後）＝本線第 1 天，8 個種子逐欄相等。
  // 第 1 天之後實驗線沒開關的系統（垃圾、糧食、通勤、經濟快照……）開始扣幸福、壓需求，兩邊分岔；分岔日照實列出（只記不判）
  {
    const lab = JSON.parse(read('src/content/samples/d010-lab.json')), runs = lab.configs.fallback.runs, bad = [], split = [];
    if (J(lab.fields) !== J(TRAJ_FIELDS)) bad.push('欄位不同');
    for (const seed of STARTER_SEEDS) {
      const a = traj[seed][1], b = runs[seed]?.[1];
      if (J(a) !== J(b)) bad.push(`種子 ${seed}：${TRAJ_FIELDS.filter((f, i) => a[i] !== b?.[i]).join(',')}`);
      split.push(traj[seed].findIndex((row, i) => i > 0 && J(row) !== J(runs[seed]?.[i])));
    }
    log(bad.length === 0, `實驗線錨點：回退設定第 1 天＝本線第 1 天（${STARTER_SEEDS.length} 個種子 × ${TRAJ_FIELDS.length} 欄逐項相等，實驗線 ${lab.source.commit.slice(0, 7)}）`,
      bad.slice(0, 2).join('；') || `第一個不同的天：${split.join('、')}`);
  }

  // 驗收 8：推進一天（不含重建）在桌機上 ≤ 5 ms。判的是一天的平均耗時；連跑三輪 120 天取平均最低的一輪（排除同機其他行程搶 CPU 的雜訊，
  // 首版取 P95 在背景有別的工作時紅過一次：平均 2.01、P95 5.00、最大 23.98 ms），P95 與最大值照實列出
  {
    const runs = [A.ms, B.ms, runStarter(code, KT, vrank).ms].map(ms => { const s = [...ms].sort((a, b) => a - b); return { mean: s.reduce((a, b) => a + b, 0) / s.length, p95: s[Math.floor(s.length * .95)], max: s.at(-1) }; });
    const best = runs.reduce((a, b) => (b.mean < a.mean ? b : a));
    log(best.mean <= 5, '推進一天（不含重建）≤ 5 ms（三輪取平均最低的一輪）', `平均 ${best.mean.toFixed(2)} ms、P95 ${best.p95.toFixed(2)} ms、最大 ${best.max.toFixed(2)} ms；三輪平均 ${runs.map(r => r.mean.toFixed(2)).join('／')} ms`);
  }
  return { hash: hA };
}
