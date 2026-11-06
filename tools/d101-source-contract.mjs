// D101 outer source lease: all267 D102 current files pinned at the declared
// baseline (main 76e074f), of which exactly the seven declared transit save/UI
// files are modified (D090 shape: before/beforeSha256/afterSha256), plus exactly
// two added transit sources. 267 + 2 = 269. Historical source readers receive the
// D102 `before` bytes on every downward projection, through both the source and
// the inventory path (never the D099/D100 `file => read(file)` shortcut: those
// layers added files but modified none); added files project to ''. Runtime
// imports never use preimages. This module never reads git (ci build is depth 1).
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as prior from './d102-source.mjs';

export const D101_BASELINE = '76e074ff66f01e5e0ced8c946b13584226f0d6b6';
export const D101_MODIFIED = Object.freeze(['src/cityView.ts', 'src/io/journal.ts', 'src/io/save.ts', 'src/sim/city.ts', 'src/sim/edit.ts', 'src/sim/eventRegistry.ts', 'src/sim/replay.ts']);
export const D101_ADDED = Object.freeze(['src/render/transitArt.ts', 'src/sim/transit/history.ts']);
export const D101_CURRENT_PATHS = Object.freeze([...prior.D102_CURRENT_PATHS, ...D101_ADDED].sort());
export const D102_CURRENT_PATHS = prior.D102_CURRENT_PATHS;
export const D102_MODIFIED = prior.D102_MODIFIED;
export const D100_CURRENT_PATHS = prior.D100_CURRENT_PATHS;
export const D100_ADDED = prior.D100_ADDED;
export const D099_CURRENT_PATHS = prior.D099_CURRENT_PATHS;
export const D090_CURRENT_PATHS = prior.D090_CURRENT_PATHS;
export const D085_CHANGED = prior.D085_CHANGED;
// No-op widening (all seven are already among the D102 42); kept explicit so the
// declared set is visible. Added files join D084_ADDED only (D099/D100 precedent).
export const D084_CHANGED = Object.freeze([...new Set([...prior.D084_CHANGED, ...D101_MODIFIED])]);
export const D084_ADDED = Object.freeze([...new Set([...prior.D084_ADDED, ...D101_ADDED])]);
const sha = value => createHash('sha256').update(value).digest('hex');
const HASH = /^[a-f0-9]{64}$/;

export function createD101Lease(bytes, expectedHash) {
  assert.equal(typeof bytes, 'string', 'exact finite D101 manifest: text required');
  assert.match(expectedHash, HASH);
  assert.equal(sha(bytes), expectedHash, 'exact finite D101 manifest');
  const m = JSON.parse(bytes);
  assert.deepEqual(Object.keys(m), ['schema', 'baseline', 'qualification', 'baselineFiles', 'modified', 'added']);
  assert.equal(m.schema, 1);
  assert.equal(m.baseline, D101_BASELINE, 'exact declared baseline');
  assert.equal(typeof m.qualification, 'string');
  assert.ok(m.qualification.length > 0, 'qualification text is required');
  assert.deepEqual(Object.keys(m.baselineFiles), prior.D102_CURRENT_PATHS, 'all267 D102 current source files');
  assert.deepEqual(Object.keys(m.modified), D101_MODIFIED, 'only the seven declared D101 transit save/UI files');
  assert.deepEqual(Object.keys(m.added), D101_ADDED, 'only the two declared D101 sources');
  for (const pin of Object.values(m.baselineFiles)) assert.match(pin, HASH);
  for (const [file, r] of Object.entries(m.modified)) {
    assert.deepEqual(Object.keys(r), ['before', 'beforeSha256', 'afterSha256'], file);
    assert.equal(typeof r.before, 'string', file);
    assert.equal(sha(r.before), r.beforeSha256, file + ' before bytes');
    assert.equal(r.beforeSha256, m.baselineFiles[file], file + ' before is the D102 baseline');
    assert.match(r.afterSha256, HASH);
    assert.notEqual(r.afterSha256, r.beforeSha256, file + ' declared modification changes bytes');
  }
  for (const [file, pin] of Object.entries(m.added)) {
    assert.match(pin, HASH);
    assert.ok(!Object.hasOwn(m.baselineFiles, file), file + ' declared addition is not a baseline file');
  }

  function d101PriorSource(file, text) {
    assert.ok(Object.hasOwn(m.baselineFiles, file) || Object.hasOwn(m.added, file), file + ' exact allowed source: unknown path');
    assert.equal(typeof text, 'string', file + ' exact allowed source: actual text required');
    if (Object.hasOwn(m.added, file)) {
      assert.equal(sha(text), m.added[file], file + ' exact allowed source: actual added bytes');
      return '';
    }
    assert.equal(sha(text), m.modified[file]?.afterSha256 ?? m.baselineFiles[file], file + ' exact allowed source: all actual current bytes');
    return m.modified[file]?.before ?? text;
  }
  function d101PriorInventory(files, read) {
    assert.ok(Array.isArray(files));
    assert.equal(typeof read, 'function');
    assert.equal(new Set(files).size, files.length, 'duplicate actual source');
    assert.deepEqual([...files].sort(), D101_CURRENT_PATHS, 'exact269 current source inventory');
    for (const file of files) d101PriorSource(file, read(file));
    return [...prior.D102_CURRENT_PATHS];
  }
  // Source path: added files stop here (''); every other file hands its D102
  // `before` bytes down. Inventory path: the reader handed down is the D101
  // projection itself. Reader exceptions propagate unchanged (unit-d083-scope).
  const down = fn => (file, text) => { const before = d101PriorSource(file, text); return D101_ADDED.includes(file) ? '' : fn(file, before); };
  const inventory = fn => (files, read) => fn(d101PriorInventory(files, read), file => d101PriorSource(file, read(file)));
  return Object.freeze({
    d101PriorSource,
    d101PriorInventory,
    d102PriorSource: down(prior.d102PriorSource),
    d102PriorInventory: inventory(prior.d102PriorInventory),
    d100PriorSource: down(prior.d100PriorSource),
    d100PriorInventory: inventory(prior.d100PriorInventory),
    d099PriorSource: down(prior.d099PriorSource),
    d099PriorInventory: inventory(prior.d099PriorInventory),
    d090PriorSource: down(prior.d090PriorSource),
    d090PriorInventory: inventory(prior.d090PriorInventory),
    // Explicit composition: D101 -> D102 (which itself checks the D102 pins, the
    // D100 layer and then the D090 D085 preimage).
    d085PriorSource: down(prior.d085PriorSource),
    d084PriorSource: down(prior.d084PriorSource),
    d084PriorInventory: inventory(prior.d084PriorInventory),
  });
}
