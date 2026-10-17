// D074: ten original British farm, memorial and botanical structures on exact saved slots.
// Descriptors only: existing kind IDs, tools, parcel sizes, heights and simulation stay unchanged.
export const FARM_MEMORIAL_BUILDINGS = [
  { k: 23, v: 0, id: 'courtyard-cattle-farm', name: '牧場', silhouette: 'a cattle barn, short feed house and open-front byre enclose three sides of a working yard above a fenced pasture' },
  { k: 23, v: 1, id: 'aisled-livestock-barn', name: '牧場', silhouette: 'a high central livestock barn has two lower lean-to aisles beside a separate feed store and pasture' },
  { k: 23, v: 2, id: 'linear-dairy-stead', name: '牧場', silhouette: 'a tall milking hall and lower cattle shed face across a service lane with a square milk-room projection' },
  { k: 23, v: 3, id: 'cross-gabled-stock-farm', name: '牧場', silhouette: 'perpendicular livestock barns cross at a yard corner beside a separate open-front shelter and pasture' },
  { k: 23, v: 4, id: 'modern-livestock-courts', name: '牧場', silhouette: 'opposing mono-pitch sheds join a higher narrow feed-processing hall around an open exercise yard' },
  { k: 54, v: 0, id: 'cemetery-twin-chapels', name: '大墓園', silhouette: 'two unequal steep-roofed chapels flank a low connecting gate arch before grave rows and five preserved trees' },
  { k: 54, v: 1, id: 'cemetery-cloister-hall', name: '大墓園', silhouette: 'a long chapel and a short pitched return colonnade define an open remembrance court with graves' },
  { k: 54, v: 2, id: 'low-memorial-chapel', name: '大墓園', silhouette: 'a very low cruciform chapel has intersecting roof ridges and a recessed open-front porch beside grave rows' },
  { k: 47, v: 0, id: 'palm-court-conservatory', name: '植物園', silhouette: 'a tall narrow glazed nave joins two unequal polygonal side houses beside planting beds within the original tree ring' },
  { k: 47, v: 1, id: 'alpine-glasshouse-gardens', name: '植物園', silhouette: 'three stepped mono-pitch glasshouses make a broken zigzag beside alpine planting beds and the original four trees' },
] as const;

export const FARM_MEMORIAL_KINDS: ReadonlySet<number> = new Set(FARM_MEMORIAL_BUILDINGS.map(b => b.k));
