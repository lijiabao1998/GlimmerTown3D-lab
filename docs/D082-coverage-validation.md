# D082 paired visibility qualification

## Final result

The repaired ten-slot pool passes all 30 owner/viewport cases at widths 1440, 360 and 412. The final candidate covers 24,300 of 24,300 required points. The independently archived published baseline retains and covers all 19,989 of 19,989 required points. Fresh missing/reversed wall/roof negative controls pass for both scenes: 240 controls. All baseline and candidate live surface contracts match rawThree extraction exactly.

Pool: 179 variants 0–2; 185 variants 0–2; 126 variants 0–2; 154 variant 0. Published heights, positions, turns, construction state, full owners, neighbors and trees remain in scope. The original production camera and the unchanged 24 predetermined supplementary angles are used, without classifier or threshold relaxation.

Authoritative final report: [candidate v3 summary](evidence/D082-candidate-v3/summary.json). Its SHA-256 is `e6a0856623462ee84c46c9d122f1677a205822a6411b5cd9eb05486ba0c8293e`. All three completed cohorts share the same 229-file source inventory, SHA-256 `88cbf920f6be713131bbf7c50fc5a5ea06b13a708c63146f4ceecf46c703d77d`; source bytes were checked before and after each cohort. Its 36 gzip artifacts retain full reports, per-width contracts and logs with both compressed and raw SHA-256 hashes.

## Retained failures and repairs

[Candidate v2](evidence/D082-candidate-v2/summary.json) retains the original geometry failures for 179:0, 185:0 and 185:2, respectively 9, 10 and 6 uncovered points at the first 1440-width check. The subsequent widths for those cases were not tested in v2 and are not claimed to have failed. Detached annexes were moved diagonally clear of shortened main buildings. [Repair-only v3](evidence/D082-candidate-repair-v3/summary.json) passed all nine widths before the complete final pool was independently rerun.

[Serialization first-red evidence](evidence/D082-candidate-serialization-first-red/) retains the earlier archived JSON signed-zero comparison failure. Archive comparison now uses exact serialized JSON equality; live accelerated/rawThree comparison remains strict. This was not a geometry or classifier change.

The compact [baseline fixture](../fixtures/d082-baseline-feasibility.json) refers to immutable [baseline evidence](evidence/D082-baseline-qualification/manifest.json): 76 gzip artifacts retain every original sample and rejected qualification record. Baseline qualification passed 120 baseline-only negative controls, separate from the final 240 paired controls.

## Verification boundaries

This is Node geometry and coverage qualification, not production browser acceptance. It does not establish WebGL shader/LOD/time wiring, rendered pixel appearance, runtime frame budgets, physical-device behavior or CI success. Later unit registration and wrapper aggregation edits do not change the source/classifier inventory, but their execution requires independent unit/CI validation. No deployed or merged result is claimed here.
