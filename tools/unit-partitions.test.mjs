import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { UNIT_GUARDS, D078_FRAME, D079_FRAME, D080_FRAME, D081_FRAME, INLINE_SUITE, PARTITIONS, parsePartition, assertGuardInventory, partitionInventory, createGuardSelection } from './unit-partitions.mjs';
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

test('explicit inventory equals every original ordered registration, including D081', () => {
  assert.equal(UNIT_GUARDS.length, 123);
  assert.equal(registered.length, 123);
  assertGuardInventory(registered);
  assert.deepEqual(registered.slice(-9), [['./unit-d078.mjs', 'd078Guards'], [...D078_FRAME], ['./unit-d079.mjs', 'd079Guards'], [...D079_FRAME], ['./unit-d080.mjs', 'd080Guards'], [...D080_FRAME], ['./unit-d081.mjs', 'd081Guards'], [...D081_FRAME], ['./unit-evidence.mjs', 'evidenceImageGuards']]);
});

test('historical plus four frames is a disjoint, exhaustive partition including all inline checks', () => {
  assert.deepEqual(PARTITIONS, ['all', 'historical', 'd078-frame', 'd079-frame', 'd080-frame', 'd081-frame']);
  const all = partitionInventory('all'), historical = partitionInventory('historical'), frame = [...partitionInventory('d078-frame'), ...partitionInventory('d079-frame'), ...partitionInventory('d080-frame'), ...partitionInventory('d081-frame')];
  assert.equal(all.length, 124);
  assert.equal(historical.length, 120);
  assert.equal(all.filter(id => id !== INLINE_SUITE).length, 123, 'registered guards exclude the inline suite');
  assert.equal(historical.filter(id => id !== INLINE_SUITE).length, 119, 'historical registered guards exclude the inline suite');
  assert.deepEqual(frame, [key(D078_FRAME), key(D079_FRAME), key(D080_FRAME), key(D081_FRAME)]);
  assert.equal(historical[0], INLINE_SUITE);
  assert.ok(historical.includes('./unit-d078.mjs:d078Guards'));
  assert.ok(historical.includes('./unit-d079.mjs:d079Guards'));
  assert.ok(historical.includes('./unit-d080.mjs:d080Guards'));
  assert.ok(historical.includes('./unit-d081.mjs:d081Guards'));
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
  ['missing D079 geometry', rows => rows.filter(([file]) => file !== './unit-d079.mjs')],
  ['missing D079 frame', rows => rows.filter(([file]) => file !== D079_FRAME[0])],
  ['missing D080 geometry', rows => rows.filter(([file]) => file !== './unit-d080.mjs')],
  ['missing D080 frame', rows => rows.filter(([file]) => file !== D080_FRAME[0])],
  ['missing D081 geometry', rows => rows.filter(([file]) => file !== './unit-d081.mjs')],
  ['missing D081 frame', rows => rows.filter(([file]) => file !== D081_FRAME[0])],
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

function runnerFixture79(t) {
  const f = runnerFixture(t);
  return { ...f, run: options => f.run({ args: ['--partition=d079-frame'], ...options }) };
}
test('D079: frame runner imports exactly the original export once and forwards all 34 reports', async t => {
  const f = runnerFixture79(t);
  const loads = [], lines = [], reports = Array.from({ length: 34 }, (_, i) => `frame guard ${i + 1}`);
  const code = await f.run({ args: ['--partition=d079-frame'], write: line => lines.push(line), load: async file => {
    loads.push(file);
    return { [D079_FRAME[1]]: async log => { for (const name of reports) log(true, name); return { failed: 0, report: { passed: true, tests: reports, frames: [] } }; } };
  } });
  assert.equal(code, 0);
  assert.deepEqual(loads, [D079_FRAME[0]]);
  assert.equal(lines.filter(line => line.startsWith('  OK ')).length, 34);
  assert.match(lines.at(-1), /OK 綠燈/);
  assert.deepEqual(f.read('D079-frame.json'), { passed: true, tests: reports, frames: [] });
  assert.deepEqual(f.read('provenance.json'), mockIdentity);
  const summary = f.read('summary.json'), bytes = fs.readFileSync(path.join(f.dir, 'D079-frame.json'));
  assert.equal(summary.passed, true);
  assert.equal(summary.tests, 34);
  assert.equal(summary.fullReport.bytes, bytes.length);
  assert.equal(summary.fullReport.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(fs.readFileSync(path.join(f.dir, 'runner.log'), 'utf8'), lines.join('\n') + '\n');
});

for (const [name, load] of [
  ['false report', async () => ({ [D079_FRAME[1]]: log => { log(false, 'original assertion failed'); return { failed: 1, report: { passed: false, tests: [{ passed: false }] } }; } })],
  ['missing export', async () => ({})],
  ['load exception', async () => { throw new Error('import failed'); }],
  ['guard exception', async () => ({ [D079_FRAME[1]]: () => { throw new Error('guard failed'); } })],
]) {
  test(`D079: frame runner propagates ${name} as a nonzero exit`, async t => {
    const f = runnerFixture79(t), lines = [];
    assert.equal(await f.run({ load, write: line => lines.push(line) }), 1);
    assert.match(lines.at(-1), /NG 紅燈/);
    assert.doesNotMatch(lines.at(-1), /OK 綠燈/);
    assert.equal(f.read('summary.json').passed, false);
    assert.equal(f.read('D079-frame.json').passed, false);
    if (name === 'false report') assert.deepEqual(f.read('D079-frame.json'), { passed: false, tests: [{ passed: false }] });
    else {
      assert.equal(f.read('D079-frame.json').incomplete, true);
      assert.equal(f.read('diagnostics.json').length, 1);
      assert.ok(f.read('diagnostics.json')[0].stack);
    }
  });
}

test('D079: frame runner refuses the historical/full/unknown partitions without loading any module', async () => {
  for (const partition of ['all', 'historical', 'unknown']) {
    let loaded = false;
    await assert.rejects(runFramePartition({ args: ['--partition=' + partition], load: async () => { loaded = true; } }), /unknown or unsupported/);
    assert.equal(loaded, false);
  }
});

test('D079: a failed returned report cannot become success even if the guard forgot to log false', async t => {
  const f = runnerFixture79(t), report = { passed: false, tests: [{ passed: false }], completeOriginalData: { kept: [1, 2, 3] } };
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D079_FRAME[1]]: () => ({ failed: 1, report }) }) }), 1);
  assert.deepEqual(f.read('D079-frame.json'), report);
  assert.equal(f.read('summary.json').failed, 1);
});

