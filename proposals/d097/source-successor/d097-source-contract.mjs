// D097 successor source allowance — pre-activation form.
// Not imported by product code. Activation moves this contract to tools/ and
// rewires the finite outer seams; see README.md. Nothing here weakens D090.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {D090_CURRENT_PATHS, d090PriorInventory, d090PriorSource} from '../../../tools/d090-source.mjs';

export const D097_BASELINE = '1aed2c7b7d6ed819e91e381ceb2c68d1e1033632';
export const D097_ADDED = Object.freeze(['src/sim/transitGraph.ts', 'src/sim/transitMovement.ts']);
export const D097_CURRENT_PATHS = Object.freeze([...D090_CURRENT_PATHS, ...D097_ADDED].sort());
const sha = value => createHash('sha256').update(value).digest('hex');
const HASH = /^[a-f0-9]{64}$/;

export function createD097Lease(bytes, expectedHash) {
  assert.equal(typeof bytes, 'string', 'exact finite D097 successor manifest: text required');
  assert.match(expectedHash, HASH);
  assert.equal(sha(bytes), expectedHash, 'exact finite D097 successor manifest');
  const m = JSON.parse(bytes);
  assert.deepEqual(Object.keys(m), ['schema', 'baseline', 'qualification', 'baselineFiles', 'added']);
  assert.equal(m.schema, 1);
  assert.equal(m.baseline, D097_BASELINE, 'exact declared baseline');
  assert.equal(typeof m.qualification, 'string');
  assert.ok(m.qualification.length > 0, 'qualification text is required');
  assert.deepEqual(Object.keys(m.baselineFiles), D090_CURRENT_PATHS, 'all263 released source files');
  assert.deepEqual(Object.keys(m.added), D097_ADDED, 'only the two declared transit source files');
  for (const pin of Object.values(m.baselineFiles)) assert.match(pin, HASH);
  for (const pin of Object.values(m.added)) assert.match(pin, HASH);

  function d097PriorSource(file, text) {
    assert.ok(Object.hasOwn(m.baselineFiles, file) || D097_ADDED.includes(file), file + ' exact allowed source: unknown path');
    assert.equal(typeof text, 'string', file + ' exact allowed source: actual text required');
    assert.equal(sha(text), m.added[file] ?? m.baselineFiles[file], file + ' exact allowed source: all actual current bytes');
    return D097_ADDED.includes(file) ? '' : text;
  }
  function d097PriorInventory(files, read) {
    assert.ok(Array.isArray(files));
    assert.equal(typeof read, 'function');
    assert.equal(new Set(files).size, files.length, 'duplicate actual source');
    assert.deepEqual([...files].sort(), D097_CURRENT_PATHS, 'exact265 successor source inventory');
    for (const file of files) d097PriorSource(file, read(file));
    return [...D090_CURRENT_PATHS];
  }
  return Object.freeze({
    d097PriorSource,
    d097PriorInventory,
    d090PriorSource: (file, text) => D097_ADDED.includes(file) ? d097PriorSource(file, text) : d090PriorSource(file, text),
    d090PriorInventory: (files, read) => d090PriorInventory(d097PriorInventory(files, read), file => read(file)),
  });
}
