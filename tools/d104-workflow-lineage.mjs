// D104 declared CI scheduling layer. This is a pure finite transformation of
// the exact main-76e workflow/validator inputs; it never writes YAML or files.
// The eleven seams were reviewed against docs/D104-ci-parallel-validation.md.
// D101 composes these outputs before replaying every original lineage pin.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const D104_WORKFLOW = '.github/workflows/ci.yml';
export const D104_DELTAS = 'proposals/d090/inherited-workflow-deltas.json';
export const D104_VALIDATOR = 'tools/d090-validation-pipes-v2.mjs';
export const D104_BEFORE = Object.freeze({
  [D104_WORKFLOW]:'be419e18a1362d00ec8a69082d02ae7cab34df88784abbf7a75b75dbd3509600',
  [D104_DELTAS]:'f96cd61b639e1cfed3d347bb41ac98d98ecee67df4239eaca26e05699415cb8c',
  [D104_VALIDATOR]:'cc5d49563589d2cf5f3eb37b5abce5db0c17957171678475c7ce290b624a0a15',
});
export const D104_WORKFLOW_SHA = '6242995eab3af7c818595e9f6628ee7f0483f11cbba52451820f2ea9151b0912';
export const D104_REASON = 'D104 owner-authorised CI scheduling: eight exhaustive historical and browser shards, unchanged original assertions and exits, complete same-source/build artifact gates and attempt-specific evidence; composed with the D101 current-source lease before lineage replay.';
export const D104_QUALIFICATION_NOTE = ' Subsequent D104 (owner 2026-11-06) adds the second finite workflow exception: .github/workflows/ci.yml schedules exhaustive historical/browser shards and verifies their independent evidence; all original timeouts, main triggers, Pages dependencies, assertions and immutable sources remain unchanged.';
export const D104_WORKFLOW_SEAMS = Object.freeze([
  {
    "before": "        run: node --test .github/scripts/ci-integrity-d090.test.mjs tools/unit-partitions-release-v2.test.mjs\n      - name: Versioned source missing/stale negatives and fresh historical receipt regression\n",
    "after": "        run: node --test .github/scripts/ci-integrity-d090.test.mjs tools/unit-partitions-release-v2.test.mjs\n      - name: D104 exhaustive shard scheduling and evidence negative controls\n        run: node --test tools/d104-historical-shards.test.mjs tools/d104-smoke-contract.test.mjs tools/d104-workflow.test.mjs\n      - name: Versioned source missing/stale negatives and fresh historical receipt regression\n",
    "count": 1
  },
  {
    "before": "    timeout-minutes: 120\n    steps:\n",
    "after": "    timeout-minutes: 120\n    strategy:\n      fail-fast: false\n      matrix:\n        shard: [0, 1, 2, 3, 4, 5, 6, 7]\n    steps:\n",
    "count": 1
  },
  {
    "before": "        run: npm run unit -- --partition=historical\n      - uses: actions/upload-artifact@v4\n",
    "after": "        run: npm run unit -- --partition=historical\n        env:\n          D104_HISTORICAL_SHARD: ${{ matrix.shard }}\n      - uses: actions/upload-artifact@v4\n",
    "count": 1
  },
  {
    "before": "        with:\n          name: d082-versioned-node-${{ github.sha }}-${{ github.run_attempt }}\n          path: |\n            scratch/d082-release-mesh-v2/\n",
    "after": "        with:\n          name: d104-node-${{ github.sha }}-${{ github.run_attempt }}-${{ matrix.shard }}\n          path: |\n            scratch/d104-historical-shards/\n            scratch/d082-release-mesh-v2/\n",
    "count": 1
  },
  {
    "before": "  browser:\n    needs: build\n    runs-on: ubuntu-24.04\n    timeout-minutes: 120\n    outputs:\n      artifact-id: ${{ steps.evidence.outputs.artifact-id }}\n    steps:\n      - uses: actions/checkout@v4\n",
    "after": "  browser:\n    needs: build\n    runs-on: ubuntu-24.04\n    timeout-minutes: 120\n    strategy:\n      fail-fast: false\n      matrix:\n        shard: [0, 1, 2, 3, 4, 5, 6, 7]\n    outputs:\n      artifact-id: ${{ steps.evidence.outputs.artifact-id }}\n    steps:\n      - uses: actions/checkout@v4\n",
    "count": 1
  },
  {
    "before": "        shell: bash\n      - name: D081 approved touch lease real-layout regression\n        if: always()\n        run: node tools/d081-touch-lease-browser.mjs 2>&1 | tee d081-touch-lease-browser.txt; exit ${PIPESTATUS[0]}\n",
    "after": "        shell: bash\n        env:\n          D104_SMOKE_SHARD: ${{ matrix.shard }}\n          NODE_OPTIONS: --import ./tools/d104-smoke-entry.mjs\n          CI_BUILD_DIGEST: ${{ needs.build.outputs.digest }}\n          D104_BUILD_ARTIFACT_ID: ${{ needs.build.outputs.artifact-id }}\n      - name: D081 approved touch lease real-layout regression\n        if: always() && matrix.shard == 0\n        run: node tools/d081-touch-lease-browser.mjs 2>&1 | tee d081-touch-lease-browser.txt; exit ${PIPESTATUS[0]}\n",
    "count": 1
  },
  {
    "before": "      - name: D081 actual compiled commission layout regression\n        if: always()\n        run: node tools/d081-touch-lease-app-browser.mjs 2>&1 | tee d081-touch-lease-app.txt; exit ${PIPESTATUS[0]}\n",
    "after": "      - name: D081 actual compiled commission layout regression\n        if: always() && matrix.shard == 0\n        run: node tools/d081-touch-lease-app-browser.mjs 2>&1 | tee d081-touch-lease-app.txt; exit ${PIPESTATUS[0]}\n",
    "count": 1
  },
  {
    "before": "        with:\n          name: smoke-browser-${{ github.sha }}-${{ github.run_attempt }}\n          path: |\n            smoke-run.txt\n",
    "after": "        with:\n          name: d104-browser-${{ github.sha }}-${{ github.run_attempt }}-${{ matrix.shard }}\n          path: |\n            scratch/d104-smoke/\n            smoke-run.txt\n",
    "count": 1
  },
  {
    "before": "            scratch/shots/D054-*.html\n            scratch/shots/D056-*.json\n          if-no-files-found: warn\n          retention-days: 14\n\n",
    "after": "            scratch/shots/D054-*.html\n            scratch/shots/D056-*.json\n          if-no-files-found: error\n          retention-days: 14\n\n",
    "count": 1
  },
  {
    "before": "          CI_NEEDS: ${{ toJSON(needs) }}\n      - name: Restore browser evidence (including failed-run diagnostics)\n",
    "after": "          CI_NEEDS: ${{ toJSON(needs) }}\n      - name: Restore every historical shard receipt\n        uses: actions/download-artifact@v4\n        with:\n          pattern: d104-node-${{ github.sha }}-*\n          path: scratch/d104-node-artifacts\n          merge-multiple: false\n      - name: Require all eight historical shard receipts and exact coverage\n        run: node tools/d104-historical-shards.mjs verify scratch/d104-node-artifacts\n      - name: Restore every browser shard receipt and its evidence\n        uses: actions/download-artifact@v4\n        with:\n          pattern: d104-browser-${{ github.sha }}-*\n          path: scratch/d104-browser-artifacts\n          merge-multiple: false\n      - name: Restore the same build for browser receipt verification\n        uses: actions/download-artifact@v4\n        with:\n          artifact-ids: ${{ needs.build.outputs.artifact-id }}\n          merge-multiple: true\n      - name: Verify the build used by all browser shards\n        run: node .github/scripts/ci-integrity.mjs verify\n        env:\n          CI_BUILD_DIGEST: ${{ needs.build.outputs.digest }}\n      - name: Require all eight browser shards and exact smoke coverage\n        run: node tools/d104-smoke-verify.mjs --artifacts scratch/d104-browser-artifacts\n        env:\n          CI_BUILD_DIGEST: ${{ needs.build.outputs.digest }}\n          D104_BUILD_ARTIFACT_ID: ${{ needs.build.outputs.artifact-id }}\n      - name: Restore browser evidence (including failed-run diagnostics)\n",
    "count": 1
  },
  {
    "before": "        with:\n          name: smoke-${{ github.sha }}\n          path: |\n            smoke-run.txt\n",
    "after": "        with:\n          name: smoke-${{ github.sha }}-${{ github.run_attempt }}\n          path: |\n            scratch/d104-node-artifacts/\n            scratch/d104-browser-artifacts/\n            scratch/d104-smoke-aggregate/\n            smoke-run.txt\n",
    "count": 1
  }
].map(Object.freeze));
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const once = (text, before, after, label) => {
  assert.equal(text.split(before).length - 1, 1, label + ': exactly one declared seam');
  return text.replace(before, () => after);
};
const canonical = bytes => {
  const value = JSON.parse(bytes); assert.equal(json(value), bytes, 'canonical workflow delta manifest'); return value;
};