test('D079: a logged assertion failure cannot be overwritten by a successful returned report', async t => {
  const f = runnerFixture79(t);
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D079_FRAME[1]]: log => {
    log(false, 'must stay failed'); return { failed: 0, report: { passed: true, tests: [] } };
  } }) }), 1);
  assert.equal(f.read('summary.json').passed, false);
  assert.deepEqual(f.read('summary.json').loggedFailures, ['must stay failed']);
});

test('D079: missing returned report fails closed and retains exception diagnostics', async t => {
  const f = runnerFixture79(t);
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D079_FRAME[1]]: () => undefined }) }), 1);
  assert.equal(f.read('D079-frame.json').incomplete, true);
  assert.match(f.read('diagnostics.json')[0].message, /complete report/);
});

test('D079: evidence serialization failure never overrides a nonzero exit with success', async t => {
  const f = runnerFixture79(t), lines = [];
  fs.mkdirSync(path.join(f.dir, 'D079-frame.json'));
  assert.equal(await f.run({ write: line => lines.push(line), load: async () => ({ [D079_FRAME[1]]: () => ({ failed: 1, report: { passed: false } }) }) }), 1);
  assert.ok(lines.some(line => line.includes('evidence could not be saved')));
  assert.match(lines.at(-1), /NG 紅燈/);
});


