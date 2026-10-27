// D090 current-version copy of the unchanged published D087 farm regression.
// Only the two complete source-expression literals evolve: the D087 mutant
// still removes only its own exception, retaining the exact D089 and D090 exceptions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

export const FARM_PRECEDENCE_BASELINE = '5b41bac165ba2b29146e6835490357bebc3cd549';
export const FARM_PRECEDENCE_ORIGINAL = 'proposals/d087/native-farm-precedence-d089.test.mjs';
export const FARM_PRECEDENCE_CURRENT = 'proposals/d087/native-farm-precedence-d090.test.mjs';
export const FARM_PRECEDENCE_ORIGINAL_SHA256 = '1a6e17f0345480774863c23bafdae49cdc17be0954d60cc6acabbc9846596609';
export const FARM_PRECEDENCE_CHANGES = Object.freeze([
  {
    "before": "seam='blocks?.villageArt && blocks.detail && !(shape?.p?.nativeWorkingRural === true && workingRuralSlot(b.k,b.v)) && !(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v)) ? villageKind(b.k) : null'",
    "after": "seam='blocks?.villageArt && blocks.detail && !(shape?.p?.nativeWorkingRural === true && workingRuralSlot(b.k,b.v)) && !(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v)) && !(shape?.p?.nativeUtilityHeritage === true && utilityHeritageSlot(b.k,b.v)) ? villageKind(b.k) : null'",
    "count": 1
  },
  {
    "before": "prior='blocks?.villageArt && blocks.detail && !(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v)) ? villageKind(b.k) : null'",
    "after": "prior='blocks?.villageArt && blocks.detail && !(shape?.p?.nativeMarketEstates === true && marketEstateSlot(b.k,b.v)) && !(shape?.p?.nativeUtilityHeritage === true && utilityHeritageSlot(b.k,b.v)) ? villageKind(b.k) : null'",
    "count": 1
  }
].map(Object.freeze));
const sha = text => createHash('sha256').update(text).digest('hex');
const read = file => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
export function currentFarmPrecedenceTest(original) {
  assert.equal(sha(original), FARM_PRECEDENCE_ORIGINAL_SHA256, 'exact immutable5b D087 farm regression');
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
  assert.equal(current, currentFarmPrecedenceTest(original), 'only the two declared D090 predicate-preserving literals may change');
  return {copies: 1, changes: 2, originalSha256: sha(original), currentSha256: sha(current)};
}
