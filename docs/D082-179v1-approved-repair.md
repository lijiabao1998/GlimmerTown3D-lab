# D082 approved finite 179v1 repair

At 2026-10-22 13:44 UTC the user explicitly approved the [displayed 179v1 comparison](evidence/D082-179v1-proposal/preview/comparison-original-412.png), corresponding accepted-pin update and continued verification (message `Sentinel_10efac81d03c81918f43d14578aa40d8`, reply “允許”). This authorizes only that finite revision. It does not extend to the other eight models, merge, Ready or deployment.

## Result and preserved baseline

The product renderer and shader are byte-identical to reviewed source `90b80f4bc7e9a16d53fdc9127e9fe1e23f6c1694`. No new art changes were introduced during adoption. Three wall tops meet the existing roof edges; the chimney foundation extends from .71 to .64 with its top and footprint fixed. The joined exterior and procedural frame/timber treatment are the exact previewed implementation. Ground footprint, roof silhouette, height, 48W/40O triangle inventory, 176 weighted cost and original 182 ceiling are retained.

[The approval fixture](../fixtures/d082-179v1-approved-revision.json) binds the reviewed renderer/shader source hashes, previous and new default/36-affine pins, original fixture and old-coordinate evidence hashes. `PREVIOUS_ACCEPTED` retains the complete old prototype pins. Only current `179:1` is superseded:

| Pin | Preserved previous | Approved revision |
| --- | --- | --- |
| Default geometry | `1ad82e98714bd84ae41435298b0cf6ada16e93ea56153ffb046eb3d183aca049` | `e33779d6bf749fe114fcc9e8079e6978d4acfcc956745df9d91735002f3cc2df` |
| 36 affine cases | `b7a060fca867dd2866e65898b0840fe93aeb20a7011f4a54d0aeeb89191f2ab0` | `4d2bac3a4ab58469109380fc40881a1ea1246cea8df177e53fc543e07ddcc853` |

The [487-coordinate JSON](evidence/D082-179v1-proposal/487-coordinate-delta.json), CSV, old 1,011-point contract, original failing run and all previous research files remain unchanged. The reviewed seven-view old-coordinate audit misses 489 points. The stricter adopted collector requires coverage of all 524 original positions whose oriented surface survives, so only the explicitly reviewed 487 physical differences may remain. Retaining a probe ID does not assert the same oriented surface; this is the explicitly reviewed geometry revision. No old failure has been relabelled as a pass.

### Physical positions and sampling IDs are different counts

The complete [reparameterization ledger](evidence/D082-179v1-approved/probe-reparameterization.json) makes the distinction explicit: 900 of the old required IDs have a different numerical sampling point/normal after retessellation. Of these, 487 original positions leave their original oriented surface, while 413 are resampled on surfaces that remain. Another 111 tuples are identical. Thus **524 original physical coordinates remain mandatory**, independently of the current 1,044-point raw D081 mesh contract. The earlier shorthand “487 coordinate changes” describes physical oriented-surface loss and does not enumerate all changed sampling tuples.

`d082-179v1-retained.mjs` loads the full immutable old contract with all 1,011 required records, including the 487 superseded ones. It never changes required flags or removes records. Each actual view audits every old required record with unchanged D081 ray rules. A separate mandatory assertion permits exactly the reviewed 487 physical differences and requires every other original coordinate visible. Seven existing views cover 522/524; an additional legal 22.5-degree azimuth, 30-degree elevation pair covers the remaining two. Both PNGs must really be captured in the manifest. Analytical eight-view coverage is 1,044/1,044 current plus 524/524 retained; actual new-commit PNG verification is still required.

## Numerical acceptance remains strict

Changing pins alone would leave the previous per-component closed-solid plan inconsistent with the approved joined shell. `d082-179v1-envelope.mjs` therefore independently declares the exact approved wall frustums, unchanged roofs and extended chimney, then computes their closed union from numeric planes. It does not read emitted triangles, source metadata or classifier output to manufacture expected geometry.

Only `179:1` selects this approved plan. The original numerical solids and attachment bounds remain in place as historical constants; all other model contracts are unchanged. Actual oriented surface coverage must exactly match every approved union plane, with the existing `1e-10` area tolerance. Every missing/reversed triangle, duplicate face and translated shell still rejects. Every analytic component must be closed and outward oriented. The nine approved component intersections are pinned as exact volume equalities within `1e-12`, rather than increasing the old overlap ceilings. The emitted exterior additionally requires manifold opposing edge incidence, one exact .3832 ground loop and positive volume. Only original ground caps are virtual.

The four mandatory fixed probes of each of the 88 actual triangles remain required. The unchanged D081 classifier, raw Three parity, legal camera limits, paired PNG evidence and full coverage requirement are untouched. All 1,011 old required IDs remain required; 33 requirements are added. Every one of the 487 reviewed new coordinate/orientation records must exactly match its retained ledger. JSON's representation of signed zero is normalized only for the JSON normal comparison; accepted geometry byte pins continue to check the original floating-point bits.

## Verification before submission

- Typecheck and production build pass.
- 25 supplementary evidence/camera/corruption tests pass, with no skipped tests.
- The additional real-geometry retained-coordinate test brings the suite to 26 passing tests. Removing the extra old-coordinate-only view leaves the new 1,044-point contract green but correctly fails the retained-coordinate guard. Dropping even one superseded historical record or hiding one retained point also fails.
- Full nine-model structural check passes: 324 affine cases, 130 prior models, 12 world/geometry/frame pairs, three rejected slots unchanged, and nine distinct models.
- Independent 179v1 proof passes all 36 transformed numerical envelopes, exact default/affine approved pins, 177 manifold negative controls, 179 oriented-surface controls and 80 analytic component/join controls. The other eight models and their 288 affine cases remain byte-identical to `67440cc8`; all 130 previous model geometries are unchanged.
- Existing real proposal PNGs were re-audited at 1440/412/360: each has 1,044/1,044 required current exterior points covered, zero dropped old required IDs, all 352 fixed probes required, and all 487 approved coordinates/orientations verified. Width-412 original/front AFTER PNGs are byte-identical to the reviewed images. These are existing source-90b80f4 artifacts, explicitly not new-commit CI evidence.
  Those original seven-view artifacts cover only 522 of the 524 surviving old positions. They cannot pass the new mandatory retained-coordinate guard; the added view must have genuine paired PNG evidence.

Local reports are retained in [the approved evidence folder](evidence/D082-179v1-approved/). The original proposal's early 216-weight/120-with-ground-triangle file remains explicitly historical; final geometry is 176 weighted, 88 rendered triangles and 12 virtual ground triangles for closure.

## Required remote verification and remaining red results

The original nine-model workflow still captures all original views and actual paired supplements. It retains the mandatory all-nine coverage job, and additionally checks approved 179v1 against those same actual PNG artifacts. Both its original structural gate and independent physical proof remain mandatory. The focused current-pin pass cannot conceal failures in the other eight models.

After the implementation commit, run the existing complete CI once against that exact original-branch head, in addition to the automatic nine-model workflow. Record terminal states, full job failures and actual new-commit image artifacts separately from local or old-preview passes. The complete CI has known unreconciled historical source/frame/old-ten-model qualifications; those gates remain unchanged. The eight unmodified D082 models retain their existing coverage defects and are not claimed repaired or newly approved here. No merge or deployment is performed.
