# D078 camera-detail correction — supplemental pre-code card

Prepared 2026-10-19 03:04 UTC, before correction implementation. This supplements only the camera-dependent uDetail assumption in the original D078 card, whose SHA256 remains d36e6ada9abfff8ae28afedf2b769598327f16d6a3648dca3ca5b0939ee2b11c. Do not overwrite that card, the baseline evidence, or the first failed capture artifacts.

## Observed conflict and immutable source

Formal CI run39192015801 at commit dd218d1be0dff3f1ed00cc3e25280ae71d4711b2 failed all three D078 capture widths at the first closeup: actual uDetail1, expected0. The preceding original overviews succeeded. The failed closeup camera was not persisted; retained overview cameras and original error objects are in the first-red manifests. This is a test-contract defect, not a production-renderer change. A new Node ConState starts at0, but every published draw recomputes the uniform from camera zoom. Waiting or rearranging capture calls cannot retain0 at the same rendered closeup. Forcing0 or capturing stale pixels is prohibited.

Immutable published source: commit22da5314145f96aaa83cfb739c382b86e1d5b0f3. SHA256:

- src/cityView.ts: 0f44e02bd1acf1c2754487b94d6f434b118818713f1ba068f3c8158de3b2db4f
- src/content/construction.ts: 985b81b9e8c1042b82398256f3ddb16d3301e4139c07853ccb7823e1926c6217
- src/render/construction.ts: c8b9b3515c6781d41f414c7dcc4c41e0566e1878508bf86bd7695d43d7a6d8a7

The original resize, view, labZoom/updateDetail/draw sections are byte-identical to current production. Section SHA256: resize 29cb1df871ca754936a7344753c9d85741a8723ee0a0580813fbea38668d9138; view fbf6ba463b12c93d0e81299741de4baa1eb15e7599f6bd95da721ee4eca447c5; detail/draw f24ddc8a07b8ccff85fe54b4843f1e99facda2aa604f446eb79c8a5179448a72.

## Corrected exact rule

Use the independently declared original camera and viewport, not an unconstrained observed camera, to derive the expected detail value. Production orthographic half-span is n*0.42; labZoom is sqrt(2)*viewportHeight*cameraZoom/(halfSpan-(-halfSpan))/64. The production gate is labZoom>=0.9. Above that gate, detailAlpha is0.58 below1,0.78 below1.3, and1 at or above1.3; below0.9 it is0. The underlying detailAlpha breakpoint0.75 remains tested even though the weather gate suppresses it.

All510 already-declared phase/view/viewport cases derive independently before code:72 overview frames require0 and438 owner frames require1. No camera, angle, zoom, viewpoint count or original-view requirement changes. At360x740 the first gallery closeup has zoom8 and labZoom2.1629423697009145, therefore detail1. Full fixed-view inventory SHA256: 7c42ca8d26eb5fd3b757ba5599442ebfbbc30d7e13d78d6cc49bd8588bfefbc9. Read-only source/first-failure/boundary evidence: scratch/d078/detail-correction/precode-proof.json.

## Acceptance before implementation

