// D106 (docs/D106-ci-first-use-ceiling.md, owner 2026-11-18): CI-only page-first commit ceiling.
// Loaded only by NODE_OPTIONS=--import ./proposals/d106/first-use-ceiling-hook.mjs on the
// native-input-performance first-use step of .github/workflows/d086-native.yml ... d090-native.yml.
// It registers proposals/d106/first-use-ceiling-resolve.mjs, which redirects exactly the five original
// browser-first-use-performance.mjs modules to their declared relaxed copies and nothing else.
import {register} from 'node:module';

register('./first-use-ceiling-resolve.mjs', import.meta.url);
process.stderr.write('D106: CI page-first commit ceiling 1000 ms via proposals/d106/first-use-ceiling-hook.mjs; every other first-use ceiling unchanged (docs/D106-ci-first-use-ceiling.md)\n');
