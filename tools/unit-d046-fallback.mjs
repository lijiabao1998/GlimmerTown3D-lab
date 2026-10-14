// D046：只修既有歷史失配退回快照後的起始碼套娃，不修鋼材加速施工未記事件的舊限制。
// 正常歷史仍只增不改；真正不相符仍拒絕重播。可獨立執行，也由 unit.mjs 呼叫。
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { loadCode, saveCode, SAVE_LIMIT } from '../src/io/save.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { stepDay, simHash } from '../src/sim/day.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { d036Runs } from './d036-cities.mjs';
import { d045Load } from './d045-cities.mjs';
import { loadMod } from './unit-d024.mjs';

const copy = o => JSON.parse(JSON.stringify(o));
const rawOf = code => { const r = decodeLabCode(code); assert.ok(r.ok, r.error); return r.save.raw; };
const plain = raw => { const o = copy(raw); delete o.d3; delete o.z; return o; };
const CMS = { act: 'steel80', st: 150, acc: 12.5, hold: 0, n: 3, done: [] };
function wellStart() {
  const ctx = d045Load(), raw = plain(rawOf(d036Runs().find(r => r.id === 'W2').code));
  raw.cms385 = copy(CMS); raw.unknownD046 = { keep: ['opaque', 7, { precision: .125 }] };
  return { ...ctx, code: encodeLabCode(raw) }; // 刻意保留未壓縮舊起點，正常路徑不能擅自改寫
}
const mustLoad = (code, ctx, api = { loadCode }) => {
  const L = api.loadCode(code, ctx.KT, ctx.vrank); assert.ok(L.ok, L.error); return L;
};
function checkFallback(L, raw) {
  assert.equal(L.replayed, false);
  const start = rawOf(L.start); assert.ok(!Object.hasOwn(start, 'd3'));
  assert.deepEqual(plain(start), plain(raw), '新起點只拿掉歷史及 RLE 標記，其餘欄位完整保留');
  assert.equal(L.sim.city.history[0].t, 'import');
  assert.equal(L.sim.city.history[0].codeHash, fnv1a(L.start));
  assert.ok(L.sim.city.history.slice(1).every(e => e.t === 'restyle'), '退回後沒有補造舊事件');
}

