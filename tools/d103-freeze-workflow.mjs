// D103 declared workflow change generator (owner 2026-11-05: "放寬到例如 30 分鐘" / "放寬吧").
// From the exact c8e5ef1 bytes, writes the D086 native-and-build timeout 20 -> 30 minutes and every
// D090 current-layer pin that follows from it. Card: docs/D103-d086-native-timeout.md.
// Refuses unless every input matches its expected starting hash (so it can never run twice or on a
// drifted tree); every replacement must occur exactly once; lineage change lists are append-only;
// the e4c original validator, v1 routing, evidence, fixtures and tests are never written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const count = (text, part) => text.split(part).length - 1;
const once = (text, before, after, where) => {
  assert.equal(count(text, before), 1, `${where}: exactly one occurrence of ${JSON.stringify(before.slice(0, 90))}`);
  return text.replace(before, () => after);
};
const canonical = (file, bytes) => {
  const value = JSON.parse(bytes);
  assert.equal(JSON.stringify(value, null, 2) + '\n', bytes, file + ' is canonical JSON');
  return value;
};
const json = value => JSON.stringify(value, null, 2) + '\n';

export const D103_BASELINE = 'c8e5ef14689403a1935185935b9d442323d14f11';
export const D103_FILES = Object.freeze({
  workflow: '.github/workflows/d086-native.yml',
  deltas: 'proposals/d090/inherited-workflow-deltas.json',
  runner: 'proposals/d090/inherited-test-runner.mjs',
  validator: 'tools/d090-validation-pipes-v2.mjs',
  routing: 'proposals/d090/foundation-routing-pipes-v2.json',
  contract: 'proposals/d090/foundation-routing-contract-pipes-v2.mjs',
  lineage: 'proposals/d090/selector-pipes-lineage.json',
  lineageModule: 'proposals/d090/selector-pipes-lineage.mjs',
});
// sha256 of each input at D103_BASELINE.
export const D103_BEFORE = Object.freeze({
  [D103_FILES.workflow]: 'c1a12caec58ba8d7d241195e391e3ea1851e4da46c37a116b3a64cb93a1072a4',
  [D103_FILES.deltas]: 'd858db4a91071d2a4823bc6a7265a76c9c757741df1482b18d851f664a6410ef',
  [D103_FILES.runner]: 'eae1ecaab58f967d2b2d48c56cea3a3c52d5677f4fa855a1edbdcb8d4a9c0080',
  [D103_FILES.validator]: 'b44ce5b8c634028ef35529596b0a295b50f18c79874ede5bf81434fbf584aeeb',
  [D103_FILES.routing]: 'cf82ca1226850e407024f5d0886355f80bc1b2b07ea4ba270ca890405cfea0c1',
  [D103_FILES.contract]: '2ea625248bcaf677b7cdd52f66d43c20708cc13b7a24b0e2246a36c533739a5f',
  [D103_FILES.lineage]: 'e540566547019cfd4f2fb5c0d64b356453ccef22f8a07413b261b23e3bc60e89',
  [D103_FILES.lineageModule]: 'e3a345780797ba1b6c337f40a2fadb11d83188da0f6314ebb7ce7c5161420497',
});

// The one declared workflow seam: anchored on the job header because surface-qualification also
// carries "    timeout-minutes: 20".
export const D103_SEAM = Object.freeze({
  before: '  native-and-build:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 20\n',
  after: '  native-and-build:\n    runs-on: ubuntu-24.04\n    timeout-minutes: 30\n',
  count: 1,
});
export const D103_REASON = 'D103 owner-authorised D086 native-and-build timeout 20->30 minutes (owner 2026-11-05: "放寬吧"), declared in proposals/d090/inherited-workflow-deltas.json; no other change to the 35 workflows this lineage pins (the unpinned transit.yml only gains the D103 guard step)';
export const D103_QUALIFICATION_NOTE = ' D103 (owner 2026-11-05) is the single exception among the 35 pinned workflows: .github/workflows/d086-native.yml native-and-build timeout-minutes 20->30, declared as one finite seam in proposals/d090/inherited-workflow-deltas.json.';
// The one step D103 adds to the unpinned transit.yml, right after the D102 step.
export const D103_TRANSIT_ANCHOR = '      - name: D102 steel construction history guards\n        run: node tools/unit-d102-history.mjs\n';
export const D103_TRANSIT_STEP = '      - name: D103 declared D086 native timeout guards\n        run: node tools/unit-d103-timeout.mjs\n';

const OLD_IMPORT = "'../../tools/d090-validation.mjs'";
const NEW_IMPORT = "'../../tools/d090-validation-pipes-v2.mjs'";