test('D079 provenance pins exact D079 card and tools and rejects wrong or missing identity', t => {
  const f = runnerFixture(t), files = [
    'tools/unit-partition.mjs', 'tools/unit-partitions.mjs', 'tools/unit-d079-frame.mjs',
    'tools/d079-frame.mjs', 'tools/d079-capture.mjs', 'tools/unit-d079.mjs',
    'docs/D079-british-transit-utility-pavilions-ten.md', 'package-lock.json',
    'docs/D079-parallel-validation.md', 'tools/d079-baseline.mjs', 'tools/d079-scope.mjs', 'tools/d079-scope-build.mjs',
    'fixtures/d079-architecture-contract.json', 'docs/D079-initial-architecture.json',
  ];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(f.dir, file)), { recursive: true });
    fs.writeFileSync(path.join(f.dir, file), 'exact source for ' + file);
  }
  const options = { partition: 'd079-frame', root: f.dir, env: workflowEnv, git: mockGit };
  const identity = frameProvenance(options);
  assert.deepEqual(identity.sources.map(s => s.path), files);
  for (const source of identity.sources) assert.equal(source.sha256, createHash('sha256').update(fs.readFileSync(path.join(f.dir, source.path))).digest('hex'));
  assert.throws(() => frameProvenance({ ...options, env: { ...workflowEnv, GITHUB_SHA: 'c'.repeat(40) } }), /exact workflow SHA/);
  assert.throws(() => frameProvenance({ ...options, git: args => args[0] === 'status' ? ' M source.ts' : mockGit(args) }), /tracked source/);
  for (const field of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_REPOSITORY', 'GITHUB_EVENT_NAME']) {
    assert.throws(() => frameProvenance({ ...options, env: { ...workflowEnv, [field]: '' } }), /required/);
  }
  fs.unlinkSync(path.join(f.dir, files[2]));
  assert.throws(() => frameProvenance(options), /ENOENT/);
});

for (const partition of ['d078-frame', 'd079-frame', 'd080-frame', 'd081-frame']) {
  test(`${partition} source identity failure prevents guard loading`, async t => {
    const f = runnerFixture(t); let loaded = false;
    assert.equal(await f.run({ args: ['--partition=' + partition], write: () => {}, provenance: ({ partition: actual }) => {
      assert.equal(actual, partition); throw new Error('wrong workflow source');
    }, load: async () => { loaded = true; } }), 1);
    assert.equal(loaded, false);
    assert.equal(f.read('summary.json').passed, false);
    assert.equal(f.read(partition.slice(0, 4).toUpperCase() + '-frame.json').incomplete, true);
  });
}

