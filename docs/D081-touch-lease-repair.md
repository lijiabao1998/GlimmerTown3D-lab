# D081 commission touch lease repair: frozen acceptance before implementation

User approved the specific presentation contract on 2026-10-20: retain touched commission positions, refresh values and availability, reject unavailable offers, reconcile after click or close, and add regression verification. This card freezes acceptance before implementation. Approval is not evidence of test success or authorization to merge/deploy.

## Production boundaries

- `src/ui/panelPress.ts`: preserve default generic gate behavior. Add an explicit commission-only lease observer/API, not an unconditional longer timeout. Track pointer IDs, target nodes and held/released/cancelled states independently of Touch identifiers. Keep the existing complete freeze while any relevant press is held. At a no-click recovery task, release the generic render lock but retain unresolved activation leases for renderer geometry protection. Exact-target/pointer resolution follows original native action, in bubble phase. Unrelated click must not clear another target's lease. Cancel/close clears stale work; new pointerdown alone is not a safe fence for an old delayed click.
- `src/cityView.ts`: split commission model-to-view description from structural application only as necessary. Original `uiCommission`, `acceptCommission`, current-ID lookup, save/history, simulation and HUD behavior remain unchanged. Normal/no-touch rendering keeps original ordering/removal. With unresolved leases, publish current values/availability, but keep leased offer rows and buttons in their established slots, showing obsolete ones as unavailable. Do not set native `disabled` on the protected button if its historical rejection click still needs delivery; preserve handler rejection and consider `aria-disabled` with explicit visible status. An `aria-disabled` attribute does not itself enforce rejection, so the real current-ID handler remains the authority.
- `index.html` or one dedicated commission presentation helper: geometry-neutral layout is a necessary production part, not a test workaround. Fix the card/header/body geometry before or atomically at lease creation without moving its current rectangle. Rows preceding a leased target must not grow/shrink/reorder. Additions must not shift preceding slots or center the whole card. Preserve scroll positions and disable anchoring changes where necessary. No transparent interception overlay or transformed copy of a button.

The last bullet needs measured browser proof. Merely appending new rows to the current auto-height centered card fails: the whole card can move upward. Updating `.sub` can also wrap and shift the body. These are mandatory negative controls.

## Bounded slot design to verify

Preferred investigation: fixed card/body viewport and fixed geometry for established slots, append new offer IDs below existing slots, keep original order until all leases resolve. Availability updates in each existing slot, no stale prices/rewards or hidden acceptance changes. Current non-ridership offer universe is nine IDs (eleven definitions minus two excluded transit offers), so slots can be bounded by unique semantic IDs, not by number of presses. No slot may change its ID while leased. If a future definition changes the universe, fail the bound explicitly, not silently truncate.

Do not select slot height by convenient guess. Test long labels, Chinese fonts, 360/412/1440 widths, high zoom/font scaling and visible unavailable state. If fixed geometry requires inaccessible clipping or an impractically large panel, reject that design and report the concrete UI tradeoff. It is better to stop than to call concealed data “fresh.”

Multiple simultaneous offers can be leased. A second valid acceptance changes model state immediately but must not remove a first unresolved offer target; its eventual handler rejects against current active state. The safe presentation needs a fresh active-state summary while preserving those slots. This state deserves its own fixture.

## Regression-first controls

1. Existing source negative control: real renderer's seed1 reorders target after due task; seed5 removes it. Already reproducible with `renderer-boundary.mjs`.
2. Add candidate-vs-current geometry checks using actual renderer/browser, including parent/card bounds, target node/key/rectangle, focus and scroll. Do not assert only DOM identity.
3. Normal native click-first: exactly one current-ID acceptance, save and history event; ordinary layout resumes afterward.
4. Due-task-before-click: next-task day/money/rank/status are fresh, original button target remains fixed, then native delayed activation uses unchanged validation.
5. No-click sibling: same due-task prefix, no click, data continues refreshing across multiple days and controls remain usable. Explicitly assert approved retained ordering rather than silently accepting stale text.
6. Expired/disappeared/active-state cases: visibly unavailable, no wrong action/save; no slot reassignment.
7. Both release orderings; pointer/touch namespace mismatch; outside contacts; multiple released/held contacts on same and different buttons; partial/batched ends/cancels; mouse/pen/keyboard interleaving; lifecycle; explicit close/reopen; stale task.
8. Valid semantic mutations: early structural release, wrong-key slot reuse, stale-index handler, dropped safe-data refresh, native disable/removal, ancestor-height shift, scrolling/focus loss, unrelated click clearing all leases. Require mutations to compile before counting rejection.
9. Original D052/D074 source guards and historical behavioral assertions unchanged. Add an exact new repair manifest/adaptor only for legitimate historical diff scope, not to rewrite runtime behavior. Enumerate every inherited source guard touched by gate/city/style changes before publication.

## Current executed checks

