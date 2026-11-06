// D101 outer source lease guards: exact269 current inventory (267 + 2 added), the
// eight declared modifications hand their main-76e074f bytes down every projection,
// the two-level projection D101 -> D102 still reaches the D100 bytes (and three
// levels reach 5b41bac), and fail-closed controls. Every chain output on disk (the
// lease, the camera successor, the domain/routing/lineage manifests and their
// contracts) is pinned byte for byte to tools/d101-freeze-chain.mjs's pure candidate.
// May call git (transit.yml checks out with fetch-depth 0); the lease module itself
// never does.
import test from 'node:test';
import './d104-workflow-lineage.test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as d102 from './d102-source.mjs';
import {D102_BASELINE, D102_CURRENT_PATHS, D102_MODIFIED, D084_CHANGED as D102_D084_CHANGED, D084_ADDED as D102_D084_ADDED} from './d102-source.mjs';
import {D099_ADDED} from './d099-source.mjs';
import {D100_ADDED} from './d100-source.mjs';
import {D090_ADDED, D090_BASELINE, D085_CHANGED as D090_D085_CHANGED} from './d090-source.mjs';
import {D084_ADDED, D084_CHANGED, D085_CHANGED, D101_ADDED, D101_BASELINE, D101_CURRENT_PATHS, D101_MANIFEST_SHA, D101_MODIFIED, createD101Lease} from './d101-source.mjs';
import {D101_MODIFIED_AFTER, D101_SUCCESSOR_ADDED, D102_MODIFIED_AFTER, assertFrozenCurrentSource} from '../proposals/d090/foundation-routing-contract-pipes-v2.mjs';
import {D101_ENTRY, D101_FIXTURE} from './d101-freeze-source.mjs';
import {D101_CHAIN_FILES, D101ChainRefusal, d101AssertOnDisk, d101Candidate} from './d101-freeze-chain.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const shown = new Map();
const git = (rev, file) => {
  const key = rev + ':' + file;
  if (!shown.has(key)) shown.set(key, execFileSync('git', ['show', key], {cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6}));
  return shown.get(key);
};
const lsTree = rev => execFileSync('git', ['ls-tree', '-r', '--name-only', rev, 'src'], {cwd: ROOT, encoding: 'utf8'}).trim().split('\n').sort();
const manifestBytes = read('fixtures/d101/source.json');
const manifest = JSON.parse(manifestBytes);
const lease = createD101Lease(manifestBytes, D101_MANIFEST_SHA);
const files = fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();

test('current src is exactly the 269 and every projection keeps its historical size', () => {
  assert.deepEqual(files, D101_CURRENT_PATHS);
  assert.equal(files.length, 269);
  assert.deepEqual(D101_CURRENT_PATHS, [...D102_CURRENT_PATHS, ...D101_ADDED].sort());
  assert.deepEqual(lease.d101PriorInventory(files, read), [...D102_CURRENT_PATHS]);
  assert.equal(lease.d102PriorInventory(files, read).length, 267);
  assert.equal(lease.d100PriorInventory(files, read).length, 265);
  assert.equal(lease.d099PriorInventory(files, read).length, 263);
  assert.equal(lease.d090PriorInventory(files, read).length, 258);
  assert.equal(lease.d084PriorInventory(files, read).length, 237);
});

