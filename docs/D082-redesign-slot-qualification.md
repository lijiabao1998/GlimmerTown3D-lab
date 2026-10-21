# D082 redesign: nine genuine existing slots

## Selection

The nine-slot expansion retains the two accepted 179 samples exactly and adds seven designs without altering save IDs, heights, footprints or simulation state. The following are existing imported variants, not invented renderer-only variant numbers.

| Slot | Gallery owner | Footprint | Original height | Weighted triangle ceiling | Direction |
| --- | ---: | ---: | ---: | ---: | --- |
| 179:0 | 154 | 1 | .78 | 182 | Accepted Cotswold stone village hall, preserve exactly |
| 179:1 | 154 | 1 | .66 | 182 | Accepted Arts-and-Crafts reading room, preserve exactly |
| 179:2 | 154 | 1 | .56 | 182 | Village schoolhouse with paired gables |
| 185:0 | 160 | 1 | 1.48 | 120 | Coastal watch house with lookout |
| 185:1 | 160 | 1 | .88 | 120 | Brick lifeboat station |
| 185:2 | 160 | 1 | .91 | 120 | Hipped-roof harbour office |
| 154:0 | 94 | 4 | .33 | 342 | Low reservoir gatehouse and open basin |
| 154:1 | 94 | 4 | .87 | 342 | Victorian waterworks engine house |
| 154:2 | 94 | 4 | .78 | 342 | Edwardian pump lodge with offset hall |

Ceilings are weighted costs, not raw triangle counts: shadowed geometry counts twice. The size-4 reservoir sites are an explicit exception to the initially preferred 1–2-tile footprint, not resized sites. Their low heights require broad, low architecture rather than taller substituted buildings.

## Published provenance and eligibility

The immutable published baseline is `2cd43c424dcc909dcfa6ac55275406d2bc527ce0`. The additional fixture is captured from a fresh isolated Git archive of this commit; no candidate source is imported. Every source file and historical fixture is compared directly with its committed bytes, then rechecked after collection.

The original ten-slot baseline already records 179:0–2, 185:0–2 and 154:0. The new [additional baseline fixture](../fixtures/d082-redesign-additional-before.json.gz) adds 154:1 and 154:2 only. Neither is among the 130 published exact-model slots. The imported kind table defines five genuine 154 variants, including v1 height .87 and v2 height .78. In contrast, 179 and 185 define only variants 0–2; numeric height fallback for v3 or higher is not evidence of a genuine additional slot.

The additional fixture preserves compatible `slots[key].sha256`, `float64Sha256`, `structureSha256` and `cost` fields using the historical draw helper's original defaults. It records 800 exact ordered tree-grid cases: two variants, five sizes, five heights, four origins and four turns. All must remain empty. It also records native and render-only copied v0/v1/v2 worlds for gallery, seed516 and ai120, with the copy limited to kinds 179, 185 and 154. Each scene is measured in modes a/b/c, with world hashes, weighted costs, signatures, complete scene digests and hashes of construction arrays. Copied views do not modify saved source records.

## Exclusions and reserves

126:0–2 have only weighted ceiling 56 and are excluded rather than padded into superficial designs. No existing fixture or historical gate is changed to accommodate this exclusion. The new nine-slot acceptance requires separately scoped checks.

If later needed, budget/eligibility-only reserves include 93:0 (size1, H.79, cap152), 186:0 (size1, H.57, cap176), 183:0 (size1, H.75, cap482), and 100:0 (size2, H1.58, cap400). Each is absent from the 130 prior-model list and has no retained exact-slot first-red in the earlier qualification record. This is not coverage qualification or permission to replace previously released generic art silently. No tenth is added merely to reach a round number.

## Limits and retained failure

The additional artifact is geometry and full-scene baseline evidence, not a new ray-coverage pass, WebGL approval, CI result or release. The two new 154 variants still need the unchanged mandatory coverage classifier and full candidate verification. Previously retained first-reds stay retained. The first temporary collector run failed because it called a nonexistent `ConState.snapshot()` method; no fixture was produced. The collector was corrected to hash the actual construction data/top/base/wallTop arrays, without modifying source geometry or acceptance criteria.

## Completed artifact checks

Additional fixture SHA-256: `5ee4253aa8a02ed912d246220875183eb8664d00a48d78c1857187f581895c01`. Collection completed with 227 source files, 80 historical fixtures, 800 empty-tree cases, 12 saved/copied scene cases and 36 scene/mode measurements. Both added slots cost exactly 342.

Gallery c-mode weighted count is 60,236 in native and copied v0/v1/v2 scenes. Exact signature for copied v1 is `0572252c654a3c75efef6246d234c39358255e86448bbecdc387fca8c1567426`; copied v2 is `0c210a32e764a864fbc15ea6e204132dbdaf4f30fff8d254d0f52559c0baf7b5`. These are the new nine-slot copied-world baselines, not the old ten-slot fixture's different copied-world hashes.

The deterministic gzip container SHA-256 is `0114070fc3eecb5acbfc133e84392b44dee3e003993d0244ff4130b0044857ed` (121,664 bytes). The uncompressed JSON SHA-256 remains `5ee4253aa8a02ed912d246220875183eb8664d00a48d78c1857187f581895c01`.
