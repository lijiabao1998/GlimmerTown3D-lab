// D046：3D 委託存檔接頭；commission.ts 的 2D 原文對拍函式不改。
// cms385 沿用 2D 實驗線 @ d23c18d 的六欄格式，acc 向下取整，舊 2D 讀器仍收得進。
// cms3d 是本線附加欄位：版本 1 保存精確 acc；非科技委託重接時，另存原本的 done 順序。
// 原文允許重接非科技委託，卻拒讀 act 在 done 內的存檔；cms385 暫時拿掉該 id，附加欄位補回紀錄。
// base 配對六欄完整狀態（含輸出的 done 順序），不能把舊精度或完成紀錄補回別輪委託。
// 2D 若改過委託而留下舊附加欄位，配對不符就只讀 cms385，不把舊小數補回新狀態。
// 未修改的 2D 不會保存本線附加欄位；經它重新匯出後，保留委託與整數進度，
// 但丟失小數與進行中重接項目的先前完成紀錄（其他 done 不變；再次完成仍會重新記入）。
// 這是格式相容，不是防竄改簽章；完整改寫兩欄的分享碼仍是使用者提供的狀態。
import { CMS_BY_ID385, cmsSave, emptyCms, type CmsState } from './commission.ts';

export interface Cms3dExt { v: 1; base: CmsState; acc: number; done?: string[] }
export interface CmsSave3d { cms385: CmsState | null; cms3d: Cms3dExt | null }

const knownId = (id: unknown): id is string => typeof id === 'string' && Object.hasOwn(CMS_BY_ID385, id);

// 除有限非負小數與合法非科技重接，驗型沿用 2D cmsLoad；null 區分壞輸入與合法零狀態。
function parseCms(raw: unknown): CmsState | null {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>, o = emptyCms();
    const act = r.act === undefined ? '' : r.act;
    if (act !== '' && !knownId(act)) return null;
    for (const k of ['st', 'acc', 'hold', 'n'] as const) {
      const v = r[k] === undefined ? 0 : r[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || (k !== 'acc' && !Number.isInteger(v))) return null;
      o[k] = v;
    }
    if (act !== '' && o.st < 1) return null;
    const done = r.done === undefined ? [] : r.done;
    if (!Array.isArray(done)) return null;
    const seen = new Set<string>();
    for (const id of done) { if (!knownId(id) || seen.has(id)) return null; seen.add(id); o.done.push(id); }
    if (act !== '' && seen.has(act) && CMS_BY_ID385[act].type === 'tech') return null;
    o.act = act; return o;
  } catch { return null; }
}

function sameBase(raw: unknown, c: CmsState): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const b = raw as Record<string, unknown>;
  // 不用讀檔預設值補 base：缺任何一欄的附加欄位都不是完整配對。
  return ['act', 'st', 'acc', 'hold', 'n', 'done'].every(k => Object.hasOwn(b, k))
    && b.act === c.act && b.st === c.st && b.acc === c.acc && b.hold === c.hold && b.n === c.n
    && Array.isArray(b.done) && b.done.length === c.done.length && b.done.every((id, i) => id === c.done[i]);
}

export function cmsLoad3d(raw: unknown, ext?: unknown): CmsState {
  const c = parseCms(raw);
  if (!c) return emptyCms();
  // D045 舊 3D 碼可能直接帶小數、或帶已完成項目的重接；主欄位已有完整資料，不被 ext 覆蓋。
  if (!Number.isInteger(c.acc) || (c.act !== '' && c.done.includes(c.act))) return c;
  try {
    if (!ext || typeof ext !== 'object' || Array.isArray(ext)) return c;
    const e = ext as Record<string, unknown>, acc = e.acc;
    if (e.v !== 1 || typeof acc !== 'number' || !Number.isFinite(acc) || acc < 0
      || Math.floor(acc) !== c.acc || !sameBase(e.base, c)) return c;
    if (Object.hasOwn(e, 'done')) {
      const exact = parseCms({ ...c, acc, done: e.done });
      if (!exact || !exact.act || !exact.done.includes(exact.act)) return c;
      const rest = exact.done.filter(id => id !== exact.act);
      if (rest.length !== c.done.length || rest.some((id, i) => id !== c.done[i])) return c;
      return exact;
    }
    if (!Number.isInteger(acc)) c.acc = acc;
  } catch { /* 畸形附加欄位只丟附加精度／重接紀錄，不丟有效的委託。 */ }
  return c;
}

export function cmsSave3d(c: CmsState): CmsSave3d {
  const exact = parseCms(c);
  if (!exact) return { cms385: null, cms3d: null };
  const base = cmsSave(exact);
  if (base) base.acc = Math.floor(exact.acc);
  const repeated = exact.act !== '' && exact.done.includes(exact.act);
  if (base && repeated) base.done = base.done.filter(id => id !== exact.act);
  return {
    cms385: base,
    cms3d: base && (!Number.isInteger(exact.acc) || repeated)
      ? { v: 1, base: { ...base, done: base.done.slice() }, acc: exact.acc, ...(repeated ? { done: exact.done.slice() } : {}) } : null,
  };
}
