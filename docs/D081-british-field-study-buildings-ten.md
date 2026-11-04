# D081 — British field-study and camp buildings (wave 13/20)

Pre-code card, frozen before product implementation on 2026-10-20. Immutable published baseline: `7ec70a96b01437ab4576b0962905be16b1591e79`. Twelve waves / 120 buildings are byte-verified published. This batch counts only after complete publication verification.

## Independent design

Initial numeric architecture is preserved verbatim in `D081-initial-architecture.json` and `fixtures/d081-architecture-contract.json`, SHA256 `2467cbd6189e8100a95869df3416a23d73f41ce248408a3ea36903216a65da11`. Independent review verified 17 closed positive-volume components, 144 complete planar architectural faces, 219 roof-overlap comparisons, and 816 missing/duplicate/reversed triangle controls. The combined 120 published models and ten designs have 130 pairwise-distinct full-model signatures and 130 pairwise-distinct W/O signatures. Geometry is an original British-inspired abstraction, not a replica or imported asset.

- 160v0: Gabled wetland visitor lodge and learning room; inherited H=0.37, weighted ceiling=562.
- 160v1: Octagonal wildlife classroom and specimen store; inherited H=0.42, weighted ceiling=562.
- 160v2: Cranked wetland field laboratory and workshop; inherited H=0.34, weighted ceiling=562.
- 160v3: Double-gabled reedland centre and field office; inherited H=0.38, weighted ceiling=562.
- 160v4: Cruciform observation lodge and boathouse; inherited H=0.37, weighted ceiling=562.
- 182v0: Stepped clerestory campsite amenity hall; inherited H=0.38, weighted ceiling=128.
- 182v1: Hipped campwarden house and washhouse; inherited H=0.54, weighted ceiling=128.
- 182v2: Canted campsite kitchen and pyramidal store; inherited H=0.69, weighted ceiling=128.
- 72v1: Offset-ridge pentagonal remembrance chapel; inherited H=2.28, weighted ceiling=34.
- 72v2: Notched monopitch vigil house; inherited H=0.56, weighted ceiling=34.

Exactly ten saved/import slots, no new building ID or native tool. Gallery owners 172/157/133 retain original parcels, age400, level1, world, saves, picking and neighbors. No selected owner occurs in seed516 or ai120. All original target ordered tree instances remain empty. Preserve published 72v0. Read-only copied native/v0/v1/v2/v3/v4 gallery previews apply only exact supported slots. All unsupported variants preserve original binary geometry. Size-four wetland buildings retain particularly low inherited H; actual recognizability must be visually reviewed, never inferred from numeric checks. Atlas styling does not count as structural detail or geometric openings.

British vocabulary references: https://historicengland.org.uk/listing/the-list/list-entry/1213931 (field-study centre); https://historicengland.org.uk/listing/the-list/list-entry/1204943 (timber camp chalet); https://historicengland.org.uk/listing/the-list/list-entry/1391588 (memorial chapel). No external source assets.

## Baseline qualification and retained first reds

All ten final slots passed all30 owner-width cases:28179/28179 complete mandatory samples,30 exact rawThree contracts and120 rejected missing/reversed controls. Full-owner bounds fit. Joint final gallery variant pool remained identical across both completed cohorts. Summary SHA256 `eaa5f9a9532bf50e9291a4338220ba5a899f0ecef2fafdd6dc272f16cfd5c6b2`. All1749 tracked baseline source files were checked unchanged before and after qualification.

All old surfaces and silhouette hits remain stored. Original 24 legal supplementary angles and production cameras are retained. Old kinds160/182 have inclined cone architectural sides and no vertical wall faces; kind160 also retains its horizontal water quad: their baseline missing/reversed controls use two distinct real required inclined faces with different normals, after asserting no vertical fixed triangle exists. This is a pre-code applicability definition, not an exemption from coverage. Candidate architecture must have actual complete walls and roofs, with separate missing/reversed wall and roof controls. Kind72 keeps original wall/roof controls. Independent selector review passed; the original cone mandatory-wall first red is retained.

Numeric scratch first reds are retained: initial generator duplicate declaration, and182v2 roof fan-split manifold failure corrected from[1,3] to[0,2] before this card. Final independently reviewed geometry is pinned above.

Failed candidate slots59v0,136v0,40v0,153v0,175v0,176v0,75v0 retain every unreachable surface point and failure evidence. Untested widths/variants are not claimed failed or passed. No old geometry, construction age, camera or point classifier was changed to qualify these ten slots. Source archive SHA256 `96d9b65c433396deb01af45fd62ac8d56c8ede3e372744a36b8ee9b93a70226c`; 1749-file source inventory SHA256 `bb2760f9374d26e985c787cd2e7cbcf3bca3d28ded5cf4577033f7bf0eb2220e`.

## Frozen acceptance

Independently archive exact baseline source, geometry, ordered trees, budgets and historical fixtures. Preserve all 120 prior models and every non-target binary case. Require 130 distinct normalized full-model AND 130 W/O-only architectural signatures, insensitive to translation, independent axis scale, quarter-turn, color, material/arena assignment, triangle order and diagonal alone. Recolor, reorder, scale, rotation or D-only changes cannot supply a new structure.

Implement renderer independently without runtime fixture/oracle imports. All architectural walls/roofs belong to W/O; D only declared upward ground paving/water. Wetland water must remain visible outside architecture with positive separation; its old quad need not remain byte-identical inside changed target geometry. Each component has independent explicit faces, complete roofs/walls, outward winding, positive volume, manifold edges including declared ground closure, complete planar nonoverlapping partitions and full area/boundary checks. Reject missing, duplicate, reversed, notch-filling, overlapping or incomplete wall/roof geometry. All 17 components and numeric independent separations remain exact. No decoration may stand in for a building or provide structural uniqueness.

Require 100% complete stored-geometry sample coverage in BOTH baseline and candidate, all30 owner-width cases at1440/360/412. Keep every mandatory exterior sample and original silhouette-hit record; no visibility-driven exclusion. Internal/contact exclusions need independent geometric witnesses. Every close-up fits full owner; legal recorded fit zoom may be used without removing neighbors. Preserve archived/current production camera contracts and independent rawThree parity. Candidate coverage is unproven at freeze.

Preserve construction/clipping/tree-growth logic. Finished gallery cases stay age400. Pin uDayFrac=0, uTime=2.2, uProbe=[-1,-1], uNoClip=0. uDetail equals immutable product camera-to-detailAlpha for each settled camera. Include wrong LOD, camera/target and construction-state negative controls. Preserve original camera/time values and all historical captures. Require frame budgets, stable paused repeats, raw pixel/manifest provenance and all historical functional/performance gates.

Preserve published touch repair, all original performance thresholds and parallel CI jobs. Add D081 validation and fail-closed Pages dependency. Default unit remains complete; partitions exhaustive/disjoint, existing120-minute and45-minute limits unchanged. Keep all missing/fail/skip/cancel/artifact controls. Historical isolation may compose only exact SHA-pinned D081 restoration with prior chains; do not broaden arbitrary allowlists or weaken old assertions. Do not duplicate historical suites solely for bookkeeping; latest-head formal CI remains mandatory.

Show real WebGL previews early through inspection-only branch, disclosing saved/import and inherited-height limits. Independent review and all latest-head CI gates precede merge. Main CI, Pages and public HTML exact byte equality precede wave14. Keep all first reds and limitations; runner screenshots are not physical-phone tests.

## Not completed at freeze

Baseline qualification and independent numeric review passed. Renderer, candidate guards, real candidate previews, CI, merge and publication are incomplete. No D081 building is counted published.
