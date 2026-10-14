// D046：3D 小數委託精度；2D 原文讀器仍只收整數，原來的 commission.ts 對拍不變。
// tools/unit.mjs 呼叫 d046SaveGuards。完整經 saveCode/loadCode、分享碼、實際鋼材日結與失效附加欄位。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { cmsLoad3d, cmsSave3d } from '../src/sim/rules/commissionSave.ts';
import { CMS385, cmsLoad, cmsDaily, emptyCms } from '../src/sim/rules/commission.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { stepDay } from '../src/sim/day.ts';
import { acceptCommission, dropCommission } from '../src/sim/edit.ts';
import { d045Load } from './d045-cities.mjs';
import { d036Runs } from './d036-cities.mjs';
import { dayVariant } from './unit-d021.mjs';
import { loadMod } from './unit-d024.mjs';

const copy = o => JSON.parse(JSON.stringify(o));
const equal = (a, b, msg) => assert.deepEqual(copy(a), copy(b), msg);
const active = (acc = 12.5, more = {}) => ({ act: 'steel80', st: 140, acc, hold: 0, n: 3, done: ['happy70', 'trade1200'], ...more });
const rawOf = code => { const r = decodeLabCode(code); assert.equal(r.ok, true, r.error); return r.save.raw; };
const reload = (code, ctx) => { const r = loadCode(code, ctx.KT, ctx.vrank); assert.equal(r.ok, true, r.error); return r; };
const save = (q, opts) => saveCode(q.sim, q.template, q.start, opts);

