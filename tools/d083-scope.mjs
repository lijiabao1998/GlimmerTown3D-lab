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
export const D083_ADDED = new Set(added);
export const D083_CHANGED = Object.freeze([...added, ...modified]);
export const D083_CURRENT_PATHS = Object.freeze([...D082_CURRENT_PATHS, ...added].sort());
const pins = { ...prior, ...manifest.added };
for (const [file, entry] of Object.entries(manifest.modified)) {
  assert.equal(entry.beforeSha256, prior[file], file + ' immutable D082 pin');
  assert.ok(entry.replacements.length > 0, file + ' finite inverse');
  pins[file] = entry.afterSha256;
}
export function d083HistoricalBytes(file, read = diskRead) {
  assert.ok(Object.hasOwn(pins, file), file + ' belongs to D083 source inventory');
  assert.equal(typeof read, 'function', file + ' exact allowed source: reader required');
  const current = read(file);
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
  assertD083Inventory(files);
  for (const file of files) d083HistoricalBytes(file, read);
  return files.length;
}
export function isD083ReviewedSource(file, read = diskRead) {
  if (!D083_CHANGED.includes(file)) return false;
  d083HistoricalBytes(file, read);
  return true;
}
