// D106 module resolve hook (docs/D106-ci-first-use-ceiling.md). Registered only by
// proposals/d106/first-use-ceiling-hook.mjs. After the default resolution, exactly the five original
// proposals/d08x/browser-first-use-performance.mjs file URLs are redirected to their D106 copy; every
// other URL (the copies themselves, the check scripts, every test, builtins, data: URLs, a query or
// fragment suffix) passes through untouched.
import {D106_REDIRECTS} from './first-use-ceiling.mjs';

const ROOT = new URL('../../', import.meta.url);
export const D106_URL_REDIRECTS = new Map(Object.entries(D106_REDIRECTS).map(([original, copy]) => [new URL(original, ROOT).href, new URL(copy, ROOT).href]));

export function d106Redirect(url) {
  return D106_URL_REDIRECTS.get(url) ?? url;
}

export async function resolve(specifier, context, nextResolve) {
  const resolved = await nextResolve(specifier, context);
  const url = d106Redirect(resolved.url);
  return url === resolved.url ? resolved : {...resolved, url};
}
