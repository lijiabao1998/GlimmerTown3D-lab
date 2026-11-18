// D106 declared first-use ceiling layer (docs/D106-ci-first-use-ceiling.md, owner 2026-11-18).
// A pure finite transformation, modelled on tools/d104-workflow-lineage.mjs; it never writes files.
// Inputs: the exact 23d42c9 (= main 76e074f) bytes of the five native workflows and of
// proposals/d090/native-workflow.json, plus the exact D104 layer outputs (workflow delta manifest and
// pipes-v2 validator). The five YAML files are sealed read-only inputs: each must already be its base
// plus exactly one declared seam (a YAML comment and an env block with NODE_OPTIONS on the
// native-input-performance first-use step; the run: line stays byte-identical). D101 composes these
// outputs after D104 and before replaying every lineage pin.
// Review fix (2026-11-18): the pipes-v2 validator gate also ends at the step's last line and pins
// the sha256 of the six D106 runtime files (hook, resolve, declarations, three copies), so the
// validator that runs in d086-d089 native-and-build on every PR and main push refuses any edit to
// the code the hook loads; the routing manifest's "No thresholds ... relaxed" gets an appended note.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {D104_DELTAS, D104_VALIDATOR, D104_REASON, D104_QUALIFICATION_NOTE} from './d104-workflow-lineage.mjs';