export async function d046SaveGuards(log) {
  const guard = async (name, fn) => {
    try { const detail = await fn(); log(true, 'D046 存檔：' + name, detail); }
    catch (e) { log(false, 'D046 存檔：' + name, `${e.name}: ${e.message}`); }
  };

  await guard('目前 GitHub 2D 實驗線的真實讀器仍可讀所有合法輸出', () => {
    const f = JSON.parse(fs.readFileSync(new URL('../src/content/samples/d046-compat.json', import.meta.url), 'utf8'));
    assert.equal(f.source.commit, '10bc4115f119498b4cc5836695348982b85fa9d1');
    assert.equal(f.sha256.load, '54180ae741fd47a867c9a7dcc4be380381eea051ac4e2b71990d2beba5334737');
    for (const [key, text] of Object.entries(f.text)) assert.equal(crypto.createHash('sha256').update(text).digest('hex'), f.sha256[key]);
    const labLoad = vm.runInNewContext(Object.values(f.text).join('\n') + '\ncmsLoad385');
    let cases = 0;
    for (const c of CMS385) for (const acc of [0, 1, 12.5, 39.999999, 123.456]) for (const repeat of [false, true]) {
      if (repeat && c.type === 'tech') continue;
      const exact = { act: c.id, acc, st: 140, hold: 0, n: 3, done: repeat ? [c.id] : [] }, p = cmsSave3d(exact);
      equal(labLoad(p.cms385), p.cms385); equal(cmsLoad3d(p.cms385, p.cms3d), exact); cases++;
    }
    return cases + ' 組；10bc411 原文讀器在 vm 執行，未冒充整頁瀏覽器互讀';
  });

  await guard('舊 3D 小數救回；輸出仍通過嚴格 2D 原文讀器；2D 重匯出只保留整數', () => {
    const T = JSON.parse(fs.readFileSync(new URL('../src/content/samples/d045-cms.json', import.meta.url), 'utf8')).text;
    // 直接跑已釘 commit 的 2D 原文，不用本線接頭冒充舊讀器。
    const labLoad = vm.runInNewContext(`${T.table}\n${T.byId}\n${T.empty}\n${T.load}\ncmsLoad385`);
    const vals = [0, Number.MIN_VALUE, .1 + .2, .9999999999999999, 12, 12.5, 39.99999999999999, 9007199254740991, Number.MAX_VALUE];
    let cases = 0;
    for (const c of CMS385) for (const acc of vals) {
      const state = active(acc, { act: c.id, done: [] }), before = copy(state);
      equal(cmsLoad3d(state), state);
      const fields = cmsSave3d(state);
      equal(state, before, '存檔不能改原狀態');
      assert.equal(fields.cms385.acc, Math.floor(acc));
      assert.equal(Object.keys(fields.cms385).sort().join(), 'acc,act,done,hold,n,st');
      equal(labLoad(fields.cms385), fields.cms385, '2D 原文必須保留整份委託');
      equal(cmsLoad(fields.cms385), fields.cms385);
      equal(cmsLoad3d(fields.cms385, fields.cms3d), state);
      equal(cmsLoad3d(labLoad(fields.cms385)), fields.cms385, '未修改 2D 不會重匯出 cms3d，小數無法保留');
      if (!Number.isInteger(acc)) equal(labLoad(state), emptyCms(), '原文仍嚴格拒絕小數，未修改 2D');
      cases++;
    }
    // 原讀器也允許無進行中但有非零累計；小於 1 時不能因 base 全零就漏掉精度。
    const tiny = { ...emptyCms(), acc: Number.MIN_VALUE }, fields = cmsSave3d(tiny);
    equal(cmsLoad3d(fields.cms385, fields.cms3d), tiny);
    return `${cases} 組；11 個既有 id、有限值邊界；純 2D 對拍 helper 未改`;
  });

  await guard('saveCode／loadCode 重複來回與分享碼精確保留；不受歷史省略影響', () => {
    let rounds = 0;
    for (const [act, acc] of [['steel40', 12.5], ['steel80', 0.1 + 0.2], ['trade3000', 599.125], ['steel80', Number.MIN_VALUE]]) {
      const expected = active(acc, { act, done: [] }), ctx = d045Load({ cms385: expected });
      let q = ctx;
      equal(q.sim.cms, expected, 'D045 小數舊檔須直接救回');
      for (let i = 0; i < 8; i++) {
        const code = save(q, i % 2 ? { history: false } : undefined), raw = rawOf(code);
        assert.equal(raw.cms385.acc, Math.floor(acc));
        assert.equal(raw.cms3d.v, 1);
        assert.equal(raw.cms3d.acc, acc);
        equal(raw.cms3d.base, raw.cms385);
        // 除正式壓縮分享碼，也走不壓縮與無前綴路徑。
        q = reload(i % 3 ? code : encodeLabCode(raw, { prefix: false, deflate: false }), ctx);
        equal(q.sim.cms, expected);
        rounds++;
      }
    }
    return `${rounds} 次完整城市／分享碼來回，JS 小數逐值相等`;
  });

  await guard('六欄完整配對拒絕 2D 留下的舊精度；壞版本、缺欄、越界與竄改回整數', () => {
    const fields = cmsSave3d(active()), base = fields.cms385, ext = fields.cms3d;
    const baseChanges = [
      { act: 'steel40' }, { st: base.st + 1 }, { acc: base.acc + 1 }, { acc: 0 }, { hold: 1 }, { n: base.n + 1 },
      { done: [] }, { done: [...base.done].reverse() }, { done: [...base.done, 'techC6'] },
      { act: '', st: 0, acc: 0, hold: 0, n: base.n + 1 },
    ];
    for (const patch of baseChanges) {
      const changed = { ...copy(base), ...patch };
      equal(cmsLoad3d(changed, ext), cmsLoad(changed), `cms385 被改 ${Object.keys(patch)}`);
    }
    const malformed = [null, undefined, 1, 'x', [], {}, { ...ext, v: 0 }, { ...ext, v: 2 }, { ...ext, v: '1' },
      ...[NaN, Infinity, -Infinity, -1, '12.5', null, 12, 11.5, 13.5].map(acc => ({ ...ext, acc })),
      ...[null, [], {}, 'x'].map(base => ({ ...ext, base }))];
    for (const k of ['act', 'st', 'acc', 'hold', 'n', 'done']) {
      const missing = copy(ext); delete missing.base[k]; malformed.push(missing);
      const changed = copy(ext); changed.base[k] = k === 'done' ? ['techC6'] : k === 'act' ? 'steel40' : base[k] + 1; malformed.push(changed);
    }
    for (const broken of malformed) equal(cmsLoad3d(base, broken), base);
    equal(cmsLoad3d({ ...base, acc: 12.75 }, ext), { ...base, acc: 12.75 }, '舊 3D 原欄位小數優先，不能被舊 ext 蓋回');
    const ctx = d045Load({ cms385: base, cms3d: ext });
    for (const patch of baseChanges) {
      const raw = { ...rawOf(save(ctx)), cms385: { ...copy(base), ...patch }, cms3d: ext };
      equal(reload(encodeLabCode(raw), ctx).sim.cms, cmsLoad(raw.cms385), '完整 loadCode 必須走配對');
    }
    return `${baseChanges.length} 種 2D 狀態修改、${malformed.length} 種壞附加欄位，全部安全回退`;
  });

  await guard('畸形主欄位不能靠附加欄位復活；不丟例外、不修改輸入、不共用完成清單', () => {
    const { cms385, cms3d } = cmsSave3d(active());
    const bad = [undefined, null, true, 3, 'x', [], [cms385]];
    for (const k of ['acc', 'st', 'hold', 'n']) for (const v of [-1, NaN, Infinity, -Infinity, '1', null, {}, []]) bad.push({ ...cms385, [k]: v });
    for (const k of ['st', 'hold', 'n']) bad.push({ ...cms385, [k]: .5 });
    bad.push(...['nope', 'constructor', '__proto__', 'toString', 1, null].map(act => ({ ...cms385, act })));
    bad.push(...['x', ['happy70', 'happy70'], ['constructor'], [1]].map(done => ({ ...cms385, done })));
    bad.push({ ...cms385, act: 'techC6', done: ['techC6'] });
    bad.push({ ...cms385, st: 0 });
    for (const raw of bad) {
      equal(cmsLoad3d(raw, cms3d), emptyCms());
      equal(cmsSave3d(raw), { cms385: null, cms3d: null });
    }
    const throwing = new Proxy({}, { get() { throw Error('bad getter'); } });
    equal(cmsLoad3d(throwing, cms3d), emptyCms());
    equal(cmsLoad3d(cms385, throwing), cms385);
    equal(cmsLoad3d(cms385, { ...cms3d, base: throwing }), cms385);
    const raw = active(), before = copy(raw), out = cmsSave3d(raw);
    const restored = cmsLoad3d(out.cms385, out.cms3d);
    restored.done.push('techC6');
    out.cms385.done.push('ct_fuel80');
    equal(raw, before);
    equal(out.cms3d.base.done, before.done, 'base 的 done 不能跟主欄位共用可變陣列');
    return `${bad.length} 種畸形主欄位、拋例外 getter、陣列隔離`;
  });

  await guard('完成、放棄、過期與零狀態會清掉範本舊精度；下一張不繼承', () => {
    for (const mode of ['done', 'drop', 'expired', 'empty', 'integer']) {
      const fields = cmsSave3d(active(39.75, { act: 'steel40', done: [] }));
      const ctx = d045Load(fields), beforeRound = ctx.sim.cms.n;
      assert.ok(ctx.template.cms3d, '測試必須真的帶舊附加欄位');
      if (mode === 'drop') assert.equal(dropCommission(ctx.sim).id, 'steel40');
      else if (mode === 'empty') ctx.sim.cms = emptyCms();
      else if (mode === 'integer') ctx.sim.cms.acc = 39;
      else {
        const out = cmsDaily(ctx.sim.cms, { diff: 1, day: mode === 'expired' ? ctx.sim.cms.st + 90 : ctx.sim.day + 1, steelUsed: mode === 'done' ? .5 : 0, tradeGold: 0, transitRidership: 0, cityHappy: 0, steel: 0, fuel: 0, tech: [] });
        assert.equal(out.t, mode);
      }
      const raw = rawOf(save(ctx));
      assert.equal('cms3d' in raw, false, mode + ' 不能留下 template 舊精度');
      equal(reload(save(ctx), ctx).sim.cms, ctx.sim.cms);
      if (mode === 'empty') assert.equal('cms385' in raw, false);
      if (['done', 'drop', 'expired'].includes(mode)) {
        assert.equal(ctx.sim.cms.n, beforeRound + 1);
        assert.ok(acceptCommission(ctx.sim, 0));
        assert.equal(ctx.sim.cms.acc, 0);
        const next = rawOf(save(ctx));
        assert.equal('cms3d' in next, false);
        assert.equal(reload(save(ctx), ctx).sim.cms.acc, 0);
      }
    }
    return '五條清理路徑、同一範本重存與新接單都不復活舊小數';
  });

  await guard('非科技委託可重接與存讀；六欄配對保存原完成順序，2D 主欄位仍合法', () => {
    const T = JSON.parse(fs.readFileSync(new URL('../src/content/samples/d045-cms.json', import.meta.url), 'utf8')).text;
    const labLoad = vm.runInNewContext(`${T.table}\n${T.byId}\n${T.empty}\n${T.load}\ncmsLoad385`);
    let cases = 0;
    for (const def of CMS385.filter(c => c.type !== 'tech')) for (const acc of [0, 12.5]) for (const at of [0, 1, 2]) {
      const done = CMS385.filter(c => c.id !== def.id).slice(0, 2).map(c => c.id); done.splice(at, 0, def.id);
      const state = active(acc, { act: def.id, done }), fields = cmsSave3d(state);
      equal(cmsLoad3d(state), state, '舊 3D 已寫下的合法重接要直接救回');
      equal(labLoad(state), emptyCms(), '原 2D 讀器拒绝 act 在 done 內的碼');
      assert.equal(fields.cms385.done.includes(def.id), false);
      equal(labLoad(fields.cms385), fields.cms385);
      equal(fields.cms3d.done, done);
      equal(cmsLoad3d(fields.cms385, fields.cms3d), state);
      equal(cmsLoad3d(fields.cms385), fields.cms385, '2D 重匯出保留活動委託，但失去該 id 的先前完成標記');
      cases++;
    }
    // 由真正的 offers／accept 進入重接狀態，不能只驗手造的資料結構。
    const ctx = d045Load({ cms385: { ...emptyCms(), n: 2, done: ['steel80'] } });
    assert.equal(acceptCommission(ctx.sim, 0)?.id, 'steel80');
    const expected = copy(ctx.sim.cms);
    let q = ctx;
    for (let i = 0; i < 6; i++) {
      q = reload(save(q), ctx);
      equal(q.sim.cms, expected, '重接不應重讀後整欄消失');
    }
    const fields = cmsSave3d(active(12.5, { done: ['happy70', 'steel80', 'trade1200'] }));
    const legacy = d045Load({ cms385: active(12.5, { done: ['happy70', 'steel80', 'trade1200'] }) });
    equal(legacy.sim.cms, active(12.5, { done: ['happy70', 'steel80', 'trade1200'] }), '完整舊 3D 分享碼救回重接與小數');
    const exported = rawOf(save(legacy));
    equal(labLoad(exported.cms385), exported.cms385, '完整 saveCode 產出的主欄位可被 2D 原文讀入');
    delete exported.cms3d;
    equal(reload(encodeLabCode(exported), ctx).sim.cms, fields.cms385, '實際移除 2D 不認得的附加欄位後仍保有進行中整數委託');
    for (const patch of [{ act: 'steel40' }, { st: 141 }, { acc: 13 }, { hold: 1 }, { n: 4 }, { done: ['trade1200', 'happy70'] }]) {
      const changed = { ...copy(fields.cms385), ...patch };
      equal(cmsLoad3d(changed, fields.cms3d), cmsLoad(changed), '重接紀錄也要完整配對，不能沿用旧 ext');
    }
    for (const done of [undefined, null, [], ['steel80'], ['steel80', 'steel80', 'happy70', 'trade1200'], ['steel80', 'trade1200', 'happy70'], ['happy70', 'constructor', 'steel80', 'trade1200']]) {
      equal(cmsLoad3d(fields.cms385, { ...fields.cms3d, done }), fields.cms385, '畸形重接完成紀錄只用合法 base');
    }
    const tech = active(1.5, { act: 'techC6', done: ['techC6'] });
    equal(cmsLoad3d(tech), emptyCms());
    equal(cmsSave3d(tech), { cms385: null, cms3d: null });
    const techBase = { ...tech, acc: 1, done: [] };
    equal(cmsLoad3d(techBase, { v: 1, base: techBase, acc: 1.5, done: ['techC6'] }), techBase, '附加欄位也不能復活科技重接');
    // 放棄與再次完成後，先前紀錄還在，精度／重接附加欄位清掉，不重複 done。
    for (const mode of ['drop', 'done', 'expired']) {
      const L = d045Load(fields);
      if (mode === 'drop') dropCommission(L.sim);
      else {
        const result = cmsDaily(L.sim.cms, { diff: 1, day: mode === 'done' ? L.sim.day + 1 : L.sim.cms.st + 120, steelUsed: mode === 'done' ? 80 : 0, tradeGold: 0, transitRidership: 0, cityHappy: 0, steel: 0, fuel: 0, tech: [] });
        assert.equal(result.t, mode);
        if (mode === 'done') assert.equal(result.bonus, 2500);
      }
      const raw = rawOf(save(L));
      assert.equal('cms3d' in raw, false);
      assert.equal(L.sim.cms.n, fields.cms385.n + 1);
      equal(raw.cms385.done, fields.cms3d.done);
      equal(reload(save(L), ctx).sim.cms, L.sim.cms);
    }
    return `${cases} 種重接順序／精度、6 次正式接單存讀、6 欄陳舊配對、科技拒絕與清理`;
  });

  await guard('真實造船鋼材日結產生小數；逐日存讀不中斷累計直到完成', () => {
    const ctx = d045Load(), w2 = d036Runs().find(r => r.id === 'W2');
    const raw = rawOf(w2.code); delete raw.z; delete raw.d3;
    // W2 起手改成只有半單位鋼材、沒有鋼鐵廠，讓第一天造船真的用掉 .5；後續靠正常進口補貨。
    // 委託進度從 0 起，不直接塞小數進度或達標值。
    raw.steel364 = .5;
    raw.bl = raw.bl.filter(b => b[1] !== 122);
    raw.cms385 = active(0, { act: 'steel40', st: raw.day, done: [] });
    let q = reload(encodeLabCode(raw), ctx), total = 0, fractionalDays = 0, completed = false, days = 0;
    for (; days < 90 && q.sim.cms.act; days++) {
      const r = stepDay(q.sim);
      total += r.econ.ec.steelUsed;
      if (r.commission?.t === 'done') {
        assert.equal(r.commission.id, 'steel40');
        assert.ok(total >= 40);
        completed = true;
      } else {
        assert.equal(q.sim.cms.acc, total);
        if (!Number.isInteger(total)) fractionalDays++;
      }
      // 只驗本接頭的逐日精度；完整歷史往返在上一組，W2 長軌跡不把起始碼反覆包進歷史。
      const expected = copy(q.sim.cms), code = save(q, { history: false });
      q = reload(code, ctx);
      equal(q.sim.cms, expected, `第 ${days + 1} 天存讀丟累計`);
    }
    assert.ok(fractionalDays > 0, '必須由真實 steelUsed 產生小數，不能直接塞達標進度');
    assert.ok(completed, `真正鋼材累計沒有完成，${days} 天共 ${total}`);
    assert.equal(q.sim.cms.act, '');
    assert.ok(q.sim.cms.done.includes('steel40'));
    assert.equal('cms3d' in rawOf(save(q)), false);
    return `${days} 天、${fractionalDays} 個未完成小數日、鋼材總用量 ${total}，逐日存讀後完成`;
  });

  await guard('接線突變：不寫精度、不清舊精度、不讀精度與不配對 done 都能抓到', async () => {
    const ctx = d045Load({ cms385: active() }), fields = cmsSave3d(active());
    const S = await loadMod('src/io/save.ts', [['if (cq.cms3d) o.cms3d = cq.cms3d;', 'if (false) o.cms3d = cq.cms3d;']]);
    const lost = reload(S.saveCode(ctx.sim, ctx.template, ctx.start), ctx);
    assert.notEqual(lost.sim.cms.acc, ctx.sim.cms.acc);
    const stale = d045Load(fields); dropCommission(stale.sim);
    const C = await loadMod('src/io/save.ts', [['else delete o.cms3d;', '']]);
    assert.ok(rawOf(C.saveCode(stale.sim, stale.template, stale.start)).cms3d);
    const D = await dayVariant([['cms: cmsLoad3d(save.raw.cms385, save.raw.cms3d),', 'cms: cmsLoad3d(save.raw.cms385),']]);
    const code = save(ctx), decoded = decodeLabCode(code);
    assert.notEqual(D.simFromSave(decoded.save, code, ctx.KT, ctx.vrank).cms.acc, ctx.sim.cms.acc);
    const M = await loadMod('src/sim/rules/commissionSave.ts', [['&& b.done.every((id, i) => id === c.done[i])', '']]);
    const changed = { ...fields.cms385, done: [...fields.cms385.done].reverse() };
    assert.notEqual(M.cmsLoad3d(changed, fields.cms3d).acc, cmsLoad3d(changed, fields.cms3d).acc);
    return '4 個突變全抓到';
  });
}
