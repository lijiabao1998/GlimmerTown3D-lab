# D079 validation evidence

Baseline:46771cdc00f33759e0a3c45ddf05c3387d4bb4fc. Initial pre-code card and numeric snapshot remain unchanged. Candidate evidence recorded before formal PR; incomplete gates are explicitly pending.

## First failures preserved and bounded corrections

The initial production candidate passed typecheck/build after replacing unsupported toReversed with an equivalent spread/reverse. Initial focused geometry was22/29:42 planar quad faces used the alternate diagonal instead of the independently prescribed exact partition. An independent reviewer verified116 complete planar face boundaries/areas and outward normals at three anisotropic scales: no physical missing surface was found. Production explicit per-plane diagonal arrays were corrected; no fixture import, runtime triangulator, architectural-coordinate change or contract rewrite was introduced. The unreferenced initial inspection commit52d5fc2297b376d796c90fcd77517b08bbfccae4 retains the original source; corrected inspection commit19323d56a047f00ff23af96c8d7f41f71f19ff44 contains the fix.

The repaired geometry suite passes29/29:1656 transformed cases,7872 non-target binary cases,100 prior models,110 full and110 W/O architectural identities,116 faces/241 architectural triangles/16 closed components,187824 roof/wall rays,1152 contact rays,348 face deletion/duplication/reversal controls and6 concave hull-fill controls. All64 historical fixtures remain exact. Guard SHA256:c502ddeb6f6f7d3434c2ab9f8547a5433eb74c1dacaaaacb8c2d9e423d225546. Source inventory SHA256:62df3e68121519dd159dbf567872a4894adce63ec73d818a916c5544dd230c3d.

Independent GPT review additionally compared all241 frozen triangles at three anisotropic scales,723 triangle/normal checks, and all100 prior binary models. Geometry and additive scheduling review passed; this does not substitute for frame, WebGL or exact-head CI acceptance.

The baseline-selected20 legal supplementary shots initially left51 candidate sample failures across three widths:29v1 nine per width and21v2 eight per width. Every original point and view was retained. Selecting two additional views from the unchanged predeclared24-angle pool resolved all19233 candidate points:29v1 yaw270/elevation14.4;21v2 yaw90/elevation57.6,zoom8. Full plan294 originals comprises150 standard,132 supplementary and12 repeats. These selections do not change the24-angle pool, geometry, neighbors, classifier or acceptance requirement. The complete full-frame run is pending; discovery success alone is not full acceptance.

The scheduling first-red omitted the new artifact from a helper requirement; negative controls caught it. The corrected146 fast tests pass. All22 untouched historical job blocks and top-level workflow settings match the published baseline byte-for-byte. Default full unit stays117 guard registrations plus inline checks; historical115 plus both independent one-guard frames is exhaustive and disjoint. All original time limits and assertions are retained.

## Actual inspection images

[Inspection run39221068104](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/39221068104), head19323d56a047f00ff23af96c8d7f41f71f19ff44, produces actual production WebGL at360 and1440. It has no deployment or merge permission. The360 artifact12171702458 ZIP SHA2568de8972f3533d66faa45507ab78a5fe2e86fe274a67777812beb93352f9098dd contains50 originals; all PNG CRCs, complete inflation, dimensions, bytes and hashes were independently checked against the manifest, along with223 source hashes and the inspection script. Build1426192bytes,SHA2567fcd1c82783521d1bf65a71e70c9be2c1e43e18263709b8d012945fcf85f7b3c.

Three360 originals show21v0,29v1 and37v2 at their original camera. Sampled supplementary aquarium view is occluded by an unchanged neighbor; it is not claimed as complete visual coverage. Full multi-angle guards remain mandatory. All sites are original age400, all slots saved/import only, recycling heights remain.17/.26/.26/.28. These are runner screenshots, not physical-phone tests.

## Remaining gates

Complete D079 frame, full D078 compatibility, all exact-head historical Node/browser/WebGL/performance checks, final visual review, formal PR, merge, main CI, Pages and public HTML byte equality remain pending at this record's creation. No eleventh batch is counted as published.
