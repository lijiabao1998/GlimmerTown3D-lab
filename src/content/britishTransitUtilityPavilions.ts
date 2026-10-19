// D079: original British transit and utility pavilions on existing saved slots.
// Descriptors only: native tools, IDs, parcels, heights and simulation are unchanged.
export const TRANSIT_UTILITY_PAVILION_BUILDINGS = [
  { k: 21, v: 0, id: 'unequal-m-roof-tram-hall', name: '電車站', silhouette: 'unequal twin gables and a low attached rectangular dispatch office' },
  { k: 21, v: 1, id: 'splayed-tram-terminus-pavilion', name: '電車站', silhouette: 'splayed walls under two planar roof slopes meet a triangular dispatch room' },
  { k: 21, v: 2, id: 'detached-tram-dispatch-and-waiting-houses', name: '電車站', silhouette: 'a long gabled dispatch house stands apart from a lower fully hipped waiting house' },
  { k: 29, v: 0, id: 'twin-ridge-recycling-sorting-house', name: '回收中心', silhouette: 'a low municipal sorting house has two unequal ridges and a complete valley' },
  { k: 29, v: 1, id: 'saltbox-recycling-lodge', name: '回收中心', silhouette: 'an offset saltbox ridge meets a lower rectangular intake room' },
  { k: 29, v: 2, id: 'canted-end-recycling-transfer-hall', name: '回收中心', silhouette: 'six canted perimeter walls support eight triangular roof facets and a sloping ridge' },
  { k: 29, v: 3, id: 'hipped-municipal-sorting-house', name: '回收中心', silhouette: 'a complete hipped municipal hall meets a low triangular intake room' },
  { k: 37, v: 0, id: 'faceted-barrel-aquarium', name: '水族館', silhouette: 'five longitudinal roof facets form a closed barrel hall with complete end walls' },
  { k: 37, v: 1, id: 'kite-plan-marine-pavilion-and-ticket-house', name: '水族館', silhouette: 'a skew kite-plan faceted hall stands apart from a triangular ticket house' },
  { k: 37, v: 2, id: 'clerestory-coastal-aquarium', name: '水族館', silhouette: 'a continuous stepped roof has two real vertical clerestory walls and complete concave ends' },
] as const;
export const TRANSIT_UTILITY_PAVILION_KINDS: ReadonlySet<number> = new Set(TRANSIT_UTILITY_PAVILION_BUILDINGS.map(b => b.k));
