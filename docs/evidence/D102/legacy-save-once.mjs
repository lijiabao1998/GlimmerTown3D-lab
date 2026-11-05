// D102 舊存檔實測（2026-11-04）：用「D100 的 day.ts」（D102 加的五處拿掉）把 W2、W4 連續推 13／30 天（像一般玩家一口氣玩、中間不重開）存成舊存檔（f ≤ 10、沒有 hasten），
// 再用現行程式讀：第一次讀要退回快照（歷史從那張碼重新起算），之後每天存讀都要重播。在倉庫根目錄跑：node docs/evidence/D102/legacy-save-once.mjs
import fs from 'node:fs';
import { loadCode, saveCode } from '../../../src/io/save.ts';
import { decodeLabCode, encodeLabCode } from '../../../src/io/labcode.ts';
import { stepDay } from '../../../src/sim/day.ts';
import { d036Runs, builtBase } from '../../../tools/d036-cities.mjs';
import { dayVariant } from '../../../tools/unit-d021.mjs';
const { KT, vrank } = builtBase();
const src = fs.readFileSync(new URL('../../../src/sim/day.ts', import.meta.url), 'utf8'), line = re => src.match(re)[0];
const D100 = await dayVariant([
  [line(/^  const age418 = .*\n/m), ''], [line(/^  const hastened = .*\n/m), ''], ['hastened, ups, mgs);', 'ups, mgs);'],
  ['grown: { i: number; b: Bld }[], hastened: readonly number[], ups:', 'grown: { i: number; b: Bld }[], ups:'],
  [line(/^  \/\/ D102（城市格式 11）：煉鋼廠加速施工（在生長[^\n]*\n  if \(hastened\.length\) \{\n[\s\S]*?\n  \}\n/m), ''],
]);
const plain = raw => { const o = JSON.parse(JSON.stringify(raw)); delete o.d3; delete o.z; return o; };
const out = {};
for (const [id, days] of [['W2', 13], ['W4', 30]]) {
  let L = loadCode(encodeLabCode(plain(decodeLabCode(d036Runs().find(r => r.id === id).code).save.raw), { deflate: true }), KT, vrank);
  let cons = 0; for (let d = 0; d < days; d++) cons += D100.stepDay(L.sim).econ.cons;
  const legacy = saveCode(L.sim, L.template, L.start), f = decodeLabCode(legacy).save.raw.d3.f;
  let M = loadCode(legacy, KT, vrank); const first = { replayed: M.replayed, note: M.note };
  let later = 0, hasten = 0;
  for (let d = 0; d < 30; d++) { stepDay(M.sim); M = loadCode(saveCode(M.sim, M.template, M.start), KT, vrank); if (!M.replayed) later++; }
  hasten = M.sim.city.history.filter(e => e.t === 'hasten').length;
  out[id] = { legacyDays: days, unrecordedAccelerationsInLegacySave: cons, legacyFormat: f, firstLoad: first, laterFallbacksIn30Days: later, hastenDaysRecordedAfter: hasten };
}
console.log(JSON.stringify({ node: process.version, out }, null, 1));
