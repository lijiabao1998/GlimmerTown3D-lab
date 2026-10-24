# D082 accepted-nine: localized 179v2 join proposal

Status: integrated into the isolated repair-branch product as an engineering candidate. It is not accepted artwork, a browser pass, CI success, a merge, or a release. Formal main/deployment status must be checked separately. The historical ten-model contract and original accepted-nine evidence are unchanged.

## Why this additional contract is necessary

The earlier closed-component repair remains within the original 182 weighted-triangle cap but leaves six required full-scene surface samples invisible. Joining the two wings reduces this to two entrance-back samples. A complete exact-material/UV union removes the hidden faces, but contains 102 triangles (204 weighted), over the unchanged cap. Coplanar and semantic-UV-preserving redundant-vertex analysis found no removable vertices in that exact union. Removing visible inward trim strips was investigated and rejected as an unchanged-art repair; those experiments are not product data.

The proposed repair retains both wings, entrance, roofs, original outer piers, window panels, sills, cornices and chimney. Six local join-edge contractions alter only the small roof/entrance intersection region. They reduce the full union to 90 triangles, 180 weighted, under the original cap of 182. No budget or historical acceptance threshold is changed.

## Immutable reconstruction and finite mapping

Input is reconstructed from Git commit 63a1b3919b0e1531f3d0e988cc575bdde5736002, emitter SHA-256 3c8be9834fb42d4105563a33db502d4b8e7afa4626ac0acf5e0cfce9121fbb97. It uses the independently specified tapered wall-to-eave envelopes, original roof dimensions/materials, and the approved foundation repair. The complete union is independently checked against analytic oriented exterior polygons before applying any join move.

The production proposal is specified by the finite mapping in tools/d082-remaining-geometry-join-contract.mjs, not by a heuristic mesh optimizer. The constructor verifies each source/target pair is an existing mesh edge, preserves source-triangle identity, drops only triangles made geometrically degenerate by those exact moves, and reprojects affected window UVs from their immutable original affine maps.

Exact normalized moves:

1. [0.46863471971066906, 0.34853526220614817, 0.7713652802893309] → [0.46863471971066906, 0.34853526220614817, 0.7696815350612819]; distance 0.0016837452280490384.
2. [0.46603947265777357, 0.4615211794991808, 0.7728200327638661] → [0.465, 0.46, 0.7727777777777778]; distance 0.0018428987923475462.
3. [0.465, 0.46, 0.7727777777777778] → [0.465, 0.46, 0.775]; distance 0.0022222222222222365.
4. [0.46863471971066906, 0.34853526220614817, 0.7696815350612819] → [0.46315449750138804, 0.3409106052193225, 0.7694697390338701]; distance 0.0093921822377482679.
5. [0.46557863501483676, 0.4422551928783405, 0.7722848664688428] → [0.465, 0.46, 0.775]; distance 0.017960649998185169.
6. [0.49268163615560645, 0.435, 0.7741847826086957] → [0.52, 0.42, 0.773695652173913]; distance 0.031169412116960126.

## Explicit changes, not an unchanged-art claim

The overall bounds remain x=[0.105,0.875], y=[0,1], z=[0.205,0.915]. A numerical 384-pixel binary silhouette check at 48 azimuth/elevation combinations found zero changed silhouette pixels. This is sampled geometry evidence only, not a proof for every camera and not a real Chromium screenshot.

80 of the 90 remaining triangles retain their positions. Ten are moved; twelve predecessor triangles collapse. The maximum local normal change is 4.574 degrees. Normalized enclosed volume changes from 0.2648462956694407 to 0.2648703339954333. Two tiny exposed join fragments disappear: a trim fragment of area 0.00026855737170130537 and a brick fragment of area 0.00021780452529046075. The major trim and brick/window panels remain, but these local material changes must be inspected in actual paired close-ups. Total absolute per-material-plane surface-area change is 0.007665705158540321.

