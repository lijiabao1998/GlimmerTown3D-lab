import {D084_CHANGED,D084_ADDED,d084PriorSource,d084PriorInventory} from './d089-source.mjs';
import {releaseHistoricalSource,releaseSourceManifest} from './d082-release-source-v2.mjs';
// Finite D083 source accounting only. Runtime imports always use the product.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ROOT } from './cdp.mjs';
import { D082_CURRENT_PATHS, D082_REVIEWED_SOURCES } from './d082-source-restoration.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const bytes = diskRead('fixtures/d083-source-scope.json');
assert.equal(sha(bytes), 'bfc9a922069c1bf1f828db4ead37eddf43712bce9fda61893b032e700eab9ddb', 'immutable finite D083 source manifest');
const manifest = JSON.parse(bytes);
assert.equal(manifest.schema, 1);
assert.equal(manifest.baseline, '7deb34881b38679b1d0396e21eb9e57ad2ee9a0c');
assert.equal(manifest.source, '7bc5609d92ca7a9971f3a2ac0ff80a86ddacd07e');
const prior = { ...JSON.parse(diskRead('fixtures/d082-art-scope.json')).after, ...D082_REVIEWED_SOURCES };
const added = ['src/content/britishRuralHeritage.ts', 'src/render/britishRuralHeritageArt.ts', 'src/render/d083AcceptedModels.d.mts', 'src/render/d083AcceptedModels.mjs', 'src/sim/heritageBuild.ts'];
const modified = ['src/cityView.ts', 'src/content/gallery.ts', 'src/content/kindShapes.ts', 'src/content/kinds.ts', 'src/render/kindArt.ts', 'src/sim/edit.ts', 'src/ui/growthGuide.ts'];
assert.deepEqual(Object.keys(prior).sort(), D082_CURRENT_PATHS, 'exact D082 231-path inventory retained');
assert.deepEqual(Object.keys(manifest.added).sort(), added, 'only five exact D083 additions');
assert.deepEqual(Object.keys(manifest.modified).sort(), modified, 'only seven exact D083 changes');
// Outer current additions include the explicitly versioned D082 technical file; historical added stays five.
export const D083_ADDED = new Set([...added,...Object.keys(releaseSourceManifest().added),...D084_ADDED]);
export const D083_CHANGED = Object.freeze([...added, ...modified]);
export const D083_CURRENT_PATHS = Object.freeze([...D082_CURRENT_PATHS, ...added].sort());
const pins = { ...prior, ...manifest.added };
for (const [file, entry] of Object.entries(manifest.modified)) {
  assert.equal(entry.beforeSha256, prior[file], file + ' immutable D082 pin');
  assert.ok(entry.replacements.length > 0, file + ' finite inverse');
  pins[file] = entry.afterSha256;
}
export function d083HistoricalBytes(file, read = diskRead) {
  if(D084_ADDED.includes(file))return d084PriorSource(file,read(file));
  if(Object.hasOwn(releaseSourceManifest().added,file))return releaseHistoricalSource(file,read);
  assert.ok(Object.hasOwn(pins, file), file + ' belongs to D083 source inventory');
  assert.equal(typeof read, 'function', file + ' exact allowed source: reader required');
  const current = releaseHistoricalSource(file, read);
  assert.equal(typeof current, 'string', file + ' exact allowed source: actual text required');
  assert.equal(sha(current), pins[file], file + ' exact allowed source');
  if (D083_ADDED.has(file)) return '';
  let restored = current;
  for (const entry of manifest.modified[file]?.replacements ?? []) {
    assert.equal(restored.split(entry.after).length, 2, file + ' unique finite D083 inverse');
    restored = restored.replace(entry.after, () => entry.before);
  }
  assert.equal(sha(restored), prior[file], file + ' exact D082 source restored');
  return restored;
}
export function assertD083Inventory(files) {
  assert.deepEqual([...files].sort(), D083_CURRENT_PATHS, 'D083 exact source inventory');
  return files.length;
}
export function assertD083Scope(read = diskRead) {
  const files = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true, withFileTypes: true })
    .filter(e => e.isFile()).map(e => path.relative(ROOT, path.join(e.parentPath, e.name)).replaceAll('\\', '/')).sort();
  const priorFiles = releasePriorInventory(files, read);
  for (const file of priorFiles) d083HistoricalBytes(file, read);
  return priorFiles.length;
}
export function d083PriorSourceFiles(files, read = diskRead) {
  const priorFiles = releasePriorInventory(files, read);
  for (const file of priorFiles) d083HistoricalBytes(file, read);
  return priorFiles.filter(file => !D083_ADDED.has(file));
}
export function isD083ReviewedSource(file, read = diskRead) {
  if(D084_CHANGED.includes(file)){d084PriorSource(file,read(file));return true;}
  if (!D083_CHANGED.includes(file)&&!Object.hasOwn(releaseSourceManifest().added,file)) return false;
  d083HistoricalBytes(file, read);
  return true;
}
// Compose a new outer permission without changing the original Windows-only
// predicate or reclassifying existing D083 sources as historical additions.
export function withD083SourceAllowance(windowsOnly) {
  assert.equal(typeof windowsOnly, 'function', 'original Windows predicate required');
  return function d083ReviewedExistingSource(file, read = diskRead) {
    return isD083ReviewedSource(file, read) || windowsOnly(file, read);
  };
}
// A single tool boundary is qualified independently of the twelve product
// sources. The original Windows qualification still checks its frozen preimage.
export function d083PriorScopeSource(current) {
  const bytes = diskRead('fixtures/d083-scope-boundary.json');
  assert.equal(sha(bytes), 'b9a1373387b9c78d54877c22f531a8e213c5b991ed4d68fa7b7d5e86560821ee', 'exact D083 scope-boundary manifest');
  const boundary = JSON.parse(bytes);
  assert.equal(boundary.file, 'tools/d082-scope.mjs');
  assert.equal(boundary.baseline, '2e85efbc265efcc4c214e21365839d0a842f995e');
  assert.equal(typeof current, 'string', 'D083 scope boundary requires actual source text');
  assert.equal(sha(current), boundary.afterSha256, 'exact D083 scope boundary');
  let prior = current;
  for (const entry of boundary.replacements) {
    assert.equal(prior.split(entry.after).length, 2, 'unique finite D083 scope-boundary inverse');
    prior = prior.replace(entry.after, () => entry.before);
  }
  assert.equal(sha(prior), boundary.beforeSha256, 'exact original D082 scope source');
  return prior;
}

// v2 has an explicit additional inventory; original D083 236-path assertion remains intact.
function releasePriorInventory(files,read){
 files=d084PriorInventory(files,read);
 const added=Object.keys(releaseSourceManifest().added);
 assert.deepEqual([...files].sort(),[...D083_CURRENT_PATHS,...added].sort(),'exact release-v2 source inventory');
 for(const file of added)releaseHistoricalSource(file,read);
 const prior=files.filter(file=>!added.includes(file));assertD083Inventory(prior);return prior;
}
