// D100 current-source successor for the D090 foundation suite: the released 265
// plus exactly the two D100 transit model sources, projected back through the
// D099 and D090 chains. Supersedes the D099 265-only copy as the current test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D090_BASELINE, D090_MODIFIED, D090_ADDED} from './d090-source.mjs';
import {D099_ADDED, D099_CURRENT_PATHS} from './d099-source.mjs';
import {D100_ADDED, D100_CURRENT_PATHS, D100_MANIFEST_SHA, createD100Lease} from './d100-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const git = file => execFileSync('git', ['show', D090_BASELINE + ':' + file], {cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6});
const files = fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();
const lease = createD100Lease(read('fixtures/d100/source.json'), D100_MANIFEST_SHA);

test('all267 actual sources equal the combined lease bytes; released preimages still match git', () => {
  assert.deepEqual(files, D100_CURRENT_PATHS);
  assert.equal(files.length, 267);
  assert.equal(lease.d100PriorInventory(files, read).length, 265);
  assert.equal(lease.d090PriorInventory(files, read).length, 258);
  assert.equal(lease.d084PriorInventory(files, read).length, 237);
  assert.equal(D099_CURRENT_PATHS.length, 265);
  for (const file of files) {
    const current = read(file);
    lease.d100PriorSource(file, current);
    if (D100_ADDED.includes(file) || D099_ADDED.includes(file)) continue;
    if (!D090_ADDED.includes(file) && !D090_MODIFIED.includes(file)) assert.equal(current, git(file), 'unchanged old source ' + file);
  }
  for (const file of D100_ADDED) assert.ok(!D099_CURRENT_PATHS.includes(file));
});

test('every missing, duplicate, unknown or stale current file rejects before historical projection', () => {
  for (const bad of [[...files, 'src/unknown.ts'], [...files, files[0]], ...files.map(file => files.filter(other => other !== file))]) {
    assert.throws(() => lease.d100PriorInventory(bad, read));
  }
  for (const file of files) assert.throws(() => lease.d100PriorInventory(files, target => read(target) + (target === file ? '\n' : '')));
  for (const file of D100_ADDED) assert.throws(() => lease.d100PriorSource(file, ''));
});