1. Keep the original card, historical Node uniform0 records and all first failures unchanged. Pin this supplemental card separately in guards and capture provenance.
2. Add an independent exact camera-to-detail oracle. Separately require the observed target and zoom to equal the original planned camera, the position to satisfy the existing less-than1e-9 camera-arithmetic tolerance, and the actual viewport to equal the declared viewport. No new or enlarged tolerance. Derive expected detail from the planned camera, never from an unchecked observed camera.
3. Check exact observed labZoom and detail against that independent rule on every frame, including repeats, before screenshots. Read-only diagnostics only; no setter, scene mutation, altered capture camera, clipping bypass or timing workaround.
4. Preserve uDayFrac0, uTime2.2, uProbe[-1,-1], uNoClip0, every original construction tile/age, every ordered live tree-age/transform buffer and both unchanged color/depth clipping and tree-growth sources. uDetail controls wall weathering; it does not alter the construction clip or tree-growth formula.
5. Test all510 fixed views and both phases, all exact threshold values and adjacent representable values, wrong LOD, wrong labZoom, changed camera position/target/zoom and wrong viewport. Wrong fixed uniforms, changed tree ages/transforms and age/clipping bypass controls remain mandatory.
6. Preserve full raw parity, classifier, mandatory point inventories, roof/wall negatives, frame/culling pins, all source geometry, original capture plan, pixel hashes and strict paused repeats. No sample or scope waiver.
7. Run bounded affected guards and independent diff review locally, without repeating the unaffected97-minute suite. Corrected exact-head full CI and all three actual WebGL captures must run again. Earlier success is not relabelled as corrected-head success.

## Not completed

At creation, immutable-source diagnosis, all510-view derivation and first-failure retention are complete. Correction code, its bounded validation, corrected-head CI and WebGL captures are pending.

## Additive target-settlement clarification — 2026-10-19 03:09 UTC

Independent review found that the first correction draft incorrectly compared the observed target directly to the ideal requested target. Preserve the initial supplemental card (SHA256 dc406580f505e2c09f52459de27646c0b43161e679b574d662895696e85be5ed) and its syntax-checked, untested tool patch in scratch/d078/detail-correction/first-attempt/. This clarification is recorded before the next patch. It does not change the original D078 card or any original camera/geometry contract.

Keep the ideal requested-camera rows and SHA2567c42ca8d26eb5fd3b757ba5599442ebfbbc30d7e13d78d6cc49bd8588bfefbc9 exactly unchanged. Add a separate exact settled-target pin from the original production OrbitControls target clamp around cursor[0,0,0], minTargetRadius0 and maxTargetRadiusInfinity. All seven unique targets reach a fixed point in at most two updates; independently verify with the real locked OrbitControls implementation and1,000 updates. Compare the observed target exactly to this independently settled pin. Zoom equality remains exact and position retains the existing less-than1e-9 arithmetic check. There is no relaxed target tolerance.

The lockfile is byte-identical to published22da: SHA2565ab53afaf88bd98bc323682d6e5e1240f046311cf1b461d83a2935eab90a1130, Three.js0.186.1, package integritysha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==. Installed locked source SHA256: OrbitControls.js 3d79d07ecb686b4e5d93232eedab255331c1beef711e13164eaa1f68655a5f2b; Vector3.js 9fa712118252ac8bbccededa1211d3ccf190c4e74c056b73557f76b66f53cf45.

- Requested [36,0,36] → exact settled [35.99999999999999,0,35.99999999999999]
- Requested [1.5,0,13.5] → exact settled [1.5,0,13.5]
- Requested [3.5,0,13.5] → exact settled [3.5,0,13.500000000000002]
- Requested [66.5,0,20.5] → exact settled [66.5,0,20.5]
- Requested [21.5,0,37.5] → exact settled [21.5,0,37.5]
- Requested [28.5,0,27.5] → exact settled [28.500000000000004,0,27.5]
- Requested [20.5,0,25.5] → exact settled [20.5,0,25.5]

All nine retained real overview camera targets match the exact[36,0,36] settlement. The failed closeup camera itself was not retained; do not claim its observed-target verification. Preserve its actual detail mismatch. Evidence: scratch/d078/detail-correction/target-settlement-proof.json, SHA256ba46c01f64716c5e23635928934c6108e39031d5113cbbf44f4c1d78ebd6a340.

Add guards for all seven exact target settlements, the nine retained real-camera witnesses, wrong target/zoom/position/viewport, and wrong LOD. Do not change cameraFor(), any ray/sample contract, the510-view inventory or capture sequencing. The corrected focused suite will contain35 groups because one camera-detail guard is added to the original34. Full corrected-head execution remains pending.
