import assert from 'node:assert/strict';
import { CMS385, CMS_BY_ID385, emptyCms, cmsOffers, cmsHash } from '../src/sim/rules/commission.ts';
import { playableCmsOffers, COMMISSION_OFFER_POLICY } from '../src/sim/rules/commissionAvailability.ts';
import { acceptCommission, commissionOffers, dropCommission, toolLock } from '../src/sim/edit.ts';
import { stepDay } from '../src/sim/day.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { RANKS } from '../src/sim/rules/rank.ts';
import { builtBase } from './d036-cities.mjs';
import { d045Load } from './d045-cities.mjs';
import { foodExportCode, naturalSpaceUnlockCode } from './d046-cities.mjs';
const { KT, vrank } = builtBase();
const load = code => { const r = loadCode(code, KT, vrank); assert.ok(r.ok, r.error); return r; };
export async function d046Guards(log) {
  const test = (name, fn) => { try { const info = fn(); log(true, 'D046 ' + name, info); } catch (e) { log(false, 'D046 ' + name, e.stack); } };
  test('offers v1: deterministic playable pool, legacy order and IDs retained', () => {
    assert.equal(COMMISSION_OFFER_POLICY, '3d-capabilities-v1'); assert.equal(CMS385.length, 11);
    let comparisons = 0;
    for (const seed of [0, -1, 2147483647, -2147483648, 4294967295, 9007199254740991, ...Array.from({ length: 100 }, (_, i) => i * 7919)]) for (let rank = 0; rank < 26; rank++) for (let n = 0; n < 8; n++) {
      const cms = { ...emptyCms(), n, done: n % 2 ? ['techC6'] : [] }, a = playableCmsOffers(seed, rank, cms), ids = a.map(c => c.id);
      assert.deepEqual(ids, playableCmsOffers(seed, rank, structuredClone(cms)).map(c => c.id));
      assert.equal(new Set(ids).size, ids.length); assert.ok(a.every(c => c.src !== 'transit' && c.minRank <= rank + 1));
      const eligible = CMS385.filter(c => c.src !== 'transit' && c.minRank <= rank + 1 && !(c.type === 'tech' && cms.done.includes(c.id)));
      assert.equal(a.length, Math.min(3, eligible.length));
      const old = cmsOffers(seed, rank, cms).filter(c => c.src !== 'transit').map(c => c.id);
      assert.deepEqual(ids.slice(0, old.length), old); comparisons++;
    }
    // Freeze the known floating-multiply output, not a substituted imul algorithm.
    assert.equal(cmsHash(2147483647, 0, 3850), 0.558386716991663);
    return `${comparisons} seed/rank/round states`;
  });
  test('accept uses displayed offers; repeats do not add events; old transit drops without penalty', () => {
    const L = d045Load(), s = L.sim;
    const offers = commissionOffers(s), h = s.city.history.length;
    assert.equal(acceptCommission(s, 1)?.id, offers[1].id); assert.equal(acceptCommission(s, 1), null); assert.equal(s.city.history.length, h + 1);
    for (const id of ['transit150', 'transit400']) {
      const old = d045Load({ cms385: { act: id, st: 140, acc: 0, hold: 12, n: 2, done: [] } }).sim, money = old.money;
      assert.equal(old.cms.act, id); assert.equal(dropCommission(old)?.id, id); assert.equal(old.money, money); assert.equal(old.cms.n, 3);
      assert.equal(dropCommission(old), null); assert.ok(commissionOffers(old).every(c => c.src !== 'transit'));
    }
    const L2 = load(saveCode(s, L.template, L.start)); assert.deepEqual(commissionOffers(L2.sim).map(c => c.id), commissionOffers(s).map(c => c.id));
    assert.equal(acceptCommission(d045Load().sim, 0.5), null);
  });
  test('real food-export daily flow completes both targets from zero; each pays exactly once', () => {
    const summaries = [];
    for (const id of ['trade1200', 'trade3000']) {
      const s = load(foodExportCode(id)).sim, control = load(foodExportCode('')).sim, def = CMS_BY_ID385[id];
      let sum = 0, count = 0, completion = 0;
      for (let n = 0; n < def.days + 3; n++) {
        const rep = stepDay(s), normal = stepDay(control);
        if (!count) sum += normal.econ.late.tradeGold;
        if (rep.commission?.t === 'done') { count++; completion = n + 1; assert.equal(rep.commission.id, id); }
        if (s.cms.act) assert.equal(s.cms.acc, sum);
        assert.ok(Math.abs((s.money - control.money) - (count ? def.bonus : 0)) < 1e-8);
      }
      assert.equal(count, 1); assert.ok(completion > 1 && completion <= def.days); assert.ok(sum >= def.target); assert.ok(s.cms.done.includes(id));
      assert.equal(s.city.history.filter(e => e.t === 'cms' && e.ev === 'done' && e.id === id).length, 1);
      summaries.push(`${id}: day ${completion}, +$${def.bonus}`);
    }
    return summaries.join('; ');
  });
  test('Lv.22 space center naturally unlocks through daily cityPoints assessment', () => {
    const { sim: s } = load(naturalSpaceUnlockCode());
    assert.equal(s.rankIdx, 20); assert.match(toolLock(s, 'megaproject'), /Lv\.22/);
    const rep = stepDay(s); assert.equal(rep.rank.points, 18368); assert.deepEqual(rep.rank.promoted, [21]); assert.equal(s.rankIdx, 21);
    assert.equal(toolLock(s, 'megaproject'), null); assert.match(RANKS[21].unlock, /太空研究中心/);
    return `${rep.rank.points} points → Lv.${s.rankIdx + 1}: ${RANKS[21].unlock}`;
  });
}
