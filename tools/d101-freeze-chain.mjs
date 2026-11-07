// D101 lease and D090 current-layer chain generator (card docs/D101-transit-save-and-ui.md,
// section "2026-11-05 合併後重開"). One command regenerates, deterministically, from the exact
// main 76e074f bytes of every chain input plus the actual current src bytes:
//   1. the outer lease fixtures/d101/source.json + tools/d101-source.mjs (via d101-freeze-source),
//   2. tools/d085-source-d090.test.mjs (lines 4 and 5 import the d101 lease),
//   3. proposals/d090/inherited-test-domains-pipes-v2.json (camera successor 1:1 in three places,
//      two appended currentCopies[2] changes, targetSha256) and DOMAIN_MANIFEST_SHA,
//   4. proposals/d090/original-camera-restoration-d101.test.mjs (the camera successor: 5b41bac +
//      the six D090 deltas + the D101 deltas derived by a line diff from main 76e074f),
//   5. proposals/d090/foundation-routing-pipes-v2.json (actualInventory 55->56, superseded 3->4,
//      current recomputed, still 47) and the routing contract (FOUNDATION_ROUTING_SHA, inline
//      D101_MODIFIED_AFTER / D101_SUCCESSOR_ADDED after D102, 267->269),
//   6. proposals/d090/selector-pipes-lineage.json (copy 5, copy 13 folded into one whole-body
//      change from its immutable 3377-byte preimage with reissued.previousSha256 = the main
//      contract, inheritedDomain, newPinnedManifests) and PIPE_LINEAGE_SHA.
// Atomic: the whole candidate (fresh lease + every chain output) is computed in memory and
// self-checked (lineage replayed with the verifier's split-count + String.replaceAll semantics,
// lease projections and manifest counts) before the first byte is written. Every text replacement
// occurs exactly once (function replacement, so `$` sequences are inert).
// Drift: before writing, every on-disk chain file must be its main 76e074f bytes (the camera
// successor: absent), exactly the candidate of the on-disk lease, or already the new candidate.
// Anything else is a hand edit and is refused. A lease that is not the one computed from the
// actual src is replaced only under --refreeze; a hand-edited non-lease chain file is refused even
// then. --check is read-only. Importing this module writes nothing; d101Candidate() is pure (it
// reads git and the working tree) and is what tools/d101-source.test.mjs pins every output to.
// Usage: node tools/d101-freeze-chain.mjs [--refreeze] | --check
// D104: the exact declared CI scheduling layer joins this same in-memory
// candidate before lineage replay. YAML is a sealed read-only input, never an
// output. The original D101/src baseline and every unrelated pin stay fixed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D101_BASELINE, D101_MODIFIED, D101_ADDED, D101_CURRENT_PATHS, createD101Lease} from './d101-source-contract.mjs';
import {D101_ENTRY, D101_FIXTURE, d101FreezeSource, d101LeaseEntry} from './d101-freeze-source.mjs';
import {D104_WORKFLOW, D104_DELTAS, D104_VALIDATOR, D104_BEFORE, D104_REASON,
  assertD104Workflow, d104WorkflowLayer, d104WorkflowRouting, d104WorkflowLineage} from './d104-workflow-lineage.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const readMaybe = file => fs.existsSync(path.join(ROOT, file)) ? read(file) : null;
