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
