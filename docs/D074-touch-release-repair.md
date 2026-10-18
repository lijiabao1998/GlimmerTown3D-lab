# D074 release repair — stable native commission activation

Pre-code repair card, 2026-10-18 00:28 UTC. This is a release repair for wave7, not another ten-building wave.

## Observed failure
Main release39075552114 of beca506c224ad72f9a890ed20b5aa1fa7b2616f5 failed the historical D052 commission-reorder held-touch assertion. The saved Chrome155 trace has trusted pointerdown/capture/pointerup/lostcapture on happy70 followed by a trusted click without a commission key. The expected action was absent. The prior PR used the same source tree and passed. This is evidence of lost click target, not proof of exact timer ordering. Pages was skipped; the previous published D073 bytes remain live.

## Scope and acceptance before implementation
Diagnose the original event/render ordering and reproduce a deterministic adversarial ordering before changing production. The existing zero-delay released-pointer fallback is a hypothesis to test, not an established cause. Preserve the failed artifact and all original assertions.

A repair may only change the non-simulation panel presentation gate and directly associated evidence/guards. No simulation, saves, commission rules, gameplay, D074 artwork, tree positions or geometry budgets may change. Do not extend sleeps, retry gestures or weaken assertions to pass. Keep one native action, fresh offer validation, no activation of disappeared or cancelled offers, exact stable focus/scroll/rectangle through activation, and release recovery without a permanently frozen panel. Test mouse, keyboard and multi-pointer/cancel/close paths as applicable.

Add a negative control that reproduces the original failure ordering and rejects the old implementation. Preserve every immutable art/source baseline with an explicit narrowly pinned repair layer; do not refresh old fixture values to conceal changes. Real Chrome trusted-input verification plus all historical CI/performance and screenshot gates remain required. Separate repair PR, explicit visual/evidence review, main release and exact live-byte verification precede counting wave7 or beginning wave8.

## Not completed
Diagnosis, repair, focused tests, real browser evidence, full regression and publication are pending. No rerun has been used to override the failed release.

## Diagnostic observation, 2026-10-18 00:43 UTC
Independent diagnostic run39083647992 collected all twelve planned original-timing gestures on the exact release HTML SHA and Chrome155 revision. All twelve passed; their fallback timers were cleared after click without firing. This does not establish the cause of the original failure or replace the failed release gate. The observer added global touch listeners and synchronous layout reads, which can affect input scheduling.

The next predeclared collection is a 16-session observer-ablation/load matrix: timer instrumentation off/on, passive touch observers off/on, CPU slowdown 1/6, two fresh-session replicates per cell in forward/reverse order. Original pointer-only evidence, fixture, native action and 50/200ms waits remain. No per-event layout, hit-test, stack or model reads; no retry-until-green. Timer instrumentation records only timing and DOM row-key order. This is a stress/observer comparison, not a claimed forced native interleaving. Preserve every result, including failures and setup errors. Production remains unchanged pending evidence.

## Matrix observation and full-context diagnostic, 2026-10-18 00:55 UTC
Run39084260040 collected all sixteen matrix cells successfully, including observer-off and 6x CPU conditions. No failure or timer-before-click reorder was observed. The original failed release remains unresolved; these samples do not prove absence of a rare race.

Context limitation found during runner review: the independent twelve- and sixteen-session probes used the current-art browser path; the complete historical runner passes streetArt=legacy through its browser wrapper. An identical HTML SHA therefore did not imply an identical runtime art path. The full-context collection retains the original legacy wrapper unchanged.

One full-context collection now runs the original complete smoke sequence, preserving the preceding cases and all assertions. A narrowly checked runtime loader wraps only the D052 browser argument for pointer/timer tracing; original harness source bytes remain on disk. No touch listeners, geometry reads, synthetic activation, changed gesture sleeps, or CPU throttling are added. Preserve original smoke exit status, per-session diagnostic traces, and original artifacts. The job uses the existing 120-minute smoke budget and cannot deploy. A diagnostic pass alone does not authorize declaring the original failure repaired or publishing wave7.