export function assertD104Workflow(bytes) {
  assert.equal(sha(bytes), D104_WORKFLOW_SHA, 'exact authorised D104 CI schedule');
  return bytes;
}

export function d104WorkflowLayer(source) {
  for (const [file, hash] of Object.entries(D104_BEFORE)) assert.equal(sha(source(file)), hash, file + ': exact D104 baseline input');
  let workflow = source(D104_WORKFLOW);
  for (const seam of D104_WORKFLOW_SEAMS) {
    assert.equal(seam.count, 1);
    workflow = once(workflow, seam.before, seam.after, D104_WORKFLOW);
  }
  assertD104Workflow(workflow);
  const manifest = canonical(source(D104_DELTAS)), row = manifest.workflows[0];
  assert.equal(manifest.workflows.length, 8); assert.equal(row.file, D104_WORKFLOW);
  assert.equal(row.changes.length, 4); assert.equal(row.afterSha256, D104_BEFORE[D104_WORKFLOW]);
  row.changes.push(...D104_WORKFLOW_SEAMS.map(seam => ({...seam})));
  let replay = row.before;
  for (const seam of row.changes) {
    assert.equal(replay.split(seam.before).length - 1, seam.count, 'declared workflow reconstruction seam count');
    replay = replay.split(seam.before).join(seam.after);
  }
  assert.equal(replay, workflow, 'original 5b preimage plus existing and D104 seams reconstructs exact CI');
  row.afterSha256 = D104_WORKFLOW_SHA;
  const deltas = json(manifest), deltaSha = sha(deltas);
  const validatorEdits = [
    ["WORKFLOW_DELTA_SHA='" + D104_BEFORE[D104_DELTAS] + "'", "WORKFLOW_DELTA_SHA='" + deltaSha + "'"],
    ['// minutes); this is a validation dependency, never a publication authorization.',
      '// minutes); this is a validation dependency, never a publication authorization.\n// D104 adds only the exact authorised CI scheduling seams; all previous gates remain.'],
    ["const ci=source('.github/workflows/ci.yml'),old=",
      "const ci=source('.github/workflows/ci.yml');assert.equal(sha(ci),'" + D104_WORKFLOW_SHA + "','exact authorised D104 CI schedule');const old="],
  ];
  const validator = validatorEdits.reduce((text, [before, after]) => once(text, before, after, D104_VALIDATOR), source(D104_VALIDATOR));
  return {workflow, deltas, validator, validatorEdits,
    hashes:{workflow:D104_WORKFLOW_SHA, deltas:deltaSha, validator:sha(validator)}};
}

