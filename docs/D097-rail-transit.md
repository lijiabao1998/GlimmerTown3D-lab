# D097 — Rail & Transit 1.0 (candidate, not accepted)

Pre-code freeze: 2026-10-30 22:07 UTC. Owner instruction: `Sentinel_65f451f7154c8191956a4cd924fb2112`, read in full (22:00:48 UTC). Fresh main is `6c28221859f337f72953a76ab3e24e50d76bca93`; isolated branch `gpt/d097-rail-transit`. Living City D092–D096 / Draft PR48 are paused and preserved, not renamed, closed, overwritten or included here. No merge or publication is authorized. The standing 200-building art acceptance and every historical golden assertion remain in force.

## Product and scope

One integrated, playable transport system in the existing town: surface rail, passenger and freight trains, bus feeders, light rail/trams and underground metro. Native construction, route/fleet/headway editing, real origin/destination demand and walking transfers, block conflict handling, capacity/dwell/loading, city economy and append-only history. It is not an independent demo, building-count project, fixed animation, passenger-only first release or Living City rename. Internal implementation checkpoints are allowed; only the complete acceptance below qualifies as Rail & Transit 1.0.

Transport infrastructure is a separate extension namespace, not new or renumbered Lab building IDs. Existing approved models and all imported layer meanings remain unchanged. British track, station, depot and rolling-stock art is original code geometry in the existing approved pixel3D style. Global style, owner image review, merge and official release retain their approval gates.

## Pinned comparison and explicit new rules

Read-only 2D Lab reference is freshly fetched `a20713a509270f8ce6e37859c1fafe330372b952`, index SHA256 `6ee59d6834e5227fe919f3ca7b301d6d72ce8a35fadaab128632677dfa9f5cf6`. Audit must identify effective final definitions (not the first duplicate declaration): T463/T468 now delegate into T491 and T501 schedule/depot layers. Preserve `rl`, `rb`, `tr`, `bs`, `bus_rt`, `bop468` exactly according to their existing meanings. A candidate namespace must not reinterpret an imported legacy field as a full running vehicle save. Record copied formulas with exact-source paired tests; expressly label independently specified spatial operations, freight custody, blocking and finances as new deterministic rules, not claimed Lab parity.

## Candidate data contract and migration

- CITY_FORMAT 11, only when transport events are present. Existing event codes 0–24 and row layouts are immutable. Reserve new code 25 `transit` with fields `tick`, `seq`, `kind`, `data`; `data` is a versioned, validated JSON payload. Legacy histories without it retain their old declared format and byte contract.
- Optional `d3.rt` envelope `{v:1, rules:1, state, base}`: `state` includes integer game tick; monotonically allocated IDs; network revision and explicit adjacent graph edges with mode/height; stations/access footprints/depot associations; routes/stop order/headway/suspension; vehicles/type/capacity/route/path/progress/dwell/reservations; bounded active passenger groups and freight consignments; per-location inventories and accounting ledger; exact cumulative and current-day totals. No wall-clock or renderer state is persisted. `base` preserves the pre-transport city save needed for a genuine old-reader rollback, not a falsely compatible downgrade of a moving train.
- Integer game minutes (1,440/day), deterministic ID-sorted ties. Advancing one minute repeatedly, batching days, highest game speed and mid-journey save/reload must yield the same operational state and event sequence. Renderer positions are read-only interpolation of these values. A paused city does not move vehicles.
- Migration of a no-transport world is lazy and explicit on first transport action; it does not mutate the user's previous save. Capture an independently exportable pre-migration backup before activating candidate storage. Unknown future versions, malformed references, inconsistent inventory/finance or missing journal fail visibly. Candidate writes must not destroy the backup. Old reader can open the preserved original city/history; it cannot resume new vehicles, and the UI must say so.
- Full native history uses existing append-only hv2/hv3 journal protocol with the new code; no fake historical passengers or rewritten old events. Complete snapshots, history and residual mid-edge timing are validated on reload. Quota, unavailable IDB and interrupted append are tested with explicit failure receipts.
- Names/fields above are the proposed frozen envelope. Concrete TypeScript structures and any necessary refinement must be documented before their first persistence test; no silent format drift once fixtures exist.

## Construction and operating rules to implement and test

