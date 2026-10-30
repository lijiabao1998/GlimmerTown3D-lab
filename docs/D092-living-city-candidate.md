# D092 — Living City 1.0: resident day-loop candidate

Frozen before implementation, 2026-10-30. Base `6c28221859f337f72953a76ab3e24e50d76bca93`.
Owner request reference: `Sentinel_7b0485f519488191b0a072bbd4620b0e`. Scope summary (not a verbatim transcript): plan and begin Living City 1.0; prioritize a real resident home → road commute → workplace → evening return → life record loop; building count is not the goal; preserve deterministic simulation, old saves, 2D Lab parity, append-only history, code-only assets and mobile-first QA. New formats, major rules, style and publication retain owner approval gates. The former pause on “a life” now permits candidate research, not automatic product release.

## Existing evidence and gaps
- D000's resident-history promise is not implemented by D002 lot history. The latter explicitly lacks people.
- D013 stores append-only city events using compact history rows and IndexedDB; current `CITY_FORMAT=10`, event codes 0–24. No resident identities exist.
- `src/sim/rules/commute.ts` implements deterministic multi-source road BFS and 6×6 representative clusters every four days. This is aggregate commute pressure, not individual travel or job assignment.
- `jobs.ts` computes housing populations and job capacities; `day.ts` preserves Lab formula parity. These must not be silently replaced by a resident economy.
- D037 bus routes and D041 emergency dispatch remain measured, locked gaps. Residents are not buses or emergency vehicles; this candidate does not claim either is delivered.
- D090 exact-source guards pin 263 source files. Formal integration requires a reviewed successor allowance, not editing golden hashes or weakening original guards.

## Contiguous delivery cards / PR boundaries
1. **D092 (this draft PR):** isolated, opt-in `proposals/d092/` candidate using real imported city data and existing renderer. Deterministic integer-time residents; capacity-bound workplace assignment; footprint-adjacent roads; road-only travel; arrival-driven work; actual departure/arrival ledger. Session-only and explicitly labelled; no saves or economy writes.
2. **D093 (approval gate):** durable resident identity + format 11 proposal below, migration and real old-reader rollback. Begin only after approval. Preserve original raw backup and append-only city history.
3. **D094:** approved integration in cityView with versioned source validation, bounded near-view instancing, mobile resident inspection. No new building catalogue.
4. **D095:** broken-road, lost-workplace, population reconciliation and 2D parity acceptance on real cities; complete historical guards and exact-head Chromium evidence.
5. **D096:** first life-mode slice (follow one resident, real historical choices) after the preceding daily loop is accepted. Broader city events are later work, not implied complete.

Each card is a separate draft PR when implementation reaches it. No automatic merge/deploy.

## D093 proposal requiring owner approval (not implemented by D092)
- Keep base Lab `v:1`, building numbers, all existing fields and compact event codes unchanged.
- Add `d3.lc` versioned optional extension: `{v:1, tick, ticksPerDay:1440, nextResidentId, residents, journal:{id,n,h}, sourceCityHash}`. Resident rows: `[id,homeBuildingId,workBuildingId|null,status,tile,nextTile,edgeProgress,assignedDay]`. IDs are monotonically allocated and never reused. Simulation uses integer minute ticks; no real-clock RNG. Exact final encoding is frozen in D093 before code.
- Raise `CITY_FORMAT` to **11 only for saves containing Living City events**; append event code **25** (`resident`, operation `adopt|leave|assign|depart|arrive|blocked`, resident ID, integer within-day minute, home/work/source/destination IDs, location and reason). Existing codes 0–24 and formats 1–10 remain byte-identical. Do not fabricate pre-import life histories: adoption begins at migration tick and states its origin.
- Residents refine existing population, never add a second population count. Phase 1 does **not** change money, jobs, happiness, traffic-load formulas or hazard resolution. “Working” means arrived at an assigned, capacity-bound workplace, not an extra invented wage or productivity effect. Any economy feedback is a separate major-rule proposal.
- Planned files: new `src/sim/livingCity.ts`, `src/render/residents.ts`, `src/ui/residentPanel.ts`; reviewed changes to `city.ts`, `eventRegistry.ts`, `day.ts`, `replay.ts`, `io/save.ts`, `io/historyPack.ts` (verify exact pack-module path in D093), `io/journal.ts`, `cityView.ts`; additive dedicated tests and versioned successor source allowlist. No original assertion deletion.
- Migration: read/verify original format 1–10 save and journal first; retain exact original export + original journal under a distinct immutable backup ID; create a new versioned candidate namespace/journal; deterministically allocate current population by ascending building ID, one new `adopt` event per resident; stage and read back, verify hashes, population and replay before switching active pointer. A failed transaction or quota denial leaves the old active save untouched.
- **Real rollback:** load the retained original bytes and original journal in an actual build of main `6c28221`, compare city/simulation hashes and exact exported base fields, and continue at least 30 days alongside the pre-migration baseline. Rollback restores the pre-migration checkpoint, not progress made afterward. Never claim an older reader understands resident events. A labelled city-only downgrade can preserve later city state but loses new resident history and must not overwrite the full save.
- Risks: identity stability through merged/demolished housing; population reductions are not automatically deaths; event growth (four travel events per worker/day) needs batching/indexed storage; mobile route budgets; migration quota/crash boundaries; source-guard successor approval. D092 avoids these storage risks but does not solve persistence.

## Frozen D092 acceptance
1. No existing `src/`, `index.html`, save, dependency lock, workflow or historical guard changes. Existing default product remains byte-identical. Candidate is an explicit separate URL.
2. Fixed input and elapsed integer simulation ticks produce byte-identical resident states and event sequence regardless of browser frame partitions. No `Math.random`, wall clock, DOM or renderer imports in the resident engine.
3. Population reconciles to the existing population helper; each job slot is used at most once; all residents have real homes; no arbitrary decorative population. Empty / no-job / disconnected states are explicit. Render count can be bounded without dropping simulation residents.
4. Departure, each road transition and arrival are causally simulated. No direct interpolated home→work line; no arrival/work when the route is missing; return begins in evening. Events are append-only and are written only at actual transitions. Existing city/history/financial state is unchanged.
5. Real Chromium continuous execution proves motion over multiple frames, work arrival, evening return and ledger reconciliation. Pause/resume and road disconnection are exercised. Four viewport originals (1440×900, 412×915, 390×844, 360×800), no console errors/overflow, readable status and ≥44px controls. Before/after same-camera images and measured timing, labelled software-rendered where applicable.
6. Run candidate unit/type/build checks, original type/build and applicable complete original Node guards; report every failed/blocked/not-run stage honestly. Existing historical browser CI is not replaced by candidate QA.
7. Session ledger is visibly labelled **not saved**. Permanent world-history completion, migration/rollback, official integration, owner visual acceptance, physical Android performance and release remain open until their actual gates pass.

## Not done at freeze
No candidate implementation or test has run. No formal save/schema change is authorized by this card. No publication or merge.