export function d104WorkflowRouting(routing) {
  const out = structuredClone(routing);
  assert.equal(out.inheritedWorkflows[D104_WORKFLOW], D104_BEFORE[D104_WORKFLOW], 'exact previous routing workflow pin');
  out.inheritedWorkflows[D104_WORKFLOW] = D104_WORKFLOW_SHA;
  return out;
}

export function d104WorkflowLineage(lineage, layer) {
  const out = structuredClone(lineage);
  assert.equal(out.workflows[D104_WORKFLOW], D104_BEFORE[D104_WORKFLOW], 'exact previous lineage workflow pin');
  out.workflows[D104_WORKFLOW] = D104_WORKFLOW_SHA;
  assert.ok(!out.qualification.includes(D104_QUALIFICATION_NOTE), 'apply D104 lineage once');
  out.qualification += D104_QUALIFICATION_NOTE;
  const copies = out.copies.filter(row => row.target === D104_VALIDATOR);
  assert.equal(copies.length, 1); const copy = copies[0];
  assert.equal(out.copies.indexOf(copy), 8); assert.equal(copy.changes.length, 8);
  assert.equal(copy.targetSha256, D104_BEFORE[D104_VALIDATOR], 'exact previous validator pin');
  copy.changes.push(...layer.validatorEdits.map(([before, after]) => ({before, after, count:1})));
  copy.targetSha256 = layer.hashes.validator;
  copy.reissued = {previousSha256:D104_BEFORE[D104_VALIDATOR], reason:D104_REASON};
  return out;
}
