// D100 outer source lease guards: exact267 current inventory, released 265
// projection through d099 and d090, and fail-closed controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {D099_CURRENT_PATHS} from './d099-source.mjs';
import {D100_ADDED, D100_BASELINE, D100_CURRENT_PATHS, D100_MANIFEST_SHA, createD100Lease} from './d100-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const manifestBytes = read('fixtures/d100/source.json');
const lease = createD100Lease(manifestBytes, D100_MANIFEST_SHA);
const files = fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();

test('current src is exactly the declared 267 and projects the released 265', () => {
  assert.deepEqual(files, D100_CURRENT_PATHS);
  assert.equal(D100_CURRENT_PATHS.length, 267);
  assert.equal(D099_CURRENT_PATHS.length, 265);
  assert.deepEqual(lease.d100PriorInventory(files, read), [...D099_CURRENT_PATHS]);
  assert.equal(lease.d099PriorInventory(files, read).length, 263);
  assert.equal(lease.d090PriorInventory(files, read).length, 258);
  assert.equal(lease.d084PriorInventory(files, read).length, 237);
});

test('both declared additions are absent from the released set and byte-pinned', () => {
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.baseline, D100_BASELINE);
  assert.deepEqual(Object.keys(manifest.baselineFiles), D099_CURRENT_PATHS);
  assert.deepEqual(Object.keys(manifest.added), D100_ADDED);
  for (const file of D100_ADDED) {
    assert.ok(!Object.hasOwn(manifest.baselineFiles, file));
    assert.equal(manifest.added[file], sha(read(file)));
  }
});

test('missing, duplicate, unknown and every changed byte fail closed', () => {
  for (const bad of [files.slice(1), [...files, 'src/unknown.ts'], [...files, files[0]], [...D099_CURRENT_PATHS]]) {
    assert.throws(() => lease.d100PriorInventory(bad, read), /exact267 current source inventory|duplicate actual source/);
  }
  for (const file of [...D100_ADDED, D099_CURRENT_PATHS[0], D099_CURRENT_PATHS[100]]) {
    assert.throws(() => lease.d100PriorInventory(files, target => read(target) + (target === file ? '\n' : '')), /exact allowed source/);
  }
  assert.throws(() => lease.d100PriorSource(D100_ADDED[0], ''), /exact allowed source/);
  assert.throws(() => lease.d100PriorSource('src/unknown.ts', 'x'), /exact allowed source/);
});

test('manifest bytes, baseline and declared sets are finite and exact', () => {
  assert.throws(() => createD100Lease(manifestBytes, sha(manifestBytes + '\n')), /exact finite D100 manifest/);
  const manifest = JSON.parse(manifestBytes);
  for (const mutate of [
    () => ({...manifest, baseline: '0'.repeat(40)}),
    () => ({...manifest, qualification: ''}),
    () => ({...manifest, schema: 2}),
    () => ({...manifest, added: {...manifest.added, 'src/sim/unknown.ts': 'a'.repeat(64)}}),
    () => ({...manifest, baselineFiles: Object.fromEntries(Object.entries(manifest.baselineFiles).slice(0, 264))}),
  ]) {
    const bad = JSON.stringify(mutate(), null, 2) + '\n';
    assert.throws(() => createD100Lease(bad, sha(bad)));
  }
});
