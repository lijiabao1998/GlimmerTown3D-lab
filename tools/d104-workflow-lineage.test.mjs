// Finite lineage tests; no historical/product/browser guard is executed here.
// The transit entry has fetch-depth:0, needed for the immutable 76e inputs.
// D106 (docs/D106-ci-first-use-ceiling.md): the composed chain now also carries the D106
// first-use layer, so the forged-validator controls run against the actual current validator
// and deltas, the composed chain has thirteen files, and the exact D104 chain (main 23d42c9)
// is a third prior state that only --refreeze accepts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {D104_WORKFLOW, D104_DELTAS, D104_VALIDATOR, D104_BEFORE, D104_WORKFLOW_SHA,
  D104_WORKFLOW_SEAMS, D104_QUALIFICATION_NOTE, assertD104Workflow,
  d104WorkflowLayer, d104WorkflowRouting, d104WorkflowLineage} from './d104-workflow-lineage.mjs';
import {D101_BASELINE, createD101Lease} from './d101-source-contract.mjs';
import {D101_FIXTURE, D101_ENTRY, d101LeaseEntry} from './d101-freeze-source.mjs';
import {D101_CHAIN_FILES, D101ChainRefusal, d101ChainCandidate,
  d101CityViewFromSuccessor, d101WritePlan, d101AssertOnDisk} from './d101-freeze-chain.mjs';
import {D106_WORKFLOWS} from './d106-first-use-lineage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const cache = new Map();
const base = file => {
  if (!cache.has(file)) cache.set(file, execFileSync('git', ['show', D101_BASELINE + ':' + file], {cwd:ROOT, encoding:'utf8', maxBuffer:32e6}));
  return cache.get(file);
};
const snapshot = entries => file => Object.hasOwn(entries, file) ? entries[file] : read(file);
const layer = d104WorkflowLayer(base), F = D101_CHAIN_FILES;
const manifest = JSON.parse(read(D101_FIXTURE));
const leasedView = d101CityViewFromSuccessor(read(F.camera));
assert.equal(sha(leasedView), manifest.modified['src/cityView.ts'].afterSha256);
function candidateFor(m, view, legacyWorkflow = false, firstUse = true) {
  const bytes = json(m), digest = sha(bytes), entry = d101LeaseEntry(digest);
  createD101Lease(bytes, digest);
  const {out, log} = d101ChainCandidate(m, view, {legacyWorkflow, firstUse});
  return {out, log, fresh:{bytes, digest, entry, manifest:m}, files:{[D101_FIXTURE]:bytes, [D101_ENTRY]:entry, ...out}};
}
// These are pure candidates for the same valid leased UI; none is written.
const legacy = candidateFor(manifest, leasedView, true), combined = candidateFor(manifest, leasedView);
const d104Only = candidateFor(manifest, leasedView, false, false);
const legacyDisk = snapshot({...legacy.files, [D104_DELTAS]:base(D104_DELTAS), [D104_VALIDATOR]:base(D104_VALIDATOR), [F.nativeWorkflow]:base(F.nativeWorkflow)});
const d104Disk = snapshot({...d104Only.files, [F.nativeWorkflow]:base(F.nativeWorkflow)});
const combinedDisk = snapshot(combined.files);
const currentDeltas = combined.out[F.workflowDeltas], currentValidator = combined.out[F.workflowValidator];

test('D104 appends eleven finite CI seams while preserving all original preimages and other seven rows', () => {
  assert.equal(D104_WORKFLOW_SEAMS.length, 11);
  assert.equal(sha(layer.workflow), D104_WORKFLOW_SHA);
  assert.equal(read(D104_WORKFLOW), layer.workflow);
  const before = JSON.parse(base(D104_DELTAS)), after = JSON.parse(layer.deltas);
  assert.deepEqual(after.workflows.slice(1), before.workflows.slice(1));
  assert.deepEqual(after.workflows[0].changes.slice(0, 4), before.workflows[0].changes);
  assert.deepEqual(after.workflows[0].changes.slice(4), D104_WORKFLOW_SEAMS);
  assert.equal(after.workflows[0].before, before.workflows[0].before);
  assert.equal(after.workflows[0].beforeSha256, before.workflows[0].beforeSha256);
  const timeoutRows = text => text.split('\n').filter(line => line.includes('timeout-minutes:'));
  assert.deepEqual(timeoutRows(layer.workflow), timeoutRows(base(D104_WORKFLOW)));
  const block = (text, name) => new RegExp('\\n  ' + name + ':\\n[\\s\\S]*?(?=\\n  [a-z][a-z0-9-]*:\\n|$)').exec(text)?.[0];
  assert.equal(block(layer.workflow, 'pages'), block(base(D104_WORKFLOW), 'pages'));
  assert.equal(layer.workflow.split('\njobs:')[0], base(D104_WORKFLOW).split('\njobs:')[0]);
});

