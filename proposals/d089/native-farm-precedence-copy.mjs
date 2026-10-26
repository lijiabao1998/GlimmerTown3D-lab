// D089 current-version copy of the unchanged published D087 farm regression.
// Only the two complete source-expression literals evolve: the D087 mutant
// still removes only its own exception, retaining the exact D089 exception.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

export const FARM_PRECEDENCE_BASELINE = 'c023a2da0e4999d43e3d4216e800c4c96d06a3c1';
export const FARM_PRECEDENCE_ORIGINAL = 'proposals/d087/native-farm-precedence.test.mjs';
export const FARM_PRECEDENCE_CURRENT = 'proposals/d087/native-farm-precedence-d089.test.mjs';
export const FARM_PRECEDENCE_ORIGINAL_SHA256 = 'e34f3ce37253246ec24fbd0f9b2bd538dbb46c1262f5941cf7e1e49c06a93ffc';
export const FARM_PRECEDENCE_CHANGES = Object.freeze([
  Object.freeze({
    before: "seam='blocks?.villageArt && blocks.detail && !(shape?.p?.nativeWorkingRural === true && workingRuralSlot(b.k,b.v)) ? villageKind(b.k) : null'",
    after: "seam='blocks?.villageArt && blocks.detail && !(shape?.p?.nativeWorkingRural === true && workingRuralSlot(b.k,b.v)) && !(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v)) ? villageKind(b.k) : null'",
    count: 1,
  }),
  Object.freeze({
    before: "prior='blocks?.villageArt && blocks.detail ? villageKind(b.k) : null'",
    after: "prior='blocks?.villageArt && blocks.detail && !(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v)) ? villageKind(b.k) : null'",
    count: 1,
  }),
]);
const sha = text => createHash('sha256').update(text).digest('hex');
const read = file => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
export function currentFarmPrecedenceTest(original) {
  assert.equal(sha(original), FARM_PRECEDENCE_ORIGINAL_SHA256, 'exact immutable c023 D087 farm regression');
  let current = original;
  for (const {before, after, count} of FARM_PRECEDENCE_CHANGES) {
    assert.equal(current.split(before).length - 1, count, 'exact declared farm-precedence source seam');
    current = current.replace(before, after);
  }
  return current;
}
export function assertNativeFarmPrecedenceCopy(readFile = read) {
  const original = readFile(FARM_PRECEDENCE_ORIGINAL);
  const current = readFile(FARM_PRECEDENCE_CURRENT);
  assert.equal(current, currentFarmPrecedenceTest(original), 'only the two declared D089 predicate-preserving literals may change');
  return {copies: 1, changes: 2, originalSha256: sha(original), currentSha256: sha(current)};
}
