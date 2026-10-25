# D086 additive scene/frame/performance qualification

## Frozen interpretation

- Existing `gallery`, `seed516`, and `ai120` are rendered from immutable `77b8616382f6115711b2b8eb39735a769b859cde` and current source using actual production modules. Full scene digests, typed per-owner geometry, mesh submissions and paired cameras must remain exact. No old-scene budget grows.
- New selectable slots have no previously accepted same-slot art. Their authored scenes compare the **same native city** with the new shape flag disabled/enabled. This is explicitly a counterfactual old renderer, not a fabricated accepted building baseline. Every extra weighted triangle must equal the independently emitted owner-cost ledger, within the original pre-code 1800/1200 caps.
- Keep three building batches. Preserve existing core18/all20 draw-call ceilings (`tools/d069-capture.mjs`) and completed C-mode authored-city118,884 ceiling (`tools/smoke-d038.mjs`). Never fit a cap to observations.
- Node rebuild wall times are observations only. They do not establish the browser CPU6 ceiling, physical Android performance, or GPU timing.

## Proven Node files / wiring

After the existing immutable baseline worktree setup:

```sh
node --test proposals/d086/scene-budget.test.mjs
node proposals/d086/scene-budget-check.mjs --label=ci
```

Inputs: `scene-budget-support.mjs`, `scene-budget-check.mjs`, `scene-budget.test.mjs`, `native-scene-fixture.mjs`. Upload `scratch/d086-scene-budget/`. Labels refuse overwrite. The shared fixture builds all variants with actual `commitOp`, then actual `stepDay`; no preview adapter.

Local proof: `scratch/d086-scene-budget/attempt-3.json`, 330 camera-width cases,8 integrated negative controls; pure suite22/22. Existing whole budgets: gallery60,204; seed516112,758; ai12095,505. Native ten10,742; forty26,678; three building batches and seven ordinary frame calls. Attempt1 (test mistakenly read absent `CityBuilding.y0`) remains preserved; bounds now use the actual terrain floor.

## Ready browser join (CI only; not yet actual evidence)

`browser-frame-qualification.mjs` never launches Chrome. It consumes the completed native capture manifest, all original/repeated raw PNGs, and the actual browser's `actual-ui-day9.code.txt`:

```sh
node --test proposals/d086/browser-frame-qualification.test.mjs
node proposals/d086/browser-frame-qualification.mjs \
  --manifest=scratch/d086-native-evidence/browser-1440-attempt-1/manifest.json
```

Run after successful native capture at each1440/412/360 width; upload its `frame-qualification.json`. Checks exact source head/bytes,25 required shot identities, ten native pointer placements/raycast owners, all raw/repeat hashes/dimensions, save replay, all20-call/118,884 ceilings, and22 completed shots against an independent actual-production scene/frustum oracle. Completed owner geometry/digest includes all six old controls. The three catalogue/incomplete-construction shots have ceiling checks only here; their live construction surfaces remain separately qualified. An exact mismatch must stay red, not be converted to a looser budget assertion.

## Ready existing-page CPU hook (CI only)

`browser-performance.mjs` exports `collectD086RebuildPerformance(page,{record})`. Call after native day9/save-reload evidence while the same real CDP page remains open. It does not launch a browser. `record` should immediately retain each partial result in the existing manifest; errors must propagate.

```js
manifest.rebuildPerformance = await collectD086RebuildPerformance(page, {
  record: r => { manifest.rebuildPerformance = r; write(); }
});
```

It repeats the existing D010/D012/D015 test policy exactly: CPU throttling6, three `__gt.simRebuild(true)` measurements, median≤400ms, no retries/discarded first sample, restored CPU1 in `finally`, and save/history/building list unchanged. Source: `tools/smoke-d011.mjs:532–538`. Pure mock tests cover failure restoration without any Chrome activity. Current all-pure suite48/48; this is **not** a CPU performance pass until run in real CI Chrome.

Native placement-specific latency and hover-preview CPU6 checks can use unchanged `__gt.timing().commit` / `.preview` instrumentation and actual pointer events: original median3 commit≤400ms and **every** recalculated preview≤16ms (`tools/smoke-d011.mjs:334–354`, `tools/smoke-d054.mjs:57–59`). No prospective relaxation or synthetic event-to-render timing replacement is proposed.

## Still required

Actual three-width Chrome success and frame join, actual CPU6 measurements, full surface classifier/probes, visual acceptance, complete existing CI, and exact Pages/public bytes. No new buildings are counted accepted/published by these Node receipts alone.
