// D046：固定的事件碼與格式契約。可單獨執行，也由 tools/unit.mjs 呼叫 d046HistoryGuards。
// 測試碼與期望列獨立於 registry；不能讓編解碼一起改號後互相對上就過關。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { EVENT_REGISTRY, EVENT_BY_CODE, CITY_FORMAT, minimumEventFormat } from '../src/sim/eventRegistry.ts';
import { cityFromLab, cityStats, eventFormat } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { replayCity } from '../src/sim/replay.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { saveCode, loadCode, packHistory, unpackHistory, checkHistory, historyFormat, HISTORY_VER, JOURNAL_VER } from '../src/io/save.ts';
import { packMore, PACK0 } from '../src/io/journal.ts';
import { mk } from './d034-cities.mjs';
import { loadMod } from './unit-d024.mjs';

const read = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const J = JSON.stringify;
const copy = o => JSON.parse(J(o));
const KT = kindTableFrom(read('src/content/lab-kinds.json'));
const vrank = read('src/content/samples/d009-live.json').vrank;
const N = 72;
// [最早格式、事件、獨立寫死的列]。day 全是 1：第一列 dDay=1，其餘 0；手勢差值另外涵蓋正、零、負。
const CONTRACT = [
  [1, { day: 1, t: 'import', source: 'lab', gameVer: 'old', seed: 77, codeHash: 'abc', buildings: 1 }, [0, 1, 'lab', 'old', 77, 'abc', 1]],
  [2, { day: 1, t: 'grow', x: 2, z: 3, k: 1, lv: 1, v: 0 }, [1, 0, 2, 3, 1, 1, 0]],
  [2, { day: 1, t: 'upgrade', x: 2, z: 3, k: 1, lv: 2, v: 1 }, [2, 0, 2, 3, 1, 2, 1]],
  [3, { day: 1, t: 'road', x: 2, z: 4, rc: 2, cost: 10, g: 2 }, [3, 0, 2, 4, 2, 10, 2]],
  [3, { day: 1, t: 'zone', x: 3, z: 3, zone: 1, cost: 5, g: 2 }, [4, 0, 3, 3, 1, 5, 0]],
  [3, { day: 1, t: 'place', x: 4, z: 3, k: 4, lv: 1, v: 2, id: 3, cost: 30, g: 4 }, [5, 0, 4, 3, 4, 1, 2, 3, 30, 2]],
  [3, { day: 1, t: 'doze', x: 4, z: 3, layer: 'bld', k: 4, id: 3, cost: 2, g: 5 }, [6, 0, 4, 3, 0, 2, 1, 4, 3]],
  [3, { day: 1, t: 'undo', g: 4, refund: 30 }, [7, 0, -1, 30]],
  [4, { day: 1, t: 'restyle', x: 2, z: 3, v: 2 }, [8, 0, 2, 3, 2]],
  [5, { day: 1, t: 'pipe', x: 2, z: 3, cost: 1, g: 6 }, [9, 0, 2, 3, 1, 2]],
  [6, { day: 1, t: 'fire', x: 2, z: 3, k: 1 }, [10, 0, 2, 3, 1]],
  [6, { day: 1, t: 'burn', x: 2, z: 3, k: 1, id: 1 }, [11, 0, 2, 3, 1, 1]],
  [6, { day: 1, t: 'crime', x: 2, z: 3, k: 1 }, [12, 0, 2, 3, 1]],
  [6, { day: 1, t: 'abandon', x: 2, z: 3, k: 1, id: 1 }, [13, 0, 2, 3, 1, 1]],
  [6, { day: 1, t: 'sick', x: 2, z: 3 }, [14, 0, 2, 3]],
  [6, { day: 1, t: 'death', x: 2, z: 3 }, [15, 0, 2, 3]],
  [6, { day: 1, t: 'act', x: 2, z: 3, what: 'sick', cost: 50 }, [16, 0, 2, 3, 2, 50]],
  [7, { day: 1, t: 'merge', x: 2, z: 3, k: 33, size: 2, v: 1, from: [1, 2, 3, 4] }, [17, 0, 2, 3, 33, 1, 1, 2, 3, 4]],
  [8, { day: 1, t: 'policy', key: 'taxR', from: 1, value: 1.1 }, [18, 0, 0, 1, 1.1]],
  [8, { day: 1, t: 'budget', cat: 'edu', from: 1, value: .9 }, [19, 0, 3, 1, .9]],
  [8, { day: 1, t: 'research', id: 'A1', fee: 400 }, [20, 0, 0, 400]],
  [8, { day: 1, t: 'spec', id: 'green' }, [21, 0, 1]],
  [8, { day: 1, t: 'techdone', id: 'D8' }, [22, 0, 35]],
  [9, { day: 1, t: 'depleted', x: 30, z: 30, k: 49 }, [23, 0, 30, 30, 49]],
  [10, { day: 1, t: 'cms', ev: 'done', id: 'techC6', bonus: 1800 }, [24, 0, 2, 8, 1800]],
];

