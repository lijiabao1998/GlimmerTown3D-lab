# D077 — British service buildings and guesthouses (wave 9/20)

Pre-code card, 2026-10-18 15:33 UTC. Immutable published baseline: 7d4df8a907368a25f1ff92958b8b70ae85b8ad1c. Eight waves / eighty distinct buildings are published and byte-verified. This card counts one further batch of ten only after full release verification.

## Ten exact slots and structural designs
- k164:v0 Edwardian utility headhouse: long steep-gabled access house beside a separate square ventilation tower; arched main windows and narrow tower grids. Existing weighted cap56.
- k164:v1 courtyard conduit lodge: six-sided L-plan closed flat-roof service house with a separate pyramidal ventilation pavilion; ribbon windows. Cap56.
- k164:v2 lantern access pavilion: four sloping roof surfaces surrounding a real opening occupied by a complete raised glazed lantern; arched base and ribbon upper windows. Cap56.
- k119:v0 municipal cookhouse: two unequal closed mono-pitch cooking halls with a square brick chimney and working yard; high windows and louvres. Cap68.
- k119:v1 gabled production kitchen: longitudinal gabled kitchen, lower mono-pitch loading range and separate square chimney. Cap68.
- k119:v2 pyramidal service kitchen: pyramidal main kitchen, long flat preparation wing and slender square chimney. Cap68.
- k116:v0 low-profile exchange data centre: L-plan low machine house plus lower mono-pitch equipment wing, with a recessed court. Cap60. Preserve inherited H=.12; this limitation must be disclosed with previews, not silently repaired.
- k149:v4 octagonal dispatch office: closed flat-roof octagonal control hall with a low triangular entrance wing. Cap60. Existing D076 k149:v0–3 remain exact.
- k81:v0 clipped-end guesthouse: rectangular house with one hipped roof end and one gabled end, arched windows, complete roof and all walls. Cap28.
- k81:v1 oblique guesthouse: parallelogram-plan pitched house with complete oblique gables and punched windows. Cap28.

These are ten structural models, not rotations, recolors or states. All selected slots are existing saved/import variants; no new construction tools. Supported render-only copies are native and v0/v1/v2/v4, applied only to declared slots. Preserve original parcels, heights, IDs, picking, simulation, saves and world state. k116 also occurs in seed516, so its original-city owner must receive full coverage verification as well as the gallery; repeated city views do not add to the model count.

## Baseline feasibility, before implementation
A bounded diagnostic used the unchanged D076 complete-surface classifier, all fixed sample records, the original owner framing and exactly24 predetermined legal views (eight yaw angles ×14.4/30/57.6 degrees). Each selected slot passed all three widths plus four missing/reversed wall/roof controls: k164v0/1/2=712/652/699 mandatory samples; k119v0/1/2=927/827/848; k116v0=689 in both gallery and seed516; k149v4=829; k81v0/1=723/719. A joint selected-slot copied-scene consistency check remains required before production work. These are feasibility results, not candidate acceptance.

Rejected alternatives remain recorded: k175v0 811/833, k116v1 735/748, k116v2 797/817, k176v0 626/628; no additional camera search or dropped samples was used to make them pass. D075's earlier failure records remain unchanged.

## Frozen acceptance
Independently capture baseline fixtures from the exact published commit in an isolated Git archive. Preserve all80 earlier wave models, every non-target binary geometry case, ordered tree transforms, source inventory, city/world signatures, budgets and all historical fixtures. Require90 distinct normalized models after removing translation, rotation, independent scale, colors and triangle ordering. Weighted costs must not exceed the individual published caps above; do not hide building shells in non-shadow decoration arenas to meet costs.

Every intended roof and enclosed wall must be complete and correctly wound, with independent missing/reversed face controls. Retain every complete fixed exterior sample and original silhouette-hit record. Require100% of mandatory samples in BOTH baseline and candidate at1440/360/412, using the same declared legal views. Geometric closed-solid/contact witnesses must be retained and negatively tested, never inferred from camera-search failure. Original standard city views stay unchanged. Every target close-up must fit its full owner vertices; supplementary views may use recorded legal fit zoom without removing neighbors. Verify both gallery and the actual seed516 k116 owner, not only synthetic isolated models.

Real WebGL before/after of original gallery/seed516/ai120, supported render-only copies, complete supplementary views, stable paused repeats, independent raw Three.js ray parity, exact frame budgets, complete pixel/manifest provenance and all existing functional/performance gates are mandatory. Preserve the exact published native-touch repair. Keep the PR27 parallel Node/build/browser/screenshots layout and fail-closed aggregate, all old jobs and thresholds. Add D077 three-width verification and Pages dependency; historical D076 captures must explicitly isolate the published D076 phase rather than accidentally rendering D077.

Show actual inspection images promptly and run focused guards/full CI independently where possible. Inspection images cannot replace complete final coverage. After focused guards and independent review, submit a draft; merge only after every exact-head required check and delegated visual review. Verify main CI, Pages and exact public HTML bytes before starting wave10. Record failures truthfully; no claims of physical-device manual testing from runner screenshots.

## Not completed
Production implementation, candidate guards, complete real screenshots, formal CI, merge and release are not complete at card creation. No building in this card is counted as published yet.
