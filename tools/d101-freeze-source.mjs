// D101 outer source lease generator. Pins all267 D102 current files at the
// declared baseline (main 76e074f); exactly the seven D101 transit save/UI files
// carry their D102 `before` bytes and the new `afterSha256`; the two new transit
// sources are pinned in `added`. Writes fixtures/d101/source.json and the
// generated entry tools/d101-source.mjs. Never overwrites either output.
// Usage: node tools/d101-freeze-source.mjs --baseline 76e074ff66f01e5e0ced8c946b13584226f0d6b6
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {D102_CURRENT_PATHS} from './d102-source.mjs';
import {D101_ADDED, D101_BASELINE, D101_CURRENT_PATHS, D101_MODIFIED, createD101Lease} from './d101-source-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: ROOT, maxBuffer: 32e6});
export const D101_FIXTURE = 'fixtures/d101/source.json';
export const D101_ENTRY = 'tools/d101-source.mjs';
export const D101_QUALIFICATION = 'D101 outer lease: all267 D102 current source files byte-exact at the declared baseline (main 76e074f), of which exactly seven are modified to record, save, replay, build/undo and draw the transit network: cityView.ts, journal.ts, save.ts, city.ts, edit.ts, eventRegistry.ts, replay.ts; exactly two sources are added: src/render/transitArt.ts and src/sim/transit/history.ts (267 + 2 = 269). Every downward projection hands the D102 bytes to the D102, D100, D099 and D090 chains; the added files project to an empty string. day.ts, decisions.ts and the D099/D100 transit model sources are unchanged.';
const inventory = () => fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
  .filter(entry => entry.isFile())
  .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort();

// The generated entry for a manifest digest (pure).
export const d101LeaseEntry = digest => `// Exact D101 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD101Lease} from './d101-source-contract.mjs';
export * from './d101-source-contract.mjs';
export const D101_MANIFEST_SHA='${digest}';
const lease=createD101Lease(fs.readFileSync(new URL('../fixtures/d101/source.json',import.meta.url),'utf8'),D101_MANIFEST_SHA);
export const {d101PriorSource,d101PriorInventory,d102PriorSource,d102PriorInventory,d100PriorSource,d100PriorInventory,d099PriorSource,d099PriorInventory,d090PriorSource,d090PriorInventory,d085PriorSource,d084PriorSource,d084PriorInventory}=lease;
`;

// Pure computation (reads git and the working tree, writes nothing).
export function d101FreezeSource(baseline = D101_BASELINE) {
  assert.match(baseline, /^[a-f0-9]{40}$/, 'explicit 40-hex baseline required');
  assert.equal(baseline, D101_BASELINE, 'the baseline is the declared D101_BASELINE');
  const atBaseline = git('ls-tree', '-r', '--name-only', baseline, 'src').toString().trim().split('\n').sort();
  assert.deepEqual(atBaseline, D102_CURRENT_PATHS, 'baseline src inventory is exactly the D102 current 267');
  assert.deepEqual(inventory(), D101_CURRENT_PATHS, 'working src inventory is exactly the declared 269');
  const baselineFiles = {}, modified = {}, added = {};
  for (const file of D102_CURRENT_PATHS) {
    const committed = git('show', baseline + ':' + file);
    const current = fs.readFileSync(path.join(ROOT, file));
    baselineFiles[file] = sha(committed);
    if (D101_MODIFIED.includes(file)) {
      assert.ok(!current.equals(committed), 'declared D101 modification changes bytes: ' + file);
      modified[file] = {before: committed.toString('utf8'), beforeSha256: sha(committed), afterSha256: sha(current)};
    } else {
      assert.ok(current.equals(committed), 'undeclared source stays byte-unchanged: ' + file);
    }
  }
  for (const file of D101_ADDED) {
    assert.ok(!Object.hasOwn(baselineFiles, file), 'declared addition is absent at baseline: ' + file);
    added[file] = sha(fs.readFileSync(path.join(ROOT, file)));
  }
  const manifest = {
    schema: 1,
    baseline,
    qualification: D101_QUALIFICATION,
    baselineFiles,
    modified: Object.fromEntries(D101_MODIFIED.map(file => [file, modified[file]])),
    added: Object.fromEntries(D101_ADDED.map(file => [file, added[file]])),
  };
  const bytes = JSON.stringify(manifest, null, 2) + '\n';
  const digest = sha(bytes);
  createD101Lease(bytes, digest);
  const entry = d101LeaseEntry(digest);
  return {manifest, bytes, digest, entry};
}

export function d101WriteSource(baseline = D101_BASELINE) {
  const fixtures = path.join(ROOT, D101_FIXTURE), entryFile = path.join(ROOT, D101_ENTRY);
  assert.ok(!fs.existsSync(fixtures), 'never overwrite an existing D101 manifest');
  assert.ok(!fs.existsSync(entryFile), 'never overwrite an existing D101 entry');
  const {manifest, bytes, digest, entry} = d101FreezeSource(baseline);
  fs.mkdirSync(path.dirname(fixtures), {recursive: true});
  fs.writeFileSync(fixtures, bytes);
  fs.writeFileSync(entryFile, entry);
  return {baseline, baselineFiles: Object.keys(manifest.baselineFiles).length, modified: Object.keys(manifest.modified), added: manifest.added, manifestSha256: digest, after: Object.fromEntries(Object.entries(manifest.modified).map(([f, r]) => [f, r.afterSha256]))};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--baseline');
  const baseline = index < 0 ? undefined : process.argv[index + 1];
  assert.ok(baseline, '--baseline <40hex> is required');
  console.log(JSON.stringify(d101WriteSource(baseline)));
}
