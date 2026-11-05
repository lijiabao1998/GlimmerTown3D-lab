// D102 施工前探針（main 18a718c／D100 b328a07 的程式碼，2026-11-04）：W1–W5 各 100 次「過一天＋存檔＋讀檔」。
// 問兩件事：(1) 現在每次退回快照，是不是只有屋齡不同？(2) 關掉鋼鐵加速，還有沒有別的自然觸發源？在倉庫根目錄跑：node docs/evidence/D102/probe-pre-d102.mjs
import assert from 'node:assert/strict';
import { loadCode, saveCode } from '../../../src/io/save.ts';
import { decodeLabCode, encodeLabCode } from '../../../src/io/labcode.ts';
import { stepDay as realStep } from '../../../src/sim/day.ts';
import { d036Runs } from '../../../tools/d036-cities.mjs';
import { d045Load } from '../../../tools/d045-cities.mjs';
import { loadMod } from '../../../tools/unit-d024.mjs';
import { dayVariant } from '../../../tools/unit-d021.mjs';

const copy = o => JSON.parse(JSON.stringify(o));
const rawOf = code => { const r = decodeLabCode(code); assert.ok(r.ok, r.error); return r.save.raw; };
const plain = raw => { const o = copy(raw); delete o.d3; delete o.z; return o; };
const CMS = { act: 'steel80', st: 150, acc: 12.5, hold: 0, n: 3, done: [] };
let CITY = 'W2';
function wellStart() {
  const ctx = d045Load(), raw = plain(rawOf(d036Runs().find(r => r.id === CITY).code));
  raw.cms385 = copy(CMS); raw.unknownD046 = { keep: ['opaque', 7, { precision: .125 }] };
  return { ...ctx, code: encodeLabCode(raw) };
}
// 不比屋齡的讀檔：只拿來量，不是修法
const ageBlind = await loadMod('src/io/save.ts', [
  ['const sa = JSON.stringify(cityStats(a)), sb = JSON.stringify(cityStats(b));',
   'const noAge = s => ({ ...s, roots: s.roots.map(r => [r[0], r[1], r[2], r[4]]) }); const sa = JSON.stringify(noAge(cityStats(a))), sb = JSON.stringify(noAge(cityStats(b)));'],
  ['const key = (q: CityBuilding) => [q.x, q.z, q.k, q.lv, q.v, q.age].join(\',\');',
   'const key = (q: CityBuilding) => [q.x, q.z, q.k, q.lv, q.v].join(\',\');'],
  ['  const bad = mismatch(c, sim.city);\n',
   '  const bad = mismatch(c, sim.city);\n  { const m = new Map(c.buildings.filter(q => q.goneDay === undefined).map(q => [q.z * c.n + q.x, q.age])); __probe.diffs = sim.city.buildings.filter(q => q.goneDay === undefined).map(q => [q.age, m.get(q.z * c.n + q.x)]).filter(([s, r]) => s !== r); }\n'],
  ['function mismatch(', 'export const __probe = { diffs: null };\nfunction mismatch('],
]);
const noSteel = await dayVariant([[
  'const cons = steelConstruction(s.econ, cnt.steelMillN ?? 0, w, tickBld, s.day);',
  'const cons = 0;',
]]);

function run(label, step, loader, probe) {
  const ctx = wellStart(); let L = loader.loadCode(ctx.code, ctx.KT, ctx.vrank); assert.ok(L.ok);
  const falls = [], notes = new Map(), diffStats = [];
  for (let i = 0; i < 100; i++) {
    step(L.sim);
    const code = saveCode(L.sim, L.template, L.start);
    L = loader.loadCode(code, ctx.KT, ctx.vrank); assert.ok(L.ok, L.error);
    if (!L.replayed) {
      falls.push(i + 1); const why = L.note.replace(/：.*$/, '') + '：' + L.note.split('：').slice(1).join('：').replace(/\d+/g, 'N');
      notes.set(why, (notes.get(why) || 0) + 1);
      if (probe) {
        const P = ageBlind.loadCode(code, ctx.KT, ctx.vrank);
        const d = ageBlind.__probe.diffs ?? [];
        diffStats.push({ cycle: i + 1, ageBlindReplays: P.replayed, ageBlindNote: P.replayed ? '' : P.note, n: d.length,
          allSnapshotOlder: d.every(([s, r]) => s > r), maxGap: Math.max(0, ...d.map(([s, r]) => s - r)), minGap: Math.min(...d.map(([s, r]) => s - r)),
          snapshotAgesUnder14: d.every(([s]) => s <= 14) });
      }
    }
  }
  return { label, falls: falls.length, firstFall: falls[0] ?? null, notes: Object.fromEntries(notes), diffStats };
}

const t0 = performance.now(), out = {};
const sum = d => ({ falls: d.length, allAgeBlindReplay: d.every(x => x.ageBlindReplays), allSnapshotOlder: d.every(x => x.allSnapshotOlder),
  diffBuildings: d.length ? [Math.min(...d.map(x => x.n)), Math.max(...d.map(x => x.n))] : null, gap: d.length ? [Math.min(...d.map(x => x.minGap)), Math.max(...d.map(x => x.maxGap))] : null,
  nonBlind: d.filter(x => !x.ageBlindReplays).map(x => [x.cycle, x.ageBlindNote]) });
for (const id of ['W1', 'W2', 'W3', 'W4', 'W5']) {
  CITY = id;
  const real = run('on', realStep, { loadCode }, true), blind = run('blind', realStep, ageBlind, false), off = run('off', noSteel.stepDay, { loadCode }, false);
  out[id] = { real: { falls: real.falls, first: real.firstFall, notes: real.notes, ...sum(real.diffStats) }, ageBlindFalls: blind.falls, ageBlindNotes: blind.notes, steelOffFalls: off.falls, steelOffNotes: off.notes };
}
console.log(JSON.stringify({ node: process.version, seconds: Math.round((performance.now() - t0) / 1000), out }, null, 1));
