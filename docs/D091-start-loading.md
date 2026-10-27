# D091 — Responsive welcome and truthful startup feedback

Frozen before implementation, 2026-10-27 03:38 UTC. Owner request Sentinel_c5f8ec585e2081919e58dde5d83d8fb7: polish the existing 3D start menu and add smooth, device-adapted long-loading animation. Base main be875201f9992ede9301df423ee57f9bcd9aa383 freshly fetched; no open PR and no concurrent writer. Product remains the released 200-building web game, not a Rust port.

## Scope and design
The existing root boots directly into the city, not a dedicated start screen. Add an original code-only welcome shell with a clear enter action, concise touch/desktop instructions, warm brass accents and dark British-town silhouette. Desktop has a spacious composition; 412/390/360px phones have single-column safe-area-aware controls. Existing parameterized scene/history links remain direct entries. Never change save selection/overwrite confirmation, simulation, 200 models, camera, renderer, physics, storage format or game controls.

A static shell is present before application initialization. Boot stages describe actual work: journal read, city construction, first rendered frame. Unknown duration uses an indeterminate indicator, never invented percentage. Yield to paint before synchronous heavy work; compositor-friendly transform/opacity animation and reduced-motion presentation. This does not promise that an arbitrary synchronous renderer task cannot stall a browser; no global async/performance rewrite.

## Frozen acceptance
1. Root welcome has a single actionable entry and optional readable instructions, keyboard focus/Enter, at least 44px touch targets, no overflow at 1440/412/390/360 or short landscape, mobile safe areas and reduced motion.
2. No simulation starts before the root entry action. Repeat clicks cannot start two cities. Direct scene/history parameters retain their semantics and still show real loading feedback.
3. Initial loading surface exists without JavaScript; working stages update only at real boundaries. No estimated percentage, artificial completion timer, manufactured performance claims, new dependency or external asset.
4. Loading blocks pointer and keyboard fallthrough. Hide only after initialization and a paint opportunity; normal input is restored. Failure stays visible with a reload/retry action that does not delete saves. Journal fallback preserves existing behavior and is disclosed rather than called success.
5. Preserve all existing model/core bytes and original historical tests/thresholds. Add focused state/source guards plus real browser tests for root entry, repeat click, direct link, failure/retry, reduced motion and viewport originals. Any shared browser harness adaptation must activate the actual visible entry button through real pointer input, not hide overlays or synthetic click bypass.
6. Run typecheck/build, applicable complete existing Node/browser CI plus exact-head new evidence. Keep first failures. Raw PNGs must come from rendered candidate; no generated illustrations as evidence.
7. Draft candidate only. Owner image acceptance, legal merge and publication are separate; no main write or deployment authorized here.

## Not done at freeze
No implementation, tests or preview acceptance. Local browser sandbox limitation remains known; use authorized official CI if local browser remains unavailable. Existing synchronous city build duration remains a limitation to measure and disclose.
