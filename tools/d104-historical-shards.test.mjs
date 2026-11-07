// Scheduling/receipt fixtures only. Never import or execute historical guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {UNIT_GUARDS, PARTITIONS, partitionInventory, parsePartition, createGuardSelection} from './unit-partitions.mjs';
import {
  HISTORICAL_SHARD_ENV, HISTORICAL_SHARD_COUNT, HISTORICAL_INLINE,
  HISTORICAL_SHARDS, HISTORICAL_SHARD_SOURCES, historicalShardIndex,
  historicalShardPlan, consumeHistoricalShard, historicalShardReceiptPath,
  makeHistoricalShardReceipt, verifyHistoricalShardReceipts,
} from './d104-historical-shards.mjs';

const inventory = partitionInventory('historical'), visited = UNIT_GUARDS.map(row => row.join(':'));
const plans = historicalShardPlan(inventory), clone = value => structuredClone(value);
const fixtureIdentity = {
  commit:'a'.repeat(40), tree:'b'.repeat(40), trackedChanges:null,
  sources:HISTORICAL_SHARD_SOURCES.map(file => ({path:file, sha256:'c'.repeat(64)})),
  repository:'fixture/repository', runId:'123', attempt:1, event:'pull_request', workflowSha:'a'.repeat(40),
};
const receipts = () => plans.map(plan => makeHistoricalShardReceipt(plan, UNIT_GUARDS, visited, plan.selected, clone(fixtureIdentity)));
function withShard(value, run) {
  const existed = Object.hasOwn(process.env, HISTORICAL_SHARD_ENV), saved = process.env[HISTORICAL_SHARD_ENV];
  if (value === undefined) delete process.env[HISTORICAL_SHARD_ENV]; else process.env[HISTORICAL_SHARD_ENV] = value;
  try { return run(); } finally {
    if (existed) process.env[HISTORICAL_SHARD_ENV] = saved; else delete process.env[HISTORICAL_SHARD_ENV];
  }
}

test('eight fixed shards cover the same 120 exports once, in original order, with the largest three isolated', () => {
  assert.equal(UNIT_GUARDS.length, 125);
  assert.equal(inventory.length, 121);
  assert.equal(plans.length, HISTORICAL_SHARD_COUNT);
  assert.deepEqual(plans.map(p => p.index), [0,1,2,3,4,5,6,7]);
  assert.deepEqual(plans.slice(0,3).map(p => p.selected), [
    ['./unit-d077-frame.mjs:d077FrameGuards'],
    ['./unit-d074-frame.mjs:d074FrameGuards'],
    ['./unit-d076-frame.mjs:d076FrameGuards'],
  ]);
  const selected = plans.flatMap(plan => plan.selected);
  assert.equal(selected.length, 120);
  assert.equal(new Set(selected).size, 120);
  assert.deepEqual([...selected].sort(), inventory.slice(1).sort());
  for (const plan of plans) {
    assert.deepEqual(plan.selected, inventory.filter(id => plan.selected.includes(id)));
    assert.equal(plan.inline.identity, HISTORICAL_INLINE);
    assert.match(plan.inline.policy, /runs on every shard/);
    assert.equal(plan.selected.includes(HISTORICAL_INLINE), false);
  }
  assert.equal(plans[3].selected.includes('./unit-d082-release-v2.mjs:d082Guards'), true);
  assert.ok(Object.isFrozen(HISTORICAL_SHARDS) && HISTORICAL_SHARDS.every(Object.isFrozen));
});

test('plan rejects missing, duplicate, renamed and reordered inventory entries', () => {
  assert.throws(() => historicalShardPlan(inventory.slice(1)), /inline prelude/);
  assert.throws(() => historicalShardPlan(inventory.slice(0,-1)), /120 historical/);
  const duplicate = [...inventory]; duplicate[2] = duplicate[1];
  assert.throws(() => historicalShardPlan(duplicate), /duplicate/);
  const renamed = [...inventory]; renamed[2] += 'Changed';
  assert.throws(() => historicalShardPlan(renamed), /cover exactly/);
  const reordered = [...inventory]; [reordered[1],reordered[2]] = [reordered[2],reordered[1]];
  assert.throws(() => historicalShardPlan(reordered), /original registration order/);
});

