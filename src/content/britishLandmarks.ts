// D067: eight existing metropolitan facilities; original geometry, no simulation or save changes.
export const LANDMARK_BUILDINGS = [
  { k: 19, id: 'regional-airport', name: '機場', silhouette: 'brick terminal, octagonal control lantern and narrow runway' },
  { k: 114, id: 'international-airport', name: '國際機場', silhouette: 'folded terminal roof, three boarding piers and separate control tower' },
  { k: 44, id: 'exhibition-centre', name: '會展中心', silhouette: 'high vaulted exhibition hall between two pitched pavilions' },
  { k: 56, id: 'sports-park', name: '體育園區', silhouette: 'open terraced football ground beside a steep-roofed sports hall' },
  { k: 113, id: 'university-quarter', name: '大學城', silhouette: 'stone-and-brick collegiate quadrangle with an open gate tower' },
  { k: 138, id: 'research-park', name: '科技研究園區', silhouette: 'stepped laboratories, rooftop dish, observatory and glazed bridge' },
  { k: 137, id: 'administrative-quarter', name: '中央行政園區', silhouette: 'faceted assembly chamber, stone wings and formal colonnaded forecourt' },
  { k: 116, id: 'data-centre', name: '數據中心', silhouette: 'paired machine halls with roof fans and a separate low entrance' },
] as const;
export const LANDMARK_KINDS: ReadonlySet<number> = new Set(LANDMARK_BUILDINGS.map(b => b.k));
