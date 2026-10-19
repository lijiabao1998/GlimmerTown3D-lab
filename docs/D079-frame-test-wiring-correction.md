# D079 — Correct two new frame-test adaptation errors

Pre-repair supplementary card, 2026-10-19 08:45 UTC. This records the formal first-red evidence and freezes the bounded correction before code edits. No production source, geometry, camera, archived baseline, old assertion, sample or performance threshold may change.

## First red and exact snapshots

Formal node-frame-d079 job117961277927 failed at 08:41:10 UTC with two new-test errors; artifact12173206275 preserves its report. The parent reported that the same run passed all60 rawThree contracts, both-phase full coverage, all240 missing/reversed wall/roof controls and the corrected complete per-cell construction group. Those results do not turn a failed full job into acceptance.

Pre-repair unit SHA256: `48e84e36f59af20e1d65635b8455778e0a3ceb99e5c56d6d13937fc796deef77`, copied byte-for-byte to `scratch/d079/unit-frame-before-formal-wiring-correction.mjs`.
Unchanged corrected frame SHA256: `6ec0bb54546b88248e533dd9dd0978f7eee2437580481af6954a7bf323539e3d`, copied to `scratch/d079/frame-before-formal-wiring-correction.mjs`.
Pre-repair capture SHA256: `74fc585b921f14966e82041476910da1c2167c673ca4f564e6e7e5fd6efbbefb`, copied to `scratch/d079/capture-before-formal-wiring-correction.mjs`.

Local full session62169 remains running with the older frame module `540da571dfd3868c821c55da5110b2a6af89c16e4117b7a9d7041bd98e4b7fa4` and the same pre-repair unit module. Its log and original source snapshot remain intact. It must not be presented as a corrected final full run, and no second local full suite is authorized here.

## 1. Existing-view selection for construction negatives

The new uniform/tree negative group still loops gallery and ai120, force0/1/2/3, as intended. It incorrectly calls `source.shots.find(s=>s.k)` for every source. D079's frozen cohort has no selected ai120 owners, so ai120 has an existing overview but no selected closeup. Calling cameraFor with undefined caused the first TypeError. This is test wiring, not a production camera failure.

Independent frozen owner inventory and current unchanged plan agree: every ai120 copied source has targets=[], sites=[] and exactly its existing overview. Source/view proof SHA256 is `347c96a6ba108d56e4108710fcc8f14fdcabfee5e986dfbbb9ed83a9dc88f12c`, retained in `scratch/d079/formal-wiring-source-proof.json`.

Repair the test with an explicit checked selector:

- gallery requires an existing selected closeup and verifies its expected detail1;
- ai120 requires its existing no-target overview and verifies expected detail0;
- unknown sources, a missing expected view, and the wrong view type must fail explicitly;
- preserve every current gallery/ai120, force0–3 uniform, clipping, probe, time, tree-age and tree-matrix negative group;
- never invent a camera, alter the capture plan, skip ai120, or fall back to an unrelated view.

## 2. Restore the immutable D067 inst6 count

The standard D079 original-view count is150, derived independently from (15 overviews +10 selected closeups) ×2 phases ×3 widths. A broad textual 168→150 replacement mistakenly also changed historical1680 to1500 in the new copied D067 regression assertion.

The immutable published baseline46771cdc00f33759e0a3c45ddf05c3387d4bb4fc contains tools/unit-d078-frame.mjs SHA256 `cd55eb7d230617cb94c0424e008e4bf375d2dfbfb6bf617bafa2549944f94acb`; exact archived bytes are retained in `scratch/d079/published-unit-d078-frame-proof.mjs`. Its line337 pins:

- owner201, kind116
- whole112758, submitted108838, calls13, culled3920
- inst6: 280 instances, 1680 triangles, frustum-culled, no shadow
- inst8: 280 instances, 2240 triangles, frustum-culled, no shadow
- shadow28308/5 calls; main80530/8 calls

Restore only the erroneous1500 to1680. Bind the entire unchanged list above and add mutated submitted/culling-count rejection, including the known wrong1500. Existing exact count, whole-scene and injected-triangle negatives remain unchanged. Neither the current renderer nor its measured count is the authority for changing this pin: the immutable published assertion is.

## Complete replacement audit

The forensic audit `scratch/d079/view-count-substitution-audit.json`, SHA256 `1c90492fcf8ac2d5f5a71d93916014784e42a7275885ca33915ee1b601223631`, enumerates every original168 occurrence in both globally transformed files and inventories all D079 tools/docs/fixtures. There are exactly9 transformed occurrences:8 legitimate standard-view counts/labels and1 erroneous historical1680. No global168→150 operation was applied to frame, inspection, docs or fixtures. All frozen card, initial architecture, numeric contract, source, geometry and historical fixture bytes independently match their frozen SHA pins. Other150 substrings in untransformed numeric data/hashes are not view-count substitutions.

The audit contains the full immutable D067 constant list and source hash. Do not perform another broad numeric substitution.

## Verification and limits

After the bounded edits, run only the repaired uniform/view-selection group, D067 culling group and existing changed-count/whole-budget negative groups locally; preserve their complete logs and a full changed-line diff/proof JSON. The parent will independently review the evidence. This author does not grant independent approval. Do not rerun whole CI or another local full suite. Corrected exact-head formal verification remains required before merge/publication. Preserve the formal artifact, both old source snapshots, original local process and all first-red evidence.

## Authorized factual capture-description correction

Approved by the parent at08:48 UTC and recorded before the following text-only edits: the capture report still inherited D078 prose claiming copied variants0/1/2, four existing kinds, and selected ai120 owners at ages83/7. Correct that description (and matching header comment) to copied variants0–3, three kinds, and no selected owners in either ai120 or seed516. All ten selected gallery owner/variant cases remain age400. Keep inherited recycling heights disclosed. This changes only factual prose; do not change the plan, sources, view IDs, angles, sample sets, assertions, URLs, pixel captures or acceptance results. Preserve the pre-edit capture bytes and include the exact changed lines in the review proof.