test('only exact string shard indices 0..7 are accepted; invalid values are consumed before rejection', () => {
  for (let i = 0; i < 8; i++) {
    assert.equal(historicalShardIndex(String(i)), i);
    const env = {[HISTORICAL_SHARD_ENV]:String(i)};
    assert.deepEqual(consumeHistoricalShard('historical', inventory, env), plans[i]);
    assert.equal(Object.hasOwn(env, HISTORICAL_SHARD_ENV), false);
  }
  for (const value of ['', ' ', ' 1', '1 ', '8', '-1', '01', '1/8', 'all', 1, null, undefined]) {
    const env = {[HISTORICAL_SHARD_ENV]:value};
    assert.throws(() => consumeHistoricalShard('historical', inventory, env), /exactly 0\.\.7/);
    assert.equal(Object.hasOwn(env, HISTORICAL_SHARD_ENV), false);
  }
  for (const partition of ['all', 'd078-frame', 'unknown']) {
    const env = {[HISTORICAL_SHARD_ENV]:'0'};
    assert.throws(() => consumeHistoricalShard(partition, inventory, env), /only allowed/);
    assert.equal(Object.hasOwn(env, HISTORICAL_SHARD_ENV), false);
  }
  assert.equal(consumeHistoricalShard('all', [], {}), null);
});

test('default/full and unsharded historical preserve the original selection and finish contract', () => withShard(undefined, () => {
  assert.equal(parsePartition([]), 'all');
  assert.deepEqual(PARTITIONS, ['all','historical','d078-frame','d079-frame','d080-frame','d081-frame','d082-frame']);
  for (const partition of ['all', 'historical']) {
    const selection = createGuardSelection(partition), chosen = [];
    for (const row of UNIT_GUARDS) if (selection.shouldRun(...row)) chosen.push(row.join(':'));
    assert.deepEqual(chosen, partitionInventory(partition).slice(1));
    selection.finish();
  }
}));

test('createGuardSelection consumes the actual env once, selects the fixed shard and cannot leak it to children', () => {
  for (const plan of plans) withShard(String(plan.index), () => {
    const selection = createGuardSelection('historical'), chosen = [];
    assert.equal(Object.hasOwn(process.env, HISTORICAL_SHARD_ENV), false);
    for (const row of UNIT_GUARDS) if (selection.shouldRun(...row)) chosen.push(row.join(':'));
    assert.deepEqual(chosen, plan.selected);
    // No finish here: the real writer is exercised in an isolated Git fixture below.
    const child = execFileSync(process.execPath, ['-e', 'process.stdout.write(String(Object.hasOwn(process.env,"D104_HISTORICAL_SHARD")))'], {encoding:'utf8', windowsHide:true});
    assert.equal(child, 'false');
    const second = createGuardSelection('historical');
    assert.equal(UNIT_GUARDS.filter(row => second.shouldRun(...row)).length, 120);
    second.finish();
  });
  withShard('0', () => {
    assert.throws(() => createGuardSelection('all'), /only allowed/);
    assert.equal(Object.hasOwn(process.env, HISTORICAL_SHARD_ENV), false);
  });
});

test('missing, duplicate, extra and reordered actual visits fail before a receipt can be completed', () => withShard(undefined, () => {
  const selection = createGuardSelection('historical');
  selection.shouldRun(...UNIT_GUARDS[0]);
  assert.throws(() => selection.finish(), /not fully visited/);
  assert.throws(() => selection.shouldRun(...UNIT_GUARDS[0]), /duplicate/);
  for (const bad of [visited.slice(1), [...visited, visited[0]], [...visited].reverse()]) {
    assert.throws(() => makeHistoricalShardReceipt(plans[0], UNIT_GUARDS, bad, plans[0].selected, fixtureIdentity), /actual registration visits/);
  }
  for (const bad of [[], [...plans[0].selected, plans[0].selected[0]]]) {
    assert.throws(() => makeHistoricalShardReceipt(plans[0], UNIT_GUARDS, visited, bad, fixtureIdentity), /actual selected exports/);
  }
}));

