# D058 independent code and geometry review

Reviewed on 2026-10-12 UTC. Local, uncommitted candidate based on `6f30f83faf4c4f4b02d1e3416d968a133f7da0b9`.

## Result

The reported chimney-contact, semi-detached eave, and front-yard walkway defects are resolved in the final reviewed geometry. No remaining high- or medium-severity numerical defect was found within this review's scope. All 12 focused D058 test groups passed in the final independent run.

This is **not a WebGL or visual pass**, and is not approval to publish. No new rendered image, browser smoke result, phone frame-rate result, or before/after visual comparison was obtained by this reviewer.

Final reviewed SHA-256 values:

- `src/render/britishStreetArt.ts`: `13d1e9d1241cd3056e1c31f2c68a427c8c75df516627504a11dd6bba05969172`
- `tools/unit-d058.mjs`: `d25c31430e53700a62abd85bd7831a1e2eccf495325c822da29e132d148761ff`

## Scope and method

Read `CLAUDE.md`, `docs/D058-british-streets.md`, the new street-frame and street-art modules, the D058 dispatch/cache changes in `cityScene.ts` and `cityView.ts`, the scene/capture tooling, and the historical-source/budget adaptations. Inspected the existing recipes, facade plans, geometry accumulator, picking implementation, and historical smoke expectations.

Ran local Node tests and independent THREE triangle raycasts. Did not edit repository source, run a browser, access the network, or push changes. The only written files are this requested review artifact, the standalone numerical probe, and its result JSON.

## Findings and resolution

### 1. Chimney bases stopped above roof slopes — medium, resolved

Original location: `britishStreetArt.ts:255–258`; corrected logic is now at approximately lines 258–290.

- Semi-detached case `(k=1, lv=1, v=1, w=1, h=4)`: original stack base was `0.50458163`, while the roof below an exposed stack edge was `0.49434644`, leaving a `0.010235` gap.
- High-street case `(k=2, lv=1, v=2, w=2, h=2)`: an original stack base was `0.68927551`, versus lower-side roof height `0.63972193`, leaving a `0.049554` gap.
- The original semi calculation assumed a depth-based gable slope even for a differently aligned hip. High-street boundary lookup could choose the wrong neighbor, and a maximum ridge height did not establish contact with the lower neighboring roof.

The fix computes a lower roof envelope over the stack footprint and embeds the base below it. Independent dense sampling found no remaining gap. Reinstating the old base formula in a read-only probe caused 18 semi and 6 high-street failures at the new repository guard's own 3×3 sampling positions. The guard therefore detects the original defects, rather than merely accepting the correction.

### 2. Eaves bridged semi-detached driveway gaps — medium, resolved

Original location: `britishStreetArt.ts:146–147`; corrected logic is now at approximately lines 146–152.

Original full-width front and rear ledges crossed every gap between separate house pairs. In the 2×1 semi case, a downward ray at gap center `(x=.86, z=.865)` hit a floating eave at `y=.28061223` before the driveway at `y=.002`. Gaps were `.125` wide.

The fix emits eaves per connected pair. Independent rays across multiple positions within each gap now find no geometry above the paving tolerance. The repository guard checks all three geometry arenas and includes a blocking-geometry negative control.

### 3. Partial road frontages left disconnected yard paths — medium, resolved for front-yard families

Original location: `britishStreetArt.ts:267–268`; corrected frontage/yard logic is now at approximately lines 296–320.

With a single road tile adjoining one end of a long terrace, the original individual paths all stopped at the parcel edge. Paths beyond that tile ended at grass, with no transverse paved connection.

The correction adds an in-parcel transverse frontage walk and joins each individual path to it. Independent checks cover a single road tile at either end of each tested parcel and verify that the strip overlaps that road's boundary.

The first correction overlapped the old hedge positions in 1-cell-deep semi rows: the new strip occupied `z=.972–1`, but the hedge occupied `z=.9657–.9895`. Forty-eight of 101 centerline samples hit the hedge. The final correction moves the complete hedge thickness inboard; dense strip sampling now passes.

The dedicated strip guard detects missing or raised/blocked paving. Its initial accidental requirement for a strip on zero-margin Victorian facades was corrected. These flush-front facades have no front yard; their door geometry is covered separately by entrance rays.

### 4. Historical probes and current-art coverage — resolved within the numerical scope

The old `facadePickTest` uses unrotated south-facing detail coordinates. Running those coordinates against the new default art produced four ground fallbacks among 25 affected seed-city probes. Historical smoke now explicitly runs with `streetArt=legacy`, preserving the meaning of the old expectations.

D058 now has separate actual triangle-owner tests for all four families and all four road-facing turns, including east. Its cache check requires `hit.block === bi`, preventing occupied-ground fallback from masquerading as a building-mesh pick.

The new detail-pick guard establishes detailed geometry ownership. Its near-surface rays do **not**, by themselves, establish visibility of a doorway from an external viewpoint. The separate independent entrance and side-shop probes below address representative occlusion cases by starting outside the model and checking the first hit's expected color.

## Final independent numerical evidence

The accompanying `D058-independent-probes.mjs` imports the production geometry functions and runs without WebGL. It reports the art source hash so that results cannot silently be attributed to a different revision.

- 504 external entrance rays: intended main/chamfer door was the first visible hit
- 40 external side-shop rays: intended shop glass was the first visible hit
- 38,416 chimney-footprint rays: stack base contacted or embedded into the roof; stack emerged above it
- 720 driveway-gap rays: no floating eave or elevated obstruction
- 31,605 transverse-frontage rays: first hit at the intended paving height `y=.003`
- 70 partial-frontage cases: one road at either parcel end remained connected to the frontage strip
- Zero failures

Run with Node 24 or newer:

```sh
node D058-independent-probes.mjs /path/to/glimmertown-d058
```

The 12 repository D058 groups also passed, including deterministic/finite/nondegenerate geometry, owner and normal checks, all-direction transforms, current-art detailed ownership, fresh-versus-incremental equality after road edits, three building batches and shadow flags, source-scope negative controls, and scene-computed triangle limits.

## Boundaries and outstanding verification

- Historical source reconstruction preserves the reviewed pre-D058 source bytes. No old geometric pins, source pins, or phone-budget thresholds were refreshed to hide the new art.
- The reviewed changes leave simulation/save implementation and recipe/partition source unchanged. Browser save/reload and genuine mouse/touch checks exist in the capture tool but were not executed by this reviewer.
- Scene-computed triangle counts are useful budget evidence, not measured GPU performance or mobile frame-rate evidence.
- The no-road primary-facade fallback is an explicit design choice, rather than proof of road connectivity where no road exists.
- New before/after WebGL captures, actual visual review from all requested viewpoints and sizes, complete browser smoke, and mobile/device performance remain outside this completed numerical review.
