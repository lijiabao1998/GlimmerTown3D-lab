// D106 resolve hook (docs/D106-ci-first-use-ceiling.md): exactly five redirects, everything else
// passes through, and the exact NODE_OPTIONS of the workflow step loads the copies end to end.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {D106_GROUPS, D106_REDIRECTS, D106_HOOK} from './first-use-ceiling.mjs';
import {D106_URL_REDIRECTS, d106Redirect, resolve} from './first-use-ceiling-resolve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const url = file => pathToFileURL(path.join(ROOT, file)).href;
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const ORIGINALS = ['d086', 'd087', 'd088', 'd089', 'd090'].map(id => `proposals/${id}/browser-first-use-performance.mjs`);
const EXPECTED = {
  'proposals/d086/browser-first-use-performance.mjs': 'proposals/d106/browser-first-use-performance-d086.mjs',
  'proposals/d087/browser-first-use-performance.mjs': 'proposals/d106/browser-first-use-performance-d087.mjs',
  'proposals/d088/browser-first-use-performance.mjs': 'proposals/d106/browser-first-use-performance-d088.mjs',
  'proposals/d089/browser-first-use-performance.mjs': 'proposals/d106/browser-first-use-performance-d087.mjs',
  'proposals/d090/browser-first-use-performance.mjs': 'proposals/d106/browser-first-use-performance-d086.mjs',
};
const NODE_OPTIONS = '--import ./' + D106_HOOK;
const PROBE = `const out={};for(const id of ['d086','d087','d088','d089','d090']){const m=await import('./proposals/'+id+'/browser-first-use-performance.mjs');const r={cpuRate:6,physicalAndroid:false,cacheColdVerified:false,actualPointer:true,operation:1,firstNativeAttempt:true,previewFresh:true,commitFresh:true,newMatchingPlacements:1,selectionExactTimingAvailable:false,originalThreeSampleMedianQualified:false,previewMs:0.6,commitMs:512.3,rebuildMs:89.3,rebuildAllMs:111.9,selectionObservedElapsedMs:10};let verdict;try{verdict=m.assertD086FirstUsePerformance(r);}catch(e){verdict=e.message;}out[id]={pageFirst:m.FIRST_USE_POLICY.pageFirstCommitMaxMs??null,verdict};}console.log(JSON.stringify(out));`;
const run = env => {
  const clean = {...process.env};
  delete clean.NODE_OPTIONS;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', PROBE], {cwd:ROOT, env:{...clean, ...env}, encoding:'utf8'});
  assert.equal(r.status, 0, r.stderr);
  return {out:JSON.parse(r.stdout), stderr:r.stderr};
};

test('exactly five original module URLs are redirected, each to its declared copy', () => {
  assert.deepEqual({...D106_REDIRECTS}, EXPECTED);
  assert.deepEqual(Object.keys(D106_REDIRECTS).sort(), ORIGINALS);
  assert.equal(D106_URL_REDIRECTS.size, 5);
  assert.deepEqual([...D106_URL_REDIRECTS], Object.entries(EXPECTED).map(([original, copy]) => [url(original), url(copy)]));
  for (const copy of new Set(Object.values(EXPECTED))) assert.ok(fs.existsSync(path.join(ROOT, copy)), copy);
  assert.deepEqual(Object.keys(D106_GROUPS).sort(), [...new Set(Object.values(EXPECTED))].sort());
});

test('the resolve hook redirects the five and passes every other URL through untouched', async () => {
  const next = async specifier => ({url:specifier, format:'module', importAttributes:{}});
  for (const [original, copy] of Object.entries(EXPECTED)) {
    assert.deepEqual(await resolve(url(original), {}, next), {url:url(copy), format:'module', importAttributes:{}});
    assert.equal(d106Redirect(url(original)), url(copy));
  }
  const through = [
    ...Object.values(EXPECTED).map(url),
    ...ORIGINALS.map(f => url(f.replace('.mjs', '.test.mjs'))),
    url('proposals/d086/native-first-use-cache-check-v6.mjs'), url('proposals/d086/native-first-use-cache-check.mjs'),
    ...['d087', 'd088', 'd089', 'd090'].map(id => url(`proposals/${id}/native-first-use-cache-check.mjs`)),
    url('proposals/d088/browser-cache-observation.mjs'), url('proposals/d086/browser-capture-quiet.mjs'),
    url('proposals/d091/browser-first-use-performance.mjs'), url('proposals/d106/browser-first-use-performance.mjs'),
    url('proposals/d088/browser-first-use-performance.mjs') + '?x=1', url('proposals/d088/browser-first-use-performance.mjs') + '#h',
    url('proposals/d088/browser-first-use-performance.mjs').replace('.mjs', '.js'),
    'node:assert/strict', 'node:module', 'data:text/javascript,export default 1',
  ];
  for (const target of through) {
    const resolved = {url:target, format:'module'};
    assert.equal(await resolve(target, {}, async () => resolved), resolved, target + ' passes through as the same object');
    assert.equal(d106Redirect(target), target);
  }
});

test('the hook entry registers only the resolve module and the workflow uses exactly this NODE_OPTIONS', () => {
  const hook = read(D106_HOOK);
  assert.equal(hook.split('register(').length - 1, 1);
  assert.ok(hook.includes("register('./first-use-ceiling-resolve.mjs', import.meta.url);"));
  assert.equal(NODE_OPTIONS, '--import ./proposals/d106/first-use-ceiling-hook.mjs');
  for (const id of ['d086', 'd087', 'd088', 'd089', 'd090']) {
    const yaml = read(`.github/workflows/${id}-native.yml`);
    assert.equal(yaml.split('NODE_OPTIONS: ' + NODE_OPTIONS + '\n').length - 1, 1, id);
  }
});

test('end to end: with the step NODE_OPTIONS the originals resolve to the copies; without it they stay at 400 ms', () => {
  const hooked = run({NODE_OPTIONS});
  for (const id of ['d086', 'd087', 'd088', 'd089', 'd090']) assert.deepEqual(hooked.out[id], {pageFirst:1000, verdict:true}, id);
  assert.match(hooked.stderr, /^D106: CI page-first commit ceiling 1000 ms/m);
  assert.doesNotMatch(hooked.stderr, /Warning|Error/);
  const plain = run({});
  for (const id of ['d086', 'd087', 'd088', 'd089', 'd090']) assert.deepEqual(plain.out[id], {pageFirst:null, verdict:'unchanged commitMs ceiling 400ms'}, id);
  assert.equal(plain.stderr, '');
});
