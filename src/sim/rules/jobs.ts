// 人口與就業（D009）：出處見各行號（實驗線 index.html @ d23c18d）
import { clamp, type Bld } from './lab.ts';

export const POPS = [0, 8, 22, 54];                        // 37409 住宅各級人口
export const JOBSC = [0, 5, 14, 38];                       // 37410 商業各級就業
export const JOBSI = [0, 7, 20, 48];                       // 37411 工業各級就業
export const DEN_POP = [0.70, 0.85, 1.00, 1.25, 1.60];     // 37412 住宅密度 1–5 的人口倍率
export const TOWER_MULT = 1.15;                            // 37418
export const TOWER_POP = Math.round(POPS[3] * 4 * TOWER_MULT);   // 37419 住宅塔 k33
export const MEGA_POP = Math.round(POPS[3] * 9 * 1.35);          // 37420 住宅巨廈 k105
export const MEGA_JOBS = Math.round(JOBSC[3] * 9 * 1.35);        // 37421 商業綜合體 k106
export const TOWER_JOBS = Math.round(JOBSC[3] * 4 * TOWER_MULT); // 37422 商業塔 k34
export const SOCIAL_HOUSING_POP = 76;                            // 39460 社宅 k127

// 39476–39480：住房分帶、容量、入住資格、入住後人口。occ＝該帶入住率（住房市場 T488 沒搬：沒就緒時實驗線回 1）
export function housingBand488(b: Bld | null | undefined) { if (!b || b.ref) return null; if (b.k === 127) return 'social'; if (b.k === 33 || b.k === 105) return 'high'; if (b.k !== 1) return null; const d = b.den || 3; return d <= 2 ? 'low' : d === 3 ? 'mid' : 'high'; }
export function residentCapacity488(b: Bld | null | undefined) { if (!b || b.ref) return 0; if (b.k === 1) return Math.round((POPS[b.lv] || 0) * (b.den ? DEN_POP[b.den - 1] : 1)); if (b.k === 127) return SOCIAL_HOUSING_POP; if (b.k === 33) return TOWER_POP; if (b.k === 105) return MEGA_POP; return 0; }
export function residentEligible488(b: Bld | null | undefined) { if (!b || b.ref) return false; if (b.k === 1) return !!(b.pw && !b.sick && !b.death); if (b.k === 127) return !!(b.pw && b.wa && !b.sick && !b.death); if (b.k === 33 || b.k === 105) return true; return false; }
export const housingOccupancy488 = (occ: number | undefined) => clamp(Number.isFinite(occ) ? occ as number : 1, .35, 1);
export function residentPopulation488(b: Bld | null | undefined, occ: (band: string) => number | undefined) {
  const cap = residentCapacity488(b); if (cap <= 0 || !residentEligible488(b)) return 0;
  const id = housingBand488(b); return Math.round(cap * (id ? housingOccupancy488(occ(id)) : 1));
}

// 55231：商工每棟的名目職位（有電才算；辦公區商業 ×1.5）
export const rciJobs = (b: Bld, office: boolean) => b.k === 2 ? JOBSC[b.lv] * (office ? 1.5 : 1) : JOBSI[b.lv];

