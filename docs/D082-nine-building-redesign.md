# D082 nine-building redesign

On 2026-10-21 the user rejected the original ten-building art, then accepted the redesigned art direction; the task confirms all nine designs are accepted. Verification remains required. At 13:44 UTC on 2026-10-22 the user additionally approved the previewed finite 179v1 repair and its corresponding pin update. [That revision](D082-179v1-approved-repair.md) preserves the previous pins and coordinate evidence. The original rejected PR remains untouched. This branch is not authorized for merge or deployment.

## Scope

The accepted 179v0 stone village hall remains byte-identical across tested transforms. The 179v1 Arts-and-Crafts reading room now uses exactly the separately previewed and approved finite repair, with both old and new pins retained. Seven further designs use the same emphasis on entrances, roof hierarchy, masonry, chimney silhouettes and readable large details:

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