1. Preview/cancel, costs, terrain and occupied-parcel checks precede mutation. Surface track uses explicit cardinal adjacent edges: bends/junctions/crossings, road level crossings, water bridges and one-level slopes. No long edge joining disconnected cells or track through buildings. Metro is an explicit underground layer. Station platforms, freight loading areas and depots have real adjacent access/footprints. Doze and undo append events, do not erase prior history. Failed actions are atomic and actionable.
2. Purchased vehicles originate physically in a compatible connected depot. Routes contain legal ordered stations; pathing follows the chosen mode's graph. Actual travel, dwell, queues, headway and reservations govern all vehicles. Rail/metro/tram and road bus connectivity are different graphs. Broken track, route suspension and station deletion stop the affected movement/revenue; recovery cannot teleport or duplicate passengers/cargo. IDs and graph/path limits bound work and memory.
3. Demand originates in actual eligible homes and jobs, not stations. Finite groups have origin/destination IDs, legal walk-to-stop, ride legs and transfers, capacity and completion/failure states. Fares follow completed movement exactly once; no station-presence or decorative-model revenue. Freight has separate loading and service eligibility.
4. Spatial freight chain: real producer → source warehouse → freight terminal → train → destination terminal → destination warehouse/commercial consumption. Quantity is debited at allocation, accounted while waiting/onboard, and credited exactly once. Foods/goods/fuel/steel/supplies are bridged to the existing economy once, never double-produced or sold. At least one commodity's destination consumption must naturally depend on delivery (connected/broken controls); failed/cancelled consignments remain explicitly held/returned/failed.
5. Integrate `logistics.ts`, `commute.ts`, `economy.ts`, `money.ts`, `nightcity.ts` and `day.ts`: actual operating lines/throughput/access, delivered supply, fares and costs, real night traffic and commission settlement. Preserve imported old behavior when no candidate transport exists. Explicitly prevent duplicate surface/metro/night revenues and aggregate/spatial stock counting.
6. Native toolbar/☰ entry, station/vehicle cards and mobile-operable network, fleet, flow/bottleneck, delivery/failure and financial views. Mobile can build, configure stop sequence/headway, buy/assign, diagnose and save without a hidden developer panel.

## Frozen full acceptance — all mandatory, no partial completion label

- One fixed-seed natural player script starts from a genuinely buildable existing town with homes/jobs/industry/money, constructs connected passenger stops, both freight terminals/warehouse chain, depot and bus feeder; buys and assigns fleets; configures routes/headways; demonstrates real passenger and freight movement/loads/deliveries and reconciles revenue/cost/economy. Light rail and metro must also genuinely operate, not be empty selectors.
- Separate rail severance, suspension, station removal and depleted source stock stop the corresponding service/revenue. Repair resumes without stock/people/revenue duplication. Saving mid-trip and reloading preserves all state/history and continuation. Same input at normal and maximum speed, normal and sandbox modes, gives identical deterministic outcomes other than explicitly documented sandbox money charging.
- At least 120 simulated days: full state, finance, flows and history hashes reconcile; no negative or invented inventory, duplicate delivery, skipped operational events or unbounded active-state growth. Existing old-city no-transport goldens still pass; latest-Lab formulas and independent rules have distinct test receipts.
- Native Chromium continuous movement (not one screenshot), actual click/touch construction and operating journeys at desktop, 360/390/412 and short landscape; same-city/same-camera before/after originals, sequences/video and machine-readable events/population/freight totals. No manually seeded arrival or fixed train animation substitutes for this script.
- Empty/small/large/busy-interchange/mixed/max-speed measurements: frame p50/p95/p99, rebuild and sim/day, memory, draw calls/triangles. 30fps midrange-phone target is a target until measured on identified hardware; CPU throttling is not mislabeled physical-device evidence.
- TypeScript/build, complete applicable Node and native browser CI, save/history/migration/old-reader rollback/fault controls, all 200-model art/source/performance gates. D090's immutable 263-file source pins require a finite, explicit reviewed successor with changed-file preimages and current semantic/negative-control tests; never weaken or relabel historical goldens. Keep first failures and exact-head provenance.
- Draft candidate PR includes source differences, useful checkpoints, exact executed checks, unexecuted checks and blockers. Owner image acceptance/merge/publication are still pending even after technical qualification. Do not call the system complete until every required end-to-end part is actually demonstrated.

## Initial risks, player impact and honest status

Main's simulation advances in daily batches, existing transport layers are largely preserved/imported rather than operational, and the full D090 source lease forbids arbitrary runtime changes without an explicit successor. Spatial logistics must not duplicate the mature aggregate economy. Imported Lab transport records cannot be claimed as new-format resumed fleets. Dispatch deadlocks, invalidated caches, terminal deletion with cargo, queue starvation, long histories and unsupported old-reader behavior need negative controls.