test('each baseline input and every individually reverted D104 seam is refused', () => {
  for (const file of Object.keys(D104_BEFORE)) {
    assert.throws(() => d104WorkflowLayer(f => base(f) + (f === file ? ' ' : '')), /exact D104 baseline input/);
  }
  for (const seam of D104_WORKFLOW_SEAMS) {
    assert.equal(layer.workflow.split(seam.after).length - 1, 1);
    const reverted = layer.workflow.replace(seam.after, () => seam.before);
    assert.throws(() => assertD104Workflow(reverted), /exact authorised D104 CI schedule/);
    assert.throws(() => d101ChainCandidate(manifest, leasedView, {source:snapshot({[D104_WORKFLOW]:reverted})}), /exact authorised D104 CI schedule/);
  }
  assert.throws(() => assertD104Workflow(layer.workflow + '\n'), /exact authorised D104 CI schedule/);
});

test('routing changes only CI; lineage keeps the original copies, immutable bytes and D103 exception', () => {
  const routing = JSON.parse(base(F.routing)), updated = d104WorkflowRouting(routing);
  const withoutCI = value => Object.fromEntries(Object.entries(value.inheritedWorkflows).filter(([file]) => file !== D104_WORKFLOW));
  assert.deepEqual(withoutCI(updated), withoutCI(routing));
  updated.inheritedWorkflows[D104_WORKFLOW] = routing.inheritedWorkflows[D104_WORKFLOW];
  assert.deepEqual(updated, routing);
  const lineage = JSON.parse(base(F.lineage)), changed = d104WorkflowLineage(lineage, layer);
  assert.equal(changed.copies.length, 14);
  for (let i = 0; i < 14; i++) if (i !== 8) assert.deepEqual(changed.copies[i], lineage.copies[i]);
  assert.deepEqual(changed.copies[8].changes.slice(0, 8), lineage.copies[8].changes);
  assert.equal(changed.qualification, lineage.qualification + D104_QUALIFICATION_NOTE);
  for (const [file, hash] of Object.entries(lineage.workflows)) {
    assert.equal(changed.workflows[file], file === D104_WORKFLOW ? D104_WORKFLOW_SHA : hash);
  }
  const copy = changed.copies[8]; let replay = read(copy.preimage);
  assert.equal(sha(replay), copy.sourceSha256);
  for (const seam of copy.changes) {
    assert.equal(replay.split(seam.before).length - 1, seam.count);
    replay = replay.replaceAll(seam.before, seam.after);
  }
  assert.equal(copy.header + replay, layer.validator);
  assert.equal(copy.targetSha256, sha(layer.validator));
  assert.throws(() => d104WorkflowRouting(d104WorkflowRouting(routing)), /previous routing workflow pin/);
});

test('validator changes are finite and reversible; every old assertion and D103 exact timeout survives', () => {
  let restored = layer.validator;
  for (const [before, after] of [...layer.validatorEdits].reverse()) {
    assert.equal(restored.split(after).length - 1, 1);
    restored = restored.replace(after, () => before);
  }
  assert.equal(restored, base(D104_VALIDATOR));
  assert.ok(layer.validator.includes("id==='d086'?/\\n    timeout-minutes: 30\\n/:/\\n    timeout-minutes: 20\\n/"));
  assert.ok(layer.validator.includes('except the owner-authorised D103 D086 native-and-build timeout'));
  for (const file of ['tools/d090-validation.mjs', 'tools/d090-validation.test.mjs', 'tools/d090-validation-pipes-v2.test.mjs',
    'proposals/d090/foundation-routing.json', 'proposals/d090/foundation-routing-contract.mjs',
    'proposals/d090/foundation-routing.test.mjs', '.github/scripts/ci-integrity-d090.test.mjs', 'tools/unit.mjs']) {
    assert.equal(read(file), base(file), file + ' stays byte-exact');
  }
});

