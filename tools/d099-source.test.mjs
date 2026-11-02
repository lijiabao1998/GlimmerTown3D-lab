// D099 outer source lease guards: exact265 current inventory, released 263
// projection, and fail-closed controls. Runs against the real tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {D090_CURRENT_PATHS} from './d090-source.mjs';
import {D099_ADDED, D099_BASELINE, D099_CURRENT_PATHS, D099_MANIFEST_SHA, createD099Lease} from './d099-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const manifestBytes = read('fixtures/d099/source.json');
const lease = createD099Lease(manifestBytes, D099_MANIFEST_SHA);
const files = fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();

test('current src is exactly the declared 265 and projects the released 263', () => {
  assert.deepEqual(files, D099_CURRENT_PATHS);
  assert.equal(D099_CURRENT_PATHS.length, 265);
  assert.equal(D090_CURRENT_PATHS.length, 263);
  assert.deepEqual(lease.d099PriorInventory(files, read), [...D090_CURRENT_PATHS]);
  assert.equal(lease.d090PriorInventory(files, read).length, 258);
  assert.equal(lease.d084PriorInventory(files, read).length, 237);
});

test('both declared additions are absent from the released set and byte-pinned', () => {
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.baseline, D099_BASELINE);
  assert.deepEqual(Object.keys(manifest.baselineFiles), D090_CURRENT_PATHS);
  assert.deepEqual(Object.keys(manifest.added), D099_ADDED);
  for (const file of D099_ADDED) {
    assert.ok(!Object.hasOwn(manifest.baselineFiles, file));
    assert.equal(manifest.added[file], sha(read(file)));
  }
});

test('missing, duplicate, unknown and every changed byte fail closed', () => {
  for (const bad of [files.slice(1), [...files, 'src/unknown.ts'], [...files, files[0]], [...D090_CURRENT_PATHS]]) {
    assert.throws(() => lease.d099PriorInventory(bad, read), /exact265 current source inventory|duplicate actual source/);
  }
  for (const file of [...D099_ADDED, D090_CURRENT_PATHS[0], D090_CURRENT_PATHS[100]]) {
    assert.throws(() => lease.d099PriorInventory(files, target => read(target) + (target === file ? '\n' : '')), /exact allowed source/);
  }
  assert.throws(() => lease.d099PriorSource(D099_ADDED[0], ''), /exact allowed source/);
  assert.throws(() => lease.d099PriorSource('src/unknown.ts', 'x'), /exact allowed source/);
});

test('manifest bytes, baseline and declared sets are finite and exact', () => {
  assert.throws(() => createD099Lease(manifestBytes, sha(manifestBytes + '\n')), /exact finite D099 manifest/);
  const manifest = JSON.parse(manifestBytes);
  for (const mutate of [
    () => ({...manifest, baseline: '0'.repeat(40)}),
    () => ({...manifest, qualification: ''}),
    () => ({...manifest, schema: 2}),
    () => ({...manifest, added: {...manifest.added, 'src/sim/unknown.ts': 'a'.repeat(64)}}),
    () => ({...manifest, baselineFiles: Object.fromEntries(Object.entries(manifest.baselineFiles).slice(0, 262))}),
  ]) {
    const bad = JSON.stringify(mutate(), null, 2) + '\n';
    assert.throws(() => createD099Lease(bad, sha(bad)));
  }
});
