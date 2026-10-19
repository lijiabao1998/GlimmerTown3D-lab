// D080: original community, estate and fishery architecture on exact saved slots.
// This art registry does not add native tools, IDs, parcels or simulation content.
export const COMMUNITY_BUILDINGS = [
  { k: 21, v: 3, id: 'z-plan-tram-terminus-hall', name: '電車站', silhouette: 'an eight-sided cranked hall has a complete raked roof and two real exterior notches' },
  { k: 21, v: 4, id: 'y-plan-tram-waiting-pavilion', name: '電車站', silhouette: 'three enclosed arms meet beneath nine complete radial roof facets' },
  { k: 29, v: 4, id: 'notched-municipal-sorting-lodge', name: '回收中心', silhouette: 'a re-entrant five-sided sorting hall meets a lower rectangular intake room' },
  { k: 127, v: 0, id: 'cranked-council-housing-slab', name: '社會住宅', silhouette: 'a tall concave four-sided estate slab retains its open exterior notch beneath a flat roof' },
  { k: 127, v: 1, id: 'kite-plan-council-point-block', name: '社會住宅', silhouette: 'a skew-kite point block carries two noncoplanar roof planes along a descending convex ridge' },
  { k: 127, v: 2, id: 'diagonal-valley-council-housing', name: '社會住宅', silhouette: 'an irregular quadrilateral estate block has two roof planes folding into a diagonal concave valley' },
  { k: 120, v: 0, id: 're-entrant-fishery-keeper-lodge', name: '魚塘', silhouette: 'a complete five-sided keeper lodge has a genuine rear notch beside two ground-level ponds' },
  { k: 120, v: 1, id: 'paired-fishery-keeper-rooms', name: '魚塘', silhouette: 'two detached triangular keeper rooms have unequal complete mono-pitch roofs' },
  { k: 120, v: 2, id: 'chamfered-folded-fishery-store', name: '魚塘', silhouette: 'a five-sided canted store has three noncoplanar roof facets rising to a high boundary point' },
  { k: 72, v: 0, id: 'remembrance-hall-and-vigil-pavilion', name: '紀念碑', silhouette: 'an enclosed triangular remembrance hall and a detached lower triangular vigil room have different complete roofs' },
] as const;
export const COMMUNITY_KINDS: ReadonlySet<number> = new Set(COMMUNITY_BUILDINGS.map(b => b.k));
