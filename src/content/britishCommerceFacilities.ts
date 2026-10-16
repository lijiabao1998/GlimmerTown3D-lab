// D068: ten original British commerce / logistics models on existing kinds; rendering only.
export const FACILITY_BUILDINGS = [
  { k: 65, id: 'brick-shopping-arcade', name: '大型購物中心', silhouette: 'three sawtooth roof bays above a low brick arcade and projecting glass entrance' },
  { k: 86, id: 'stone-bank', name: '銀行', silhouette: 'stepped stone crown, detached four-pier pedimented portico and low side pavilions' },
  { k: 91, id: 'timber-trading-sheds', name: '貿易站', silhouette: 'two unequal open timber trading sheds with offset pitched roofs and a broad counter' },
  { k: 98, id: 'warehouse-hostel', name: '青年旅舍', silhouette: 'offset red-brick warehouse wings with unequal pitched roofs and one tall chimney' },
  { k: 99, id: 'country-wedding-chapel', name: '婚禮教堂', silhouette: 'steep stone nave, offset bell tower, projecting porch and small side chapel' },
  { k: 57, id: 'brick-food-works', name: '食品加工廠', silhouette: 'four-tooth brick production hall, three capped silos and separate chimney boiler house' },
  { k: 64, id: 'victorian-dock-warehouse', name: '倉儲物流中心', silhouette: 'paired pitched brick warehouses, elevated connecting bridge and freestanding cargo gantry' },
  { k: 110, id: 'railway-goods-shed', name: '貨運站', silhouette: 'long gabled railway goods shed and a separate ridge-supported loading canopy' },
  { k: 167, id: 'stepped-distribution-yard', name: '大型配送中心', silhouette: 'broad flat logistics hall with a raised roof tier, low front office and three loading bays' },
  { k: 168, id: 'twin-cold-store', name: '冷鏈倉儲', silhouette: 'separate insulated storage halls with rooftop refrigerator units and a low front office' },
] as const;
export const FACILITY_KINDS: ReadonlySet<number> = new Set(FACILITY_BUILDINGS.map(b => b.k));
