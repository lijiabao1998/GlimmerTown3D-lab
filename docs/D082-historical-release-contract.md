# D082 immutable ten-model historical qualification

Supplemental contract, frozen before implementation on 2026-10-24. This is one half of the release migration; the actual accepted-nine product must independently satisfy its own geometry, scene, frame, pixel and source contracts. A historical pass cannot qualify the current product or authorize publication.

## Unchanged acceptance

- Archive the exact rejected-ten checkpoint `0b6da7aa384e5a65c07221eed9301aa4a94cd4ba`. Never substitute a branch tip or current nine-model source.
- Verify every archived tracked file against the pinned Git tree before and after execution. Preserve original geometry, source manifests, architecture checkpoints and tests byte-for-byte.
- Run the original geometry test, architecture checkpoint test, complete D082 integration test and historical D081 recipe test against that isolated historical source. Retain all assertions and negative controls. Any nonzero exit fails this qualification.
- Save each command's raw stdout/stderr and exact outcome, plus the commit/tree and archived source inventory. No test result is counted before its process has exited successfully.
- Check the archive verifier's missing-file and modified-file rejection. No fallback to current files if the pinned object is unavailable.
- This archival execution must never enter the production import graph or the current build. D081 current-build isolation remains a separate regression requirement.

## First independently executed checks

Before implementing this runner, a normal Git archive of the pinned commit passed the original geometry test (ten models, 130 prior models, 590 missing/reversed controls) and architecture checkpoint test (1,892 numeric fields, six negative controls). Full integration and historical recipe results will be recorded from their actual terminal outcomes.

The first complete integration attempt failed one source-inventory assertion because a Git archive nested under the current worktree inherited that parent's path prefix: its `git ls-tree ... -- src` returned no files (229 versus 3). The archived test and assertion remain unchanged. The runner explicitly supplies the original Git object directory and isolated archive as `GIT_WORK_TREE` to child processes; this restores the correct 227-source baseline lookup, without changing either product or tests. The first failure log remains in scratch evidence.

## Executed runner result, 2026-10-24 12:02 UTC

The corrected runner completed successfully against tree `34a6e740e1b13c20814d4f3bcc0d48e40e84f8cd`: all 1,980 tracked archived files were verified before and after execution. Original geometry, architecture, full D082 integration (18/18 groups) and historical isolation (171 query cases, 324 negative controls) all exited zero. The runner's own source verifier passed one positive and three negative controls. Raw command logs, immutable source inventory and the terminal report are retained under `scratch/d082-historical-release-runs/run-VlrdAb/`. The failed first runner is retained under `run-4k4Wx4/`.

This establishes only the original historical contract on its own exact source. It does not establish current accepted-nine geometry, current D081 browser pixels, current source allowance, CI, merge or deployment success. Those remain independently required.