test('receipt coverage proves selection only and does not assert original tests passed', () => {
  const rows = receipts(), report = verifyHistoricalShardReceipts(rows, inventory, UNIT_GUARDS, {...fixtureIdentity, maxAttempt:1});
  assert.equal(report.selectionCoverageComplete, true);
  assert.equal(report.exports, 120);
  for (const row of [...rows, report]) assert.equal(Object.hasOwn(row, 'passed'), false);
  assert.match(rows[0].qualification, /does not assert tests passed/);
  assert.match(report.qualification, /every original unit process and matrix job/);
});

test('coverage rejects missing or duplicate shards and every visit/selection mutation', () => {
  assert.throws(() => verifyHistoricalShardReceipts(receipts().slice(1), inventory, UNIT_GUARDS), /all eight/);
  assert.throws(() => verifyHistoricalShardReceipts([...receipts(), receipts()[0]], inventory, UNIT_GUARDS), /same attempt/);
  const noSeven = receipts(); noSeven[7] = {...noSeven[0], identity:{...fixtureIdentity, attempt:2}};
  assert.throws(() => verifyHistoricalShardReceipts(noSeven, inventory, UNIT_GUARDS), /all eight distinct/);
  for (const change of [
    r => r.selected.pop(), r => r.selected.push(r.selected[0]), r => r.selected.reverse(),
    r => r.visited.pop(), r => r.visited.push(r.visited[0]), r => r.visited.reverse(),
    r => { r.selectionComplete = false; }, r => { r.inventorySha256 = '0'.repeat(64); },
    r => { r.index = 8; }, r => { r.inline.policy = 'skipped'; },
  ]) {
    const rows = receipts(); change(rows[3]);
    assert.throws(() => verifyHistoricalShardReceipts(rows, inventory, UNIT_GUARDS));
  }
});

test('all candidate identities must match; stale, dirty, missing-hash and future attempts fail closed', () => {
  for (const change of [
    r => { r.identity.commit = 'd'.repeat(40); }, r => { r.identity.tree = 'd'.repeat(40); },
    r => { r.identity.trackedChanges = ' M source.ts'; }, r => { r.identity.sources.pop(); },
    r => { r.identity.sources[0].sha256 = 'd'.repeat(64); }, r => { r.identity.sources[0].sha256 = ''; },
    r => { r.identity.repository = 'other/repo'; }, r => { r.identity.runId = '124'; },
    r => { r.identity.workflowSha = 'd'.repeat(40); }, r => { r.identity.event = 'push'; },
    r => { r.identity.attempt = 3; }, r => { r.identity.attempt = null; },
    r => { r.identity.attempt = 0; }, r => { r.identity.attempt = 1.5; },
  ]) {
    const rows = receipts(); change(rows[7]);
    assert.throws(() => verifyHistoricalShardReceipts(rows, inventory, UNIT_GUARDS, {...fixtureIdentity, maxAttempt:2}));
  }
});

test('reruns select the highest legitimate attempt per shard and validate older candidates too', () => {
  const rows = receipts();
  const retry = clone(rows[3]); retry.identity.attempt = 2; rows.push(retry);
  const {attempt, ...expected} = fixtureIdentity;
  const report = verifyHistoricalShardReceipts(rows, inventory, UNIT_GUARDS, {...expected, maxAttempt:3});
  assert.equal(report.receiptsConsidered, 9);
  assert.deepEqual(report.selectedAttempts, plans.map(p => ({index:p.index, attempt:p.index === 3 ? 2 : 1})));
  rows[3].visited.pop();
  assert.throws(() => verifyHistoricalShardReceipts(rows, inventory, UNIT_GUARDS, {...expected, maxAttempt:3}), /actual registration visits/);
});

