// D071: ten original education/research structures on exact existing saved slots.
// Rendering descriptors only: no kind IDs, tools, footprint, height or save changes.
export const EDUCATION_BUILDINGS = [
  { k: 32, v: 0, id: 'collegiate-gatehouse-university', name: '大學', silhouette: 'four stone ranges surround an uncovered quadrangle, with a raised gabled gatehouse above a real through-passage' },
  { k: 32, v: 1, id: 'redbrick-lecture-university', name: '大學', silhouette: 'long gabled teaching range joins two unequal perpendicular lecture wings and a recessed low entrance pavilion' },
  { k: 32, v: 2, id: 'modernist-library-campus', name: '大學', silhouette: 'thin tall library slab on a broad plinth, pentagonal lecture theatre and low rear link around an open arrival court' },
  { k: 45, v: 0, id: 'wedge-plan-research-institute', name: '研究院', silhouette: 'trapezoid laboratory widens toward its high entrance beneath a single rising mono-pitch roof' },
  { k: 45, v: 1, id: 'tapered-laboratory-tower', name: '研究院', silhouette: 'four inward-sloping laboratory walls rise above a broad shallow square plinth to a genuinely recessed four-facet roof' },
  { k: 45, v: 2, id: 'triangular-research-pavilion', name: '研究院', silhouette: 'triangular research hall has two folded roof planes meeting a rising central ridge and a small triangular entrance canopy' },
  { k: 108, v: 0, id: 'grammar-school-quadrangle', name: '高中', silhouette: 'long entrance hall and two parallel classroom wings frame a quadrangle beside a detached high-ridged gymnasium' },
  { k: 108, v: 1, id: 'interwar-secondary-school', name: '高中', silhouette: 'tall pitched assembly hall joins three staggered flat teaching bars through two narrow recessed links' },
  { k: 108, v: 2, id: 'comprehensive-school-cluster', name: '高中', silhouette: 'three short teaching pavilions have unequal ridges on perpendicular axes around a low central glazed concourse' },
  { k: 109, v: 0, id: 'twin-laboratory-technology-park', name: '科技園區', silhouette: 'two unequal narrow mono-pitched laboratory slabs flank a real open gap, joined only by a low rear entrance bar' },
] as const;

export const EDUCATION_KINDS: ReadonlySet<number> = new Set(EDUCATION_BUILDINGS.map(b => b.k));
