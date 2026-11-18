// D106 (docs/D106-ci-first-use-ceiling.md, owner 2026-11-18): the CI-only page-first commit ceiling.
// Pure data and functions, no side effects. The five original
// proposals/d08x/browser-first-use-performance.mjs files and every original test stay byte-exact.
// Three byte groups exist (d086 = d090, d087 = d089, d088), so there are three relaxed copies; each is
// its original at D106_BASE plus exactly the four seams below, each applied at exactly one place.
// Only proposals/d106/first-use-ceiling-hook.mjs (NODE_OPTIONS on the native-input-performance
// first-use step of .github/workflows/d086-native.yml ... d090-native.yml) ever loads a copy.
export const D106_BASE = '23d42c933eadcbdcf36e2289f5e453802380d1f7';
export const D106_PAGE_FIRST_COMMIT_MAX_MS = 1000;
export const D106_HOOK = 'proposals/d106/first-use-ceiling-hook.mjs';
export const D106_ORIGINAL_SHA256 = Object.freeze({
  'proposals/d086/browser-first-use-performance.mjs': '96e904d8f18723838e93ba37479a51fb2397ec06e5d260f0cb65fa6be3f9278e',
  'proposals/d087/browser-first-use-performance.mjs': '346758ec92d351d691776e63efc71cf561f777992455436628a4c74375fc3e5a',
  'proposals/d088/browser-first-use-performance.mjs': '173e8e7fa8e7ee5f11570b5806d5f4d17bbac482494a4b09fea99f7ac7e746ae',
  'proposals/d089/browser-first-use-performance.mjs': '346758ec92d351d691776e63efc71cf561f777992455436628a4c74375fc3e5a',
  'proposals/d090/browser-first-use-performance.mjs': '96e904d8f18723838e93ba37479a51fb2397ec06e5d260f0cb65fa6be3f9278e',
});
// Each relaxed copy and the originals it stands in for (the first one is its byte source).
export const D106_GROUPS = Object.freeze({
  'proposals/d106/browser-first-use-performance-d086.mjs': Object.freeze(['proposals/d086/browser-first-use-performance.mjs', 'proposals/d090/browser-first-use-performance.mjs']),
  'proposals/d106/browser-first-use-performance-d087.mjs': Object.freeze(['proposals/d087/browser-first-use-performance.mjs', 'proposals/d089/browser-first-use-performance.mjs']),
  'proposals/d106/browser-first-use-performance-d088.mjs': Object.freeze(['proposals/d088/browser-first-use-performance.mjs']),
});
// The exact five redirects (original -> relaxed copy). Nothing else is ever redirected.
export const D106_REDIRECTS = Object.freeze(Object.fromEntries(Object.entries(D106_GROUPS).flatMap(([copy, originals]) => originals.map(original => [original, copy])).sort(([a], [b]) => a < b ? -1 : 1)));

const header = copy => {
  const [source, ...same] = D106_GROUPS[copy];
  return '// D106 CI-only copy (docs/D106-ci-first-use-ceiling.md, owner 2026-11-18): ' + source +
    (same.length ? ' (byte-identical to ' + same.join(', ') + ')' : '') + ' at ' + D106_BASE.slice(0, 7) + '\n' +
    '// plus the four seams declared in proposals/d106/first-use-ceiling.mjs. Loaded only through\n' +
    '// proposals/d106/first-use-ceiling-hook.mjs: the page\'s first placement (operation 1) may commit in\n' +
    '// <=1000 ms; previewMs<=16, every other commitMs<=400, rebuildMs/rebuildAllMs<=400 and the original\n' +
    '// three-commit median<=400 are unchanged. No retry, no discarded or relabelled sample.\n';
};
const FIRST_LINE = '// Additive CI hook: no browser launch, source instrumentation, synthetic preview,\n';
// The four declared seams of one copy, in order: [before, after], each before occurs exactly once.
export function d106Seams(copy) {
  if (!Object.hasOwn(D106_GROUPS, copy)) throw new Error('not a D106 copy: ' + copy);
  return Object.freeze([
    Object.freeze([FIRST_LINE, header(copy) + FIRST_LINE]),
    Object.freeze(['commitMaxMs:400,rebuildMaxMs:400,', 'commitMaxMs:400,pageFirstCommitMaxMs:1000,rebuildMaxMs:400,']),
    Object.freeze(["for(const [name,limit]of [['previewMs',16],['commitMs',400],['rebuildMs',400],['rebuildAllMs',400]]){finite(r[name],name);assert.ok(r[name]<=limit,'unchanged '+name+' ceiling '+limit+'ms');}",
      "for(const [name,limit,label]of [['previewMs',16,'unchanged'],['commitMs',r.operation===1?1000:400,r.operation===1?'D106 CI page-first':'unchanged'],['rebuildMs',400,'unchanged'],['rebuildAllMs',400,'unchanged']]){finite(r[name],name);assert.ok(r[name]<=limit,label+' '+name+' ceiling '+limit+'ms');}"]),
    Object.freeze(["const r={qualification:'Actual CPU6 first native selection/held preview/placement observation.",
      "const r={qualification:'D106 CI ceilings: operation 1 (the page first placement) commitMs<=1000ms, every other ceiling unchanged. Actual CPU6 first native selection/held preview/placement observation."]),
  ]);
}
const occurrences = (text, part) => text.split(part).length - 1;
// The relaxed copy for `copy` from the bytes of its source original; throws unless every seam
// applies at exactly one place and every after is then unique.
export function d106RelaxedCopy(copy, original) {
  let text = original;
  for (const [before, after] of d106Seams(copy)) {
    if (occurrences(text, before) !== 1) throw new Error('D106 seam must occur exactly once: ' + JSON.stringify(before.slice(0, 80)));
    text = text.replace(before, () => after);
  }
  for (const [, after] of d106Seams(copy)) if (occurrences(text, after) !== 1) throw new Error('D106 seam after must be unique: ' + JSON.stringify(after.slice(0, 80)));
  return text;
}
