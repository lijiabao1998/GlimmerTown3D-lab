import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { UNIT_GUARDS, D078_FRAME, INLINE_SUITE, PARTITIONS, parsePartition, assertGuardInventory, partitionInventory, createGuardSelection } from './unit-partitions.mjs';
import { runFramePartition, frameProvenance } from './unit-partition.mjs';

const source = fs.readFileSync(new URL('./unit.mjs', import.meta.url), 'utf8');
const registered = [...source.matchAll(/^await guard\((['"])([^'"]+)\1, (['"])([^'"]+)\3\);/gm)].map(m => [m[2], m[4]]);
const key = ([file, fn]) => file + ':' + fn;
const mockIdentity = { sha: 'a'.repeat(40), tree: 'b'.repeat(40), repository: 'owner/repo', runId: '123', attempt: 1, event: 'pull_request', sources: [] };
function runnerFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-frame-partition-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, run: options => runFramePartition({ evidenceDir: dir, provenance: () => mockIdentity, ...options }),
    read: name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) };
}

test('explicit inventory equals every original ordered registration, including D078', () => {
  assert.equal(UNIT_GUARDS.length, 115);
  assert.equal(registered.length, 115);
  assertGuardInventory(registered);
  assert.deepEqual(registered.slice(-3), [['./unit-d078.mjs', 'd078Guards'], [...D078_FRAME], ['./unit-evidence.mjs', 'evidenceImageGuards']]);
});

test('historical plus frame is a disjoint, exhaustive partition including all inline checks', () => {
  assert.deepEqual(PARTITIONS, ['all', 'historical', 'd078-frame']);
  const all = partitionInventory('all'), historical = partitionInventory('historical'), frame = partitionInventory('d078-frame');
  assert.equal(all.length, 116);
  assert.equal(historical.length, 115);
  assert.deepEqual(frame, [key(D078_FRAME)]);
  assert.equal(historical[0], INLINE_SUITE);
  assert.ok(historical.includes('./unit-d078.mjs:d078Guards'));
  assert.deepEqual(historical.filter(id => frame.includes(id)), []);
  assert.deepEqual([...historical, ...frame].sort(), [...all].sort());
  assert.equal(new Set([...historical, ...frame]).size, all.length);
});

test('default npm unit is full and explicit full is equivalent', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts.unit, 'node tools/unit.mjs');
  assert.equal(parsePartition([]), 'all');
  assert.equal(parsePartition(['--partition=all']), 'all');
  assert.match(source, /const partition = parsePartition\(process\.argv\.slice\(2\), \['all', 'historical'\]\);/);
  assert.match(source, /if \(!selection\.shouldRun\(file, fn\)\) return;/);
  assert.match(source, /selection\.finish\(\);\nconst sec =/);
});

for (const partition of ['all', 'historical']) {
  test(`${partition} executes exactly its full declared inventory, with no duplicated registrations`, () => {
    const selection = createGuardSelection(partition), ran = [];
    for (const [file, fn] of registered) if (selection.shouldRun(file, fn)) ran.push(key([file, fn]));
    selection.finish();
    assert.deepEqual([INLINE_SUITE, ...ran], partitionInventory(partition));
  });
}

for (const [name, mutate] of [
  ['missing', rows => rows.slice(0, -1)],
  ['extra', rows => [...rows, ['./unit-other.mjs', 'otherGuards']]],
  ['duplicate', rows => [...rows, rows[0]]],
  ['reordered', rows => [rows[1], rows[0], ...rows.slice(2)]],
  ['changed export', rows => [['./unit-d010-fields.mjs', 'wrongGuard'], ...rows.slice(1)]],
  ['missing D078 geometry', rows => rows.filter(([file]) => file !== './unit-d078.mjs')],
  ['missing D078 frame', rows => rows.filter(([file]) => file !== D078_FRAME[0])],
]) {
  test(`inventory rejects ${name}`, () => assert.throws(() => assertGuardInventory(mutate(registered)), /guard (registration|inventory)/));
  test(`live registration tracker rejects ${name}`, () => {
    assert.throws(() => {
      const selection = createGuardSelection('historical');
      for (const row of mutate(registered)) selection.shouldRun(...row);
      selection.finish();
    }, /guard (registration|inventory)/);
  });
}

