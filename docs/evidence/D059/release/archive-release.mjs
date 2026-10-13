import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd(), scratch = path.join(root, 'scratch/d059-release');
const release = 'b8954fcae4d3b80bc49b6512fb7622f69d711998';
const expectedHTML = '4515f6a815d3450a1b7b271000955d4ed57fe6a8b2f694cbc73e0b4d8b24a8a8';
const sha = b => createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(path.join(scratch, p), 'utf8'));
const identity = read('release-identity.json'), ci = read('ci-main-audit.json'), report = read('public/report.json'), originalManifest = read('public/artifact-manifest.json');
assert.equal(identity.release, release); assert.equal(identity.pullRequest.merged, true);
assert.equal(ci.headSha, release); assert.equal(ci.status, 'completed'); assert.equal(ci.conclusion, 'success');
for (const name of ['smoke', 'd055', 'd059', 'pages']) assert.equal(ci.jobs.find(j => j.name === name)?.conclusion, 'success');
assert.equal(ci.unit.ok, 660); assert.equal(ci.unit.ng, 0); assert.equal(ci.browser.ok, 850); assert.equal(ci.browser.ng, 0);
assert.equal(ci.d054.ok, 105); assert.equal(ci.d054.ng, 0);
assert.ok(ci.pages.deployments.some(d => d.sha === release && d.state === 'success'));
const jobLog = fs.readFileSync(path.join(scratch, ci.originalJobLog.path));
assert.equal(jobLog.length, ci.originalJobLog.bytes); assert.equal(sha(jobLog), ci.originalJobLog.sha256);
assert.equal(report.passed, true); assert.equal(report.expected.commit, release); assert.equal(report.expected.htmlSha256, expectedHTML);
assert.equal(report.cases.length, 3); assert.equal(originalManifest.passed, true);
assert.deepEqual(report.sourceAfter, report.source); assert.equal(report.source.commit, release);
assert.equal(report.fetch.sha256, expectedHTML); assert.equal(report.fetch.status, 200);
let documents = 0, images = 0;
for (const item of report.cases) {
  assert.equal(item.passed, true); assert.equal(item.navigations.length, 3); assert.equal(item.responseBodies.length, 3); assert.equal(item.shots.length, 7);
  for (const nav of item.navigations) { assert.equal(nav.status, 200); assert.equal(nav.securityState, 'secure'); assert.equal(nav.htmlSha256, expectedHTML); }
  for (const b of item.responseBodies) { const raw = fs.readFileSync(path.join(scratch, 'public', b.file)); assert.equal(sha(raw), expectedHTML); assert.equal(raw.length, b.bytes); documents++; }
  for (const shot of item.shots) { const raw = fs.readFileSync(path.join(scratch, 'public', shot.file)); assert.equal(sha(raw), shot.sha256); assert.equal(raw.length, shot.bytes); assert.equal(raw.readUInt32BE(16), item.viewport.W); assert.equal(raw.readUInt32BE(20), item.viewport.H); images++; }
  for (const key of ['appErrors', 'appFailures', 'unexpectedRequests', 'unsuccessfulResponses']) assert.deepEqual(item.network[key], []);
}
assert.equal(documents, 9); assert.equal(images, 21);
for (const [name, f] of Object.entries(originalManifest.files)) { const raw = fs.readFileSync(path.join(scratch, 'public', name)); assert.equal(sha(raw), f.sha256); assert.equal(raw.length, f.bytes); }
assert.equal(sha(fs.readFileSync(path.join(scratch, 'd059-public-verification.mjs'))), report.harness.sha256);
const evidence = path.join(root, 'docs/evidence/D059/release'), pictures = path.join(root, 'docs/img/D059/public');
assert.equal(fs.existsSync(evidence), false, 'never overwrite archived evidence'); assert.equal(fs.existsSync(pictures), false);
const planned = [];
const add = (src, dst) => planned.push({ source: path.join(scratch, src), destination: dst });
for (const name of ['release-identity.json', 'ci-main-run.json', 'ci-main-audit.json', 'ci-main-smoke-job-log.txt', 'ci-main-pages-job-log.txt', 'ci-main-unit-original-lines.txt', 'pages-main-deployments.json', 'public-before-deploy.json', 'd059-public-verification.mjs', 'pin-release.mjs', 'archive-release.mjs']) add(name, path.join(evidence, name));
for (const deployment of ci.pages.deployments) add('pages-main-deployment-' + deployment.deploymentId + '-statuses.json', path.join(evidence, 'pages-main-deployment-' + deployment.deploymentId + '-statuses.json'));
for (const name of fs.readdirSync(path.join(scratch, 'public')).filter(n => n.endsWith('.json') || n.endsWith('.txt'))) add('public/' + name, path.join(evidence, 'public', name));
for (const item of report.cases) for (const shot of item.shots) add('public/' + shot.file, path.join(pictures, shot.file));
for (const file of planned) assert.ok(fs.statSync(file.source).isFile());
const inventory = planned.map(f => { const b = fs.readFileSync(f.source); return { file: path.relative(root, f.destination).replaceAll('\\', '/'), bytes: b.length, sha256: sha(b) }; });
if (!process.argv.includes('--write')) { console.log(JSON.stringify({ verified: true, documents, images, files: inventory.length, bytes: inventory.reduce((n, f) => n + f.bytes, 0), inventory }, null, 2)); }
else {
  for (const file of planned) { fs.mkdirSync(path.dirname(file.destination), { recursive: true }); fs.copyFileSync(file.source, file.destination); }
  const archive = { archivedAt: new Date().toISOString(), release, sourceDirectory: 'scratch/d059-release', documentsVerified: documents, screenshotsVerified: images, originalManifest: 'public/artifact-manifest.json', qualifications: ['All nine original complete HTTPS document bodies were read and SHA-verified before archival. The duplicate HTML bodies remain in ignored project scratch; their original file hashes and byte lengths are retained in the original manifest and report.', 'All 21 public screenshots are archived in docs/img/D059/public; report shot file basenames resolve there.', 'Raw network events, world snapshots, source manifest, fixture and original reports are archived. Favicon decoration remains separate from application errors.', 'The verifier is archived as exact historical evidence. To rerun, use the pinned release checkout and explicit D059_RELEASE_ROOT/D059_PUBLIC_OUT environment paths. Later documentation-only HEADs do not satisfy its release pin.'], files: inventory };
  fs.writeFileSync(path.join(evidence, 'archive-inventory.json'), JSON.stringify(archive, null, 2));
  console.log('ARCHIVED', inventory.length, 'files;', documents, 'HTTPS bodies verified;', images, 'public screenshots');
}
