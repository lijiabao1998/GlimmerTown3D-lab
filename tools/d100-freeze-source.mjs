// D100 outer source lease generator. Pins all265 released files at the declared
// baseline plus exactly the two D100 transit model sources, then writes the
// fixtures manifest and the generated lease entry. Never overwrites.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D099_CURRENT_PATHS} from './d099-source.mjs';
import {D100_ADDED, D100_BASELINE, D100_CURRENT_PATHS} from './d100-source-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: ROOT, maxBuffer: 32e6});
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const inventory = () => fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();

const arg = name => {
  const index = process.argv.indexOf('--' + name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const baseline = arg('baseline') ?? D100_BASELINE;
assert.match(baseline, /^[a-f0-9]{40}$/, 'explicit 40-hex baseline required');

const atBaseline = git('ls-tree', '-r', '--name-only', baseline, 'src').toString().trim().split('\n').sort();
assert.deepEqual(atBaseline, D099_CURRENT_PATHS, 'baseline src inventory is exactly the D099 released 265');
assert.deepEqual(inventory(), D100_CURRENT_PATHS, 'working src inventory is exactly the declared 267');

const baselineFiles = {};
for (const file of D099_CURRENT_PATHS) {
  const committed = git('show', baseline + ':' + file);
  const current = fs.readFileSync(path.join(ROOT, file));
  assert.ok(current.equals(committed), 'released source byte-unchanged: ' + file);
  baselineFiles[file] = sha(current);
}
const added = {};
for (const file of D100_ADDED) {
  assert.ok(!(file in baselineFiles), 'declared addition is absent at baseline: ' + file);
  added[file] = sha(read(file));
}
const manifest = {
  schema: 1,
  baseline,
  qualification: 'D100 outer lease: all265 D099 released source files byte-exact at the declared baseline plus exactly the two D100 transit model sources (network.ts, format.ts); the released 265 are projected unchanged to the D099 and D090 historical chains. No historical golden, workflow, save format or product entry is changed.',
  baselineFiles,
  added,
};
const bytes = JSON.stringify(manifest, null, 2) + '\n';
const digest = sha(bytes);
const fixtures = path.join(ROOT, 'fixtures/d100/source.json');
const entryFile = path.join(ROOT, 'tools/d100-source.mjs');
assert.ok(!fs.existsSync(fixtures), 'never overwrite an existing D100 manifest');
assert.ok(!fs.existsSync(entryFile), 'never overwrite an existing D100 entry');
fs.mkdirSync(path.dirname(fixtures), {recursive: true});
fs.writeFileSync(fixtures, bytes);
const entry = `// Exact D100 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD100Lease} from './d100-source-contract.mjs';
export * from './d100-source-contract.mjs';
export const D100_MANIFEST_SHA='${digest}';
const lease=createD100Lease(fs.readFileSync(new URL('../fixtures/d100/source.json',import.meta.url),'utf8'),D100_MANIFEST_SHA);
export const {d100PriorSource,d100PriorInventory,d099PriorSource,d099PriorInventory,d090PriorSource,d090PriorInventory,d084PriorSource,d084PriorInventory}=lease;
`;
fs.writeFileSync(entryFile, entry);
console.log(JSON.stringify({baseline, baselineFiles: Object.keys(baselineFiles).length, added: Object.keys(added).length, manifestSha256: digest}));
