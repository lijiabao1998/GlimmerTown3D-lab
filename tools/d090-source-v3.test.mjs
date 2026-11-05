// D102 current-source successor for the D090 foundation suite: the D100 267 with
// exactly the seven D102 steel-history files modified, projected back through the
// D100, D099 and D090 chains (D102 hands the D100 bytes down). Supersedes the D100
// copy as the current test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D090_BASELINE, D090_MODIFIED, D090_ADDED} from './d090-source.mjs';
import {D099_ADDED, D099_CURRENT_PATHS} from './d099-source.mjs';
import {D100_ADDED} from './d100-source.mjs';
import {D102_CURRENT_PATHS, D102_MANIFEST_SHA, D102_MODIFIED, createD102Lease} from './d102-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const git = file => execFileSync('git', ['show', D090_BASELINE + ':' + file], {cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6});
const files = fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();
const lease = createD102Lease(read('fixtures/d102/source.json'), D102_MANIFEST_SHA);

test('all267 actual sources equal the combined lease bytes; released preimages still match git', () => {
  assert.deepEqual(files, D102_CURRENT_PATHS);
  assert.equal(files.length, 267);
  assert.equal(lease.d102PriorInventory(files, read).length, 267);
  assert.equal(lease.d100PriorInventory(files, read).length, 265);
  assert.equal(lease.d090PriorInventory(files, read).length, 258);
  assert.equal(lease.d084PriorInventory(files, read).length, 237);
  assert.equal(D099_CURRENT_PATHS.length, 265);
  for (const file of files) {
    const current = read(file), prior = lease.d102PriorSource(file, current);
    lease.d100PriorSource(file, current);
    if (D100_ADDED.includes(file) || D099_ADDED.includes(file)) continue;
    if (D102_MODIFIED.includes(file)) assert.notEqual(prior, current, 'D102 modified source hands its D100 bytes down ' + file);
    if (!D090_ADDED.includes(file) && !D090_MODIFIED.includes(file)) assert.equal(prior, git(file), 'unchanged old source (D102 before bytes) ' + file);
  }
  for (const file of D100_ADDED) assert.ok(!D099_CURRENT_PATHS.includes(file));
  for (const file of D102_MODIFIED) assert.ok(D099_CURRENT_PATHS.includes(file), 'D102 adds no path: ' + file);
});

test('every missing, duplicate, unknown or stale current file rejects before historical projection', () => {
  for (const bad of [[...files, 'src/unknown.ts'], [...files, files[0]], ...files.map(file => files.filter(other => other !== file))]) {
    assert.throws(() => lease.d102PriorInventory(bad, read));
  }
  for (const file of files) assert.throws(() => lease.d102PriorInventory(files, target => read(target) + (target === file ? '\n' : '')));
  for (const file of [...D100_ADDED, ...D102_MODIFIED]) assert.throws(() => lease.d102PriorSource(file, ''));
});
