# D058 preview test readiness review

Reviewed: 2026-10-12, 04:10 UTC

## Conclusion

No remaining blocking defect was found in the reviewed test and workflow changes. All five findings from the initial review have been addressed. The candidate is ready to attempt the planned browser/CI verification; this review is **not** evidence that those runs have passed or that the new artwork has been visually accepted.

## Scope and method

Reviewed these four files and the existing helpers they call:

- `tools/d058-capture.mjs`
- `tools/d058-compare.mjs`
- `.github/workflows/d058-preview.yml`
- Changes to `tools/smoke.mjs`

The review was read-only with respect to the repository. No browser, network access, push, or deployment was performed. The only new file written by this review is this report. Renderer source hashes still being refreshed during development were not treated as product defects.

## Resolved findings

1. **Baseline source ownership.** The before report now identifies the pinned baseline commit `6f30f83faf4c4f4b02d1e3416d968a133f7da0b9`; the after report identifies the candidate workflow SHA or explicitly says it is a local uncommitted candidate. The workflow builds the pinned checkout into `scratch/d058-before/index.html` and the candidate into `dist/index.html`. Capture serves the corresponding root and writes separate before/after output directories.

2. **Trusted native input evidence.** Mouse and touch actions use the existing CDP input helpers, rather than invoking the game edit action directly. Before reload, capture now reads and saves the event probe, checks that all recorded input is trusted, requires multiple pointer-down/up events, checks the appropriate mouse/touch type, and requires a cancellation event for mobile cases. The Node model alone uses `commitOp` and `undoOp` as its independent expected-state calculation.

3. **Camera settling.** A fixed 280-frame delay could leave camera movement above the comparator's `1e-7` tolerance. Capture now samples every 25 frames and requires two successive position changes below `1e-9`, with a bounded failure if settling is not achieved. A Node-only check using the installed OrbitControls implementation passed repeated 0°, 90°, 180°, and 270° turns. They settled in 80–580 frames; the maximum additional position drift over another 100 updates was approximately `7.4e-11`.

4. **Full inherited regression coverage.** The preview workflow now includes a separate 90-minute `complete-regression` job running full typecheck, unit, build, and aggregate browser smoke. Its logs and current-art capture artifacts are uploaded separately. The preview job retains the before/after screenshots and additional selected current-art native and long-play checks. Existing smoke assertions, budgets, and goldens were not removed or loosened: their browser sessions explicitly select historical street rendering, and the aggregate then runs the current-art D058 capture.

5. **Actual artifact verification.** The comparison now reads each PNG from its phase's directory and checks its actual SHA-256, length, PNG signature, and dimensions. It checks the report phases, baseline source identity, differing build HTML hashes, per-case shot counts, and exactly 54 before/after pairs. Same-fixture, same-world, and same-camera comparisons remain in place.

## Other checks retained

- Six cases cover two authored scenes at desktop and two portrait mobile viewport sizes.
- Production decode/restyle paths and expected facade recipe/parcel properties are checked.
- Camera-only captures must preserve save/history/building observations.
- Cached versus fresh scene comparisons cover owner-grouped geometry attributes and triangle counts, ground, instances, queries, and scene counts.
- Native road removal/undo repeats, interrupted mobile input, picking, save/reload, and one simulated day are checked against the existing Node-model comparator.
- That comparator checks money, day, selected map layers, history, saved pipes, and resource depletion. It should not be described as an exhaustive dump or comparison of every hidden simulator or RNG field.
- Browser errors and external requests must be absent.
- JavaScript syntax checks passed for both D058 scripts and the aggregate smoke script.

## Still unverified

No actual screenshots were produced or inspected in this review. Browser execution, WebGL rendering, the real mouse/touch flows, complete CI runtime, and successful artifact production still require the authorized external run. Mobile browser emulation is not Android hardware evidence. Different screenshot hashes establish a difference, not better visual quality; the resulting images still need human visual review before accepting the artwork.

## Reviewed file fingerprints

These SHA-256 values identify the exact versions reviewed:

- `tools/d058-capture.mjs`: `4fc9c239c49bb8af00f975b23743226badefee19b9c15f99861cd14819590d9d`
- `tools/d058-compare.mjs`: `6bf33ed40a1c48cf2f127553b2726d5b0d9202167010dbda0a2626e095de693b`
- `.github/workflows/d058-preview.yml`: `8b4a6f7215992e720e6f46c70ed443874bef368ab343f4d2224562aa4f90c4cf`
- `tools/smoke.mjs`: `a76445a4766df5c4c26126eee47898d5a0320c28a1da67e74433f61aef98f2f8`
