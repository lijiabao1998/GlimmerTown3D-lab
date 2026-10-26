// Independent frozen IDs/order, not projected from runtime descriptors.
import assert from 'node:assert/strict';
import {D083_TOOL_IDS,D086_TOOL_IDS,D087_TOOL_IDS,catalogueWithD087} from './d087-catalogue-compat.mjs';
export {D083_TOOL_IDS,D086_TOOL_IDS,D087_TOOL_IDS};
export const D088_TOOL_IDS=Object.freeze(['britishCourtPolice','britishMansardPolice','britishConstableOffice','britishButterflyHospital','britishPavilionHospital','britishHPlanClinic','britishApsidalClinic','britishRadialSchool','britishGardenSchool','britishCrossLibrary','britishStreamlinePost']);
export function catalogueWithD088(original25){const prior=catalogueWithD087(original25);assert.equal(prior.length,54);assert.ok(D088_TOOL_IDS.every(id=>!prior.includes(id)));return[...prior,...D088_TOOL_IDS];}