test('exactly the eight declared files changed (before = main 76e074f bytes) and exactly two were added', () => {
  assert.equal(manifest.baseline, D101_BASELINE);
  assert.deepEqual(lsTree(D101_BASELINE), [...D102_CURRENT_PATHS], 'the baseline src tree is the D102 current 267');
  assert.deepEqual(Object.keys(manifest.modified), D101_MODIFIED);
  assert.deepEqual(Object.keys(manifest.added), D101_ADDED);
  for (const file of files) {
    const current = read(file);
    if (D101_ADDED.includes(file)) {
      assert.ok(!lsTree(D101_BASELINE).includes(file), file + ' is new');
      assert.equal(manifest.added[file], sha(current));
      assert.equal(lease.d101PriorSource(file, current), '');
      continue;
    }
    assert.equal(manifest.baselineFiles[file], sha(git(D101_BASELINE, file)), file + ' baseline pin');
    if (D101_MODIFIED.includes(file)) {
      assert.notEqual(current, git(D101_BASELINE, file), file + ' really changed');
      assert.equal(manifest.modified[file].before, git(D101_BASELINE, file), file + ' before is the main bytes');
      assert.equal(lease.d101PriorSource(file, current), git(D101_BASELINE, file));
      assert.equal(manifest.modified[file].afterSha256, sha(current));
    } else {
      assert.equal(current, git(D101_BASELINE, file), 'undeclared source unchanged: ' + file);
      assert.equal(lease.d101PriorSource(file, current), current);
    }
  }
  for (const file of ['src/sim/day.ts', 'src/sim/decisions.ts', 'src/sim/transit/network.ts', 'src/sim/transit/format.ts', 'src/sim/transit/graph.ts', 'src/sim/transit/movement.ts']) {
    assert.ok(!D101_MODIFIED.includes(file) && !D101_ADDED.includes(file), file + ' is not declared');
  }
});

test('two-level projection: D101 -> D102 hands the D100 bytes down; three levels reach 5b41bac', () => {
  for (const file of files) {
    const current = read(file);
    const one = lease.d101PriorSource(file, current), two = lease.d102PriorSource(file, current), three = lease.d100PriorSource(file, current);
    if (D101_ADDED.includes(file)) { assert.equal(two, ''); assert.equal(three, ''); continue; }
    assert.equal(two, git(D102_BASELINE, file), file + ' two-level projection is the D102 baseline (D100) bytes');
    if (D102_MODIFIED.includes(file)) assert.notEqual(two, one, file + ' D102 hands its own before down beneath D101');
    else assert.equal(two, one, file);
    const expectedThree = [...D090_ADDED, ...D099_ADDED, ...D100_ADDED].includes(file) ? '' : git(D090_BASELINE, file);
    assert.equal(three, expectedThree, file + ' three-level projection is the 5b41bac bytes');
    assert.equal(lease.d090PriorSource(file, current), expectedThree, file + ' D090 projection');
  }
  // The inventory path hands the same bytes down: the D099/D100 `file => read(file)`
  // shortcut would give the D102 layer the actual D101 bytes and fail closed.
  assert.throws(() => d102.d102PriorInventory(lease.d101PriorInventory(files, read), file => read(file)), /exact allowed source/);
  assert.throws(() => d102.d084PriorInventory(lease.d101PriorInventory(files, read), file => read(file)), /exact allowed source/);
  assert.deepEqual(lease.d102PriorInventory(files, read), d102.d102PriorInventory([...D102_CURRENT_PATHS], file => git(D101_BASELINE, file)));
});

test('the D090 current contract carries the same hashes (one source of truth)', () => {
  assert.deepEqual(D101_MODIFIED_AFTER, Object.fromEntries(D101_MODIFIED.map(file => [file, manifest.modified[file].afterSha256])));
  assert.deepEqual(D101_SUCCESSOR_ADDED, manifest.added);
  const expected = {...manifest.baselineFiles, ...D101_MODIFIED_AFTER, ...D101_SUCCESSOR_ADDED};
  assert.equal(Object.keys(expected).length, 269);
  const current = assertFrozenCurrentSource();
  assert.deepEqual(Object.keys(current).sort(), Object.keys(expected).sort());
  for (const file of Object.keys(expected)) assert.equal(current[file], expected[file], file);
  for (const [file, hash] of Object.entries(D102_MODIFIED_AFTER)) {
    if (D101_MODIFIED.includes(file)) assert.equal(manifest.modified[file].beforeSha256, hash, file + ' D101 before is the D102 after');
    else assert.equal(manifest.baselineFiles[file], hash, file + ' D102 after unchanged by D101');
  }
});

