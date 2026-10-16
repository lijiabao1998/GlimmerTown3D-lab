# D069 — British commerce alternate structures (wave 2/20)

Pre-code card written 2026-10-16 09:43 UTC. Baseline ee07f108448c5a1068c0c7b1c0ca6ed7d4cad883 is published; all 18 release jobs passed and live HTML is byte-identical to the reviewed D068 build.

## Scope and acceptance before implementation

Ten structurally distinct models for saved v1 of existing kinds. These are import-reachable production models, not new build-menu tools. Existing native foodPlant/tradepost tools create v0, which is preserved byte-for-byte. Gallery previews will use a labelled render-only copied-building view without mutating saved world state.

- k65:v1 Covered shopping arcade: Two unequal retail wings enclose an open-ended passage beneath a raised central glazed ridge.
- k86:v1 Interwar banking hall: A broad banking hall has a semicircular entrance apse and two low recessed side wings.
- k91:v1 Bonded trading exchange: A tall exchange hall stands between two narrow open loading aisles beneath independent lower pitched roofs.
- k98:v1 Terraced hillside hostel: Three connected accommodation sections step in plan and roofline around a deeply recessed shared entrance.
- k99:v1 Arts-and-Crafts wedding chapel: A broad low chapel has a transverse entry porch, asymmetric roof and separate short square bellcote.
- k57:v1 Milling and packing works: A square milling tower rises above a long packing hall and bridges to paired grain bins.
- k64:v1 Bonded courtyard warehouse: Four linked masonry storage wings surround an open loading courtyard with a cut-through entrance arch.
- k110:v1 Through-rail goods shed: A broad shallow arched goods hall spans a visible rail lane beside a raised loading terrace.
- k167:v1 Cross-dock distribution hub: A T-shaped hall has opposed loading arms and a slim raised dispatch office at their junction.
- k168:v1 High-bay refrigerated store: A tall insulated chamber joins a low transverse loading hall beneath a roof-level refrigeration gantry.

Acceptance: preserve simulation, saves, kind IDs, footprint/height tables, existing trees, all non-target model bytes and D068 v0 models. All ten must be unique after rotation/translation/scale/color normalization, also distinct from preceding models. Re-measure immediate D068 per-slot weighted triangle caps; no triangle or draw-call growth. Finite geometry, correct normals/winding, bounds, ownership/picking and determinism across sizes/heights/rotations. Separate immutable source-scope and approved art evidence registries; preserve every historical gate and threshold. Real WebGL desktop 1440 and mobile 360/412 previews plus frame oracle, browser errors/network and unchanged world/camera checks. Typecheck, build, complete Node and browser CI before merge. Send previews through parent; delegated GPT review under explicit user authority, never infer individual approval from silence. Merge then all main CI/Pages green plus exact live HTML check before wave 3.

## Not done yet

Models, captures, tests and release are pending. This card is not completion evidence.

## Candidate preflight (2026-10-16)
- Typecheck/build passed. Geometry guards 12/12: 1,872 geometry cases, 7,860 preserved-model byte comparisons and nine city/mode comparisons; all ten structures differ from each other and D068 after rotation/translation/scale/color normalization.
- New/immediate-old weighted triangles in catalogue order: 86/92, 214/284, 114/118, 80/80, 110/116, 250/346, 192/194, 76/76, 80/80, 80/80. Copied-v1 gallery 61,312 → 61,128 (−184); seed516 112,762 and ai120 95,571 unchanged. Original v0 gallery remains byte-identical.
- Independent frame oracle 11/11, all 78 planned views. Existing 18-component numerical-zero normal exception unchanged. D065/D066/D067/D068 focused regressions passed; no historical fixture or threshold altered.
- Complete Node and browser CI, actual screenshots, delegated visual review/delivery, merge, deployment and live HTML verification remain pending. These Node checks and planned frames are not screenshot evidence. Local browser is unavailable because its socket startup was denied; authorized GitHub workflow supplies real WebGL images.

## Release verified (2026-10-16 14:28 UTC)
Full local Node passed1597.7s; PR20 CI38893689665 all20 checks passed. All78 original PNGs and9 sheets verified at3 widths, two delegated GPT visual reviews accepted, desktop/mobile images delivered11:38:39UTC. No individual user response is claimed as image approval. PR20 merged as bece722ed2480a3728a274c90bd0170eb52cf389 after explicit owner confirmation. Main release38905296386 all21 jobs passed including Pages, artifact12051688754, exact pages_build_version. Downloaded live HTML matches reviewed candidate byte-for-byte:553de5ae65c89dc22dca01af444cabb372b1960c7e7e9efb3009a0b8dff16b73. Two of20 waves (20 models) released. Saved-v1/import reachability limitations remain unchanged.
