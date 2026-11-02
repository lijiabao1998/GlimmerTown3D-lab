// D099 current-source successor: the released D090 263 plus exactly the two D097
// transit prototypes, projected back to the historical chains. This supersedes the
// 263-only tools/d090-source.test.mjs as the *current* accounting test; the original
// stays byte-intact and remains covered by the routing manifest's historical pins.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D090_BASELINE, D090_MODIFIED, D090_ADDED, D090_CURRENT_PATHS} from './d090-source.mjs';
import {D099_ADDED, D099_CURRENT_PATHS, D099_MANIFEST_SHA, createD099Lease} from './d099-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const git = file => execFileSync('git', ['show', D090_BASELINE + ':' + file], {cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6});
const files = fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();
const lease = createD099Lease(read('fixtures/d099/source.json'), D099_MANIFEST_SHA);

test('all265 actual sources equal the combined lease bytes; released preimages still match git', () => {
  assert.deepEqual(files, D099_CURRENT_PATHS);
  assert.equal(files.length, 265);
  assert.equal(lease.d099PriorInventory(files, read).length, 263);
  assert.equal(lease.d090PriorInventory(files, read).length, 258);
  assert.equal(lease.d084PriorInventory(files, read).length, 237);
  for (const file of files) {
    const current = read(file);
    lease.d099PriorSource(file, current);
    if (D099_ADDED.includes(file)) continue;
    if (!D090_ADDED.includes(file) && !D090_MODIFIED.includes(file)) assert.equal(current, git(file), 'unchanged old source ' + file);
  }
  for (const file of D099_ADDED) assert.ok(!Object.hasOwn(D090_CURRENT_PATHS, file));
});

test('every missing, duplicate, unknown or stale current file rejects before historical projection', () => {
  for (const bad of [[...files, 'src/unknown.ts'], [...files, files[0]], ...files.map(file => files.filter(other => other !== file))]) {
    assert.throws(() => lease.d099PriorInventory(bad, read));
  }
  for (const file of files) assert.throws(() => lease.d099PriorInventory(files, target => read(target) + (target === file ? '\n' : '')));
  for (const file of D099_ADDED) assert.throws(() => lease.d099PriorSource(file, ''));
});
