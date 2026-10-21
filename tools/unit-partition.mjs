// Independent CI runner for unchanged D078/D079/D080 and additive D081 frame guard exports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { D078_FRAME, D079_FRAME, D080_FRAME, D081_FRAME, D082_FRAME, parsePartition, partitionInventory } from './unit-partitions.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const D078_SOURCE_FILES = ['tools/unit-partition.mjs', 'tools/unit-partitions.mjs', 'tools/unit-d078-frame.mjs', 'tools/d078-frame.mjs', 'tools/d078-capture.mjs', 'tools/unit-d078.mjs', 'docs/D078-british-neighbourhood-pavilions-ten.md', 'package-lock.json'];

const D080_SOURCE_FILES = ['tools/unit-partition.mjs', 'tools/unit-partitions.mjs', 'tools/unit-d080-frame.mjs',
  'tools/d080-frame.mjs', 'tools/d080-capture.mjs', 'tools/unit-d080.mjs',
  'docs/D080-british-community-buildings-ten.md', 'package-lock.json',
  'docs/D080-parallel-validation.md', 'tools/d080-baseline.mjs', 'tools/d080-scope.mjs', 'tools/d080-scope-build.mjs',
  'fixtures/d080-architecture-contract.json', 'docs/D080-initial-architecture.json'];

const D081_SOURCE_FILES = ['tools/unit-partition.mjs', 'tools/unit-partitions.mjs', 'tools/unit-d081-frame.mjs',
  'tools/d081-frame.mjs', 'tools/d081-capture.mjs', 'tools/unit-d081.mjs',
  'docs/D081-british-field-study-buildings-ten.md', 'package-lock.json',
  'docs/D081-parallel-validation.md', 'tools/d081-baseline.mjs', 'tools/d081-scope.mjs', 'tools/d081-scope-build.mjs',
  'fixtures/d081-architecture-contract.json', 'docs/D081-initial-architecture.json'];

const D082_SOURCE_FILES = ['tools/test-d082-browser-surfaces.mjs','tools/d082-browser-surfaces.mjs','tools/d082-inspect.mjs','docs/D082-browser-surface-capture.md','tools/d082-frame.mjs','tools/unit-d082-architecture-contract.mjs','docs/D082-visibility-repair-architecture.json','fixtures/d082-geometry-before.json','fixtures/d082-source-before.json','fixtures/d082-history-before.json','src/content/britishCoastalRecreation.ts','src/render/britishCoastalRecreationArt.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/cityView.ts','tools/unit-partition.mjs','tools/unit-partitions.mjs','tools/unit-d082-frame.mjs','tools/d082-candidate-coverage.mjs','tools/unit-d082.mjs','tools/unit-d082-scope.mjs','tools/d082/geometry-test.mjs','tools/d082-scope.mjs','tools/d082-baseline.mjs','fixtures/d082-art-scope.json','fixtures/d082-baseline-feasibility.json','docs/D082-integration-architecture.json','package-lock.json'];

export function frameProvenance({ partition = 'd078-frame', root = ROOT, env = process.env, git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim() } = {}) {
  assert.ok(['d078-frame', 'd079-frame', 'd080-frame', 'd081-frame', 'd082-frame'].includes(partition), 'unknown frame provenance partition');
  const sourceFiles = partition === 'd082-frame' ? D082_SOURCE_FILES : partition === 'd081-frame' ? D081_SOURCE_FILES : partition === 'd080-frame' ? D080_SOURCE_FILES : partition === 'd078-frame' ? D078_SOURCE_FILES : [...D078_SOURCE_FILES.map(file => file.replaceAll('d078', 'd079').replace('D078-british-neighbourhood-pavilions-ten', 'D079-british-transit-utility-pavilions-ten')),
    'docs/D079-parallel-validation.md', 'tools/d079-baseline.mjs', 'tools/d079-scope.mjs', 'tools/d079-scope-build.mjs',
    'fixtures/d079-architecture-contract.json', 'docs/D079-initial-architecture.json'];
  const sha = git(['rev-parse', 'HEAD']), tree = git(['rev-parse', 'HEAD^{tree}']);
  const changed = git(['status', '--porcelain', '--untracked-files=no']);
  if (env.GITHUB_ACTIONS === 'true' || env.GITHUB_SHA) {
    assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/, 'workflow SHA is required');
    assert.equal(sha, env.GITHUB_SHA, 'frame checkout must be the exact workflow SHA');
    assert.equal(changed, '', 'frame tracked source must match its checkout');
    assert.match(env.GITHUB_RUN_ID ?? '', /^\d+$/, 'workflow run ID is required');
    assert.match(env.GITHUB_RUN_ATTEMPT ?? '', /^[1-9]\d*$/, 'workflow attempt is required');
    assert.ok(env.GITHUB_REPOSITORY && env.GITHUB_EVENT_NAME, 'workflow identity is required');
  }
  return { schema: 1, repository: env.GITHUB_REPOSITORY ?? null, sha, tree, trackedChanges: changed || null,
    runId: env.GITHUB_RUN_ID ?? null, attempt: env.GITHUB_RUN_ATTEMPT ? Number(env.GITHUB_RUN_ATTEMPT) : null,
    event: env.GITHUB_EVENT_NAME ?? 'local', node: process.version,
    sources: sourceFiles.map(file => ({ path: file, sha256: hash(fs.readFileSync(path.join(root, file))) })) };
}

