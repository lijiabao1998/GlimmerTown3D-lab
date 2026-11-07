// D104 schedules unchanged historical guard exports on independent CI runners.
// Inline checks stay in the byte-pinned unit.mjs and run on every shard.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const HISTORICAL_SHARD_ENV = 'D104_HISTORICAL_SHARD';
export const HISTORICAL_SHARD_COUNT = 8;
export const HISTORICAL_INLINE = 'unit.mjs:inline';
export const HISTORICAL_SHARD_SOURCES = Object.freeze(['tools/unit.mjs', 'tools/unit-partitions.mjs', 'tools/d104-historical-shards.mjs']);
const sha = value => createHash('sha256').update(value).digest('hex');
const key = ([file, fn]) => file + ':' + fn;

// Fixed LPT assignment from the 120 START intervals of the unchanged historical
// job in run 42183517449 / job 127779308096. The three largest frame exports run
// alone; each other bucket is restored to registration order. These old timing
// estimates are scheduling inputs, not new performance measurements or limits.
export const HISTORICAL_SHARDS = Object.freeze([
  ['./unit-d077-frame.mjs:d077FrameGuards'],
  ['./unit-d074-frame.mjs:d074FrameGuards'],
  ['./unit-d076-frame.mjs:d076FrameGuards'],
  [
    './unit-d010-fields.mjs:d010FieldGuards',
    './unit-d010-sim.mjs:d010SimGuards',
    './unit-d019.mjs:d019Guards',
    './unit-d025.mjs:d025Guards',
    './unit-d031.mjs:d031Guards',
    './unit-d029-live.mjs:d029LiveGuards',
    './unit-d031-live.mjs:d031LiveGuards',
    './unit-d036.mjs:d036Guards',
    './unit-d038.mjs:d038Guards',
    './unit-d044.mjs:d044Guards',
    './unit-d040.mjs:d040Guards',
    './unit-d043.mjs:d043Guards',
    './unit-d047.mjs:d047Guards',
    './unit-d052.mjs:d052Guards',
    './unit-d056.mjs:d056Guards',
    './unit-d059.mjs:d059Guards',
    './unit-d060.mjs:d060Guards',
    './unit-d069-frame.mjs:d069FrameGuards',
    './unit-d070-frame.mjs:d070FrameGuards',
    './unit-d074.mjs:d074Guards',
    './unit-d074-touch-repair.mjs:d074TouchRepairGuards',
    './unit-d082-release-v2.mjs:d082Guards',
    './unit-evidence.mjs:evidenceImageGuards',
  ],
  [
    './unit-d011-build.mjs:d011BuildGuards',
    './unit-d012.mjs:d012LookGuards',
    './unit-d014.mjs:d014Guards',
    './unit-d016-build.mjs:d016BuildGuards',
    './unit-d018.mjs:d018Guards',
    './unit-d024.mjs:d024Guards',
    './unit-d025-live.mjs:d025LiveGuards',
    './unit-d026-live.mjs:d026LiveGuards',
    './unit-d032.mjs:d032Guards',
    './unit-d027-live.mjs:d027LiveGuards',
    './unit-d028-live.mjs:d028LiveGuards',
    './unit-d033-build.mjs:d033BuildGuards',
    './unit-d034.mjs:d034Guards',
    './unit-d037.mjs:d037Guards',
    './unit-d041.mjs:d041Guards',
    './unit-d046-fallback.mjs:d046FallbackGuards',
    './unit-d055-native.mjs:d055NativeGuards',
    './unit-d062.mjs:d062Guards',
    './unit-d066.mjs:d066Guards',
    './unit-d070.mjs:d070Guards',
    './unit-d073-frame.mjs:d073FrameGuards',
    './unit-d077.mjs:d077Guards',
  ],
  [
    './unit-d019-build.mjs:d019BuildGuards',
    './unit-d020.mjs:d020Guards',
    './unit-d021.mjs:d021Guards',
    './unit-d026.mjs:d026Guards',
    './unit-d028.mjs:d028Guards',
    './unit-d029.mjs:d029Guards',
    './unit-d030-live.mjs:d030LiveGuards',
    './unit-d033-live.mjs:d033LiveGuards',
    './unit-d035.mjs:d035Guards',
    './unit-d044-build.mjs:d044BuildGuards',
    './unit-d045-live.mjs:d045LiveGuards',
    './unit-d045-wire.mjs:d045WireGuards',
    './unit-d047-mobile.mjs:d047MobileUnit',
    './unit-d048.mjs:d048Guards',
    './unit-d050.mjs:d050Guards',
    './unit-d051.mjs:d051Guards',
    './unit-d057.mjs:d057Guards',
    './unit-d061.mjs:d061Guards',
    './unit-d068-frame.mjs:d068FrameGuards',
    './unit-d069.mjs:d069Guards',
    './d081-touch-lease-scope.mjs:d081TouchLeaseScopeGuards',
    './unit-d081-touch-lease.mjs:d081TouchLeaseGuards',
    './d074-touch-repair-scope.mjs:d074TouchRepairScopeGuards',
    './unit-d078.mjs:d078Guards',
    './unit-d080.mjs:d080Guards',
  ],
  [
    './unit-d011-edit.mjs:d011EditGuards',
    './unit-d011-parity.mjs:d011ParityGuards',
    './unit-d017.mjs:d017Guards',
    './unit-d020-parity.mjs:d020ParityGuards',
    './unit-d023.mjs:d023Guards',
    './unit-d030.mjs:d030Guards',
    './unit-d034-live.mjs:d034LiveGuards',
    './unit-d036-live.mjs:d036LiveGuards',
    './unit-d045.mjs:d045Guards',
    './unit-d039.mjs:d039Guards',
    './unit-d046.mjs:d046Guards',
    './unit-d046-history.mjs:d046HistoryGuards',
    './unit-d053.mjs:d053Guards',
    './unit-d054.mjs:d054Guards',
    './unit-d055-build.mjs:d055BuildGuards',
    './unit-d058.mjs:d058Guards',
    './unit-d063.mjs:d063Guards',
    './unit-d065.mjs:d065Guards',
    './unit-d071.mjs:d071Guards',
    './unit-d071-frame.mjs:d071FrameGuards',
    './unit-d072.mjs:d072Guards',
    './unit-d072-frame.mjs:d072FrameGuards',
  ],
  [
    './unit-d011-money.mjs:d011MoneyGuards',
    './unit-d015.mjs:d015Guards',
    './unit-d016-parity.mjs:d016ParityGuards',
    './unit-d013.mjs:d013Guards',
    './unit-d019-parity.mjs:d019ParityGuards',
    './unit-d020-build.mjs:d020BuildGuards',
    './unit-d022.mjs:d022Guards',
    './unit-d027.mjs:d027Guards',
    './unit-d032-live.mjs:d032LiveGuards',
    './unit-d033.mjs:d033Guards',
    './unit-d038-live.mjs:d038LiveGuards',
    './unit-d040-build.mjs:d040BuildGuards',
    './unit-d042.mjs:d042Guards',
    './unit-d046-save.mjs:d046SaveGuards',
    './unit-d048-harness.mjs:d048HarnessGuards',
    './unit-d049.mjs:d049Guards',
    './unit-d054-ui.mjs:d054UiGuards',
    './unit-d064.mjs:d064Guards',
    './unit-d067.mjs:d067Guards',
    './unit-d067-frame.mjs:d067FrameGuards',
    './unit-d068.mjs:d068Guards',
    './unit-d073.mjs:d073Guards',
    './unit-d076.mjs:d076Guards',
    './unit-d079.mjs:d079Guards',
    './unit-d081.mjs:d081Guards',
  ],
].map(Object.freeze));