test('finish writes actual visits with real Git and source identity; receipt never replaces the process exit', t => {
  const base = path.resolve(os.tmpdir()), root = fs.mkdtempSync(path.join(base, 'd104-shards-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), base);
    assert.ok(path.basename(root).startsWith('d104-shards-'));
    fs.rmSync(root, {recursive:true, force:true});
  });
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  fs.mkdirSync(path.join(root, 'tools'));
  for (const file of HISTORICAL_SHARD_SOURCES) fs.copyFileSync(path.join(repo, file), path.join(root, file));
  const env = {...process.env};
  for (const name of Object.keys(env)) if (name.startsWith('GITHUB_') || name === HISTORICAL_SHARD_ENV) delete env[name];
  const git = (...args) => execFileSync('git', args, {cwd:root, env, encoding:'utf8', windowsHide:true});
  git('init', '--quiet'); git('config', 'core.autocrlf', 'false'); git('add', 'tools');
  git('-c', 'user.name=D104 Test Fixture', '-c', 'user.email=d104-fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'isolated scheduling fixture');
  const runner = pathToFileURL(path.join(root, 'tools/unit-partitions.mjs')).href;
  const code = `import assert from 'node:assert/strict'; import {UNIT_GUARDS,createGuardSelection} from ${JSON.stringify(runner)};
    for(let i=0;i<8;i++){process.env.D104_HISTORICAL_SHARD=String(i);const s=createGuardSelection('historical');for(const row of UNIT_GUARDS)s.shouldRun(...row);s.finish();}
    assert.equal(Object.hasOwn(process.env,'D104_HISTORICAL_SHARD'),false); process.exit(23);`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {cwd:root, env, encoding:'utf8', windowsHide:true});
  assert.equal(child.status, 23, child.stderr);
  const rows = plans.map(plan => JSON.parse(fs.readFileSync(historicalShardReceiptPath(plan.index, root), 'utf8')));
  for (const row of rows) {
    assert.deepEqual(row.visited, visited);
    assert.deepEqual(row.selected, plans[row.index].selected);
    assert.equal(row.identity.commit, git('rev-parse', 'HEAD').trim());
    assert.equal(row.identity.tree, git('rev-parse', 'HEAD^{tree}').trim());
    assert.equal(row.identity.trackedChanges, null);
    for (const source of row.identity.sources) assert.equal(source.sha256, createHash('sha256').update(fs.readFileSync(path.join(root, source.path))).digest('hex'));
  }
  assert.equal(verifyHistoricalShardReceipts(rows, inventory, UNIT_GUARDS).selectionCoverageComplete, true);
  const cli = path.join(root, 'tools/d104-historical-shards.mjs');
  fs.mkdirSync(path.join(root, 'scratch/legacy-evidence'));
  fs.writeFileSync(path.join(root, 'scratch/legacy-evidence/receipt.json'), 'unrelated historical evidence is not a shard receipt');
  const report = JSON.parse(execFileSync(process.execPath, [cli, 'verify', 'scratch'], {cwd:root, env, encoding:'utf8', windowsHide:true}));
  assert.equal(report.selectionCoverageComplete, true);
  const duplicate = spawnSync(process.execPath, ['--input-type=module', '-e', code], {cwd:root, env, encoding:'utf8', windowsHide:true});
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /EEXIST/);
  fs.appendFileSync(path.join(root, 'tools/unit-partitions.mjs'), '\n// changed fixture\n');
  const dirty = spawnSync(process.execPath, [cli, 'verify', 'scratch/d104-historical-shards'], {cwd:root, env, encoding:'utf8', windowsHide:true});
  assert.notEqual(dirty.status, 0);
  assert.match(dirty.stderr, /unchanged tracked source/);
});