// 55246–55249：全城名目就業＝商工＋各種設施的固定就業（實驗線逐項照抄、同順序；企業層 T489 換成有效職位那一步沒搬）
export const JOB_KEYS = ['jobsC', 'jobsI', 'schools', 'stadiums', 'clinics', 'libraries', 'posts', 'cemeteries', 'bigCemN', 'st', 'gstN', 'scN', 'fpN', 'nkN', 'hyN', 'geN', 'fhqN', 'ghN', 'whN284', 'mallN', 'wteN', 'po', 'ai', 'pa', 'tr', 'fa', 'bigFa', 'ra', 'la', 'so', 'wi', 'se', 'am', 'rc', 'fs2', 'pr', 'un', 'trC', 'mgC341', 'faN', 'ctN307', 'obN307', 'jobsLm309', 'mu', 'th', 'aq', 'zo', 'ap', 'ci', 'gl', 'chN', 'crtN', 'cvN', 'inN', 'wsN', 'bgN', 'mhN', 'owN', 'mnN', 'mgN', 'gh330', 'ht330', 'rs330', 'kg330', 'sn330', 'bk330', 'mk330', 'cp330', 'tv330', 'mr330', 'tp336', 'dg336', 'ir336', 'sk336', 'fw340', 'pl340', 'fp340', 'hs340', 'ch340', 'br340', 'wp340', 'vt340', 'sr340', 'cg340', 'cr342', 'hsc342', 'tpk342', 'frt342', 'upc342', 'cpk342', 'gpk465', 'gmc466', 'art466', 'adm466', 'res466', 'cam342', 'mpt342', 'cvc342', 'dtc342', 'gw346', 'fp346', 'kt346', 'ff346', 'upJob', 'powerJobs471', 'waterJobs472', 'infraJobs475', 'refineryN', 'steelMillN', 'shipyardN', 'cl485', 'im485', 'dc485', 'cold485', 'silo485', 'fuelDep485', 'gasDep485', 'steelY485', 'bulk485', 'cport485', 'court364', 'tennis364', 'play364', 'socialHousing364', 'substation364', 'desal364', 'pump364', 'center364', 'shelter364', 'radar364', 'transitDepotJobs501'] as const;
export type JobCounts = Record<(typeof JOB_KEYS)[number], number>;
export const jobCounts = (): JobCounts => Object.fromEntries(JOB_KEYS.map(k => [k, 0])) as JobCounts;
export function nominalJobs(c: JobCounts) {
  let jobs = c.jobsC + c.jobsI + c.schools * 8 + c.stadiums * 20 + c.clinics * 4 + c.libraries * 4 + c.posts * 5 + c.cemeteries * 2 + c.bigCemN * 8 + c.st * 12 + c.gstN * 30 + c.scN * 40 + c.fpN * 25 + c.nkN * 30 + c.hyN * 12 + c.geN * 5 + c.fhqN * 20 + c.ghN * 4 + c.whN284 * 8 + c.mallN * 70 + c.wteN * 12 + c.po * 10 + c.ai * 40 + c.pa * 1 + c.tr * 6 + c.fa * 3 + c.bigFa * 18 + c.ra * 2 + c.la * 8 + c.so * 2 + c.wi * 2 + c.se * 4 + c.am * 5 + c.rc * 4 + c.fs2 * 8 + c.pr * 10 + c.un * 20 + c.trC * TOWER_JOBS + c.mgC341 * MEGA_JOBS + c.faN * 12 + c.ctN307 * 4 + c.obN307 * 10 + c.jobsLm309 + c.mu * 12 + c.th * 10 + c.aq * 14 + c.zo * 20 + c.ap * 24 + c.ci * 6 + c.gl * 16 + c.chN * 20 + c.crtN * 14 + c.cvN * 35 + c.inN * 22 + c.wsN * 8 + c.bgN * 18 + c.mhN * 28 + c.owN * 6 + c.mnN * 8 + c.mgN * 40 + c.gh330 * 2 + c.ht330 * 12 + c.rs330 * 30 + c.kg330 * 4 + c.sn330 * 3 + c.bk330 * 8 + c.mk330 * 10 + c.cp330 * 4 + c.tv330 * 6 + c.mr330 * 8 + c.tp336 * 8 + c.dg336 * 1 + c.ir336 * 5 + c.sk336 * 3 + c.fw340 * 1 + c.pl340 * 3 + c.fp340 * 3 + c.hs340 * 4 + c.ch340 * 5 + c.br340 * 14 + c.wp340 * 16 + c.vt340 * 4 + c.sr340 * 10 + c.cg340 * 1 + c.cr342 * 4 + c.hsc342 * 12 + c.tpk342 * 45 + c.frt342 * 10 + c.upc342 * 12 + c.cpk342 * 2 + c.gpk465 * 4 + c.gmc466 * 85 + c.art466 * 70 + c.adm466 * 120 + c.res466 * 140 + c.cam342 * 40 + c.mpt342 * 60 + c.cvc342 * 18 + c.dtc342 * 20 + c.gw346 * 6 + c.fp346 * 14 + c.kt346 * 12 + c.ff346 * 4 + c.upJob + c.powerJobs471 + c.waterJobs472 + c.infraJobs475;
  jobs += c.refineryN * 18 + c.steelMillN * 22 + c.shipyardN * 16;
  jobs += c.cl485 * 36 + c.im485 * 42 + c.dc485 * 24 + c.cold485 * 14 + c.silo485 * 8 + c.fuelDep485 * 16 + c.gasDep485 * 18 + c.steelY485 * 12 + c.bulk485 * 38 + c.cport485 * 70;
  jobs += c.court364 + c.tennis364 + c.play364 + c.socialHousing364 * 2 + c.substation364 * 3 + c.desal364 * 10 + c.pump364 * 4 + c.center364 * 14 + c.shelter364 * 2 + c.radar364 * 6;
  jobs += c.transitDepotJobs501;
  return jobs;
}
