# D082 nine-building redesign

On 2026-10-21 the user rejected the original ten-building art, then explicitly accepted both redesigned prototypes after seeing actual game screenshots. That approval selects the art direction, not the unseen full batch or a release. The original rejected PR remains untouched. This branch is not authorized for merge or deployment.

## Scope

The accepted 179v0 stone village hall and 179v1 Arts-and-Crafts reading room are preserved byte-for-byte across the tested transforms. Seven further designs use the same emphasis on entrances, roof hierarchy, masonry, chimney silhouettes and readable large details:

- 179v2: twin-gabled village schoolhouse.
- 185v0: stone coastal lookout house, a tall watch-house with a lower entrance range rather than a stretched cottage.
- 185v1: Victorian brick lifeboat station with a forward gabled entrance.
- 185v2: hipped-roof harbour office with an offset porch.
- 154v0: low reservoir court, retaining basin and three gate pavilions.
- 154v1: Victorian waterworks engine house, separated pitched halls and tall brick flue.
- 154v2: reservoir superintendent lodge and offset pump hall.

Nine distinct models meet the requested eight-or-more scope without padding the batch. The three 126 variants remain unchanged because their original weighted limit of 56 was too restrictive for the accepted level of craft. Two existing, historically untouched 154 variants replace that unsuitable allocation. No new IDs or variants are invented; sizes, heights, simulation, save data, UI and original per-slot geometry ceilings remain unchanged.

## Verification boundaries

The independent additional baseline is taken from the exact published D081 commit, not from the candidate geometry. The accepted pair's full emitted data is pinned independently. New batch checks cover the chosen nine slots; the archived rejected-ten gates are preserved and must not be described as passing for this different selection. Technical checks do not imply visual approval. Full-scene real browser previews are required for every new design, and the full batch must be shown separately before any release decision.

Initial weighted costs are 172/176/176 of 182 for 179, 116/108/108 of 120 for 185, and 316/284/284 of 342 for 154. All architecture remains in the shadowed W/O geometry, not moved to the decoration layer to evade budgets.
