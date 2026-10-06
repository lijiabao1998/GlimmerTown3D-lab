// QA-only branch. Never merge. Application assets and existing tests stay unchanged.
// Tested documents come from official Pages. The local helper serves an unused
// sentinel only, never the game. Fixtures live in disposable browser profiles.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { d047ArtSmoke } from './smoke-d047-art.mjs';
import { d047MobileSmoke } from './smoke-d047-mobile.mjs';
import { d047ReviewCode, D047_ROOT } from './d047-scenes.mjs';
import { d044Load } from './d044-cities.mjs';
import { loadCode, saveCode } from '../src/io/save.ts';

export const SITE = 'https://lijiabao1998.github.io/GlimmerTown3D-lab/';
const RELEASE = '64289885a06b0b2991d94cc9f9d59e02d569242d';
const APPROVED = '3074995be8e71b13af6ea2cec2948264d8eb73d2';
const EXPECTED = '7178ca04aed7c9ee07f688586e1f1668daca1877f42e23290516184b336e54f1';
const BRANCH = 'claude/d047-live-verification', ORIGIN = new URL(SITE).origin;
const OUT = path.join(ROOT, 'scratch/live-d047'), SHOTS = path.join(ROOT, 'scratch/shots'), J = JSON.stringify;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

// The unchanged suites recognize localhost only. Their read-only request-list
// view maps official-origin URLs to that allowlist. Actual navigation and raw
// CDP requests are never rewritten, removed or routed through localhost.
// Unknown origins stay untouched and fail the independent original-origin guard.
export function compatRequestUrl(raw) {
  if (/^(data:|blob:|about:)/.test(raw)) return raw;
  const url = new URL(raw);
  return url.origin === ORIGIN ? `http://127.0.0.1:8311${url.pathname}${url.search}${url.hash}` : raw;
}
export function unexpectedRequests(requests) {
  return requests.filter(raw => {
    if (/^(data:|blob:|about:)/.test(raw)) return false;
    try { return new URL(raw).origin !== ORIGIN; } catch { return true; }
  });
}