export function historicalShardIndex(value) {
  assert.ok(typeof value === 'string' && /^[0-7]$/.test(value), 'D104 historical shard must be exactly 0..7');
  return Number(value);
}

export function historicalShardPlan(inventory) {
  assert.ok(Array.isArray(inventory), 'historical inventory must be an array');
  assert.equal(inventory[0], HISTORICAL_INLINE, 'inline prelude must remain first');
  assert.equal(inventory.length, 121, 'D104 requires all 120 historical exports and the inline prelude');
  assert.equal(new Set(inventory).size, inventory.length, 'historical inventory contains duplicate guards');
  const guards = inventory.slice(1);
  assert.ok(guards.every(id => typeof id === 'string' && /^\.\/[\w.-]+\.mjs:[A-Za-z][\w]*$/.test(id)), 'malformed historical guard identity');
  assert.equal(HISTORICAL_SHARDS.length, HISTORICAL_SHARD_COUNT, 'eight fixed shard assignments required');
  const scheduled = HISTORICAL_SHARDS.flat();
  assert.equal(new Set(scheduled).size, 120, 'fixed shard assignment contains duplicates');
  assert.deepEqual([...scheduled].sort(), [...guards].sort(), 'fixed shard assignment must cover exactly the historical exports');
  for (const bucket of HISTORICAL_SHARDS) assert.deepEqual(bucket, guards.filter(id => bucket.includes(id)), 'shard assignment must retain original registration order');
  const inventorySha256 = sha(JSON.stringify(inventory));
  return HISTORICAL_SHARDS.map((bucket, index) => ({
    schema:1, index, count:HISTORICAL_SHARD_COUNT, partition:'historical', inventorySha256,
    selected:[...bucket],
    inline:{identity:HISTORICAL_INLINE, policy:'unchanged common prelude runs on every shard; not part of the disjoint 120 exports'},
  }));
}