test('D084_CHANGED/D084_ADDED widen by exactly the declared files; D085_CHANGED is the D090 one', () => {
  assert.deepEqual(D084_CHANGED, [...new Set([...D102_D084_CHANGED, ...D101_MODIFIED])]);
  assert.equal(D084_CHANGED.length, 43, 'merge.ts widens 42 -> 43 (the other seven were already among the D102 42)');
  assert.deepEqual(D084_ADDED, [...new Set([...D102_D084_ADDED, ...D101_ADDED])]);
  assert.equal(D084_ADDED.length, 32);
  for (const file of D101_ADDED) assert.ok(!D084_CHANGED.includes(file), file + ' joins ADDED only (D099/D100 precedent)');
  assert.deepEqual(D085_CHANGED, D090_D085_CHANGED);
  for (const file of D085_CHANGED) assert.equal(lease.d085PriorSource(file, read(file)), git('1e7b43e', file), file + ' D085 preimage through the D101 chain');
  for (const file of D101_ADDED) assert.equal(lease.d084PriorSource(file, read(file)), '');
});

test('missing, duplicate, unknown, stale and every changed byte fail closed', () => {
  for (const bad of [files.slice(1), [...files, 'src/unknown.ts'], [...files, files[0]], files.filter(file => file !== D101_MODIFIED[0]), files.filter(file => file !== D101_ADDED[0]), files.filter(file => file !== D101_ADDED[1]), [...D102_CURRENT_PATHS]]) {
    assert.throws(() => lease.d101PriorInventory(bad, read), /exact269 current source inventory|duplicate actual source/);
    assert.throws(() => lease.d084PriorInventory(bad, read), /exact269 current source inventory|duplicate actual source/);
  }
  for (const file of [...D101_MODIFIED, ...D101_ADDED, files[0], files[100], 'src/sim/day.ts', 'src/render/preview.ts']) {
    assert.throws(() => lease.d101PriorInventory(files, target => read(target) + (target === file ? '\n' : '')), /exact allowed source/, file);
    assert.throws(() => lease.d084PriorInventory(files, target => read(target) + (target === file ? '\n' : '')), /exact allowed source/, file);
  }
  for (const file of D101_MODIFIED) {
    assert.throws(() => lease.d101PriorSource(file, git(D101_BASELINE, file)), /exact allowed source/, 'stale D102 (main) bytes are not current: ' + file);
    assert.throws(() => lease.d102PriorSource(file, git(D101_BASELINE, file)), /exact allowed source/);
    assert.throws(() => lease.d090PriorSource(file, read(file) + ' '), /exact allowed source/);
    assert.throws(() => lease.d085PriorSource(file, read(file) + ' '), /exact allowed source/);
  }
  for (const file of D101_ADDED) for (const bad of ['', undefined, null, read(file) + ' ']) {
    assert.throws(() => lease.d101PriorSource(file, bad), /exact allowed source/);
    assert.throws(() => lease.d084PriorSource(file, bad), /exact allowed source/);
  }
  assert.throws(() => lease.d101PriorSource('src/unknown.ts', 'x'), /exact allowed source/);
  assert.throws(() => lease.d101PriorSource(D101_MODIFIED[0], undefined), /exact allowed source/);
  const missing = new Error('missing');
  for (const file of [D101_ADDED[1], D101_MODIFIED[0], files[0]]) {
    assert.throws(() => lease.d101PriorInventory(files, f => { if (f === file) throw missing; return read(f); }), e => e === missing, 'reader exception propagates: ' + file);
    assert.throws(() => lease.d084PriorInventory(files, f => { if (f === file) throw missing; return read(f); }), e => e === missing, 'reader exception propagates: ' + file);
  }
});

