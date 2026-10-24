# First actual Chromium failure
Run https://github.com/lijiabao1998/GlimmerTown3D-lab/actions/runs/40135502608
Head 86b8c1b65443bd5a0e89b885fbf1dc73aa770ec2, merge test 8e1f6dd2aeb6733f2e8227fc8a5d46d3da7a0988.
412 job 120996052897 fails actual native footprint: 0 !== 4. Unit/source/typecheck/build pass.
Cause: test called __gt.loadCode, whose load defaults simulate=false; readonly city cannot hold a building tool. Fixed the test to use the original paste UI and actual CDP clicks, as D083 does, and assert build dock. No product threshold or engine change. Capture pre-assert diagnostic PNG/state so a subsequent failure remains visible.
Artifact 12576917850 retains the first failure report. This is not a visual pass.

Second run 40135623522 (head c2ae85d) proved paste UI still correctly opens raw 2D imports as view-only. The fixture is now converted with native loadCode/saveCode before paste, preserving the existing rule; no simulate flag or UI protection bypass. Added exact published-main HTML SHA pin and same-renderer legacy whole-PNG comparison. Baseline bytes are downloaded from public HTTPS, then served in an isolated test origin; this is not a claim of public-origin browser interaction.