export const D106_NATIVE_WORKFLOW = 'proposals/d090/native-workflow.json';
export const D106_HOOK = 'proposals/d106/first-use-ceiling-hook.mjs';
const D090 = '.github/workflows/d090-native.yml';
// The four inherited workflows whose rows live in proposals/d090/inherited-workflow-deltas.json.
export const D106_DELTA_ROWS = Object.freeze(['.github/workflows/d086-native.yml', '.github/workflows/d087-native.yml', '.github/workflows/d088-native.yml', '.github/workflows/d089-native.yml']);
export const D106_WORKFLOWS = Object.freeze([...D106_DELTA_ROWS, D090]);
const RUN = Object.freeze({
  '.github/workflows/d086-native.yml': '        run: node proposals/d086/native-first-use-cache-check-v6.mjs --width=${{ matrix.width }} --attempt=1\n',
  '.github/workflows/d087-native.yml': '        run: node proposals/d087/native-first-use-cache-check.mjs --width=${{ matrix.width }} --attempt=1\n',
  '.github/workflows/d088-native.yml': '        run: node proposals/d088/native-first-use-cache-check.mjs --width=${{ matrix.width }} --attempt=1\n',
  '.github/workflows/d089-native.yml': '        run: node proposals/d089/native-first-use-cache-check.mjs --width=${{ matrix.width }} --attempt=1\n',
  [D090]: '        run: node proposals/d090/native-first-use-cache-check.mjs --width=${{ matrix.width }} --attempt=1\n',
});
export const D106_STEP_COMMENT = '        # D106 (owner 2026-11-18): CI-only page-first commit ceiling 1000 ms (was 400); every other first-use ceiling unchanged; docs/D106-ci-first-use-ceiling.md\n';
export const D106_STEP_ENV = '        env:\n          NODE_OPTIONS: --import ./' + D106_HOOK + '\n';
// One seam per workflow: the unchanged run: line followed by the comment and the env block.
export const D106_WORKFLOW_SEAMS = Object.freeze(Object.fromEntries(D106_WORKFLOWS.map(file => [file, Object.freeze({before: RUN[file], after: RUN[file] + D106_STEP_COMMENT + D106_STEP_ENV, count: 1})])));
// sha256 of every input: the five workflows and native-workflow.json at 23d42c9 (identical at main
// 76e074f), and the exact D104 layer outputs (the D104 candidate on main 23d42c9).
export const D106_BEFORE = Object.freeze({
  '.github/workflows/d086-native.yml': 'd242ed2e707c71c215279df09f3ae7018398669ba6a6cc744b922734210b1b7e',
  '.github/workflows/d087-native.yml': '94060b1eeb88c3a9d5078b926bc15c9c494ec2bfb9e16369c2d0f229ed390010',
  '.github/workflows/d088-native.yml': '9cd541728fafd2be22db3c608027dc88cb56bc710dd4334d2db6947898643754',
  '.github/workflows/d089-native.yml': 'a469e54a16e5a3283c6e62122ae8299475249682bf31148dac42d1bb91e38dfb',
  [D090]: 'd4fbcd8dcc129d3ae2267d3d92369c6bcf94697fbccd92ca26db7077f6755153',
  [D106_NATIVE_WORKFLOW]: 'acb1329e3cffffffcac32fe79bc5d84fbb221542dc71c5d62602f076c66169e5',
  [D104_DELTAS]: '59d3eee3a5321ab3b6dd9bd505671adfe4aad36eee7fc74786e88c7c3c41147d',
  [D104_VALIDATOR]: 'dbbe933ddcbec3a1da908784c12516fdfa33059a02347258b0e55c0742df2c5b',
});
// sha256 of each sealed D106 workflow (its base plus exactly its one seam).
export const D106_AFTER = Object.freeze({
  '.github/workflows/d086-native.yml': '1c898bae02fb66c140588cb8e35e70f37d9e0ba4cbd3e99605a01bb5488d8404',
  '.github/workflows/d087-native.yml': '9ddce1845c3a817c33a8ec71baad784910b4631755e5edfd6099e84f2259c591',
  '.github/workflows/d088-native.yml': '09a0d7a49c98372c61a7454c3d3e1516e1f632060d5c3e80e92a5b0dd8a4fac4',
  '.github/workflows/d089-native.yml': '42833554961d99c1a5d897f5b5c6b0e30368fac8db461a7f377982136eddd0dd',
  [D090]: 'eb149f4b7fb4bf2c8cb1056dc9d565e464294cb4dba670ea3eda70057c51de73',
});
export const D106_REASON = 'D106 owner-authorised CI-only first-use ceiling (owner 2026-11-18: "必要時放寬標準", "明確是雲端機器給的cpu 太少 和門檻太高 實際玩起來不卡"): the native-input-performance first-use step of d086-d090 native sets NODE_OPTIONS to --import ./proposals/d106/first-use-ceiling-hook.mjs, which redirects exactly the five original browser-first-use-performance.mjs modules to declared copies where only the page-first placement (operation 1) commit ceiling is 1000 ms instead of 400; composed after D104 before lineage replay.';
export const D106_QUALIFICATION_NOTE = ' Subsequent D106 (owner 2026-11-18) adds the third finite workflow exception and the first threshold exception: the native-input-performance first-use step of .github/workflows/d086-native.yml, d087-native.yml, d088-native.yml, d089-native.yml and d090-native.yml sets NODE_OPTIONS to --import ./proposals/d106/first-use-ceiling-hook.mjs, which redirects exactly the five original browser-first-use-performance.mjs modules to declared copies whose only threshold change is the CI page-first placement (operation 1) commit ceiling 400 -> 1000 ms; previewMs<=16, every other commitMs<=400, rebuildMs/rebuildAllMs<=400 and the three-commit median<=400 stay, and every original module, test and run: line stays byte-exact.';
const D104_HEADER_LINE = '// D104 adds only the exact authorised CI scheduling seams; all previous gates remain.';
export const D106_VALIDATOR_NOTE = '// D106 (owner 2026-11-18) relaxes one threshold in CI only, so "all previous gates remain" no longer\n' +
  '// holds for it: on the native-input-performance first-use step of d086-d090 native, NODE_OPTIONS loads\n' +
  '// ' + D106_HOOK + ' and the page\'s first placement (operation 1) may commit in <=1000 ms\n' +
  '// instead of 400. Every other first-use ceiling and every original module and test stay exact.';
