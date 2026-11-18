// D106 relaxed first-use copies (docs/D106-ci-first-use-ceiling.md): bytes against git history and
// gate behaviour. May call git (transit.yml checks out with fetch-depth 0).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {D106_BASE, D106_GROUPS, D106_ORIGINAL_SHA256, D106_PAGE_FIRST_COMMIT_MAX_MS, d106Seams, d106RelaxedCopy} from './first-use-ceiling.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const git = file => execFileSync('git', ['show', D106_BASE + ':' + file], {cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6});
const load = file => import(pathToFileURL(path.join(ROOT, file)).href);
const count = (text, part) => text.split(part).length - 1;
const COPIES = Object.keys(D106_GROUPS);
const ORIGINALS = Object.keys(D106_ORIGINAL_SHA256);

// A complete committed first-use record as collectD086FirstUsePerformance builds it.
const record = (operation, values = {}) => ({cpuRate:6, physicalAndroid:false, cacheColdVerified:false, actualPointer:true, operation,
  firstNativeAttempt:operation === 1, previewFresh:true, commitFresh:true, newMatchingPlacements:1, selectionExactTimingAvailable:false,
  originalThreeSampleMedianQualified:false, previewMs:1, commitMs:60, rebuildMs:40, rebuildAllMs:50, selectionObservedElapsedMs:10, ...values});
const series = commits => commits.map((commitMs, i) => ({model:{id:'m'}, operation:i + 1, timeOrigin:1, cpuRate:6, actualPointer:true, commitFresh:true, newMatchingPlacements:1, commitMs}));
const rejects = (fn, message) => assert.throws(fn, error => error.code === 'ERR_ASSERTION' && error.message === message, message);

test('the five original modules stay byte-exact at 23d42c9 and keep their three byte groups', () => {
  assert.equal(ORIGINALS.length, 5);
  for (const file of ORIGINALS) {
    assert.equal(read(file), git(file), file + ' equals git ' + D106_BASE.slice(0, 7));
    assert.equal(sha(read(file)), D106_ORIGINAL_SHA256[file], file);
  }
  for (const originals of Object.values(D106_GROUPS)) for (const file of originals) assert.equal(read(file), read(originals[0]), file + ' shares its group bytes');
  assert.deepEqual(Object.values(D106_GROUPS).flat().sort(), [...ORIGINALS].sort(), 'every original belongs to exactly one copy');
});

test('each relaxed copy is git 23d42c9 of its original plus exactly the four declared seams', () => {
  assert.equal(COPIES.length, 3);
  for (const copy of COPIES) {
    const original = git(D106_GROUPS[copy][0]), actual = read(copy), seams = d106Seams(copy);
    assert.equal(seams.length, 4);
    assert.equal(actual, d106RelaxedCopy(copy, original), copy);
    let restored = actual;
    for (const [before, after] of [...seams].reverse()) {
      assert.equal(count(original, before), 1, 'seam before occurs once in the original');
      assert.equal(count(actual, after), 1, 'seam after occurs once in the copy');
      restored = restored.replace(after, () => before);
    }
    assert.equal(restored, original, copy + ': reverting the four seams gives back the original exactly');
    // Only the header, the policy line, the ceiling loop and the record qualification differ.
    const a = original.split('\n'), b = actual.split('\n');
    assert.equal(b.length, a.length + 5, 'five header lines added');
    const changed = b.slice(5).map((line, i) => line === a[i] ? -1 : i + 1).filter(i => i > 0);
    assert.deepEqual(changed, [4, 16, 22], copy + ': lines 4, 16 and 22 of the original change, nothing else');
  }
});

