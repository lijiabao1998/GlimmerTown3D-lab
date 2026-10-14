# D057 — Real British heritage exteriors

## Request and baseline

The owner requested additional 3D British architecture based on buildings that really exist on 2026-10-10. This local candidate starts from deployed main `3330f0485cf8e37a40917f04ba16f7fa2d432639`. The eleven D056 British civic models are preserved. The work is isolated on `codex/d057-real-british-heritage`; no publication, merge or deployment is authorized by this card.

## Acceptance, recorded before implementation

- Add eight distinct procedural exterior studies of existing British buildings: Battersea Power Station (k5), Jumbo Water Tower in Colchester (k10), Natural History Museum in London (k35), Royal Albert Hall (k36), Radcliffe Camera in Oxford (k41), Kew Palm House (k63), Elizabeth Tower (k67), and Smeaton's Tower in Plymouth (k69).
- Verify each building against official or heritage-primary sources and inspect reference photographs. Document the location, recognizable exterior features, and source links. Photos are references only: no externally sourced models, textures, photos, fonts, audio or runtime requests.
- These are simplified, parcel-scaled exterior studies, not measured scans or exact architectural replicas. Existing game-kind function is unchanged and does not assert a building's present-day use. In particular, Battersea is a former power station, Kew is a botanical glasshouse, and Smeaton's Tower is a relocated historic lighthouse tower.
- Keep existing IDs, names, lots, heights, costs, unlocks, simulation, saves, history and RNG unchanged. k5/k10/k63 have existing native tools; the other five are existing/imported-save art. Do not describe all eight as native build tools.
- Preserve all eleven D056 geometries exactly, every unrelated kind and all historical comparison paths. Runtime dispatch is explicit and reversible for historical scope checks.
- Deterministic batched geometry only; exact owner IDs for picking, finite positions and normals, no degenerate triangles, parcel/height bounds, and a checked per-model triangle budget. No extra per-building meshes or materials.
- Render actual candidate meshes for visual inspection. Genuine same-save/same-camera in-game desktop/mobile captures are the acceptance target; an offline mesh render must be labelled as such and cannot stand in for browser or gameplay validation.
- Check type/build, focused current and historical geometry, bounds/ownership/openings/mutations, all existing aggregate Node/browser gates, native placement/undo and interruptions for affected tools, and final visual review. Report passed, failed and unrun stages distinctly. Do not weaken original budgets or goldens.
- Main merge and production deploy remain separate, unapproved actions. If cloud Chromium cannot run, request review-branch/draft-PR/non-deploy-CI authorization before any public push.

## Source verification and results

Pending. This section is intentionally incomplete before implementation. No tests, previews or release are claimed yet.

## Not completed

Source/photo review, implementation, tests and previews are not completed. No real Android hardware test. No public branch, draft PR, main merge or production deployment.

## Candidate preparation, 2026-10-10 UTC

The owner separately authorized this round's review branch, draft PR and non-deploy CI after being shown the eight named buildings. Publication does not authorize merge or production deployment. Local pre-implementation acceptance was committed as `78de6b9`; its identical card tree was published through the connected GitHub account as `c47085462c46adfee5c7daa371635082f5d627e8` before the implementation commit. Shell git push had no credential; no credential or security configuration was changed.

[Reference record](D057-reference-record.md) lists official sources and inspected photographs. Eight original recipes now exist. Their reference-scaled forms replace only the eight named generic recipes. Existing D056 eleven models and 175 unrelated kinds × nine saved variants remain byte-identical in geometry.

Local typecheck/build and nine D057 focused guards pass. Six original D056 geometry guards also pass through an explicit D057 historical-art comparison. New guards retain exact current geometry pins, independent position/color mutations, parcel/height/owner/nondegenerate checks, all-arena Jumbo opening tests, and independent full-scene/shadow-pass counts. Each new model uses at most 1,300 primary triangles. Decoded ai120 submits 89,508 triangles at C density (D056 80,816 + independently derived 8,692), under its unchanged 106,365 budget. Seed516 is unchanged.

Offline Blender renders of the actual emitted meshes were used only for local visual inspection, exposing coplanar surface and silhouette issues that were repaired. They are not game screenshots and do not demonstrate browser/native flow success. The non-deploy workflow will capture genuine same-fixture/same-camera before/after images at 1440×1000, 360×740 and 412×860, plus native build/undo/cancel checks for plant, water and greenhouse. The other five are existing/imported-save models.

Full Node aggregate is running; genuine browser captures and full browser CI remain pending. The comparison retains the original deployed baseline rather than replacing historical goldens. Existing game names/functions are unchanged; the documentation identifies real-world art references without claiming current use. No measured-site accuracy, Android hardware validation, merge or deployment is claimed.
