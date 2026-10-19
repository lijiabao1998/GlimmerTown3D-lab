// D078 actual production WebGL pairs. Never substitute manufactured cities or pictures.
// Three original cities × native and render-only copied supported v0/v1/v2 × three viewports.
// All ten slots are saved/import-only; native labels refer to unmodified original saved-city records.
// --plan-only validates the plan in Node and never launches a browser.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {D057_SAME} from './d057-native.mjs';
import {pathToFileURL} from 'node:url';
import {NEIGHBOURHOOD_PAVILION_BUILDINGS,NEIGHBOURHOOD_PAVILION_KINDS} from '../src/content/britishNeighbourhoodPavilions.ts';
import {D078_OLD,d078City,d078Expected} from './unit-d078.mjs';
import {createD078FrameOracle,assertD078Frame,assertD078NeighbourhoodPavilionCamera,assertD078PausedRepeat,assertD078RoofCoverage,assertD078SurfaceCoverage,assertD078OwnerFits,D078_FRAME_WHOLE,assertD078ConstructionDiagnostic,D078_CAMERA_DETAIL_CARD_SHA256} from './d078-frame.mjs';
import {D067_UPLOAD_PROBE} from './d067-diagnose.mjs';

const J=JSON.stringify,sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:J(x)).digest('hex');
const freezeCapture=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freezeCapture(v);Object.freeze(value);}return value;};
const OUT=path.join(ROOT,'scratch/d078'),PORT=+(process.env.GT_PORT??8380);
export const D078_VIEWPORTS=[{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}];
const WIDTHS=(process.env.D078_WIDTHS??'').split(',').map(w=>w.trim()).filter(Boolean).map(Number);
for(const w of WIDTHS)assert.ok(D078_VIEWPORTS.some(v=>v.W===w),'recognized viewport '+w);
const viewports=D078_VIEWPORTS.filter(v=>!WIDTHS.length||WIDTHS.includes(v.W));assert.ok(viewports.length,'at least one supported viewport');
// Ten exact saved/import kind/variant slots, with actual native tool access qualified below.
export const D078_SLOTS=Object.freeze([
 {
  "k": 81,
  "v": 2,
  "name": "Hipped coaching guesthouse"
 },
 {
  "k": 84,
  "v": 0,
  "name": "Butterfly-roof nursery"
 },
 {
  "k": 84,
  "v": 1,
  "name": "Pentagonal nursery pavilion"
 },
 {
  "k": 84,
  "v": 2,
  "name": "Chamfered nursery hall"
 },
 {
  "k": 85,
  "v": 0,
  "name": "Triangular garden day pavilion"
 },
 {
  "k": 85,
  "v": 1,
  "name": "Chamfered day-centre lodge"
 },
 {
  "k": 85,
  "v": 2,
  "name": "A-frame garden hall"
 },
 {
  "k": 130,
  "v": 0,
  "name": "Low-profile valve house \u00b7 inherited effective H=0.12"
 },
 {
  "k": 130,
  "v": 1,
  "name": "Cruciform pumping-engine hall"
 },
 {
  "k": 130,
  "v": 2,
  "name": "Split-pavilion pumping station \u00b7 inherited H=0.34"
 }
].map(Object.freeze));
const KINDS=[81,84,85,130];
assert.deepEqual(NEIGHBOURHOOD_PAVILION_BUILDINGS.map(m=>[m.k,m.v]),D078_SLOTS.map(m=>[m.k,m.v]),'complete and ordered production ten-slot catalogue');
assert.deepEqual([...NEIGHBOURHOOD_PAVILION_KINDS],KINDS,'exactly four existing kinds implement ten supported slots');
const extra=(name,label,spinRadians,reason,tiltRadians=0,zoomByWidth={})=>Object.freeze({name,label,spinRadians,tiltRadians,reason,zoomByWidth:Object.freeze(zoomByWidth)});
// Frozen bounded 24-angle paired audit, using complete unchanged baseline/candidate scenes.
// Literal zooms fit all target-owner vertices in BOTH phases at the three declared widths.
export const D078_ALTERNATE_VIEWS=freezeCapture({
 "gallery:81:2": [
  {
   "name": "surface-01",
   "label": "yaw 270° / elevation 14.4°",
   "spinRadians": 4.71238898038469,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 90° / elevation 14.4°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "gallery:130:0": [
  {
   "name": "surface-01",
   "label": "yaw 180° / elevation 14.4°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 45° / elevation 14.4°",
   "spinRadians": 0.7853981633974483,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 225° / elevation 14.4°",
   "spinRadians": 3.9269908169872414,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-04",
   "label": "yaw 90° / elevation 14.400000000000002°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": -0.27227136331111534,
   "reason": "Candidate first-red mandatory samples are covered by this already-frozen legal angle; all initial failure records and all baseline views retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "gallery:130:1": [
  {
   "name": "surface-01",
   "label": "yaw 180° / elevation 57.6°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 45° / elevation 14.4°",
   "spinRadians": 0.7853981633974483,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 225° / elevation 14.4°",
   "spinRadians": 3.9269908169872414,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "gallery:130:2": [
  {
   "name": "surface-01",
   "label": "yaw 180° / elevation 30°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 45° / elevation 14.4°",
   "spinRadians": 0.7853981633974483,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 225° / elevation 14.4°",
   "spinRadians": 3.9269908169872414,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "gallery:84:0": [
  {
   "name": "surface-01",
   "label": "yaw 180° / elevation 14.4°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "ai120:84:0": [
  {
   "name": "surface-01",
   "label": "yaw 135° / elevation 30°",
   "spinRadians": 2.356194490192345,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 180° / elevation 14.4°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 0° / elevation 57.60000000000001°",
   "spinRadians": 0,
   "tiltRadians": 0.48171087355043507,
   "reason": "Candidate first-red mandatory samples are covered by this already-frozen legal angle; all initial failure records and all baseline views retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "gallery:84:1": [
  {
   "name": "surface-01",
   "label": "yaw 180° / elevation 14.4°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "ai120:84:1": [
  {
   "name": "surface-01",
   "label": "yaw 135° / elevation 14.4°",
   "spinRadians": 2.356194490192345,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 180° / elevation 14.4°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "gallery:84:2": [
  {
   "name": "surface-01",
   "label": "yaw 180° / elevation 14.4°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "ai120:84:2": [
  {
   "name": "surface-01",
   "label": "yaw 135° / elevation 30°",
   "spinRadians": 2.356194490192345,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 180° / elevation 14.4°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 315° / elevation 29.999999999999996°",
   "spinRadians": 5.497787143782138,
   "tiltRadians": 0,
   "reason": "Candidate first-red mandatory samples are covered by this already-frozen legal angle; all initial failure records and all baseline views retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "gallery:85:0": [
  {
   "name": "surface-01",
   "label": "yaw 90° / elevation 57.6°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 0° / elevation 57.6°",
   "spinRadians": 0,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 180° / elevation 14.4°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-04",
   "label": "yaw 45° / elevation 30°",
   "spinRadians": 0.7853981633974483,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-05",
   "label": "yaw 0° / elevation 14.4°",
   "spinRadians": 0,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "ai120:85:0": [
  {
   "name": "surface-01",
   "label": "yaw 90° / elevation 57.6°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 0° / elevation 57.6°",
   "spinRadians": 0,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 180° / elevation 30°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-04",
   "label": "yaw 45° / elevation 30°",
   "spinRadians": 0.7853981633974483,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-05",
   "label": "yaw 0° / elevation 14.4°",
   "spinRadians": 0,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "gallery:85:1": [
  {
   "name": "surface-01",
   "label": "yaw 90° / elevation 57.6°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 45° / elevation 30°",
   "spinRadians": 0.7853981633974483,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 0° / elevation 57.6°",
   "spinRadians": 0,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-04",
   "label": "yaw 180° / elevation 14.4°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-05",
   "label": "yaw 90° / elevation 30°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "ai120:85:1": [
  {
   "name": "surface-01",
   "label": "yaw 0° / elevation 57.6°",
   "spinRadians": 0,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 90° / elevation 57.6°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 180° / elevation 30°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-04",
   "label": "yaw 45° / elevation 30°",
   "spinRadians": 0.7853981633974483,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-05",
   "label": "yaw 0° / elevation 14.4°",
   "spinRadians": 0,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-06",
   "label": "yaw 90° / elevation 30°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "gallery:85:2": [
  {
   "name": "surface-01",
   "label": "yaw 90° / elevation 57.6°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 0° / elevation 57.6°",
   "spinRadians": 0,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 180° / elevation 14.4°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": -0.27227136331111534,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-04",
   "label": "yaw 45° / elevation 30°",
   "spinRadians": 0.7853981633974483,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-05",
   "label": "yaw 90° / elevation 30°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-06",
   "label": "yaw 0° / elevation 14.400000000000002°",
   "spinRadians": 0,
   "tiltRadians": -0.27227136331111534,
   "reason": "Candidate first-red mandatory samples are covered by this already-frozen legal angle; all initial failure records and all baseline views retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ],
 "ai120:85:2": [
  {
   "name": "surface-01",
   "label": "yaw 0° / elevation 57.6°",
   "spinRadians": 0,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-02",
   "label": "yaw 90° / elevation 57.6°",
   "spinRadians": 1.5707963267948966,
   "tiltRadians": 0.48171087355043507,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-03",
   "label": "yaw 180° / elevation 30°",
   "spinRadians": 3.141592653589793,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-04",
   "label": "yaw 45° / elevation 30°",
   "spinRadians": 0.7853981633974483,
   "tiltRadians": 0,
   "reason": "Complete unchanged pre-code fixed-surface and original silhouette contract; bounded legal view, all neighbours retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  },
  {
   "name": "surface-05",
   "label": "yaw 0° / elevation 14.400000000000002°",
   "spinRadians": 0,
   "tiltRadians": -0.27227136331111534,
   "reason": "Candidate first-red mandatory samples are covered by this already-frozen legal angle; all initial failure records and all baseline views retained.",
   "zoomByWidth": {
    "360": 8,
    "412": 8,
    "1440": 8
   }
  }
 ]
});
export const D078_REPEAT_SLOTS=Object.freeze(['81:2','130:1']);
const active=(city,b)=>b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n;
export const D078_CAPTURE_SOURCES=['gallery','seed516','ai120'].flatMap(sample=>[null,0,1,2].map(force=>{
 const city=d078City(sample),targets=city.buildings.filter(b=>active(city,b)&&KINDS.includes(b.k)),variant=force===null?'native':'v'+force;
 assert.equal(targets.length,sample==='gallery'?4:sample==='ai120'?2:0,sample+' exact existing neighbourhoodPavilion-kind owners');
 const id=sample+'-'+(force===null?'native-existing-city':'copied-saved-variant-'+variant+'-showcase');
 const label=force===null?sample.toUpperCase()+' NATIVE EXISTING CITY':sample.toUpperCase()+' COPIED VARIANT '+variant+' SHOWCASE · SAVED-IMPORT ONLY';
 const qualification=force===null?'Original paused '+sample+' city with original saved variants.':'Original paused '+sample+' city. __gt.neighbourhoodV('+force+') copies only k81:v2 and k84/k85/k130:v0–2 for rendering. Unsupported slots preserve original records. Ten saved/import-only structures across four kinds; original ages and construction/tree state remain unchanged.';
 const slots=force!==null?(sample==='gallery'?D078_SLOTS.filter(s=>s.v===force):sample==='ai120'?D078_SLOTS.filter(s=>s.v===force&&(s.k===84||s.k===85)):[]):[];
 const sites=slots.map(m=>{
  const b=targets.find(b=>b.k===m.k);assert.ok(b,'existing source building for k'+m.k);
  return {...m,id:id+'-k'+m.k+'-v'+m.v,buildingId:b.id,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size,sourceVariant:b.v,renderedVariant:m.v,level:b.lv,age:b.age,constructionLabel:b.age<9?'ORIGINAL CONSTRUCTION STATE, age '+b.age+'; not finished-roof visibility evidence':'FULLY BUILT, original age '+b.age,parcel:{x:b.x,z:b.z,size:b.size}};
 });
 const shots=[{id:id+'-overview',name:force===null?'Native existing-city overview':'Copied saved-variant '+variant+' overview (not ten native tools)',x:city.n/2,z:city.n/2,size:city.n},...sites.flatMap(site=>D078_REPEAT_SLOTS.includes(site.k+':'+site.v)?[site,{...site,id:site.id+'-paused-repeat',repeatOf:site.id,pausedFrames:30}]:[site])];
 for(const site of sites)for(const extra of D078_ALTERNATE_VIEWS[sample+':'+site.k+':'+site.v]??[])shots.push({...site,id:site.id+'-'+extra.name,name:site.name+' · '+extra.label+' / ADDITIONAL CAMERA VIEW',additionalView:extra.name,spinRadians:extra.spinRadians,tiltRadians:extra.tiltRadians,viewReason:extra.reason,zoomByWidth:extra.zoomByWidth});
 return {sample,id,label,qualification,force,variant,n:city.n,sites,shots,targets:targets.map(b=>({id:b.id,k:b.k,x:b.x,z:b.z,size:b.size,lv:b.lv,v:b.v})),sampleSha256:sha(fs.readFileSync(path.join(ROOT,'src/content/samples/'+sample+'.code.txt')))};
}));
const SOURCES=D078_CAPTURE_SOURCES;
assert.equal(SOURCES.length,12,'three original cities × native and three copied variant previews');
assert.deepEqual(SOURCES.filter(s=>s.sample==='gallery').flatMap(s=>s.sites.map(x=>x.k+':'+x.v)).sort(),D078_SLOTS.map(s=>s.k+':'+s.v).sort(),'each of ten slots has a gallery closeup');
assert.deepEqual(SOURCES.filter(s=>s.sample==='ai120').flatMap(s=>s.sites.map(x=>[x.k,x.v,x.buildingId])),[[84,0,20],[85,0,15],[84,1,20],[85,1,15],[84,2,20],[85,2,15]],'all actual ai120 owners and supported variants retained');
assert.equal(SOURCES.reduce((n,s)=>n+s.shots.filter(x=>!x.additionalView&&!x.repeatOf).length,0),28,'all sixteen owner closeups and twelve overviews retained');
const ADDITIONAL_ANGLES=Object.values(D078_ALTERNATE_VIEWS).reduce((n,views)=>n+views.length,0),PAUSED_REPEATS=D078_REPEAT_SLOTS.length;
assert.equal(SOURCES.reduce((n,s)=>n+s.shots.filter(x=>x.additionalView).length,0),ADDITIONAL_ANGLES,'every appended view is independently justified by roof or fixed surface-sample visibility');
assert.equal(SOURCES.reduce((n,s)=>n+s.shots.filter(x=>x.repeatOf).length,0),PAUSED_REPEATS,'one paused repeat for each independently selected stability case');
assert.equal(SOURCES.reduce((n,s)=>n+s.shots.length,0),28+ADDITIONAL_ANGLES+PAUSED_REPEATS,'original 28 shots plus roof-angle and paused-repeat evidence');
const ORIGINALS_PER_VIEWPORT=2*SOURCES.reduce((n,s)=>n+s.shots.length,0);
const COMPLETE_ORIGINALS=D078_VIEWPORTS.length*ORIGINALS_PER_VIEWPORT;
assert.equal(COMPLETE_ORIGINALS,168+6*(ADDITIONAL_ANGLES+PAUSED_REPEATS),'all 168 original views plus both phases and three widths for each alternate/repeat');
export function assertD078OriginalViewCount(originals,viewportCount){
 assert.ok(Number.isInteger(viewportCount)&&viewportCount>=1&&viewportCount<=3,'one to three explicitly requested viewports');
 assert.equal(originals.filter(s=>!s.additionalView&&!s.repeatOf).length,56*viewportCount,'all 168 baseline views retained across the requested viewport subset');
}
export const d078CameraZoom=(source,s,v)=>s.additionalView?s.zoomByWidth[v.W]:(s.k?Math.max(.6,Math.min(8,.70*.84*source.n*(v.W/v.H)/(s.size*Math.SQRT2))):Math.max(.6,.54*v.W/v.H));
const zoomFor=d078CameraZoom;
// Sample saves can be null. Include every world layer, the source building list, stats and history as well.
const WORLD=`JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList(),__gt.layers(),__gt.stats()])`;
const DIGEST=`(()=>{const d=__gt.sceneDigest();return JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts});})()`;
const PIXELS=`(async()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=c.width;k.height=c.height;const x=k.getContext('2d');x.drawImage(c,0,0);const d=x.getImageData(0,0,k.width,k.height).data;let s=0,q=0,n=0;for(let i=0;i<d.length;i+=4){const l=d[i]*.3+d[i+1]*.59+d[i+2]*.11;s+=l;q+=l*l;n++;}const hash=await crypto.subtle.digest('SHA-256',d);return {width:k.width,height:k.height,variance:q/n-(s/n)**2,sha256:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};})()`;
const externalRequests=requests=>requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
const jsonWrite=(file,value)=>fs.writeFileSync(path.join(OUT,file),J(value,null,2)+'\n');
function expectedBudgets(){
 const expected=d078Expected();
 for(const s of SOURCES){const e=expected[s.variant][s.sample];assert.equal(e.legacy,D078_OLD[s.variant][s.sample].c[0],s.id+' exact immutable D077 baseline');assert.equal(e.neighbourhoodPavilion-e.legacy,e.delta);assert.ok(e.delta<=0,s.id+' no triangle growth');for(const phase of ['legacy','neighbourhoodPavilion'])assert.equal(e[phase],D078_FRAME_WHOLE[s.variant][s.sample][phase],s.id+' exact immutable '+phase+' frame pin');}
 return expected;
}
export function d078CapturePlan(expected=expectedBudgets()){
 return {passed:true,captured:false,qualification:'Source coverage, bounded camera plan and Node triangle counts only. This plan file is not screenshot or acceptance evidence; --plan-only never launches a browser.',coverageAccepted:false,expected,viewports,
  actualOriginalPngs:0,plannedOriginalPngs:viewports.length*ORIGINALS_PER_VIEWPORT,nativeReachability:{nativeToolSlots:0,savedImportOnlySlots:10,kinds:[81,84,85,130],qualification:"No FACILITY_TOOLS IDs dispatch these four kinds. Native means the untouched saved-city records, not a native construction selector."},completeThreeViewportOriginalPngs:COMPLETE_ORIGINALS,preservedOriginalViews:168,additionalRoofViews:6*ADDITIONAL_ANGLES,pausedRepeatViews:6*PAUSED_REPEATS,distinctBuildings:10,sources:SOURCES.map(s=>({...s,shots:s.shots.map(shot=>({...shot,zooms:Object.fromEntries(viewports.map(v=>[v.W,zoomFor(s,shot,v)]))}))}))};
}
function captureProvenance(){
 assert.equal(sha(fs.readFileSync(path.join(ROOT,'docs/D078-camera-detail-correction.md'))),D078_CAMERA_DETAIL_CARD_SHA256,'immutable supplemental camera-detail correction card');
 const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(ROOT,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort();
 const sourceSha256=Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(ROOT,file)))])),guards=['tools/d078-frame.mjs','tools/unit-d078-frame.mjs','tools/d078-capture.mjs','tools/unit-d078.mjs','tools/d078-scope.mjs','docs/D078-british-neighbourhood-pavilions-ten.md','docs/D078-camera-detail-correction.md','docs/D078-initial-architecture.json','fixtures/d078-architecture-contract.json','fixtures/d078-geometry-before.json','fixtures/d078-source-before.json','fixtures/d078-history-before.json','fixtures/d078-art-scope.json'];
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();if(process.env.GITHUB_SHA)assert.equal(commit,process.env.GITHUB_SHA,'actual checkout equals runner evidence head');
 return {commit,githubSha:process.env.GITHUB_SHA??null,node:process.version,platform:process.platform,sourceSha256,sourceInventorySha256:sha(sourceSha256),guardSha256:Object.fromEntries(guards.map(file=>[file,sha(fs.readFileSync(path.join(ROOT,file)))])),publishedBaseline:'22da5314145f96aaa83cfb739c382b86e1d5b0f3',oldFeasibilityArchiveSha256:'815559751b78806114c598109f14108ef9e29f7a04a925f9a4912cf68678d817',html:{file:'dist/index.html',bytes:fs.statSync(path.join(ROOT,'dist/index.html')).size,sha256:sha(fs.readFileSync(path.join(ROOT,'dist/index.html')))}};
}
async function sourceLabel(p,source,shot){
 // The same factual caption appears in both phases. It never supplies the changed-pixels evidence.
 const detail=(shot.k?'k'+shot.k+':v'+shot.renderedVariant+' · '+shot.name+' · owner '+shot.buildingId+' · source v'+shot.sourceVariant+' unchanged · '+shot.constructionLabel:shot.name);
 await p.ev(`(()=>{let label=document.getElementById('d078-source-label');if(!label){label=document.createElement('div');label.id='d078-source-label';label.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;box-sizing:border-box;padding:8px 12px;background:rgba(15,22,29,.90);color:#fff;font:12px/1.45 sans-serif;pointer-events:none;white-space:pre-line';document.body.append(label);}label.textContent=${J(source.label+'\n'+detail)};})()`);
}
async function verifyConstructionDiagnostic(p,oracle,source,shot,viewport){
 const live=await p.ev('(()=>{const con=__gt.con();return {camera:__gt.cam(),actualViewport:{W:innerWidth,H:innerHeight},labZoom:con.labZoom,uDetail:con.detail,diagnostic:__gt.neighbourhoodConstruction()};})()');
 const comparison=assertD078ConstructionDiagnostic(live.diagnostic,oracle.constructionDiagnostic(),{n:source.n,shot,viewport,camera:live.camera,actualViewport:live.actualViewport,labZoom:live.labZoom,uDetail:live.uDetail});
 return {actual:live.diagnostic,comparison};
}
async function settledCamera(p,source,shot,v,settlement={}){
 await p.ev(`__gt.view(${shot.x},${shot.z},${zoomFor(source,shot,v)});__gt.setVisT(2.2);__gt.setDayFrac(0)`);await p.frames(25);
 let stable=0,last=await p.ev('__gt.cam()');
 for(let i=0;i<24&&stable<2;i++){await p.frames(20);const next=await p.ev('__gt.cam()'),delta=Math.max(...['pos','target'].flatMap(k=>next[k].map((x,j)=>Math.abs(x-last[k][j]))),Math.abs(next.zoom-last.zoom));stable=delta<1e-9?stable+1:0;last=next;}
 assert.equal(stable,2,'observed a settled camera');
 if(!shot.additionalView&&D078_REPEAT_SLOTS.includes(shot.k+':'+shot.v)){
  const initial=last;await p.ev('for(let i=0;i<900;i++)__gt.spin(0)');last=await p.ev('__gt.cam()');
  assert.deepEqual(last.target,initial.target,'zero-angle settlement preserves the roof-audited target');assert.equal(last.zoom,initial.zoom,'zero-angle settlement preserves the roof-audited zoom');
  assert.ok(last.pos.every((x,i)=>Math.abs(x-initial.pos[i])<1e-9),'zero-angle settlement preserves the original southeast pose');
  await p.frames(20);assert.deepEqual(await p.ev('__gt.cam()'),last,'roof-audited original starts at an exact damping fixed point');
  Object.assign(settlement,{zeroAngleUpdates:900,fixedPointFrames:20,targetAndZoomUnchanged:true,maximumPositionDelta:Math.max(...last.pos.map((x,i)=>Math.abs(x-initial.pos[i])))});
 }
 if(shot.additionalView){
  assert.ok(D078_SLOTS.some(s=>s.k===shot.k&&s.v===shot.renderedVariant),'alternate is an exact supported neighbourhoodPavilion slot');
  assert.ok(Number.isFinite(shot.spinRadians)&&Number.isFinite(shot.tiltRadians)&&Math.abs(shot.spinRadians)+Math.abs(shot.tiltRadians)>0,'nonzero audited production orbit angles');
  const initial=last;
  // spin is an existing production OrbitControls hook. Synchronous zero-angle updates drain
  // damping deterministically; no direct camera assignment, scene edit or clipping change is used.
  await p.ev('__gt.spin('+shot.spinRadians+');'+(shot.tiltRadians?'__gt.tilt('+shot.tiltRadians+');':'')+'for(let i=0;i<900;i++)__gt.spin(0)');
  last=await p.ev('__gt.cam()');assertD078NeighbourhoodPavilionCamera(last,initial,shot.spinRadians,shot.tiltRadians);
  await p.frames(20);assert.deepEqual(await p.ev('__gt.cam()'),last,'additional camera is at an exact damping fixed point');
 }
 return last;
}
async function uploadState(p){
 return p.ev(`(()=>{const r=__gt.renderInfo(),a=__gt.renderInfoAll();return {world:${WORLD},digest:__gt.sceneDigest(),camera:__gt.cam(),render:{calls:r.calls,triangles:r.triangles},renderAll:{calls:a.calls,triangles:a.triangles}};})()`);
}
async function verifyUploadedGeometry(p,oracle,item){
 const before=await uploadState(p),words={};
 item.rawSceneDigest=before.digest;
 assert.deepEqual(await p.ev('__d067UploadProbe.errors'),[],'pass-through upload probe has no capture errors');
 for(const [name,spec] of Object.entries(oracle.normalSpecs)){
  const hash=before.digest.meshes[name].attrs.normal;
  if(hash===spec.hash)continue;
  const candidates=await p.ev(`__d067UploadProbe.select(${J({...spec,hash})})`);
  assert.ok(candidates.length,'captured normal upload reproduces browser hash: '+name);
  words[name]=await p.ev(`__d067UploadProbe.bits(${candidates[0].id},${spec.start},${spec.length})`);
  for(const duplicate of candidates.slice(1))assert.deepEqual(await p.ev(`__d067UploadProbe.bits(${duplicate.id},${spec.start},${spec.length})`),words[name],'same-hash normal buffers have identical live words');
 }
 item.geometryComparison=oracle.assertBrowserGeometry(before.digest,words);
 item.normalArithmetic={node:[4,5].map(i=>{const angle=i*(Math.PI*2/6);return {angle,cos:Math.cos(angle),sin:Math.sin(angle)};}),browser:await p.ev('[4,5].map(i=>{const angle=i*(Math.PI*2/6);return {angle,cos:Math.cos(angle),sin:Math.sin(angle)};})')};
 // The pass-through probe remains live until native and copied geometries have both been verified.
 assert.deepEqual(await uploadState(p),before,'normal inspection/restoration preserves world, raw geometry, camera and submitted geometry');
 item.uploadProbe={worldGeometryCameraAndSubmissionsUnchanged:true};
 item.geometrySha256=sha(before.digest);
}
// The BEFORE URL selects exactly the published D077 phase. AFTER is the production
// default; historical capture flags must never leak into either actual D078 browser load.
export function d078CaptureQuery(sample,phase){
 assert.ok(['gallery','seed516','ai120'].includes(sample),'known D078 capture sample');
 assert.ok(phase==='before'||phase==='after','explicit D078 before/after capture phase');
 return 'sample='+sample+'&clean=1'+(phase==='before'?'&neighbourhoodArt=legacy':'');
}
export function assertD078CaptureUrl(actualUrl,sample,phase){
 const actual=new URL(actualUrl),expected=d078CaptureQuery(sample,phase);
 assert.equal(actual.search,'?'+expected,'actual browser URL uses the exact independently tested artwork phase query');
 assert.equal(actual.hash,'','no unrecorded browser fragment');return actual.href;
}
async function capturePhase(v,phase,source,expected,item){
 Object.assign(item,{viewport:v,phase,sample:source.sample,variant:source.variant,force:source.force,sourceQualification:source.qualification,query:d078CaptureQuery(source.sample,phase),shots:[],surfaceContracts:{},archivedSurfaceContracts:{},precodeSurfaceContracts:{},passed:false});
 const oracle=createD078FrameOracle(source.sample,phase==='after',source.force);
 try{await withBrowser({root:path.join(ROOT,'dist'),width:Math.max(960,v.W),height:Math.max(900,v.H),port:PORT},async({page,open})=>{
  try{
   const p=await pageSession(page,open,v);
   await page.send('Page.addScriptToEvaluateOnNewDocument',{source:D067_UPLOAD_PROBE});
   await p.open(item.query);
   item.actualUrl=assertD078CaptureUrl(await p.ev('location.href'),source.sample,phase);
   assert.equal(await p.ev('!!__gt.ready'),true,'production scene ready');assert.equal(await p.ev('__gt.sample'),source.sample,'requested source sample');
   assert.equal(await p.ev('__gt.webgl2'),true,'real WebGL2 production renderer');assert.equal((await p.ev('__gt.sim()'))?.playing??false,false,'world clock paused');
   assert.equal(await p.ev('__gt.blockMode()'),'c','the same default block mode as the Node budget');
   await p.ev('document.fonts.ready');
   await p.ev('__gt.setVisT(2.2);__gt.setDayFrac(0)');await p.frames(6);
   item.webgl=await p.ev(`(()=>{const gl=document.querySelector('canvas').getContext('webgl2');return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),contextLost:gl.isContextLost()};})()`);
   assert.equal(item.webgl.contextLost,false,'WebGL context is live');
   await settledCamera(p,source,source.shots[0],v);
   const initial=await p.ev(WORLD),nativeDigest=await p.ev(DIGEST),list=await p.ev('__gt.buildingList()');
   item.worldSha256=sha(initial);item.nativeDigestSha256=sha(nativeDigest);
   item.nativeGeometry={};
   const nativeOracle=createD078FrameOracle(source.sample,phase==='after',null);
   try{await verifyUploadedGeometry(p,nativeOracle,item.nativeGeometry);}finally{nativeOracle.dispose();}
   if(source.force!==null){
    const camera=await p.ev('__gt.cam()');
    assert.equal(await p.ev('__gt.neighbourhoodV('+source.force+')'),source.force,'explicit render-only copied saved-variant showcase hook');await p.frames(6);
    assert.equal(await p.ev(WORLD),initial,'forcing copied saved variants never mutates the source world');
    assert.deepEqual(await p.ev('__gt.cam()'),camera,'forcing copied saved variants preserves the settled camera');
   }
   const dig=await p.ev(DIGEST);item.digestSha256=sha(dig);
   if(source.force===null||source.targets.every(b=>!D078_SLOTS.some(s=>s.k===b.k&&s.v===source.force)||b.v===source.force))assert.equal(dig,nativeDigest,'native, already-matching or unsupported copied preview equals exact native geometry');
   // Raw browser attributes remain recorded. Only the three source-proven D060 kiln-face
   // numerical-zero normals can be canonicalized in cloned comparison data; no source is changed.
   await verifyUploadedGeometry(p,oracle,item);
   const probeBefore=await uploadState(p);await p.ev('__d067UploadProbe.stop()');
   assert.deepEqual(await uploadState(p),probeBefore,'restoring upload functions preserves world, geometry, camera and submissions');
   item.uploadProbe.restored=true;item.nativeGeometry.uploadProbe.restored=true;
   const initialConstruction=await verifyConstructionDiagnostic(p,oracle,source,source.shots[0],v);
   item.constructionState=initialConstruction.actual;item.constructionComparison=initialConstruction.comparison;
   const actualTargets=list.filter(b=>KINDS.includes(b[1]));
   assert.deepEqual(actualTargets.map(b=>b[0]).sort((a,b)=>a-b),source.targets.map(b=>b.id).sort((a,b)=>a-b),'browser contains exactly the source target owners');
   for(const b of source.targets){const row=list.find(row=>row[0]===b.id);assert.deepEqual(row.slice(0,7),[b.id,b.k,b.x,b.z,b.size,b.lv,b.v],'actual unmodified source building, variant and level');}
   for(const s of source.shots){
    let camera;const cameraSettlement={};
    if(s.repeatOf){
     const initialShot=item.shots.at(-1);assert.equal(initialShot.name,s.repeatOf,'paused repeat immediately follows its original view');
     assert.equal(s.pausedFrames,30,'exact thirty-frame paused observation');await p.frames(s.pausedFrames);camera=await p.ev('__gt.cam()');
     assert.deepEqual(camera,initialShot.camera,'no camera reset or movement during the repeated view');
    }else{camera=await settledCamera(p,source,s,v,cameraSettlement);await sourceLabel(p,source,s);await p.frames(3);}
    const info=await p.ev('__gt.renderInfo()'),all=await p.ev('__gt.renderInfoAll()');
    assert.ok(info.calls<=18,'existing base draw-call ceiling');assert.ok(all.calls<=20,'existing all-content draw-call ceiling');
    // Independently predict color and shadow submissions from actual production geometry and camera.
    // Existing-city negative controls and all gallery views retain their actual independent frusta.
    // Whole-scene budgets remain immutable; rendered counts must match the exact frustum, not a relaxed ceiling.
    const frameExpected=oracle.measure(camera,v);
    assert.equal(frameExpected.wholeTriangles,phase==='before'?expected.legacy:expected.neighbourhoodPavilion,'unchanged exact whole-scene budget');
    assertD078Frame(info,frameExpected,'browser base frame');
    const ownerBounds=s.k?assertD078OwnerFits(oracle.ownerBounds(camera,v,s.buildingId),phase+' '+s.id+' '+v.W+'px'):null;
    const ownerVisibility=s.k?oracle.ownerVisibility(camera,v,s.buildingId):null;
    const roofVisibility=phase==='after'&&s.k?oracle.roofVisibility(camera,v,s.buildingId):null;
    // Additional views prove the complete fixed surface union; no obstructed point is excluded.
    let surfaceVisibility=null;if(s.k){const key=s.k+':'+s.renderedVariant;if(!item.surfaceContracts[key]){assert.ok(!s.additionalView&&!s.repeatOf,'fixed surface contract is made from the preserved original view before alternatives');item.surfaceContracts[key]=oracle.surfaceContract(camera,v,s.buildingId);}surfaceVisibility=oracle.surfaceVisibility(camera,v,item.surfaceContracts[key]);}
    let archivedSurfaceVisibility=null;if(phase==='before'&&s.k){const key=s.k+':'+s.renderedVariant;if(!item.archivedSurfaceContracts[key])item.archivedSurfaceContracts[key]=oracle.archivedSurfaceContract(v,s.buildingId);archivedSurfaceVisibility=oracle.surfaceVisibility(camera,v,item.archivedSurfaceContracts[key]);}
    let precodeSurfaceVisibility=null;if(phase==='before'&&s.k){const key=s.k+':'+s.renderedVariant;if(!item.precodeSurfaceContracts[key])item.precodeSurfaceContracts[key]=oracle.productionSurfaceContract(v,s.buildingId);precodeSurfaceVisibility=oracle.surfaceVisibility(camera,v,item.precodeSurfaceContracts[key]);}
    const constructionDiagnostic=(await verifyConstructionDiagnostic(p,oracle,source,s,v)).comparison;
    let constructionState=null;if(s.k){constructionState=oracle.ownerConstruction(s.buildingId,item.surfaceContracts[s.k+':'+s.renderedVariant]);const actualTiles=await p.ev('('+J(constructionState.tiles)+').map(t=>({x:t.x,z:t.z,...__gt.conTile(t.x,t.z)}))');assert.deepEqual(actualTiles,constructionState.tiles,'actual uploaded construction tiles equal independently measured geometry and original ages');assert.equal(constructionState.originalAge,s.age,'original age unchanged');if(source.sample==='gallery'){assert.equal(constructionState.originalAge,400);assert.equal(constructionState.rise,1);assert.equal(constructionState.treeShaderScale,1);assert.equal(constructionState.clippedCount,0,'gallery is finished-model WebGL evidence');}if(source.sample==='ai120'&&s.k===85){assert.equal(constructionState.originalAge,7);assert.equal(constructionState.rise,.84);assert.equal(constructionState.treeShaderScale,0);assert.equal(constructionState.complete,false);}}
    const pixels=await p.ev(PIXELS);assert.ok(pixels.variance>50,'nonblank real production canvas');assert.equal(pixels.width,v.W);assert.equal(pixels.height,v.H);
    const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),v.W);assert.equal(bytes.readUInt32BE(20),v.H);assert.ok(bytes.length>3000,'nonempty full-resolution PNG');
    const file=`D078-${phase}-${s.id}-${v.W}.png`;fs.writeFileSync(path.join(OUT,file),bytes);
    // Hash the WebGL canvas itself, excluding DOM captions; a different label cannot fake art changes.
    assert.equal((await p.ev(PIXELS)).sha256,pixels.sha256,'paused canvas stayed pixel-stable during screenshot');
    assert.equal(await p.ev(WORLD),initial,'photography leaves every world layer/save/history untouched');assert.equal(await p.ev(DIGEST),dig,'photography does not change scene geometry');
    const con=await p.ev('__gt.con()');assert.equal(con.visT,2.2,'frozen presentation time');assert.equal(con.dayFrac,0,'frozen fraction of day');
    item.shots.push({file,name:s.id,label:s.name,source:source.sample,sourceQualification:source.qualification,kind:s.k??null,additionalView:s.additionalView??null,viewReason:s.viewReason??null,repeatOf:s.repeatOf??null,pausedFrames:s.pausedFrames??0,spinRadians:s.spinRadians??0,tiltRadians:s.tiltRadians??0,buildingId:s.buildingId??null,parcel:s.parcel??null,sourceVariant:s.sourceVariant??null,renderedVariant:s.renderedVariant??null,level:s.level??null,age:s.age??null,constructionLabel:s.constructionLabel??null,
     sha256:sha(bytes),bytes:bytes.length,width:v.W,height:v.H,canvasSha256:pixels.sha256,canvasVariance:pixels.variance,camera,cameraSha256:sha(camera),cameraSettlement:Object.keys(cameraSettlement).length?cameraSettlement:null,declaredZoom:zoomFor(source,s,v),zoomPolicy:s.additionalView?'one shared zoom from complete baseline/candidate owner vertex bounds':'unchanged original standard view',frameExpected,ownerBounds,ownerVisibility,roofVisibility,surfaceVisibility,archivedSurfaceVisibility,precodeSurfaceVisibility,constructionState,constructionDiagnostic,render:{calls:info.calls,triangles:info.triangles},renderAll:{calls:all.calls,triangles:all.triangles},presentation:{visT:con.visT,dayFrac:con.dayFrac},worldSha256:sha(initial)});
    if(s.repeatOf)assertD078PausedRepeat(item.shots.at(-1),item.shots.find(x=>x.name===s.repeatOf));
   }
   if(phase==='after')for(const site of source.sites){
    const roofs=item.shots.filter(s=>s.kind===site.k&&s.renderedVariant===site.v&&s.roofVisibility&&!s.repeatOf).map(s=>s.roofVisibility);
    assertD078RoofCoverage(roofs,'k'+site.k+':v'+site.v+' actual camera roof coverage');
   }
   for(const site of source.sites){const key=site.k+':'+site.v;assertD078SurfaceCoverage(item.shots.filter(s=>s.kind===site.k&&s.renderedVariant===site.v&&!s.repeatOf).map(s=>s.surfaceVisibility),item.surfaceContracts[key],'actual '+phase+' '+key+' fixed surface-sample union');if(phase==='before')assertD078SurfaceCoverage(item.shots.filter(s=>s.kind===site.k&&s.renderedVariant===site.v&&!s.repeatOf).map(s=>s.archivedSurfaceVisibility),item.archivedSurfaceContracts[key],'entire archived baseline original-hit/fixed-point contract also covered');if(phase==='before')assertD078SurfaceCoverage(item.shots.filter(s=>s.kind===site.k&&s.renderedVariant===site.v&&!s.repeatOf).map(s=>s.precodeSurfaceVisibility),item.precodeSurfaceContracts[key],'entire exact production-camera pre-code contract also covered');}
   if(source.force!==null){
    const camera=await p.ev('__gt.cam()');
    assert.equal(await p.ev('__gt.neighbourhoodV('+source.force+')'),source.force,'reapplying the copied-variant hook is deterministic');await p.frames(3);
    assert.equal(await p.ev(DIGEST),dig,'fresh repeated forced showcase has identical geometry');assert.deepEqual(await p.ev('__gt.cam()'),camera,'reapplying the hook preserves the settled camera');
    assert.equal(await p.ev('__gt.neighbourhoodV(null)'),null,'clear the render-only saved-variant hook');await p.frames(3);
    assert.equal(await p.ev(DIGEST),nativeDigest,'clearing the hook restores original city geometry byte for byte');
    assert.deepEqual(await p.ev('__gt.cam()'),camera,'restoring the original city preserves the settled camera');
    assert.equal(await p.ev(WORLD),initial,'forcing, reapplying and clearing copied variants preserves every source world field');
    item.neighbourhoodPavilionHook={forced:source.force,repeatedGeometryExact:true,restored:true,worldAndCameraUnchanged:true};
   }
   assert.equal(await p.ev(D057_SAME),true,'unforced cached production scene equals a fresh scene');assert.equal(await p.ev(WORLD),initial,'fresh-scene verification leaves the world untouched');
   assert.deepEqual(page.errors,[],'no browser console/page errors');assert.deepEqual(externalRequests(page.requests),[],'no external assets/network requests');
   item.passed=true;
  }finally{item.browserErrors=[...page.errors];item.externalRequests=externalRequests(page.requests);item.requestCount=page.requests.length;}
 });}finally{oracle.dispose();}
}
function compare(a,b,source,expected){
 assert.equal(a.worldSha256,b.worldSha256,'same source world in both phases');if(!source.targets.some(b=>D078_SLOTS.some(s=>s.k===b.k&&s.v===b.v)))assert.equal(a.nativeDigestSha256,b.nativeDigestSha256,'no-supported-slot native geometry stays byte-exact across D078 phases');else assert.notEqual(a.nativeDigestSha256,b.nativeDigestSha256,'native target art changes and both phases are independently pinned');assert.equal(a.shots.length,source.shots.length);assert.equal(b.shots.length,source.shots.length);
 for(const x of a.shots){const y=b.shots.find(y=>y.name===x.name);assert.ok(y);assert.equal(x.worldSha256,y.worldSha256);assert.equal(x.camera.zoom,y.camera.zoom);
  assert.deepEqual(y.camera,x.camera,'byte-exact settled camera in both artwork phases');
  assert.deepEqual(y.presentation,x.presentation,'same frozen visual time');
  for(const key of ['render','renderAll']){assert.equal(y[key].calls,x[key].calls,'same '+key+' draw calls');assert.equal(y[key].triangles-x[key].triangles,expected.delta,'exact '+key+' weighted triangle delta');assert.ok(y[key].triangles<=x[key].triangles,'no '+key+' triangle growth');}
  if(source.targets.some(b=>D078_SLOTS.some(s=>s.k===b.k&&s.v===(source.force!==null&&D078_SLOTS.some(t=>t.k===b.k&&t.v===source.force)?source.force:b.v)))){assert.notEqual(x.canvasSha256,y.canvasSha256,'actual WebGL canvas pixels change for '+x.name);assert.notEqual(x.sha256,y.sha256,'original PNG pixels change for '+x.name);}
  else {assert.equal(x.canvasSha256,y.canvasSha256,'no supported target-slot city canvas remains exactly unchanged');assert.equal(x.sha256,y.sha256,'no supported target-slot city original PNG remains exactly unchanged');}
 }
}
// Review sheets compose ONLY the full-resolution screenshots above. Originals always remain in OUT.
async function contactSheet(c,source){
 const v=c.viewport,thumb=v.mobile?v.W:480,height=Math.round(thumb*v.H/v.W),panelW=thumb*2+8,panelH=height+48,columns=source.sample==='gallery'?3:1,rows=Math.ceil(c.before.shots.length/columns),header=140,W=columns*panelW+(columns-1)*12,H=header+rows*panelH+(rows-1)*12;
 const images=c.before.shots.map(x=>{const y=c.after.shots.find(y=>y.name===x.name);return {title:(x.kind?'k'+x.kind+':v'+x.renderedVariant+' · ':'')+x.label+(x.repeatOf?' · EXACT PAUSED REPEAT (30 FRAMES)':''),before:'data:image/png;base64,'+fs.readFileSync(path.join(OUT,x.file)).toString('base64'),after:'data:image/png;base64,'+fs.readFileSync(path.join(OUT,y.file)).toString('base64')};});
 await withBrowser({root:OUT,entry:'d078-review.html',overlay:{'d078-review.html':'<!doctype html><meta charset="utf-8"><title>D078 actual WebGL image pairs</title>'},ready:'document.readyState === "complete"',width:W,height:H,gl:false,port:PORT},async({page,open})=>{
  await open('');await page.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
  await page.evaluate(`(()=>{document.body.style.cssText='margin:0;background:#151b20;color:#fff;font:14px/1.4 sans-serif';const h=document.createElement('header');h.style.cssText='height:${header}px;box-sizing:border-box;padding:10px 12px;white-space:pre-line';h.textContent=${J('D078 · '+source.label+'\n'+source.qualification+'\n'+v.W+' × '+v.H+' · BEFORE = D077 / neighbourhoodArt=legacy; AFTER = default D078 · Actual WebGL PNGs')};document.body.append(h);const grid=document.createElement('main');grid.style.cssText='display:grid;grid-template-columns:repeat('+${columns}+',${panelW}px);gap:12px';for(const p of ${J(images)}){const d=document.createElement('section'),title=document.createElement('div');title.textContent=p.title+' | BEFORE ← → AFTER';title.style.cssText='height:48px;line-height:24px;box-sizing:border-box;padding:0 4px';d.append(title);const row=document.createElement('div');row.style.cssText='display:flex;gap:8px';for(const src of [p.before,p.after]){const image=new Image();image.src=src;image.width=${thumb};image.height=${height};row.append(image);}d.append(row);grid.append(d);}document.body.append(grid);})()`);
  await page.evaluate('Promise.all([...document.images].map(i=>i.decode()))');await page.evaluate('document.fonts.ready');
  const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:W,height:H,scale:1}})).data,'base64'),file=`D078-pairs-${source.id}-${v.W}.png`;
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),W);assert.equal(bytes.readUInt32BE(20),H);
  fs.writeFileSync(path.join(OUT,file),bytes);assert.deepEqual(page.errors,[]);assert.deepEqual(externalRequests(page.requests),[]);
  c.contactSheet={file,width:W,height:H,sha256:sha(bytes),qualification:'Review sheet composed only from actual captured WebGL PNGs, with factual source and phase labels. All full-resolution originals and canvas pixel hashes are retained.'};
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
fs.mkdirSync(OUT,{recursive:true});
if(process.argv.includes('--plan-only')){
 const plan=d078CapturePlan(expectedBudgets());jsonWrite('D078-capture-plan.json',plan);
 console.log('PASS D078 capture plan: 10 gallery slot closeups + 6 actual ai120 owner closeups + 12 native/copied city overviews + '+ADDITIONAL_ANGLES+' additional audited neighbourhoodPavilion angles + '+PAUSED_REPEATS+' paused repeats × '+viewports.length+' viewports × 2 phases; NO SCREENSHOTS');
}else{
 const report={sourceRef:process.env.GITHUB_SHA??'local D078 candidate',qualification:'Real production CDP WebGL PNGs of unchanged paused source worlds. Three original cities are shown natively and as render-only copied variants 0/1/2. Ten structures occupy four existing kinds, not ten new tools. All 168 original views are retained, plus separately counted fixed-surface/roof angles and exact thirty-frame repeats. Every target has four fixed barycentric samples per owner triangle and all original southeast silhouette hits retained, including blocked points. Only complete same-owner enclosure proofs, exact-horizontal upward contact-cover proofs and downward ground faces are classified as geometrically covered; no exterior sample is dropped because of neighbours or trees. Independent intended roofs are covered against all production meshes. Original tree instances remain exact. All ten gallery owners are age400 and finished-model evidence. Actual ai120 owner20 is age83; owner15 is age7 with rise0.84/tree scale0 and explicitly construction-state evidence. The candidate clipped-point count is recomputed independently without removing any geometry point. Seed516 has no target and remains byte-exact. Additional views use only production spin/tilt and preserve exact source geometry. Mobile overviews obey minimum zoom 0.6. Software WebGL with touch emulation does not certify physical Android performance.',
  baseline:'22da5314145f96aaa83cfb739c382b86e1d5b0f3',before:'neighbourhoodArt=legacy (D077)' ,after:'default production D078',requestedWidths:viewports.map(v=>v.W),plannedOriginalPngs:viewports.length*ORIGINALS_PER_VIEWPORT,completeThreeViewportOriginalPngs:COMPLETE_ORIGINALS,originalPngs:0,allOriginalsRetained:false,sources:SOURCES.map(({sites,shots,...s})=>s),cases:[],passed:false,captured:false};
 try{
  report.provenance=captureProvenance();report.htmlSha256=report.provenance.html.sha256;report.expected=expectedBudgets();jsonWrite('D078-capture-plan.json',d078CapturePlan(report.expected));
  for(const viewport of viewports)for(const source of SOURCES){
   const c={viewport,sample:source.sample,variant:source.variant,force:source.force,sourceQualification:source.qualification,before:{},after:{},passed:false};report.cases.push(c);
   await capturePhase(viewport,'before',source,report.expected[source.variant][source.sample],c.before);jsonWrite('D078-capture.json',report);
   await capturePhase(viewport,'after',source,report.expected[source.variant][source.sample],c.after);compare(c.before,c.after,source,report.expected[source.variant][source.sample]);
   await contactSheet(c,source);c.passed=true;jsonWrite('D078-capture.json',report);console.log('PASS D078 real same-world/camera pairs',source.sample,viewport.W,c.before.shots.length);
  }
  // Every copied source is also compared to a separately captured native control in its same phase.
  for(const c of report.cases)for(const phase of ['before','after']){
   const native=report.cases.find(n=>n.viewport.W===c.viewport.W&&n.sample===c.sample&&n.variant==='native');assert.ok(native,'separate native control was captured');
   assert.equal(c[phase].worldSha256,native[phase].worldSha256,'every copied preview retains the separately captured native world');
   assert.equal(c[phase].nativeDigestSha256,native[phase].nativeDigestSha256,'every restored native digest equals the separately captured native control');
  }
  const originals=report.cases.flatMap(c=>[...c.before.shots,...c.after.shots]);
  assert.equal(originals.length,viewports.length*ORIGINALS_PER_VIEWPORT,'all required original WebGL PNGs captured');
  assert.equal(new Set(originals.map(s=>s.file)).size,originals.length,'every original has a unique retained PNG');
  for(const s of originals){const bytes=fs.readFileSync(path.join(OUT,s.file));assert.equal(bytes.length,s.bytes,'retained original byte length');assert.equal(sha(bytes),s.sha256,'retained original exact PNG digest');assert.equal(bytes.readUInt32BE(16),s.width);assert.equal(bytes.readUInt32BE(20),s.height);}
  assertD078OriginalViewCount(originals,viewports.length);
  const constructionShots=originals.filter(s=>s.kind!==null);report.constructionQualification={finishedGallerySlots:new Set(constructionShots.filter(s=>s.source==='gallery'&&s.constructionState.complete).map(s=>s.kind+':'+s.renderedVariant)).size,geometryCoverageIncludesEveryClippedPoint:true,actualAiConstructionStates:report.cases.filter(c=>c.sample==='ai120').flatMap(c=>['before','after'].flatMap(phase=>(c[phase].shots??[]).filter(s=>s.kind===85&&!s.repeatOf&&!s.additionalView).map(s=>({phase,width:s.width,slot:s.kind+':'+s.renderedVariant,owner:s.buildingId,...s.constructionState}))))};assert.equal(report.constructionQualification.finishedGallerySlots,10);report.allOriginalsRetained=true;report.captured=true;report.passed=report.cases.length===viewports.length*SOURCES.length&&report.cases.every(c=>c.passed);
 }catch(e){report.error=e.stack??String(e);report.status='blocked-or-failed';console.error(report.error);process.exitCode=1;}
 finally{
  const actual=report.cases.flatMap(c=>[...(c.before.shots??[]),...(c.after.shots??[])]);
  report.originalPngs=actual.length;report.preservedOriginalPngs=actual.filter(s=>!s.additionalView&&!s.repeatOf).length;
  report.additionalRoofPngs=actual.filter(s=>s.additionalView).length;report.pausedRepeatPngs=actual.filter(s=>s.repeatOf).length;
  report.distinctSupportedSlotsWithAnyCapture=new Set(actual.filter(s=>s.kind!==null&&!s.repeatOf&&!s.additionalView).map(s=>s.kind+':'+s.renderedVariant)).size;
  const after=report.cases.flatMap(c=>c.after.shots??[]);
  report.distinctBuildingsCaptured=new Set(after.filter(s=>s.kind!==null&&!s.repeatOf&&!s.additionalView).map(s=>s.kind+':'+s.renderedVariant)).size;
  jsonWrite('D078-capture.json',report);
 }
}

}
