// D057: simplified, parcel-scaled studies of real surviving British exteriors.
// These labels identify the art reference, not new gameplay kinds or present-day uses.
export const BRITISH_HERITAGE = [
  { k: 5, id: 'battersea', name: 'Battersea Power Station', location: 'London', silhouette: 'four ivory chimneys and stepped brick turbine halls', native: true },
  { k: 10, id: 'jumbo', name: 'Jumbo Water Tower', location: 'Colchester', silhouette: 'open red-brick arches supporting a square tank and copper cupola', native: true },
  { k: 35, id: 'natural-history', name: 'Natural History Museum', location: 'South Kensington, London', silhouette: 'paired Romanesque towers and banded terracotta wings', native: false },
  { k: 36, id: 'royal-albert', name: 'Royal Albert Hall', location: 'South Kensington, London', silhouette: 'elliptical brick auditorium and low glazed dome', native: false },
  { k: 41, id: 'radcliffe', name: 'Radcliffe Camera', location: 'Oxford', silhouette: 'circular limestone library, drum colonnade and lead dome', native: false },
  { k: 63, id: 'palm-house', name: 'Palm House', location: 'Royal Botanic Gardens, Kew, London', silhouette: 'curved iron-and-glass nave with lower wings', native: true },
  { k: 67, id: 'elizabeth', name: 'Elizabeth Tower', location: 'Palace of Westminster, London', silhouette: 'four blue-and-gold clocks, Gothic pinnacles and tall spire', native: false },
  { k: 69, id: 'smeaton', name: "Smeaton's Tower", location: 'Plymouth Hoe', silhouette: 'tapered red-and-white shaft and octagonal lantern', native: false },
] as const;
export const BRITISH_HERITAGE_KINDS = new Set<number>(BRITISH_HERITAGE.map(x => x.k));
