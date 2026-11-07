// D102：煉鋼廠加速施工記進世界歷史（事件 25 hasten、城市格式 11），修好「讀檔退回快照」的根因。
// 可單獨執行：node tools/unit-d102-history.mjs（transit.yml 會跑）。驗收條件在 docs/D102-steel-construction-history.md。
// 「D100 的 day.ts」＝把 D102 加的五處原樣拿掉，套完要跟 lease 記的 D100 位元組逐字相同（fixtures/d102/source.json）；
// 歷史守衛（unit-d046-fallback、unit-d036-live）用的簡化版只把交給 syncCity 的 hastened 換成空清單，「驗收 2、3」那一項逐日核它跟 D100 版存出一樣的碼。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadCode, saveCode, SAVE_LIMIT, packHistory, unpackHistory, checkHistory, historyFormat } from '../src/io/save.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { stepDay, simHash } from '../src/sim/day.ts';
import { commitOp } from '../src/sim/edit.ts';
import { EVENT_REGISTRY, EVENT_BY_CODE, CITY_FORMAT, minimumEventFormat, eventFormat } from '../src/sim/eventRegistry.ts';
import { cityFromLab } from '../src/sim/city.ts';
import { replayCity } from '../src/sim/replay.ts';
import { packMore, PACK0 } from '../src/io/journal.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { d036Runs, builtBase } from './d036-cities.mjs';
import { cities25 } from './d025-cities.mjs';
import * as M34 from './d034-cities.mjs';
import { dayVariant } from './unit-d021.mjs';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const copy = o => JSON.parse(JSON.stringify(o));
const rawOf = code => { const r = decodeLabCode(code); assert.ok(r.ok, r.error); return r.save.raw; };
const plain = raw => { const o = copy(raw); delete o.d3; delete o.z; return o; };
const { KT, vrank } = builtBase();
const G = cities25(read('src/content/samples/newcity.code.txt'), kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))));
const G8 = G.find(c => c.id === 'G8').code, G13 = G.find(c => c.id === 'G13').code;
const startOf = id => id === 'G8' ? G8 : id === 'G13' ? G13 : encodeLabCode(plain(rawOf(d036Runs().find(r => r.id === id).code)), { deflate: true });
const load = (code, api = { loadCode }) => { const L = api.loadCode(code, KT, vrank); assert.ok(L.ok, L.error); return L; };
// 所有建築（含墓碑）逐欄：讀回來要跟存之前的一樣。外觀變體 v 不比——讀檔照實驗線重挑外觀（D012 restyle，記成歷史事件）是既有行為
const census = c => c.buildings.map(b => [b.id, b.x, b.z, b.k, b.lv, b.age, b.goneDay ?? -1]);
const hastenIds = h => h.filter(e => e.t === 'hasten').reduce((n, e) => n + e.ids.length, 0);
// 同一天的事件順序：生長、升級 → 加速 → 合併、災禍。回傳違反的天數
const orderBreaks = h => {
  const days = new Map();
  for (const e of h) if (['grow', 'upgrade', 'hasten', 'merge', 'burn', 'abandon'].includes(e.t)) { if (!days.has(e.day)) days.set(e.day, []); days.get(e.day).push(e.t); }
  let bad = 0;
  for (const ts of days.values()) { const at = ts.indexOf('hasten'); if (at >= 0 && !(ts.slice(0, at).every(t => t === 'grow' || t === 'upgrade') && ts.slice(at + 1).every(t => t !== 'grow' && t !== 'upgrade' && t !== 'hasten'))) bad++; }
  return bad;
};
const LEGACY = [['hastened, ups, mgs);', '[], ups, mgs);']];
const HASTEN_BLOCK = /^  \/\/ D102（城市格式 11）：煉鋼廠加速施工（在生長[^\n]*\n  if \(hastened\.length\) \{\n[\s\S]*?\n  \}\n/m;
function d100DayEdits() {
  const src = read('src/sim/day.ts'), line = re => { const m = src.match(re); assert.ok(m, String(re)); return m[0]; };
  return [
    [line(/^  const age418 = .*\n/m), ''],
    [line(/^  const hastened = .*\n/m), ''],
    ['hastened, ups, mgs);', 'ups, mgs);'],
    ['grown: { i: number; b: Bld }[], hastened: readonly number[], ups:', 'grown: { i: number; b: Bld }[], ups:'],
    [line(HASTEN_BLOCK), ''],
  ];
}
// 玩家每天在路邊空地劃幾格住商工，逼城長新房（有煉鋼廠時，新房生長當天就可能被加速：spawnStep 把新格接到 tickBld 後面）
function zoneSome(s, t0) {
  const N = s.w.N; let q = 0, t = t0;
  s.money = Math.max(s.money, 1e6);
  for (let i = 0; i < N * N && q < 12; i++) {
    const tl = s.w.tiles[i]; if (tl.bld || tl.road || tl.zone || tl.ruin || (tl.t !== 1 && tl.t !== 2)) continue;
    const x = i % N, z = (i / N) | 0; let near = false;
    for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && zz >= 0 && xx < N && zz < N && s.w.tiles[zz * N + xx].road) { near = true; break; } }
    if (!near) continue;
    t += 5000; if (commitOp(s, { k: 'rect', tool: ['zr', 'zc', 'zi'][q % 3], x0: x, z0: z, x1: x, z1: z }, t).ok) q++;
  }
  return t;
}
function growingSteelCity(day, days = 40) {
  let L = load(G13), t = 0, sameGrow = 0, total = 0, falls = 0, err = null;
  try {
    for (let d = 0; d < days; d++) {
      t = zoneSome(L.sim, t); day.stepDay(L.sim);
      const s = L.sim, h = s.city.history.find(e => e.day === s.day && e.t === 'hasten');
      if (h) { total += h.ids.length; for (const id of h.ids) if (s.city.buildings[id - 1].builtDay === s.day) sameGrow++; }
      const before = census(s.city); L = load(saveCode(s, L.template, L.start));
      if (!L.replayed) falls++; else assert.deepEqual(census(L.sim.city), before, `G13 第 ${s.day} 天讀回的建築不同`);
    }
  } catch (e) { err = e.message; }
  return { sameGrow, total, falls, err };
}

