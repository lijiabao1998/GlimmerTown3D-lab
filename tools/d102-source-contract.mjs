// D102 outer source lease: all267 D100 current files pinned at the declared
// baseline, of which exactly the seven steel-construction history files are
// modified (D090 shape: before/beforeSha256/afterSha256). Historical source
// readers receive the D100 `before` bytes on every downward projection; runtime
// imports never use preimages. Nothing is added: the inventory stays 267.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as prior from './d100-source.mjs';
import {D085_CHANGED as D090_D085_CHANGED, d085PriorSource as d090D085PriorSource} from './d090-source.mjs';

export const D102_BASELINE = 'b328a07866ead482489c3c382bea867d7fa91c19';
export const D102_MODIFIED = Object.freeze(['src/io/journal.ts', 'src/io/save.ts', 'src/sim/city.ts', 'src/sim/day.ts', 'src/sim/decisions.ts', 'src/sim/eventRegistry.ts', 'src/sim/replay.ts']);
export const D102_CURRENT_PATHS = prior.D100_CURRENT_PATHS;
export const D100_CURRENT_PATHS = prior.D100_CURRENT_PATHS;
export const D100_ADDED = prior.D100_ADDED;
export const D099_CURRENT_PATHS = prior.D099_CURRENT_PATHS;
export const D090_CURRENT_PATHS = prior.D090_CURRENT_PATHS;
export const D085_CHANGED = D090_D085_CHANGED;
export const D084_CHANGED = Object.freeze([...new Set([...prior.D084_CHANGED, ...D102_MODIFIED])]);
export const D084_ADDED = prior.D084_ADDED;
const sha = value => createHash('sha256').update(value).digest('hex');
const HASH = /^[a-f0-9]{64}$/;

export function createD102Lease(bytes, expectedHash) {
  assert.equal(typeof bytes, 'string', 'exact finite D102 manifest: text required');
  assert.match(expectedHash, HASH);
  assert.equal(sha(bytes), expectedHash, 'exact finite D102 manifest');
  const m = JSON.parse(bytes);
  assert.deepEqual(Object.keys(m), ['schema', 'baseline', 'qualification', 'baselineFiles', 'modified']);
  assert.equal(m.schema, 1);
  assert.equal(m.baseline, D102_BASELINE, 'exact declared baseline');
  assert.equal(typeof m.qualification, 'string');
  assert.ok(m.qualification.length > 0, 'qualification text is required');
  assert.deepEqual(Object.keys(m.baselineFiles), prior.D100_CURRENT_PATHS, 'all267 D100 current source files');
  assert.deepEqual(Object.keys(m.modified), D102_MODIFIED, 'only the seven declared D102 history files');
  for (const pin of Object.values(m.baselineFiles)) assert.match(pin, HASH);
  for (const [file, r] of Object.entries(m.modified)) {
    assert.deepEqual(Object.keys(r), ['before', 'beforeSha256', 'afterSha256'], file);
    assert.equal(typeof r.before, 'string', file);
    assert.equal(sha(r.before), r.beforeSha256, file + ' before bytes');
    assert.equal(r.beforeSha256, m.baselineFiles[file], file + ' before is the D100 baseline');
    assert.match(r.afterSha256, HASH);
    assert.notEqual(r.afterSha256, r.beforeSha256, file + ' declared modification changes bytes');
  }

  function d102PriorSource(file, text) {
    assert.ok(Object.hasOwn(m.baselineFiles, file), file + ' exact allowed source: unknown path');
    assert.equal(typeof text, 'string', file + ' exact allowed source: actual text required');
    assert.equal(sha(text), m.modified[file]?.afterSha256 ?? m.baselineFiles[file], file + ' exact allowed source: all actual current bytes');
    return m.modified[file]?.before ?? text;
  }
  function d102PriorInventory(files, read) {
    assert.ok(Array.isArray(files));
    assert.equal(typeof read, 'function');
    assert.equal(new Set(files).size, files.length, 'duplicate actual source');
    assert.deepEqual([...files].sort(), D102_CURRENT_PATHS, 'exact267 current source inventory');
    for (const file of files) d102PriorSource(file, read(file));
    return [...prior.D100_CURRENT_PATHS];
  }
  // Every projection hands the D100 bytes down (never the current text): the
  // D100, D099 and D090 layers then check those against their own pins.
  const down = fn => (file, text) => fn(file, d102PriorSource(file, text));
  const inventory = fn => (files, read) => fn(d102PriorInventory(files, read), file => d102PriorSource(file, read(file)));
  return Object.freeze({
    d102PriorSource,
    d102PriorInventory,
    d100PriorSource: down(prior.d100PriorSource),
    d100PriorInventory: inventory(prior.d100PriorInventory),
    d099PriorSource: down(prior.d099PriorSource),
    d099PriorInventory: inventory(prior.d099PriorInventory),
    d090PriorSource: down(prior.d090PriorSource),
    d090PriorInventory: inventory(prior.d090PriorInventory),
    d085PriorSource: (file, text) => { const before = d102PriorSource(file, text); prior.d100PriorSource(file, before); return d090D085PriorSource(file, before); },
    d084PriorSource: down(prior.d084PriorSource),
    d084PriorInventory: inventory(prior.d084PriorInventory),
  });
}
