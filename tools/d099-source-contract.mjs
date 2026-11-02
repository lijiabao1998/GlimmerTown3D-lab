// D099 outer source lease: all263 released files pinned plus exactly the two
// transit prototype sources. Runtime imports never use preimages; historical
// D090 evidence stays byte-exact and receives the released 263 projection.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as prior from './d090-source.mjs';

export const D099_BASELINE = '1aed2c7b7d6ed819e91e381ceb2c68d1e1033632';
export const D099_ADDED = Object.freeze(['src/sim/transit/graph.ts', 'src/sim/transit/movement.ts']);
export const D099_CURRENT_PATHS = Object.freeze([...prior.D090_CURRENT_PATHS, ...D099_ADDED].sort());
export const D090_CURRENT_PATHS = prior.D090_CURRENT_PATHS;
export const D084_CHANGED = prior.D084_CHANGED;
export const D084_ADDED = Object.freeze([...new Set([...prior.D084_ADDED, ...D099_ADDED])]);
const sha = value => createHash('sha256').update(value).digest('hex');
const HASH = /^[a-f0-9]{64}$/;

export function createD099Lease(bytes, expectedHash) {
  assert.equal(typeof bytes, 'string', 'exact finite D099 manifest: text required');
  assert.match(expectedHash, HASH);
  assert.equal(sha(bytes), expectedHash, 'exact finite D099 manifest');
  const m = JSON.parse(bytes);
  assert.deepEqual(Object.keys(m), ['schema', 'baseline', 'qualification', 'baselineFiles', 'added']);
  assert.equal(m.schema, 1);
  assert.equal(m.baseline, D099_BASELINE, 'exact declared baseline');
  assert.equal(typeof m.qualification, 'string');
  assert.ok(m.qualification.length > 0, 'qualification text is required');
  assert.deepEqual(Object.keys(m.baselineFiles), prior.D090_CURRENT_PATHS, 'all263 released source files');
  assert.deepEqual(Object.keys(m.added), D099_ADDED, 'only the two declared transit sources');
  for (const pin of Object.values(m.baselineFiles)) assert.match(pin, HASH);
  for (const pin of Object.values(m.added)) assert.match(pin, HASH);

  function d099PriorSource(file, text) {
    if (D099_ADDED.includes(file)) {
      assert.equal(typeof text, 'string', file + ' exact allowed source: actual text required');
      assert.equal(sha(text), m.added[file], file + ' exact allowed source: actual added bytes');
      return '';
    }
    assert.ok(Object.hasOwn(m.baselineFiles, file), file + ' exact allowed source: unknown path');
    return prior.d090PriorSource(file, text);
  }
  function d099PriorInventory(files, read) {
    assert.ok(Array.isArray(files));
    assert.equal(typeof read, 'function');
    assert.equal(new Set(files).size, files.length, 'duplicate actual source');
    assert.deepEqual([...files].sort(), D099_CURRENT_PATHS, 'exact265 current source inventory');
    for (const file of files) d099PriorSource(file, read(file));
    return [...prior.D090_CURRENT_PATHS];
  }
  return Object.freeze({
    d099PriorSource,
    d099PriorInventory,
    d090PriorSource: (file, text) => D099_ADDED.includes(file) ? d099PriorSource(file, text) : prior.d090PriorSource(file, text),
    d090PriorInventory: (files, read) => prior.d090PriorInventory(d099PriorInventory(files, read), file => read(file)),
    d084PriorSource: (file, text) => D099_ADDED.includes(file) ? d099PriorSource(file, text) : prior.d084PriorSource(file, text),
    d084PriorInventory: (files, read) => prior.d084PriorInventory(d099PriorInventory(files, read), file => read(file)),
  });
}
