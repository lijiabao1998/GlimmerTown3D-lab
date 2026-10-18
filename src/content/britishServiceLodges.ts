// D077: ten British service buildings and guesthouses on exact saved slots.
// Descriptors only: original IDs, parcels, heights, construction and saves are unchanged.
export const SERVICE_LODGE_BUILDINGS = [
  { k: 164, v: 0, id: 'edwardian-utility-headhouse', name: '共同管道入口', silhouette: 'a long steep-gabled access house stands beside a separate square ventilation tower' },
  { k: 164, v: 1, id: 'courtyard-conduit-lodge', name: '共同管道入口', silhouette: 'a closed L-plan service range encloses a forecourt beside a pyramidal ventilation pavilion' },
  { k: 164, v: 2, id: 'lantern-access-pavilion', name: '共同管道入口', silhouette: 'four sloping roof surfaces surround a raised glazed lantern in a real central opening' },
  { k: 119, v: 0, id: 'municipal-cookhouse', name: '中央廚房', silhouette: 'two unequal mono-pitch cooking halls frame a working yard beside a square brick chimney' },
  { k: 119, v: 1, id: 'gabled-production-kitchen', name: '中央廚房', silhouette: 'a longitudinal gabled kitchen meets a lower sloping loading range beside an offset chimney' },
  { k: 119, v: 2, id: 'pyramidal-service-kitchen', name: '中央廚房', silhouette: 'a pyramidal cooking house adjoins a long flat preparation range and separate slender chimney' },
  { k: 116, v: 0, id: 'low-profile-exchange-data-centre', name: '數據中心', silhouette: 'a very low L-plan machine house faces a lower sloping equipment wing across a recessed court' },
  { k: 149, v: 4, id: 'octagonal-dispatch-office', name: '電網調度中心', silhouette: 'a flat-roof octagonal control hall meets a low triangular entrance wing' },
  { k: 81, v: 0, id: 'clipped-end-guesthouse', name: '民宿', silhouette: 'a complete longhouse has one fully hipped roof end and one vertical gable' },
  { k: 81, v: 1, id: 'oblique-gabled-guesthouse', name: '民宿', silhouette: 'an oblique parallelogram house has two full gables and two planar slate roof slopes' },
] as const;

export const SERVICE_LODGE_KINDS: ReadonlySet<number> = new Set(SERVICE_LODGE_BUILDINGS.map(b => b.k));
