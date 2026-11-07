import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const matrix = '    strategy:\n      fail-fast: false\n      matrix:\n        shard: [0, 1, 2, 3, 4, 5, 6, 7]\n';
const unitCommand = '        run: npm run unit -- --partition=historical\n';
const smokeCommand = '        run: node tools/smoke.mjs 2>&1 | tee smoke-run.txt; exit ${PIPESTATUS[0]}\n';
function job(text, name) {
  const start = text.indexOf(`\n  ${name}:\n`);
  assert.ok(start >= 0, `missing ${name}`);
  const offset = text.slice(start + 1).search(/\n  [a-z][a-z0-9-]*:\n/);
  return text.slice(start, offset < 0 ? undefined : start + 1 + offset);
}
function once(text, literal) { assert.equal(text.split(literal).length, 2, `one ${literal.trim()}`); }
function requiredStep(text, marker) {
  const at = text.indexOf(marker);
  assert.ok(at >= 0, `missing required step ${marker}`);
  const from = text.lastIndexOf('\n      - ', at), next = text.indexOf('\n      - ', at);
  assert.ok(from >= 0);
  assert.doesNotMatch(text.slice(from, next < 0 ? undefined : next), /\n        if:|continue-on-error:/);
}
function qualify(text) {
  const node = job(text, 'node'), browser = job(text, 'browser'), gate = job(text, 'smoke');
  for (const stage of [node, browser]) {
    once(stage, matrix);
    assert.doesNotMatch(stage, /continue-on-error:|\n        (?:include|exclude):/);
    once(stage, '          if-no-files-found: error\n');
  }
  once(node, unitCommand);
  once(node, '          D104_HISTORICAL_SHARD: ${{ matrix.shard }}\n');
  once(node, '          name: d104-node-${{ github.sha }}-${{ github.run_attempt }}-${{ matrix.shard }}\n');
  once(node, '            scratch/d104-historical-shards/\n');
  once(browser, smokeCommand);
  once(browser, '          D104_SMOKE_SHARD: ${{ matrix.shard }}\n');
  once(browser, '          NODE_OPTIONS: --import ./tools/d104-smoke-entry.mjs\n');
  once(browser, '          D104_BUILD_ARTIFACT_ID: ${{ needs.build.outputs.artifact-id }}\n');
  once(browser, '          name: d104-browser-${{ github.sha }}-${{ github.run_attempt }}-${{ matrix.shard }}\n');
  once(browser, '            scratch/d104-smoke/\n');
  for (const file of ['d081-touch-lease-browser.mjs', 'd081-touch-lease-app-browser.mjs']) {
    once(browser, `        if: always() && matrix.shard == 0\n        run: node tools/${file}`);
  }
  for (const family of ['node', 'browser']) {
    once(gate, `          pattern: d104-${family}-` + '${{ github.sha }}-*\n');
    once(gate, `          path: scratch/d104-${family}-artifacts\n          merge-multiple: false\n`);
    requiredStep(gate, `pattern: d104-${family}-`);
  }
  once(gate, '        run: node tools/d104-historical-shards.mjs verify scratch/d104-node-artifacts\n');
  once(gate, '        run: node tools/d104-smoke-verify.mjs --artifacts scratch/d104-browser-artifacts\n');
  once(gate, '          name: smoke-${{ github.sha }}-${{ github.run_attempt }}\n');
  requiredStep(gate, 'run: node tools/d104-historical-shards.mjs verify');
  requiredStep(gate, 'run: node tools/d104-smoke-verify.mjs');
  assert.doesNotMatch(gate, /continue-on-error:|\|\| true/);
  once(text, '        run: node --test tools/d104-historical-shards.test.mjs tools/d104-smoke-contract.test.mjs tools/d104-workflow.test.mjs\n');
}

test('all original checks are scheduled through complete mandatory matrices and evidence gates', () => qualify(workflow));
for (const [name, before, after] of [
  ['missing shard', 'shard: [0, 1, 2, 3, 4, 5, 6, 7]', 'shard: [0, 1, 2, 3, 4, 5, 6]'],
  ['duplicate shard', 'shard: [0, 1, 2, 3, 4, 5, 6, 7]', 'shard: [0, 1, 2, 3, 4, 5, 6, 6]'],
  ['early cancellation', '      fail-fast: false\n', '      fail-fast: true\n'],
  ['wrong Node assignment', 'D104_HISTORICAL_SHARD: ${{ matrix.shard }}', 'D104_HISTORICAL_SHARD: 0'],
  ['wrong browser assignment', 'D104_SMOKE_SHARD: ${{ matrix.shard }}', 'D104_SMOKE_SHARD: 0'],
  ['missing browser dispatch', 'NODE_OPTIONS: --import ./tools/d104-smoke-entry.mjs', 'NODE_OPTIONS:'],
  ['masked Node exit', unitCommand, unitCommand.trimEnd() + ' || true\n'],
  ['masked browser exit', smokeCommand, smokeCommand.replace('${PIPESTATUS[0]}', '0')],
  ['colliding artifacts', 'name: d104-node-${{ github.sha }}-${{ github.run_attempt }}-${{ matrix.shard }}', 'name: d104-node-${{ github.sha }}-${{ github.run_attempt }}'],
  ['colliding aggregate attempts', 'name: smoke-${{ github.sha }}-${{ github.run_attempt }}', 'name: smoke-${{ github.sha }}'],
  ['missing Node receipt', '            scratch/d104-historical-shards/\n', ''],
  ['missing browser receipt', '            scratch/d104-smoke/\n', ''],
  ['missing Node aggregate', '        run: node tools/d104-historical-shards.mjs verify scratch/d104-node-artifacts\n', ''],
  ['missing browser aggregate', '        run: node tools/d104-smoke-verify.mjs --artifacts scratch/d104-browser-artifacts\n', ''],
  ['skipped receipt verification', '        run: node tools/d104-historical-shards.mjs verify', '        if: false\n        run: node tools/d104-historical-shards.mjs verify'],
  ['skipped browser artifacts', '        uses: actions/download-artifact@v4\n        with:\n          pattern: d104-browser-', '        if: false\n        uses: actions/download-artifact@v4\n        with:\n          pattern: d104-browser-'],
  ['overwriting downloaded receipts', '          path: scratch/d104-node-artifacts\n          merge-multiple: false\n', '          path: scratch/d104-node-artifacts\n          merge-multiple: true\n'],
]) test(`workflow rejects ${name}`, () => {
  assert.ok(workflow.includes(before), `mutation anchor ${name}`);
  assert.throws(() => qualify(workflow.replace(before, after)));
});
