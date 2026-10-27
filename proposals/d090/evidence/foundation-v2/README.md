# D090 first official browser red: real foundation repair candidate

This directory is a private, source-bound diagnosis/prototype, not a release or visual-acceptance claim. Original current source, authority, plan, first-red official files, classifier and thresholds remain untouched by this worker.

## Reproduced first red

Official head `6c118a6a`, procedural authority `11bfc55e035278bc9391fc649301efd026b8b050056d416a0691c1a90bb5ce37`, cache `ea98d9bd696028a47c933b0424d7ca25ce4b9127e6dbb7daecd60f48658c4319`.

- 360: no missing required point.
- 412: `mesh-1-triangle-696-barycentric-3` missing.
- 1440: `mesh-1-triangle-696-barycentric-2` and `-3` missing.

Triangle696 is the west sloping face of `battered-enclosed-reservoir-shaft`. Both failed probe identities fall at world x `3.2699999809265137`, y `.27999999523162844`, exactly the intersection with `west-integral-crenellated-wall`. Actual first hit is wall1025, only `2.78e-14` from the probe, but its normal dot is `.9899495122`, below the unchanged `.999999` requirement. The correct slope696 is the next hit approximately `2.84e-14` farther. Analytical/actual camera arithmetic reverses or ties these hits; this is not missing raw geometry or a large physical occluder. Complete original/actual/pose-vs-zoom cross-product and exact both hits are retained in `castle-696.json` (SHA `712c934b9e76f020da9258d9fe9e9b9c1dbb925c73fe9a7a7631529de80abe64`). No camera retry, tolerance relaxation or lucky extra view is used as a repair.

## Finite physical design revision

Parent selected an actual broader battered stone foundation: square ground ring `[.23,.77]²` becomes `[.20,.80]²`, with unchanged `[.28,.72]²` shoulder at world y `.35`. Exact sole source literal change and preimage are in `foundation-delta.json`. All crown, buttresses, vestibule, 265 facade intents and every complete model of the other nine are exact. Ten structural triangles/four ground vertices change; footprint area grows `.2916 → .36`, lower-frustum volume `.0843266667 → .0953866667`. New/old ground corners lie strictly within the retained buttress ground-corner convex hull, so whole-owner framing hull is unchanged. Full detail in `foundation-form-delta.json`.

Candidate authority SHA `a3f5d4376ea1d57d80efa9f3b54410af4ae6b3a9345c49b41ef30692f1bafc58`; file `foundation-candidate.mjs`.
Parent's independently compiled cache SHA `54b809e292f43abab21a0a99732788620736160db5acd2cd3026e4a7f698eeda` is separately tested, never inferred by relabelling these procedural results.

## Full static/probe evidence

`foundation-static.json` (SHA `d0ac7a8303c22c9f355a3c2d0026a0d2b577333d3703eb38d44bf2e8d530c00f`) passes all44 positive closed solids, 7,140 structural destructive controls,132 closure controls,90 facade controls,20 complete door routes and unchanged caps. No positive-area exposed co-facing pairs. Castle remains984/1200 weighted.

`foundation-contract-delta.json` (SHA `4497161b1d83524233a12038b8c8f5d93b9b9275dbf3b605f5394c73e10217a4`) retains COMPLETE old/new records and classification witnesses at all3 widths:
- All1,968 fixed probe IDs/order are identical.40 point/normal records change naturally on the ten revised triangles.
- 10 required→covered and1 covered→required. Every newly covered record independently lies strictly inside actual closed Float32 foundation/buttress volume; smallest interior plane clearance `.00008924441467497712`.
- Original silhouette grid:44 existing actual first-hit records change,3 physical hits added,0 removed.
- The two originally failed696-barycentric identities remain REQUIRED. Their revised actual-camera slope hit now precedes the next wall by `.00979795–.02926084` world units, rather than an ambiguous roundoff tie. `castle-696-foundation.json` retains those actual hits.

## Complete native replay, not new pixels

`foundation-native/report.json` (SHA `20ad9e4c8a45837ebfe11f63475fb63b8899728d75a996d796dd4ae861520525`) passes30/30 complete native cases:56,037 required observations and all795 paint observations. All original48 rays and all183 retained official actual-camera audits pass; every paint witness belongs to a retained actual camera, zero uncaptured witnesses. Full per-case contracts/original48/actual-camera/paint receipts are retained as gzip. These replay OLD official cameras on NEW geometry numerically: they are NOT new raw images.

A distinct cached54b canonical30 proof is running in `/workspace/shared/d090-native-cached54b{,-paint}`, with full263 source inventory pins before and after every serial worker. No local browser has been launched. Fresh exact-head official Chrome, images/repeats, actual visual review, performance, CI and normal publication gates remain mandatory.
