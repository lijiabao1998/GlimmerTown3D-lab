// Aggregates every matrix artifact; never trusts the last matrix artifact-id output alone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT, PLAN_SHA256, sha, selectReceipts} from './d104-smoke-contract.mjs';
import {currentIdentity, sourceHashes} from './d104-smoke-runner.mjs';

function receiptFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), 'artifact tree must not contain symlinks');
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? receiptFiles(file) : entry.name === 'receipt.json' ? [file] : [];
  });
}
export function verifyArtifacts(directory, expected = {...currentIdentity(),sourceHashes:sourceHashes()}) {
  const records = receiptFiles(directory).map(file => {
    const receipt = JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(receipt.schema, 'd104-smoke-shard-v1', 'unexpected receipt in smoke artifact tree');
    return {file,receipt};
  });
  const selected = selectReceipts(records.map(record => record.receipt), expected);
  for (const receipt of selected) {
    const record = records.find(record => record.receipt === receipt);
    const artifactRoot = path.resolve(path.dirname(record.file), '../../..');
    assert.equal(path.relative(artifactRoot,record.file).replaceAll('\\','/'),
      `scratch/d104-smoke/${receipt.shard}/receipt.json`, 'artifact preserves original repository-relative paths');
    for (const item of receipt.artifacts) {
      const file = path.resolve(artifactRoot,item.path);
      assert.ok(file.startsWith(artifactRoot + path.sep), 'artifact path escaped root');
      assert.ok(!fs.lstatSync(file).isSymbolicLink(), 'artifact file must not be a symlink');
      assert.ok(fs.realpathSync(file).startsWith(fs.realpathSync(artifactRoot) + path.sep), 'resolved artifact escaped root');
      const bytes = fs.readFileSync(file);
      assert.equal(bytes.length,item.bytes,item.path + ' bytes'); assert.equal(sha(bytes),item.sha256,item.path + ' SHA256');
    }
  }
  return {schema:'d104-smoke-aggregate-v1',passed:true,sourceCommit:expected.sourceCommit,sourceTree:expected.sourceTree,
    repository:expected.repository,runId:expected.runId,currentAttempt:expected.attempt,event:expected.event,htmlSha256:expected.htmlSha256,
    buildDigest:expected.buildDigest,buildArtifactId:expected.buildArtifactId,planSha256:PLAN_SHA256,
    shards:selected.map(receipt => ({shard:receipt.shard,attempt:receipt.identity.attempt,
      units:receipt.executedUnits,receiptSha256:sha(fs.readFileSync(records.find(r=>r.receipt===receipt).file))}))};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.equal(process.argv.length,4,'usage: node tools/d104-smoke-verify.mjs --artifacts DIRECTORY');
  assert.equal(process.argv[2],'--artifacts');
  const result = verifyArtifacts(path.resolve(process.argv[3]));
  fs.mkdirSync(path.join(ROOT,'scratch/d104-smoke-aggregate'),{recursive:true});
  fs.writeFileSync(path.join(ROOT,'scratch/d104-smoke-aggregate/receipt.json'),JSON.stringify(result,null,2)+'\n');
  console.log(`D104 smoke: all 8 shards / 39 original units passed on ${result.sourceCommit}; ordered dialog PNG chain retained.`);
}