// Dependency injection is used only by fast runner failure/serialization controls.
export async function runFramePartition({ args = [], load = file => import(file), write = line => console.log(line),
  evidenceDir, provenance = options => frameProvenance(options) } = {}) {
  const partition = parsePartition(args, ['d078-frame', 'd079-frame', 'd080-frame', 'd081-frame', 'd082-frame'], 'd078-frame');
  const [file, fn] = partition === 'd078-frame' ? D078_FRAME : partition === 'd079-frame' ? D079_FRAME : partition === 'd080-frame' ? D080_FRAME : partition === 'd081-frame' ? D081_FRAME : D082_FRAME;
  const card = partition.slice(0, 4).toUpperCase();
  evidenceDir ??= path.join(ROOT, `scratch/${partition.slice(0, 4)}-node-frame`);
  assert.deepEqual(partitionInventory(partition), [file + ':' + fn]);
  const t0 = Date.now(), fails = [], diagnostics = [];
  fs.mkdirSync(evidenceDir, { recursive: true });
  const logPath = path.join(evidenceDir, 'runner.log');
  fs.writeFileSync(logPath, '');
  const emit = line => { fs.appendFileSync(logPath, line + '\n'); write(line); };
  const save = (name, value) => { const bytes = JSON.stringify(value, null, 2) + '\n'; fs.writeFileSync(path.join(evidenceDir, name), bytes); return { bytes: Buffer.byteLength(bytes), sha256: hash(bytes) }; };
  const log = (ok, name, detail) => {
    emit(`  ${ok ? 'OK' : 'NG'} ${name}${detail !== undefined ? '：' + detail : ''}`);
    if (!ok) fails.push(name);
  };
  let result, identity;
  emit(`START ${fn} (${file})`);
  try {
    identity = provenance({ partition });
    save('provenance.json', identity);
    const m = await load(file);
    if (typeof m[fn] !== 'function') throw new Error(`${file} 沒有匯出 ${fn}`);
    result = await m[fn](log);
    assert.ok(result && Number.isInteger(result.failed) && result.failed >= 0 && result.report, 'frame guard must return its complete report and failure count');
    if (result.failed || result.report.passed !== true) log(false, 'frame report records failure', `failed=${result.failed}, passed=${result.report.passed}`);
  } catch (e) {
    diagnostics.push({ message: String(e?.message ?? e), stack: String(e?.stack ?? e) });
    const at = /(?:tools|src)\/[\w./-]+:\d+/.exec(String(e?.stack ?? ''))?.[0];
    log(false, `${fn}（${file}）丟例外，這一支在例外之後的檢查沒跑`, `${String(e?.message ?? e).replace(/\s*\n\s*/g, ' ')}${at ? `（${at}）` : ''}`);
  }
  // A failed guard report is kept verbatim. If execution threw before returning,
  // retain explicit incomplete-report diagnostics rather than inventing success.
  const report = result?.report ?? { passed: false, incomplete: true, diagnostics };
  try {
    const fullReport = save(`${card}-frame.json`, report);
    save('diagnostics.json', diagnostics);
    save('summary.json', { partition, passed: fails.length === 0, failed: result?.failed ?? null, loggedFailures: fails,
      tests: report.tests?.length ?? 0, frames: report.frames?.length ?? 0, elapsedSeconds: (Date.now() - t0) / 1000,
      source: identity ?? null, fullReport });
  } catch (e) {
    log(false, 'frame evidence could not be saved', String(e?.message ?? e));
  }
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (fails.length) emit(`\nNG 紅燈（${sec}s）：${fails.join('、')}`);
  else emit(`\nOK 綠燈（${sec}s）`);
  return fails.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runFramePartition({ args: process.argv.slice(2) });
}
