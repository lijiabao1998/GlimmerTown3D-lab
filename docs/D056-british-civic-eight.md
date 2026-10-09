# D056 — Eight British civic buildings

## Request and scope

The owner requested a large art wave of at least eight distinct British buildings, developed only on the assistant's cloud computer. Candidate branch from main `0e849a6f6322091863ab0c27b64a45c669e45444`. Draft review only: no merge or deployment.

## Acceptance, recorded before implementation

- Eight existing kinds receive genuinely different architectural massing: Victorian fire station (6), Arts-and-Crafts school (7), lantern-roof library (14), corner-clock post office (15), canopy railway station (17), clock-tower civic hall (42), Georgian courthouse (43), and open timber market hall (87).
- Shared brick, limestone, slate and dark green joinery create a coherent British streetscape. No external models, fonts, textures or images in runtime source.
- Existing kind IDs, lots, height budgets, costs, unlocks, simulation, save/share formats, storage and undo remain unchanged. No new IDs.
- Renderer writes no world state. Geometry remains deterministic, within each existing parcel and height, correctly owned for picking, and batched into the existing three arenas. A low triangle budget is checked per building.
- Show same-save/same-camera before and after streetscape, eight individual building previews, and mobile evidence. Synthetic fixture is labelled; no naturally played or real-hardware claim.
- Run typecheck, complete Node guards, build, existing smoke/native suites, new geometry/placement/occlusion checks, repeated/interrupted mobile navigation, and performance checks. Record passed, failed and unrun distinctly.
- Independent code and visual review before draft delivery. Remote commit and CI status verified on the exact candidate.

## Scope refinement

The first candidate contained five normal catalogue buildings and three existing-save-only models. Review correctly identified that the requested eight should be normally buildable. The primary set is now fire station (6), school (7), police station (11), pavilion hospital (12), Tudor village clinic (13), library (14), post office (15), and market (87). Station (17), town hall (42), courthouse (43) remain three bonus models for existing/imported cities; no new build rules or unlocks were introduced.

Geometric regression preserves 172 other kinds × 9 variants exactly. Historical D018/D047 guards run the explicitly preserved old recipes, and D015 uses a test-only query option for its complete old scene golden. Current eleven-model geometry is pinned separately with position/color mutation tests, all-arena arcade/column gap ray tests, strict height/parcel/owner checks. Current ai120 triangle delta is fixed at +3414: eight schools +1616, one hospital +178, ten clinics +1620; seed516 +0. Historical D003 unbatched geometry remains untouched.

## Result and limitations

Initial eight-model candidate b622374 passed the D056 GitHub Actions art workflow and existing D055 native workflow. Actual screenshots were inspected, including open courthouse/market geometry. Review requested tighter individual framing and a full-width mobile district; revised eleven-model capture is pending.

Local typecheck/build/focused geometry checks pass. Full Node suite is still running. Cloud shell Chrome cannot create its process-singleton socket; an approved escalated retry encountered the same restriction. No security settings were changed and no user computer was used. GitHub Actions provides the real browser verification. No real Android hardware performance claim.

Draft PR only; art approval, complete final CI and final independent review remain release gates. No merge/deployment performed.
