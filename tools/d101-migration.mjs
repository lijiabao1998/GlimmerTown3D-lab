// D101 驗收 4：完整 hv2 備份、單一鍵、首次施工與失敗原子性。
// 用真實存讀／建造 API；突變只在 data URL 載入，不改 src 或 lease。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import * as save from '../src/io/save.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { packMore, PACK0 } from '../src/io/journal.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { commitOp, previewOp, undoOp, previewTransit, commitTransit, removeTransit } from '../src/sim/edit.ts';
import { transitTerrain } from '../src/sim/transit/history.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
const vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
const seed = read('src/content/samples/newcity.code.txt').trim();
const KEY = 'gt3d.v1.save.pre-d101', MAIN = 'gt3d.v1.save';
const state = s => JSON.stringify({ city: s.city, money: s.money, stroke: s.stroke, txns: s.txns, tiles: s.w.tiles, day: s.day });
function load(M, code, journal) {
  const L = M.loadCode(code, KT, vrank, journal);
  assert.ok(L.ok, L.error);
  return L;
}
function fresh(M) {
  const L = load(M, seed), s = L.sim;
  for (let z = 1; z < s.city.n - 1; z++) for (let x = 1; x < s.city.n - 1; x++) {
    const op = { k: 'line', tool: 'road', x0: x, z0: z, x1: x, z1: z };
    const p = previewOp(s, op);
    if (!p.count || !p.affordable) continue;
    assert.ok(commitOp(s, op, 0).placed);
    assert.ok(undoOp(s).ok);
    return L;
  }
  throw new Error('fixture 沒有可建道路的格子');
}
function firstTrack(s) {
  const T = transitTerrain(s.city, true), n = s.city.n;
  for (let z = 1; z < n - 1; z++) for (let x = 1; x < n - 2; x++) {
    const q = { op: 'edge', mode: 'rail', x, z, h: T.cell(x, z).elevation, x2: x + 1, z2: z, h2: T.cell(x + 1, z).elevation };
    if (previewTransit(s, q).ok) return q;
  }
  throw new Error('fixture 沒有可建軌道的格子');
}
function verify(M, only) {
  const results = [];
  const check = (name, fn) => {
    if (only && name !== only) return;
    try { const detail = fn(); results.push({ name, ok: true, detail }); }
    catch (e) { results.push({ name, ok: false, error: String(e.stack ?? e) }); }
  };
  check('完整 hv2 與原檔保留', () => {
    const L = fresh(M), s = L.sim, p = packMore(s.city.history, PACK0);
    const primary = M.saveCode(s, L.template, L.start, { journal: { id: 'migration-test', st: p.st } });
    const R = load(M, primary, { id: 'migration-test', rows: p.rows });
    assert.ok(R.replayed); const before = state(R.sim), expected = M.saveCode(R.sim, R.template, R.start);
    const disk = new Map([[MAIN, primary], [KEY, 'previous-city']]), writes = [];
    assert.equal(M.PRE_D101_KEY, KEY);
    assert.deepEqual(M.backupBeforeTransit(R.sim, R.template, R.start, (k, v) => { writes.push(k); disk.set(k, v); }), { ok: true });
    assert.deepEqual(writes, [KEY]); assert.equal(disk.get(MAIN), primary); assert.equal(disk.get(KEY), expected);
    assert.equal(state(R.sim), before, '備份本身不能改世界、資金、歷史、手勢或復原堆疊');
    const decoded = decodeLabCode(disk.get(KEY)); assert.ok(decoded.ok, decoded.error);
    assert.equal(decoded.save.raw.d3.hv, 2); assert.ok(!('j' in decoded.save.raw.d3)); assert.ok(!('rt' in decoded.save.raw.d3));
    const B = load(M, disk.get(KEY)); assert.ok(B.replayed, B.note);
    assert.equal(M.saveCode(B.sim, B.template, B.start), expected, '沒有日誌也能完整讀回');
    return `${p.rows.length} 列歷史由 hv3 還原後備份成完整 hv2；原主存檔逐 byte 保留`;
  });
  check('同城只寫一次與另一城取代', () => {
    const A = fresh(M), B = fresh(M), disk = new Map(), writes = [];
    B.sim.money += 1;
    const write = (k, v) => { writes.push(k); disk.set(k, v); };
    assert.ok(M.backupBeforeTransit(A.sim, A.template, A.start, write).ok);
    const original = disk.get(KEY);
    A.sim.money += 2;
    assert.ok(M.backupBeforeTransit(A.sim, A.template, A.start, write).ok);
    assert.equal(writes.length, 1); assert.equal(disk.get(KEY), original);
    assert.ok(M.backupBeforeTransit(B.sim, B.template, B.start, write).ok);
    assert.equal(writes.length, 2); assert.equal(disk.size, 1); assert.notEqual(disk.get(KEY), original);
    assert.equal(disk.get(KEY), M.saveCode(B.sim, B.template, B.start));
  });
  check('quota 失敗不變且可重試', () => {
    const L = fresh(M), s = L.sim, before = state(s), primary = M.saveCode(s, L.template, L.start);
    const disk = new Map([[MAIN, primary], [KEY, 'prior-backup']]); let denied = true, writes = 0;
    const write = (k, v) => { if (denied) throw Object.assign(new Error('test quota'), { name: 'QuotaExceededError' }); writes++; disk.set(k, v); };
    const bad = M.backupBeforeTransit(s, L.template, L.start, write);
    assert.equal(bad.ok, false); assert.match(bad.error, /匯出/); assert.equal(state(s), before);
    assert.equal(disk.get(MAIN), primary); assert.equal(disk.get(KEY), 'prior-backup'); assert.equal(writes, 0);
    denied = false;
    assert.ok(M.backupBeforeTransit(s, L.template, L.start, write).ok);
    assert.equal(writes, 1); assert.equal(disk.get(KEY), primary); assert.equal(state(s), before);
  });
  check('超過容量不寫入', () => {
    const L = fresh(M), s = L.sim, before = state(s);
    // 未識別的範本附加欄位原樣保留；用它造超限碼，不偽造世界歷史或修改 SAVE_LIMIT。
    const template = { ...L.template, d101MigrationPadding: 'x'.repeat(M.SAVE_LIMIT + 1) };
    const length = M.saveCode(s, template, L.start).length;
    assert.ok(length > M.SAVE_LIMIT, '容量負控必須真的超限'); let writes = 0;
    const r = M.backupBeforeTransit(s, template, L.start, () => { writes++; });
    assert.equal(r.ok, false); assert.match(r.error, /上限.*匯出/); assert.equal(writes, 0); assert.equal(state(s), before);
    assert.ok(M.backupBeforeTransit(s, L.template, L.start, () => { writes++; }).ok); assert.equal(writes, 1);
    return `${length} > ${M.SAVE_LIMIT} 字元`;
  });
  check('已有運輸及清空路網不覆寫', () => {
    const L = fresh(M), s = L.sim, disk = new Map(); let writes = 0;
    const write = (k, v) => { writes++; disk.set(k, v); };
    const q = firstTrack(s); assert.ok(previewTransit(s, q).ok);
    assert.ok(M.backupBeforeTransit(s, L.template, L.start, write).ok); const original = disk.get(KEY);
    const built = commitTransit(s, q); assert.ok(built.ok);
    const code = M.saveCode(s, L.template, L.start), R = load(M, code); assert.ok(R.replayed, R.note);
    assert.ok(M.backupBeforeTransit(R.sim, R.template, R.start, write).ok); assert.equal(writes, 1);
    assert.ok(removeTransit(R.sim, { op: 'del-edge', id: built.id }).ok); assert.equal(R.sim.city.transit.edges.length, 0);
    assert.ok(M.backupBeforeTransit(R.sim, R.template, R.start, write).ok); assert.equal(writes, 1);
    const empty = load(M, M.saveCode(R.sim, R.template, R.start)); assert.ok(empty.replayed, empty.note);
    assert.ok(M.backupBeforeTransit(empty.sim, empty.template, empty.start, write).ok); assert.equal(writes, 1); assert.equal(disk.get(KEY), original);
  });
  return results;
}