test('unknown, malformed, duplicate and unsupported partitions are rejected', () => {
  for (const args of [['--partition=unknown'], ['--partition='], ['--partition'], ['historical'], ['--partition=all', '--partition=historical']]) {
    assert.throws(() => parsePartition(args));
  }
  assert.throws(() => partitionInventory('unknown'), /unknown/);
  assert.throws(() => createGuardSelection('d078-frame'), /unsupported/);
  assert.throws(() => parsePartition(['--partition=d078-frame'], ['all', 'historical']), /unsupported/);
});

test('both real CLI entry points fail closed on an unknown partition before executing guards', () => {
  for (const file of ['unit.mjs', 'unit-partition.mjs']) {
    const result = spawnSync(process.execPath, [new URL(file, import.meta.url).pathname, '--partition=unknown'], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown or unsupported unit partition/);
    assert.doesNotMatch(result.stdout, /(?:START|OK|NG)/);
  }
});

test('frame runner imports exactly the original export once and forwards all 34 reports', async t => {
  const f = runnerFixture(t);
  const loads = [], lines = [], reports = Array.from({ length: 34 }, (_, i) => `frame guard ${i + 1}`);
  const code = await f.run({ args: ['--partition=d078-frame'], write: line => lines.push(line), load: async file => {
    loads.push(file);
    return { [D078_FRAME[1]]: async log => { for (const name of reports) log(true, name); return { failed: 0, report: { passed: true, tests: reports, frames: [] } }; } };
  } });
  assert.equal(code, 0);
  assert.deepEqual(loads, [D078_FRAME[0]]);
  assert.equal(lines.filter(line => line.startsWith('  OK ')).length, 34);
  assert.match(lines.at(-1), /OK 綠燈/);
  assert.deepEqual(f.read('D078-frame.json'), { passed: true, tests: reports, frames: [] });
  assert.deepEqual(f.read('provenance.json'), mockIdentity);
  const summary = f.read('summary.json'), bytes = fs.readFileSync(path.join(f.dir, 'D078-frame.json'));
  assert.equal(summary.passed, true);
  assert.equal(summary.tests, 34);
  assert.equal(summary.fullReport.bytes, bytes.length);
  assert.equal(summary.fullReport.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(fs.readFileSync(path.join(f.dir, 'runner.log'), 'utf8'), lines.join('\n') + '\n');
});

for (const [name, load] of [
  ['false report', async () => ({ [D078_FRAME[1]]: log => { log(false, 'original assertion failed'); return { failed: 1, report: { passed: false, tests: [{ passed: false }] } }; } })],
  ['missing export', async () => ({})],
  ['load exception', async () => { throw new Error('import failed'); }],
  ['guard exception', async () => ({ [D078_FRAME[1]]: () => { throw new Error('guard failed'); } })],
]) {
  test(`frame runner propagates ${name} as a nonzero exit`, async t => {
    const f = runnerFixture(t), lines = [];
    assert.equal(await f.run({ load, write: line => lines.push(line) }), 1);
    assert.match(lines.at(-1), /NG 紅燈/);
    assert.doesNotMatch(lines.at(-1), /OK 綠燈/);
    assert.equal(f.read('summary.json').passed, false);
    assert.equal(f.read('D078-frame.json').passed, false);
    if (name === 'false report') assert.deepEqual(f.read('D078-frame.json'), { passed: false, tests: [{ passed: false }] });
    else {
      assert.equal(f.read('D078-frame.json').incomplete, true);
      assert.equal(f.read('diagnostics.json').length, 1);
      assert.ok(f.read('diagnostics.json')[0].stack);
    }
  });
}

test('frame runner refuses the historical/full/unknown partitions without loading any module', async () => {
  for (const partition of ['all', 'historical', 'unknown']) {
    let loaded = false;
    await assert.rejects(runFramePartition({ args: ['--partition=' + partition], load: async () => { loaded = true; } }), /unknown or unsupported/);
    assert.equal(loaded, false);
  }
});

test('a failed returned report cannot become success even if the guard forgot to log false', async t => {
  const f = runnerFixture(t), report = { passed: false, tests: [{ passed: false }], completeOriginalData: { kept: [1, 2, 3] } };
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D078_FRAME[1]]: () => ({ failed: 1, report }) }) }), 1);
  assert.deepEqual(f.read('D078-frame.json'), report);
  assert.equal(f.read('summary.json').failed, 1);
});

