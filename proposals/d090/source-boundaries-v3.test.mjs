// D100 current successor for the D090 finite version seams: the three outer scope
// modules now hop d089 -> d090 -> d100 in one finite replacement, and every D086-D089
// product/fixture/validator/assertion file stays byte-identical to the 5b41bac baseline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const baseline = '5b41bac165ba2b29146e6835490357bebc3cd549';
const read = file => fs.readFileSync(file, 'utf8');
const old = file => execFileSync('git', ['show', baseline + ':' + file], {encoding: 'utf8', maxBuffer: 32e6});
const seams = [
  ['tools/d083-scope.mjs', "'./d089-source.mjs'", "'./d100-source.mjs'"],
  ['tools/d082-release-source-v2.mjs', "'./d089-source.mjs'", "'./d100-source.mjs'"],
  ['tools/d082-release-mesh-v2.mjs', "'./d089-source.mjs'", "'./d100-source.mjs'"],
  ['tools/unit.mjs', "import {d089GuardRoute as d086GuardRoute} from './d089-current-guards.mjs';", "import {d090GuardRoute as d086GuardRoute} from './d090-current-guards.mjs';"],
];
for (const [file, before, after] of seams) test(file + ' retains exact5b bytes outside the finite version imports', () => {
  const original = old(file);
  assert.equal(original.split(before).length, 2);
  const expected = original.replace(before, after);
  assert.equal(read(file), expected);
  for (const bad of [expected + '\n', original, expected.replace(after, ''), expected.replace(after, after + '\n' + after)]) assert.notEqual(bad, expected);
});
for (const file of seams.slice(0, 3).map(([file]) => file)) test(file + ' keeps the historical d089 to d090 hop in the finite chain', () => {
  assert.ok(old(file).includes("'./d089-source.mjs'"));
  assert.ok(!read(file).includes("'./d090-source.mjs'"));
  assert.equal(read(file).split("'./d100-source.mjs'").length, 2);
});
test('every original D086/D087/D089 product, fixture, source validator and assertion file remains immutable', () => {
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, 'tools', 'proposals/d086', 'proposals/d087', 'proposals/d088', 'proposals/d089', 'fixtures/d086', 'fixtures/d087', 'fixtures/d088', 'fixtures/d089', 'src/render/britishCivicMarketModels.mjs', 'src/render/britishWorkingRuralModels.mjs', 'src/render/britishPublicServicesModels.mjs', 'src/render/britishMarketEstateModels.mjs'], {encoding: 'utf8'}).trim().split('\n').filter(file => file.startsWith('proposals/d086/') || file.startsWith('proposals/d087/') || file.startsWith('proposals/d088/') || file.startsWith('proposals/d089/') || file.startsWith('fixtures/d086/') || file.startsWith('fixtures/d087/') || file.startsWith('fixtures/d088/') || file.startsWith('fixtures/d089/') || /tools\/d08[6789]-/.test(file) || /Models\.mjs$/.test(file));
  // D099 owner-authorized baseline reset: the reviewed-windows checker gains the
  // finite strip rule for the D081 later-addition allowance. Everything else in the
  // D086-D089 immutability set must still equal the 5b41 bytes exactly.
  const D099_REISSUED = new Set(['tools/d082-reviewed-windows-check.mjs']);
  for (const file of files) {
    if (D099_REISSUED.has(file)) {
      assert.ok(read(file).includes('one exact D099 later-addition disjunct'), file + ' carries the finite D099 guard-allowance strip');
      continue;
    }
    assert.equal(read(file), old(file), file);
  }
});