export async function verifyLiveD047() {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
  const report = {
    site: SITE, release: RELEASE, approved: APPROVED, expectedSha256: EXPECTED,
    mode: 'Official GitHub Pages in Chromium + SwiftShader; trusted CDP touch at 412x860, not Android hardware',
    unchangedSuites: ['d047ArtSmoke: all three fixed views', 'd047MobileSmoke: all three groups, including trusted got/lost capture'],
    requestAdapter: 'Only the suite-facing request-list representation normalizes the official origin to its legacy localhost allowlist. Original URLs are independently verified and retained below. No browser navigation uses localhost.',
    setup: 'Saved-city fixtures affect fresh temporary profiles only. Existing probes and camera controls are reused unchanged. No server data, accounts, or deployments are modified.',
    checks: [], sessions: [], documentHashes: [], screenshots: [],
  };
  const writeReport = () => {
    report.passed = report.checks.filter(c => c.ok).length;
    report.failed = report.checks.filter(c => !c.ok).length;
    report.screenshots = fs.readdirSync(SHOTS).filter(name => /^D047-.*\.png$/.test(name));
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  };
  const log = (ok, name, detail = '') => {
    report.checks.push({ name, ok, detail }); console.log(ok ? 'OK' : 'NG', name, detail); writeReport();
  };
  let sequence = 0;
  const liveBrowser = async (options, run) => {
    const id = ++sequence, session = { id, viewport: [options.width, options.height], documents: 0, rawRequests: [], errors: [] };
    report.sessions.push(session);
    try {
      // The existing helper owns Chrome cleanup. Its unused local HTTP server
      // receives only a sentinel; any actual localhost request fails the guard.
      await withBrowser({ ...options, root: path.join(OUT, 'unused-host'), overlay: { 'index.html': '<!doctype html><title>Unused QA sentinel</title>' } }, async ({ page }) => {
        const verified = new Set();
        await page.send('Network.setCacheDisabled', { cacheDisabled: true });
        const verifyDocument = async () => {
          const tree = await page.send('Page.getFrameTree'), frame = tree.frameTree.frame;
          assert.equal(tree.frameTree.childFrames?.length ?? 0, 0, 'no unverified child documents');
          assert.equal(new URL(frame.url).origin + new URL(frame.url).pathname, SITE, 'actual browser document must be official Pages');
          if (verified.has(frame.loaderId)) return frame;
          const resource = await page.send('Page.getResourceContent', { frameId: frame.id, url: frame.url });
          const bytes = Buffer.from(resource.content, resource.base64Encoded ? 'base64' : 'utf8'), sha256 = hash(bytes);
          report.documentHashes.push({ session: id, url: frame.url, loaderId: frame.loaderId, sha256, bytes: bytes.length });
          assert.equal(sha256, EXPECTED, `actual document hash mismatch: ${frame.url}`);
          verified.add(frame.loaderId); session.documents++; writeReport(); return frame;
        };
        const open = async (query = '') => {
          const url = SITE + (query ? '?' + query : ''), nav = await page.send('Page.navigate', { url });
          assert.ok(!nav.errorText, nav.errorText); assert.ok(nav.loaderId, 'a real document navigation must occur');
          let ready = false;
          for (const start = Date.now(); Date.now() - start < 30000; await sleep(150)) {
            const tree = await page.send('Page.getFrameTree');
            if (tree.frameTree.frame.loaderId === nav.loaderId && await page.evaluate('!!(window.__gt&&__gt.ready)').catch(() => false)) { ready = true; break; }
          }
          assert.ok(ready, `official page did not become ready: ${url}`);
          const frame = await verifyDocument(); assert.equal(frame.url, url, 'no navigation redirect or query substitution');
          await sleep(options.settle ?? 900);
        };
        const livePage = {
          ...page,
          get requests() { return page.requests.map(compatRequestUrl); },
          evaluate: async expression => { await verifyDocument(); return page.evaluate(expression); },
          send: async (method, params = {}) => {
            assert.notEqual(method, 'Page.navigate', 'navigation must use the official verified open wrapper');
            if (method.startsWith('Input.') || method === 'Page.captureScreenshot' || method === 'Runtime.evaluate') await verifyDocument();
            return page.send(method, params);
          },
        };
        try { await run({ page: livePage, open }); }
        finally {
          session.rawRequests = [...page.requests]; session.errors = [...page.errors];
          await verifyDocument();
          const unexpected = unexpectedRequests(session.rawRequests), actualPages = session.rawRequests.filter(url => url.startsWith(SITE));
          log(!unexpected.length && actualPages.length > 0 && session.errors.length === 0,
            `Live session ${id}: original request origins and browser errors`, J({ unexpected, officialRequests: actualPages.length, errors: session.errors }));
          writeReport();
        }
      });
    } catch (error) { log(false, `Live session ${id}: official navigation/document verification`, error.stack); }
  };

  try {
    if (process.env.GITHUB_REF) assert.equal(process.env.GITHUB_REF, 'refs/heads/' + BRANCH, 'QA workflow must never run on main');
    else assert.equal(git('branch', '--show-current'), BRANCH, 'local verifier requires the isolated QA branch');
    assert.equal(git('rev-parse', APPROVED + '^{tree}'), git('rev-parse', RELEASE + '^{tree}'), 'merged release exactly matches the approved tree');
    git('diff', '--exit-code', RELEASE, '--', '.', ':(exclude).github/workflows/ci.yml', ':(exclude)tools/verify-live-d047.mjs');
    log(true, 'Source, fixtures, exported suites and CDP helper unchanged from approved release');
    report.localSha256 = hash(fs.readFileSync(path.join(ROOT, 'dist/index.html')));
    assert.equal(report.localSha256, EXPECTED, 'QA build must equal approved HTML');
    const response = await fetch(SITE, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    const bytes = Buffer.from(await response.arrayBuffer()); report.liveSha256 = hash(bytes); report.liveBytes = bytes.length;
    assert.equal(report.liveSha256, EXPECTED, 'official Pages must deploy the approved HTML before live QA');
    log(true, 'Local build and actual official HTTP 200 HTML match approved SHA256', EXPECTED);
    await d047ArtSmoke(liveBrowser, log);
    await d047MobileSmoke(liveBrowser, log);

    // Extra proof: ordinary navigation without a spaceArt flag uses the new
    // model, rather than verifying explicit current/legacy query flags only.
    await liveBrowser({ width: 412, height: 860 }, async ({ page, open }) => {
      const { KT, vrank } = d044Load(), loaded = loadCode(d047ReviewCode(), KT, vrank);
      assert.ok(loaded.ok); const code = saveCode(loaded.sim, loaded.template, loaded.start), snapshots = [];
      await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
      for (const variant of ['default', 'current', 'legacy']) {
        await open('sample=seed516&clean=1');
        await page.evaluate(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(code)})`);
        await open('style=A&tone=d' + (variant === 'default' ? '' : '&spaceArt=' + variant));
        assert.equal(await page.evaluate('new URL(location.href).searchParams.has("spaceArt")'), variant !== 'default');
        const owner = await page.evaluate(`__gt.buildingList().find(b=>b[1]===51&&b[2]===${D047_ROOT[0]}&&b[3]===${D047_ROOT[1]})?.[0]`);
        assert.ok(owner); await page.evaluate(`__gt.focusBuilding(${owner},5.2);__gt.setVisT(2.2);__gt.setDayFrac(0)`); await sleep(2850);
        const state = await page.evaluate(`({digest:__gt.sceneDigest(),cam:__gt.cam(),history:__gt.history(),box:__gt.ownerBoxes()[${owner}],info:__gt.renderInfoAll()})`);
        assert.ok(state.box); assert.ok(state.info.calls <= 18 && state.info.triangles <= 118884);
        snapshots.push({ variant, ...state });
        if (variant === 'default') {
          const shot = await page.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(SHOTS, 'D047-live-default-412x860.png'), Buffer.from(shot.data, 'base64'));
        }
      }
      assert.deepEqual(snapshots[0].digest, snapshots[1].digest, 'unflagged default geometry equals explicit current');
      assert.notDeepEqual(snapshots[0].digest, snapshots[2].digest, 'unflagged default geometry differs from legacy');
      for (const other of snapshots.slice(1)) { assert.deepEqual(snapshots[0].cam, other.cam); assert.deepEqual(snapshots[0].history, other.history); }
      report.defaultModel = snapshots.map(({ variant, info, box }) => ({ variant, info, box }));
      log(true, 'Official no-spaceArt default uses current model; differs from legacy; history and camera identical');
    });
    assert.equal(report.sessions.length, 7, 'all three art views, all three mobile groups and default verification must run');
    assert.equal(report.documentHashes.length, 25, 'all 25 actual document loads must be hashed');
    assert.ok(report.documentHashes.every(d => d.sha256 === EXPECTED));
    assert.equal(report.screenshots.length, 10, 'six art, three mobile and one default-model screenshots must exist');
    log(true, 'Complete official live coverage: seven fresh browsers, 25 approved documents, ten screenshots');
  } catch (error) { log(false, 'Live D047 verification', error.stack); }
  finally { writeReport(); }
  console.log(J({ passed: report.passed, failed: report.failed, site: SITE, expectedSha256: EXPECTED, documents: report.documentHashes.length }));
  return report.failed ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await verifyLiveD047();
