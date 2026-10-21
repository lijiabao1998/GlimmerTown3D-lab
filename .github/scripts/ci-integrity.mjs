// CI-only provenance checks. No application tests or acceptance limits live here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const STAGES = ['build', 'node', 'node-frame', 'node-frame-d079', 'node-frame-d080', 'node-frame-d081', 'node-frame-d082', 'browser', 'screenshots'];
export const digest = value => createHash('sha256').update(value).digest('hex');

export function filesIn(dir, root = dir) {
  assert.ok(fs.lstatSync(dir).isDirectory(), 'dist must be a directory');
  return fs.readdirSync(dir).sort().flatMap(name => {
    const file = path.join(dir, name), stat = fs.lstatSync(file);
    assert.ok(!stat.isSymbolicLink(), `build symlinks are not allowed: ${file}`);
    if (stat.isDirectory()) return filesIn(file, root);
    assert.ok(stat.isFile(), `build entry is not a regular file: ${file}`);
    return [{ path: path.relative(root, file).split(path.sep).join('/'), size: stat.size, sha256: digest(fs.readFileSync(file)) }];
  });
}

export function record(root, identity) {
  const files = filesIn(path.join(root, 'dist'));
  assert.ok(files.some(f => f.path === 'index.html' && f.size > 0), 'nonempty dist/index.html is required');
  return JSON.stringify({ schema: 1, ...identity, files }, null, 2) + '\n';
}

export function verify(root, raw, expectedDigest, identity) {
  assert.match(expectedDigest ?? '', /^[a-f0-9]{64}$/, 'expected manifest digest is required');
  assert.equal(digest(raw), expectedDigest, 'manifest differs from the build job output');
  const manifest = JSON.parse(raw);
  assert.equal(manifest.schema, 1, 'unknown build manifest version');
  for (const field of ['repository', 'sha', 'tree', 'runId', 'event']) {
    assert.equal(manifest[field], identity[field], `wrong build ${field}`);
  }
  // Re-running failed jobs may consume the successful build from an earlier attempt
  // of this exact run. The artifact ID and digest still come from that build job.
  assert.ok(Number.isInteger(manifest.attempt) && manifest.attempt > 0 && manifest.attempt <= identity.attempt, 'wrong build attempt');
  assert.deepEqual(manifest.files, filesIn(path.join(root, 'dist')), 'missing, extra, or changed build files');
  assert.ok(manifest.files.some(f => f.path === 'index.html' && f.size > 0), 'nonempty dist/index.html is required');
  return manifest;
}

export function requireSuccess(needs) {
  assert.deepEqual(Object.keys(needs).sort(), [...STAGES].sort(), 'every split stage is required');
  for (const stage of STAGES) {
    assert.equal(needs[stage]?.result, 'success', `${stage} did not succeed`);
  }
  for (const stage of ['build', 'node-frame', 'node-frame-d079', 'node-frame-d080', 'node-frame-d081', 'node-frame-d082', 'browser', 'screenshots']) {
    assert.match(needs[stage]?.outputs?.['artifact-id'] ?? '', /^\d+$/, `${stage} evidence artifact is required`);
  }
  assert.match(needs.build.outputs.digest ?? '', /^[a-f0-9]{64}$/, 'build digest is required');
}

function currentIdentity() {
  const git = arg => execFileSync('git', ['rev-parse', arg], { encoding: 'utf8' }).trim();
  const sha = git('HEAD');
  assert.match(process.env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
  assert.equal(sha, process.env.GITHUB_SHA, 'checkout must be the exact workflow SHA, including PR merge context');
  assert.match(process.env.GITHUB_RUN_ID ?? '', /^\d+$/);
  assert.match(process.env.GITHUB_RUN_ATTEMPT ?? '', /^[1-9]\d*$/);
  assert.ok(process.env.GITHUB_REPOSITORY && process.env.GITHUB_EVENT_NAME, 'workflow identity is required');
  return { repository: process.env.GITHUB_REPOSITORY, sha, tree: git('HEAD^{tree}'), runId: process.env.GITHUB_RUN_ID,
    event: process.env.GITHUB_EVENT_NAME, attempt: Number(process.env.GITHUB_RUN_ATTEMPT) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2], root = process.cwd();
  if (command === 'gate') {
    const needs = JSON.parse(process.env.CI_NEEDS ?? '{}');
    requireSuccess(needs);
    console.log('All eight stages and their evidence artifacts succeeded.');
  } else if (command === 'record') {
    const raw = record(root, currentIdentity()), hash = digest(raw);
    fs.writeFileSync('ci-build.json', raw);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `digest=${hash}\n`);
    console.log(raw, `Manifest SHA-256: ${hash}`);
  } else if (command === 'verify') {
    const manifest = verify(root, fs.readFileSync('ci-build.json', 'utf8'), process.env.CI_BUILD_DIGEST, currentIdentity());
    console.log(`Verified build: ${manifest.sha}, tree ${manifest.tree}, run ${manifest.runId}, build attempt ${manifest.attempt}`);
    console.log(manifest.files);
  } else {
    throw new Error('Expected record, verify, or gate');
  }
}
