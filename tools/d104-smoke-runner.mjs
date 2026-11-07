import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {ROOT, SHARDS, UNITS, SOURCE_FILES, SMOKE_SHA256, PLAN_SHA256, sha,
  validateSmokeSource, executableCore, blankCheckSource} from './d104-smoke-contract.mjs';

export function sourceHashes() {
  return Object.fromEntries(SOURCE_FILES.map(file => [file, sha(fs.readFileSync(path.join(ROOT, file)))]));
}
export function currentIdentity(env = process.env) {
  const git = (...args) => execFileSync('git', args, {cwd:ROOT, encoding:'utf8', windowsHide:true}).trim();
  const sourceCommit = git('rev-parse', 'HEAD'), sourceTree = git('rev-parse', 'HEAD^{tree}');
  assert.match(sourceCommit, /^[a-f0-9]{40}$/); assert.match(sourceTree, /^[a-f0-9]{40}$/);
  assert.equal(git('status', '--porcelain=v1', '--untracked-files=no'), '', 'tracked source must be clean');
  if (env.GITHUB_SHA) assert.equal(sourceCommit, env.GITHUB_SHA, 'exact workflow source');
  const identity = {sourceCommit, sourceTree, repository:env.GITHUB_REPOSITORY ?? 'local',
    runId:env.GITHUB_RUN_ID ?? 'local', attempt:Number(env.GITHUB_RUN_ATTEMPT ?? 1),event:env.GITHUB_EVENT_NAME ?? 'local',
    htmlSha256:sha(fs.readFileSync(path.join(ROOT, 'dist/index.html'))),
    buildDigest:env.CI_BUILD_DIGEST ?? '', buildArtifactId:env.D104_BUILD_ARTIFACT_ID ?? ''};
  assert.ok(Number.isInteger(identity.attempt) && identity.attempt > 0);
  if (env.GITHUB_ACTIONS === 'true') {
    assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
    assert.match(env.GITHUB_RUN_ID ?? '', /^[1-9][0-9]*$/);
    assert.match(env.GITHUB_RUN_ATTEMPT ?? '', /^[1-9][0-9]*$/);
    assert.match(identity.repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
    assert.match(env.GITHUB_EVENT_NAME ?? '', /^[a-z_]+$/);
    assert.match(identity.buildArtifactId, /^[1-9][0-9]*$/);
    for (const key of ['repository','runId','buildDigest','buildArtifactId'])
      assert.ok(identity[key] && identity[key] !== 'local', 'CI identity missing ' + key);
  }
  return identity;
}
function runChild(file, stdoutFile, stderrFile) {
  return new Promise((resolve, reject) => {
    const stdout = fs.createWriteStream(stdoutFile), stderr = fs.createWriteStream(stderrFile);
    const child = spawn(process.execPath, [file], {cwd:ROOT, env:process.env, windowsHide:true, stdio:['ignore','pipe','pipe']});
    child.stdout.on('data', data => { stdout.write(data); process.stdout.write(data); });
    child.stderr.on('data', data => { stderr.write(data); process.stderr.write(data); });
    child.on('error', error => { stdout.end(); stderr.end(); reject(error); });
    child.on('close', (exitCode, signal) => {
      let left = 2; const done = () => { if (--left === 0) resolve({exitCode, signal}); };
      stdout.end(done); stderr.end(done);
    });
  });
}
function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), 'evidence symlinks are not permitted');
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}
export async function runSmokeShard(shard) {
  assert.ok(Number.isInteger(shard) && shard >= 0 && shard < 8);
  assert.equal(process.env.D104_SMOKE_SHARD, undefined, 'matrix selection must be consumed once');
  assert.ok(!process.env.NODE_OPTIONS?.includes('d104-smoke-entry'), 'preload must not reach nested children');
  const partialFlags = Object.entries(process.env).filter(([key,value]) => /^D\d+_SMOKE_ONLY$/.test(key) && value).map(([key]) => key);
  assert.deepEqual(partialFlags, [], 'partial smoke flags are not full coverage');
  const original = validateSmokeSource(), identity = currentIdentity();
  const out = path.join(ROOT, 'scratch/d104-smoke', String(shard));
  assert.ok(!fs.existsSync(out), 'never overwrite an existing shard receipt');
  fs.mkdirSync(out, {recursive:true});
  const receipt = {schema:'d104-smoke-shard-v1', shard, status:'running', complete:false,
    startedAt:new Date().toISOString(), identity, planSha256:PLAN_SHA256, smokeSha256:SMOKE_SHA256,
    sourceHashes:sourceHashes(), partialFlags, expectedUnits:[...SHARDS[shard]], executedUnits:[],
    units:SHARDS[shard].map(id => ({id,status:'pending',invocations:0,checks:0,failedChecks:0,postGuards:[]})),
    artifacts:[], errors:[]};
  const persist = () => fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt,null,2) + '\n');
  persist();
  try {
    const {withBrowser:currentArtBrowser} = await import('./cdp.mjs');
    // This is the original smoke.mjs:11 boundary, not the stand-alone module default.
    const withBrowser = (opt, fn) => currentArtBrowser(opt, ({page,open}) => fn({page,open:q=>open(q+(q?'&':'')+'streetArt=legacy')}));
    for (const row of receipt.units) {
      const unit = UNITS.find(unit => unit.id === row.id), started = performance.now();
      row.status = 'running'; row.invocations = 1; row.startedAt = new Date().toISOString();
      receipt.executedUnits.push(row.id); persist();
      console.log('D104 SMOKE START ' + row.id);
      const logFile = path.join(out, row.id + '.checks.jsonl');
      fs.writeFileSync(logFile, '');
      const log = (ok,name,detail) => {
        row.checks++; if (!ok) row.failedChecks++;
        fs.appendFileSync(logFile, JSON.stringify({ok:!!ok,name,detail}) + '\n');
        console.log(`  ${ok ? 'OK' : 'NG'} ${name}${detail === undefined ? '' : '：' + detail}`);
      };
      try {
        if (unit.kind === 'core') {
          const core = executableCore(original), generated = path.join(out, 'core.generated.mjs');
          row.coreSha256 = core.canonicalSha256;
          row.importSubstitutions = core.substitutions.length;
          fs.writeFileSync(generated, core.executable);
          try {
            const result = await runChild(generated, path.join(out,'core.stdout.log'), path.join(out,'core.stderr.log'));
            Object.assign(row, result);
            for (const match of fs.readFileSync(path.join(out,'core.stdout.log'),'utf8').matchAll(/^  (OK|NG) (.*)$/gm))
              { row.checks++; if (match[1] === 'NG') row.failedChecks++; fs.appendFileSync(logFile,JSON.stringify({ok:match[1] === 'OK',name:match[2]}) + '\n'); }
          } finally { fs.unlinkSync(generated); }
        } else if (unit.kind === 'capture') {
          const result = await runChild(path.join(ROOT, unit.file), path.join(out,'d058.stdout.log'), path.join(out,'d058.stderr.log'));
          Object.assign(row, result);
          const capture = JSON.parse(fs.readFileSync(path.join(ROOT,'scratch/d058-after/D058-capture.json'),'utf8'));
          assert.equal(capture.phase, 'after'); assert.equal(capture.passed, true); assert.equal(capture.cases.length, 6);
          assert.equal(capture.htmlSha256, identity.htmlSha256);
          for (const item of capture.cases) {
            assert.equal(item.passed, true); assert.ok(item.checks.length > 0);
            for (const name of item.checks) log(true, `${item.scene}/${item.viewport.W}: ${name}`);
          }
        } else {
          const module = await import(pathToFileURL(path.join(ROOT, unit.file)).href);
          assert.equal(typeof module[unit.id], 'function');
          await module[unit.id](withBrowser, log, ...(unit.id === 'd011Smoke' ? [blankCheckSource(original)] : []));
          if (unit.postGuard) { module[unit.postGuard](log); row.postGuards.push(unit.postGuard); }
          row.exitCode = 0; row.signal = null;
        }
        assert.equal(row.exitCode, 0, row.id + ' child exit'); assert.ok(!row.signal);
        assert.ok(row.checks > 0, row.id + ' cannot succeed without observations');
        row.status = row.failedChecks === 0 ? 'passed' : 'failed';
      } catch (error) { row.status = 'failed'; row.exitCode ??= 1; row.error = String(error.stack ?? error); }
      row.finishedAt = new Date().toISOString(); row.elapsedMs = performance.now() - started; persist();
      console.log(`D104 SMOKE END ${row.id} ${row.status} ${row.elapsedMs.toFixed(1)} ms`);
      if (row.error) throw new Error(row.id + ': ' + row.error);
    }
    assert.deepEqual(receipt.executedUnits, receipt.expectedUnits);
    assert.ok(receipt.units.every(unit => unit.status === 'passed'), 'every selected original suite must pass');
    assert.deepEqual(sourceHashes(), receipt.sourceHashes, 'executed assertion sources changed during run');
    assert.deepEqual(currentIdentity(), identity, 'source/build identity changed during run');
    receipt.status = 'passed'; receipt.complete = true;
  } catch (error) { receipt.status = 'failed'; receipt.errors.push(String(error.stack ?? error)); console.error(receipt.errors.at(-1)); }
  finally {
    if (SHARDS[shard].includes('d058Capture') && fs.existsSync(path.join(ROOT,'scratch/d058-after')))
      fs.cpSync(path.join(ROOT,'scratch/d058-after'),path.join(out,'artifacts/d058-after'),{recursive:true,errorOnExist:true,force:false});
    // Original suites still write their historical filenames. The CI artifact retains these.
    const published = filesUnder(path.join(ROOT,'scratch/shots')).filter(file =>
      /\.png$/.test(file) || /[\\/]D0(?:48|49|50|51|52|53|54|56)-[^\\/]+\.(?:json|html|code\.txt)$/.test(file));
    const own = filesUnder(out).filter(file => path.basename(file) !== 'receipt.json');
    receipt.artifacts = [...new Set([...own,...published])].sort().map(file => {
      const bytes = fs.readFileSync(file); return {path:path.relative(ROOT,file).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)};
    });
    receipt.finishedAt = new Date().toISOString(); persist();
  }
  console.log(`D104 smoke shard ${shard}: ${receipt.status}; ${receipt.executedUnits.length}/${receipt.expectedUnits.length} complete-suite invocations`);
  return receipt.status === 'passed' ? 0 : 1;
}
