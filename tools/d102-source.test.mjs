// D102 outer source lease guards: exact267 current inventory, the seven declared
// modifications hand their D100 bytes down every projection, and fail-closed controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D100_CURRENT_PATHS, D084_CHANGED as D100_D084_CHANGED} from './d100-source.mjs';
import {D085_CHANGED as D090_D085_CHANGED} from './d090-source.mjs';
import {D084_CHANGED, D085_CHANGED, D102_BASELINE, D102_CURRENT_PATHS, D102_MANIFEST_SHA, D102_MODIFIED, createD102Lease} from './d102-source.mjs';
import {D102_MODIFIED_AFTER} from '../proposals/d090/foundation-routing-contract-pipes-v2.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const git = (rev, file) => execFileSync('git', ['show', rev + ':' + file], {cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6});
const manifestBytes = read('fixtures/d102/source.json');
const manifest = JSON.parse(manifestBytes);
const lease = createD102Lease(manifestBytes, D102_MANIFEST_SHA);
const files = fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();

test('current src is exactly the 267 and every projection keeps its historical size', () => {
  assert.deepEqual(files, D102_CURRENT_PATHS);
  assert.deepEqual(D102_CURRENT_PATHS, D100_CURRENT_PATHS);
  assert.equal(files.length, 267);
  assert.deepEqual(lease.d102PriorInventory(files, read), [...D100_CURRENT_PATHS]);
  assert.equal(lease.d100PriorInventory(files, read).length, 265);
  assert.equal(lease.d099PriorInventory(files, read).length, 263);
  assert.equal(lease.d090PriorInventory(files, read).length, 258);
  assert.equal(lease.d084PriorInventory(files, read).length, 237);
});

test('exactly the seven declared files changed; their before bytes are the D100 baseline', () => {
  assert.equal(manifest.baseline, D102_BASELINE);
  assert.deepEqual(Object.keys(manifest.modified), D102_MODIFIED);
  for (const file of files) {
    const current = read(file);
    if (D102_MODIFIED.includes(file)) {
      assert.notEqual(current, git(D102_BASELINE, file), file + ' really changed');
      assert.equal(manifest.modified[file].before, git(D102_BASELINE, file), file + ' before is the D100 bytes');
      assert.equal(lease.d102PriorSource(file, current), git(D102_BASELINE, file));
      assert.equal(manifest.modified[file].afterSha256, sha(current));
    } else {
      assert.equal(current, git(D102_BASELINE, file), 'undeclared source unchanged: ' + file);
      assert.equal(lease.d102PriorSource(file, current), current);
    }
  }
  assert.ok(!D102_MODIFIED.includes('src/sim/rules/economy.ts'), 'economy.ts (Lab parity) is not modified');
});

test('the D090 current contract carries the same seven after hashes (one source of truth)', () => {
  assert.deepEqual(D102_MODIFIED_AFTER, Object.fromEntries(D102_MODIFIED.map(file => [file, manifest.modified[file].afterSha256])));
});

test('D084_CHANGED widens by exactly the seven files; D085_CHANGED is the D090 one', () => {
  assert.deepEqual(D084_CHANGED, [...new Set([...D100_D084_CHANGED, ...D102_MODIFIED])]);
  for (const file of D102_MODIFIED) assert.ok(D084_CHANGED.includes(file), file);
  assert.deepEqual(D085_CHANGED, D090_D085_CHANGED);
  for (const file of D085_CHANGED) assert.equal(lease.d085PriorSource(file, read(file)), git('1e7b43e', file), file + ' D085 preimage through the D102 chain');
});

test('missing, duplicate, unknown, stale and every changed byte fail closed', () => {
  for (const bad of [files.slice(1), [...files, 'src/unknown.ts'], [...files, files[0]], files.filter(file => file !== D102_MODIFIED[2])]) {
    assert.throws(() => lease.d102PriorInventory(bad, read), /exact267 current source inventory|duplicate actual source/);
  }
  for (const file of [...D102_MODIFIED, files[0], files[100], 'src/sim/rules/economy.ts']) {
    assert.throws(() => lease.d102PriorInventory(files, target => read(target) + (target === file ? '\n' : '')), /exact allowed source/, file);
  }
  for (const file of D102_MODIFIED) {
    assert.throws(() => lease.d102PriorSource(file, git(D102_BASELINE, file)), /exact allowed source/, 'stale D100 bytes are not current: ' + file);
    assert.throws(() => lease.d090PriorSource(file, read(file) + ' '), /exact allowed source/);
  }
  assert.throws(() => lease.d102PriorSource('src/unknown.ts', 'x'), /exact allowed source/);
  assert.throws(() => lease.d102PriorSource(D102_MODIFIED[0], undefined), /exact allowed source/);
});

test('manifest bytes, baseline and the declared set are finite and exact', () => {
  assert.throws(() => createD102Lease(manifestBytes, sha(manifestBytes + '\n')), /exact finite D102 manifest/);
  const first = D102_MODIFIED[0], other = D100_CURRENT_PATHS.find(file => !D102_MODIFIED.includes(file));
  for (const mutate of [
    () => ({...manifest, baseline: '0'.repeat(40)}),
    () => ({...manifest, qualification: ''}),
    () => ({...manifest, schema: 2}),
    () => ({...manifest, added: {}}),
    () => ({...manifest, modified: {...manifest.modified, [other]: {before: read(other), beforeSha256: sha(read(other)), afterSha256: 'a'.repeat(64)}}}),
    () => ({...manifest, modified: Object.fromEntries(Object.entries(manifest.modified).slice(1))}),
    () => ({...manifest, modified: {...manifest.modified, [first]: {...manifest.modified[first], before: manifest.modified[first].before + ' '}}}),
    () => ({...manifest, modified: {...manifest.modified, [first]: {...manifest.modified[first], afterSha256: manifest.modified[first].beforeSha256}}}),
    () => ({...manifest, baselineFiles: Object.fromEntries(Object.entries(manifest.baselineFiles).slice(0, 266))}),
  ]) {
    const bad = JSON.stringify(mutate(), null, 2) + '\n';
    assert.throws(() => createD102Lease(bad, sha(bad)));
  }
});