At freeze there is no transport implementation or new save fixture. Local native Chromium was previously blocked at `socket() failed: Operation not permitted` / crashpad startup; connected browser Target.setDiscoverTargets also closed. These observations remain failures, not browser passes. Do not retry through changed flags/executors to evade a platform restriction. Authorized official candidate CI is the normal release-validation route; exact current browser evidence is still required. No transport images, mobile operation, physical-device frame rate or full-loop completion is claimed.

## 2026-11-02 candidate round: placement, successor allowance and number ruling

**Trigger.** The first two checkpoints had been committed under `src/sim/`, so the four
frozen guards listed below failed on the D097 head with
`AssertionError: exact263 current source inventory`: D079, D080, D081, D082 release scope
and the D090 source accounting, all reached through `tools/d083-scope.mjs` →
`d084PriorInventory`. The official `ci` workflow failed only on `node`; `smoke` failed
because it requires every split stage, so it failed derivatively.

**Placement decision (this card).** The two prototypes were relocated, unchanged in bytes,
to `proposals/d097/sim/transitGraph.ts` and `proposals/d097/sim/transitMovement.ts`
(`git mv`, so history follows). `src/` is again exactly the released 263 files, which is
the only state in which the historical guards can stay byte-frozen. The prototypes remain
the same isolated rules and are still executed by `tools/unit-d097-graph.mjs` and
`tools/unit-d097-movement.mjs`; only their import specifiers changed.

**Reviewed-candidate source lease.** `proposals/d097/source-successor/` now carries the
finite successor required by the acceptance clause above: a manifest pinning all 263
released `src/` files at baseline `1aed2c7b7d6ed819e91e381ceb2c68d1e1033632` plus exactly
the two prototype additions, a contract (`d097PriorInventory` accepts exactly 265 and
returns the released 263), a generator, a verifier that derives the 263 pins from
`fixtures/d090/source.json` alone, and negative controls (unknown, missing, duplicate,
tampered, stale baseline, extra addition, wrong prototype bytes).

- Manifest SHA-256: `acbb340f814bfcb92802a362b730e7a04b02d3ee3071acf6cf4fb44fe2a0fead`
  (263 baseline pins + 2 additions).
- Local runs on this head: `node --test proposals/d097/source-successor/contract.test.mjs`
  4/4 pass; `node proposals/d097/source-successor/verify-preview.mjs` reports 263 working
  `src` files equal to the released pins and 265 declared inventory; both D097 prototype
  guards pass; `node tools/unit-d079.mjs` (which walks the whole d079→d090 chain) passes;
  `npm run typecheck` and `npx tsc -p proposals/d097 --noEmit` pass.
- **The allowance is not active.** Activation changes D090 evidence bytes (the finite seam
  test and its digest manifest), so it is left as a reviewed step with the exact order in
  `proposals/d097/source-successor/README.md`. This card claims no activation, no save
  format, no product import and no runtime change.

**CI wiring is frozen as well (reverted).** `tools/d090-validation-pipes-v2.mjs`
(`assertInheritedWorkflowSet`) pins the exact bytes of `ci.yml` plus eight workflow files
through `proposals/d090/inherited-workflow-deltas.json`. Adding the two D097 guard steps
to `ci.yml` is therefore an undeclared workflow change: the D086–D090 `native-and-build`
jobs failed on this head with `every undeclared job/permission/timeout/command retained
.github/workflows/ci.yml`. Those two steps were reverted, so `ci.yml` is byte-identical to
`main` again; the D097 guards and the successor contract/tests run as standalone commands
(see the successor README) until a reviewed workflow successor exists. No check is claimed
to run in CI that does not: official CI on this head validates typecheck, build, the Node
historical partitions and the native release gates only.

**Number ruling (allocation of the next append-only slot).** Event codes end at 24 and
`CITY_FORMAT` is 10 on main. Both candidates proposed the same slot for different
meanings: D092 `resident` and D097 `transit`, each claiming `CITY_FORMAT 11` /
event `25`. Decision for this line: **event 25 is allocated to `transit` (D097)** because
Rail & Transit 1.0 is the owner's current 3D priority (owner 2026-10-30 instruction) and
D092 is a preserved planning candidate. `CITY_FORMAT 11` may carry optional
extension envelopes `d3.rt` and later `d3.lc`; existing codes 0–24 and the old byte
contract stay unchanged. D092/D093 must take **event 26** for `resident` and must not
allocate 25; this ruling is recorded on the D092 candidate card as well. No persistence
code was added in this round.

**Still open.** Rail & Transit 1.0's native construction, services, demand, freight,
economy wiring, persistence, migration/rollback, 120-day determinism, native browser
evidence and full CI acceptance are untouched by this round. The two prototypes remain
in-memory prototypes, not construction or vehicles.