function runnerFixture80(t) {
  const f = runnerFixture(t);
  return { ...f, run: options => f.run({ args: ['--partition=d080-frame'], ...options }) };
}
test('D080: frame runner imports exactly its export once and forwards all 34 injected reports', async t => {
  const f = runnerFixture80(t);
  const loads = [], lines = [], reports = Array.from({ length: 34 }, (_, i) => `frame guard ${i + 1}`);
  const code = await f.run({ args: ['--partition=d080-frame'], write: line => lines.push(line), load: async file => {
    loads.push(file);
    return { [D080_FRAME[1]]: async log => { for (const name of reports) log(true, name); return { failed: 0, report: { passed: true, tests: reports, frames: [] } }; } };
  } });
  assert.equal(code, 0);
  assert.deepEqual(loads, [D080_FRAME[0]]);
  assert.equal(lines.filter(line => line.startsWith('  OK ')).length, 34);
  assert.match(lines.at(-1), /OK 綠燈/);
  assert.deepEqual(f.read('D080-frame.json'), { passed: true, tests: reports, frames: [] });
  assert.deepEqual(f.read('provenance.json'), mockIdentity);
  const summary = f.read('summary.json'), bytes = fs.readFileSync(path.join(f.dir, 'D080-frame.json'));
  assert.equal(summary.passed, true);
  assert.equal(summary.tests, 34);
  assert.equal(summary.fullReport.bytes, bytes.length);
  assert.equal(summary.fullReport.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(fs.readFileSync(path.join(f.dir, 'runner.log'), 'utf8'), lines.join('\n') + '\n');
});

for (const [name, load] of [
  ['false report', async () => ({ [D080_FRAME[1]]: log => { log(false, 'original assertion failed'); return { failed: 1, report: { passed: false, tests: [{ passed: false }] } }; } })],
  ['missing export', async () => ({})],
  ['load exception', async () => { throw new Error('import failed'); }],
  ['guard exception', async () => ({ [D080_FRAME[1]]: () => { throw new Error('guard failed'); } })],
]) {
  test(`D080: frame runner propagates ${name} as a nonzero exit`, async t => {
    const f = runnerFixture80(t), lines = [];
    assert.equal(await f.run({ load, write: line => lines.push(line) }), 1);
    assert.match(lines.at(-1), /NG 紅燈/);
    assert.doesNotMatch(lines.at(-1), /OK 綠燈/);
    assert.equal(f.read('summary.json').passed, false);
    assert.equal(f.read('D080-frame.json').passed, false);
    if (name === 'false report') assert.deepEqual(f.read('D080-frame.json'), { passed: false, tests: [{ passed: false }] });
    else {
      assert.equal(f.read('D080-frame.json').incomplete, true);
      assert.equal(f.read('diagnostics.json').length, 1);
      assert.ok(f.read('diagnostics.json')[0].stack);
    }
  });
}

test('D080: frame runner refuses the historical/full/unknown partitions without loading any module', async () => {
  for (const partition of ['all', 'historical', 'unknown']) {
    let loaded = false;
    await assert.rejects(runFramePartition({ args: ['--partition=' + partition], load: async () => { loaded = true; } }), /unknown or unsupported/);
    assert.equal(loaded, false);
  }
});

test('D080: a failed returned report cannot become success even if the guard forgot to log false', async t => {
  const f = runnerFixture80(t), report = { passed: false, tests: [{ passed: false }], completeOriginalData: { kept: [1, 2, 3] } };
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D080_FRAME[1]]: () => ({ failed: 1, report }) }) }), 1);
  assert.deepEqual(f.read('D080-frame.json'), report);
  assert.equal(f.read('summary.json').failed, 1);
});

test('D080: a logged assertion failure cannot be overwritten by a successful returned report', async t => {
  const f = runnerFixture80(t);
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D080_FRAME[1]]: log => {
    log(false, 'must stay failed'); return { failed: 0, report: { passed: true, tests: [] } };
  } }) }), 1);
  assert.equal(f.read('summary.json').passed, false);
  assert.deepEqual(f.read('summary.json').loggedFailures, ['must stay failed']);
});

test('D080: missing returned report fails closed and retains exception diagnostics', async t => {
  const f = runnerFixture80(t);
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D080_FRAME[1]]: () => undefined }) }), 1);
  assert.equal(f.read('D080-frame.json').incomplete, true);
  assert.match(f.read('diagnostics.json')[0].message, /complete report/);
});

test('D080: evidence serialization failure never overrides a nonzero exit with success', async t => {
  const f = runnerFixture80(t), lines = [];
  fs.mkdirSync(path.join(f.dir, 'D080-frame.json'));
  assert.equal(await f.run({ write: line => lines.push(line), load: async () => ({ [D080_FRAME[1]]: () => ({ failed: 1, report: { passed: false } }) }) }), 1);
  assert.ok(lines.some(line => line.includes('evidence could not be saved')));
  assert.match(lines.at(-1), /NG 紅燈/);
});


