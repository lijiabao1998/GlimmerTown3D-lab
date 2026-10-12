# D058: preserved D056 dialog failure and minimal harness fix

Reviewed: 2026-10-12, 06:03 UTC

## Result

The first D056 workflow run remains **failed**. Its two original whole-PNG guards correctly rejected images rendered with D058 street art still enabled in the supposedly historical pass. The evidence supports a narrow historical-rendering harness correction, rather than changing the artwork, UI, expected images, tolerances, or assertions. The proposed two-line correction has been reviewed but still requires a real browser rerun to establish that the original hashes pass again.

## Exact evidence

- Candidate head: `d31f0e7e6de1dbde539ec1b5daebba714bca7676`.
- PR checkout: `2a6a41f741924ceee465e0f85f6e51b571928775`; its tree is `f8f95684dd216260cf6c5cf0fbd87b65d71ac9fa`, identical to the candidate tree.
- Failed run: [38209610458](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38209610458), [job 114680614988](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38209610458/job/114680614988).
- Failed-run artifact: [11728813313](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38209610458/artifacts/11728813313), ZIP SHA-256 `d5b2361853781b5085ca236994fdd37dcdbf909a78dbaefea4d228cece6ccee0`.
- Prior successful reference run: [38092591732](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38092591732), job `114331906309`.
- Reference artifact: [11684966134](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/38092591732/artifacts/11684966134), ZIP SHA-256 `49b17fa339023f3f131b823529d1317e5dc79ba24cabe8d1317db9aec7d33b96`.

Both archives were hash-verified. Reference PNG hashes match the unmodified goldens embedded in `smoke-d050.mjs` and `smoke-d051.mjs`.

## What passed and failed

The failed run passed typecheck, D056 geometry/unit guards, and all six D056 desktop/mobile capture cases: 30 before images and 30 after images. Both current-art D049/D050 interaction suites passed all 38 recorded checks, including trusted input and 20-day matched model trajectories. Their results and 10 screenshots were preserved under `D056-current-` filenames before the historical pass.

The historical interaction passes also completed, but the subsequent exact-image guards failed at their first mismatching files:

- `D049-unsupported-after-360x740.png`
- `D050-edited-empty-error-after-360x740.png`

The pristine-guard assertion then terminated the step. PNG-mutation negative controls and the subsequent D055 step in this particular workflow were not reached. This must not be described as a wholly successful D056 run. The separate full-CI D055 job passed independently.

## Why the historical pass used new street art

The standalone `d056-dialog-goldens.mjs` passes raw `withBrowser` to its current-art suites. Its historical wrapper originally appended only `britishArt=legacy`.

Those settings control independent render paths:

- `britishArt=legacy` selects old individual civic-building recipes.
- D058's `blockRenderFor` sets `streetArt: q.get('streetArt') !== 'legacy'`.

Consequently, omitting `streetArt=legacy` left the new D058 residential streets enabled during exact historical screenshots. The production D048 fixture used by these dialog tests contains four affected blocks: two `ukTerrace` blocks and two `ukVictorian` blocks.

## Decoded-pixel comparison

The downloaded PNGs were decoded without changing either image. Every one of the ten historical screenshot files differs from its original golden, but all changes are tightly localized and every channel difference is at most 4 on the 0–255 scale.

| Image | Changed pixels | Changed-pixel bounds, inclusive |
|---|---:|---|
| D049 unsupported, 360×740 | 1,703 of 266,400 | x63–143, y448–519 |
| D049 rejected, 360×740 | 1,700 | x63–143, y448–519 |
| D049 ready, 412×860 | 2,140 | x69–161, y527–603 |
| D049 success, 412×860 | 2,132 | x69–161, y527–603 |
| D049 pending, 412×860 | 2,196 | x69–161, y527–603 |
| D049 reopened, 412×860 | 2,140 | x69–161, y527–603 |
| D050 edited-empty-error, 360×740 | 777 of 266,400 | x63–140, y486–519 |
| D050 reopened, 360×740 | 777 | x63–140, y486–519 |
| D050 invalid-error, 412×860 | 1,294 | x69–155, y554–603 |
| D050 retry-new-error, 412×860 | 2,094 | x69–161, y526–603 |

The unchanged dialog CSS uses `#141a30f5` for its card over a `#0008` backdrop. This transmits approximately 1.83% of the underlying city color, allowing a full-range background change to produce roughly 4–5 levels of final pixel difference. The measured differences match that scale. They occur **under the translucent dialog**, not exclusively outside it; the opaque textarea conceals the same background where it overlaps.

Independent Node-only projection of the actual old/new geometry identifies the visible affected Victorian block at `(33,34)`:

- At 360×740: old bounds x65.8–140.8, y442.4–521.2; new bounds x68.0–139.2, y444.1–520.9.
- At 412×860: old bounds x73.3–160.4, y514.1–605.7; new bounds x75.8–158.6, y516.1–605.3.

The screenshot differences align with this footprint, including a few pixels of edge/shadow spread. The rest of each image is byte-for-byte identical after PNG decoding. There is no broad text, font, camera, or layout drift.

Both reference and failing jobs used Ubuntu runner image `20261004.327.1`, runner provisioner `20261002.596`, Node `24.21.0`, and `fonts-wqy-zenhei 0.9.45-8`. The logs do not independently record an exact Chrome version, so this report does not claim to have compared one.

## Reviewed minimal correction

The local diff contains exactly two changed lines in `tools/d056-dialog-goldens.mjs`:

1. Add `streetArt=legacy` alongside `britishArt=legacy` only in the historical wrapper.
2. Update the report's `historicalArtQuery` string to match.

The first current-art interaction passes and their artifact preservation remain unchanged. All ten original image hashes, exact equality checks, and mutation rejection checks remain unchanged. No renderer, game state, screenshot golden, or tolerance was edited by this correction.

A successful rerun must demonstrate both the real current-art interaction passes and restored pristine historical PNG matches, followed by both mutation-negative controls. Until then, the original failed result remains preserved and the correction is unverified in a browser.

## Attribution caveat

The aggregate `tools/smoke.mjs` deliberately routes inherited suites through `streetArt=legacy`. Therefore a `D056-current-` file produced inside that aggregate means current D056/D057 civic art with historical streets, not proof that D058 streets were active. The standalone D056 workflow's first passes use raw browser routing and did exercise D058 streets. D058's own current-art capture and selected current-art regression jobs remain separate evidence.

Local reference images: `ci-d056-golden/files/shots/` beside this report. Preserved failing images: `ci-d056-first/files/shots/`.