- Actual-renderer two-seed diagnostic passed its assertions, proving the current structural vulnerability and correct handler rejection, not a repair.
- Unchanged D052 `--press`: 5/5 focused groups passed, including eight existing gate/wiring mutation rejections.
- No candidate, browser geometry test, full-suite candidate CI, or successful repair exists yet.

## Completion boundary

Approval permits implementation/prototyping, not a success claim. Must independently review the patch, run actual layout controls, and pass unchanged final-head release CI/capture requirements. Preserve formal run39358447973 first-red and its target-loss trace. Controlled native pair39374108481 and new deterministic diagnostics do not prove its exact cause. Merge and deployment remain separately gated.

## Implemented validation candidate (2026-10-20, not released)

Only `src/ui/panelPress.ts` and three call sites in `src/cityView.ts` change product behavior. The original offer generator and current-ID action handler remain literal source, including original mutation-test anchors. The geometry helper is nested in the gate; no CSS file, simulation, save, world/history or architecture/art source changes.

The implementation preserves whole-presentation freeze while a pointer is actually held, then refreshes data on the original next task. It keeps semantic offer slots beyond release; unavailable targets retain the original rejecting handler and receive visible/ARIA unavailable state. Geometry restoration waits for the generic press set to become empty, including mixed offer/non-offer touches. Explicit close/lifecycle invalidation restores immediately.

Resource policy: at 256 unresolved IDs, or if a pointer ID is reused while an older activation remains unresolved, retain an opaque conservative lease until explicit close/lifecycle invalidation. Do not guess which delayed event it represents. No time delay is used as proof. Semantic slots remain bounded by the catalogue; detached geometry records are pruned. This can require closing/reopening to reconcile after pathological input; current status continues updating.

Local focused gates, original D052/D074 behavior, typecheck/build and exact source-scope checks pass at recorded intermediate snapshots; final-head remote checks remain required. A full local historical run recorded original performance failures (day settlement6.53ms against5ms; large read1668ms against1500ms) under shared concurrent workload. These failures are retained and thresholds unchanged, not dismissed as a pass. The first attempted historical command selected the wrong runner and failed before tests; the corrected `node tools/unit.mjs --partition=historical` is recorded separately.

Browser evidence is deliberately split: representative real-layout stress, actual compiled app renderer with forced synthetic release/task/click schedule, and unchanged historical trusted-input smoke. No synthetic test is proof of native retargeting or the original first-red cause. Local Chromium cannot launch under the verified socket sandbox; the attempted escalation failed before execution at a read-only runtime mount. Remote CI must execute the browser tests before any success claim.

## Validation update and reviewed pointer-ID edge

Draft PR34 candidate `a5ec411a9b1e3aa9ffd5512d09fb0777c46f648b` passed remote diagnostic run [39398610047](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/39398610047): 84 representative real-layout cases and six compiled-app cases, including retained/expired offers at 360/412/1440 and mixed Close. These remain synthetic event-order tests, not proof of the original native failure's cause. Original full CI is separate.

Independent review then identified pointer-ID reuse beginning on a non-offer control or outside the panel: cancellation of that newer gesture could incorrectly settle an older unresolved offer. Two added actual-renderer regressions failed before the fix and pass after document-wide capture observes reuse regardless of target/pointer type. Fourteen focused groups now pass; the real-layout suite adds 24 reuse/cancel/freshness cases without changing its previous 84. The reviewed new product hash is `a481a138c3a47cd1820301db30678f63bf993b6e128399e17ef0b7263a7b088b` for `panelPress.ts`; new-head browser validation remains required.

The slow local historical run was stopped at D027 after the already recorded performance failures, because product edits would otherwise make the remaining run a mixed snapshot. It is incomplete, not a historical pass. The fixed-snapshot remote CI remains the complete validation path.

## First complete candidate CI and D051 boundary compatibility

Candidate `d8d87d4483280df4ac47f8ce53c784d313418555` passed the unchanged trusted-input browser job in [run39399759392](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/39399759392), including held-touch reorder acceptance, disappeared-offer rejection, cancellation/close, keyboard behavior and complete model trajectories. Both new browser suites also passed in that job. The independent diagnostic passed 108+6 cases; its 20 screenshots/source hashes were checked, including an appended offer scrolled fully into view and hit-tested, then original scroll/focus restored without save/history changes.

Full CI nevertheless failed: five D051 guards encountered `cmGate.presentation is not a function` because their explicitly non-touch/non-layout browser-boundary stub exposed only the old gate API. All other original Node assertions completed without failure. This first red is preserved; it is not an overall green run.

The one-line D051 harness correction adds identity `presentation` and no-op `refreshGeometry`, matching the real gate's unleased state. No product bytes, renderer source, assertions, mutation definitions, thresholds or registrations change. Local D051 reproduced the five failures before correction, then passed all eight guards and rejected all 21 valid behavioral mutations. A separate exact-diff guard enforces that this stub line is the only D051 change relative to PR33. This is harness compatibility maintenance, not a claim that every historical test file is byte-identical. New-head full CI remains required.