test('a logged assertion failure cannot be overwritten by a successful returned report', async t => {
  const f = runnerFixture(t);
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D078_FRAME[1]]: log => {
    log(false, 'must stay failed'); return { failed: 0, report: { passed: true, tests: [] } };
  } }) }), 1);
  assert.equal(f.read('summary.json').passed, false);
  assert.deepEqual(f.read('summary.json').loggedFailures, ['must stay failed']);
});

test('missing returned report fails closed and retains exception diagnostics', async t => {
  const f = runnerFixture(t);
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D078_FRAME[1]]: () => undefined }) }), 1);
  assert.equal(f.read('D078-frame.json').incomplete, true);
  assert.match(f.read('diagnostics.json')[0].message, /complete report/);
});

test('evidence serialization failure never overrides a nonzero exit with success', async t => {
  const f = runnerFixture(t), lines = [];
  fs.mkdirSync(path.join(f.dir, 'D078-frame.json'));
  assert.equal(await f.run({ write: line => lines.push(line), load: async () => ({ [D078_FRAME[1]]: () => ({ failed: 1, report: { passed: false } }) }) }), 1);
  assert.ok(lines.some(line => line.includes('evidence could not be saved')));
  assert.match(lines.at(-1), /NG 紅燈/);
});

const workflowEnv = { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_REPOSITORY: 'owner/repo', GITHUB_EVENT_NAME: 'pull_request' };
const mockGit = args => args[0] === 'status' ? '' : args[1] === 'HEAD' ? 'a'.repeat(40) : 'b'.repeat(40);

test('frame provenance records exact source SHA/tree/run and actual source-file hashes', () => {
  const identity = frameProvenance({ env: workflowEnv, git: mockGit });
  assert.equal(identity.sha, workflowEnv.GITHUB_SHA);
  assert.equal(identity.tree, 'b'.repeat(40));
  assert.equal(identity.runId, '123');
  assert.equal(identity.attempt, 1);
  assert.equal(identity.trackedChanges, null);
  assert.equal(identity.sources.length, 8);
  for (const source of identity.sources) {
    const bytes = fs.readFileSync(new URL('../' + source.path, import.meta.url));
    assert.equal(source.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
});

test('frame provenance rejects wrong SHA, dirty tracked sources and missing workflow identity', () => {
  assert.throws(() => frameProvenance({ env: { ...workflowEnv, GITHUB_SHA: 'c'.repeat(40) }, git: mockGit }), /exact workflow SHA/);
  assert.throws(() => frameProvenance({ env: workflowEnv, git: args => args[0] === 'status' ? ' M source.ts' : mockGit(args) }), /tracked source/);
  for (const field of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_REPOSITORY', 'GITHUB_EVENT_NAME']) {
    assert.throws(() => frameProvenance({ env: { ...workflowEnv, [field]: '' }, git: mockGit }), /required/);
  }
});

test('source identity failure stops execution and is retained as incomplete failure evidence', async t => {
  const f = runnerFixture(t); let loaded = false;
  assert.equal(await f.run({ write: () => {}, provenance: () => { throw new Error('wrong workflow source'); }, load: async () => { loaded = true; } }), 1);
  assert.equal(loaded, false);
  assert.equal(f.read('summary.json').passed, false);
  assert.match(f.read('diagnostics.json')[0].message, /wrong workflow source/);
});

test('workflow tee capture preserves stdout/stderr and a failed frame process exit', t => {
  const f = runnerFixture(t), consoleFile = path.join(f.dir, 'console.log');
  const child = spawnSync('bash', ['-c', 'set -o pipefail; "$1" -e \'console.log("progress"); console.error("failure"); process.exit(7)\' 2>&1 | tee "$2"', 'test-frame-log', process.execPath, consoleFile], { encoding: 'utf8' });
  assert.equal(child.status, 7);
  assert.equal(fs.readFileSync(consoleFile, 'utf8'), 'progress\nfailure\n');
});
