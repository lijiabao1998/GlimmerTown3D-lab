# D086 V4: actual lazy geometry cache; original player camera restored

This candidate does **not** accept the ten buildings or change the accepted count of 147. The preceding cc8280f candidate has all three native raw-image/typed-word joins green, but first-action commit failures at 360 (405.4 ms) and 1440 (516.5 ms), both over the unchanged 400 ms ceiling. All 90 samples and original surface failures remain retained.

## Production change

The original procedural model source `cbaf9009d122d66915f0deb21b4540cba4b2e4816c2265a7d17536710a45cc73` remains the byte-exact authoritative compiler. A reproducible, same-module generated block stores ten normalized native meshes. It is neither an image nor a browser fixture. Only the production emitter switches to a private lazy render cache. Model generation/reference APIs continue to use the procedural compiler.

The format stores deduplicated points/normals, exact round-trip Float64 decimal values (including literal negative zero), colors, part names, full solid/facade metadata, and seven-integer triangle records. First real emission decodes and deeply freezes one model; later real emissions reuse it. Import/startup does not decode or compile any D086 model. A missing, stale, malformed or checksum-invalid entry falls back to the unchanged compiler and records that fact. The runtime FNV checksum is a consistency check, **not** an authentication boundary. Mandatory clean regeneration and SHA256/full-byte manifest equality reject even resealed semantic tampering.

Current generated model source: `e5d5bc02b0c2b6601c115c2761e73f07030de73487ba68f22abb01c3eac5b84a`. The strict source lease additionally covers the restored city renderer, orthographic-only post type and append-only readonly cache-info declaration; every other source remains exact cc8280f. The cache-info hook returns new observation records, never mutable cached geometry or a prewarm command.

## Geometry and historical contracts

All ten descriptors, Float64 accumulator words, actual Float32 GPU attributes, owner/material/component identities, signed zero and five complete production scenes must equal the independent procedural reference. All 147 prior models and all 157 structural identities remain required. Source projections are restricted to exact finite hashes and are not substitutes for actual current native tests. The original cc8280f, 207404e, first candidate and published baseline contracts run on their actual immutable source trees.

The superseded inspection hook is removed. Player camera and rendering return to byte-exact 207404e behavior plus only a readonly cache-information import/getter. Original D081 required surfaces, legal player views, thresholds and negative controls remain mandatory. Genuine architecture repairs are being evaluated separately; this cache candidate does not excuse the known surface failures.

## Unshifted performance evidence

The current cold-input driver is an exact finite additive copy of the original driver: all 30 real native commits per width, CPU6 input timing, every original observation and all existing ceilings/median requirements remain intact. Readonly cache/whole-browser heap observations bracket those operations, outside measured input. They prove no earlier decode, one decode at first use, no second compile cache and exact reuse. Observation failure is a separate failure, not a reason to discard original timing samples.

A separate mandatory job uses eight fresh Chrome profiles per width: baseline/current × CPU1/CPU6 × two repetitions, with CPU rate set **before navigation**. Both the exact historical baseline HTML and exact current HTML travel in the verified build artifact. It records bundle/gzip bytes, navigation/parse/load data, original `__gt.timing()`, CDP script/task duration and total JS heap. The existing D003 <1500 ms unthrottled decode/city/scene budget is unchanged; it is not falsely described as a full-navigation or CPU6 budget. Every CPU6 load observation is retained for review. Whole-application heap and logical cache payload sizes are explicitly not exclusive retained-cache measurements.

Prior private Node profiles showed faster decoding but a larger bundle; they are not Chrome acceptance. Official exact-head fresh Chrome evidence remains necessary. No test-only preload, threshold relaxation, image baking or hidden model omission is permitted.

## Retained first reds

Private attempt1 cache decoding regressed the butter model and was not adopted. Attempt2 removed JSON-reviver overhead and preserved literal signed zero. Attempt3 added an optional honest clock (`null` if absent). Attempt4 only added fresh readonly cache-ID arrays; exact inverse-source tests retain all three intermediate identities. The initial current test retained an intermediate source pin and failed; its current pin was corrected only after exact generation and inverse-delta proofs. The first real typecheck also found the missing getter declaration; the finite append-only declaration and fourth source-lease entry repair that actual integration defect. These logs are retained, not reported as browser passes.
