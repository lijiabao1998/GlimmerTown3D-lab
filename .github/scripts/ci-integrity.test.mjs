import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STAGES, digest, record, verify, requireSuccess } from './ci-integrity.mjs';

const identity = { repository: 'owner/repo', sha: 'a'.repeat(40), tree: 'b'.repeat(40), runId: '12345', event: 'pull_request', attempt: 1 };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-integrity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'dist/index.html'), '<html>identical build</html>');
  const raw = record(root, identity);
  return { root, raw, hash: digest(raw) };
}

test('accepts the same build, source, run, event and complete file set', t => {
  const f = fixture(t);
  assert.equal(verify(f.root, f.raw, f.hash, identity).sha, identity.sha);
});
test('failed-job rerun can reuse the same successful build attempt', t => {
  const f = fixture(t);
  assert.equal(verify(f.root, f.raw, f.hash, { ...identity, attempt: 2 }).attempt, 1);
});
for (const field of ['repository', 'sha', 'tree', 'runId', 'event']) {
  test(`rejects a different ${field}`, t => {
    const f = fixture(t);
    assert.throws(() => verify(f.root, f.raw, f.hash, { ...identity, [field]: 'different' }), new RegExp(`wrong build ${field}`));
  });
}
test('rejects missing or changed digest', t => {
  const f = fixture(t);
  for (const hash of [undefined, '', '0'.repeat(64)]) assert.throws(() => verify(f.root, f.raw, hash, identity));
});
test('rejects a replaced manifest even if file hashes were changed too', t => {
  const f = fixture(t), changed = JSON.parse(f.raw);
  changed.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => verify(f.root, JSON.stringify(changed), f.hash, identity), /manifest differs/);
});
for (const mutation of ['changed', 'missing', 'extra']) {
  test(`rejects ${mutation} build files`, t => {
    const f = fixture(t);
    if (mutation === 'changed') fs.writeFileSync(path.join(f.root, 'dist/index.html'), 'tampered');
    if (mutation === 'missing') fs.unlinkSync(path.join(f.root, 'dist/index.html'));
    if (mutation === 'extra') fs.writeFileSync(path.join(f.root, 'dist/extra.js'), 'extra');
    assert.throws(() => verify(f.root, f.raw, f.hash, identity), /missing, extra, or changed/);
  });
}
test('rejects absent build, empty index, and symlinks', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'dist/index.html'), '');
  assert.throws(() => record(f.root, identity), /nonempty/);
  fs.symlinkSync('../ci-build.json', path.join(f.root, 'dist/link'));
  assert.throws(() => record(f.root, identity), /symlinks/);
  fs.rmSync(path.join(f.root, 'dist'), { recursive: true });
  assert.throws(() => record(f.root, identity));
});
for (const attempt of [0, -1, 2, '1', null]) {
  test(`rejects invalid or future source attempt ${attempt}`, t => {
    const f = fixture(t), manifest = { ...JSON.parse(f.raw), attempt }, raw = JSON.stringify(manifest);
    assert.throws(() => verify(f.root, raw, digest(raw), identity), /wrong build attempt/);
  });
}
const success = () => Object.fromEntries(STAGES.map(stage => [stage, { result: 'success', outputs: { 'artifact-id': '123', digest: 'a'.repeat(64) } }]));
test('gate accepts only all-success stages with evidence', () => requireSuccess(success()));
for (const stage of STAGES) {
  for (const result of ['failure', 'skipped', 'cancelled', 'pending', '', undefined]) {
    test(`gate rejects ${stage} result ${result}`, () => {
      const needs = success(); needs[stage].result = result;
      assert.throws(() => requireSuccess(needs), new RegExp(`${stage} did not succeed`));
    });
  }
  test(`gate rejects absent ${stage}`, () => {
    const needs = success(); delete needs[stage];
    assert.throws(() => requireSuccess(needs), /every split stage/);
  });
}
test('gate rejects unexpected dependency and missing artifact identity', () => {
  const needs = success(); needs.unexpected = { result: 'success' };
  assert.throws(() => requireSuccess(needs), /every split stage/);
  for (const stage of ['build', 'browser', 'screenshots']) {
    const missing = success(); delete missing[stage].outputs['artifact-id'];
    assert.throws(() => requireSuccess(missing), /artifact is required/);
  }
  const noDigest = success(); delete noDigest.build.outputs.digest;
  assert.throws(() => requireSuccess(noDigest), /build digest is required/);
});
