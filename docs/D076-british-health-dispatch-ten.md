# D076 — British health and dispatch buildings (replacement wave 8/20)

Pre-code replacement card, 2026-10-18 07:09 UTC. Published baseline remains 94024b6e2195f4d545de1f1af770dfbe98c1777a. Seven waves / seventy buildings are published. This replaces the unmerged D075 candidate, not an additional completed wave. The original D075 card, inspection commit a1dc2f955daf0659390e6112bf385c3220b24a56, screenshots and failed acceptance evidence remain preserved unchanged.

## Why a replacement
D075's unchanged strict before/after coverage gate fails: baseline 8298/8389 required samples versus candidate 7976/7976, at 1440. All original records remain; missing baseline samples are k135 variants 0/1/2 (16/24/39) and k28 variant 0 (12). At least one old canopy-covered wall point is mathematically unreachable at the minimum legal camera elevation. An original candidate k135v0 desktop close-up also clips three roof vertices. Neither failure is relabeled as passing, no frozen D075 acceptance is changed, and no further old-point search is planned.

## Ten slots before implementation
Retain the six D075 proposed structures, whose before/after 1440 coverage passed, but revalidate them under this card:
- k131:v0 civic emergency control hall, hipped hall plus observation tower and vehicle wing.
- k131:v1 gabled rescue headquarters, unequal steep-gabled hall and lower apparatus bays.
- k131:v2 modern response centre, stepped blocks, sloping operations shed and communications pier.
- k107:v0 garden crematorium, pitched chapel, offset chimney and lean-to porch.
- k107:v1 courtyard remembrance hall, perpendicular unequal hipped ranges and rear chimney.
- k107:v2 lantern memorial hall, polygonal hall, raised lantern and service range.

Replace only the four blocked slots with supported k149 grid-dispatch variants:
- k149:v0 county dispatch office: steep gabled main hall with a lower flat-roof service annex.
- k149:v1 courtyard network office: two unequal pitched ranges forming an open working courtyard.
- k149:v2 radial control hall: polygonal dispatch hall with a small rectangular annex.
- k149:v3 stepped operations house: three offset blocks of visibly unequal height, with contrasting roof levels and entrance direction.

These must be ten structurally distinct British buildings, not colors, rotations or states. All slots are saved/import-only; no new tools. All four k149 variants exist among five supported variants. Original parcels are 3x3. Immediate published weighted caps: k131=100, k107=94, k149=60. Do not increase any cap. Independent bounded k149 baseline preflight at360 using 24 predetermined legal views passed 853/853,869/869,870/870,829/829 required samples. This is feasibility only, not final regression or publication.

## Unchanged quality requirements
Preserve all seventy published wave models, non-target binary geometry, ordered trees, simulation, saves, IDs, height/parcel rules, picking and the exact published D074 native-touch repair. Eighty total wave models must remain distinct after translation, rotation, independent-scale, color and ordering normalization. Capture baseline fixtures independently from published 94024; do not refresh historical fixtures or weaken existing scope guards.

Every intended roof and enclosed wall must be complete, correctly wound and covered by independent missing/reversed negative controls. Retain complete fixed exterior samples and original silhouette-hit records. Require 100% of mandatory samples in BOTH baseline and candidate using the same declared legal camera views; do not exclude obstructed points to pass. Actual closed-solid/contact witnesses must be geometric, retained and negatively tested, never inferred from failed camera search. All views must fit the entire target-owner vertex bounds. Original standard city views remain preserved; supplementary views may use an explicitly recorded legal zoom that fits complete target bounds, without removing neighbors or altering scenes.

Real WebGL before/after at1440/360/412, original gallery/seed516/ai120, supported render-only copies, stable paused repeats, exact geometry budgets and all historical/performance/functionality gates remain mandatory. Show actual inspection images promptly while focused guards and full formal CI run independently; inspection-only images never substitute for final coverage or acceptance. Record all failures truthfully.

Submit a draft after focused guards and independent review; retain all formal CI jobs and thresholds. Merge only after all required exact-head checks and delegated visual review. Verify main CI, Pages and exact live bytes before the next wave. CI-only PR27 is separate and must be reconciled explicitly before either workflow change merges.

## Not completed
Replacement implementation, new focused guards, final complete views, full CI, merge and publication are not complete. D075 images are not D076 images. This card counts zero published buildings until the full process succeeds.
