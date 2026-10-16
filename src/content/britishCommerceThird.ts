// D070: ten original third structures on existing saved v2 slots. Rendering only;
// no new construction tools, kind IDs, footprint rules or changes to earlier variants.
export const THIRD_BUILDINGS = [
  { k: 65, v: 2, id: 'courtyard-shopping-centre', name: '大型購物中心', silhouette: 'low continuous retail ring around an uncovered courtyard with a two-step corner entrance pavilion' },
  { k: 86, v: 2, id: 'victorian-corner-bank', name: '銀行', silhouette: 'L-shaped banking block with a chamfered diagonal entrance, tiered cornice and square lantern on its return wing' },
  { k: 91, v: 2, id: 'quayside-trade-courtyard', name: '貿易站', silhouette: 'two long pitched trading sheds form a court beneath a third raised rear gatehouse with a real open passage' },
  { k: 98, v: 2, id: 'courtyard-youth-hostel', name: '青年旅舍', silhouette: 'two unequal high mono-pitched sleeping wings flank an open arrival court joined by a low gabled communal hall' },
  { k: 99, v: 2, id: 'octagonal-ceremony-chapel', name: '婚禮教堂', silhouette: 'octagonal ceremony chamber with a faceted pyramidal roof, narrow rear chancel and recessed front vestibule' },
  { k: 57, v: 2, id: 'courtyard-bakery-works', name: '食品加工廠', silhouette: 'three unequal pitched oven and packing halls surround a service court beneath a broad raised ventilator' },
  { k: 64, v: 2, id: 'canal-hoist-warehouse', name: '倉儲物流中心', silhouette: 'deep recessed-loading warehouse under stepped end walls beside a separate narrow hoist tower and projecting lifting beam' },
  { k: 110, v: 2, id: 't-plan-freight-depot', name: '貨運站', silhouette: 'long pitched rail shed joins an offset crosswise transfer hall between two unequal open loading courts' },
  { k: 167, v: 2, id: 'fan-roof-distribution-centre', name: '大型配送中心', silhouette: 'pentagonal fan-plan warehouse with three converging roof facets and a separate small rectangular entrance block' },
  { k: 168, v: 2, id: 'courtyard-cold-chain-depot', name: '冷鏈倉儲', silhouette: 'three flat-roofed insulated wings enclose an open loading court with a raised transverse service spine over the rear range' },
] as const;
export const THIRD_KINDS: ReadonlySet<number> = new Set(THIRD_BUILDINGS.map(b => b.k));
