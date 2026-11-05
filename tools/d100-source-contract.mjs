// D100 outer source lease: all265 released files pinned plus exactly the two
// D100 transit model sources. Runtime imports never use preimages; the released
// 265 are projected unchanged to the D099 layer, which projects to D090.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as prior from './d099-source.mjs';

export const D100_BASELINE = '18a718c7d2b8d261183d98b74ca6d466df1c60f7';
export const D100_ADDED = Object.freeze(['src/sim/transit/format.ts', 'src/sim/transit/network.ts']);
export const D100_CURRENT_PATHS = Object.freeze([...prior.D099_CURRENT_PATHS, ...D100_ADDED].sort());
export const D099_CURRENT_PATHS = prior.D099_CURRENT_PATHS;
export const D090_CURRENT_PATHS = prior.D090_CURRENT_PATHS;
export const D084_CHANGED = prior.D084_CHANGED;
export const D084_ADDED = Object.freeze([...new Set([...prior.D084_ADDED, ...D100_ADDED])]);
const sha = value => createHash('sha256').update(value).digest('hex');
const HASH = /^[a-f0-9]{64}$/;

export function createD100Lease(bytes, expectedHash) {
  assert.equal(typeof bytes, 'string', 'exact finite D100 manifest: text required');
  assert.match(expectedHash, HASH);
  assert.equal(sha(bytes), expectedHash, 'exact finite D100 manifest');
  const m = JSON.parse(bytes);
  assert.deepEqual(Object.keys(m), ['schema', 'baseline', 'qualification', 'baselineFiles', 'added']);
  assert.equal(m.schema, 1);
  assert.equal(m.baseline, D100_BASELINE, 'exact declared baseline');
  assert.equal(typeof m.qualification, 'string');
  assert.ok(m.qualification.length > 0, 'qualification text is required');
  assert.deepEqual(Object.keys(m.baselineFiles), prior.D099_CURRENT_PATHS, 'all265 released source files');
  assert.deepEqual(Object.keys(m.added), D100_ADDED, 'only the two declared D100 sources');
  for (const pin of Object.values(m.baselineFiles)) assert.match(pin, HASH);
  for (const pin of Object.values(m.added)) assert.match(pin, HASH);

  function d100PriorSource(file, text) {
    if (D100_ADDED.includes(file)) {
      assert.equal(typeof text, 'string', file + ' exact allowed source: actual text required');
      assert.equal(sha(text), m.added[file], file + ' exact allowed source: actual added bytes');
      return '';
    }
    assert.ok(Object.hasOwn(m.baselineFiles, file), file + ' exact allowed source: unknown path');
    return prior.d099PriorSource(file, text);
  }
  function d100PriorInventory(files, read) {
    assert.ok(Array.isArray(files));
    assert.equal(typeof read, 'function');
    assert.equal(new Set(files).size, files.length, 'duplicate actual source');
    assert.deepEqual([...files].sort(), D100_CURRENT_PATHS, 'exact267 current source inventory');
    for (const file of files) d100PriorSource(file, read(file));
    return [...prior.D099_CURRENT_PATHS];
  }
  return Object.freeze({
    d100PriorSource,
    d100PriorInventory,
    d099PriorSource: (file, text) => D100_ADDED.includes(file) ? d100PriorSource(file, text) : prior.d099PriorSource(file, text),
    d099PriorInventory: (files, read) => prior.d099PriorInventory(d100PriorInventory(files, read), file => read(file)),
    d090PriorSource: (file, text) => D100_ADDED.includes(file) ? d100PriorSource(file, text) : prior.d090PriorSource(file, text),
    d090PriorInventory: (files, read) => prior.d090PriorInventory(d100PriorInventory(files, read), file => read(file)),
    d084PriorSource: (file, text) => D100_ADDED.includes(file) ? d100PriorSource(file, text) : prior.d084PriorSource(file, text),
    d084PriorInventory: (files, read) => prior.d084PriorInventory(d100PriorInventory(files, read), file => read(file)),
  });
}
