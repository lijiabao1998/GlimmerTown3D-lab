# D081 additive parallel validation

Supplemental scheduling card, frozen before implementation on 2026-10-20. Implements the authorized equal-partition CI scheduling for D081 without changing product behavior, assertions, samples, thresholds, GitHub settings, or existing job limits. Immutable published baseline: `7ec70a96b01437ab4576b0962905be16b1591e79`. The frozen architectural card is `docs/D081-british-field-study-buildings-ten.md`.

## Acceptance

- Register D081 geometry and frame guards additively. Default unit execution remains the complete ordered inventory and every inline assertion. Historical execution retains all geometry and inline assertions, excluding only the four separately scheduled D078, D079, D080 and D081 frame exports. Verify the actual registration counts and exact ordered, exhaustive, pairwise-disjoint membership; expected counts are 121 default guards, 117 historical guards, and one guard in each frame partition.
- Preserve every D078, D079 and D080 partition command, job, artifact, assertion and limit. Add independent `node-frame-d081` with the original 120-minute limit and exact D081 baseline fetch. Historical Node retains its 120-minute limit and every previous baseline fetch, adding the D081 baseline.
- Extend the frame runner additively with exact D081 source paths, including its frozen card, supplemental card, architecture contract and initial architecture. Preserve complete guard reports, all failed assertions, exceptions, incomplete reports, evidence-write failures and source/run provenance. CI checkout must equal workflow SHA, tracked sources must be clean, and workflow identity must be valid.
- Smoke aggregate requires all eight stages: build, historical Node, D078 frame, D079 frame, D080 frame, D081 frame, browser and screenshots. Require matching evidence from every artifact-producing stage; missing, failed, skipped, cancelled, pending, malformed or absent-artifact inputs fail closed. Artifact upload cannot turn a failed test into success.
- Add D081 WebGL captures at widths 1440, 360 and 412, with fail-fast disabled, complete mandatory artifacts, the original 45-minute limit and a required Pages dependency. Existing jobs, release dependencies, workflow settings and timeouts remain unchanged except the explicitly additive historical baseline fetch, smoke dependency/evidence inventory and Pages dependency.
- Fast controls must prove inventory and all negative conditions, exact D081 provenance paths, unchanged prior partition/job blocks, the three-width D081 capture matrix and mandatory Pages gates. Run only targeted partition/fail-closed tests here, not full Node suites or browsers.

## Not yet completed

Implementation and targeted controls pending at card creation. This scheduling card does not assert D081 renderer correctness, geometry or frame coverage, WebGL captures, CI, merge, publication, or physical-device testing. Keep every first-red result.


## Verified baseline inventory clarification

The current release contains 119 registered guards, plus its inline suite. Adding D081 geometry and frame registrations produces 121 registered guards (122 including inline) and 117 historical guards (118 including inline), with four singleton frame partitions. No existing guard is removed to fit an incorrect expected count. The actual existing frame runner is `tools/unit-partition.mjs`.

## Scheduling implementation verification

2026-10-20: Both focused runs of `node --test .github/scripts/ci-integrity.test.mjs tools/unit-partitions.test.mjs` passed all 235 controls with zero failures, cancellations or skips. The second run used the dot reporter. Actual registration parsing and explicit count assertions confirm 121 registered default guards and 117 registered historical guards, plus one inline suite in each; four frame partitions each contain exactly one guard. Ordered and exhaustive membership, pairwise disjointness, and rejection of omission, duplication or changed export at every registration are verified. D081 controls preserve all injected reports, failure logs, exceptions, incomplete reports, evidence-write failures and exact card/architecture/source/run provenance. The eight-stage smoke gate rejects absent, failed, skipped, cancelled, pending and malformed stage/artifact inputs.

Direct comparison with immutable release `7ec70a96b01437ab4576b0962905be16b1591e79` verifies 25 existing job bodies are byte-identical, excluding only job-separator blank lines. This includes all three previous frame jobs, all historical WebGL jobs, build, browser and screenshots. Top-level workflow settings are byte-identical. Historical Node changes only by its additional immutable baseline fetch and descriptive label; smoke and Pages change only by their added dependencies. Removing the two additive D081 registrations restores `tools/unit.mjs` byte-for-byte to the published release, preserving all inline assertions and 119 prior registrations.

Assigned-file `git diff --check` passed. No first-red test result occurred in either focused run. This verification does not claim full Node execution, browser captures, remote CI, merge, publication or physical-device testing.
