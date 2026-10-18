// One full original smoke invocation, with tracing added only at its D052 call.
// No on-disk historical source is rewritten. Importing this module is inert.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configureReleaseTrace, releaseTraceSummary } from './d074-release-trace.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RUNNER = new URL('./smoke.mjs', import.meta.url).href;
const ORIGINAL_CALL = 'await d052Smoke(withBrowser, log)';
const DIAGNOSTIC_CALL = 'await d052Smoke(diagnosticBrowser(withBrowser), log)';
const ADDED_IMPORT = "import { diagnosticBrowser } from './d074-release-trace.mjs';\n";
export const ORIGINAL_SMOKE_SHA256 = 'a76445a4766df5c4c26126eee47898d5a0320c28a1da67e74433f61aef98f2f8';
const PINNED = {
  'tools/smoke.mjs': ORIGINAL_SMOKE_SHA256,
  'tools/smoke-d052.mjs': '1775d0302219894d998df34efe36f3dbcd884d056fe5ab2b5aaa5fc5865654ac',
  'src/ui/panelPress.ts': '108ed5b4b11f262728c0cddb4abe8a719f4b2ef6f673c1dd96a471c7cabc45c6',
};
const sha = value => createHash('sha256').update(value).digest('hex');
let invoked = false;

export function transformOriginalSmoke(source) {
  assert.equal(sha(source), ORIGINAL_SMOKE_SHA256, 'full-context diagnostic requires the exact original smoke source');
  assert.equal(source.split(ORIGINAL_CALL).length - 1, 1, 'exactly one original D052 browser call must exist');
  assert.equal(source.includes('diagnosticBrowser'), false, 'original smoke must not already contain the diagnostic');
  const transformed = ADDED_IMPORT + source.replace(ORIGINAL_CALL, DIAGNOSTIC_CALL);
  assert.equal(transformed.slice(ADDED_IMPORT.length).replace(DIAGNOSTIC_CALL, ORIGINAL_CALL), source,
    'the only source differences must be one import and one D052 call argument');
  return transformed;
}

export async function runFullContextDiagnostic() {
  assert.equal(invoked, false, 'only one full-context smoke invocation per process is permitted'); invoked = true;
  assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'Node 24 or newer is required');
  const filters = Object.entries(process.env).filter(([name, value]) => value && /^D\d+[A-Z]*_(SMOKE_ONLY|WIDTHS|VIEWS|PARTS)$/.test(name));
  assert.deepEqual(filters, [], 'full-context diagnosis refuses smoke/art filters; it does not silently unset them');
  const sources = {};
  for (const [file, expected] of Object.entries(PINNED)) {
    sources[file] = sha(fs.readFileSync(path.join(ROOT, file)));
    assert.equal(sources[file], expected, `original source pin: ${file}`);
  }
  sources['dist/index.html'] = sha(fs.readFileSync(path.join(ROOT, 'dist/index.html')));
  assert.equal(sources['dist/index.html'], '3d0809c50a4a3233f89b84ff5f97941374bdb95706b9cf2fb2a188a84261ab3d',
    'full-context diagnostic must use the exact failed-release HTML');
  const base = path.join(ROOT, 'scratch/d074-full-context-diagnostic');
  const out = path.join(base, new Date().toISOString().replace(/[:.]/g, '-') + `-pid${process.pid}`);
  // A distinct directory preserves every earlier diagnostic; no cleanup occurs.
  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(out, { recursive: false });
  configureReleaseTrace(out);
  const manifest = {
    title: 'D074 one original full smoke context with D052 release tracing', startedAt: new Date().toISOString(),
    node: process.version, commit: process.env.GITHUB_SHA ?? null, artifactDirectory: path.relative(ROOT, out), sources,
    hook: { url: RUNNER, transformCount: 0, originalSha256: ORIGINAL_SMOKE_SHA256,
      replacementCount: 1, originalCall: ORIGINAL_CALL, diagnosticCall: DIAGNOSTIC_CALL, addedImport: ADDED_IMPORT.trim(),
      documentation: 'https://nodejs.org/docs/latest-v24.x/api/module.html#moduleregisterhooksoptions' },
    timing: 'Original complete smoke ordering, fixtures, inputs, sleeps, assertions, and exit behavior; no filter or retry.',
    limitations: [
      'Pointer/timer observation and pre-navigation/end-of-callback CDP snapshots may perturb timing. This is diagnostic evidence, not an uninstrumented release result.',
      'Zero-timeout callbacks are attributed only to the active pointer dispatch, not a source stack. DOM order is read only immediately before/after an observed callback.',
      'The observer does not force timer-before-click ordering. A passing full context does not establish a fix or the cause of the historical failure.',
      'Pre-navigation capture covers the open() navigation path used by the pinned D052 source. Browser crashes can prevent a final snapshot.',
      'Historical assertions can be caught within d052Smoke: callback-returned alone does not mean a test passed. Consult the raw original D052 evidence and runner exit code.',
    ],
    runnerCompletedNormally: false, sessions: [],
  };
  const persist = () => {
    manifest.sessions = releaseTraceSummary();
    fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(manifest, null, 2) + '\n');
  };
  const originalEvidence = path.join(ROOT, 'scratch/shots/D052-evidence.json');
  const initialEvidence = fs.existsSync(originalEvidence) ? fs.statSync(originalEvidence).mtimeMs : null;
  const onExit = code => {
    manifest.originalProcessExitCode = code; manifest.endedAt = new Date().toISOString();
    manifest.sessions = releaseTraceSummary();
    try {
      if (manifest.sessions.length && fs.existsSync(originalEvidence)) {
        const raw = fs.readFileSync(originalEvidence), modified = fs.statSync(originalEvidence).mtimeMs;
        // Preserve the exact original bytes, including its assertion stacks.
        fs.writeFileSync(path.join(out, 'D052-original-evidence.json'), raw);
        manifest.originalD052Evidence = { file: 'D052-original-evidence.json', sha256: sha(raw),
          changedSinceInvocation: modified !== initialEvidence };
      }
      persist();
    } catch (error) { console.error('D074 final diagnostic persistence failed; original exit code is unchanged:', error); }
  };
  process.once('exit', onExit);
  persist();
  console.log(`D074 full-context diagnostic artifact: ${manifest.artifactDirectory}/evidence.json`);
  const hooks = registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      if (url !== RUNNER) return result;
      assert.equal(manifest.hook.transformCount, 0, 'the original full runner must load exactly once');
      const source = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
      const transformed = transformOriginalSmoke(source);
      manifest.hook.transformCount++; manifest.hook.transformedSha256 = sha(transformed); persist();
      console.log(`D074 hook: ${ORIGINAL_SMOKE_SHA256}; one D052 argument replacement plus one import; all other source bytes unchanged.`);
      return { ...result, source: transformed };
    },
  });
  try {
    // This is the only invocation. The historical runner owns all logging and
    // process.exit(1); errors are recorded and rethrown without normalization.
    await import(RUNNER);
    manifest.runnerCompletedNormally = true;
    assert.equal(manifest.hook.transformCount, 1, 'the original full runner was transformed once');
  } catch (error) {
    manifest.runnerError = { name: error?.name ?? '', message: error?.message ?? String(error), stack: error?.stack ?? '' };
    throw error;
  } finally {
    hooks.deregister();
    try { persist(); } catch (error) { console.error('D074 diagnostic persistence failed:', error); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runFullContextDiagnostic();
