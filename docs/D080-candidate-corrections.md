# D080 candidate validation corrections

Immutable pre-code card and design remain unchanged. This record preserves discovered failures and bounded fixes; it does not declare formal CI or publication complete.

## Horizontal ground normals

Initial renderer SHA256 `8550f973135eafc933a74af26bc48e4e4d3e261674d2559ac1318cc384de62e8` failed the existing exact-upward D guard:72v0,size1,H=.12,x=-3.125,z=7.375,y=.21 emitted `[0,0.9999999999999999,0]`. All31200 ground vertices across4000 transform cases were exactly horizontal;3600 normal vertices had generic normalization rounding. The first focused run retained25 passes,one failure and five unfinished checks,then was deliberately interrupted with exit130 before editing source. It is not a complete run.

The D080-only ground function now uses the existing Geo.quad primitive with analytic `[0,1,0]`; common Geo and all wall/roof code are untouched. Corrected renderer SHA256 `dcd20db75bc374f3588429ea580826b73e3573903f139540f19462af20e7f055`. All4000 transform cases retain31200 exactly horizontal ground vertices and now zero inexact normals. Architectural Float64 hash remains `2bb7ee54b5bc29f5614ba2ad93b756b0c7fd33bd507def986120bec4ad322db2`; ground triangle-set hash remains `63348f024890852d8ceca2e244f94cb35afb98800c8dba77b286aa7af07b12da`. Existing partition,ground-only and normal assertions are unchanged. Typecheck/build passed. Independent source review and an independent ten-slot reproducer accepted the bounded fix. Complete corrected geometry and formal CI remain separate results.

## Candidate surface views

Initial bounded1440 candidate check passed nine slots but retained three uncovered mandatory wall samples on72v0,566/569. No samples or old views were deleted. The already-frozen24-angle pool contains a legal45-degree yaw/14.4-degree elevation view at zoom8 covering all three at1440,360,412. Appending that view produces414 planned captures; corrected bounded1440 contracts cover6546/6546 samples across all ten slots. This is not the complete three-width rawThree/mutation/frame acceptance.

## Camera fixed point

The first targeted wiring check passed14/15. The new127 parcel target requires four exact clamp steps rather than the previous card's two-step assumption. The new expected fixed point is derived from unchanged production camera behavior. Production camera,original shots,time,1000-step fixed-point check and one-ULP rejection remain unchanged. Corrected targeted results and complete formal CI are recorded separately.

## Historical D079 phase isolation

D080 introduces native gallery models for127/120/72. Therefore both historical D079 browser phases explicitly include `communityArt=legacy`. The existing before phase still disables transitUtilityArt; after still enables D079. Historical geometry/oracles,294 views,150 standard originals and all assertions remain unchanged. Added controls reject missing or wrong D080 isolation and show communityArt cannot disable D079. Source restoration composes the exact SHA-pinned D080→D079→D078 chain, without broader allowlists.

## Preview provenance

Initial inspection commit593cfa26047024a63fe487df6d6fbbee5dc9c9f0,run39254264714,completed both360/1440 widths.52 originals per width preserve matching before/after cameras/world/presentation. Initial pictures are labeled as unpublished saved/import variants,with29v4 inheritedH=.22. Ground correction inspection commit414c75f586fa8d6b041b44a15c514c4c45f8c1f7 follows the retained initial run. Full revised-image identity,visual review and formal technical acceptance remain necessary; screenshots are not physical-phone tests.