## Diagnostic prerequisite failure, 2026-10-18 01:47 UTC
Run39085011594 exited1 before D052: D056 pristine D049/D050 PNG guards failed, and the diagnostic manifest contains zero D052 sessions. Exact original source and HTML pins passed. Comparing the saved PNGs to the original release shows missing CJK glyphs rendered as square boxes. The diagnostic workflow omitted the fonts-wqy-zenhei installation present in ci.yml before smoke; this preparation error invalidated the attempted context replication. Preserve artifact12121068426, SHA25670aca70ee4aaba60f3926cdf7c62c1eca813ff258f7ce48d86a81b04b5423d4d.

Restore the identical original font installation, record before/after font lists, package/version/font-file SHA, font resolution, Chrome/Node/OS versions, and require WenQuanYi resolution before another single full-context invocation. No product or golden changes. The earlier failure remains evidence; only a new corrected run can establish whether these pristine guards pass and whether D052 is reached.

## Bounded production repair acceptance, before implementation, 2026-10-18 02:40 UTC
The corrected diagnostic run39087831219 completed the full original smoke sequence in2888.8s, exit0. All twenty D052 sessions ran; the reorder case clicked happy70 before its fallback timer fired. Both pristine PNGs exactly match their original goldens after restoring fonts. This does not establish the original release failure's cause; the failed release remains unresolved evidence and must not be relabeled successful.

Implement a bounded presentation-gate hardening in src/ui/panelPress.ts only: independently observe the native touch cohort using passive listeners and document-wide touches. Never equate Touch.identifier with PointerEvent.pointerId. While an observed cohort still has contacts, a released touch-pointer timer cannot flush pending presentation. On cohort completion, the existing zero-delay no-click recovery applies. Preserve pointer-only, mouse and pen behavior, exact matching-click handling, per-pointer cancellation, lifecycle cleanup and newest-render semantics. Do not introduce arbitrary delay, synthetic activation, simulation/gameplay changes or art changes.

The applicable adversarial ordering is pointerup → due fallback task while native touch cohort remains active → touchend → native click. The captured original implementation must fail this new behavioral test; the candidate must pass without changing the original D052 positive assertions. This is not a guarantee for arbitrary click delay after touchend, nor proof that the original failed Chrome run followed this ordering. A standard-independent guarantee of arbitrary delayed click and unconditional next-task no-click refresh is not claimed.

Additional tests must cover deliberately different pointer/touch identifiers; same-button and different-button multitouch; an outside-panel contact; partial/batched ends and partial cancellation; both touchend/pointerup orders; mouse/pen interleaving; no-click recovery; new presses versus stale callbacks; close/reopen, blur, pagehide and visibility. Construct mutation sources outside behavioral assert.throws so missing mutation anchors cannot counterfeit a rejected mutant. All old runtime tests continue to consume the actual repaired source.

Introduce one explicit exact-SHA repair allowance for historical source reconstruction and the existing Git-diff allowlists. Keep all historical fixture bytes, source inventories, art budgets and negative controls. Independently review the change and its residual risk, run focused guards and full historical CI, and retain actual UI visual evidence. Separate repair PR. Report evidence and remaining risk before any publication decision; a diagnostic pass alone is insufficient.

## Candidate focused verification, 2026-10-18 02:51 UTC
Frozen panelPress.ts SHA256: 2e3011d22cb999a9a6d5366b229861ea6e73438259a369f82e66718a3eb4a422. The new behavioral suite passes 15/15 groups and 10 valid mutations; captured old source fails the predeclared adversarial ordering. Original D052 passes all 18 groups and 43 mutations, with positive assertions unchanged. Exact-byte scope reconstruction passes 6/6 groups, including historical D074-to-D056 negative controls. Typecheck, build and independent static review pass. The reviewer identified pointer-ID reuse classification; this was corrected and mutation-tested before the source freeze.

Full aggregate regression and native legacy/current-art browser verification remain pending. The original release cause remains unproven and arbitrary post-touchend click delay remains outside the guarantee. No release rerun or publication has occurred. Published progress remains 6/20 waves.