// Consume before any selected guard imports/spawns a historical child process.
// Child processes and later selections retain their original full behavior.
export function consumeHistoricalShard(partition, inventory, env = process.env) {
  if (!Object.hasOwn(env, HISTORICAL_SHARD_ENV)) return null;
  const raw = env[HISTORICAL_SHARD_ENV];
  delete env[HISTORICAL_SHARD_ENV];
  assert.equal(partition, 'historical', 'D104 sharding is only allowed for the historical partition');
  const index = historicalShardIndex(raw);
  return historicalShardPlan(inventory)[index];
}

export function historicalShardReceiptPath(index, root = process.cwd()) {
  historicalShardIndex(String(index));
  return path.join(root, 'scratch', 'd104-historical-shards', 'shard-' + index, 'receipt.json');
}

function actualIdentity(root, env) {
  const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8', windowsHide:true, maxBuffer:4e6}).trim();
  return {commit:git('rev-parse', 'HEAD'), tree:git('rev-parse', 'HEAD^{tree}'),
    trackedChanges:git('status', '--porcelain=v1', '--untracked-files=no') || null,
    sources:HISTORICAL_SHARD_SOURCES.map(file => ({path:file, sha256:sha(fs.readFileSync(path.join(root, file)))})),
    repository:env.GITHUB_REPOSITORY ?? null, runId:env.GITHUB_RUN_ID ?? null,
    attempt:env.GITHUB_RUN_ATTEMPT ? Number(env.GITHUB_RUN_ATTEMPT) : null,
    event:env.GITHUB_EVENT_NAME ?? 'local', workflowSha:env.GITHUB_SHA ?? null};
}

export function makeHistoricalShardReceipt(plan, registrations, visited, selected, identity) {
  const all = registrations.map(key);
  assert.equal(all.length, 125, 'all 125 original registration calls must remain');
  assert.equal(new Set(all).size, all.length, 'duplicate original registration');
  assert.deepEqual(visited, all, 'actual registration visits are missing, duplicated, or reordered');
  assert.deepEqual(selected, plan.selected, 'actual selected exports differ from the shard plan');
  return {...plan, inline:{...plan.inline}, selectionComplete:true, visited:[...visited], selected:[...selected], identity:structuredClone(identity),
    qualification:'Registration traversal and selection receipt only. Guard success requires the unchanged unit.mjs exit code and successful CI job; this receipt does not assert tests passed.'};
}

export function writeHistoricalShardReceipt(plan, registrations, visited, selected, {root = process.cwd(), env = process.env} = {}) {
  const receipt = makeHistoricalShardReceipt(plan, registrations, visited, selected, actualIdentity(root, env));
  const file = historicalShardReceiptPath(plan.index, root);
  fs.mkdirSync(path.dirname(file), {recursive:true});
  // Never silently replace evidence from another execution in this worktree.
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n', {flag:'wx'});
  return receipt;
}