Keeping old UV vertex values stretched three local window triangles by up to 16%; that candidate was not adopted. Reprojection from the immutable original affine maps reduces physical texel-density ratios on the three affected triangles to 0.9989388689315132, 0.9984093509743663 and 0.9994267518860411. Shared coplanar window edges show no UV discontinuity at the unchanged 1e-7 UV tolerance. This is not permission to broaden that tolerance or exempt other faces.

## Reproducible checks

Run from the repository root:

- node tools/d082-remaining-geometry-join-reconstruct.mjs
- D082_WINDOW_CANDIDATE=scratch/d082-remaining-geometry/exact-full-join-before-optimize.json node tools/d082-remaining-geometry-windows.mjs
- node tools/d082-remaining-geometry-join-contract.test.mjs
- node tools/d082-remaining-geometry-join-uv.mjs
- node tools/d082-remaining-geometry-join-intersections.mjs
- node tools/d082-remaining-geometry-silhouette-preview.mjs
- D082_PREVIEW_DATA=scratch/d082-remaining-geometry/uv-mapped-join-candidate.json D082_PREVIEW_NAME=uv-mapped-join D082_PREVIEW_WIDTHS=1440,412,360 node tools/d082-remaining-geometry-preview-plan.mjs

The preview reconstruction command uses immutable Git source and writes only scratch evidence. The product provenance command now deterministically rebuilds the same finite join and verifies exact product data bytes. Neither path requires files from the lost worktree, rewrites historical fixtures, or changes historical source pins. The finite join guard separately validates analytic predecessor exterior, independent direct vertex substitution, strict oriented manifold/ground boundaries, positive volume, and unchanged cap; 283 mutation controls pass. The full-union predecessor separately passes the immutable original-emitter UV oracle in 12 height/affine cases, 1,188 asymmetric samples and 2,772 negative controls. The independent Matrix3 UV oracle exercises the actual runtime emitter with the candidate in 12 height/affine cases, 936 asymmetric interior samples and 2,184 horizontal/vertical/permutation negative controls.

The final UV-mapped candidate passed the exact production capture planner at 1440, 412 and 360, both phases with zero remaining samples. Source and candidate hashes are retained in those reports. Planning is not pixel acceptance. The final UV-mapped product/head must be checked again after integration.

## Required gates before acceptance

- A current versioned geometry/UV contract must be mandatory, alongside all immutable archived historical tests. It must verify actual product bytes, not merely an offline candidate.
- The 179v2 current exterior must be checked against this exact finite mapping after independently proving its predecessor exterior; never simply skip the previous failing envelope assertion.
- True paired production Chromium PNGs at all three widths, including close-ups of the altered entrance/wing seam and neighboring variants, remain mandatory. No fake scene or Node mask is a substitute.
- Original negative controls, D081 isolation, D083 native operation, old-world/non-target geometry, full-scene performance caps, complete necessary CI, approved merge order and deployment verification still apply.

## Current mandatory adapters

The existing components guard checks all six actual repaired slots, including the joined 179v2 shell, without changing caps or topology rules. The current exterior guard checks 179v2 against an independent simultaneous finite vertex-map oracle; the predecessor remains subject to its analytic full-union exterior proof. All other slots keep their previous exact exterior comparisons.

The windows guard does not silently omit 179v2. Before checking the other five slots, it requires three successful subprocess phases: immutable predecessor versus the original procedural emitter, actual product versus the finite geometry contract, and actual runtime finite-join UV mapping versus the independent Matrix3 oracle. These subprocesses clear D082 override flags. The ordinary whole-product guard must run without an offline candidate flag. The old historical contracts remain mandatory in their archived source context.

The joined-shell self-intersection guard additionally checks all 3,160 triangle pairs and includes coplanar duplication and proper-crossing negative controls. The isolated chimney remains an explicit independent architectural attachment and is not silently fused or discarded.
