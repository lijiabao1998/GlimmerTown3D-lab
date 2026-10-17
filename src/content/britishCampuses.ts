// D072: ten original campuses on exact existing numeric save/import slots.
// Descriptors only; all kind IDs, parcels, heights and simulation records stay unchanged.
export const CAMPUS_BUILDINGS = [
  { k: 109, v: 1, id: 'folded-roof-innovation-workshops', name: '科技園區', silhouette: 'an L-shaped workshop has a folded three-ridge roof beside an offset rectangular demonstration hall' },
  { k: 109, v: 2, id: 'stepped-research-incubator', name: '科技園區', silhouette: 'two unequal research tower steps adjoin a broad low incubator, forming a deep open corner cutout' },
  { k: 48, v: 0, id: 'parallel-pavilion-hospital', name: '綜合醫院', silhouette: 'three parallel pitched ward bars join a transverse administration spine around two long open courtyards' },
  { k: 48, v: 1, id: 'district-courtyard-hospital', name: '綜合醫院', silhouette: 'four unequal hospital wings frame an open-sided arrival court with a projecting emergency canopy' },
  { k: 48, v: 2, id: 'ward-tower-clinic-campus', name: '綜合醫院', silhouette: 'a narrow tall ward slab ends a stepped outpatient range beside a separate pitched emergency pavilion' },
  { k: 115, v: 0, id: 'faceted-civic-assembly', name: '市民中心', silhouette: 'an octagonal assembly rotunda and roof lantern rise between two angled wings behind a columned public portico' },
  { k: 115, v: 1, id: 'interwar-civic-forum', name: '市民中心', silhouette: 'a transverse pitched meeting hall projects through a U-shaped office range above a low front portico and two side courts' },
  { k: 115, v: 2, id: 'neighbourhood-public-halls', name: '市民中心', silhouette: 'three unequal pitched public halls join through low glazed links around a recessed entrance court' },
  { k: 31, v: 0, id: 'low-secure-courtyard-compound', name: '監獄', silhouette: 'three broad low cell ranges and two short links define two open secure courts within a thin low perimeter' },
  { k: 31, v: 1, id: 'radial-victorian-prison', name: '監獄', silhouette: 'four unequal diagonal cell wings radiate from an octagonal hub within a rectangular secure perimeter' },
] as const;

export const CAMPUS_KINDS: ReadonlySet<number> = new Set(CAMPUS_BUILDINGS.map(b => b.k));