const TIMEOUT_GATE = "assert.match(block(w,'native-and-build'),id==='d086'?/\\n    timeout-minutes: 30\\n/:/\\n    timeout-minutes: 20\\n/);";
// The line that follows the D106 env block in all five workflows (the next step), so the gate also
// pins where the first-use step ends: no extra env var or key can follow NODE_OPTIONS.
export const D106_STEP_NEXT = '      - uses: actions/upload-artifact@v4\n';
// sha256 of every file the hook loads (its whole module closure besides node: builtins). The copies
// are also re-derived from the originals by tools/unit-d106-first-use.mjs; these pins make the
// validator itself refuse any edit to the relaxation code on every PR and main push.
export const D106_CODE_SHA256 = Object.freeze({
  'proposals/d106/first-use-ceiling-hook.mjs': '997de173dcfbecc860c122a0f5d04585d1d637396599cf5f9ea4d452b9ad147a',
  'proposals/d106/first-use-ceiling-resolve.mjs': '54f8a09bd93688d08bbde20e9961287c499fb1f444403c3bde27edaad74d3268',
  'proposals/d106/first-use-ceiling.mjs': '34a7ed3243fa8c588309fdb4b4d8d0e1058894a96411ef58a5b0df6104129bfe',
  'proposals/d106/browser-first-use-performance-d086.mjs': 'd7ee8613188f4a6dc667e2632e9b4f070feb07b5bf82fdcf86df1b25a4e20c06',
  'proposals/d106/browser-first-use-performance-d087.mjs': 'a0cc7d4f1b07692727876831d08b8ca3dec96acbb9ad4124c41e5b8ad4bdef55',
  'proposals/d106/browser-first-use-performance-d088.mjs': '05858e369db98c1f5b6e197e12d8fafbb3698217be7999066e05e67528504515',
});
// Exact D106 gate for d086-d089 (D103 precedent "依工作流指定確切值"): NODE_OPTIONS occurs once per
// workflow, exactly on the first-use step of native-input-performance, and that step ends right after
// it; the six runtime files are byte-exact. A forged manifest pin cannot move, duplicate, redirect,
// extend or drop it, nor change the code it loads.
export const D106_VALIDATOR_GATE = "assert.equal(w.split('NODE_OPTIONS').length,2,'D106 NODE_OPTIONS only on the declared first-use step '+id);" +
  "assert.ok(block(w,'native-input-performance').includes(" + JSON.stringify(' --attempt=1\n' + D106_STEP_COMMENT + D106_STEP_ENV + D106_STEP_NEXT) + "),'D106 exact first-use ceiling hook '+id);" +
  "for(const[f,h]of Object.entries(" + JSON.stringify(D106_CODE_SHA256) + "))assert.equal(sha(source(f)),h,'D106 exact first-use ceiling code '+f);";
