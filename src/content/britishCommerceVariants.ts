// D069: ten original alternate structures on existing saved v1 slots. Rendering only;
// these descriptors do not add construction tools or alter the existing v0 models.
export const VARIANT_BUILDINGS = [
  { k: 65, v: 1, id: 'covered-shopping-arcade', name: '大型購物中心', silhouette: 'unequal flat-roofed shop wings flank an open through-passage beneath a raised glazed ridge' },
  { k: 86, v: 1, id: 'interwar-banking-hall', name: '銀行', silhouette: 'broad hipped banking hall with a semicircular entrance apse, curved stairs and two recessed low wings' },
  { k: 91, v: 1, id: 'bonded-trading-exchange', name: '貿易站', silhouette: 'tall central pitched exchange hall between two independently roofed open loading aisles' },
  { k: 98, v: 1, id: 'terraced-hillside-hostel', name: '青年旅舍', silhouette: 'three connected accommodation sections step forwards and down under sloping roofs around a recessed entrance' },
  { k: 99, v: 1, id: 'arts-and-crafts-wedding-chapel', name: '婚禮教堂', silhouette: 'broad asymmetric chapel roof, transverse entry porch and detached short open square bellcote' },
  { k: 57, v: 1, id: 'milling-and-packing-works', name: '食品加工廠', silhouette: 'square milling tower over a long packing hall with an elevated elbow conveyor to two grain bins' },
  { k: 64, v: 1, id: 'bonded-courtyard-warehouse', name: '倉儲物流中心', silhouette: 'four linked pitched storage ranges enclose an open loading courtyard entered through a real arched passage' },
  { k: 110, v: 1, id: 'through-rail-goods-shed', name: '貨運站', silhouette: 'open-ended shallow barrel-roofed goods hall spans through rails beside a raised internal loading terrace' },
  { k: 167, v: 1, id: 'cross-dock-distribution-hub', name: '大型配送中心', silhouette: 'T-shaped loading hall with opposing end docks and a slim elevated dispatch office at the junction' },
  { k: 168, v: 1, id: 'high-bay-refrigerated-store', name: '冷鏈倉儲', silhouette: 'single tall insulated chamber joins a transverse low loading hall beneath an open rooftop refrigeration gantry' },
] as const;
export const VARIANT_KINDS: ReadonlySet<number> = new Set(VARIANT_BUILDINGS.map(b => b.k));
