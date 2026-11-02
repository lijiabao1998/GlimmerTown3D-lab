// D097 successor source allowance — preview generator (does not activate anything).
// Pins all 263 released source files at an explicit baseline plus exactly the two
// declared D097 prototypes. Writes proposals/d097/source-successor/source.successor.preview.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D090_CURRENT_PATHS} from '../../../tools/d090-source.mjs';
import {D097_ADDED, D097_BASELINE} from './d097-source-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sha = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6}).trim();
const gitFile = file => execFileSync('git', ['show', file], {cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6});
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const inventory = () => fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();

const arg = name => {
  const index = process.argv.indexOf('--' + name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const baseline = arg('baseline') ?? D097_BASELINE;
const output = path.resolve(ROOT, arg('out') ?? 'proposals/d097/source-successor/source.successor.preview.json');

assert.match(baseline, /^[a-f0-9]{40}$/, 'explicit 40-hex baseline required');
const atBaseline = git('ls-tree', '-r', '--name-only', baseline, 'src').split('\n').sort();
assert.deepEqual(atBaseline, D090_CURRENT_PATHS, 'baseline src inventory is exactly the released 263');
const working = inventory();
assert.deepEqual(working, D090_CURRENT_PATHS, 'working src inventory is exactly the released 263 (no prototypes in src)');

const baselineFiles = {};
for (const file of D090_CURRENT_PATHS) {
  const committed = gitFile(baseline + ':' + file);
  const current = read(file);
  assert.equal(current, committed, 'baseline bytes equal working bytes before pinning: ' + file);
  baselineFiles[file] = sha(current);
}
const added = {};
for (const file of D097_ADDED) {
  const candidate = path.join(ROOT, 'proposals/d097/sim', path.basename(file));
  assert.ok(fs.existsSync(candidate), 'declared prototype exists: ' + candidate);
  added[file] = sha(fs.readFileSync(candidate, 'utf8'));
  assert.ok(!(file in baselineFiles), 'declared addition is absent at baseline: ' + file);
}
const manifest = {
  schema: 1,
  baseline,
  qualification: 'Finite reviewed successor for exactly two isolated D097 prototype files: 263 released source pins unchanged plus src/sim/transitGraph.ts and src/sim/transitMovement.ts, whose bytes are the shipped prototypes. Activation changes the D090 evidence seams and therefore requires owner review; this preview is not an active lease, not a runtime import and not a historical-golden relabel.',
  baselineFiles,
  added,
};
const bytes = JSON.stringify(manifest, null, 2) + '\n';
if (!process.argv.includes('--force')) assert.ok(!fs.existsSync(output), 'never overwrite a previous successor preview: ' + output);
fs.writeFileSync(output, bytes);
console.log(JSON.stringify({
  output: path.relative(ROOT, output).replaceAll('\\', '/'),
  baseline,
  baselineFiles: Object.keys(baselineFiles).length,
  added: Object.keys(added).length,
  manifestSha256: sha(bytes),
}));
