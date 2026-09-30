// 機器速度校準守衛（D030 補，tools/speed-probe.mjs）：煙霧測試 D011 驗收 8 的門檻乘的那個係數，算法本身要證：
//   1. 係數的形狀：比開發機快（或一樣）＝1（不更嚴、也不更鬆）；成比例；慢到兩倍以上封頂 2；單調不減；門檻＝5 × 係數。
//   2. 探針跟遊戲程式碼無關（沒有 __gt、import、亂數）、工作固定：Node 裡連跑兩次，結果 sink 相同、固定值（探針被編譯器整段丟掉時，這個數會變），時間是有限的正數。
//   3. 校準吃不掉退步：門檻只看探針、不看被量的模擬；同一個探針值，模擬的量測值多 10％，判定就從綠變紅（在校準後的門檻上）。
//   4. 突變：拿掉下限、拿掉上限、係數改成平方、門檻不乘係數，每一個都要被 1 的某一項抓到。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import * as SP from './speed-probe.mjs';
import { loadMod } from './unit-d024.mjs';

const REL = 'tools/speed-probe.mjs';
const SINK = 487760;   // 探針固定的工作結果（改探針時重算並更新這裡）

function shapeOk(M) {
  const R = M.SPEED_REF_MS, why = [];
  if (M.speedFactor(R * 0.5) !== 1) why.push('比開發機快要＝1');
  if (M.speedFactor(R) !== 1) why.push('一樣快要＝1');
  if (Math.abs(M.speedFactor(R * 1.3) - 1.3) > 1e-9) why.push('1.3 倍要＝1.3');
  if (M.speedFactor(R * 5) !== 2) why.push('5 倍要封頂 2');
  if (M.speedLimit(5, R) !== 5) why.push('一樣快門檻＝5');
  if (Math.abs(M.speedLimit(5, R * 1.3) - 6.5) > 1e-9) why.push('1.3 倍門檻＝6.5');
  if (M.speedLimit(5, R * 9) !== 10) why.push('封頂門檻＝10');
  let prev = 0; for (let i = 1; i <= 40; i++) { const f = M.speedFactor(R * i / 10); if (f < prev) why.push('單調不減'); prev = f; }
  return why;
}

export async function speedGuards(log) {
  const why = shapeOk(SP);
  log(why.length === 0, '機器速度校準：係數形狀（下限 1、成比例、上限 2、單調、門檻＝5×係數）', why.join('、') || `基準 ${SP.SPEED_REF_MS} ms、上限 ${SP.SPEED_CAP}`);
  const src = fs.readFileSync(path.join(ROOT, REL), 'utf8'), probeTxt = SP.SPEED_PROBE;
  log(!/__gt|import\s|Math\.random|Date\.now|fetch\(/.test(probeTxt), '探針跟遊戲程式碼無關：沒有 __gt、import、亂數、網路', `${probeTxt.length} 字`);
  const r1 = (0, eval)(probeTxt), r2 = (0, eval)(probeTxt);
  log(r1.sink === SINK && r2.sink === SINK && Number.isFinite(r1.ms) && r1.ms > 0 && Number.isFinite(r2.ms), '探針的工作固定（sink 兩次相同、＝釘住的值），時間是有限正數', `sink ${r1.sink}／${r2.sink}，Node 裡 ${r1.ms.toFixed(2)}、${r2.ms.toFixed(2)} ms`);
  // 校準吃不掉退步：同一個探針值（這台機器速度不變）、模擬多 10％
  const probe = SP.SPEED_REF_MS * 1.25, lim = SP.speedLimit(5, probe), ok0 = lim * 0.97, bad = ok0 * 1.1;
  log(ok0 <= lim && bad > lim, '校準吃不掉退步：探針不變、模擬的量測值多 10％，判定從綠變紅', `上限 ${lim.toFixed(2)} ms；${ok0.toFixed(2)} → ${bad.toFixed(2)} ms`);
  const muts = [
    ['拿掉下限', 'Math.max(1, probeMs / SPEED_REF_MS)', 'probeMs / SPEED_REF_MS'],
    ['拿掉上限', 'Math.min(SPEED_CAP, Math.max(1, probeMs / SPEED_REF_MS))', 'Math.max(1, probeMs / SPEED_REF_MS)'],
    ['係數平方', 'Math.max(1, probeMs / SPEED_REF_MS))', 'Math.max(1, probeMs / SPEED_REF_MS) ** 2)'],
    ['門檻不乘係數', 'baseMs * speedFactor(probeMs)', 'baseMs'],
  ];
  const missed = [];
  for (const [name, a, b] of muts) { const M = await loadMod(REL, [[a, b]]); if (shapeOk(M).length === 0) missed.push(name); }
  log(missed.length === 0, `突變 ${muts.length} 個都被抓到（下限、上限、平方、門檻不乘係數）`, missed.join('、') || '全部紅');
  log(src.includes('SPEED_REF_MS = 5.9'), '基準值寫在檔案裡（改了要同步改卡面）', 'SPEED_REF_MS = 5.9');
}