test('one undeclared byte anywhere in a copy breaks the declared reconstruction', () => {
  for (const copy of COPIES) {
    const expected = d106RelaxedCopy(copy, git(D106_GROUPS[copy][0])), actual = read(copy);
    for (const bad of [actual + ' ', actual.replace("['rebuildMs',400,'unchanged']", "['rebuildMs',401,'unchanged']"),
      actual.replace('r.operation===1?1000:400', 'r.operation<=2?1000:400'), actual.replace('pageFirstCommitMaxMs:1000', 'pageFirstCommitMaxMs:1001')]) {
      assert.notEqual(bad, actual);
      assert.notEqual(bad, expected);
    }
  }
  assert.throws(() => d106RelaxedCopy(COPIES[0], read(D106_GROUPS[COPIES[0]][0]).replace('commitMaxMs:400,rebuildMaxMs:400,', 'commitMaxMs:400,rebuildMaxMs:401,')), /exactly once/);
  assert.throws(() => d106Seams('proposals/d106/unknown.mjs'), /not a D106 copy/);
});

for (const copy of COPIES) test('gate behaviour of ' + copy + ': only the page-first commit ceiling moves to 1000 ms', async () => {
  const m = await load(copy);
  assert.equal(D106_PAGE_FIRST_COMMIT_MAX_MS, 1000);
  assert.deepEqual({...m.FIRST_USE_POLICY}, {cpuRate:6, previewMaxMs:16, commitMaxMs:400, pageFirstCommitMaxMs:1000, rebuildMaxMs:400, originalMedianSamples:3, physicalAndroid:false});
  const ok = r => assert.equal(m.assertD086FirstUsePerformance(r), true);
  ok(record(1, {commitMs:1000}));
  ok(record(1, {commitMs:512.3}));
  rejects(() => m.assertD086FirstUsePerformance(record(1, {commitMs:1000.01})), 'D106 CI page-first commitMs ceiling 1000ms');
  for (const operation of [2, 3, 33]) {
    ok(record(operation, {commitMs:400}));
    rejects(() => m.assertD086FirstUsePerformance(record(operation, {commitMs:400.01})), 'unchanged commitMs ceiling 400ms');
    rejects(() => m.assertD086FirstUsePerformance(record(operation, {commitMs:1000})), 'unchanged commitMs ceiling 400ms');
  }
  for (const operation of [1, 2]) {
    ok(record(operation, {previewMs:16, rebuildMs:400, rebuildAllMs:400}));
    rejects(() => m.assertD086FirstUsePerformance(record(operation, {previewMs:16.01})), 'unchanged previewMs ceiling 16ms');
    rejects(() => m.assertD086FirstUsePerformance(record(operation, {rebuildMs:400.01})), 'unchanged rebuildMs ceiling 400ms');
    rejects(() => m.assertD086FirstUsePerformance(record(operation, {rebuildAllMs:400.01})), 'unchanged rebuildAllMs ceiling 400ms');
  }
  for (const bad of [{operation:0}, {operation:1.5}, {commitMs:Number.NaN}, {commitFresh:false}, {originalThreeSampleMedianQualified:true}]) {
    assert.throws(() => m.assertD086FirstUsePerformance(record(1, bad)), {code:'ERR_ASSERTION'});
  }
  assert.deepEqual(m.assertD086ThreeCommitMedian(series([1000, 400, 60])), {samples:3, medianMs:400, limitMs:400, passed:true});
  rejects(() => m.assertD086ThreeCommitMedian(series([512.3, 401, 60])), 'original CPU6 three-commit median400ms ceiling');
  rejects(() => m.assertD086ThreeCommitMedian(series([60, 401, 401])), 'original CPU6 three-commit median400ms ceiling');
});

for (const file of ORIGINALS) test('without the hook the original ' + file + ' still enforces 400 ms on the page-first placement', async () => {
  const m = await load(file);
  assert.equal(m.FIRST_USE_POLICY.commitMaxMs, 400);
  assert.ok(!Object.hasOwn(m.FIRST_USE_POLICY, 'pageFirstCommitMaxMs'));
  assert.equal(m.assertD086FirstUsePerformance(record(1, {commitMs:400})), true);
  rejects(() => m.assertD086FirstUsePerformance(record(1, {commitMs:400.01})), 'unchanged commitMs ceiling 400ms');
});