const shown = new Map();
const show = (rev, file) => {
  const key = rev + ':' + file;
  if (!shown.has(key)) shown.set(key, execFileSync('git', ['show', key], {cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6}));
  return shown.get(key);
};
const count = (text, part) => text.split(part).length - 1;
// Exactly once, overlapping occurrences included (stricter than the split count the tests use).
const unique = (text, part) => part.length > 0 && text.indexOf(part) >= 0 && text.indexOf(part) === text.lastIndexOf(part);
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
const REPLACEMENT_PATTERN = /\$[$&`']/;

export const D101_CHAIN_FILES = Object.freeze({
  d085: 'tools/d085-source-d090.test.mjs',
  domain: 'proposals/d090/inherited-test-domains-pipes-v2.json',
  inherited: 'proposals/d090/inherited-test-contract-pipes-v2.mjs',
  camera: 'proposals/d090/original-camera-restoration-d101.test.mjs',
  routing: 'proposals/d090/foundation-routing-pipes-v2.json',
  contract: 'proposals/d090/foundation-routing-contract-pipes-v2.mjs',
  lineage: 'proposals/d090/selector-pipes-lineage.json',
  lineageModule: 'proposals/d090/selector-pipes-lineage.mjs',
  workflowDeltas: D104_DELTAS,
  workflowValidator: D104_VALIDATOR,
});
export const D101_LEASE_FILES = Object.freeze([D101_FIXTURE, D101_ENTRY]);
const ORIGINAL_CAMERA = 'proposals/d090/original-camera-restoration.test.mjs';
const D089_CAMERA = 'proposals/d089/original-camera-restoration.test.mjs';
const D085_SOURCE = 'tools/d085-source-d089.test.mjs';
const CITY_VIEW = 'src/cityView.ts';
// sha256 of each chain input at D101_BASELINE (main 76e074f).
export const D101_CHAIN_BEFORE = Object.freeze({
  [D101_CHAIN_FILES.d085]: 'e9fda2ef00f95cb6ab61fa977e60de7fc8314d35d214468c45a3a57d45084238',
  [D101_CHAIN_FILES.domain]: '0be5b4f47c84e6fbace7bac93ecd3868b622298e2812b6b416373c6a70a7087f',
  [D101_CHAIN_FILES.inherited]: '383a31a9b0d6f7401de32d3647a8434e088117426e859e757ba7125d9ba8b4f2',
  [D101_CHAIN_FILES.routing]: '3a2615fcb0593d7d85d4efeece4282f99a42f4bab8d41e57590189903d893619',
  [D101_CHAIN_FILES.contract]: '8875cccbaa70bf77ec4f67321cc15e743db1db4123acc0265e40634e07196f81',
  [D101_CHAIN_FILES.lineage]: 'c037ae2746bc3ae07bbd0f45ec5ee76678e1d717c41a204d40989c5b1e8e936a',
  [D101_CHAIN_FILES.lineageModule]: '5c2e76114a0b2e933e2bf98bc34a117cfc1762b030e0badff24d5a34205d4568',
  [ORIGINAL_CAMERA]: 'da17d79440239b55a0e9d8b65abecc1b10d166980533c7380ab781bb796c4445',
  [D085_SOURCE]: '117cde09c51a032a655ad86f853952e1064987c342c9bf244751892095f3f91c',
  [D104_DELTAS]: D104_BEFORE[D104_DELTAS],
  [D104_VALIDATOR]: D104_BEFORE[D104_VALIDATOR],
});
export const D101_REASON = 'D101 current-source successor (269 files, d101 lease): the D090 current validator admits the eight D101 transit save/UI modifications and the two added transit sources, and the routing current list runs the camera restoration successor; FOUNDATION_ROUTING_SHA follows. The D103 append-only item is folded into this single whole-body change from the immutable e4c preimage.';
const D085_EDITS = Object.freeze([
  ["import{D085_CHANGED,d085PriorSource,d084PriorSource}from'./d090-source.mjs';", "import{D085_CHANGED,d085PriorSource,d084PriorSource}from'./d101-source.mjs';"],
  ["import{d084PriorInventory}from'./d102-source.mjs';", "import{d084PriorInventory}from'./d101-source.mjs';"],
]);
// The bytes a chain file has at main 76e074f (null: the file does not exist there).
const baselineBytes = file => file === D101_CHAIN_FILES.camera || D101_LEASE_FILES.includes(file) ? null : show(D101_BASELINE, file);

// Line diff (LCS on whole lines, common prefix/suffix trimmed first) -> ordered hunks.
function lineHunks(a, b) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const A = a.slice(p, a.length - s), B = b.slice(p, b.length - s), n = A.length, m = B.length;
  const L = new Int32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * (m + 1) + j] = A[i] === B[j] ? L[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(L[(i + 1) * (m + 1) + j], L[i * (m + 1) + j + 1]);
  const hunks = [];
  let i = 0, j = 0, open = null;
  const close = () => { if (open) { open.i1 = i + p; open.j1 = j + p; hunks.push(open); open = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { close(); i++; j++; continue; }
    if (!open) open = {i0: i + p, j0: j + p};
    if (j < m && (i === n || L[i * (m + 1) + j + 1] >= L[(i + 1) * (m + 1) + j])) j++; else i++;
  }
  close();
  return hunks;
}
const lines = text => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

// Finite deltas that turn `from` into `to`, applied in order. Delta k applies to
// T_k = to[0, j0) + from[i0, end) (every earlier delta applied, no later one). Each group of hunks
// is widened by whole context lines on both sides until its `before` occurs exactly once in T_k and
// its `after` occurs exactly once in `to`. A group whose widened context overlaps or touches the
// next group's widened context is merged with it into one delta and the widening starts over, so
// in the result every context line is unchanged, no two deltas share or abut a line, and each
// delta can be reverted on its own in the final text.
export function d101Deltas(from, to) {
  const a = lines(from), b = lines(to);
  assert.equal(a.join(''), from, 'lossless line split');
  assert.equal(b.join(''), to, 'lossless line split');
  const widen = g => {
    const T = [...b.slice(0, g.j0), ...a.slice(g.i0)], text = T.join('');
    const maxBefore = g.j0, maxAfter = Math.min(a.length - g.i1, b.length - g.j1);
    for (let ctx = 1; ; ctx++) {
      const cb = Math.min(ctx, maxBefore), ca = Math.min(ctx, maxAfter);
      const before = T.slice(g.j0 - cb, g.j0 + (g.i1 - g.i0) + ca).join(''), after = b.slice(g.j0 - cb, g.j1 + ca).join('');
      if (unique(text, before) && unique(to, after)) return {...g, lo: g.i0 - cb, hi: g.i1 + ca, before, after};
      if (cb === maxBefore && ca === maxAfter) return {...g, lo: -Infinity, hi: Infinity};
    }
  };
  let groups = lineHunks(a, b), widened;
  for (;;) {
    widened = groups.map(widen);
    const k = widened.findIndex((g, n) => n + 1 < widened.length && g.hi >= widened[n + 1].lo);
    if (k < 0) break;
    groups = [...groups.slice(0, k), {i0: groups[k].i0, i1: groups[k + 1].i1, j0: groups[k].j0, j1: groups[k + 1].j1}, ...groups.slice(k + 2)];
  }
  assert.ok(widened.every(g => Number.isFinite(g.lo) && Number.isFinite(g.hi)), 'every cityView delta has a unique context');
  const deltas = widened.map(g => [g.before, g.after]);
  let s = from;
  for (const [before, after] of deltas) {
    assert.notEqual(before, after, 'every D101 delta is a real change');
    assert.ok(unique(s, before) && count(s, before) === 1, 'every D101 before occurs exactly once in the text it applies to: ' + JSON.stringify(before.slice(0, 90)));
    s = s.replace(before, () => after);
  }
  assert.equal(s, to, 'derived deltas reproduce the actual cityView exactly');
  for (const [before, after] of deltas) {
    assert.ok(unique(to, after) && count(to, after) === 1, 'every D101 after occurs exactly once in the final cityView: ' + JSON.stringify(after.slice(0, 90)));
    assert.notEqual(to.replace(after, () => before), to, 'every D101 delta is individually revertible');
  }
  return deltas;
}

const DELTA_OPEN = '\nconst d101Deltas=[\n', DELTA_CLOSE = '\n];\nfunction expected(';
// Inverse of the generated literal: the cityView a successor declares (main 76e074f + its deltas).
export function d101CityViewFromSuccessor(successor) {
  assert.equal(count(successor, DELTA_OPEN), 1, 'one D101 delta literal');
  assert.equal(count(successor, DELTA_CLOSE), 1, 'one D101 delta literal end');
  const start = successor.indexOf(DELTA_OPEN) + DELTA_OPEN.length - 2, end = successor.indexOf(DELTA_CLOSE) + 2;
  const deltas = JSON.parse(successor.slice(start, end));
  assert.ok(Array.isArray(deltas) && deltas.every(d => Array.isArray(d) && d.length === 2 && d.every(x => typeof x === 'string')), 'D101 delta literal shape');
  return deltas.reduce((s, [a, b]) => once(s, a, b, 'declared D101 delta'), show(D101_BASELINE, CITY_VIEW));
}

function cameraSuccessor(original, mainView, currentView) {
  // Layout of the immutable original (0-based lines): 3-14 the delta block, 15 expected, 16 qualify,
  // 17 the whole-source test, 18 D081, 19-25 the camera mutations, 26 cemetery, 27 pipe visibility.
  const src = original.split('\n');
  assert.equal(src.length, 29, 'original camera test: 28 lines and a final newline');
  assert.equal(src[28], '');
  assert.ok(src[3] === 'const deltas=[' && src[10] === '];' && src[11] === 'const sceneDeltas=[' && src[14] === '];', 'original delta block layout');
  assert.ok(src[15].startsWith('function expected(') && src[16].startsWith('function qualify(') && src[17].startsWith("test('whole original player camera/render bytes restored"), 'original function layout');
  assert.ok(src[18].startsWith("test('D081 original classifier") && src[19] === 'for(const[name,mutate]of[' && src[25].startsWith("])test('complete camera source rejects '") && src[26].startsWith("test('new exact cemetery path") && src[27].startsWith("test('exact inherited pipe visibility"), 'original mutation layout');
  const block = src.slice(3, 15).join('\n') + '\n';
  const ctx = {};
  vm.runInNewContext(block.replace('const deltas=', 'globalThis.deltas=').replace('const sceneDeltas=', 'globalThis.sceneDeltas='), ctx);
  const apply = (text, changes) => changes.reduce((s, [a, b]) => once(s, a, b, 'D090 camera delta'), text);
  const old = file => show('5b41bac165ba2b29146e6835490357bebc3cd549', file);
  assert.equal(apply(old(CITY_VIEW), ctx.deltas), mainView, 'main cityView is 5b41bac plus the six D090 deltas');
  assert.equal(apply(old('src/render/cityScene.ts'), ctx.sceneDeltas), show(D101_BASELINE, 'src/render/cityScene.ts'), 'main cityScene is 5b41bac plus the two D090 seams');
  const deltas = d101Deltas(mainView, currentView);
  assert.ok(deltas.length > 0, 'cityView is a declared D101 modification');
  const literal = deltas.map(([a, b]) => ' [' + JSON.stringify(a) + ',' + JSON.stringify(b) + ']').join(',\n');
  const text = `// D101 finite successor of ${ORIGINAL_CAMERA}: that file stays byte-exact (da17d794) and is
// listed as superseded in proposals/d090/foundation-routing-pipes-v2.json. Same finite contract: the whole
// player/render camera source is 5b41bac plus the six D090 deltas (= main 76e074f) plus the declared D101
// deltas below, each applied at exactly one seam; cityScene, post.ts and the D081 files stay exact.
// Generated by tools/d101-freeze-chain.mjs (the D101 deltas come from a line diff against main 76e074f;
// hunks whose context would overlap or touch are merged, so each delta is revertible on its own).
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{execFileSync}from'node:child_process';
const read=f=>fs.readFileSync(f,'utf8'),show=(rev,f)=>execFileSync('git',['show',rev+':'+f],{encoding:'utf8',maxBuffer:64*1024*1024}),old=f=>show('5b41bac165ba2b29146e6835490357bebc3cd549',f);
const D101_BASELINE='${D101_BASELINE}';
${block}// D101: finite deltas on top of main 76e074f, in order.
const d101Deltas=[
${literal}
];
function expected(file,changes){let s=old(file);for(const[a,b]of changes){assert.equal(s.split(a).length,2,'one finite native integration seam');s=s.replace(a,()=>b);}return s;}
function qualify(view,scene){assert.equal(view,expected('src/cityView.ts',[...deltas,...d101Deltas]),'entire player/render camera source remains exact beyond explicit UI/native flag/cache/pipe selection and the declared D101 deltas');assert.equal(scene,expected('src/render/cityScene.ts',sceneDeltas),'only opted-in exact new variant can bypass village override');}
test('the D101 base is exactly main 76e074f: 5b41bac plus the six D090 view deltas and the two scene seams',()=>{assert.equal(expected('src/cityView.ts',deltas),show(D101_BASELINE,'src/cityView.ts'));assert.equal(expected('src/render/cityScene.ts',sceneDeltas),show(D101_BASELINE,'src/render/cityScene.ts'));});
test('whole original player camera/render bytes restored by finite native-only additions and the declared D101 deltas',()=>{qualify(read('src/cityView.ts'),read('src/render/cityScene.ts'));assert.equal(read('src/render/post.ts'),old('src/render/post.ts'));assert.doesNotMatch(read('src/cityView.ts'),/inspectionCamera|d08[6-9]Inspection|d090Inspection/);});
${src.slice(18, 26).join('\n')}
test('every declared D101 delta is individually revertible and every revert is caught',()=>{assert.ok(d101Deltas.length>0);const s=read('src/cityView.ts'),scene=read('src/render/cityScene.ts');let reverted=0;for(const[a,b]of d101Deltas){assert.notEqual(a,b,'a real change');assert.equal(s.split(b).length,2,'the D101 after occurs exactly once in the actual cityView');assert.equal(s.indexOf(b),s.lastIndexOf(b),'the D101 after occurs exactly once (no overlapping occurrence)');const bad=s.replace(b,()=>a);assert.notEqual(bad,s);assert.throws(()=>qualify(bad,scene));reverted++;}assert.equal(reverted,d101Deltas.length);});
${src.slice(26, 29).join('\n')}`;
  assert.equal(d101CityViewFromSuccessor(text), currentView, 'the successor literal declares exactly the actual cityView');
  return text;
}

// Replay every lineage copy exactly as assertPipesValidationLineage does (split count, then
// String.replaceAll with string replacements) and check every pin, against `view`.
function replayLineage(lineage, view) {
  for (const r of lineage.copies) {
    let s = view(r.preimage);
    assert.equal(sha(s), r.sourceSha256, r.target + ' preimage');
    if (r.source !== r.target) assert.equal(view(r.source), s, 'unchanged actual predecessor ' + r.source);
    for (const c of r.changes) { assert.equal(s.split(c.before).length - 1, c.count, r.target + ' change count'); s = s.replaceAll(c.before, c.after); }
    assert.equal(view(r.target), r.header + s, 'complete exact finite inverse ' + r.target);
    assert.equal(sha(view(r.target)), r.targetSha256, r.target + ' target pin');
  }
  for (const fields of [lineage.preserved, lineage.workflows, lineage.newIndependentFiles, lineage.newPinnedManifests]) for (const [f, h] of Object.entries(fields)) assert.equal(sha(view(f)), h, f + ' pinned');
  assert.equal(sha(view(lineage.inheritedDomain.after)), lineage.inheritedDomain.afterSha256);
}

// Ten composed chain outputs for a lease manifest. `cityView` is the leased
// text; null leaves the camera successor out. legacyWorkflow is used only to
// recompute the exact pre-D104 candidate for the finite --refreeze migration.
// It projects only D104's three declared workflow-layer inputs to main 76e;
// it still replays every other actual source, copy, manifest and workflow pin.
export function d101ChainCandidate(manifest, cityView, {legacyWorkflow = false, source = read} = {}) {
  const base = file => show(D101_BASELINE, file);
  for (const [file, hash] of Object.entries(D101_CHAIN_BEFORE)) assert.equal(sha(base(file)), hash, file + ' is exactly the D101 baseline input');
  assert.equal(source(ORIGINAL_CAMERA), base(ORIGINAL_CAMERA), 'the original camera test stays byte-exact (da17d794)');
  assert.deepEqual(Object.keys(manifest.modified), D101_MODIFIED);
  assert.deepEqual(Object.keys(manifest.added), D101_ADDED);
  const out = {}, log = {};
  const F = D101_CHAIN_FILES;
  const workflowLayer = legacyWorkflow ? null : d104WorkflowLayer(base);
  if (workflowLayer) {
    assertD104Workflow(source(D104_WORKFLOW));
    out[F.workflowDeltas] = workflowLayer.deltas;
    out[F.workflowValidator] = workflowLayer.validator;
    Object.assign(log, {workflow:workflowLayer.hashes.workflow, workflowDeltas:workflowLayer.hashes.deltas, workflowValidator:workflowLayer.hashes.validator});
  }

  // 2. d085 current test: both lease imports.
  out[F.d085] = D085_EDITS.reduce((text, [a, b]) => once(text, a, b, F.d085), base(F.d085));

  // 3. Domain manifest: camera successor 1:1 (three places) and the two appended d085 changes.
  const domain = canonical(F.domain, base(F.domain));
  assert.equal(domain.currentAdditions.length, 23);
  assert.equal(domain.currentAdditions.filter(f => f === ORIGINAL_CAMERA).length, 1);
  assert.ok(!domain.currentAdditions.includes(F.camera));
  domain.currentAdditions[domain.currentAdditions.indexOf(ORIGINAL_CAMERA)] = F.camera;
  assert.deepEqual(domain.currentReplacements[D089_CAMERA], [ORIGINAL_CAMERA]);
  domain.currentReplacements[D089_CAMERA] = [F.camera];
  const d089 = domain.d089Originals.filter(r => r.file === D089_CAMERA);
  assert.equal(d089.length, 1);
  assert.deepEqual(d089[0].currentCoverage, [ORIGINAL_CAMERA]);
  d089[0].currentCoverage = [F.camera];
  assert.equal(JSON.stringify(domain).split(ORIGINAL_CAMERA).length - 1, 0, 'no other domain entry names the superseded camera test');
  const copies = domain.currentCopies.filter(r => r.target === F.d085);
  assert.equal(copies.length, 1);
  assert.equal(domain.currentCopies.indexOf(copies[0]), 2);
  const copy = copies[0];
  assert.equal(copy.source, D085_SOURCE);
  assert.equal(copy.targetSha256, D101_CHAIN_BEFORE[F.d085]);
  for (const [before, after] of D085_EDITS) copy.changes.push({before, after, count: 1});
  let rebuilt = base(copy.source);
  assert.equal(sha(rebuilt), copy.sourceSha256);
  assert.equal(source(copy.source), rebuilt, copy.source + ' unchanged on disk');
  for (const c of copy.changes) { assert.equal(count(rebuilt, c.before), c.count, 'd085 copy change count'); rebuilt = rebuilt.split(c.before).join(c.after); }
  assert.equal(rebuilt, out[F.d085], 'the declared domain copy reconstructs the d085 test exactly');
  copy.targetSha256 = sha(out[F.d085]);
  out[F.domain] = json(domain);
  const H_DOMAIN = log.domain = sha(out[F.domain]);
  out[F.inherited] = once(base(F.inherited), 'DOMAIN_MANIFEST_SHA="' + D101_CHAIN_BEFORE[F.domain] + '"', 'DOMAIN_MANIFEST_SHA="' + H_DOMAIN + '"', F.inherited);

  // 4. Camera successor.
  if (cityView !== null) {
    assert.equal(typeof cityView, 'string');
    assert.equal(sha(cityView), manifest.modified[CITY_VIEW].afterSha256, 'the camera successor is generated from the leased cityView bytes');
    out[F.camera] = cameraSuccessor(base(ORIGINAL_CAMERA), base(CITY_VIEW), cityView);
    assert.ok(!F.camera.includes('d090-source.test.mjs'));
  }

  // 5. Routing manifest and contract.
  let routing = canonical(F.routing, base(F.routing));
  if (workflowLayer) routing = d104WorkflowRouting(routing);
  assert.equal(routing.actualInventory.length, 55);
  assert.ok(!routing.actualInventory.includes(F.camera));
  const inventory = [...routing.actualInventory, F.camera].sort();
  const at = inventory.indexOf(F.camera);
  assert.deepEqual([...inventory.slice(0, at), ...inventory.slice(at + 1)], routing.actualInventory, 'sorted insertion of exactly the successor');
  routing.actualInventory = inventory;
  assert.equal(routing.superseded.length, 3);
  assert.ok(!routing.superseded.includes(ORIGINAL_CAMERA));
  routing.superseded.push(ORIGINAL_CAMERA);
  const current = [...routing.actualInventory.filter(f => !routing.historical.includes(f) && !routing.superseded.includes(f)), ...routing.ledger];
  assert.equal(current.length, 47);
  assert.deepEqual(current.map(f => f === F.camera ? ORIGINAL_CAMERA : f), routing.current, 'current changes by exactly the successor replacing the original');
  routing.current = current;
  assert.equal(routing.historical.length, 10);
  assert.equal(routing.originalTests[ORIGINAL_CAMERA], D101_CHAIN_BEFORE[ORIGINAL_CAMERA], 'the original stays a byte-pinned original test');
  out[F.routing] = json(routing);
  const H_ROUTING = log.routing = sha(out[F.routing]);
  const literal = object => '{' + Object.entries(object).map(([f, h]) => `'${f}':'${h}'`).join(',') + '}';
  const after = Object.fromEntries(D101_MODIFIED.map(f => [f, manifest.modified[f].afterSha256]));
  const contractBase = base(F.contract);
  const d102Line = contractBase.split('\n').filter(l => l.startsWith('export const D102_MODIFIED_AFTER=Object.freeze({'));
  assert.equal(d102Line.length, 1);
  const d101Block = `// D101 finite successor: exactly the eight declared transit save/UI files carry new
// bytes and exactly two transit sources join, pinned by the D101 outer lease
// (fixtures/d101/source.json). Spread after D102, so the D101 after hashes win.
export const D101_MODIFIED_AFTER=Object.freeze(${literal(after)});
export const D101_SUCCESSOR_ADDED=Object.freeze(${literal(manifest.added)});
`;
  out[F.contract] = [
    ['FOUNDATION_ROUTING_SHA="' + D101_CHAIN_BEFORE[F.routing] + '"', 'FOUNDATION_ROUTING_SHA="' + H_ROUTING + '"'],
    [d102Line[0] + '\n', d102Line[0] + '\n' + d101Block],
    ["...D102_MODIFIED_AFTER};assert.equal(Object.keys(current).length,267,'actual current267 source inventory');", "...D102_MODIFIED_AFTER,...D101_MODIFIED_AFTER,...D101_SUCCESSOR_ADDED};assert.equal(Object.keys(current).length,269,'actual current269 source inventory');"],
  ].reduce((text, [a, b]) => once(text, a, b, F.contract), contractBase);
  const H_CONTRACT = log.contract = sha(out[F.contract]);

  // 6. Selector lineage.
  let lineage = canonical(F.lineage, base(F.lineage));
  if (workflowLayer) lineage = d104WorkflowLineage(lineage, workflowLayer);
  assert.equal(lineage.copies.length, 14);
  const copyOf = target => { const r = lineage.copies.filter(c => c.target === target); assert.equal(r.length, 1, target + ' has exactly one lineage copy'); return r[0]; };
  const c5 = copyOf(F.inherited);
  assert.equal(lineage.copies.indexOf(c5), 5);
  assert.equal(c5.targetSha256, D101_CHAIN_BEFORE[F.inherited]);
  assert.equal(c5.changes.length, 4);
  assert.equal(c5.changes[3].after, '"' + D101_CHAIN_BEFORE[F.domain] + '"');
  c5.changes[3].after = '"' + H_DOMAIN + '"';
  c5.targetSha256 = sha(out[F.inherited]);
  const c13 = copyOf(F.contract);
  assert.equal(lineage.copies.indexOf(c13), 13);
  assert.equal(c13.targetSha256, D101_CHAIN_BEFORE[F.contract]);
  const preimage = source(c13.preimage);
  assert.equal(sha(preimage), c13.sourceSha256, 'immutable copy-13 preimage');
  assert.equal(Buffer.byteLength(preimage), 3377);
  assert.equal(c13.changes[0].before, preimage, 'copy 13 starts with one whole-body change');
  assert.ok(out[F.contract].startsWith(c13.header));
  c13.changes = [{before: preimage, after: out[F.contract].slice(c13.header.length), count: 1}];
  c13.targetSha256 = H_CONTRACT;
  c13.reissued = {previousSha256: D101_CHAIN_BEFORE[F.contract], reason: D101_REASON + (workflowLayer ? ' ' + D104_REASON : '')};
  for (const c of [c5.changes[3], ...c13.changes]) assert.ok(!REPLACEMENT_PATTERN.test(c.after), 'no String.replaceAll replacement sequence in a new lineage change');
  assert.equal(lineage.inheritedDomain.after, F.domain);
  assert.equal(lineage.inheritedDomain.afterSha256, D101_CHAIN_BEFORE[F.domain]);
  lineage.inheritedDomain.afterSha256 = H_DOMAIN;
  assert.equal(lineage.newPinnedManifests[F.routing], D101_CHAIN_BEFORE[F.routing]);
  lineage.newPinnedManifests[F.routing] = H_ROUTING;
  replayLineage(lineage, file => out[file] ?? (legacyWorkflow && Object.hasOwn(D104_BEFORE, file) ? base(file) : source(file)));
  out[F.lineage] = json(lineage);
  const H_LINEAGE = log.lineage = sha(out[F.lineage]);
  out[F.lineageModule] = once(base(F.lineageModule), "PIPE_LINEAGE_SHA='" + D101_CHAIN_BEFORE[F.lineage] + "'", "PIPE_LINEAGE_SHA='" + H_LINEAGE + "'", F.lineageModule);
  log.d085 = sha(out[F.d085]);
  log.inherited = sha(out[F.inherited]);
  if (out[F.camera] !== undefined) log.camera = sha(out[F.camera]);
  log.lineageModule = sha(out[F.lineageModule]);
  return {out, log};
}

const srcInventory = () => fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();

// In-memory counts of the whole candidate (what verifyWritten later reads back from disk).
function selfCheck(fresh, out) {
  const F = D101_CHAIN_FILES, m = fresh.manifest;
  const lease = createD101Lease(fresh.bytes, fresh.digest);
  assert.equal(fresh.entry, d101LeaseEntry(fresh.digest));
  const files = srcInventory();
  assert.deepEqual(files, D101_CURRENT_PATHS);
  const after = Object.fromEntries(D101_MODIFIED.map(f => [f, m.modified[f].afterSha256]));
  const routing = JSON.parse(out[F.routing]);
  const counts = {
    lineageCopies: JSON.parse(out[F.lineage]).copies.length,
    routingCurrent: routing.current.length,
    routingInventory: routing.actualInventory.length,
    routingSuperseded: routing.superseded.length,
    domainAdditions: JSON.parse(out[F.domain]).currentAdditions.length,
    frozenCurrent: Object.keys({...m.baselineFiles, ...after, ...m.added}).length,
    d101Prior: lease.d101PriorInventory(files, read).length,
    d084Prior: lease.d084PriorInventory(files, read).length,
  };
  assert.deepEqual(counts, {lineageCopies: 14, routingCurrent: 47, routingInventory: 56, routingSuperseded: 4, domainAdditions: 23, frozenCurrent: 269, d101Prior: 267, d084Prior: 237}, 'in-memory candidate counts');
  return counts;
}

// The whole candidate from the actual tree: fresh lease + every chain output, self-checked.
// Pure: reads git and the working tree, writes nothing.
export function d101Candidate() {
  const fresh = d101FreezeSource(D101_BASELINE);
  const {out, log} = d101ChainCandidate(fresh.manifest, read(CITY_VIEW));
  assert.deepEqual(Object.keys(out).sort(), Object.values(D101_CHAIN_FILES).sort());
  const counts = selfCheck(fresh, out);
  const files = Object.freeze({[D101_FIXTURE]: fresh.bytes, [D101_ENTRY]: fresh.entry, ...out});
  return {files, out, fresh, log, counts};
}

export class D101ChainRefusal extends Error {}
const refuse = message => { throw new D101ChainRefusal(message); };

// Every candidate file equals what `readFile` returns (null: missing), byte for byte.
export function d101AssertOnDisk(files, readFile = readMaybe) {
  for (const [file, bytes] of Object.entries(files)) {
    const have = readFile(file);
    if (have !== bytes) refuse(`${file} is not exactly the chain candidate (on disk ${have === null ? 'missing' : 'sha256 ' + sha(have) + ', ' + Buffer.byteLength(have) + ' bytes'}; candidate sha256 ${sha(bytes)}, ${Buffer.byteLength(bytes)} bytes)`);
  }
}

// The on-disk lease: absent, valid (the fixture passes createD101Lease and the entry is the
// generated one for its digest) or invalid.
function diskLease(readFile = readMaybe) {
  const bytes = readFile(D101_FIXTURE), entry = readFile(D101_ENTRY);
  if (bytes === null && entry === null) return {state: 'absent'};
  if (bytes === null || entry === null) return {state: 'invalid', why: 'only one of the two lease files exists'};
  const digest = sha(bytes);
  try { createD101Lease(bytes, digest); } catch (e) { return {state: 'invalid', why: 'the fixture is not a valid D101 manifest (' + e.message + ')'}; }
  if (entry !== d101LeaseEntry(digest)) return {state: 'invalid', why: 'the entry is not the generated entry for the fixture digest'};
  return {state: 'valid', bytes, entry, digest, manifest: JSON.parse(bytes)};
}

// What the tool would have produced from the on-disk lease. The camera successor is the only
// output that depends on cityView text rather than hashes; its cityView is recovered from the
// on-disk successor itself and must hash to the on-disk lease's cityView afterSha256.
function diskLeaseCandidate(manifest, {legacyWorkflow = false, readFile = readMaybe} = {}) {
  let cityView = null;
  const successor = readFile(D101_CHAIN_FILES.camera);
  if (successor !== null) {
    try { cityView = d101CityViewFromSuccessor(successor); } catch { cityView = null; }
    if (cityView !== null && sha(cityView) !== manifest.modified[CITY_VIEW].afterSha256) cityView = null;
  }
  return d101ChainCandidate(manifest, cityView, {legacyWorkflow, source:readFile}).out;
}

// Decide, from the disk state alone, what may be written. Throws D101ChainRefusal on any hand edit.
export function d101WritePlan(candidate, {refreeze = false, readFile = readMaybe} = {}) {
  assertD104Workflow(readFile(D104_WORKFLOW));
  const disk = diskLease(readFile);
  const leaseFresh = disk.state === 'valid' && disk.bytes === candidate.files[D101_FIXTURE] && disk.entry === candidate.files[D101_ENTRY];
  if (disk.state !== 'absent' && !leaseFresh && !refreeze) {
    refuse(`the on-disk D101 lease (${D101_LEASE_FILES.join(', ')}) is not the lease computed from the actual src: ${disk.state === 'invalid' ? disk.why : 'it was frozen from other src bytes (stale)'}. Pass --refreeze to replace it. Nothing was written.`);
  }
  const prior = disk.state === 'valid' ? (leaseFresh ? candidate.out : diskLeaseCandidate(disk.manifest, {readFile})) : {};
  // Only an explicit refreeze may migrate the exact recomputed old D101 chain.
  // No existing bytes, hashes or hand edits are treated as a new trust root.
  const legacy = refreeze && disk.state === 'valid' ? diskLeaseCandidate(disk.manifest, {legacyWorkflow:true, readFile}) : {};
  const writes = [];
  for (const [file, bytes] of Object.entries(candidate.out)) {
    const have = readFile(file);
    if (have === bytes) continue;
    if (have === baselineBytes(file) || (prior[file] !== undefined && have === prior[file]) || (legacy[file] !== undefined && have === legacy[file])) { writes.push(file); continue; }
    refuse(`${file} is neither its main 76e074f bytes${file === D101_CHAIN_FILES.camera ? ' (absent)' : ''} nor exactly the chain candidate of the on-disk lease${disk.state === 'valid' ? '' : ' (there is no valid on-disk lease)'}: a hand edit (on disk sha256 ${have === null ? 'missing' : sha(have)}). It is never overwritten${refreeze ? ', not even with --refreeze' : ''}; restore it to ${file === D101_CHAIN_FILES.camera ? 'absent (delete it)' : 'its 76e074f bytes (git show 76e074f:' + file + ')'} and rerun. Nothing was written.`);
  }
  return {lease: disk.state === 'absent' ? 'frozen' : leaseFresh ? 'unchanged' : 'refrozen', leaseWrite: !leaseFresh, writes};
}

function writeCandidate(candidate, plan) {
  if (plan.leaseWrite) {
    fs.mkdirSync(path.dirname(path.join(ROOT, D101_FIXTURE)), {recursive: true});
    for (const file of D101_LEASE_FILES) fs.writeFileSync(path.join(ROOT, file), candidate.files[file]);
  }
  for (const file of plan.writes) fs.writeFileSync(path.join(ROOT, file), candidate.out[file]);
  d101AssertOnDisk(candidate.files);
}

const VERIFY = `import{assertPipesValidationLineage}from'./proposals/d090/selector-pipes-lineage.mjs';
import{assertFoundationRouting,assertFrozenCurrentSource,D101_MODIFIED_AFTER,D101_SUCCESSOR_ADDED}from'./proposals/d090/foundation-routing-contract-pipes-v2.mjs';
import{assertInheritedDomains}from'./proposals/d090/inherited-test-contract-pipes-v2.mjs';
import{assertInheritedWorkflowSet}from'./tools/d090-validation-pipes-v2.mjs';
import{D101_MANIFEST_SHA,d101PriorInventory,d084PriorInventory}from'./tools/d101-source.mjs';
import fs from'node:fs';
const files=fs.readdirSync('src',{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>e.parentPath+'/'+e.name).sort(),read=f=>fs.readFileSync(f,'utf8');
const r={lineageCopies:assertPipesValidationLineage().copies.length,routingCurrent:assertFoundationRouting().current.length,domainAdditions:assertInheritedDomains().currentAdditions.length,inheritedWorkflows:assertInheritedWorkflowSet().workflows.length,frozenCurrent:Object.keys(assertFrozenCurrentSource()).length,d101Prior:d101PriorInventory(files,read).length,d084Prior:d084PriorInventory(files,read).length,D101_MANIFEST_SHA,D101_MODIFIED_AFTER,D101_SUCCESSOR_ADDED};
console.log(JSON.stringify(r));`;

function verifyWritten() {
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', VERIFY], {cwd: ROOT, encoding: 'utf8', maxBuffer: 16e6}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'), refreeze = process.argv.includes('--refreeze');
  for (const arg of process.argv.slice(2)) assert.ok(['--check', '--refreeze'].includes(arg), 'unknown argument ' + arg);
  assert.ok(!(check && refreeze), '--check never writes');
  try {
    const candidate = d101Candidate();
    const before = Object.fromEntries(Object.keys(candidate.files).map(file => { const have = readMaybe(file); return [file, have === null ? null : sha(have)]; }));
    let action, written = [];
    if (check) {
      d101AssertOnDisk(candidate.files);
      action = 'checked';
    } else {
      const plan = d101WritePlan(candidate, {refreeze});
      writeCandidate(candidate, plan);
      action = plan.lease;
      written = [...(plan.leaseWrite ? D101_LEASE_FILES : []), ...plan.writes];
    }
    console.log(JSON.stringify({baseline: D101_BASELINE, lease: {action, manifestSha256: candidate.fresh.digest}, written, before, after: candidate.log, counts: candidate.counts, verified: verifyWritten()}, null, 2));
  } catch (e) {
    if (!(e instanceof D101ChainRefusal)) throw e;
    console.error('D101 chain refused: ' + e.message);
    process.exitCode = 1;
  }
}
