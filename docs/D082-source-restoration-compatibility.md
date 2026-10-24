# D082 approved-source restoration compatibility

The old source adapter rejects the accepted nine-model tree and approved 179v1 repair before historical source guards can run: the original manifest has227 baseline paths and229 after paths; the actual approved product has231 paths. This change adds an explicit current-source lease and restores the exact227-source published tree for historical accounting. Runtime imports continue executing the actual product.

## Finite source allowance

The original `fixtures/d082-art-scope.json` and `fixtures/d082-source-before.json` are unchanged and SHA-pinned. Their227/229 phases remain explicit invariants. The new `fixtures/d082-source-restoration-v1.json` declares the exact231 current paths and four post-published additions. Relative to the old229 after manifest it permits only these five independently reviewed differences:

| Source | Fixed reviewed SHA256 | Independent Git source |
| --- | --- | --- |
|src/content/britishCoastalRecreation.ts|a8b659728272b4974cc1185d701ada00daf02eca7cc18298f63ab63bcda5020f|67440cc8de625f0482665c3f3f94efba73a1aed3|
|src/render/britishCoastalRecreationArt.ts|bc685bcd6df1467e53feeb9ce358f6d137aa2a64f29288658ff9f6fab27263bf|90b80f4bc7e9a16d53fdc9127e9fe1e23f6c1694|
|src/render/windows.ts|91a9d2b02154fc5f437252fc2e83709058a811977300c226cc4e7993fb973f00|90b80f4bc7e9a16d53fdc9127e9fe1e23f6c1694|
|src/render/d082Repair179v1.ts|b006936d523423bff074b169cbdf61e8eec9aa1fd481c983046902baa1b9dcc7|90b80f4bc7e9a16d53fdc9127e9fe1e23f6c1694|
|src/render/d082Repair179v1Data.ts|98b73814abd5b3541ada80e31a3e72700236eed7f5e91db27209db024e65d8c0|90b80f4bc7e9a16d53fdc9127e9fe1e23f6c1694|

The last two paths are the only new paths relative to229; the first two coastal sources were already post-published additions. The other226 old-after source hashes remain exact. Pins are literal reviewed values, never regenerated from the current emitter.

Every historical read first checks the actual supplied reader's current bytes against the exact current pin. Only then may it remove a verified addition, restore the original three dispatch regions or substitute the independently captured published windows bytes (SHA590499c829a9c19d329690acd660cd9be53422af2530aa5d042a3dd9aa2f10ee). Every one of the resulting227 source strings is compared with Git2cd43c424dcc909dcfa6ac55275406d2bc527ce0. No injected reader is discarded; missing-file exceptions propagate unchanged. No filesystem source fallback is used for an injected reader.

## Verification and preserved failures

`node tools/unit-d082-scope.mjs` passes with2858 negative controls, including every current source's mutation/missing/truncation, D082/D081/D074 scope chains, stale source readers, unknown/missing/duplicate inventory, invalid/broadened/repinned leases, and dropped/replaced reviewed Git fetches. The unchanged D081 touch-lease scope suite passes all8 checks. The immutable original seventeen-baseline CI test also passes unchanged.

The first unmodified source guard failure is retained at [first-red-original-229-inventory.log](evidence/D082-source-restoration/first-red-original-229-inventory.log). A preceding partial-clone cache miss was a Git dependency failure, not a contract failure; the exact published objects were fetched before recording the real red.

Local broad CI controls initially report257/261 success. Three failures are Windows-only execution constraints: symlink EPERM, a POSIX file-URL path in an existing CLI test, and unavailable bash for its existing tee test. They are not waived or rewritten. The fourth failure was caused by initially appending two reviewed candidate refs to the old fixed17 baseline list. That implementation was corrected: the old17 remain byte-for-byte, and the two D082 candidates use an explicit separate provenance step, like the existing separate PR33 touch-lease step. Six added negative controls fix both candidate SHA values and actual fetch commands. Existing CI assertions are unchanged; the original fixed17 test passes after this correction. Linux CI remains required for the three platform-dependent controls.

Both workflow definitions are structurally identical to their previous versions after removing the new source-only job and separate reviewed-source fetch step. Existing jobs, commands, needs, timeout limits and coverage checks are unchanged. The added source-only job independently fetches published/reviewed snapshots, executes all2858 controls and retains its report. It cannot replace the original runtime or image jobs.

## Previous exact-head full CI terminal result

[39795570522](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/39795570522), head ddd8de7eef7e351a2083cdac17821643ba1a77f7, is completed/failure:56success,7failure,2cancelled,1pages-skipped across66 jobs. Browser succeeded. The d072/d079 delayed job states resolved to success. No job was restarted.

The Node log records39 named NG lines: historical source-inventory/restoration and source-allowlist failures, plus the original ten-model topology and architecture-checkpoint assertions. The complete UTF-8 log and extracted failure ledger are retained alongside the terminal job list. Aggregate smoke fails `node did not succeed`. Other failures remain D081 selected-recipe isolation, D082 old gallery frame59802 versus60196 and old-pool genuine coverage, and all three frozen forced-scene photo qualifications. d060412 and d0711440 were cancelled in font setup before build/photo at their30/45-minute job limits; their apt root cause remains uncertain. Those unexecuted image checks are not passes.

## Scope still deliberately unresolved

No product src, accepted/previous pins, original227/229 manifests,900/487 evidence, probes, classifier, cameras, budget, other eight models or original historical assertions are modified. The old59802 frame and ten-slot runtime rules are unchanged. Current-nine actual coverage remains397/396/395 missing at1440/360/412 from the eight unrepaired models; the approved179v1 remains1044/1044 new plus524/524 retained coordinates in the prior completed exact-head image evidence. This source-only change does not claim new-head image success before that run executes.

The pure procedural source allowlists in `tools/unit-d066.mjs` through the applicable D081 guards also inspect raw Git diff paths. The expanded verified-addition set now identifies both repair modules, but existing `windows.ts` is not an addition and is still absent from their old allowlists. This separate protected difference is reported, not edited. A next finite proposal would add an exact reviewed-source predicate only for that already-approved existing file, require its unchanged published historical bytes through the injected reader chain, and preserve mutation/unknown-file rejection. It must be reviewed as a precise guard change. It must not mark windows as an added file, drop it from227 historical paths or permit arbitrary changes.

Ten-model runtime/current-nine qualification requires a separate explicit versioned design. It cannot be solved by replacing59802 with60196, changing10 to9, retiring old tests or relabelling archived results. No merge, Ready, deployment, PR35 edit, new schedule or other-repository action is included.