test('D080 provenance pins exact D080 card and tools and rejects wrong or missing identity', t => {
  const f = runnerFixture(t), files = [
    'tools/unit-partition.mjs', 'tools/unit-partitions.mjs', 'tools/unit-d080-frame.mjs',
    'tools/d080-frame.mjs', 'tools/d080-capture.mjs', 'tools/unit-d080.mjs',
    'docs/D080-british-community-buildings-ten.md', 'package-lock.json',
    'docs/D080-parallel-validation.md', 'tools/d080-baseline.mjs', 'tools/d080-scope.mjs', 'tools/d080-scope-build.mjs',
    'fixtures/d080-architecture-contract.json', 'docs/D080-initial-architecture.json',
  ];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(f.dir, file)), { recursive: true });
    fs.writeFileSync(path.join(f.dir, file), 'exact source for ' + file);
  }
  const options = { partition: 'd080-frame', root: f.dir, env: workflowEnv, git: mockGit };
  const identity = frameProvenance(options);
  assert.deepEqual(identity.sources.map(s => s.path), files);
  for (const source of identity.sources) assert.equal(source.sha256, createHash('sha256').update(fs.readFileSync(path.join(f.dir, source.path))).digest('hex'));
  assert.throws(() => frameProvenance({ ...options, env: { ...workflowEnv, GITHUB_SHA: 'c'.repeat(40) } }), /exact workflow SHA/);
  assert.throws(() => frameProvenance({ ...options, git: args => args[0] === 'status' ? ' M source.ts' : mockGit(args) }), /tracked source/);
  for (const field of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_REPOSITORY', 'GITHUB_EVENT_NAME']) {
    assert.throws(() => frameProvenance({ ...options, env: { ...workflowEnv, [field]: '' } }), /required/);
  }
  fs.unlinkSync(path.join(f.dir, files[2]));
  assert.throws(() => frameProvenance(options), /ENOENT/);
});


test('every registration is covered once; historical order and all four frame identities are exact', () => {
  const frames = [D078_FRAME, D079_FRAME, D080_FRAME, D081_FRAME].map(key);
  const scheduled = ['historical', 'd078-frame', 'd079-frame', 'd080-frame', 'd081-frame'].map(partitionInventory);
  const expectedAll = [INLINE_SUITE, ...registered.map(key)];
  assert.deepEqual(partitionInventory('all'), expectedAll);
  assert.deepEqual(scheduled[0], expectedAll.filter(id => !frames.includes(id)));
  for (let i = 0; i < frames.length; i++) assert.deepEqual(scheduled[i + 1], [frames[i]]);
  for (let i = 0; i < scheduled.length; i++) {
    assert.equal(scheduled[i].length, new Set(scheduled[i]).size);
    for (let j = i + 1; j < scheduled.length; j++) assert.deepEqual(scheduled[i].filter(id => scheduled[j].includes(id)), []);
  }
  assert.deepEqual(scheduled.flat().sort(), [...expectedAll].sort());
  for (const id of expectedAll) assert.equal(scheduled.flat().filter(candidate => candidate === id).length, 1, id);
});

test('inventory rejects omission, duplication and changed export at every registered position', () => {
  for (let i = 0; i < registered.length; i++) {
    const missing = registered.filter((_, j) => i !== j);
    const duplicate = [...registered.slice(0, i), registered[i], ...registered.slice(i)];
    const changed = registered.map((row, j) => j === i ? [row[0], row[1] + 'Changed'] : row);
    for (const rows of [missing, duplicate, changed]) {
      assert.throws(() => assertGuardInventory(rows), /guard (registration|inventory)/);
      assert.throws(() => {
        const selection = createGuardSelection('historical');
        for (const row of rows) selection.shouldRun(...row);
        selection.finish();
      }, /guard (registration|inventory)/);
    }
  }
});

for (const partition of ['d078-frame', 'd079-frame', 'd080-frame', 'd081-frame']) {
  test(`${partition} cannot be scheduled through the inline runner`, () => {
    assert.throws(() => createGuardSelection(partition), /unsupported/);
    assert.throws(() => parsePartition(['--partition=' + partition], ['all', 'historical']), /unsupported/);
  });
}

test('D080: evidence-write failure also rejects an otherwise successful guard', async t => {
  const f = runnerFixture80(t), lines = [];
  fs.mkdirSync(path.join(f.dir, 'D080-frame.json'));
  assert.equal(await f.run({ write: line => lines.push(line), load: async () => ({ [D080_FRAME[1]]: () => ({ failed: 0, report: { passed: true } }) }) }), 1);
  assert.ok(lines.some(line => line.includes('evidence could not be saved')));
  assert.match(lines.at(-1), /NG 紅燈/);
});