export function d103Candidate(source = read) {
  for (const [file, hash] of Object.entries(D103_BEFORE)) assert.equal(sha(source(file)), hash, file + ' is exactly the D103 baseline input');
  const out = {}, log = {};

  // 1. Workflow: one line.
  out[D103_FILES.workflow] = once(source(D103_FILES.workflow), D103_SEAM.before, D103_SEAM.after, D103_FILES.workflow);
  const H_Y = log.workflow = sha(out[D103_FILES.workflow]);

  // 2. Declared finite seam on the d086 row only.
  const deltas = canonical(D103_FILES.deltas, source(D103_FILES.deltas)), row = deltas.workflows[1];
  assert.equal(row.file, D103_FILES.workflow);
  row.changes.push({...D103_SEAM});
  let rebuilt = row.before;
  for (const c of row.changes) { assert.equal(count(rebuilt, c.before), c.count, 'd086 seam count'); rebuilt = rebuilt.split(c.before).join(c.after); }
  assert.equal(rebuilt, out[D103_FILES.workflow], 'declared reconstruction is exactly the new workflow');
  row.afterSha256 = H_Y;
  out[D103_FILES.deltas] = json(deltas);
  const H_WD = log.deltas = sha(out[D103_FILES.deltas]);

  // 3. Inherited runner: read the reissued manifest through the pipes-v2 validator.
  const runnerEdits = [[OLD_IMPORT, NEW_IMPORT]];

  // 4. pipes-v2 validator.
  const RUN_DECL = "const actual=source('proposals/d090/inherited-test-runner.mjs'),before=\"'./inherited-test-contract.mjs'\",after=\"'./inherited-test-contract-pipes-v2.mjs'\";";
  const RUN_DECL_D103 = "const actual=source('proposals/d090/inherited-test-runner.mjs'),before=\"'./inherited-test-contract.mjs'\",after=\"'./inherited-test-contract-pipes-v2.mjs'\",validationBefore=\"" + OLD_IMPORT + "\",validationAfter=\"" + NEW_IMPORT + "\";";
  const RUN_CHECK = "assert.equal(sha(actual.replace(after,before)),INHERITED_RUNNER_SHA,";
  const RUN_CHECK_D103 = "assert.equal(actual.split(validationAfter).length,2,'one current workflow-validation import');assert.equal(actual.split(validationBefore).length,1,'no stale workflow-validation import');assert.equal(sha(actual.replace(after,before).replace(validationAfter,validationBefore)),INHERITED_RUNNER_SHA,";
  const validatorEdits = [
    ['// relaxed; this is a validation dependency, never a publication authorization.', '// relaxed, except the owner-authorised D103 D086 native-and-build timeout (20 -> 30\n// minutes); this is a validation dependency, never a publication authorization.'],
    ["'" + D103_BEFORE[D103_FILES.deltas] + "'", "'" + H_WD + "'"],
    ["assert.match(block(w,'native-and-build'),/timeout-minutes: 20/);", "assert.match(block(w,'native-and-build'),id==='d086'?/\\n    timeout-minutes: 30\\n/:/\\n    timeout-minutes: 20\\n/);"],
    [RUN_DECL, RUN_DECL_D103],
    [RUN_CHECK, RUN_CHECK_D103],
  ];

  // 5-6. Routing pin and its contract constant.
  const routing = canonical(D103_FILES.routing, source(D103_FILES.routing));
  assert.equal(routing.inheritedWorkflows[D103_FILES.workflow], D103_BEFORE[D103_FILES.workflow]);
  routing.inheritedWorkflows[D103_FILES.workflow] = H_Y;
  out[D103_FILES.routing] = json(routing);
  const H_FR = log.routing = sha(out[D103_FILES.routing]);
  const contractEdits = [['FOUNDATION_ROUTING_SHA="' + D103_BEFORE[D103_FILES.routing] + '"', 'FOUNDATION_ROUTING_SHA="' + H_FR + '"']];

  const apply = (file, edits) => edits.reduce((text, [a, b]) => once(text, a, b, file), source(file));
  out[D103_FILES.runner] = apply(D103_FILES.runner, runnerEdits);
  out[D103_FILES.validator] = apply(D103_FILES.validator, validatorEdits);
  out[D103_FILES.contract] = apply(D103_FILES.contract, contractEdits);
  log.runner = sha(out[D103_FILES.runner]); log.validator = sha(out[D103_FILES.validator]); log.contract = sha(out[D103_FILES.contract]);

  // 7. Selector lineage: append-only change lists, reissued records, pins.
  const lineage = canonical(D103_FILES.lineage, source(D103_FILES.lineage));
  assert.equal(lineage.workflows[D103_FILES.workflow], D103_BEFORE[D103_FILES.workflow]);
  lineage.workflows[D103_FILES.workflow] = H_Y;
  assert.equal(lineage.newPinnedManifests[D103_FILES.routing], D103_BEFORE[D103_FILES.routing]);
  lineage.newPinnedManifests[D103_FILES.routing] = H_FR;
  assert.ok(!lineage.qualification.includes('D103'));
  lineage.qualification += D103_QUALIFICATION_NOTE;
  for (const [file, edits] of [[D103_FILES.runner, runnerEdits], [D103_FILES.validator, validatorEdits], [D103_FILES.contract, contractEdits]]) {
    const copies = lineage.copies.filter(r => r.target === file);
    assert.equal(copies.length, 1, file + ' has exactly one lineage copy');
    const r = copies[0];
    assert.equal(r.targetSha256, D103_BEFORE[file], file + ' lineage target is the baseline');
    for (const [before, after] of edits) r.changes.push({before, after, count: 1});
    let derived = source(r.preimage);
    assert.equal(sha(derived), r.sourceSha256, file + ' unchanged e4c preimage');
    for (const c of r.changes) { assert.equal(count(derived, c.before), c.count, file + ' lineage change count'); derived = derived.replaceAll(c.before, c.after); }
    assert.equal(r.header + derived, out[file], file + ' reproduces from its immutable preimage');
    r.reissued = {previousSha256: D103_BEFORE[file], reason: D103_REASON + (file === D103_FILES.contract ? '; FOUNDATION_ROUTING_SHA follows' : '')};
    r.targetSha256 = sha(out[file]);
  }
  out[D103_FILES.lineage] = json(lineage);
  const H_L = log.lineage = sha(out[D103_FILES.lineage]);

  // 8. Lineage trust root.
  out[D103_FILES.lineageModule] = once(source(D103_FILES.lineageModule), "PIPE_LINEAGE_SHA='" + D103_BEFORE[D103_FILES.lineage] + "'", "PIPE_LINEAGE_SHA='" + H_L + "'", D103_FILES.lineageModule);
  log.lineageModule = sha(out[D103_FILES.lineageModule]);
  return {out, log};
}