async function validatorFor(bytes) {
  assert.equal(currentValidator.split("WORKFLOW_DELTA_SHA='" + sha(currentDeltas) + "'").length, 2);
  let source = currentValidator.replace("WORKFLOW_DELTA_SHA='" + sha(currentDeltas) + "'", "WORKFLOW_DELTA_SHA='" + sha(bytes) + "'");
  source = source.replace(/from'([^']+)'/g, (whole, name) => name.startsWith('.')
    ? "from'" + pathToFileURL(path.resolve(ROOT, 'tools', name)).href + "'" : whole);
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

test('forged manifest pin cannot admit a self-consistent undeclared CI schedule', async () => {
  const current = await validatorFor(currentDeltas);
  assert.equal(current.assertInheritedWorkflowSet(currentDeltas, snapshot({[D104_WORKFLOW]:layer.workflow})).workflows.length, 8);
  const forged = JSON.parse(currentDeltas), row = forged.workflows[0];
  row.changes.pop();
  let workflow = row.before;
  for (const seam of row.changes) workflow = workflow.split(seam.before).join(seam.after);
  row.afterSha256 = sha(workflow);
  const bytes = json(forged), validator = await validatorFor(bytes);
  assert.throws(() => validator.assertInheritedWorkflowSet(bytes, snapshot({[D104_WORKFLOW]:workflow})),
    error => error.code === 'ERR_ASSERTION' && error.message.includes('exact authorised D104 CI schedule'));
});

test('forged manifest pin still cannot widen D087 timeout through the preserved native assertion', async () => {
  const file = '.github/workflows/d087-native.yml', before = '  native-and-build:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 20\n';
  const after = before.replace('20', '30'), original = read(file);
  assert.equal(original.split(before).length - 1, 1);
  const workflow = original.replace(before, after), forged = JSON.parse(currentDeltas), row = forged.workflows.find(r => r.file === file);
  row.changes.push({before, after, count:1}); row.afterSha256 = sha(workflow);
  const bytes = json(forged), validator = await validatorFor(bytes);
  assert.throws(() => validator.assertInheritedWorkflowSet(bytes, snapshot({[file]:workflow})),
    error => error.code === 'ERR_ASSERTION' && error.expected instanceof RegExp && String(error.expected) === '/\\n    timeout-minutes: 20\\n/');
});

test('combined candidate has thirteen files (eleven outputs) and preserves D101 inventories, source hashes and original lineage replay', () => {
  assert.equal(Object.keys(legacy.out).length, 8);
  assert.equal(Object.keys(d104Only.out).length, 10);
  assert.ok(!Object.hasOwn(d104Only.out, F.nativeWorkflow));
  assert.equal(Object.keys(combined.files).length, 13);
  assert.deepEqual(Object.keys(combined.out).sort(), Object.values(F).sort());
  for (const file of [F.d085, F.domain, F.inherited, F.camera]) assert.equal(combined.out[file], d104Only.out[file], file + ' is not touched by D106');
  assert.equal(combined.files[D101_FIXTURE], legacy.files[D101_FIXTURE]);
  const routing = JSON.parse(combined.out[F.routing]), lineage = JSON.parse(combined.out[F.lineage]);
  assert.equal(routing.current.length, 47); assert.equal(routing.actualInventory.length, 56); assert.equal(routing.superseded.length, 4);
  assert.equal(lineage.copies.length, 14); assert.equal(Object.keys(lineage.workflows).length, 35);
  assert.equal(JSON.parse(combined.out[F.domain]).currentAdditions.length, 23);
  assert.ok(combined.out[F.contract].includes(manifest.modified['src/cityView.ts'].afterSha256));
  assert.equal(combined.out[F.camera], legacy.out[F.camera]);
  assert.deepEqual(candidateFor(manifest, leasedView).files, combined.files, 'deterministic regeneration');
  d101AssertOnDisk(combined.files, combinedDisk);
});

