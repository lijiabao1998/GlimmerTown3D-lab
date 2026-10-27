import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  FARM_PRECEDENCE_BASELINE, FARM_PRECEDENCE_ORIGINAL, FARM_PRECEDENCE_CURRENT,
  FARM_PRECEDENCE_CHANGES, currentFarmPrecedenceTest, assertNativeFarmPrecedenceCopy,
} from './native-farm-precedence-copy.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const read = file => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
const original = read(FARM_PRECEDENCE_ORIGINAL), current = read(FARM_PRECEDENCE_CURRENT);
const d090 = " && !(shape?.p?.nativeUtilityHeritage === true && utilityHeritageSlot(b.k,b.v))";
const d089 = ' && !(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v))';
const d087 = ' && !(shape?.p?.nativeWorkingRural === true && workingRuralSlot(b.k,b.v))';
const originalSeam = 'blocks?.villageArt && blocks.detail' + d087 + d089 + ' ? villageKind(b.k) : null';
const originalPrior = 'blocks?.villageArt && blocks.detail' + d089 + ' ? villageKind(b.k) : null';
const currentSeam = 'blocks?.villageArt && blocks.detail' + d087 + d089 + d090 + ' ? villageKind(b.k) : null';
const currentPrior = 'blocks?.villageArt && blocks.detail' + d089 + d090 + ' ? villageKind(b.k) : null';
function rejectCopy(mutant) {
  assert.notEqual(mutant, current, 'negative must actually mutate the current copy');
  assert.throws(() => assertNativeFarmPrecedenceCopy(file => file === FARM_PRECEDENCE_CURRENT ? mutant : read(file)));
}

test('exact5b original and two-literal current copy retain every original assertion and body byte', () => {
  assert.equal(original, execFileSync('git', ['show', FARM_PRECEDENCE_BASELINE + ':' + FARM_PRECEDENCE_ORIGINAL], {cwd: root, encoding: 'utf8'}));
  assert.deepEqual(FARM_PRECEDENCE_CHANGES, [
    {before: "seam='" + originalSeam + "'", after: "seam='" + currentSeam + "'", count: 1},
    {before: "prior='" + originalPrior + "'", after: "prior='" + currentPrior + "'", count: 1},
  ]);
  assert.equal(current, currentFarmPrecedenceTest(original));
  let inverse = current;
  for (const change of FARM_PRECEDENCE_CHANGES) {
    assert.equal(inverse.split(change.after).length, 2);
    inverse = inverse.replace(change.after, change.before);
  }
  assert.equal(inverse, original, 'all assertions, imports, probes, owner bytes and cleanup remain exact');
  const checked = assertNativeFarmPrecedenceCopy();
  assert.equal(checked.copies, 1); assert.equal(checked.changes, 2);
});

test('mutant removes only D087 exception while preserving the exact D089 and D090 opt-ins and slot predicate', () => {
  assert.equal(currentSeam.replace(d087, ''), currentPrior);
  assert.equal(currentSeam.split(d089).length, 2);
  assert.equal(currentPrior.split(d089).length, 2);
  const source = read('src/render/cityScene.ts');
  assert.equal(source.split(currentSeam).length, 2, 'one actual production seam');
  const mutant = source.replace(currentSeam, currentPrior);
  assert.equal(mutant.replace(currentPrior, currentSeam), source, 'only D087 precedence changes in the actual mutant');
  for (const expression of [currentSeam, currentPrior]) for (const altered of [
    expression.replace(d089, ''),
    expression.replace(d090, ''),
    expression.replace('nativeUtilityHeritage === true', 'nativeUtilityHeritage !== false'),
    expression.replace('nativeUtilityHeritage === true && ', ''),
    expression.replace(' && utilityHeritageSlot(b.k,b.v)', ''),
    expression.replace('utilityHeritageSlot(b.k,b.v)', 'utilityHeritageSlot(b.k,5)'),
    expression.replace('utilityHeritageSlot(b.k,b.v)', 'utilityHeritageSlot(16,b.v)'),
    expression.replace('nativeMarketEstates === true', 'nativeMarketEstates !== false'),
    expression.replace('nativeMarketEstates === true && ', ''),
    expression.replace(' && marketEstateSlot(b.k,b.v)', ''),
    expression.replace('marketEstateSlot(b.k,b.v)', 'marketEstateSlot(b.k,17)'),
    expression.replace('marketEstateSlot(b.k,b.v)', 'marketEstateSlot(22,b.v)'),
  ]) rejectCopy(current.replace(expression, altered));
  rejectCopy(current.replace(currentSeam, currentSeam.replace(d087, '')));
  rejectCopy(current.replace(currentPrior, currentSeam));
});

test('source/copy assertion edits, unknown bytes and missing/extra seams fail closed', () => {
  for (const text of [original + '\n', original.slice(1), original.replace('changed.length,1', 'changed.length,0')]) {
    assert.throws(() => currentFarmPrecedenceTest(text));
    assert.throws(() => assertNativeFarmPrecedenceCopy(file => file === FARM_PRECEDENCE_ORIGINAL ? text : read(file)));
  }
  for (const [before, after] of [
    ['assert.equal(changed.length,1);', 'assert.equal(changed.length,0);'],
    ["assert.equal(changed[0].slot,'22:16');", "assert.equal(changed[0].slot,'22:17');"],
    ['assert.equal(report.nonFarmOwnersByteExact,16);', 'assert.equal(report.nonFarmOwnersByteExact,15);'],
    ["assert.equal(mutant.ownerBytes[i][b.id],current.ownerBytes[i][b.id],'every nonfarm owner retained byte exactly');", ''],
    ["assert.throws(()=>assert.equal(changed[0].mutant,changed[0].expected,'complete native farm owner'));", ''],
    ["assert.equal(sha(fs.readFileSync(file)),report.sourceSha256,'actual product source unchanged');", ''],
    ["import {runtime}from'./scene-budget-support.mjs';", "import {runtime}from'../d089/scene-budget-support.mjs';"],
    ["source.replace(seam,prior)", "source"],
  ]) { assert.equal(current.split(before).length, 2); rejectCopy(current.replace(before, after)); }
  for (const mutant of [current + '\n', current.slice(1), current.replace(currentSeam, ''), current + FARM_PRECEDENCE_CHANGES[0].after]) rejectCopy(mutant);
});
