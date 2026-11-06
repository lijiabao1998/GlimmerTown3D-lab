// D104 schedules complete original exports; no historical assertion is rewritten.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha = value => createHash('sha256').update(value).digest('hex');
export const SMOKE_SHA256 = 'f404cd546f11f6554f23ab8bc7b9acbbeeefa1c7c7531d40bf6d4c2e750a8298';
export const PRELOAD = '--import ./tools/d104-smoke-entry.mjs';
const names = ['d054Smoke','d053Smoke','d011Smoke','d014Smoke','d015Smoke','d016Smoke','d013Smoke',
  'd019Smoke','d020Smoke','d021Smoke','d022Smoke','d025Smoke','d026Smoke','d027Smoke','d028Smoke',
  'd029Smoke','d030Smoke','d031Smoke','d032Smoke','d033Smoke','d034Smoke','d035Smoke','d036Smoke',
  'd038Smoke','d039Smoke','d040Smoke','d044Smoke','d045Smoke','d046Smoke','d047ArtSmoke',
  'd047MobileSmoke','d048Smoke','d049Smoke','d050Smoke','d056DialogGoldens','d051Smoke','d052Smoke'];
const fileFor = name => name === 'd056DialogGoldens' ? 'tools/d056-dialog-goldens.mjs'
  : name === 'd053Smoke' ? 'tools/smoke-d053-d090-pipes-v2.mjs'
  : name === 'd047ArtSmoke' ? 'tools/smoke-d047-art.mjs'
  : name === 'd047MobileSmoke' ? 'tools/smoke-d047-mobile.mjs'
  : 'tools/smoke-' + name.slice(0, 4) + '.mjs';
export const UNITS = Object.freeze([
  ...names.slice(0, 2).map(id => Object.freeze({id, kind:'export', file:fileFor(id)})),
  Object.freeze({id:'core', kind:'core', file:'tools/smoke.mjs'}),
  ...names.slice(2).map(id => Object.freeze({id, kind:'export', file:fileFor(id),
    ...(id === 'd051Smoke' ? {postGuard:'d051ImportImageGuard'} : {})})),
  Object.freeze({id:'d058Capture', kind:'capture', file:'tools/d058-capture.mjs'}),
]);
export const SHARDS = Object.freeze([
  ['core','d011Smoke','d014Smoke','d015Smoke','d016Smoke','d013Smoke'],
  ['d054Smoke'], ['d053Smoke'],
  ['d019Smoke','d020Smoke','d021Smoke','d022Smoke','d025Smoke','d026Smoke','d027Smoke','d028Smoke','d029Smoke','d030Smoke','d031Smoke','d032Smoke'],
  ['d033Smoke','d034Smoke','d035Smoke','d036Smoke','d038Smoke','d039Smoke','d040Smoke'],
  ['d044Smoke','d045Smoke','d046Smoke','d047ArtSmoke','d047MobileSmoke','d048Smoke'],
  ['d049Smoke','d050Smoke','d056DialogGoldens','d051Smoke','d052Smoke'],
  ['d058Capture'],
].map(row => Object.freeze(row)));
export const PLAN_SHA256 = sha(JSON.stringify({schema:1, smokeSha256:SMOKE_SHA256, units:UNITS, shards:SHARDS}));
export const DRIVER_FILES = Object.freeze(['tools/d104-smoke-contract.mjs','tools/d104-smoke-entry.mjs',
  'tools/d104-smoke-runner.mjs','tools/d104-smoke-verify.mjs']);
