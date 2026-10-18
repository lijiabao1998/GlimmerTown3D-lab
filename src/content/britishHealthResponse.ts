// D076: ten original British health, remembrance and grid-dispatch structures on saved slots.
// Descriptors only: existing IDs, tools, parcel sizes, heights and simulation are unchanged.
export const HEALTH_RESPONSE_BUILDINGS = [
  { k: 131, v: 0, id: 'civic-emergency-control-hall', name: '防災中心', silhouette: 'a broad hipped dispatch hall adjoins a square observation tower and lower sloping vehicle wing' },
  { k: 131, v: 1, id: 'gabled-rescue-headquarters', name: '防災中心', silhouette: 'a steep longitudinal command hall links to a lower transverse apparatus range beside a recessed yard' },
  { k: 131, v: 2, id: 'modern-response-centre', name: '防災中心', silhouette: 'two staggered flat-roof control blocks stand beside a sloping operations shed and slender communications pier' },
  { k: 107, v: 0, id: 'garden-crematorium', name: '火葬場', silhouette: 'a long low pitched chapel stands beside an offset square chimney and a separate shallow-roof porch' },
  { k: 107, v: 1, id: 'courtyard-remembrance-hall', name: '火葬場', silhouette: 'perpendicular unequal hipped ranges flank an open remembrance court with a chimney behind their junction' },
  { k: 107, v: 2, id: 'lantern-memorial-hall', name: '火葬場', silhouette: 'a five-sided chapel roof rises around a square clerestory lantern beside a narrow service wing and thin chimney' },
  { k: 149, v: 0, id: 'county-dispatch-office', name: '電網調度中心', silhouette: 'a steep longitudinal gabled dispatch hall adjoins a lower flat-roof service annex' },
  { k: 149, v: 1, id: 'courtyard-network-office', name: '電網調度中心', silhouette: 'two perpendicular unequal pitched ranges enclose an open working courtyard' },
  { k: 149, v: 2, id: 'radial-control-hall', name: '電網調度中心', silhouette: 'a six-sided dispatch hall rises to a central roof apex behind a low rectangular entrance annex' },
  { k: 149, v: 3, id: 'stepped-operations-house', name: '電網調度中心', silhouette: 'three offset closed blocks descend from a tall control house to a broad operations wing and lower green-fronted entrance' },
] as const;

export const HEALTH_RESPONSE_KINDS: ReadonlySet<number> = new Set(HEALTH_RESPONSE_BUILDINGS.map(b => b.k));