// 驗收 18：執行真正的選單分支；這裡的短碼只隔離 UI 分支，容量正負控在上面用真 saveCode。
function verifyExportUI(source) {
  const start = source.indexOf('  function onMenu(id: string) {'), end = source.indexOf('  function menuCity(', start);
  assert.ok(start >= 0 && end > start, 'onMenu 抽取邊界');
  const script = stripTypeScriptTypes(source.slice(start, end), { mode: 'strip' });
  const original = '這座城的歷史太長，整張碼有 21 字元、超過分享碼上限：這張只有實驗線讀得到的部分（城都在，本線的歷史沒有帶，貼回本線只能看）。';
  for (const transit of [undefined, { edges: [], stations: [], depots: [] }]) for (const length of [20, 21]) {
    const shown = [], exports = [], sim = { city: transit === undefined ? {} : { transit } }, before = JSON.stringify(sim);
    const context = vm.createContext({ sim, template: {}, startCode: 'seed', SAVE_LIMIT: 20, dlg: { hidden: true }, dlgMode: 'export', lastCode: '',
      interruptBuild() {}, cancelTransitStroke() {}, closeTransit() {}, closeGrowth() {},
      saveCode(s, t, c, opt) { exports.push(opt?.history === false ? 'fallback' : 'full'); return opt?.history === false ? 'city-only-code' : 'x'.repeat(length); },
      openDlg(...args) { shown.push(args); }, saveStatus: { root: { hidden: true }, setError() {} }, bui: { toast(message) { throw new Error(message); } },
    });
    vm.runInContext(script + "\nonMenu('export');", context);
    assert.equal(JSON.stringify(sim), before);
    assert.deepEqual(exports, length > 20 ? ['full', 'fallback'] : ['full']);
    assert.deepEqual(shown, [length > 20 ? ['export', 'city-only-code', original + (transit === undefined ? '' : '路網不會帶走。')] : ['export', 'x'.repeat(length)]]);
  }
}