// 有真實可重播地圖的最小版本檔，涵蓋格式 1–10。這裡測歷史契約，不冒充逐日模擬的產出。
function fixture(format, hv) {
  const start = mk(20261046, 50, '歷史格式守衛', b => b.put(30, 30, 49));
  const raw = copy(decodeLabCode(start).save.raw), first = cityFromLab(decodeLabCode(start).save, KT, start).history[0];
  const additions = [
    [2, { day: 50, t: 'grow', x: 10, z: 10, k: 1, lv: 1, v: 0 }],
    [3, { day: 50, t: 'road', x: 10, z: 11, rc: 2, cost: 10, g: 1 }],
    [4, { day: 50, t: 'restyle', x: 10, z: 10, v: 1 }],
    [5, { day: 50, t: 'pipe', x: 10, z: 10, cost: 1, g: 2 }],
    [6, { day: 50, t: 'fire', x: 10, z: 10, k: 1 }],
    [7, { day: 50, t: 'merge', x: 10, z: 10, k: 33, size: 2, v: 0, from: [2] }],
    ...CONTRACT.filter(([f]) => f === 8).map(([f, e]) => [f, { ...e, day: 50 }]),
    [9, { day: 50, t: 'depleted', x: 30, z: 30, k: 49 }],
    [10, { day: 50, t: 'cms', ev: 'accept', id: 'steel40' }],
  ];
  const h = [first, ...additions.filter(([f]) => f <= format).map(([, e]) => e)];
  const city = replayCity(start, h, KT, 50), rows = packHistory(h), prefix = packMore(h.slice(0, Math.max(1, h.length - 2)), PACK0);
  raw.bl = city.buildings.filter(b => b.goneDay === undefined).map(b => [b.z * N + b.x, b.k, b.lv, b.v, b.age]);
  for (const [key, layer] of [['rd', city.road], ['rcl', city.rclass], ['zn', city.zone], ['tre', city.tree], ['wp', city.wp], ['rn', city.ruin]]) raw[key] = Array.from(layer, v => String.fromCharCode(48 + v)).join('');
  raw.d3 = { f: format, s: start, g: 3, ...(hv === undefined ? { h } : hv === 2 ? { hv, r: rows } : { hv, j: { id: 'd046-history', n: prefix.st.n, h: prefix.st.h }, t: rows.slice(prefix.st.n) }) };
  delete raw.z;
  const journal = hv === 3 ? { id: 'd046-history', rows: prefix.rows } : undefined;
  return { raw, h, rows, start, journal, code: encodeLabCode(raw, { deflate: true }) };
}