export function verifyHistoricalShardReceipts(receipts, inventory, registrations, expectedIdentity = {}) {
  const plans = historicalShardPlan(inventory);
  assert.ok(Array.isArray(receipts));
  assert.ok(receipts.length >= HISTORICAL_SHARD_COUNT, 'all eight shard receipts are required');
  const latest = new Map(), attempts = new Set();
  const {maxAttempt, ...expectedFields} = expectedIdentity;
  if (maxAttempt !== undefined) assert.ok(Number.isSafeInteger(maxAttempt) && maxAttempt > 0, 'current CI attempt must be a positive integer');
  for (const receipt of receipts) {
    const index = historicalShardIndex(String(receipt.index)), plan = plans[index];
    for (const field of ['schema','index','count','partition','inventorySha256']) assert.equal(receipt[field], plan[field], 'wrong shard ' + field);
    assert.equal(receipt.selectionComplete, true, 'shard selection never finished');
    assert.deepEqual(receipt.inline, plan.inline, 'inline prelude policy changed');
    makeHistoricalShardReceipt(plan, registrations, receipt.visited, receipt.selected, receipt.identity);
    assert.ok(receipt.identity && typeof receipt.identity === 'object', 'source identity required');
    for (const field of ['commit','tree']) assert.match(receipt.identity[field] ?? '', /^[a-f0-9]{40}$/, 'real Git ' + field + ' required');
    assert.equal(receipt.identity.trackedChanges, null, 'tracked source changed during execution');
    assert.deepEqual(receipt.identity.sources?.map(s => s.path), HISTORICAL_SHARD_SOURCES, 'all scheduling source hashes are required');
    for (const source of receipt.identity.sources) assert.match(source.sha256 ?? '', /^[a-f0-9]{64}$/, 'source SHA256 required');
    const attempt = receipt.identity.attempt;
    assert.ok(attempt === null || (Number.isSafeInteger(attempt) && attempt > 0), 'receipt attempt must be null locally or a positive integer');
    if (maxAttempt !== undefined) assert.ok(attempt !== null && attempt <= maxAttempt, 'receipt attempt exceeds current CI attempt or is missing');
    for (const [field, value] of Object.entries(expectedFields)) assert.deepEqual(receipt.identity[field], value, 'wrong shard identity ' + field);
    for (const field of ['commit','tree','sources','repository','runId','event','workflowSha']) assert.deepEqual(receipt.identity[field], receipts[0].identity[field], 'mixed shard identities: ' + field);
    const attemptKey = index + ':' + attempt;
    assert.ok(!attempts.has(attemptKey), 'duplicate shard receipt for the same attempt');
    attempts.add(attemptKey);
    if (!latest.has(index) || (attempt ?? 0) > (latest.get(index).identity.attempt ?? 0)) latest.set(index, receipt);
  }
  assert.equal(latest.size, HISTORICAL_SHARD_COUNT, 'all eight distinct shard receipts are required');
  const chosen = [...latest.values()].sort((a, b) => a.index - b.index), selected = chosen.flatMap(r => r.selected);
  assert.equal(selected.length, 120, 'historical export count changed');
  assert.equal(new Set(selected).size, 120, 'an export was selected on multiple shards');
  assert.deepEqual([...selected].sort(), inventory.slice(1).sort(), 'historical coverage has omissions or extra exports');
  return {selectionCoverageComplete:true, shards:HISTORICAL_SHARD_COUNT, exports:120,
    receiptsConsidered:receipts.length, selectedAttempts:chosen.map(r => ({index:r.index, attempt:r.identity.attempt})),
    inline:'The unchanged inline prelude runs on all eight shards.',
    qualification:'Coverage only; require every original unit process and matrix job to succeed separately.'};
}

function findReceipts(dir) {
  assert.ok(fs.lstatSync(dir).isDirectory(), 'receipt root must be a directory');
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'receipt symlinks are not allowed');
    if (entry.isDirectory()) return findReceipts(file);
    // Other historical evidence can also be called receipt.json. Only this
    // fixed namespace belongs to the shard gate; retain each artifact folder.
    if (entry.name !== 'receipt.json' || path.basename(path.dirname(dir)) !== 'd104-historical-shards') return [];
    const match = /^shard-(\d+)$/.exec(path.basename(dir));
    assert.ok(match, 'unexpected shard receipt directory');
    const index = historicalShardIndex(match[1]), receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(receipt.index, index, 'receipt index differs from its artifact path');
    return [receipt];
  });
}

async function main() {
  const {partitionInventory, UNIT_GUARDS} = await import('./unit-partitions.mjs');
  const [command, directory, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0, 'unexpected D104 arguments');
  if (command === 'plan') {
    assert.equal(directory, undefined, 'plan has no arguments');
    console.log(JSON.stringify({matrix:{shard:historicalShardPlan(partitionInventory('historical')).map(p => p.index)},
      receiptRoot:'scratch/d104-historical-shards', plans:historicalShardPlan(partitionInventory('historical'))}, null, 2));
  } else if (command === 'verify') {
    assert.ok(directory, 'provide the directory containing all eight shard receipts');
    const identity = actualIdentity(process.cwd(), process.env);
    assert.equal(identity.trackedChanges, null, 'verifier checkout must have unchanged tracked source');
    const expected = {commit:identity.commit, tree:identity.tree, sources:identity.sources};
    if (process.env.GITHUB_ACTIONS === 'true') {
      assert.equal(identity.commit, identity.workflowSha, 'verifier checkout must match the workflow SHA');
      for (const field of ['repository','runId','event','workflowSha']) { assert.ok(identity[field], 'CI identity ' + field + ' required'); expected[field] = identity[field]; }
      expected.maxAttempt = identity.attempt;
    }
    console.log(JSON.stringify(verifyHistoricalShardReceipts(findReceipts(path.resolve(directory)), partitionInventory('historical'), UNIT_GUARDS, expected), null, 2));
  } else throw new Error('Expected plan or verify <receipt-directory>');
}
// Do not top-level-await this import: unit-partitions imports this module too.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
