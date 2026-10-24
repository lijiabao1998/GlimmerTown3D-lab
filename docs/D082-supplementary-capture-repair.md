# D082 supplementary capture repair and strict coverage blocker

## Pre-implementation contract (2026-10-22)

The user authorized implementation, tests, commits and pushes on `codex/d082-art-redesign`, with no merge, Ready transition or deployment. The nine models have already received art approval. PR35 belongs to the rejected ten-model branch and is untouched.

Fresh remote checks agree on candidate `24f56b7d6dc0144d2537147b34446957dc40f870` and published main `2cd43c424dcc909dcfa6ac55275406d2bc527ce0`. An isolated partial clone is used; the existing C:\\dev checkout is inaccessible and was not modified. This tree contains no AGENTS.md or .agents/skills. CLAUDE.md was read; this session's narrower branch-only instruction takes precedence over its main-push rule.

Before edits, typecheck, build and the independent redesign structural gate pass: 324 geometry cases, both approved prototype pins and their 36 affine cases each, all 130 prior model pins, nine distinct models and 12 scene pairs. Replaying all 18 contracts against the original 412px CI PNG manifest reproduces a nonzero exit: 838 missing candidate probes and 658 missing legacy probes (1,496 total).

## Required repair

1. Keep each original/context/front/rear/side paired PNG and every original probe.
2. Plan additional views using only existing production orbit and zoom limits, against the exact observed original camera. Select paired views for the unchanged before/after contracts; selection does not establish a browser pass.
3. Capture every selected additional view through the existing push-only GitHub Actions production harness, with all existing world, complete geometry, frame, full-owner fit and paused repeat assertions. This is the supported preview route; no local/file browser workaround is attempted.
4. Coverage may count an additional camera only when both PNG phases and the actual observed cameras are present, with valid image hashes and exact plan identities. Preserve the original five-view requirement and derive an exact expanded image inventory.
5. Keep the D081 classifier, geometry contracts, accepted byte pins, thresholds, all prior models and all production source bytes unchanged. Missing, duplicate, unpaired, changed-pose or nonexistent PNG evidence must fail.
6. Retain every residual uncovered probe and keep coverage red. Establish the all-legal-angle obstruction for required downward-facing points explicitly rather than removing or reclassifying them. A genuine contract conflict must be reported even after the capture repair.

## Verification to complete

Add focused negative controls for the new captured-view contract; rerun structural, typecheck, build and unchanged coverage. Push the concrete repair, verify the exact remote SHA, run the complete CI workflow and three-width image/geometry/coverage workflow, and retain their terminal results. No local pass is a release claim. The public version stays D081 / 130 buildings.

## Implemented repair and local evidence

The capture planner searches sixteen azimuths at three existing legal elevations and chooses useful paired views without changing any required point. It uses the actual observed original camera for both contracts, so the floating-point differences at 154v0 are not normalized away. Every original image remains; the expanded image count is exactly the original total plus twice the selected supplementary count. The coverage consumer checks original PNG signatures, dimensions, byte counts, SHA256, paused repeats, exact before/after cameras, world identity and complete production geometry. A plan without actual paired PNGs cannot count.

All 25 new evidence/obstruction tests pass, including 22 corruption cases. Typecheck, build and the unchanged structural gate pass again. Production source, all fixtures, D081 classifier, redesign analytic surfaces, approved default/36-affine pins and structural gate bytes are unchanged. No art was moved or removed.

The retained [412px baseline](evidence/D082-redesign-first-red/supplementary-repair/baseline-412.json), [full accepted-179v1 failing contract](evidence/D082-redesign-first-red/supplementary-repair/surface-179-v1-after-412.json.gz), [all-legal-angle obstruction proof](evidence/D082-redesign-first-red/supplementary-repair/accepted-179-v1-impossibility.json), [structural report](evidence/D082-redesign-first-red/supplementary-repair/structural-report.json) and [negative-control output](evidence/D082-redesign-first-red/supplementary-repair/supplementary-controls.txt) are committed as review evidence.

The obstruction is already decisive without relying on a finite angle search. In the accepted 179v1 mesh, 24 required points have exact downward horizontal normals. For every allowed orthographic elevation in [14.4°, 57.6°], `normal · rayDirection = sin(elevation) >= 0.2486898871648548 > 0`, at every azimuth. The unchanged FrontSide audit therefore always rejects them. This includes elevated roof undersides and the chimney bottom. All those records remain required. Moving/deleting/reversing them violates the structural surface contract and accepted geometry/affine byte pins; changing the classifier, camera law or required flags is prohibited by the task. Consequently complete green coverage cannot be achieved under the simultaneous current constraints. The supplemental capture repair can recover genuinely visible missing views, but does not claim to solve this conflict.

GitHub Actions production images and full CI for the pushed repair are still required; local planning alone does not establish the number actually recovered in those images.
