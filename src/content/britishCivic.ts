// D056 original procedural British civic art. Existing kinds and gameplay remain unchanged.
export const BRITISH_CIVIC = [
  { k: 6, id: 'fire-station', name: 'Victorian fire station', silhouette: 'off-centre hose tower and twin engine bays' },
  { k: 7, id: 'village-school', name: 'Arts-and-Crafts school', silhouette: 'three crossed gables and a bellcote' },
  { k: 14, id: 'public-library', name: 'Lantern-roof library', silhouette: 'hipped reading room, glazed lantern and entrance pediment' },
  { k: 15, id: 'post-office', name: 'Edwardian post office', silhouette: 'L-shaped counter hall and corner clock turret' },
  { k: 17, id: 'railway-station', name: 'Country railway station', silhouette: 'linear platform canopy, signal cabin and chimney pair' },
  { k: 42, id: 'town-hall', name: 'Victorian town hall', silhouette: 'central clock tower, steep pyramidal crown and paired wings' },
  { k: 43, id: 'courthouse', name: 'Georgian courthouse', silhouette: 'broad pediment, detached column portico and raised steps' },
  { k: 87, id: 'market-hall', name: 'Timber market hall', silhouette: 'open arcades under three pitched roofs with a central clerestory' },
] as const;
export const BRITISH_KINDS = new Set<number>(BRITISH_CIVIC.map(x => x.k));
export const BRITISH_PALETTE = {
  brick: '#a05e49', stone: '#ded1b5', slate: '#485662', timber: '#574537',
  green: '#31564c', glass: '#668792', dark: '#26383d', gold: '#b99551', red: '#ad4037',
} as const;