export async function d046HistoryGuards(log) {
  const run = async (title, fn) => {
    try { const info = await fn(); log(true, 'D046 歷史：' + title, info ?? '通過'); }
    catch (e) { log(false, 'D046 歷史：' + title, `${e.name}: ${e.message}`); }
  };
  await run('唯一登記、0–24 既有碼不動、格式 8／9／10 分組與舊版界線', () => {
    assert.equal(CITY_FORMAT, 10); assert.equal(HISTORY_VER, 2); assert.equal(JOURNAL_VER, 3);
    assert.equal(Object.keys(EVENT_REGISTRY).length, 25);
    assert.ok(Object.isFrozen(EVENT_REGISTRY)); assert.ok(Object.isFrozen(EVENT_BY_CODE));
    CONTRACT.forEach(([f, e, row]) => {
      const reg = EVENT_REGISTRY[e.t];
      assert.equal(reg.code, row[0], e.t); assert.equal(EVENT_BY_CODE[row[0]], e.t);
      assert.equal(reg.format, f, e.t); assert.equal(minimumEventFormat(e), f); assert.equal(eventFormat(e), Math.max(4, f));
      assert.ok(Object.isFrozen(reg)); assert.ok(Object.isFrozen(reg.fields));
    });
    for (const [layer, f] of [['bld', 3], ['wp', 5], ['ruin', 6]]) assert.equal(minimumEventFormat({ t: 'doze', layer }), f);
    assert.deepEqual(CONTRACT.filter(([f]) => f >= 8).map(([f, e, row]) => [row[0], f, e.t]), [
      [18, 8, 'policy'], [19, 8, 'budget'], [20, 8, 'research'], [21, 8, 'spec'], [22, 8, 'techdone'], [23, 9, 'depleted'], [24, 10, 'cms'],
    ]);
    return '25 種事件固定碼；不新增 CITY_FORMAT／hv；拆水管、焦土的版本另驗';
  });
  await run('固定黃金列、每個切點的 packMore、物件與緊湊列來回、前綴不變', () => {
    const h = CONTRACT.map(([, e]) => e), want = CONTRACT.map(([, , r]) => r);
    assert.deepEqual(packHistory(h), want); assert.deepEqual(unpackHistory(want, N), h); assert.deepEqual(checkHistory(copy(h), N), h);
    for (let k = 0; k <= h.length; k++) {
      const a = packMore(h.slice(0, k), PACK0), b = packMore(h, a.st);
      assert.deepEqual(a.rows, want.slice(0, k)); assert.deepEqual([...a.rows, ...b.rows], want); assert.deepEqual(b.st, packMore(h, PACK0).st);
    }
    const cms = ['accept', 'drop', 'done', 'expire'].map(ev => ({ day: 3, t: 'cms', ev, id: 'steel40', ...(ev === 'done' ? { bonus: 0 } : {}) }));
    assert.deepEqual(packHistory(cms), [[24, 3, 0, 0], [24, 0, 1, 0], [24, 0, 2, 0, 0], [24, 0, 3, 0]]);
    assert.deepEqual(unpackHistory(packHistory(cms), N), cms);
    const cache = []; assert.equal(historyFormat(cache), 4);
    for (const [f, e] of CONTRACT) { cache.push(e); assert.equal(historyFormat(cache), Math.max(4, f)); }
    return '25 種固定列、26 個切點、4 種委託、逐筆增量格式';
  });
  await run('格式 1–10 × hv1／hv2／hv3 真實重播、存讀、分享碼與日誌接續', () => {
    let count = 0;
    for (let f = 1; f <= 10; f++) for (const hv of [undefined, 2, 3]) {
      const q = fixture(f, hv), L = loadCode(q.code, KT, vrank, q.journal);
      assert.ok(L.ok && L.replayed, `f=${f} hv=${hv}: ${L.note ?? L.error}`);
      assert.deepEqual(L.sim.city.history.slice(0, q.h.length), q.h);
      const code = saveCode(L.sim, L.template, L.start), raw = decodeLabCode(code).save.raw;
      assert.equal(raw.d3.f, Math.max(4, f)); assert.equal(raw.d3.hv, 2);
      const again = loadCode(code, KT, vrank); assert.ok(again.ok && again.replayed, again.note ?? again.error);
      assert.deepEqual(again.sim.city.history.slice(0, q.h.length), q.h);
      const pref = packMore(L.sim.city.history.slice(0, 1), PACK0), jcode = saveCode(L.sim, L.template, L.start, { journal: { id: 'd046-append', st: pref.st } });
      const JL = loadCode(jcode, KT, vrank, { id: 'd046-append', rows: pref.rows });
      assert.ok(JL.ok && JL.replayed, JL.note ?? JL.error); assert.equal(JL.journal.st.n, 1);
      assert.deepEqual(packMore(JL.sim.city.history, JL.journal.st).rows, packHistory(JL.sim.city.history).slice(1));
      count++;
    }
    return `${count} 種格式／存法，逐一讀→分享碼→讀、日誌前綴＋尾巴→接續`;
  });
  await run('冒用舊格式或拿掉版本不能偷帶新事件，未知版本安全退回快照', () => {
    let count = 0;
    for (let f = 2; f <= 10; f++) for (const hv of [undefined, 2, 3]) {
      const q = fixture(f, hv); q.raw.d3.f = f - 1;
      const L = loadCode(encodeLabCode(q.raw, { deflate: true }), KT, vrank, q.journal);
      assert.ok(L.ok && !L.replayed && /需要城市格式/.test(L.note), `f=${f} hv=${hv}: ${L.note}`); count++;
    }
    for (const f of [1, 2, 3, 4, 5, 8, 9, 10]) {
      const q = fixture(f, undefined); delete q.raw.d3.f;
      const L = loadCode(encodeLabCode(q.raw, { deflate: true }), KT, vrank);
      assert.ok(L.ok); assert.equal(L.replayed, f <= 4, `無 f 的格式 ${f}: ${L.note}`);
    }
    for (const bad of [0, -1, 1.5, '10', CITY_FORMAT + 1]) {
      const q = fixture(10, 2); q.raw.d3.f = bad;
      const L = loadCode(encodeLabCode(q.raw, { deflate: true }), KT, vrank); assert.ok(L.ok && !L.replayed);
    }
    const q = fixture(10, 2); q.raw.d3.hv = 4;
    assert.equal(loadCode(encodeLabCode(q.raw), KT, vrank).replayed, false);
    return `${count} 種版本降級擋下；無 f 舊檔 1–4 保留；未來格式／hv 不猜`;
  });
  await run('18–24 壞列與壞事件被擋，不把小數、缺欄、多欄或非法碼洗成合法資料', () => {
    const bad = [
      [18, 0, 29, 0, 1], [18, 0, 0, 1, 3], [18, 0, 3, 0, .5], [18, 0, 0, 1], [18, 0, 0, 1, 1, 0],
      [19, 0, 4, 1, 1], [19, 0, 0, .4, 1], [19, 0, 0, 1], [20, 0, 36, 0], [20, 0, 0], [20, 0, 0, Infinity],
      [21, 0, 4], [21, 0, 'green'], [21, 0, 1, 1], [22, 0, -1], [22, 0],
      [23, 0, N, 0, 49], [23, 0, 0, 0, 51], [23, 0, 0, 0], [23, 0, 0, 0, 49, 0],
      [24, 0, 4, 0], [24, 0, 0, 11], [24, 0, 0, 'steel40'], [24, 0, 2, 0], [24, 0, 2, 0, 1.5],
      [24, 0, 2, 0, -1], [24, 0, 0, 0, 1], [24, 0, 2, 0, 1, 0], [24, .5, 0, 0], [25, 0], [-1, 0],
    ];
    for (const row of bad) assert.throws(() => unpackHistory([row], N), Error, J(row));
    for (const [, e] of CONTRACT.filter(([f]) => f >= 8)) assert.throws(() => checkHistory([{ ...e, day: .5 }], N), Error);
    return `${bad.length} 種壞列＋7 種壞事件`;
  });
  await run('附加歷史不改 2D 基本欄位；舊碼無歷史仍可進城', () => {
    const q = fixture(10, 2), plain = copy(q.raw); delete plain.d3;
    const a = decodeLabCode(encodeLabCode(q.raw)).save, b = decodeLabCode(encodeLabCode(plain)).save;
    const strip = raw => { const o = copy(raw); delete o.d3; delete o.z; return o; };
    assert.deepEqual(strip(a.raw), strip(b.raw));
    assert.deepEqual(cityStats(cityFromLab(a, KT, q.code)), cityStats(cityFromLab(b, KT, q.code)));
    const old = loadCode(encodeLabCode(plain), KT, vrank); assert.ok(old.ok && !old.replayed);
    return '基礎解碼／城市欄位相同；本條只驗本線相容解碼，完整舊 2D 讀器另驗';
  });
  await run('降級驗證與集中編碼的突變守衛確實抓錯', async () => {
    const q = fixture(10, 2); q.raw.d3.f = 9;
    const M = await loadMod('src/io/save.ts', [['if (newer) return only(', 'if (false && newer) return only(']]);
    assert.equal(M.loadCode(encodeLabCode(q.raw), KT, vrank).replayed, true, '移除降級檢查的突變未觸發');
    const R = await loadMod('src/io/journal.ts', [['code = EVENT_REGISTRY[e.t]?.code', 'code = EVENT_REGISTRY[e.t]?.code === 24 ? 23 : EVENT_REGISTRY[e.t]?.code']]);
    assert.notDeepEqual(R.packMore(CONTRACT.map(([, e]) => e), PACK0).rows, CONTRACT.map(([, , r]) => r));
    return '故意刪版本檢查／把 cms 誤寫成 depleted，兩者都被獨立期望捕獲';
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failed = 0;
  await d046HistoryGuards((ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}：${detail}`); if (!ok) failed++; });
  process.exitCode = failed ? 1 : 0;
}