export async function d046FallbackGuards(log) {
  const run = async (name, fn) => {
    try { log(true, 'D046 快照回退：' + name, await fn()); }
    catch (e) { log(false, 'D046 快照回退：' + name, `${e.name}: ${e.message}`); }
  };
  await run('自然鋼材日結＋100 次存讀始終可讀，委託小數及當前城市不丟失', () => {
    const ctx = wellStart(); let L = mustLoad(ctx.code, ctx), falls = 0, max = 0, smallMax = 0;
    assert.equal(L.start, ctx.code, '沒有舊歷史時不重寫起始碼');
    for (let i = 0; i < 100; i++) {
      stepDay(L.sim); const cms = copy(L.sim.cms), code = saveCode(L.sim, L.template, L.start), raw = rawOf(code);
      max = Math.max(max, code.length); assert.ok(code.length < SAVE_LIMIT, `第 ${i + 1} 次超過分享碼上限`);
      L = mustLoad(code, ctx); assert.deepEqual(L.sim.cms, cms, `第 ${i + 1} 次委託狀態改變`);
      assert.deepEqual(raw.unknownD046, { keep: ['opaque', 7, { precision: .125 }] });
      if (!L.replayed) {
        falls++; checkFallback(L, raw); assert.match(L.note, /歷史跟存檔對不上/);
        const snapshot = mustLoad(encodeLabCode(plain(raw), { deflate: true }), ctx);
        assert.equal(simHash(L.sim), simHash(snapshot.sim), '回退後的城＝同一份快照正常匯入，沒有改屋齡或模擬');
      }
      if (i >= 5) { smallMax = Math.max(smallMax, code.length); assert.ok(code.length < 30_000, `第 ${i + 1} 次仍有起點套娃`); }
    }
    assert.ok(falls > 1, '要真的走到既有鋼材屋齡失配'); assert.ok(L.sim.cms.done.includes('steel80'));
    return `100 次全可讀；${falls} 次如實退回快照；最大 ${max} 字元，首次回退後最大 ${smallMax}；委託正常完成`;
  });
  await run('有效舊歷史及起始碼逐位不變，第一次真失配才更換起點；復原舊做法會重現超限', async () => {
    const old = await loadMod('src/io/save.ts', [["if (Object.hasOwn(save.raw, 'd3')) {", 'if (false) {']]);
    const ctx = wellStart(); let L = mustLoad(ctx.code, ctx), prior = mustLoad(ctx.code, ctx, old), first = 0, exceeded = 0;
    for (let i = 0; i < 12; i++) {
      stepDay(prior.sim); const oldCode = old.saveCode(prior.sim, prior.template, prior.start);
      if (i < 5) {
        stepDay(L.sim); const code = saveCode(L.sim, L.template, L.start); assert.equal(code, oldCode, '實際失配之前存出的碼必須逐位一樣');
        L = mustLoad(code, ctx);
        if (i < 4) { assert.ok(L.replayed); assert.equal(L.start, ctx.code); }
        else { assert.equal(L.replayed, false); first = i + 1; checkFallback(L, rawOf(code)); }
      }
      const next = old.loadCode(oldCode, ctx.KT, ctx.vrank);
      if (!next.ok) { assert.match(next.error, /分享碼太長/); exceeded = i + 1; break; }
      if (i < 4) assert.deepEqual(copy(L.sim.city.history), copy(next.sim.city.history), '有效歷史不能被重寫');
      if (i === 4) {
        assert.equal(next.replayed, false); assert.equal(next.note, L.note); assert.equal(next.start, oldCode);
        // 舊版已造成的巢狀起點，只要這次歷史有效就不能為了縮碼擅自清掉。
        const nested = mustLoad(old.saveCode(next.sim, next.template, next.start), ctx);
        assert.ok(nested.replayed, nested.note); assert.equal(nested.start, next.start);
        assert.ok(Object.hasOwn(rawOf(nested.start), 'd3'));
        assert.deepEqual(copy(nested.sim.city.history), copy(next.sim.city.history));
      }
      prior = next;
    }
    assert.equal(first, 5); assert.equal(exceeded, 11);
    return '前 4 次完整歷史不變，第 5 次同樣拒絕失配；拿掉修補第 11 次再度超過 2MB';
  });
  await run('壞歷史、舊格式冒用、缺日誌及真實屋齡差仍拒絕；重建起點雜湊配對，下一次正常重播', () => {
    const ctx = d045Load({ cms385: CMS, unknownD046: { keep: true } });
    const pristine = rawOf(saveCode(ctx.sim, ctx.template, ctx.start));
    const edits = [
      ['未知種類', r => { r.d3.r.push([999, 0]); }],
      ['版本冒用', r => { r.d3.f = 1; }],
      ['缺日誌', r => { r.d3 = { ...r.d3, hv: 3, j: { id: 'lost', n: 1, h: 0 }, t: [] }; }],
      ['屋齡不符', r => { r.bl[0][4]++; }],
      ['起點不符', r => { r.d3.s = ctx.start.slice(4); }],
      ['附加欄位不成物件', r => { r.d3 = ['bad']; }],
    ];
    for (const [name, edit] of edits) {
      const raw = copy(pristine); edit(raw); delete raw.z;
      const L = mustLoad(encodeLabCode(raw, { deflate: true }), ctx); checkFallback(L, raw);
      assert.deepEqual(L.sim.cms, CMS, name);
      const again = mustLoad(saveCode(L.sim, L.template, L.start), ctx);
      assert.ok(again.replayed, `${name}：新 import 與起點不配對 ${again.note}`);
      assert.deepEqual(again.sim.cms, CMS, name);
    }
    return `${edits.length} 種回退原因仍嚴格攔截；只換新起點、不降低歷史驗證`;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let bad = 0;
  await d046FallbackGuards((ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}：${detail}`); if (!ok) bad++; });
  process.exitCode = bad ? 1 : 0;
}
