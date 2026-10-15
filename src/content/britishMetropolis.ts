// D066: existing large-city kinds, original procedural designs; no simulation or save changes.
export const METROPOLIS_BUILDINGS = [
  { k: 55, id: 'central-station', name: '中央車站', silhouette: 'clock-front terminus with twin train sheds' },
  { k: 139, id: 'high-speed-station', name: '高速鐵路車站', silhouette: 'folded canopies above a long glazed concourse' },
  { k: 166, id: 'intermodal-terminal', name: '鐵公路聯運中心', silhouette: 'rail-spanning gantry beside freight stacks' },
  { k: 165, id: 'container-logistics', name: '貨櫃物流中心', silhouette: 'paired pitched warehouses and loading court' },
  { k: 123, id: 'shipyard', name: '造船廠', silhouette: 'pointed ship in a dry dock beneath a tall crane' },
  { k: 174, id: 'container-port', name: '大型貨櫃碼頭', silhouette: 'two waterside cranes and stepped container rows' },
  { k: 135, id: 'medical-centre', name: '大型醫學中心', silhouette: 'tall ward slab joined to three low clinical wings' },
  { k: 136, id: 'arts-centre', name: '文化藝術中心', silhouette: 'stepped performance hall, glazed foyer and tall gallery' },
] as const;
export const METROPOLIS_KINDS: ReadonlySet<number> = new Set(METROPOLIS_BUILDINGS.map(b => b.k));
