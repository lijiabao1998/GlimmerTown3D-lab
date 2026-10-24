# D082 accepted-nine and D083 native-eight integrated release candidate

## Scope and provenance

This main-base candidate follows the owner's 2026-10-24 formal repair/integration authorization. It preserves the accepted-nine branch and D083 native/finite-source stack history. It does not merge rejected-ten PR35 as a product candidate and does not claim a standalone D082-only release.

- Main at preparation: `2cd43c424dcc909dcfa6ac55275406d2bc527ce0` (D081).
- Accepted-nine source: `7deb34881b38679b1d0396e21eb9e57ad2ee9a0c`.
- D083 native predecessor: `7bc5609d92ca7a9971f3a2ac0ff80a86ddacd07e`.
- Finite compatibility predecessor: `63a1b3919b0e1531f3d0e988cc575bdde5736002`.
- Fully qualified repair head: `62571d6243f6b50168ac00a8b169bcb3cb35f744`, tree `2bd795a3f56b076b5eaae92d2cc99273bd74361c`.
- PR38 synthetic merge `ddc3704d7c90f146c313a2b48683b2e1682eff5b` has that identical tree.

The product keeps D082 nine slots (179/185/154, variants0–2), kind126 legacy, all130 prior model byte pins, and D083 append-only kinds187–194. The rejected ten source remains an immutable1980-file historical archive with its original tests and SHA, not the current emitter. Current finite geometry/source contracts are explicitly versioned. Original per-model and60236 scene ceilings are unchanged. The immediate accepted predecessor scene is60164; repaired scene60196 is the exact+32 target-only delta, not an increased ceiling.

D083 native buildings retained: 架高穀倉187、石造鴿舍188、鐵路信號樓189、八角收費亭190、罩殼風車191、村莊鐵匠鋪192、什一稅穀倉193、鐵藝樂亭194. Native placement/payment/picking/construction/undo/save/load remain required. Candidate count is130 existing +9 accepted D082 +8 D083; no additional published count is claimed before deployment verification.

## Observed repair qualification

- [Main validation workflow40107701484](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/40107701484):65 success, two intended PR skips (main-only native release and Pages).
- [D083 native40107701443](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/40107701443):five jobs success, actual1440/412/360 browser UI.39 raw PNG hashes verified; eight new owners survive actual save/reload at each width.
- [D05640107701441](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/40107701441):success.
- D082 actual1440/412/360 product capture, unchanged mandatory coverage classifier and true predecessor/current seam comparison all succeed.492 PNG hashes verified; all492 are byte-identical to the previous visually reviewed product run.54 coverage contracts, zero missing mandatory probes.
- Standalone fresh historical frame receipt, historical integration, current seven-phase mesh proof, source/checkpoint negatives and D081 historical/actual scene isolation succeed. Original red evidence remains preserved.
- General Chromium smoke succeeded in3689.6s;108 D081 real-layout cases and actual-app layout checks succeeded. Synthetic ordering checks are not relabeled as native event-retarget proof or physical Android testing.

Exact job inventory and artifact IDs: [qualification receipt](evidence/D082-own-release-v2/pr38-qualified-release-head.json). Current mesh and immutable historical integration reports are adjacent.

## Remaining release conditions

This document records a qualified repair head, not completed main integration or publication. The independent main-base PR must pass all necessary CI on its actual head/synthetic merge. Before Ready/merge, recheck main/head/base/tree, no holds or unrelated changes, and full three-size/native evidence. On main, the reusable D083 native workflow is an explicit Pages dependency using the same source SHA and existing read-only permissions. Pages cannot proceed if any required native job fails or is skipped. Final main CI, native execution, Pages and actual HTTPS bytes must be observed before declaring the17 candidate models published.
