# D082 nine-model preview verification

This is an authorized art expansion and real-product preview, not a merge, deployment, release approval, or claim that the rejected ten-model gates pass.

## Immutable baselines and approved pair

The independent target contract contains exactly 179 v0–v2, 185 v0–v2, and 154 v0–v2. All three 126 variants remain legacy. The published legacy fixtures are unchanged. The new published-main qualification is stored as deterministic `fixtures/d082-redesign-additional-before.json.gz`, SHA-256 `0114070fc3eecb5acbfc133e84392b44dee3e003993d0244ff4130b0044857ed`; its uncompressed SHA-256 remains `5ee4253aa8a02ed912d246220875183eb8664d00a48d78c1857187f581895c01`.

The accepted 179 v0/v1 meshes are independently byte-pinned to immutable local c3b601b / approved remote cb09a27b, including all typed attributes and 36 affine cases each. Pins are not regenerated from the expansion. All 130 previously published model slots are checked against their original geometry/Float64/cost pins. Nine new architecture signatures must differ from one another and all 130 earlier signatures.

## Structural proof

The emitter's empty components metadata is not treated as evidence. `d082-redesign-surfaces.mjs` independently specifies numerical convex body, gable, hip, and box solids. Its oriented planar surface-multiplicity comparison checks the actual emitted triangle surfaces against complete intended faces, including partitioned door fronts, chimney bottoms, and roof undersides. The squared difference of polygon coverage measures detects missing, excess, duplicate, shifted, and reversed surfaces rather than accepting equal triangle counts.

Each analytic solid separately requires exactly two oppositely oriented incidents per edge and positive signed volume. Only body ground caps are virtual, and they must be exactly at the original ground datum. Explicit pairwise attachment IDs and maximum three-dimensional intersection volumes distinguish intended body/porch, roof/chimney, plinth/body, and reservoir contacts from unexpected interpenetration. Every expected contact must still exist. Same-oriented coplanar duplicate component faces are rejected. Missing/reversed triangle and face controls, moved geometry, excess overlap, missing contact, NaN, owner, normal, bounds, and budget controls are retained.

The rejected draft gate `tools/d082/geometry-test.mjs` also forbids overlapping x/z projections of all O triangles. That assumption conflicts with approved closed roof undersides and chimney attachments. It is not used as a replacement for actual 3-D closure/nonduplication here. The old gate remains unchanged and is not claimed to pass. The parent independently traced this rule to rejected draft e93a5d7, not published main 2cd43c4; no published rule is changed.

## Preserved first red: construction envelope

The first generalized Node check failed at gallery conTop, expected `9543da22`, actual `e9672912`. The original assertion and log are retained in Git history and `docs/evidence/D082-redesign-first-red/conTop.log` for the local run. Investigation found only target 154 owner94's per-tile 4×4 envelope changed with its authored geometry. For example native tile(8,25) changed .004→.066 and tile(11,28) .330→0, while maximum model H stayed .33. This is not a saved-world or simulation change.

The frozen existing `tools/unit-d082.mjs` construction contract explicitly requires unchanged arrays outside target footprints. The new test follows that scope and additionally recomputes each target top value independently from emitted geometry, checks all non-target cells exactly, and checks conBase, conWallTop and conBlockOf everywhere. Wrong target tile, overflow, and non-target mutation controls must fail. The full browser/oracle scene digest still compares every field exactly, including conTop; no browser digest attribute is removed.

## Visibility remains a separate primary requirement

The primary coverage classifier is the unchanged `d081OwnerSurfaceContract`, with exact parity against raw Three raycasts. Every original silhouette hit, including blocked hits, and every mandatory fixed triangle probe is retained. There is no candidate-specific reclassification or downward-cap exemption.

Early unchanged-classifier exploration at 360 found that the legacy 179v0 and 185v0 models could reach full coverage with supplementary legal views, but their candidate models retained respectively 31 and 16 required samples even after those views. This is a genuine red diagnostic, not an accepted exemption. The complete actual-capture coverage job independently evaluates all five retained production cameras for all nine models, before and after, at each width. It stores contracts, audits and every missing probe in compressed artifacts, processes every model, then exits nonzero if any requirement remains uncovered. Supplementary planning is not claimed as an actually captured view.

## Real images and honest workflow status

The push-only branch workflow has no deployment or pull-request trigger. The image job preserves full product metadata, normal-upload diagnostics, exact complete ground RGB, instance colors/ages, ordered empty UI systems, immutable save/history/world, per-owner content, live frame budgets, and exact paused PNG/canvas repeats. It uses original unmodified dist/index.html product renders, with no injected model, hiding of neighbours, crop, resize, pixel edit, or external asset. Paired before/after cameras fit every original owner vertex within existing legal zoom limits.

Each width (1440, 412, 360) captures 108 original PNGs: nine models × context/original/front/rear/side × before/after, eight native/copied overviews, and ten accepted-family reference views. Image completion is not coverage success. Separate mandatory structural and coverage jobs consumes the exact PNG manifest and can remain red without preventing image delivery. All jobs retain artifacts for 30 days. No browser capture has been attempted through the previously blocked local browser route.

## Preserved coplanar first red and coordinated correction

The stricter independent same-oriented component-face test initially found projected overlap area .068 in 154v0's reservoir wall/pavilion join and .0049 in 154v1's chimney-bottom/roof-underside contact. The original red log is retained locally as `docs/evidence/D082-redesign-first-red/coplanar-overlap.log`. Only these unapproved new models were corrected: 154v0 pavilion inner edges moved from .25/.75 to .23/.77, with their corresponding inner roof edges .26/.74 to .24/.76; 154v1 chimney bottom moved from .45 to .43. The independently authored contract and explicit attachment bounds were updated to those coordinated intended values. Neither accepted prototype was changed.