function runnerFixture81(t) {
  const f = runnerFixture(t);
  return { ...f, run: options => f.run({ args: ['--partition=d081-frame'], ...options }) };
}
test('D081: frame runner imports exactly its export once and forwards all 34 injected reports', async t => {
  const f = runnerFixture81(t);
  const loads = [], lines = [], reports = Array.from({ length: 34 }, (_, i) => `frame guard ${i + 1}`);
  const code = await f.run({ args: ['--partition=d081-frame'], write: line => lines.push(line), load: async file => {
    loads.push(file);
    return { [D081_FRAME[1]]: async log => { for (const name of reports) log(true, name); return { failed: 0, report: { passed: true, tests: reports, frames: [] } }; } };
  } });
  assert.equal(code, 0);
  assert.deepEqual(loads, [D081_FRAME[0]]);
  assert.equal(lines.filter(line => line.startsWith('  OK ')).length, 34);
  assert.match(lines.at(-1), /OK 綠燈/);
  assert.deepEqual(f.read('D081-frame.json'), { passed: true, tests: reports, frames: [] });
  assert.deepEqual(f.read('provenance.json'), mockIdentity);
  const summary = f.read('summary.json'), bytes = fs.readFileSync(path.join(f.dir, 'D081-frame.json'));
  assert.equal(summary.passed, true);
  assert.equal(summary.tests, 34);
  assert.equal(summary.fullReport.bytes, bytes.length);
  assert.equal(summary.fullReport.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(fs.readFileSync(path.join(f.dir, 'runner.log'), 'utf8'), lines.join('\n') + '\n');
});

for (const [name, load] of [
  ['false report', async () => ({ [D081_FRAME[1]]: log => { log(false, 'original assertion failed'); return { failed: 1, report: { passed: false, tests: [{ passed: false }] } }; } })],
  ['missing export', async () => ({})],
  ['load exception', async () => { throw new Error('import failed'); }],
  ['guard exception', async () => ({ [D081_FRAME[1]]: () => { throw new Error('guard failed'); } })],
]) {
  test(`D081: frame runner propagates ${name} as a nonzero exit`, async t => {
    const f = runnerFixture81(t), lines = [];
    assert.equal(await f.run({ load, write: line => lines.push(line) }), 1);
    assert.match(lines.at(-1), /NG 紅燈/);
    assert.doesNotMatch(lines.at(-1), /OK 綠燈/);
    assert.equal(f.read('summary.json').passed, false);
    assert.equal(f.read('D081-frame.json').passed, false);
    if (name === 'false report') assert.deepEqual(f.read('D081-frame.json'), { passed: false, tests: [{ passed: false }] });
    else {
      assert.equal(f.read('D081-frame.json').incomplete, true);
      assert.equal(f.read('diagnostics.json').length, 1);
      assert.ok(f.read('diagnostics.json')[0].stack);
    }
  });
}

test('D081: frame runner refuses the historical/full/unknown partitions without loading any module', async () => {
  for (const partition of ['all', 'historical', 'unknown']) {
    let loaded = false;
    await assert.rejects(runFramePartition({ args: ['--partition=' + partition], load: async () => { loaded = true; } }), /unknown or unsupported/);
    assert.equal(loaded, false);
  }
});

test('D081: a failed returned report cannot become success even if the guard forgot to log false', async t => {
  const f = runnerFixture81(t), report = { passed: false, tests: [{ passed: false }], completeOriginalData: { kept: [1, 2, 3] } };
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D081_FRAME[1]]: () => ({ failed: 1, report }) }) }), 1);
  assert.deepEqual(f.read('D081-frame.json'), report);
  assert.equal(f.read('summary.json').failed, 1);
});

test('D081: a logged assertion failure cannot be overwritten by a successful returned report', async t => {
  const f = runnerFixture81(t);
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D081_FRAME[1]]: log => {
    log(false, 'must stay failed'); return { failed: 0, report: { passed: true, tests: [] } };
  } }) }), 1);
  assert.equal(f.read('summary.json').passed, false);
  assert.deepEqual(f.read('summary.json').loggedFailures, ['must stay failed']);
});