// Construction-time check (card acceptance 1, 4, 5), valid while the tree is the D103 change on top of
// D103_BASELINE: the candidate recomputed from the baseline bytes in git equals the working tree, and the
// set of changed paths is exactly the declared one.
export const D103_DECLARED_PATHS = Object.freeze([
  ...Object.values(D103_FILES),
  '.github/workflows/transit.yml',
  'tools/d103-freeze-workflow.mjs',
  'tools/unit-d103-timeout.mjs',
  'docs/D103-d086-native-timeout.md',
  'LOG.md',
].sort());
export function d103ConstructionCheck() {
  const git = (...args) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], {cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6});
  const show = file => git('show', D103_BASELINE + ':' + file);
  const {out, log} = d103Candidate(show);
  for (const [file, bytes] of Object.entries(out)) assert.equal(read(file), bytes, file + ' is exactly the candidate recomputed from ' + D103_BASELINE);
  // Every workflow file: byte-identical to the baseline, except d086-native.yml (the candidate above) and
  // transit.yml, which is the baseline plus exactly the D103 step after the D102 step.
  const workflows = git('ls-tree', '--name-only', D103_BASELINE, '.github/workflows/').split('\n').filter(Boolean).sort();
  assert.deepEqual(fs.readdirSync(path.join(ROOT, '.github/workflows')).map(f => '.github/workflows/' + f).sort(), workflows, 'no workflow file added or removed');
  for (const file of workflows) {
    if (file === D103_FILES.workflow) continue;
    const expected = file === '.github/workflows/transit.yml' ? once(show(file), D103_TRANSIT_ANCHOR, D103_TRANSIT_ANCHOR + D103_TRANSIT_STEP, file) : show(file);
    assert.equal(read(file), expected, file + ' is the baseline' + (file.endsWith('transit.yml') ? ' plus exactly the D103 step' : ''));
  }
  // A local `node_modules` symlink to a shared install is not matched by the `node_modules/` ignore rule;
  // CI installs a real (ignored) directory with npm ci. Nothing else is excluded. --no-renames lists a
  // rename as a deletion plus an addition, so nothing can leave the tree disguised as new evidence.
  const changed = [...new Set([...git('diff', '--name-only', '--no-renames', D103_BASELINE).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(f => f && f !== 'node_modules'))].sort();
  const evidence = changed.filter(f => f.startsWith('docs/evidence/D103/'));
  for (const f of evidence) assert.ok(fs.existsSync(path.join(ROOT, f)), f + ' is an added evidence file, not a deletion');
  assert.deepEqual(changed.filter(f => !f.startsWith('docs/evidence/D103/')), D103_DECLARED_PATHS, 'closed D103 change set');
  return {baseline: D103_BASELINE, candidateEqualsWorkingTree: Object.keys(out).length, workflowsChecked: workflows.length, changed: changed.length, evidence, after: log};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    console.log(JSON.stringify(d103ConstructionCheck(), null, 2));
  } else {
    const {out, log} = d103Candidate();
    for (const [file, bytes] of Object.entries(out)) fs.writeFileSync(path.join(ROOT, file), bytes);
    console.log(JSON.stringify({baseline: D103_BASELINE, before: D103_BEFORE, after: log}, null, 2));
  }
}
