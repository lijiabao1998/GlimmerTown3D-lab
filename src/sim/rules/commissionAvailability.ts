// D046 offer policy v1: only new offers are capability-filtered. The 11 persisted
// IDs and the D045 floating-point hash stay unchanged for old saves and 2D parity.
import { CMS385, NO_RIDERSHIP, cmsHash, cmsOffers, type CmsCtx, type CmsDef, type CmsState } from './commission.ts';
export const COMMISSION_OFFER_POLICY = '3d-capabilities-v1';
export const commissionAvailable = (c: CmsDef): boolean => !NO_RIDERSHIP(c);

export function playableCmsOffers(seed: number, rankIdx: number, cms: CmsState): CmsDef[] {
  const eligible = CMS385.filter(c => rankIdx + 1 >= c.minRank && !(c.type === 'tech' && cms.done.includes(c.id)));
  const available = eligible.filter(commissionAvailable), count = Math.min(3, available.length);
  // Keep the original relative order whenever an old offer was possible here.
  const out = cmsOffers(seed, rankIdx, cms).filter(commissionAvailable);
  for (let t = 0; out.length < count && t < 60; t++) {
    const c = eligible[Math.floor(cmsHash(seed | 0, cms.n * 31 + t, 3850) * eligible.length) % eligible.length];
    if (commissionAvailable(c) && !out.includes(c)) out.push(c);
  }
  // A bounded, stable catalogue tail also covers pathological hash collisions.
  for (const c of available) if (out.length < count && !out.includes(c)) out.push(c);
  return out;
}

export function acceptPlayableCms(cms: CmsState, i: number, x: CmsCtx): CmsDef | null {
  if (x.diff === 3 || cms.act || x.rankIdx + 1 < 3 || x.pop <= 50 || !Number.isInteger(i)) return null;
  const c = playableCmsOffers(x.seed, x.rankIdx, cms)[i];
  if (!c) return null;
  cms.act = c.id; cms.st = x.day; cms.acc = 0; cms.hold = 0;
  return c;
}
