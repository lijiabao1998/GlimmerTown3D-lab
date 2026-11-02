# D097 source-lease successor — pre-activation allowance

**Status: NOT ACTIVE.** This directory is a finite, reviewed-candidate successor for the
D090 outer source lease (`tools/d090-source-contract.mjs`, `fixtures/d090/source.json`,
263 pinned `src/` files). It does not run in the product, does not change any save or
runtime format, and does not modify a single byte of D090 evidence.

## Why it exists

D097's first two checkpoints (`transitGraph.ts`, `transitMovement.ts`) were committed to
`src/sim/` and made four frozen historical guards fail with
`AssertionError: exact263 current source inventory` (D079, D080, D081, D082 release scope
and the D090 source accounting, all reached through
`tools/d083-scope.mjs` → `d084PriorInventory`). The D090 card requires additions to be
covered by an explicit reviewed successor, never by editing historical goldens. The
prototypes were therefore relocated to `proposals/d097/sim/` for this candidate round,
which restores the exact263 inventory.

## What this allowance pins

| Item | Value |
|---|---|
| Baseline | `1aed2c7b7d6ed819e91e381ceb2c68d1e1033632` (main, 2026-10-31) |
| Baseline files | all 263 released `src/` files, pinned by SHA-256 |
| Declared additions | `src/sim/transitGraph.ts`, `src/sim/transitMovement.ts` |
| Manifest | [`source.successor.preview.json`](source.successor.preview.json), SHA-256 `acbb340f814bfcb92802a362b730e7a04b02d3ee3071acf6cf4fb44fe2a0fead` |
| Contract | [`d097-source-contract.mjs`](d097-source-contract.mjs) — `d097PriorInventory` accepts exactly 265 and returns the released 263 |
| Generator | [`freeze-source.mjs`](freeze-source.mjs) — refuses to overwrite an earlier preview |
| Verifier | [`verify-preview.mjs`](verify-preview.mjs) — derives the 263 pins from `fixtures/d090/source.json` alone (no git history needed) |

Run `node proposals/d097/source-successor/contract.test.mjs` for the accept/reject
controls and `node proposals/d097/source-successor/verify-preview.mjs` for the real
preview receipt.

## Activation (reviewed step, not performed here)

Activation changes bytes of D090 evidence, so it needs explicit owner review. Exact order:

1. **Owner review** of this directory and the two prototype files.
2. `git mv proposals/d097/sim/transitGraph.ts src/sim/transitGraph.ts` and the same for
   `transitMovement.ts`; point `tools/unit-d097-*.mjs` back at `src/sim/`.
3. Copy `d097-source-contract.mjs` to `tools/d097-source-contract.mjs`, changing its
   import of `d090-source.mjs` to `'./d090-source.mjs'`.
4. Re-run `freeze-source.mjs --baseline <current main>` to write `fixtures/d097/source.json`
   and generate `tools/d097-source.mjs` (entry with `D097_MANIFEST_SHA`, same shape as
   `tools/d090-source.mjs`). Update `D097_BASELINE` in the contract if main moved.
5. Rewire the finite outer seams from `'./d090-source.mjs'` to `'./d097-source.mjs'` in
   `tools/d083-scope.mjs`, `tools/d082-release-source-v2.mjs`,
   `tools/d082-release-mesh-v2.mjs`.
6. Update the seam expectations in `proposals/d090/source-boundaries.test.mjs`
   (`'./d090-source.mjs'` → `'./d097-source.mjs'`), then refresh the digest of that test
   file in `proposals/d090/foundation-routing-pipes-v2.json` and re-run every consumer of
   that manifest. **This is the review-sensitive part:** it is the only step that edits
   D090 evidence, and it must keep the original d089→d090 finite-version assertion intact
   (add the d090→d097 hop, do not delete the old one).
7. Run `npm run typecheck`, `node tools/unit-d079.mjs`, the D090 source test, the full
   `npm run unit -- --partition=historical`, the D097 guards and `npm run smoke`; push and
   require a fully green CI before any merge claim.
8. Record the activation commit, every changed evidence digest and the CI run in the D097
   card. Do not relabel or delete a historical golden; if a digest must move, record
   before/after.

## Honest limits

- The preview pins bytes; it does not prove the transit feature works. The prototype
  guards do that, separately.
- Nothing here is a save format. The event-25 ruling is recorded in the D097 card, not
  implemented.
- If `main` gains source files before activation, this preview is stale: regenerate it and
  review the delta; never hand-edit the pins.
