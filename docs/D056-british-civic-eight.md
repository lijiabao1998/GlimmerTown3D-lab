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

## Result and limitations

Pending implementation and verification.
