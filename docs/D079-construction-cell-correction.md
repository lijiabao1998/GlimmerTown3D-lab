# D079 — Preserve unequal construction-cell tops

Traceable guard-only correction, recorded 2026-10-19 08:18 UTC after discovery. This is not a new architecture card, a renderer change, or permission to relax D079's frozen acceptance.

## Evidence and incorrect assumption

The immutable D079 card requires every original construction tile and the actual camera-derived detail law to be preserved. It never requires all tiles of one owner to have the same roof height. D078's selected owners were single-cell; D079 aquarium owner119 occupies four original tiles at (33,31), (34,31), (33,32), (34,32).

The pre-code `construction-camera-pins.json` has SHA256 `61cc8c0a51e0d7a9c2c42d8d8f70f5762ae495072bbf43c1f33343bd517841f2`. Its independent published-baseline owner119 tile tops, in the order above, are:

- v0: [0.8044486045837402, 0.8500000238418579, 0.8044486045837402, 0.8500000238418579]
- v1: [1.0789076089859009, 1.1399999856948853, 1.0789076089859009, 1.1399999856948853]
- v2: [1.0505152940750122, 1.1100000143051147, 1.0505152940750122, 1.1100000143051147]

All four tiles have age400, base0, a50 and wallTop0. The unsupported v3 aquarium request keeps original v0. These exact archived owner/tile records are retained in D079_BASELINE_CONSTRUCTION. No baseline tile is replaced by a candidate measurement.

The first D079 frame adaptation incorrectly required all parcel tile age/base/top/a values to equal the first tile. A read-only diagnostic at 08:15:50 UTC established that the immutable baseline itself disproves the equal-top assumption. The repaired candidate likewise has unequal tops: v1 [1.1399999856948853, 0.524399995803833, 0.34200000762939453, 0.9120000004768372], with all four original ages400. These are per-cell geometry measurements, not changed world ages.

## Exact guard change

Only the invalid equal-cell-top assumption in d079OwnerConstruction is changed. For a multi-cell target, the function now requires every original parcel tile to be fully built under the unchanged CON_DAYS/dayFrac law. Every tile's own age, top, base, a and wallTop remains in the returned state and is compared exactly. The actual shader skips construction clipping for every completed cell regardless of unequal top values; therefore every mandatory point remains unclipped. No multi-cell unfinished-state inference is accepted by this domain-limited guard.

The single-cell clipping computation remains unchanged. Production construction/clipping shaders, geometry, colors, camera plans, fixed samples, archived samples, classifier, tree states, frame pins, rawThree comparisons and detailAlpha law are unchanged. Inspection script and workflow remain frozen.

## Required controls and verification

- The genuine unequal archived tile tops must pass exact comparison to all immutable baseline records.
- The genuine unequal candidate tops must pass Node-to-browser exact tile comparisons.
- Changing age, top, base, a or wallTop in any individual tile must fail assertD079OwnerConstruction. Existing negative controls iterate every field and every tile.
- A changed original construction age must fail. The live diagnostic changes the first tile to age7 and restores it; the multi-cell completeness requirement rejects this clipped state. Formal tests also require every selected owner to retain originalAge400, age400, rise1, complete=true and zero clipped mandatory points.
- Every target parcel remains tree-free; every other original live tree age/transform remains exact.
- No production value is overwritten to satisfy a diagnostic.

## Source snapshots and process accounting

The first full frame run started 08:14:29 UTC, local session62169, log `scratch/d079/frame-full-first-run.log`. It loaded frame SHA256 `540da571dfd3868c821c55da5110b2a6af89c16e4117b7a9d7041bd98e4b7fa4`. Its exact source was preserved as `scratch/d079/frame-first-multicell-assumption.mjs`; the saved bytes were checked against that same SHA256. The invalid assumption was corrected at approximately 08:16:55 UTC while that process continued using its already-imported old module. At 08:18:38 it was still running, with exact frame submissions/angle settlement and the first five raw-contract cases passed; its final construction group is expected to record the old-assumption failure. No completed full-suite outcome is asserted here.

Corrected frame SHA256: `6ec0bb54546b88248e533dd9dd0978f7eee2437580481af6954a7bf323539e3d`.
Unchanged unit-frame SHA256: `48e84e36f59af20e1d65635b8455778e0a3ceb99e5c56d6d13937fc796deef77`.
Unchanged capture SHA256: `74fc585b921f14966e82041476910da1c2167c673ca4f564e6e7e5fd6efbbefb`.

A separate focused corrected construction run started 08:17:38 UTC, local session47166, log `scratch/d079/construction-multicell-correction.log`. At this document's creation its result was pending. The prior run's unaffected coverage checks, and a focused correction pass if obtained, must not be described as a final corrected complete suite. Full corrected exact-head formal CI remains mandatory before merge/publication. Every first-red log/source snapshot remains evidence. No further guard/source edits during the active full run without a separately reported blocker and traceable correction.
