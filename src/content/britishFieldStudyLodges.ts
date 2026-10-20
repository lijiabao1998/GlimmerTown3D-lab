// D081: original field-study, camp and remembrance buildings on exact saved slots.
// Art only: no native tools, identifiers, parcel or simulation changes.
export const FIELD_STUDY_LODGES = [
  { k: 160, v: 0, id: 'wetland-visitor-and-learning-lodges', name: '濕地公園', silhouette: 'an asymmetric gabled visitor lodge stands apart from a fully hipped learning room' },
  { k: 160, v: 1, id: 'octagonal-classroom-and-specimen-store', name: '濕地公園', silhouette: 'an octagonal pyramidal classroom and detached monopitch specimen store' },
  { k: 160, v: 2, id: 'cranked-field-laboratory-and-workshop', name: '濕地公園', silhouette: 'a genuinely cranked raked-roof laboratory beside a gabled workshop' },
  { k: 160, v: 3, id: 'double-gabled-reedland-centre-and-office', name: '濕地公園', silhouette: 'unequal adjoining gables and a detached six-sided flat-roof office' },
  { k: 160, v: 4, id: 'cruciform-observation-lodge-and-boathouse', name: '濕地公園', silhouette: 'a cruciform radial-roof lodge and separate triangular sloping-roof boathouse' },
  { k: 182, v: 0, id: 'clerestory-camp-amenity-hall', name: '露營地', silhouette: 'three complete inclined roof planes separated by two elevated clerestory walls' },
  { k: 182, v: 1, id: 'hipped-campwarden-house-and-washhouse', name: '露營地', silhouette: 'a long fully hipped house and detached triangular washhouse' },
  { k: 182, v: 2, id: 'canted-camp-kitchen-and-pyramidal-store', name: '露營地', silhouette: 'a canted six-facet kitchen roof with unequal ridge ends and pyramidal store' },
  { k: 72, v: 1, id: 'pentagonal-ridge-remembrance-chapel', name: '紀念碑', silhouette: 'five unequal facades and three roof planes meet at an offset high corner' },
  { k: 72, v: 2, id: 'notched-monopitch-vigil-house', name: '紀念碑', silhouette: 'a complete sloping roof retains a real rear notch in the enclosed vigil house' },
] as const;
export const FIELD_STUDY_KINDS: ReadonlySet<number> = new Set(FIELD_STUDY_LODGES.map(b => b.k));
