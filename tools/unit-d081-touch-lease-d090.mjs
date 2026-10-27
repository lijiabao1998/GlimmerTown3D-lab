// D090 finite current contract. Original tools/unit-d081-touch-lease-d089.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.
// D089 finite current contract. Original tools/unit-d081-touch-lease-d088.mjs remains byte-exact at c023a2da0e4999d43e3d4216e800c4c96d06a3c1.
// D088 finite current contract. Original tools/unit-d081-touch-lease-d087.mjs remains byte-exact at cdd541da74973dba2ca73b782936c012d315add9.
// D087 finite current contract. Original tools/unit-d081-touch-lease-d086.mjs is unchanged at b4275bda73e72a9fb48343376fccaab52bbc8e84.
// D086 current-version contract. Original tools/unit-d081-touch-lease.mjs remains unchanged and tested on77b8616.
// Actual renderer/model tests with original D052 DOM boundaries, not browser evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
const url = new URL('./unit-d052-d090.mjs?d081-touch-lease', import.meta.url).href;
const hook = registerHooks({ load(u, context, next) {
  const loaded = next(u, context);
  return u === url ? { ...loaded, source: String(loaded.source) + '\nexport { harness, promotionFixture, rows, row, buttons, panelText, count, resetCalls };\n' } : loaded;
} });
const { harness, promotionFixture, rows, row, buttons, panelText, count, resetCalls } = await import(url);
hook.deregister();
const baseline = file => execFileSync('git', ['show', '9e3452a438331feec4082f6821cfcb0b0e653c4b:' + file], { cwd: ROOT, encoding: 'utf8' });
const begin = (h, button, id = 701) => {
  h.doc.emit('pointerdown', { target: button, pointerId: id, pointerType: 'touch' });
  h.doc.emit('touchstart', { target: button, touches: [{ identifier: id + 50, target: button }] });
};
const release = (h, button, id = 701, reverse = false) => {
  const pointer = () => h.doc.emit('pointerup', { target: button, pointerId: id, pointerType: 'touch' });
  const touch = () => h.doc.emit('touchend', { target: button, touches: [] });
  if (reverse) { touch(); pointer(); } else { pointer(); touch(); }
  h.doc.runTimers();
};
const click = (h, button, id = 701) => h.doc.emit('click', { target: button, pointerId: id, pointerType: 'touch' });
const order = h => rows(h, 'cm', 'offer').map(e => e.dataset.k);
export async function d081TouchLeaseGuards(log = () => {}) {
  let failed = 0;
  const tests = [];
  const test = (name, fn) => {
    try { fn(); tests.push({ name, passed: true }); log(true, 'D081 touch lease ' + name); }
    catch (error) { failed++; tests.push({ name, passed: false, error: error.stack }); log(false, 'D081 touch lease ' + name, error.stack); }
  };
  for (const seed of [1, 5]) for (const reverse of [false, true]) test(`actual renderer next-task freshness and delayed acceptance seed${seed} reverse${reverse}`, () => {
    const h = harness(promotionFixture(seed)); h.openCommission();
    const original = buttons(row(h, 'cm', 'offer', 'happy70'))[0], before = panelText(h, 'cm');
    begin(h, original); h.advance(1); assert.deepEqual(panelText(h, 'cm'), before);
    release(h, original, 701, reverse);
    assert.equal(buttons(row(h, 'cm', 'offer', 'happy70'))[0], original);
    assert.deepEqual(order(h).slice(0, 2), ['trade1200', 'happy70']);
    assert.match(h.node('#cm .sub').textContent, /第 51 天.*10,319.*Lv.4/);
    if (seed === 5) { assert.equal(original.textContent, '已失效'); assert.equal(original.getAttribute('aria-disabled'), 'true'); assert.equal(original.disabled, false); }
    resetCalls(h); click(h, original); h.doc.runTimers();
    assert.equal(h.sim.cms.act, seed === 1 ? 'happy70' : '');
    assert.equal(count(h, 'accept'), 1); assert.equal(count(h, 'save'), seed === 1 ? 1 : 0);
    if (seed === 5) assert.deepEqual(order(h), ['steel40', 'techC6', 'trade1200']);
    else assert.equal(rows(h, 'cm', 'act').length, 1);
  });
  test('unaltered PR33 source fails new structural protection control', () => {
    const h = harness(promotionFixture(), baseline('src/cityView.ts'), { pressSource: baseline('src/ui/panelPress.ts') });
    h.openCommission(); const button = buttons(row(h, 'cm', 'offer', 'happy70'))[0];
    begin(h, button); h.advance(1); release(h, button);
    assert.throws(() => assert.deepEqual(order(h).slice(0, 2), ['trade1200', 'happy70']), { code: 'ERR_ASSERTION' });
    assert.deepEqual(order(h), ['happy70', 'steel40', 'trade1200']);
  });
  test('unrelated click cannot resolve released offer; later days remain fresh', () => {
    const h = harness(promotionFixture()); h.openCommission(); const button = buttons(row(h, 'cm', 'offer', 'happy70'))[0];
    begin(h, button); h.advance(1); release(h, button);
    h.doc.emit('click', { target: h.node('#tc'), pointerId: 999 }); h.advance(1);
    assert.deepEqual(order(h).slice(0, 2), ['trade1200', 'happy70']);
    assert.match(h.node('#cm .sub').textContent, /第 52 天/);
    assert.equal(buttons(row(h, 'cm', 'offer', 'happy70'))[0], button);
  });
  test('late cancellation after fallback releases pending structural reconciliation', () => {
    const h = harness(promotionFixture()); h.openCommission(); const button = buttons(row(h, 'cm', 'offer', 'happy70'))[0];
    begin(h, button); h.advance(1); release(h, button);
    h.doc.emit('pointercancel', { target: button, pointerId: 701 }); h.doc.runTimers();
    assert.deepEqual(order(h), ['happy70', 'steel40', 'trade1200']);
  });
  test('two contacts retain independent activation and reject second acceptance', () => {
    const h = harness(promotionFixture()); h.openCommission();
    const happy = buttons(row(h, 'cm', 'offer', 'happy70'))[0], trade = buttons(row(h, 'cm', 'offer', 'trade1200'))[0];
    begin(h, happy, 701); begin(h, trade, 702); h.advance(1);
    release(h, happy, 701); release(h, trade, 702);
    resetCalls(h); click(h, happy, 701);
    assert.equal(h.sim.cms.act, 'happy70');
    assert.equal(buttons(row(h, 'cm', 'offer', 'trade1200'))[0], trade);
    assert.equal(trade.textContent, '已失效');
    click(h, trade, 702); h.doc.runTimers();
    assert.equal(h.sim.cms.act, 'happy70'); assert.equal(count(h, 'save'), 1); assert.equal(count(h, 'accept'), 2);
    assert.equal(rows(h, 'cm', 'offer').length, 0);
  });
  test('close/reopen discards stale lease and queued presentation', () => {
    const h = harness(promotionFixture()); h.openCommission(); const button = buttons(row(h, 'cm', 'offer', 'happy70'))[0];
    begin(h, button); h.advance(1); release(h, button);
    h.node('#cmX').click(); h.doc.runTimers(); h.openCommission();
    assert.deepEqual(order(h), ['happy70', 'steel40', 'trade1200']);
  });
  test('reused pointer ID cannot silently discard an older unresolved target', () => {
    const h = harness(promotionFixture()); h.openCommission();
    const happy = buttons(row(h, 'cm', 'offer', 'happy70'))[0], trade = buttons(row(h, 'cm', 'offer', 'trade1200'))[0];
    begin(h, happy); h.advance(1); release(h, happy);
    begin(h, trade); release(h, trade);
    h.doc.emit('pointercancel', { target: trade, pointerId: 701 }); h.doc.runTimers();
    assert.deepEqual(order(h).slice(0, 2), ['trade1200', 'happy70']);
    assert.equal(buttons(row(h, 'cm', 'offer', 'happy70'))[0], happy);
    h.node('#cmX').click(); h.openCommission(); assert.deepEqual(order(h), ['happy70', 'steel40', 'trade1200']);
  });
  for (const selector of ['#cmX', '#tc']) test(`reused pointer ID on ${selector} cannot cancel an older offer lease`, () => {
    const h = harness(promotionFixture()); h.openCommission();
    const happy = buttons(row(h, 'cm', 'offer', 'happy70'))[0], other = h.node(selector);
    begin(h, happy); h.advance(1); release(h, happy);
    begin(h, other); release(h, other);
    h.doc.emit('pointercancel', { target: other, pointerId: 701 }); h.doc.runTimers();
    h.advance(1);
    assert.deepEqual(order(h).slice(0, 2), ['trade1200', 'happy70']);
    assert.equal(buttons(row(h, 'cm', 'offer', 'happy70'))[0], happy);
    assert.match(h.node('#cm .sub').textContent, /第 52 天/);
    h.node('#cmX').click(); h.openCommission();
    assert.equal(order(h)[0], 'happy70');
  });
  test('resource saturation conservatively preserves slots until explicit close', () => {
    const h = harness(promotionFixture()); h.openCommission(); const button = buttons(row(h, 'cm', 'offer', 'happy70'))[0];
    for (let id = 1; id <= 257; id++) { begin(h, button, id); release(h, button, id); }
    h.advance(1);
    for (let id = 1; id <= 257; id++) { h.doc.emit('pointercancel', { target: button, pointerId: id }); h.doc.runTimers(); }
    assert.deepEqual(order(h).slice(0, 2), ['trade1200', 'happy70']);
    assert.ok(rows(h, 'cm', 'offer').length <= 9);
    h.node('#cmX').click(); h.openCommission(); assert.deepEqual(order(h), ['happy70', 'steel40', 'trade1200']);
  });
  test('constructed actual-source early-release and dropped-freshness mutations are rejected', () => {
    const source = fs.readFileSync(new URL('../src/ui/panelPress.ts', import.meta.url), 'utf8');
    const controls = [
      ['early structural release', 'if (!offerLeases.size && !saturatedOffers) return kids;', 'if (true) return kids;'],
      ['dropped latest data', 'if (!panel.hidden) render?.();', 'if (false) render?.();'],
      ['wrong semantic slot', 'fresh.get(id) ?? copy(savedOffers.get(id)!) as HTMLElement', 'copy(savedOffers.get(offerSlots[0])!) as HTMLElement'],
    ];
    for (const [name, from, to] of controls) {
      assert.equal(source.split(from).length, 2, name + ' unique constructed mutation');
      const h = harness(promotionFixture(), undefined, { pressSource: source.replace(from, to) });
      // Harness construction compiles actual mutant before behavioral rejection.
      h.openCommission(); const button = buttons(row(h, 'cm', 'offer', 'happy70'))[0];
      assert.throws(() => {
        begin(h, button); h.advance(1); release(h, button);
        assert.equal(buttons(row(h, 'cm', 'offer', 'happy70'))[0], button);
        assert.deepEqual(order(h), ['trade1200', 'happy70', 'steel40']);
        assert.match(h.node('#cm .sub').textContent, /第 51 天/);
      }, { code: 'ERR_ASSERTION' }, name);
    }
  });
  return { failed, report: { passed: failed === 0, tests } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await d081TouchLeaseGuards((ok, name, detail = '') => console.log(ok ? 'OK' : 'NG', name, detail));
  process.exitCode = result.failed ? 1 : 0;
}
