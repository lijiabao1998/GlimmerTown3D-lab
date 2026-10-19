// D078: ten original British neighbourhood buildings on existing saved slots.
// Descriptors only; IDs, native tools, inherited heights, parcels and saves stay unchanged.
export const NEIGHBOURHOOD_PAVILION_BUILDINGS = [
  { k: 81, v: 2, id: 'hipped-coaching-guesthouse', name: '民宿', silhouette: 'a rectangular coaching guesthouse has two complete hipped roof ends and sash-like windows' },
  { k: 84, v: 0, id: 'butterfly-roof-nursery', name: '幼兒園', silhouette: 'two inward-sloping roofs meet a central valley above complete concave end walls' },
  { k: 84, v: 1, id: 'five-sided-nursery-pavilion', name: '幼兒園', silhouette: 'five unequal perimeter walls carry five roof facets meeting at an interior apex' },
  { k: 84, v: 2, id: 'chamfered-nursery-hall', name: '幼兒園', silhouette: 'a six-sided clipped footprint carries a complete planar mono-pitch roof' },
  { k: 85, v: 0, id: 'triangular-garden-day-pavilion', name: '樂齡中心', silhouette: 'a triangular garden pavilion has three arched facades and three apex roof facets' },
  { k: 85, v: 1, id: 'chamfered-day-centre-lodge', name: '樂齡中心', silhouette: 'a five-sided day lodge has a full flat roof and a chamfered entrance face' },
  { k: 85, v: 2, id: 'a-frame-garden-hall', name: '樂齡中心', silhouette: 'a closed A-frame hall meets a lower enclosed triangular vestibule beneath its full front gable' },
  { k: 130, v: 0, id: 't-plan-valve-house', name: '抽水站', silhouette: 'a low T-plan flat-roof valve house stands apart from a square pyramidal inspection pavilion' },
  { k: 130, v: 1, id: 'cruciform-pumping-engine-hall', name: '抽水站', silhouette: 'a tall longitudinal gabled engine hall meets two low transverse gabled ranges beside a separate square stack' },
  { k: 130, v: 2, id: 'split-pavilion-pumping-station', name: '抽水站', silhouette: 'two detached full-hip pumping houses face an octagonal flat-topped tower across generous open gaps' },
] as const;

export const NEIGHBOURHOOD_PAVILION_KINDS: ReadonlySet<number> = new Set(NEIGHBOURHOOD_PAVILION_BUILDINGS.map(b => b.k));