// The sealed runtime files on disk (or through `source`) are exactly the pinned bytes.
export function assertD106Code(source) {
  for (const [file, hash] of Object.entries(D106_CODE_SHA256)) assert.equal(sha(source(file)), hash, 'D106 exact first-use ceiling code ' + file);
}
// foundation-routing-pipes-v2.json says "No thresholds/cameras/probes relaxed."; D106 re-issues that
// manifest, so it appends (never rewrites) the exception.
export const D106_ROUTING_OLD_CLAIM = 'No thresholds/cameras/probes relaxed.';
export const D106_ROUTING_NOTE = ' Exception (D106, owner 2026-11-18, docs/D106-ci-first-use-ceiling.md): one threshold is relaxed in CI only, so "No thresholds ... relaxed" no longer holds for it: the native-input-performance first-use step of d086-d090 native loads proposals/d106/first-use-ceiling-hook.mjs through NODE_OPTIONS and the page first placement (operation 1) may commit in <=1000 ms instead of 400; every other threshold, camera and probe is unchanged and every original module and test stays byte-exact.';
export const D106_CONTRACT_SEAM_NAME = 'D106_D090_FIRST_USE_SEAM';
const REPLACEMENT_PATTERN = /\$[$&`']/;

const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const count = (text, part) => text.split(part).length - 1;
const once = (text, before, after, label) => {
  assert.equal(count(text, before), 1, label + ': exactly one declared D106 seam ' + JSON.stringify(before.slice(0, 80)));
  return text.replace(before, () => after);
};
const canonical = (label, bytes) => {
  const value = JSON.parse(bytes); assert.equal(json(value), bytes, label + ' is canonical JSON'); return value;
};

// The sealed YAML files must be exactly the declared D106 bytes.
export function assertD106Workflows(source) {
  for (const file of D106_WORKFLOWS) assert.equal(sha(source(file)), D106_AFTER[file], 'exact authorised D106 first-use step ' + file);
}

// The five D106 workflows computed from their exact base bytes.
export function d106WorkflowTexts(base) {
  const out = {};
  for (const file of D106_WORKFLOWS) {
    const before = base(file);
    assert.equal(sha(before), D106_BEFORE[file], file + ': exact D106 baseline input');
    out[file] = once(before, D106_WORKFLOW_SEAMS[file].before, D106_WORKFLOW_SEAMS[file].after, file);
    assert.equal(count(out[file], D106_WORKFLOW_SEAMS[file].after), 1, file + ': the D106 seam after occurs once');
    assert.equal(sha(out[file]), D106_AFTER[file], 'exact authorised D106 first-use step ' + file);
  }
  return out;
}

// native-workflow.json: one appended replacement (applied with replaceAll after every earlier one,
// exactly as tools/d090-native-workflow.test.mjs replays it) and the new afterSha256.
export function d106NativeWorkflow(base) {
  const bytes = base(D106_NATIVE_WORKFLOW);
  assert.equal(sha(bytes), D106_BEFORE[D106_NATIVE_WORKFLOW], D106_NATIVE_WORKFLOW + ': exact D106 baseline input');
  const manifest = canonical(D106_NATIVE_WORKFLOW, bytes), seam = D106_WORKFLOW_SEAMS[D090];
  assert.equal(manifest.target, D090); assert.equal(manifest.afterSha256, D106_BEFORE[D090]);
  assert.equal(manifest.replacements.length, 18);
  const previous = base(D090);
  assert.equal(count(previous, seam.before), 1);
  assert.ok(!REPLACEMENT_PATTERN.test(seam.after), 'no String.replaceAll replacement sequence in the D106 seam');
  assert.equal(previous.replaceAll(seam.before, seam.after), d106WorkflowTexts(base)[D090]);
  manifest.replacements.push([seam.before, seam.after, 1]);
  manifest.afterSha256 = D106_AFTER[D090];
  return json(manifest);
}

// For the pre-D106 (D104-only and legacy) candidates: the exact sealed D106 YAML and the exact D106
// native-workflow.json read as their base bytes; any other byte is passed through and fails the pins.
export function d106PriorSource(source, base) {
  const after = {...d106WorkflowTexts(base), [D106_NATIVE_WORKFLOW]: d106NativeWorkflow(base)};
  return file => Object.hasOwn(after, file) && source(file) === after[file] ? base(file) : source(file);
}

export function d106FirstUseLayer(base, d104) {
  const workflows = d106WorkflowTexts(base);
  assert.equal(sha(d104.deltas), D106_BEFORE[D104_DELTAS], 'exact D104 workflow delta manifest');
  assert.equal(sha(d104.validator), D106_BEFORE[D104_VALIDATOR], 'exact D104 pipes-v2 validator');
  const manifest = canonical(D104_DELTAS, d104.deltas);
  assert.equal(manifest.workflows.length, 8);
  for (const file of D106_DELTA_ROWS) {
    const rows = manifest.workflows.filter(r => r.file === file);
    assert.equal(rows.length, 1, file + ' has exactly one delta row');
    const row = rows[0];
    assert.equal(row.afterSha256, D106_BEFORE[file], file + ': exact previous delta row');
    row.changes.push({...D106_WORKFLOW_SEAMS[file]});
    let replay = row.before;
    for (const c of row.changes) { assert.equal(count(replay, c.before), c.count, file + ': declared reconstruction seam count'); replay = replay.split(c.before).join(c.after); }
    assert.equal(replay, workflows[file], file + ': original 5b preimage plus existing and D106 seams reconstructs the exact workflow');
    row.afterSha256 = D106_AFTER[file];
  }
  const deltas = json(manifest), deltaSha = sha(deltas);
  const validatorEdits = [
    ["WORKFLOW_DELTA_SHA='" + D106_BEFORE[D104_DELTAS] + "'", "WORKFLOW_DELTA_SHA='" + deltaSha + "'"],
    [D104_HEADER_LINE, D104_HEADER_LINE + '\n' + D106_VALIDATOR_NOTE],
    [TIMEOUT_GATE, TIMEOUT_GATE + D106_VALIDATOR_GATE],
  ];
  const validator = validatorEdits.reduce((text, [before, after]) => once(text, before, after, D104_VALIDATOR), d104.validator);
  for (const [, after] of validatorEdits) assert.ok(!REPLACEMENT_PATTERN.test(after), 'no String.replaceAll replacement sequence in a D106 validator edit');
  const nativeWorkflow = d106NativeWorkflow(base);
  return {workflows, deltas, validator, validatorEdits, nativeWorkflow,
    hashes:{deltas:deltaSha, validator:sha(validator), nativeWorkflow:sha(nativeWorkflow), workflows:{...D106_AFTER}}};
}

export function d106FirstUseRouting(routing) {
  const out = structuredClone(routing);
  for (const file of D106_DELTA_ROWS) {
    assert.equal(out.inheritedWorkflows[file], D106_BEFORE[file], 'exact previous routing workflow pin ' + file);
    out.inheritedWorkflows[file] = D106_AFTER[file];
  }
  assert.equal(out.workflow.afterSha256, D106_BEFORE[D090], 'exact previous routing d090 workflow pin');
  out.workflow.afterSha256 = D106_AFTER[D090];
  assert.equal(out.qualification.split(D106_ROUTING_OLD_CLAIM).length, 2, 'the routing claim D106 qualifies is there once');
  assert.ok(!out.qualification.includes(D106_ROUTING_NOTE), 'apply the D106 routing note once');
  out.qualification += D106_ROUTING_NOTE;
  return out;
}

// Routing contract line 25: besides the one original command replacement, accept exactly the declared
// D106 seam (written into the contract as a frozen constant) and its one appended native-workflow.json
// replacement. Messages are extended, never dropped.
export function d106ContractEdits() {
  const seam = D106_WORKFLOW_SEAMS[D090];
  return [
    ["export const sha=x=>createHash('sha256').update(x).digest('hex');const read=f=>fs.readFileSync(f,'utf8');",
      '// D106 finite workflow seam (docs/D106-ci-first-use-ceiling.md, owner 2026-11-18): the d090\n' +
      '// native-input-performance first-use step keeps its run: line and gains only the CI-only\n' +
      '// page-first commit ceiling hook (NODE_OPTIONS). Nothing else in d090-native.yml may change.\n' +
      'export const ' + D106_CONTRACT_SEAM_NAME + '=Object.freeze([' + JSON.stringify(seam.before) + ',' + JSON.stringify(seam.after) + ']);\n' +
      "export const sha=x=>createHash('sha256').update(x).digest('hex');const read=f=>fs.readFileSync(f,'utf8');"],
    ["assert.equal(now,old.replace(m.workflow.before,m.workflow.after),'only the first test command changes; all job needs, permissions, timeouts and artifact retention stay exact');",
      'const d106Workflow=old.replace(m.workflow.before,m.workflow.after);assert.equal(d106Workflow.split(' + D106_CONTRACT_SEAM_NAME + "[0]).length,2,'D106: exactly one declared first-use step');assert.equal(now,d106Workflow.replace(" + D106_CONTRACT_SEAM_NAME + '[0],()=>' + D106_CONTRACT_SEAM_NAME + "[1]),'only the first test command changes, plus the declared D106 first-use NODE_OPTIONS seam; all job needs, permissions, timeouts and artifact retention stay exact');"],
    ["expected.replacements.push([m.workflow.before,m.workflow.after,1]);expected.afterSha256=sha(now);assert.deepEqual(newManifest,expected,'one additional finite workflow command only');",
      'expected.replacements.push([m.workflow.before,m.workflow.after,1],[...' + D106_CONTRACT_SEAM_NAME + ",1]);expected.afterSha256=sha(now);assert.deepEqual(newManifest,expected,'one additional finite workflow command and the declared D106 seam only');"],
  ];
}
export function d106Contract(text, label = 'proposals/d090/foundation-routing-contract-pipes-v2.mjs') {
  return d106ContractEdits().reduce((s, [before, after]) => once(s, before, after, label), text);
}

export function d106FirstUseLineage(lineage, layer) {
  const out = structuredClone(lineage);
  for (const file of D106_WORKFLOWS) {
    assert.equal(out.workflows[file], D106_BEFORE[file], 'exact previous lineage workflow pin ' + file);
    out.workflows[file] = D106_AFTER[file];
  }
  assert.ok(out.qualification.endsWith(D104_QUALIFICATION_NOTE), 'D106 appends after the D104 note');
  assert.ok(!out.qualification.includes(D106_QUALIFICATION_NOTE), 'apply D106 lineage once');
  out.qualification += D106_QUALIFICATION_NOTE;
  const copies = out.copies.filter(row => row.target === D104_VALIDATOR);
  assert.equal(copies.length, 1); const copy = copies[0];
  assert.equal(out.copies.indexOf(copy), 8); assert.equal(copy.changes.length, 11);
  assert.equal(copy.targetSha256, D106_BEFORE[D104_VALIDATOR], 'exact previous (D104) validator pin');
  assert.equal(copy.reissued?.reason, D104_REASON, 'the D104 reissue record is kept and extended');
  copy.changes.push(...layer.validatorEdits.map(([before, after]) => ({before, after, count:1})));
  copy.targetSha256 = layer.hashes.validator;
  copy.reissued = {previousSha256:copy.reissued.previousSha256, reason:D104_REASON + ' ' + D106_REASON};
  return out;
}