export const SOURCE_FILES = Object.freeze([...new Set([
  ...DRIVER_FILES, 'tools/smoke.mjs','tools/cdp.mjs', ...UNITS.map(unit => unit.file),
])].sort());
const CORE_OPEN = 'await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {';
const CORE_CLOSE = '\n});\n\n// ===== D011：';
const PRELUDE_END = '// D054 new native acceptance runs first; all original suites and gates remain intact.';
const TAIL_OPEN = 'const sec = ((Date.now() - t0) / 1000).toFixed(1);';
function once(source, text) {
  const at = source.indexOf(text);
  assert.ok(at >= 0 && source.indexOf(text, at + 1) === -1, 'unique source boundary: ' + text);
  return at;
}
export function validatePlan(shards = SHARDS) {
  assert.equal(shards.length, 8, 'exactly eight smoke shards');
  const all = shards.flat();
  assert.equal(all.length, 39); assert.equal(new Set(all).size, 39, 'no duplicate smoke units');
  assert.deepEqual([...all].sort(), UNITS.map(unit => unit.id).sort(), 'complete original smoke unit union');
  const dialog = shards.find(row => row.includes('d056DialogGoldens'));
  assert.deepEqual(dialog.filter(id => ['d049Smoke','d050Smoke','d056DialogGoldens','d051Smoke'].includes(id)),
    ['d049Smoke','d050Smoke','d056DialogGoldens','d051Smoke'], 'ordered PNG dependency chain stays together');
  for (const row of shards) {
    const positions = row.map(id => UNITS.findIndex(unit => unit.id === id));
    assert.deepEqual(positions, [...positions].sort((a,b) => a-b), 'original relative order within each shard');
  }
  return true;
}
export function validateSmokeSource(source = fs.readFileSync(path.join(ROOT, 'tools/smoke.mjs'), 'utf8')) {
  assert.equal(sha(source), SMOKE_SHA256, 'complete original smoke source is byte-pinned');
  assert.deepEqual([...source.matchAll(/await (d\d+(?:Art|Mobile)?Smoke|d056DialogGoldens)\(/g)].map(m => m[1]), names);
  assert.equal(source.split('d051ImportImageGuard(log);').length, 2, 'one post-D051 PNG guard');
  assert.equal(source.split("await import('./d058-capture.mjs')").length, 2, 'one native D058 capture');
  once(source, CORE_OPEN); once(source, CORE_CLOSE); once(source, PRELUDE_END); once(source, TAIL_OPEN);
  assert.ok(source.includes("open:q=>open(q+(q?'&':'')+'streetArt=legacy')"));
  validatePlan();
  return source;
}
export function coreSource(source = validateSmokeSource()) {
  validateSmokeSource(source);
  return source.slice(0, once(source, PRELUDE_END))
    + source.slice(once(source, CORE_OPEN), once(source, CORE_CLOSE) + '\n});'.length) + '\n'
    + source.slice(once(source, TAIL_OPEN));
}
// Only module specifiers change so the exact core assertion body can live in scratch/.
// Every replacement is recorded and reversible; the complete original remains on disk.
export function executableCore(source = validateSmokeSource(), repo = ROOT) {
  const canonical = coreSource(source), substitutions = [];
  const replace = (whole, prefix, quote, relative, suffix = '') => {
    const absolute = pathToFileURL(path.resolve(repo, 'tools', relative)).href;
    const after = prefix + quote + absolute + quote + suffix;
    substitutions.push({before:whole, after}); return after;
  };
  let executable = canonical.replace(/(\bfrom\s*)(['"])(\.[^'"]+)\2/g, (whole,p,q,r) => replace(whole,p,q,r));
  executable = executable.replace(/(\bimport\()(['"])(\.[^'"]+)\2(\))/g, (whole,p,q,r,s) => replace(whole,p,q,r,s));
  let restored = executable;
  for (const item of [...substitutions].reverse()) {
    assert.equal(restored.split(item.after).length, 2, 'one reversible import substitution');
    restored = restored.replace(item.after, () => item.before);
  }
  assert.equal(restored, canonical, 'no core assertion edits');
  return {canonical, executable, canonicalSha256:sha(canonical), substitutions};
}
export function blankCheckSource(source = validateSmokeSource()) {
  const match = /const blankCheck = (`[\s\S]*?`);\r?\n/.exec(source);
  assert.ok(match); return match[1].slice(1, -1);
}
export function consumeSelection(env, entry, cwd = process.cwd()) {
  if (env.D104_SMOKE_SHARD === undefined) return null;
  assert.match(env.D104_SMOKE_SHARD, /^[0-7]$/, 'unknown smoke shard');
  assert.equal(path.resolve(cwd, entry ?? ''), path.join(ROOT, 'tools/smoke.mjs'), 'preload only intercepts the real smoke entry');
  assert.equal(env.NODE_OPTIONS?.trim(), PRELOAD, 'only this smoke-step preload may be consumed');
  for (const [key,value] of Object.entries(env)) if (/^D\d+_SMOKE_ONLY$/.test(key)) assert.ok(!value, 'partial smoke flag prohibited: ' + key);
  const shard = Number(env.D104_SMOKE_SHARD);
  delete env.D104_SMOKE_SHARD; delete env.NODE_OPTIONS;
  return shard;
}
export function assertReceipt(receipt, expected) {
  assert.equal(receipt.schema, 'd104-smoke-shard-v1');
  assert.ok(Number.isInteger(receipt.shard) && receipt.shard >= 0 && receipt.shard < 8);
  assert.equal(receipt.status, 'passed'); assert.equal(receipt.complete, true);
  assert.equal(receipt.planSha256, PLAN_SHA256); assert.equal(receipt.smokeSha256, SMOKE_SHA256);
  assert.equal(receipt.identity.sourceCommit, expected.sourceCommit);
  assert.equal(receipt.identity.sourceTree, expected.sourceTree);
  assert.equal(receipt.identity.repository, expected.repository);
  assert.equal(receipt.identity.runId, expected.runId);
  assert.equal(receipt.identity.event, expected.event);
  assert.ok(Number.isInteger(receipt.identity.attempt) && receipt.identity.attempt >= 1 && receipt.identity.attempt <= expected.attempt);
  for (const field of ['htmlSha256','buildDigest','buildArtifactId']) assert.equal(receipt.identity[field], expected[field], field);
  assert.deepEqual(receipt.sourceHashes, expected.sourceHashes, 'executed source identity');
  assert.deepEqual(receipt.expectedUnits, SHARDS[receipt.shard]);
  assert.deepEqual(receipt.executedUnits, SHARDS[receipt.shard], 'actual invocation list must be complete');
  assert.deepEqual(receipt.units.map(unit => unit.id), SHARDS[receipt.shard], 'missing/extra/reordered unit receipt');
  assert.deepEqual(receipt.partialFlags, []); assert.deepEqual(receipt.errors, []);
  for (const unit of receipt.units) {
    assert.equal(unit.status, 'passed', unit.id); assert.equal(unit.invocations, 1);
    assert.equal(unit.exitCode, 0); assert.equal(unit.failedChecks, 0);
    assert.ok(unit.checks > 0); assert.ok(Number.isFinite(unit.elapsedMs) && unit.elapsedMs >= 0);
    assert.ok(!unit.error && !unit.signal);
    assert.deepEqual(unit.postGuards, unit.id === 'd051Smoke' ? ['d051ImportImageGuard'] : []);
    if (unit.id === 'core') assert.equal(unit.coreSha256, sha(coreSource()));
  }
  assert.ok(Array.isArray(receipt.artifacts) && receipt.artifacts.length > 0);
  assert.equal(new Set(receipt.artifacts.map(a => a.path)).size, receipt.artifacts.length);
  for (const artifact of receipt.artifacts) {
    assert.ok(typeof artifact.path === 'string' && !path.isAbsolute(artifact.path)
      && !/^(?:[A-Za-z]:|[\\/])/.test(artifact.path) && !artifact.path.includes('\0')
      && !artifact.path.split(/[\\/]/).includes('..'));
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/); assert.ok(Number.isInteger(artifact.bytes) && artifact.bytes >= 0);
  }
  return receipt;
}
export function selectReceipts(receipts, expected) {
  const seen = new Set(), selected = new Map();
  for (const receipt of receipts) {
    assert.equal(receipt.schema, 'd104-smoke-shard-v1');
    assert.ok(Number.isInteger(receipt.shard) && receipt.shard >= 0 && receipt.shard < 8);
    assert.equal(receipt.identity.sourceCommit, expected.sourceCommit); assert.equal(receipt.identity.runId, expected.runId);
    assert.equal(receipt.identity.repository, expected.repository);
    const attempt = receipt.identity.attempt;
    assert.ok(Number.isInteger(attempt) && attempt >= 1 && attempt <= expected.attempt, 'invalid/future artifact attempt');
    const key = receipt.shard + ':' + attempt; assert.ok(!seen.has(key), 'duplicate shard/attempt receipt'); seen.add(key);
    if (!selected.has(receipt.shard) || selected.get(receipt.shard).identity.attempt < attempt) selected.set(receipt.shard, receipt);
  }
  assert.equal(selected.size, 8, 'all eight smoke shards required');
  return SHARDS.map((_, shard) => assertReceipt(selected.get(shard), expected));
}
