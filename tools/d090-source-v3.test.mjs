// D101 current-source successor for the D090 foundation suite: the D102 267 with
// exactly the seven D101 transit save/UI files modified plus exactly two added
// transit sources (269), projected back through the D102, D100, D099 and D090
// chains (D101 hands the main bytes down, D102 then hands the D100 bytes down).
// Supersedes the D102 copy as the current test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D090_BASELINE, D090_MODIFIED, D090_ADDED} from './d090-source.mjs';
import {D099_ADDED, D099_CURRENT_PATHS} from './d099-source.mjs';
import {D100_ADDED} from './d100-source.mjs';
import {D102_CURRENT_PATHS, D102_MODIFIED} from './d102-source.mjs';
import {D101_ADDED, D101_CURRENT_PATHS, D101_MANIFEST_SHA, D101_MODIFIED, createD101Lease} from './d101-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const git = file => execFileSync('git', ['show', D090_BASELINE + ':' + file], {cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6});
const files = fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();
const lease = createD101Lease(read('fixtures/d101/source.json'), D101_MANIFEST_SHA);

test('all269 actual sources equal the combined lease bytes; released preimages still match git', () => {
  assert.deepEqual(files, D101_CURRENT_PATHS);
  assert.equal(files.length, 269);
  // The D102 inventory equality, restricted to the paths D101 did not add.
  assert.deepEqual(files.filter(file => !D101_ADDED.includes(file)), D102_CURRENT_PATHS);
  assert.equal(lease.d101PriorInventory(files, read).length, 267);
  assert.equal(lease.d102PriorInventory(files, read).length, 267);
  assert.equal(lease.d100PriorInventory(files, read).length, 265);
  assert.equal(lease.d099PriorInventory(files, read).length, 263);
  assert.equal(lease.d090PriorInventory(files, read).length, 258);
  assert.equal(lease.d084PriorInventory(files, read).length, 237);
  assert.equal(D099_CURRENT_PATHS.length, 265);
  for (const file of files) {
    // Two-level projection: D101 -> D102 reaches the D100 bytes; only those may be
    // compared with the 5b41bac sources (save/journal/city/eventRegistry/replay are
    // D102 modifications that are not D090 modifications). Like the D102 copy, the
    // D102 projection runs on every current file before any skip.
    const current = read(file), prior = lease.d101PriorSource(file, current), twoLevel = lease.d102PriorSource(file, current);
    lease.d100PriorSource(file, current);
    if (D101_ADDED.includes(file)) { assert.equal(prior, '', 'D101 added source projects to nothing ' + file); assert.equal(twoLevel, '', 'D101 added source projects to nothing beneath D102 ' + file); continue; }
    if (D100_ADDED.includes(file) || D099_ADDED.includes(file)) continue;
    if (D101_MODIFIED.includes(file)) assert.notEqual(prior, current, 'D101 modified source hands its main bytes down ' + file);
    if (D102_MODIFIED.includes(file)) assert.notEqual(twoLevel, prior, 'D102 modified source hands its D100 bytes down beneath D101 ' + file);
    if (!D090_ADDED.includes(file) && !D090_MODIFIED.includes(file)) assert.equal(twoLevel, git(file), 'unchanged old source (D101 -> D102 before bytes) ' + file);
  }
  for (const file of D100_ADDED) assert.ok(!D099_CURRENT_PATHS.includes(file));
  for (const file of D102_MODIFIED) assert.ok(D099_CURRENT_PATHS.includes(file), 'D102 adds no path: ' + file);
  for (const file of D101_ADDED) assert.ok(!D102_CURRENT_PATHS.includes(file), 'D101 adds exactly this path: ' + file);
  for (const file of D101_MODIFIED) assert.ok(D102_CURRENT_PATHS.includes(file), 'D101 modified path already existed: ' + file);
});

test('every missing, duplicate, unknown or stale current file rejects before historical projection', () => {
  for (const bad of [[...files, 'src/unknown.ts'], [...files, files[0]], ...files.map(file => files.filter(other => other !== file))]) {
    assert.throws(() => lease.d101PriorInventory(bad, read));
    assert.throws(() => lease.d102PriorInventory(bad, read));
  }
  for (const file of files) assert.throws(() => lease.d101PriorInventory(files, target => read(target) + (target === file ? '\n' : '')));
  for (const file of files) assert.throws(() => lease.d102PriorInventory(files, target => read(target) + (target === file ? '\n' : '')));
  for (const file of [...D100_ADDED, ...D102_MODIFIED]) assert.throws(() => lease.d102PriorSource(file, ''));
  for (const file of new Set([...D100_ADDED, ...D102_MODIFIED, ...D101_ADDED, ...D101_MODIFIED])) assert.throws(() => lease.d101PriorSource(file, ''));
});
