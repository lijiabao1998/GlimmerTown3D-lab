// D097 successor source allowance — contract and preview guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {D090_CURRENT_PATHS} from '../../../tools/d090-source.mjs';
import {D097_ADDED, D097_BASELINE, D097_CURRENT_PATHS, createD097Lease} from './d097-source-contract.mjs';
import {releasedPins, verifyPreview} from './verify-preview.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sha = value => createHash('sha256').update(value).digest('hex');
const synthetic = file => '// synthetic successor fixture ' + file + '\n';
const syntheticFiles = Object.fromEntries(D097_CURRENT_PATHS.map(file => [file, synthetic(file)]));
const manifestBytes = ({pins, added, baseline, qualification = 'synthetic successor fixture'} = {}) => JSON.stringify({
  schema: 1,
  baseline: baseline ?? D097_BASELINE,
  qualification,
  baselineFiles: pins ?? Object.fromEntries(D090_CURRENT_PATHS.map(file => [file, sha(synthetic(file))])),
  added: added ?? Object.fromEntries(D097_ADDED.map(file => [file, sha(synthetic(file))])),
}, null, 2) + '\n';
const leaseOf = bytes => createD097Lease(bytes, sha(bytes));

test('exact265 inventory validates before projection and returns the released 263', () => {
  const lease = leaseOf(manifestBytes());
  assert.equal(lease.d097PriorInventory(D097_CURRENT_PATHS, file => syntheticFiles[file]).length, D090_CURRENT_PATHS.length);
  assert.deepEqual(lease.d097PriorInventory(D097_CURRENT_PATHS, file => syntheticFiles[file]), [...D090_CURRENT_PATHS]);
  assert.equal(lease.d097PriorSource(D097_ADDED[0], syntheticFiles[D097_ADDED[0]]), '');
  assert.equal(lease.d097PriorSource(D090_CURRENT_PATHS[0], syntheticFiles[D090_CURRENT_PATHS[0]]), synthetic(D090_CURRENT_PATHS[0]));
});

test('missing, duplicate, unknown and stale inventories fail closed before projection', () => {
  const lease = leaseOf(manifestBytes());
  const ok = file => syntheticFiles[file];
  for (const bad of [
    D097_CURRENT_PATHS.filter(file => file !== D097_ADDED[0]),
    [...D097_CURRENT_PATHS, 'src/unknown.ts'],
    [...D097_CURRENT_PATHS, D097_CURRENT_PATHS[0]],
    D090_CURRENT_PATHS,
  ]) assert.throws(() => lease.d097PriorInventory(bad, ok), /exact265 successor source inventory|duplicate actual source/);
  for (const file of D097_CURRENT_PATHS) assert.throws(() => lease.d097PriorInventory(D097_CURRENT_PATHS, target => ok(target) + (target === file ? '\n' : '')), /exact allowed source/);
});

test('manifest bytes, schema, baseline, qualification and declared sets are finite', () => {
  const good = manifestBytes();
  assert.throws(() => createD097Lease(good, sha(good + '\n')), /exact finite D097 successor manifest/);
  for (const bad of [
    good.replace('"schema": 1', '"schema": 2'),
    good.replace(D097_BASELINE, '0'.repeat(40)),
    good.replace('"synthetic successor fixture"', '""'),
    good.replace('"baselineFiles"', '"extra": 0,\n  "baselineFiles"'),
  ]) {
    if (bad === good) continue;
    assert.throws(() => leaseOf(bad), /exact declared baseline|qualification|AssertionError/);
  }
  const unknownAddition = manifestBytes({added: {...JSON.parse(good).added, 'src/sim/unknown.ts': 'a'.repeat(64)}});
  assert.throws(() => leaseOf(unknownAddition), /only the two declared transit source files/);
  const swapped = JSON.parse(good);
  swapped.added = {[D097_ADDED[1]]: swapped.added[D097_ADDED[1]], [D097_ADDED[0]]: swapped.added[D097_ADDED[0]]};
  assert.throws(() => leaseOf(JSON.stringify(swapped, null, 2) + '\n'), /only the two declared transit source files/);
});

test('real preview pins exactly the released 263 plus the two shipped prototype bytes', () => {
  const manifestText = fs.readFileSync(path.join(ROOT, 'proposals/d097/source-successor/source.successor.preview.json'), 'utf8');
  const prototype = Object.fromEntries(D097_ADDED.map(file => [file, fs.readFileSync(path.join(ROOT, 'proposals/d097/sim', path.basename(file)), 'utf8')]));
  const summary = verifyPreview(manifestText, prototype);
  assert.equal(summary.baselineFiles, 263);
  assert.equal(summary.added, 2);
  assert.equal(summary.inventory, 265);

  const lease = createD097Lease(manifestText, sha(manifestText));
  const read = file => D097_ADDED.includes(file) ? prototype[file] : fs.readFileSync(path.join(ROOT, file), 'utf8');
  const files = [...D090_CURRENT_PATHS, ...D097_ADDED];
  assert.equal(lease.d097PriorInventory(files, read).length, 263);
  assert.equal(lease.d090PriorInventory(files, read).length, 258, 'released D090 chain still accepts the projected 263');

  const pins = releasedPins();
  for (const file of D090_CURRENT_PATHS) assert.equal(pins[file], JSON.parse(manifestText).baselineFiles[file], 'released pin ' + file);
  const tampered = JSON.parse(manifestText);
  tampered.baselineFiles[D090_CURRENT_PATHS[0]] = '0'.repeat(64);
  assert.throws(() => verifyPreview(JSON.stringify(tampered, null, 2) + '\n', prototype), /every released source pin unchanged/);
  const forged = JSON.parse(manifestText);
  forged.added[D097_ADDED[0]] = '0'.repeat(64);
  assert.throws(() => verifyPreview(JSON.stringify(forged, null, 2) + '\n', prototype), /added pin equals shipped prototype bytes/);
  assert.throws(() => verifyPreview(manifestText, {...prototype, [D097_ADDED[0]]: prototype[D097_ADDED[0]] + '\n'}), /added pin equals shipped prototype bytes/);
  const extra = JSON.parse(manifestText);
  extra.baselineFiles['src/unknown.ts'] = '0'.repeat(64);
  assert.throws(() => verifyPreview(JSON.stringify(extra, null, 2) + '\n', prototype), /exactly the released 263/);
});
