# D074 CI follow-up: parallel verification without weaker gates

## Authorization and scope (written before implementation)

Owner request, 2026-10-18: "優化一下", responding to the proposal to remove duplicate Lab push/PR runs and evaluate parallel 3D Node/browser/screenshots while preserving all tests and release thresholds.

This separate CI-only branch starts at main `94024b6e2195f4d545de1f1af770dfbe98c1777a`. It does not change application code, model art, dependencies, assertions, numerical thresholds, existing D055–D074 jobs, workflow triggers, concurrency, repository settings, or permissions. No merge or deployment is authorized by this card. D075 work is coordinated separately and must retain its future jobs and Pages dependency.

## Baseline measurement

- PR run [39091972662](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/39091972662): smoke execution 93m38s after 7m03s queue; Node 32m17s, browser approximately 55m, screenshots 5m49s.
- Main [39098621210](https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/39098621210): Node 1943.7s, browser 3263.5s. These historical timings are comparisons, not a promise of improvement.

## Acceptance criteria (fixed before implementation)

1. Keep every existing test command, immutable baseline fetch, assertion, threshold, runner image, Node version, and existing D-job/Pages gate.
2. Run the complete Node guard sequence independently from one build; run complete browser smoke and the unchanged screenshot command on separate runners using the identical build artifact.
3. Preserve PR merge-context checkout, main verification, manual-trigger behavior, and existing `smoke` check identity. No cancelled, skipped, failed, or absent subjob may make `smoke` green.
4. Use an immutable same-run build artifact with exact source SHA/tree and file hashes checked in each consumer. No cross-run, cross-branch, or latest-main artifact selection.
5. Keep the original `smoke-<sha>` evidence artifact, its file families, and 14-day retention; isolated browser/screenshot outputs cannot overwrite one another while running.
6. Upload the Pages artifact only after all split smoke stages succeed, and retain every original Pages `needs` entry. Missing evidence/artifact/identity must fail closed.
7. Add focused CI-helper tests including intentional wrong SHA/tree/run, changed/missing/extra build files, and every non-success gate result. Parse/check the workflow and run final full GitHub PR CI on the exact candidate.
8. Record measured final timings and any unrun or failed checks honestly. Do not merge until owner/parent review and repository permission requirements are satisfied.

## Design references

- [GitHub job dependency semantics](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs): an always-running aggregate must explicitly reject failed/skipped dependencies.
- [Official artifact download action](https://github.com/actions/download-artifact): default downloads are scoped to the current workflow run, and explicit artifact IDs avoid ambiguous selection.

## Rollback

Revert this CI-only PR. No data migration or application artifact changes are required.

## Implementation and verification log

- 2026-10-18: Card-first commit `17c9f2d603ede49621eb3137eb7cc428a6ecea69` published before implementation.
- Implemented independent complete Node guards, a single immutable build, browser smoke and screenshots on separate runners, and the original `smoke` check as a strict all-success aggregator. Browser and screenshot files are combined in the original order into `smoke-<sha>`.
- Every existing job from `d055` onward, including the complete Pages job, is byte-for-byte unchanged. Workflow triggers, concurrency and permissions are unchanged. Each original primary test/build command still runs exactly once; all ten immutable baseline fetches remain in the Node job.
- Cloud local checks: 48 CI-helper tests passed, including each non-success stage result and altered/missing/extra artifact data; Node syntax checks, YAML parsing, `git diff --check`, `npm run typecheck` and `npm run build` passed. CLI record/verify passed. Two builds produced identical HTML SHA-256 `4231fc6a34ab50791bec8adb137aab7a4a87ece4dff089ce91e264b00278de1e`.
- No application, assertion, baseline, package or art changes. No GitHub permissions or settings changed. No other writer workspace used.
- Not yet done at implementation commit: full candidate GitHub Node/browser/D-matrix CI, actual parallel timing comparison, and main/Pages verification. Exact-candidate run results will be recorded in the draft PR description. Main/Pages cannot be validated until an explicitly approved merge; this PR is not self-merged.
