// D102 outer source lease generator. Pins all267 D100 current files at the
// declared baseline; exactly the seven D102 history files carry their D100
// `before` bytes and the new `afterSha256`. Writes the fixtures manifest and the
// generated lease entry. Never overwrites.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D100_CURRENT_PATHS} from './d100-source.mjs';
import {D102_BASELINE, D102_CURRENT_PATHS, D102_MODIFIED} from './d102-source-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: ROOT, maxBuffer: 32e6});
const inventory = () => fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();

const arg = name => {
  const index = process.argv.indexOf('--' + name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const baseline = arg('baseline') ?? D102_BASELINE;
assert.match(baseline, /^[a-f0-9]{40}$/, 'explicit 40-hex baseline required');

const atBaseline = git('ls-tree', '-r', '--name-only', baseline, 'src').toString().trim().split('\n').sort();
assert.deepEqual(atBaseline, D100_CURRENT_PATHS, 'baseline src inventory is exactly the D100 current 267');
assert.deepEqual(inventory(), D102_CURRENT_PATHS, 'working src inventory is still exactly the 267');

const baselineFiles = {};
const modified = {};
for (const file of D100_CURRENT_PATHS) {
  const committed = git('show', baseline + ':' + file);
  const current = fs.readFileSync(path.join(ROOT, file));
  baselineFiles[file] = sha(committed);
  if (D102_MODIFIED.includes(file)) {
    assert.ok(!current.equals(committed), 'declared D102 modification changes bytes: ' + file);
    modified[file] = {before: committed.toString('utf8'), beforeSha256: sha(committed), afterSha256: sha(current)};
  } else {
    assert.ok(current.equals(committed), 'undeclared source stays byte-unchanged: ' + file);
  }
}
const ordered = Object.fromEntries(D102_MODIFIED.map(file => [file, modified[file]]));
const manifest = {
  schema: 1,
  baseline,
  qualification: 'D102 outer lease: all267 D100 current source files byte-exact at the declared baseline, of which exactly seven are modified to record steel-mill construction acceleration as history event 25 (city format 11): journal.ts, save.ts, city.ts, day.ts, decisions.ts (history parameter types only), eventRegistry.ts, replay.ts. cityView.ts is untouched. Every downward projection hands the D100 bytes to the D100, D099 and D090 chains. No source is added; economy.ts and the Lab-parity call line in day.ts are unchanged.',
  baselineFiles,
  modified: ordered,
};
const bytes = JSON.stringify(manifest, null, 2) + '\n';
const digest = sha(bytes);
const fixtures = path.join(ROOT, 'fixtures/d102/source.json');
const entryFile = path.join(ROOT, 'tools/d102-source.mjs');
assert.ok(!fs.existsSync(fixtures), 'never overwrite an existing D102 manifest');
assert.ok(!fs.existsSync(entryFile), 'never overwrite an existing D102 entry');
fs.mkdirSync(path.dirname(fixtures), {recursive: true});
fs.writeFileSync(fixtures, bytes);
const entry = `// Exact D102 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD102Lease} from './d102-source-contract.mjs';
export * from './d102-source-contract.mjs';
export const D102_MANIFEST_SHA='${digest}';
const lease=createD102Lease(fs.readFileSync(new URL('../fixtures/d102/source.json',import.meta.url),'utf8'),D102_MANIFEST_SHA);
export const {d102PriorSource,d102PriorInventory,d100PriorSource,d100PriorInventory,d099PriorSource,d099PriorInventory,d090PriorSource,d090PriorInventory,d085PriorSource,d084PriorSource,d084PriorInventory}=lease;
`;
fs.writeFileSync(entryFile, entry);
console.log(JSON.stringify({baseline, baselineFiles: Object.keys(baselineFiles).length, modified: Object.keys(ordered), manifestSha256: digest, after: Object.fromEntries(Object.entries(ordered).map(([f, r]) => [f, r.afterSha256]))}));