// 造城：D034 的 M1 版型（2×2 住宅／商業簇、幸福 .6–.8、會合併成塔）＋五座煉鋼廠＋鋼 400＋全部屋齡 0（施工中）＋一棟起火的。
// 頭幾天幾乎每棟都被加速，所以同一天被合併吸收、被燒毀的房子很可能剛被加速過（自然軌跡裡 W／G 城跑到 200–400 天都撞不到）。
// 種子是掃出來的：5164047 有同日「加速＋合併吸收」、5164042 有同日「加速＋燒毀」
function steelMergeCity(seed) {
  return M34.mk(seed, 150, '加速合併', b => {
    M34.base(b); M34.pipes(b, 5, 50); M34.services(b);
    const cl = (x, z, kind, n) => { M34.zoneRect(b, x, z, x + 1, z + 1, kind); for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) kind === 1 ? M34.tryPut(b, x + dx, z + dz, 1, 3, { den: 1 + ((n + dx + dz * 2) % 5), we: (n + dx + dz * 2) % 3, age: 0 }) : M34.tryPut(b, x + dx, z + dz, 2, 3, { age: 0 }); };
    [10, 14, 18, 22, 26, 30, 34, 38].forEach((x, n) => { cl(x, 28, 1, n); cl(x + 2, 28, 2, 0); });
    [10, 14].forEach((x, n) => { cl(x, 31, 1, n + 4); cl(x + 2, 31, 2, 0); });
    M34.parksAt(b, [10, 14, 18, 22, 26, 30, 34, 38, 42], 26); M34.parksAt(b, [10, 14, 18], 34);
    for (const x of [52, 55, 58, 61, 64]) for (const z of [31, 33]) M34.tryPut(b, x, z, 122, 1);
    M34.tryPut(b, 26, 28, 1, 3, { den: 3, we: 1, fire: 1, age: 0 });
  }, { steel364: 400 });
}
function overlapRun(code, day, days = 20) {
  let L = load(code), merge = 0, burn = 0, falls = 0, err = null;
  try {
    for (let d = 0; d < days; d++) {
      day.stepDay(L.sim); const s = L.sim, today = s.city.history.filter(e => e.day === s.day), h = today.find(e => e.t === 'hasten'), set = new Set(h ? h.ids : []);
      for (const e of today) { if (e.t === 'merge') merge += e.from.filter(x => set.has(x)).length; if (e.t === 'burn' && set.has(e.id)) burn++; }
      const before = census(s.city); L = load(saveCode(s, L.template, L.start));
      if (!L.replayed) falls++; else assert.deepEqual(census(L.sim.city), before, `第 ${s.day} 天讀回的建築（含墓碑）不同`);
    }
  } catch (e) { err = e.message; }
  return { merge, burn, falls, err };
}