test('only explicit refreeze accepts the exact old D101 chain or the exact D104 chain, even when the lease is already fresh', () => {
  for (const readFile of [legacyDisk, d104Disk]) {
    assert.throws(() => d101WritePlan(combined, {readFile}), D101ChainRefusal);
    const plan = d101WritePlan(combined, {refreeze:true, readFile});
    assert.equal(plan.lease, 'unchanged'); assert.equal(plan.leaseWrite, false);
    assert.deepEqual([...plan.writes].sort(), [F.routing, F.contract, F.lineage, F.lineageModule, F.workflowDeltas, F.workflowValidator, F.nativeWorkflow].sort());
  }
  assert.deepEqual(d101WritePlan(combined, {readFile:combinedDisk}).writes, []);
  assert.deepEqual(d101WritePlan(combined, {refreeze:true, readFile:combinedDisk}).writes, []);
});

test('a later UI lease can refreeze from an exact legacy, D104 or composed chain without dropping D104 or D106', () => {
  const nextView = leasedView + '\n// D104 isolated candidate fixture only\n', next = structuredClone(manifest);
  next.modified['src/cityView.ts'].afterSha256 = sha(nextView);
  const candidate = candidateFor(next, nextView);
  for (const readFile of [legacyDisk, d104Disk, combinedDisk]) {
    assert.throws(() => d101WritePlan(candidate, {readFile}), /Pass --refreeze/);
    const plan = d101WritePlan(candidate, {refreeze:true, readFile});
    assert.equal(plan.lease, 'refrozen'); assert.equal(plan.leaseWrite, true);
    assert.ok(plan.writes.includes(F.camera)); assert.ok(plan.writes.includes(F.contract));
  }
  assert.equal(JSON.parse(candidate.out[F.routing]).inheritedWorkflows[D104_WORKFLOW], D104_WORKFLOW_SHA);
  assert.equal(JSON.parse(candidate.out[F.lineage]).workflows[D104_WORKFLOW], D104_WORKFLOW_SHA);
  for (const file of D106_WORKFLOWS) assert.equal(JSON.parse(candidate.out[F.lineage]).workflows[file], sha(read(file)), file + ' keeps its D106 pin');
  assert.equal(candidate.out[F.nativeWorkflow], combined.out[F.nativeWorkflow]);
  assert.ok(candidate.out[F.contract].includes(sha(nextView)));
});

test('every hand-edited generated chain file is refused, even with refreeze', () => {
  for (const readFile of [legacyDisk, d104Disk, combinedDisk]) for (const file of Object.values(F)) {
    const changed = f => readFile(f) + (f === file ? ' ' : '');
    assert.throws(() => d101WritePlan(combined, {refreeze:true, readFile:changed}), D101ChainRefusal, file);
  }
  assert.throws(() => d101WritePlan(combined, {refreeze:true, readFile:f => combinedDisk(f) + (f === D104_WORKFLOW ? '\n' : '')}), /exact authorised D104 CI schedule/);
  for (const file of D106_WORKFLOWS) {
    assert.throws(() => d101WritePlan(combined, {refreeze:true, readFile:f => combinedDisk(f) + (f === file ? '\n' : '')}), /exact authorised D106 first-use step/, file);
  }
});

test('legacy and D104-only projections never mask an undeclared workflow or immutable predecessor edit', () => {
  for (const file of ['.github/workflows/d087-native.yml', '.github/workflows/d090-native.yml', 'proposals/d090/original-camera-restoration.test.mjs']) {
    const source = f => read(f) + (f === file ? ' ' : '');
    for (const [legacyWorkflow, firstUse] of [[false, true], [false, false], [true, true]]) {
      assert.throws(() => d101ChainCandidate(manifest, leasedView, {legacyWorkflow, firstUse, source}), error => error.code === 'ERR_ASSERTION');
    }
  }
  // The exact pre-D106 YAML is not the sealed D106 input, so the composed and D104-only candidates refuse it too.
  for (const file of D106_WORKFLOWS) {
    const source = f => f === file ? base(f) : read(f);
    assert.throws(() => d101ChainCandidate(manifest, leasedView, {source}), /exact authorised D106 first-use step/, file);
  }
});