const baseline = verify(save);
for (const r of baseline) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.ok ? r.detail ? '：' + r.detail : '' : '：' + r.error}`);
if (baseline.some(r => !r.ok)) process.exit(1);
const source = read('src/io/save.ts');
const mutants = [
  { name: '寫進主存檔鍵', from: "export const PRE_D101_KEY = 'gt3d.v1.save.pre-d101';", to: "export const PRE_D101_KEY = 'gt3d.v1.save';", expect: '完整 hv2 與原檔保留' },
  { name: '只備份快照', from: 'const code = saveCode(s, template, start);', to: 'const code = saveCode(s, template, start, { history: false });', expect: '完整 hv2 與原檔保留' },
  { name: '備份依賴日誌', from: 'const code = saveCode(s, template, start);', to: "const code = saveCode(s, template, start, { journal: { id: 'mutant', st: PACK0 } });", expect: '完整 hv2 與原檔保留' },
  { name: '同城每次都覆寫', from: 's.city.transit !== undefined || transitBackedUp.has(s.city)', to: 's.city.transit !== undefined', expect: '同城只寫一次與另一城取代' },
  { name: '失敗之前就標記已備份', from: 'write(PRE_D101_KEY, code);', to: 'transitBackedUp.add(s.city); write(PRE_D101_KEY, code);', expect: 'quota 失敗不變且可重試' },
  { name: '超限仍寫入', from: 'if (code.length > SAVE_LIMIT)', to: 'if (false)', expect: '超過容量不寫入' },
  { name: '已讀回的路網再覆寫', from: 's.city.transit !== undefined || transitBackedUp.has(s.city)', to: 'transitBackedUp.has(s.city)', expect: '已有運輸及清空路網不覆寫' },
];
for (const m of mutants) {
  assert.equal(source.split(m.from).length, 2, `${m.name}：錨點必須唯一`);
  let mutated = source.replace(m.from, () => m.to);
  mutated = mutated.replace(/from '(\.[^']+)'/g, (_, rel) => `from '${pathToFileURL(path.resolve(ROOT, 'src/io', rel)).href}'`);
  const js = stripTypeScriptTypes(mutated, { mode: 'strip', sourceUrl: pathToFileURL(path.join(ROOT, 'src/io/save.ts')).href });
  const M = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const rows = verify(M, m.expect);
  assert.equal(rows.length, 1); assert.equal(rows[0].ok, false, `${m.name} 必須紅在 ${m.expect}`);
  console.log(`PASS 突變 ${m.name} → ${m.expect}`);
}
const cityView = read('src/cityView.ts');
verifyExportUI(cityView);
console.log('PASS 超限匯出保留原句，只有運輸城追加路網不會帶走；上限內仍匯出完整碼');
const exportMutants = [
  [" + (sim.city.transit !== undefined ? '路網不會帶走。' : '')", '', '漏掉路網提醒'],
  [" + (sim.city.transit !== undefined ? '路網不會帶走。' : '')", " + '路網不會帶走。'", '無運輸也誤報路網遺失'],
];
for (const [from, to, name] of exportMutants) {
  assert.equal(cityView.split(from).length, 2, name + ' 錨點唯一');
  assert.throws(() => verifyExportUI(cityView.replace(from, () => to)), undefined, name);
  console.log(`PASS 突變 ${name} → 超限匯出提示`);
}
console.log(`D101 migration: ${baseline.length + 1}/${baseline.length + 1} passed, ${mutants.length + exportMutants.length} mutants rejected at expected checks`);
