// D097 successor source allowance — preview verifier.
// Derives the 263 released pins from fixtures/d090/source.json (no git history
// needed), then proves the preview pins them and exactly the two prototypes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {D090_CURRENT_PATHS} from '../../../tools/d090-source.mjs';
import {D097_ADDED, D097_BASELINE, D097_CURRENT_PATHS} from './d097-source-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

export function releasedPins() {
  const d090 = JSON.parse(read('fixtures/d090/source.json'));
  const pins = {};
  for (const file of D090_CURRENT_PATHS) {
    pins[file] = Object.hasOwn(d090.added, file) ? d090.added[file]
      : Object.hasOwn(d090.modified, file) ? d090.modified[file].afterSha256
      : d090.baselineFiles[file];
    assert.match(pins[file] ?? '', /^[a-f0-9]{64}$/, 'released pin exists for ' + file);
  }
  return pins;
}

export function verifyPreview(manifestText, prototypeText) {
  assert.equal(typeof manifestText, 'string', 'preview manifest text required');
  const manifest = JSON.parse(manifestText);
  assert.deepEqual(Object.keys(manifest), ['schema', 'baseline', 'qualification', 'baselineFiles', 'added']);
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.baseline, D097_BASELINE, 'exact declared baseline');
  assert.ok(manifest.qualification.length > 0, 'qualification text required');
  assert.deepEqual(Object.keys(manifest.baselineFiles), D090_CURRENT_PATHS, 'exactly the released 263 in order');
  assert.deepEqual(manifest.baselineFiles, releasedPins(), 'every released source pin unchanged');
  assert.deepEqual(Object.keys(manifest.added), D097_ADDED, 'exactly the two declared additions');
  for (const file of D097_ADDED) {
    assert.equal(typeof prototypeText[file], 'string', 'prototype bytes available: ' + file);
    assert.equal(manifest.added[file], sha(prototypeText[file]), 'added pin equals shipped prototype bytes: ' + file);
    assert.ok(!Object.hasOwn(manifest.baselineFiles, file), 'addition is absent from the released 263: ' + file);
  }
  assert.equal(new Set([...D090_CURRENT_PATHS, ...D097_ADDED]).size, D097_CURRENT_PATHS.length, 'exact265 unique inventory');
  return {
    baseline: manifest.baseline,
    baselineFiles: Object.keys(manifest.baselineFiles).length,
    added: Object.keys(manifest.added).length,
    inventory: D097_CURRENT_PATHS.length,
    manifestSha256: sha(manifestText),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifestText = read('proposals/d097/source-successor/source.successor.preview.json');
  const prototypeText = Object.fromEntries(D097_ADDED.map(file =>
    [file, read('proposals/d097/sim/' + path.basename(file))]));
  const summary = verifyPreview(manifestText, prototypeText);
  const working = fs.readdirSync(path.join(ROOT, 'src'), {recursive: true, withFileTypes: true})
    .filter(entry => entry.isFile())
    .map(entry => path.relative(ROOT, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
    .sort();
  assert.deepEqual(working, D090_CURRENT_PATHS, 'working src stays exactly the released 263');
  const pins = releasedPins();
  for (const file of D090_CURRENT_PATHS) assert.equal(sha(read(file)), pins[file], 'working src byte equals released pin: ' + file);
  assert.ok(!working.some(file => D097_ADDED.includes(file)), 'no declared addition sits in src before activation');
  console.log(JSON.stringify({...summary, workingSrcFiles: working.length, srcBytes: 'equal released pins', active: false}));
}
