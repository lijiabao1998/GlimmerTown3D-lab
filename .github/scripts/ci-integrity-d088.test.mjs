// D086 current-version contract. Original .github/scripts/ci-integrity-release-v2.test.mjs remains unchanged and tested on77b8616.
// Explicit release-v2 current capture contract; original runs in immutable archived tree.
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
  for (const stage of ['build', 'node-frame', 'node-frame-d079', 'node-frame-d080', 'node-frame-d081', 'node-frame-d082', 'browser', 'screenshots']) {
    const missing = success(); delete missing[stage].outputs['artifact-id'];
    assert.throws(() => requireSuccess(missing), /artifact is required/);
  }
  const noDigest = success(); delete noDigest.build.outputs.digest;
  assert.throws(() => requireSuccess(noDigest), /build digest is required/);
});

test('required stage inventory is fixed and includes the independent D078, D079, D080 and D081 frame jobs', () => {
  assert.deepEqual(STAGES, ['build', 'node', 'node-frame', 'node-frame-d079', 'node-frame-d080', 'node-frame-d081', 'node-frame-d082', 'browser', 'screenshots']);
});

test('workflow keeps all six Node partitions mandatory at the original 120-minute limit', () => {
  const workflow = fs.readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8');
  const job = name => {
    const start = workflow.indexOf(`\n  ${name}:\n`);
    assert.ok(start >= 0, `missing ${name} job`);
    const end = workflow.slice(start + 1).search(/\n  [a-z][a-z0-9-]*:\n/);
    return end < 0 ? workflow.slice(start) : workflow.slice(start, start + 1 + end);
  };
  const historical = job('node'), frame = job('node-frame'), frame79 = job('node-frame-d079'), frame80 = job('node-frame-d080'), frame81 = job('node-frame-d081'), frame82 = job('node-frame-d082'), smoke = job('smoke'), pages = job('pages');
  for (const stage of [historical, frame, frame79, frame80, frame81, frame82]) {
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
  assert.equal(baselines(historical).length, 17);
  assert.deepEqual(baselines(frame), baselines(historical).slice(0, -4));
  assert.deepEqual(baselines(frame79), baselines(historical).slice(0, -3));
  assert.deepEqual(baselines(frame80), baselines(historical).slice(0, -2));
  assert.equal(baselines(historical).at(-4), '46771cdc00f33759e0a3c45ddf05c3387d4bb4fc');
  assert.equal(baselines(historical).at(-3), '23eac8f12c6cb32c5f59fc052d5b24fe20f32a9e');
  assert.deepEqual(baselines(frame81), baselines(historical));
  assert.equal(baselines(historical).at(-2), '7ec70a96b01437ab4576b0962905be16b1591e79');
  assert.ok(frame79.includes('node tools/unit-partition.mjs --partition=d079-frame 2>&1 | tee scratch/d079-node-frame/console.log'));
  assert.ok(frame79.includes('name: node-frame-d079-'));
  assert.ok(frame79.includes('path: scratch/d079-node-frame/'));
  assert.match(frame79, /if-no-files-found: error/);
  assert.match(frame79, /if: always\(\)/);
  assert.match(frame80, /set -o pipefail\n          node tools\/unit-partition\.mjs --partition=d080-frame 2>&1 \| tee scratch\/d080-node-frame\/console\.log\n        shell: bash/);
  assert.match(frame80, /outputs:\n      artifact-id: \$\{\{ steps\.evidence\.outputs\.artifact-id \}\}/);
  assert.match(frame80, /uses: actions\/upload-artifact@v4\n        id: evidence\n        if: always\(\)/);
  assert.match(frame80, /name: node-frame-d080-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(frame80, /path: scratch\/d080-node-frame\/\n          if-no-files-found: error/);
  assert.match(frame81, /set -o pipefail\n          node tools\/unit-partition\.mjs --partition=d081-frame 2>&1 \| tee scratch\/d081-node-frame\/console\.log\n        shell: bash/);
  assert.match(frame81, /outputs:\n      artifact-id: \$\{\{ steps\.evidence\.outputs\.artifact-id \}\}/);
  assert.match(frame81, /uses: actions\/upload-artifact@v4\n        id: evidence\n        if: always\(\)/);
  assert.match(frame81, /name: node-frame-d081-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(frame81, /path: scratch\/d081-node-frame\/\n          if-no-files-found: error/);
  assert.deepEqual(baselines(frame82), baselines(historical));
  assert.equal(baselines(historical).at(-1), '2cd43c424dcc909dcfa6ac55275406d2bc527ce0');
  assert.ok(frame82.includes('node tools/unit-partition.mjs --partition=d082-frame 2>&1 | tee scratch/d082-node-frame/console.log'));
  assert.ok(frame82.includes('name: node-frame-d082-'));
  assert.ok(frame82.includes('path: scratch/d082-node-frame/'));
  assert.match(frame82, /if-no-files-found: error/);
  assert.match(frame82, /if: always\(\)/);
  const capture = job('d079');
  assert.match(capture, /timeout-minutes: 45/);
  assert.match(capture, /fail-fast: false/);
  assert.ok(capture.includes('width: [1440, 360, 412]'));
  assert.ok(capture.includes('run: node tools/d079-capture.mjs'));
  assert.ok(capture.includes('D079_WIDTHS:'));
  assert.ok(capture.includes('path: scratch/d079/'));
  assert.match(capture, /if-no-files-found: error/);
  assert.doesNotMatch(capture, /continue-on-error:|\n    (?:if|needs):/);
  const needs = s => /\n    needs: \[([^\]]+)\]/.exec(s)?.[1].split(', ');
  assert.deepEqual(needs(smoke), STAGES);
  assert.match(smoke, /\n    if: always\(\)\n/);
  assert.match(smoke, /run: node \.github\/scripts\/ci-integrity\.mjs gate\n/);
  assert.deepEqual(needs(pages), ['smoke', 'd055', 'd059', 'd060', 'd061', 'd062', 'd063', 'd064', 'd068', 'd069', 'd070', 'd071', 'd072', 'd073', 'd074', 'd076', 'd077', 'd078', 'd079', 'd080', 'd081', 'd082', 'd086-native-release', 'd087-native-release', 'd088-native-release', 'd083-native-release']);
  assert.match(pages, /\n    if: github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'\n/);
  assert.doesNotMatch(pages, /always\(\)|continue-on-error:/);
  assert.match(workflow, /run: node --test \.github\/scripts\/ci-integrity-d088\.test\.mjs tools\/unit-partitions-release-v2\.test\.mjs\n/);
});

for (const stage of ['build', 'node-frame', 'node-frame-d079', 'node-frame-d080', 'node-frame-d081', 'node-frame-d082', 'browser', 'screenshots']) {
  for (const id of ['', 'wrong-run-artifact', '-1', '1.2', null, undefined]) {
    test(`gate rejects malformed ${stage} artifact identity ${id}`, () => {
      const needs = success(); needs[stage].outputs['artifact-id'] = id;
      assert.throws(() => requireSuccess(needs), /artifact is required/);
    });
  }
}

test('D080 WebGL captures retain the full three-width matrix, original limit and mandatory evidence', () => {
  const workflow = fs.readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8');
  const capture = /\n  d080:\n[\s\S]*?(?=\n  [a-z][a-z0-9-]*:\n|$)/.exec(workflow)?.[0];
  assert.ok(capture, 'D080 capture job is required');
  assert.match(capture, /timeout-minutes: 45\n/);
  assert.match(capture, /strategy:\n      fail-fast: false\n      matrix:\n        width: \[1440, 360, 412\]/);
  assert.match(capture, /uses: actions\/checkout@v4\n        with:\n          persist-credentials: false/);
  assert.match(capture, /node-version: 24\n/);
  assert.match(capture, /run: npm ci\n/);
  assert.match(capture, /fonts-wqy-zenhei\n/);
  assert.match(capture, /run: npm run build\n/);
  assert.match(capture, /run: node tools\/d080-capture\.mjs\n        env:\n          D080_WIDTHS: \$\{\{ matrix\.width \}\}/);
  assert.match(capture, /uses: actions\/upload-artifact@v4\n        if: always\(\)/);
  assert.match(capture, /name: d080-preview-\$\{\{ matrix\.width \}\}-\$\{\{ github\.sha \}\}/);
  assert.match(capture, /path: scratch\/d080\/\n          if-no-files-found: error\n          retention-days: 14/);
  assert.doesNotMatch(capture, /continue-on-error:|\n    (?:if|needs):/);
});

for (const stage of ['build', 'node-frame', 'node-frame-d079', 'node-frame-d080', 'node-frame-d081', 'node-frame-d082', 'browser', 'screenshots']) {
  for (const outputs of [null, undefined, {}]) {
    test(`gate rejects absent ${stage} artifact outputs ${JSON.stringify(outputs)}`, () => {
      const needs = success(); needs[stage].outputs = outputs;
      assert.throws(() => requireSuccess(needs), /artifact is required/);
    });
  }
}

test('D081 WebGL captures retain the full three-width matrix, original limit and mandatory evidence', () => {
  const workflow = fs.readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8');
  const capture = /\n  d081:\n[\s\S]*?(?=\n  [a-z][a-z0-9-]*:\n|$)/.exec(workflow)?.[0];
  assert.ok(capture, 'D081 capture job is required');
  assert.match(capture, /timeout-minutes: 45\n/);
  assert.match(capture, /strategy:\n      fail-fast: false\n      matrix:\n        width: \[1440, 360, 412\]/);
  assert.match(capture, /uses: actions\/checkout@v4\n        with:\n          persist-credentials: false/);
  assert.match(capture, /node-version: 24\n/);
  assert.match(capture, /run: npm ci\n/);
  assert.match(capture, /fonts-wqy-zenhei\n/);
  assert.match(capture, /run: npm run build\n/);
  assert.match(capture, /run: node tools\/d081-capture\.mjs\n        env:\n          D081_WIDTHS: \$\{\{ matrix\.width \}\}/);
  assert.match(capture, /uses: actions\/upload-artifact@v4\n        if: always\(\)/);
  assert.match(capture, /name: d081-preview-\$\{\{ matrix\.width \}\}-\$\{\{ github\.sha \}\}/);
  assert.match(capture, /path: scratch\/d081\/\n          if-no-files-found: error\n          retention-days: 14/);
  assert.doesNotMatch(capture, /continue-on-error:|\n    (?:if|needs):/);
});


test('D081 touch geometry is mandatory alongside unchanged trusted browser smoke', () => {
  const workflow = fs.readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes('run: node tools/smoke.mjs 2>&1 | tee smoke-run.txt; exit ${PIPESTATUS[0]}'));
  assert.ok(workflow.includes('run: node tools/d081-touch-lease-browser.mjs 2>&1 | tee d081-touch-lease-browser.txt; exit ${PIPESTATUS[0]}'));
  assert.ok(workflow.includes('            d081-touch-lease-browser.txt'));
});


test('D081 touch scope has its own immutable PR33 Git baseline without replacing any art baseline', () => {
  const workflow = fs.readFileSync(new URL('../workflows/ci.yml', import.meta.url), 'utf8');
  const node = workflow.slice(workflow.indexOf('\n  node:\n'), workflow.indexOf('\n  node-frame:\n'));
  assert.ok(node.includes('run: git fetch --no-tags --depth=1 origin "$D081_TOUCH_BASELINE"'));
  assert.ok(node.includes('D081_TOUCH_BASELINE: 9e3452a438331feec4082f6821cfcb0b0e653c4b'));
});

test('D082 production screenshots retain all widths and fail-closed evidence',()=>{
 const workflow=fs.readFileSync(new URL('../workflows/ci.yml',import.meta.url),'utf8');
 const capture=/\n  d082:\n[\s\S]*?(?=\n  [a-z][a-z0-9-]*:\n|$)/.exec(workflow)?.[0];
 assert.ok(capture);assert.match(capture,/timeout-minutes: 45/);assert.match(capture,/fail-fast: false/);
 assert.ok(capture.includes('width: [1440, 360, 412]'));assert.ok(capture.includes('run: node tools/d082-redesign-capture.mjs'));
 assert.ok(capture.includes('D082_REDESIGN_WIDTHS:'));assert.match(capture,/if-no-files-found: error/);assert.doesNotMatch(capture,/continue-on-error:/);
});

test('current release requires original classifier coverage after actual captures',()=>{const s=fs.readFileSync(new URL('../workflows/ci.yml',import.meta.url),'utf8');assert.ok(s.includes('run: node tools/d082-redesign-coverage.mjs'));assert.equal(s.split('0b6da7aa384e5a65c07221eed9301aa4a94cd4ba').length,3);assert.equal(s.split('63a1b3919b0e1531f3d0e988cc575bdde5736002').length,4);assert.ok(s.includes('run: node tools/d082-join-product-capture.mjs'));assert.ok(s.includes('D082_PAIR_SOURCE: 63a1b3919b0e1531f3d0e988cc575bdde5736002')); });