test('D081: missing returned report fails closed and retains exception diagnostics', async t => {
  const f = runnerFixture81(t);
  assert.equal(await f.run({ write: () => {}, load: async () => ({ [D081_FRAME[1]]: () => undefined }) }), 1);
  assert.equal(f.read('D081-frame.json').incomplete, true);
  assert.match(f.read('diagnostics.json')[0].message, /complete report/);
});

test('D081: evidence serialization failure never overrides a nonzero exit with success', async t => {
  const f = runnerFixture81(t), lines = [];
  fs.mkdirSync(path.join(f.dir, 'D081-frame.json'));
  assert.equal(await f.run({ write: line => lines.push(line), load: async () => ({ [D081_FRAME[1]]: () => ({ failed: 1, report: { passed: false } }) }) }), 1);
  assert.ok(lines.some(line => line.includes('evidence could not be saved')));
  assert.match(lines.at(-1), /NG 紅燈/);
});


test('D081 provenance pins exact D081 card and tools and rejects wrong or missing identity', t => {
  const f = runnerFixture(t), files = [
    'tools/unit-partition.mjs', 'tools/unit-partitions.mjs', 'tools/unit-d081-frame.mjs',
    'tools/d081-frame.mjs', 'tools/d081-capture.mjs', 'tools/unit-d081.mjs',
    'docs/D081-british-field-study-buildings-ten.md', 'package-lock.json',
    'docs/D081-parallel-validation.md', 'tools/d081-baseline.mjs', 'tools/d081-scope.mjs', 'tools/d081-scope-build.mjs',
    'fixtures/d081-architecture-contract.json', 'docs/D081-initial-architecture.json',
  ];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(f.dir, file)), { recursive: true });
    fs.writeFileSync(path.join(f.dir, file), 'exact source for ' + file);
  }
  const options = { partition: 'd081-frame', root: f.dir, env: workflowEnv, git: mockGit };
  const identity = frameProvenance(options);
  assert.deepEqual(identity.sources.map(s => s.path), files);
  for (const source of identity.sources) assert.equal(source.sha256, createHash('sha256').update(fs.readFileSync(path.join(f.dir, source.path))).digest('hex'));
  assert.throws(() => frameProvenance({ ...options, env: { ...workflowEnv, GITHUB_SHA: 'c'.repeat(40) } }), /exact workflow SHA/);
  assert.throws(() => frameProvenance({ ...options, git: args => args[0] === 'status' ? ' M source.ts' : mockGit(args) }), /tracked source/);
  for (const field of ['GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_REPOSITORY', 'GITHUB_EVENT_NAME']) {
    assert.throws(() => frameProvenance({ ...options, env: { ...workflowEnv, [field]: '' } }), /required/);
  }
  fs.unlinkSync(path.join(f.dir, files[2]));
  assert.throws(() => frameProvenance(options), /ENOENT/);
});



test('D081: evidence-write failure also rejects an otherwise successful guard', async t => {
  const f = runnerFixture81(t), lines = [];
  fs.mkdirSync(path.join(f.dir, 'D081-frame.json'));
  assert.equal(await f.run({ write: line => lines.push(line), load: async () => ({ [D081_FRAME[1]]: () => ({ failed: 0, report: { passed: true } }) }) }), 1);
  assert.ok(lines.some(line => line.includes('evidence could not be saved')));
  assert.match(lines.at(-1), /NG 紅燈/);
});


test('D081 approved touch repair adds exact scope and actual-source guards without dropping historical guards', () => {
  for (const id of ['./d081-touch-lease-scope.mjs:d081TouchLeaseScopeGuards', './unit-d081-touch-lease.mjs:d081TouchLeaseGuards']) {
    assert.equal(partitionInventory('all').filter(x => x === id).length, 1);
    assert.equal(partitionInventory('historical').filter(x => x === id).length, 1);
  }
});
