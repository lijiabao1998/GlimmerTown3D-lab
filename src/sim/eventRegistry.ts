// D046：世界歷史的唯一格式登記。code 是 hv 2／3 列的首欄，format 是該事件最早支援的城市格式。
// 既有 code 0–24 只往後加，不改號、不重排；新增欄位或事件先提高城市格式，不能借用舊碼。
// D039：格式 8／碼 18–22＝policy、budget、research、spec、techdone。
// D040：格式 9／碼 23＝depleted。D045：格式 10／碼 24＝cms（完成才有 bonus）。
// 這只是把既有格式集中，D046 沒有新增事件、碼或歷史存法；委託小數另放附加欄位。
import type { CityEvent } from './city.ts';

interface EventSpec { readonly code: number; readonly format: number; readonly fields: readonly string[] }
const spec = (code: number, format: number, fields: string[]): EventSpec => Object.freeze({ code, format, fields: Object.freeze(fields) });

export const EVENT_REGISTRY = Object.freeze({
  import: spec(0, 1, ['source', 'gameVer', 'seed', 'codeHash', 'buildings']),
  grow: spec(1, 2, ['x', 'z', 'k', 'lv', 'v']),
  upgrade: spec(2, 2, ['x', 'z', 'k', 'lv', 'v']),
  road: spec(3, 3, ['x', 'z', 'rc', 'cost', 'g']),
  zone: spec(4, 3, ['x', 'z', 'zone', 'cost', 'g']),
  place: spec(5, 3, ['x', 'z', 'k', 'lv', 'v', 'id', 'cost', 'g']),
  doze: spec(6, 3, ['x', 'z', 'layer', 'cost', 'g', 'k', 'id']), // k／id：拆建築時可選；wp、ruin 圖層另看 minimumEventFormat
  undo: spec(7, 3, ['g', 'refund']),
  restyle: spec(8, 4, ['x', 'z', 'v']),
  pipe: spec(9, 5, ['x', 'z', 'cost', 'g']),
  fire: spec(10, 6, ['x', 'z', 'k']),
  burn: spec(11, 6, ['x', 'z', 'k', 'id']),
  crime: spec(12, 6, ['x', 'z', 'k']),
  abandon: spec(13, 6, ['x', 'z', 'k', 'id']),
  sick: spec(14, 6, ['x', 'z']),
  death: spec(15, 6, ['x', 'z']),
  act: spec(16, 6, ['x', 'z', 'what', 'cost']),
  merge: spec(17, 7, ['x', 'z', 'k', 'v']), // 後接 1–9 個被吸收的建築編號；size 由 k 推
  policy: spec(18, 8, ['key', 'from', 'value']),
  budget: spec(19, 8, ['cat', 'from', 'value']),
  research: spec(20, 8, ['id', 'fee']),
  spec: spec(21, 8, ['id']),
  techdone: spec(22, 8, ['id']),
  depleted: spec(23, 9, ['x', 'z', 'k']),
  cms: spec(24, 10, ['ev', 'id', 'bonus']),
} satisfies Record<CityEvent['t'], EventSpec>);

export const EVENT_BY_CODE: Readonly<Partial<Record<number, CityEvent['t']>>> = Object.freeze(Object.fromEntries(
  Object.entries(EVENT_REGISTRY).map(([t, e]) => [e.code, t as CityEvent['t']] as const),
));
export const CITY_FORMAT = Math.max(...Object.values(EVENT_REGISTRY).map(e => e.format));
// D012 以前沒標 f 的檔仍接受格式 1–4 的事件；不能拿掉 f 來偷帶格式 5–10。
export const LEGACY_UNVERSIONED_FORMAT = 4;
export function minimumEventFormat(e: CityEvent): number {
  // Preserve the existing save/export error contract before touching registry fields.
  if (!Object.hasOwn(EVENT_REGISTRY, e.t)) throw new Error(`存檔：不認得的事件 ${e.t}`);
  if (e.t === 'doze' && e.layer === 'ruin') return 6;
  if (e.t === 'doze' && e.layer === 'wp') return 5;
  return EVENT_REGISTRY[e.t].format;
}
// 寫檔的下限維持 D012 的 4，避免沒有新事件的城無故換格式或改變分享碼位元組。
export const eventFormat = (e: CityEvent): number => Math.max(LEGACY_UNVERSIONED_FORMAT, minimumEventFormat(e));
