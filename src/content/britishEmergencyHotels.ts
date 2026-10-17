// D073: ten original structures on exact existing numeric save/import slots.
// Descriptors only: kind IDs, construction tools, parcels, heights and simulation stay unchanged.
export const EMERGENCY_HOTEL_BUILDINGS = [
  { k: 31, v: 2, id: 'parallel-wing-prison-campus', name: '監獄', silhouette: 'two long pitched cell bars and a short service block join a cross-corridor behind a separate perimeter gatehouse' },
  { k: 61, v: 0, id: 'metropolitan-fire-headquarters', name: '消防總局', silhouette: 'a long pitched appliance-bay hall joins an off-centre hose tower and lower administrative wing around a turning court' },
  { k: 61, v: 1, id: 'courtyard-fire-command-station', name: '消防總局', silhouette: 'opposing pitched vehicle halls and a rear command block surround an open drill yard with a narrow corner training tower' },
  { k: 61, v: 2, id: 'modern-fire-operations-complex', name: '消防總局', silhouette: 'a twin-fold garage roof sits below a stepped command block beside a separate flat-roof workshop' },
  { k: 82, v: 0, id: 'l-plan-station-hotel', name: '商務旅館', silhouette: 'one joined L-shaped hotel has a re-entrant entrance court and continuous pale flat roof edge' },
  { k: 82, v: 1, id: 'stepped-business-hotel', name: '商務旅館', silhouette: 'a broad lower hotel volume supports a shorter offset upper section beside a real open roof terrace' },
  { k: 82, v: 2, id: 'v-plan-urban-hotel', name: '商務旅館', silhouette: 'two joined tapered accommodation wings form a shallow V around an open arrival notch' },
  { k: 83, v: 0, id: 'seaside-terrace-resort', name: '度假酒店', silhouette: 'a compact seaside hotel steps asymmetrically back through three unequal roof terraces ahead of the preserved tree strip' },
  { k: 83, v: 1, id: 'courtyard-spa-resort', name: '度假酒店', silhouette: 'a low asymmetric U-shaped guest block encloses an open pool court beside a taller corner suite block' },
  { k: 83, v: 2, id: 'twin-lodge-holiday-hotel', name: '度假酒店', silhouette: 'two offset pitched A-frame guest ranges join a low dining pavilion in front of the preserved rear tree row' },
] as const;

export const EMERGENCY_HOTEL_KINDS: ReadonlySet<number> = new Set(EMERGENCY_HOTEL_BUILDINGS.map(b => b.k));