test('manifest bytes, baseline and the declared sets are finite and exact', () => {
  assert.throws(() => createD101Lease(manifestBytes, sha(manifestBytes + '\n')), /exact finite D101 manifest/);
  assert.throws(() => createD101Lease(manifestBytes + '\n', D101_MANIFEST_SHA), /exact finite D101 manifest/);
  const first = D101_MODIFIED[0], other = D102_CURRENT_PATHS.find(file => !D101_MODIFIED.includes(file));
  for (const mutate of [
    () => ({...manifest, baseline: '0'.repeat(40)}),
    () => ({...manifest, baseline: D102_BASELINE}),
    () => ({...manifest, qualification: ''}),
    () => ({...manifest, schema: 2}),
    () => { const {added, ...rest} = manifest; return rest; },
    () => ({...manifest, added: {...manifest.added, 'src/sim/unknown.ts': 'a'.repeat(64)}}),
    () => ({...manifest, added: Object.fromEntries(Object.entries(manifest.added).slice(1))}),
    () => ({...manifest, added: {...manifest.added, [D101_ADDED[0]]: 'x'}}),
    () => ({...manifest, modified: {...manifest.modified, [other]: {before: read(other), beforeSha256: sha(read(other)), afterSha256: 'a'.repeat(64)}}}),
    () => ({...manifest, modified: Object.fromEntries(Object.entries(manifest.modified).slice(1))}),
    () => ({...manifest, modified: {...manifest.modified, [first]: {...manifest.modified[first], before: manifest.modified[first].before + ' '}}}),
    () => ({...manifest, modified: {...manifest.modified, [first]: {...manifest.modified[first], afterSha256: manifest.modified[first].beforeSha256}}}),
    () => ({...manifest, baselineFiles: Object.fromEntries(Object.entries(manifest.baselineFiles).slice(0, 266))}),
    () => ({...manifest, baselineFiles: {...manifest.baselineFiles, [D101_ADDED[0]]: 'a'.repeat(64)}}),
  ]) {
    const bad = JSON.stringify(mutate(), null, 2) + '\n';
    assert.throws(() => createD101Lease(bad, sha(bad)));
  }
});

test('every chain output on disk is byte-for-byte the generator candidate (the camera successor is bound to its generator and to the byte-pinned original da17d794)', () => {
  const ORIGINAL = 'proposals/d090/original-camera-restoration.test.mjs', camera = D101_CHAIN_FILES.camera;
  assert.equal(sha(read(ORIGINAL)), 'da17d79440239b55a0e9d8b65abecc1b10d166980533c7380ab781bb796c4445', 'the superseded original stays byte-exact');
  assert.equal(read(ORIGINAL), git(D101_BASELINE, ORIGINAL));
  const {files} = d101Candidate();
  assert.deepEqual(Object.keys(files).sort(), [D101_FIXTURE, D101_ENTRY, ...Object.values(D101_CHAIN_FILES)].sort(), 'the lease and all eight chain outputs');
  for (const [file, bytes] of Object.entries(files)) assert.ok(read(file) === bytes, file + ' is exactly the chain candidate');
  assert.equal(files[D101_FIXTURE], manifestBytes);
  assert.equal(sha(files[D101_FIXTURE]), D101_MANIFEST_SHA);
  assert.ok(files[camera].includes('\nconst d101Deltas=[\n'), 'the successor carries the generated D101 delta literal');
  d101AssertOnDisk(files, read);
  // Negative: one extra byte anywhere in the successor (or any other chain file) is caught.
  for (const target of [camera, D101_CHAIN_FILES.contract, D101_FIXTURE]) {
    assert.throws(() => d101AssertOnDisk(files, file => read(file) + (file === target ? ' ' : '')), e => e instanceof D101ChainRefusal && e.message.startsWith(target + ' is not exactly the chain candidate'), target);
  }
  assert.throws(() => d101AssertOnDisk(files, file => file === camera ? read(file).replace('const d101Deltas=[', 'const d101Deltas=[ ') : read(file)), D101ChainRefusal);
});
