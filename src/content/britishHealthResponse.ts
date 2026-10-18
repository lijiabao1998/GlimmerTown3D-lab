// D075: ten original British health, emergency and remembrance structures on saved slots.
// Descriptors only: existing IDs, tools, parcel sizes, heights and simulation are unchanged.
export const HEALTH_RESPONSE_BUILDINGS = [
  { k: 135, v: 0, id: 'pavilion-medical-centre', name: '大型醫學中心', silhouette: 'a high transverse entrance hall and two unequal pitched ward wings enclose a generous arrival court' },
  { k: 135, v: 1, id: 'radial-hospital-campus', name: '大型醫學中心', silhouette: 'a hexagonal central hall joins three unequal ward fingers with horizontal, diagonal and longitudinal ridges' },
  { k: 135, v: 2, id: 'stepped-medical-institute', name: '大型醫學中心', silhouette: 'a narrow stepped clinical slab rises behind twin folded outpatient roofs and a separate sloping service wing' },
  { k: 131, v: 0, id: 'civic-emergency-control-hall', name: '防災中心', silhouette: 'a broad hipped dispatch hall adjoins a square observation tower and lower sloping vehicle wing' },
  { k: 131, v: 1, id: 'gabled-rescue-headquarters', name: '防災中心', silhouette: 'a steep longitudinal command hall links to a lower transverse apparatus range beside a recessed yard' },
  { k: 131, v: 2, id: 'modern-response-centre', name: '防災中心', silhouette: 'two staggered flat-roof control blocks stand beside a sloping operations shed and slender communications pier' },
  { k: 107, v: 0, id: 'garden-crematorium', name: '火葬場', silhouette: 'a long low pitched chapel stands beside an offset square chimney and a separate shallow-roof porch' },
  { k: 107, v: 1, id: 'courtyard-remembrance-hall', name: '火葬場', silhouette: 'perpendicular unequal hipped ranges flank an open remembrance court with a chimney behind their junction' },
  { k: 107, v: 2, id: 'lantern-memorial-hall', name: '火葬場', silhouette: 'a five-sided chapel roof rises around a square clerestory lantern beside a narrow service wing and thin chimney' },
  { k: 28, v: 0, id: 'county-ambulance-station', name: '救護站', silhouette: 'a steep-gabled crew house adjoins a broad lower twin-bay garage behind a parked ambulance and recessed arrival court' },
] as const;

export const HEALTH_RESPONSE_KINDS: ReadonlySet<number> = new Set(HEALTH_RESPONSE_BUILDINGS.map(b => b.k));
