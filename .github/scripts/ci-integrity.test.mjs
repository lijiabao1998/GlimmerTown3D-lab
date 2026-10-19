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
  for (const stage of ['build', 'node-frame', 'browser', 'screenshots']) {
    const missing = success(); delete missing[stage].outputs['artifact-id'];
    assert.throws(() => requireSuccess(missing), /artifact is required/);
  }
  const noDigest = success(); delete noDigest.build.outputs.digest;
  assert.throws(() => requireSuccess(noDigest), /build digest is required/);
});

test('required stage inventory is fixed and includes the independent D078 frame job', () => {
  assert.deepEqual(STAGES, ['build', 'node', 'node-frame', 'browser', 'screenshots']);
});

test('workflow keeps both Node partitions mandatory at the original 120-minute limit', () => {
  const workflow = fs.readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8');
  const job = name => {
    const start = workflow.indexOf(`\n  ${name}:\n`);
    assert.ok(start >= 0, `missing ${name} job`);
    const end = workflow.slice(start + 1).search(/\n  [a-z][a-z0-9-]*:\n/);
    return end < 0 ? workflow.slice(start) : workflow.slice(start, start + 1 + end);
  };
  const historical = job('node'), frame = job('node-frame'), smoke = job('smoke'), pages = job('pages');
  for (const stage of [historical, frame]) {
    assert.match(stage, /timeout-minutes: 120\n/);
    assert.match(stage, /uses: actions\/checkout@v4\n/);
    assert.match(stage, /node-version: 24\n/);
    assert.match(stage, /run: npm ci\n/);
    assert.match(stage, /fonts-wqy-zenhei\n/);
    assert.doesNotMatch(stage, /continue-on-error:|\n    (?:if|needs):/);
  }
  assert.match(historical, /run: npm run typecheck\n/);
  assert.match(historical, /run: npm run unit -- --partition=historical\n/);
  assert.match(frame, /set -o pipefail\n          node tools\/unit-partition\.mjs --partition=d078-frame 2>&1 \| tee scratch\/d078-node-frame\/console\.log\n        shell: bash/);
  assert.match(frame, /outputs:\n      artifact-id: \$\{\{ steps\.evidence\.outputs\.artifact-id \}\}/);
  assert.match(frame, /uses: actions\/upload-artifact@v4\n        id: evidence\n        if: always\(\)/);
  assert.match(frame, /name: node-frame-d078-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(frame, /path: scratch\/d078-node-frame\/\n          if-no-files-found: error/);
  const baselines = s => [...s.matchAll(/git fetch --no-tags --depth=1 origin ([a-f0-9]{40})/g)].map(m => m[1]);
  assert.equal(baselines(historical).length, 13);
  assert.deepEqual(baselines(frame), baselines(historical));
  const needs = s => /\n    needs: \[([^\]]+)\]/.exec(s)?.[1].split(', ');
  assert.deepEqual(needs(smoke), STAGES);
  assert.match(smoke, /\n    if: always\(\)\n/);
  assert.match(smoke, /run: node \.github\/scripts\/ci-integrity\.mjs gate\n/);
  assert.deepEqual(needs(pages), ['smoke', 'd055', 'd059', 'd060', 'd061', 'd062', 'd063', 'd064', 'd068', 'd069', 'd070', 'd071', 'd072', 'd073', 'd074', 'd076', 'd077', 'd078']);
  assert.match(pages, /\n    if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'\n/);
  assert.doesNotMatch(pages, /always\(\)|continue-on-error:/);
  assert.match(workflow, /run: node --test \.github\/scripts\/ci-integrity\.test\.mjs tools\/unit-partitions\.test\.mjs\n/);
});