export async function d102HistoryGuards(log) {
  const run = async (name, fn) => {
    try { log(true, 'D102 ' + name, await fn()); }
    catch (e) { log(false, 'D102 ' + name, `${e.name}: ${e.message}`); }
  };
  const legacy = await dayVariant(LEGACY);
  const before = JSON.parse(read('fixtures/d102/source.json')).modified['src/sim/day.ts'].before;
  let d100 = null;
  await run('D100 的 day.ts：拿掉 D102 的五處之後跟 lease 記的 D100 位元組逐字相同', async () => {
    const edits = d100DayEdits(); let src = read('src/sim/day.ts');
    for (const [a, b] of edits) { assert.equal(src.split(a).length, 2, a.slice(0, 60)); src = src.replace(a, b); }
    assert.equal(src, before, '套完五處要等於 D100 的 day.ts');
    d100 = await dayVariant(edits);
    return `五處替換後 ${src.length} 字元，與 fixtures/d102/source.json 的 before 逐字相同`;
  });

  await run('驗收 1：W2、W4 各 100 次「過一天＋存檔＋讀檔」0 次退回；全部建築（含墓碑）的位置、種類、等級、屋齡讀回相同；加速棟次＝每天施工耗鋼總和', () => {
    const out = [];
    for (const id of ['W2', 'W4']) {
      const start = startOf(id); let L = load(start), cons = 0, max = 0;
      for (let i = 0; i < 100; i++) {
        const rep = stepDay(L.sim); cons += rep.econ.cons;
        const before = census(L.sim.city), code = saveCode(L.sim, L.template, L.start);
        max = Math.max(max, code.length); assert.ok(code.length < SAVE_LIMIT);
        L = load(code);
        assert.ok(L.replayed, `${id} 第 ${i + 1} 次退回快照：${L.note}`);
        assert.equal(L.start, start, `${id} 起始碼不換`);
        assert.deepEqual(census(L.sim.city), before, `${id} 第 ${i + 1} 次讀回的建築（含墓碑）不同`);
      }
      const h = L.sim.city.history, ids = hastenIds(h), days = h.filter(e => e.t === 'hasten').length;
      assert.ok(cons > 0, `${id} 要真的有鋼材加速施工`); assert.equal(ids, cons, `${id} 歷史裡的加速棟次＝施工耗鋼總和`);
      assert.equal(orderBreaks(h), 0, `${id} 每天的事件順序：生長、升級 → 加速 → 合併、災禍`);
      assert.equal(rawOf(saveCode(L.sim, L.template, L.start)).d3.f, 11);
      out.push(`${id}：加速 ${ids} 棟次／${days} 天、最大 ${max} 字元`);
    }
    return out.join('；');
  });

  await run('驗收 2、3：跟 D100 的 day.ts 逐日比——沒碰到加速的城存檔逐位元組相同；有加速的城實驗線欄位逐位元組相同；simHash 與施工耗鋼逐日相同；簡化版 day.ts 跟 D100 版存檔相同', () => {
    assert.ok(d100, 'D100 的 day.ts 要先建好');
    const out = [];
    for (const id of ['W1', 'W2', 'W3', 'W4', 'W5', 'G8']) {
      const start = startOf(id), A = load(start), B = load(start), C = load(start); let same = 0, lab = 0;
      for (let d = 0; d < 30; d++) {
        const ra = stepDay(A.sim), rb = d100.stepDay(B.sim); legacy.stepDay(C.sim);
        assert.equal(simHash(A.sim), simHash(B.sim), `${id} 第 ${d + 1} 天 simHash`);
        assert.equal(ra.econ.cons, rb.econ.cons, `${id} 第 ${d + 1} 天施工耗鋼`);
        const ca = saveCode(A.sim, A.template, A.start), cb = saveCode(B.sim, B.template, B.start);
        assert.equal(saveCode(C.sim, C.template, C.start), cb, `${id} 第 ${d + 1} 天簡化版與 D100 版的存檔要相同`);
        if (!A.sim.city.history.some(e => e.t === 'hasten')) { assert.equal(ca, cb, `${id} 第 ${d + 1} 天沒有加速，存檔要逐位元組相同`); same++; }
        else { assert.deepEqual(plain(rawOf(ca)), plain(rawOf(cb)), `${id} 第 ${d + 1} 天實驗線看得到的欄位`); assert.equal(rawOf(ca).d3.f, 11); assert.ok(rawOf(cb).d3.f <= 10); lab++; }
      }
      out.push(`${id} 逐位 ${same} 天／實驗線欄位 ${lab} 天`);
    }
    return out.join('、');
  });

  await run('驗收 4：屋齡規則——匯入的、升級當天、生長當天、隔天、同日合併與燒毀的墓碑；有煉鋼廠又在長的城（G13＋每天劃區）生長當天被加速、讀回照常', () => {
    const imp = cityFromLab(decodeLabCode(G8).save, KT, G8), D0 = imp.day, first = imp.history[0];
    const at = (x, z) => imp.buildings.find(b => b.x === x && b.z === z);
    const h3 = at(11, 31), h4 = at(12, 31), h8 = at(16, 31), h0 = at(8, 31), h1 = at(9, 31);   // 住宅屋齡 i％9：3、4、8、0、1
    assert.deepEqual([h3.age, h4.age, h8.age, h0.age, h1.age], [3, 4, 8, 0, 1]);
    const age = (events, end, id) => replayCity(G8, [first, ...events], KT, end).buildings[id - 1].age;
    const d1 = D0 + 1, grown = imp.buildings.length + 1, g = { day: d1, t: 'grow', x: 40, z: 20, k: 1, lv: 1, v: 0 };
    assert.equal(age([{ day: d1, t: 'hasten', ids: [h3.id] }], d1, h3.id), 3 + 1 + 1, '匯入的');
    assert.equal(age([{ day: d1, t: 'hasten', ids: [h3.id] }], D0 + 5, h3.id), 3 + 5 + 1, '之後照常一天一歲');
    assert.equal(age([{ day: d1, t: 'upgrade', x: h4.x, z: h4.z, k: h4.k, lv: 2, v: h4.v }, { day: d1, t: 'hasten', ids: [h4.id] }], d1, h4.id), 0 + 1, '升級當天歸零再 +1');
    assert.equal(age([g, { day: d1, t: 'hasten', ids: [grown] }], d1, grown), 1 + 1, '生長當天（新房接在 tickBld 後面，當天就可能被加速）');
    assert.equal(age([g, { day: d1 + 1, t: 'hasten', ids: [grown] }], d1 + 1, grown), 1 + 1 + 1, '生長隔天');
    const merged = replayCity(G8, [first, { day: d1, t: 'hasten', ids: [h0.id, h1.id] }, { day: d1, t: 'merge', x: 8, z: 30, k: 33, size: 2, v: 0, from: [h0.id, h1.id] }], KT, d1 + 3);
    assert.deepEqual([merged.buildings[h0.id - 1].age, merged.buildings[h1.id - 1].age, merged.buildings[h0.id - 1].goneDay], [0 + 1 + 1, 1 + 1 + 1, d1], '同日合併的墓碑屋齡停在含加速的那一天');
    const burned = replayCity(G8, [first, { day: d1, t: 'hasten', ids: [h3.id] }, { day: d1, t: 'burn', x: h3.x, z: h3.z, k: h3.k, id: h3.id }], KT, d1 + 4);
    assert.equal(burned.buildings[h3.id - 1].age, 3 + 1 + 1, '同日燒毀的墓碑');
    for (const [name, events, re] of [
      ['合併之後才加速（排錯順序）', [{ day: d1, t: 'merge', x: 8, z: 30, k: 33, size: 2, v: 0, from: [h0.id, h1.id] }, { day: d1, t: 'hasten', ids: [h0.id] }], new RegExp(`#${h0.id} 已經拆掉`)],
      ['屋齡已滿 9 天', [{ day: d1, t: 'hasten', ids: [h8.id] }], /屋齡已滿 9 天/],
      ['不存在的編號', [{ day: d1, t: 'hasten', ids: [99999] }], /沒有編號 #99999 的建築/],
      ['重複的編號', [{ day: d1, t: 'hasten', ids: [h3.id, h3.id] }], /沒有由小到大/],
    ]) assert.throws(() => replayCity(G8, [first, ...events], KT, d1), re, name);
    const live = growingSteelCity({ stepDay });
    assert.equal(live.err, null); assert.equal(live.falls, 0, 'G13 每天存讀都要重播');
    assert.ok(live.sameGrow > 0, '要真的有生長當天被加速的房子');
    const mg = overlapRun(steelMergeCity(5164047), { stepDay }), bn = overlapRun(steelMergeCity(5164042), { stepDay });
    for (const [name, r] of [['合併', mg], ['燒毀', bn]]) { assert.equal(r.err, null, name); assert.equal(r.falls, 0, `${name}城每天存讀都要重播`); }
    assert.ok(mg.merge > 0, '要真的有同一天被加速又被合併吸收的房子'); assert.ok(bn.burn > 0, '要真的有同一天被加速又燒毀的房子');
    return `8 種屋齡情境＋4 種重播例外；G13 劃區 40 天：加速 ${live.total} 棟次，其中 ${live.sameGrow} 棟次是生長當天；造城 20 天：同日加速＋合併吸收 ${mg.merge} 棟、同日加速＋燒毀 ${bn.burn} 棟；全部 0 次退回、墓碑屋齡讀回與模擬相同`;
  });

  await run('驗收 5：竄改照舊攔住，原因講得出是哪一種——不存在、已拆、重複、沒排序、空、非整數、屋齡 ≥ 9、冒用格式 10、格式 13；退回後下一次正常重播', () => {
    let L = load(startOf('W4'));
    for (let i = 0; i < 40; i++) { stepDay(L.sim); L = load(saveCode(L.sim, L.template, L.start)); assert.ok(L.replayed); }
    const pristine = rawOf(saveCode(L.sim, L.template, L.start)), rows = pristine.d3.r, k = rows.findIndex(r => r[0] === 25);
    assert.ok(k > 0 && pristine.d3.hv === 2, '要有 hasten 列');
    const old = L.sim.city.buildings.find(b => b.goneDay === undefined && b.age >= 60);   // 40 天前就滿 9 天的老房子
    const gone = L.sim.city.buildings.find(b => b.goneDay !== undefined);
    assert.ok(old, '要有老房子'); assert.ok(gone, '要有墓碑（「已拆的建築」這一種才測得到）');
    const cases = [
      ['不存在的編號', r => { r.d3.r[k] = [25, r.d3.r[k][1], 99999]; }, /歷史重播失敗.*沒有編號 #99999 的建築/],
      ['重複', r => { r.d3.r[k] = [25, r.d3.r[k][1], r.d3.r[k][2], r.d3.r[k][2]]; }, /加速施工的編號順序/],
      ['沒排序', r => { const ids = r.d3.r[k].slice(2); if (ids.length < 2) ids.push(ids[0] + 1); r.d3.r[k] = [25, r.d3.r[k][1], ...ids.reverse()]; }, /加速施工的編號順序/],
      ['空清單', r => { r.d3.r[k] = [25, r.d3.r[k][1]]; }, /加速施工清單/],
      ['非整數', r => { r.d3.r[k] = [25, r.d3.r[k][1], 1.5]; }, /加速施工的建築編號/],
      ['屋齡 ≥ 9（換成老房子）', r => { r.d3.r[k] = [25, r.d3.r[k][1], old.id]; }, /屋齡已滿 9 天/],
      ['冒用格式 10', r => { r.d3.f = 10; }, /需要城市格式 11/],
      ['格式 13（比這一版新）', r => { r.d3.f = 13; }, /城市格式 13 比這一版（12）新/],
      ['已拆的建築', r => { r.d3.r.push([25, 0, gone.id]); }, new RegExp(`#${gone.id} 已經拆掉`)],
    ];
    for (const [name, edit, re] of cases) {
      const raw = copy(pristine); edit(raw); delete raw.z;
      const B = load(encodeLabCode(raw, { deflate: true }));
      assert.equal(B.replayed, false, name); assert.match(B.note, re, `${name}：${B.note}`);
      const again = load(saveCode(B.sim, B.template, B.start));
      assert.ok(again.replayed, `${name}：退回後下一次要正常重播 ${again.note}`);
    }
    return `${cases.length} 種竄改全部退回快照、原因字串各自對得上；退回後下一次照常重播`;
  });

  await run('驗收 6：格式 12（D101 起）、登記 27 種、碼 25 的黃金列、每個切點的 packMore、hv1 物件、壞列被擋、碼 26 是 D101 的 transit、第一個沒用過的碼 27 照舊不認得', () => {
    assert.equal(CITY_FORMAT, 12); assert.equal(Object.keys(EVENT_REGISTRY).length, 27);
    assert.deepEqual([EVENT_REGISTRY.hasten.code, EVENT_REGISTRY.hasten.format, [...EVENT_REGISTRY.hasten.fields], EVENT_BY_CODE[25], EVENT_BY_CODE[26], EVENT_BY_CODE[27]], [25, 11, ['ids'], 'hasten', 'transit', undefined]);
    const e = { day: 7, t: 'hasten', ids: [2, 5, 9] };
    assert.equal(minimumEventFormat(e), 11); assert.equal(eventFormat(e), 11);
    const h = [{ day: 7, t: 'cms', ev: 'accept', id: 'steel40' }, e, { day: 9, t: 'hasten', ids: [3] }];
    assert.deepEqual(packHistory(h), [[24, 7, 0, 0], [25, 0, 2, 5, 9], [25, 2, 3]]);
    assert.deepEqual(unpackHistory(packHistory(h), 72), h); assert.deepEqual(checkHistory(copy(h), 72), h);
    for (let k = 0; k <= h.length; k++) { const a = packMore(h.slice(0, k), PACK0); assert.deepEqual([...a.rows, ...packMore(h, a.st).rows], packHistory(h)); }
    const cache = []; assert.equal(historyFormat(cache), 4); cache.push(h[0]); assert.equal(historyFormat(cache), 10); cache.push(e); assert.equal(historyFormat(cache), 11);
    const bad = [[25, 0], [25, 0, 0], [25, 0, 3, 3], [25, 0, 5, 2], [25, 0, 1.5], [25, 0, '1'], [25, 0, -1], [25, .5, 1], [25, 0, 2 ** 31 + 1], [25, 0, ...Array.from({ length: 5 }, (_, i) => i + 1)]];
    for (const row of bad) assert.throws(() => unpackHistory([row], 2), Error, JSON.stringify(row));
    assert.throws(() => unpackHistory([[27, 0]], 2), /種類不對/, '碼 27 還沒登記');
    assert.deepEqual(unpackHistory([[25, 0, 1, 2, 3, 4]], 2), [{ day: 0, t: 'hasten', ids: [1, 2, 3, 4] }], 'n²＝4 棟是上限');
    return '27 種（D101 起）、碼 25／格式 11、黃金列、4 個切點、hv1、10 種壞列、碼 27 不認得';
  });

  await run('驗收 7：突變控制——拿掉記錄、重播不加歲、記少一棟、排到合併之後、對編號早於登記新房，每一種都抓得到', async () => {
    assert.ok(d100, 'D100 的 day.ts 要先建好');
    const falls = async (api, dayApi, id = 'W2', n = 12) => {
      let L = load(startOf(id), api), f = 0;
      for (let i = 0; i < n; i++) { dayApi.stepDay(L.sim); L = load(saveCode(L.sim, L.template, L.start), api); if (!L.replayed) f++; }
      return f;
    };
    assert.equal(await falls({ loadCode }, { stepDay }), 0);
    const a = await falls({ loadCode }, d100); assert.ok(a > 0, '拿掉記錄（D100 的 day.ts）要退回');
    const R = await loadMod('src/sim/replay.ts', [['          s.age += 1; prev = id;', '          prev = id;']]);
    const S = await loadMod('src/io/save.ts', [], { '../sim/replay.ts': R });
    const b = await falls(S, { stepDay }); assert.ok(b > 0, '重播不加歲要退回');
    const short = await dayVariant([['return cb.id; }).sort((a, b) => a - b);', 'return cb.id; }).sort((a, b) => a - b).slice(1);'], ["    c.history.push({ day: s.day, t: 'hasten', ids });", "    if (ids.length) c.history.push({ day: s.day, t: 'hasten', ids });"]]);
    const c = await falls({ loadCode }, short); assert.ok(c > 0, '記少一棟要退回');
    // (c) 推到合併之後：跟驗收 1 同一條軌跡（每天存讀；讀檔照實驗線用 seed^day 重設亂數，連續跑是另一條軌跡），有好幾天同時有加速與合併，順序檢查要抓到
    const block = read('src/sim/day.ts').match(HASTEN_BLOCK)[0];
    const tail = '  for (const [i, cb] of s.root) { const b = s.w.tiles[i].bld; if (b) { cb.age = b.age; cb.lv = b.lv; cb.v = b.v; } }\n';
    const late = await dayVariant([[block, ''], [tail, block + tail]]);
    let W = load(startOf('W2')); for (let i = 0; i < 100; i++) { late.stepDay(W.sim); W = load(saveCode(W.sim, W.template, W.start)); }
    const breaks = orderBreaks(W.sim.city.history); assert.ok(breaks > 0, '排到合併之後要被順序檢查抓到');
    const lm = overlapRun(steelMergeCity(5164047), late); assert.ok(lm.err || lm.falls > 0, '排到合併之後，同日被吸收的房子在造城上要出事（丟例外或退回）');
    // (e) 對編號早於登記新房：生長當天被加速的新房找不到編號，stepDay 會丟例外
    const grown = '  for (const { i, b } of grown) {\n';
    const early = await dayVariant([[block, ''], [grown, block + grown]]);
    const e = growingSteelCity(early); assert.match(e.err ?? '', /加速施工：.*沒有建築/, '對編號早於登記新房要被 G13 抓到');
    return `W2 12 次：現行 0；拿掉記錄 ${a}、重播不加歲 ${b}、記少一棟 ${c} 次退回；排到合併之後 W2 ${breaks} 天順序錯、造城 ${lm.err ? '丟例外' : lm.falls + ' 次退回'}；對編號太早在 G13 丟例外`;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let bad = 0;
  await d102HistoryGuards((ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}：${detail}`); if (!ok) bad++; });
  console.log(bad ? `D102 history: ${bad} failed` : 'D102 history: all passed');
  process.exitCode = bad ? 1 : 0;
}
