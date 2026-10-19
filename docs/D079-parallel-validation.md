# D079 additive parallel validation

Supplemental scheduling card, frozen before implementation on 2026-10-19. Implements the authorized parallel 3D validation while preserving all tests and release gates. Baseline: `46771cdc00f33759e0a3c45ddf05c3387d4bb4fc`. No rendering, geometry, sample, threshold, GitHub setting or historical job change is authorized by this card.

## Acceptance

- Preserve the existing D078 frame job command, artifact and 120-minute limit. Add an independent D079 Node frame job at the same 120-minute limit. Historical Node retains its 120-minute limit and every prior baseline fetch, plus the immutable D079 baseline.
- Default unit execution includes all 117 registrations and all inline assertions. Historical execution includes inline assertions and all registrations except the separately scheduled D078 and D079 frames. The three scheduled partitions are pairwise disjoint and their union equals default execution, in original order within each partition.
- Register D079 structural and frame guards without changing any prior guard. Generalize only the separate frame runner, retaining full verbatim reports, log, failures, exceptions, evidence-write failures and source/run provenance. D079 provenance pins its card and exact validation tools; CI checkout must equal workflow SHA with clean tracked sources and valid run identity.
- Add D079 WebGL captures at widths 1440, 360 and 412 with fail-fast disabled, complete artifacts and mandatory Pages dependency. Preserve every existing D job and release dependency and every workflow setting.
- Smoke aggregate requires build, historical Node, BOTH independent frame jobs, browser and screenshots. Missing, failed, skipped, cancelled, pending, malformed stage/artifact identity fail closed. Artifact upload cannot turn a failed test into success.
- Fast controls prove partition exhaustiveness, exact inventory, generic runner error/report serialization and provenance rejection, unchanged D078 workflow, D079 capture matrix and mandatory Pages gates. No full-unit execution is needed to test scheduling.

## Not yet completed

Implementation and fast controls pending at card creation. This card does not assert D079 geometry, frame coverage, WebGL captures, CI or publication success.

## Scheduling implementation verification

2026-10-19: fast scheduling/control suite passed 146/146 tests using `node --test .github/scripts/ci-integrity.test.mjs tools/unit-partitions.test.mjs`. Default inventory is 117 guards plus inline assertions; historical is 115 guards plus inline assertions and each independent frame partition contains exactly one guard. Every historical registration remains ordered. All 22 untouched existing job blocks, including the entire D078 frame job, and top-level workflow settings were compared byte-for-byte against pre-change HEAD and remain identical. `git diff --check` passed. An initial fast control caught a missing D079 artifact requirement in the aggregate; that first-red result was fixed by adding D079 to the mandatory artifact inventory and rerunning all controls. No full application tests, remote CI or publication outcome is claimed here.
