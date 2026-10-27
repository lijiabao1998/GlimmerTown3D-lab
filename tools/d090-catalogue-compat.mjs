// Independent frozen catalogue IDs/order, never derived from current descriptors.
import assert from 'node:assert/strict';
import {D083_TOOL_IDS,D086_TOOL_IDS,D087_TOOL_IDS,D088_TOOL_IDS,D089_TOOL_IDS,catalogueWithD089} from './d089-catalogue-compat.mjs';
export {D083_TOOL_IDS,D086_TOOL_IDS,D087_TOOL_IDS,D088_TOOL_IDS,D089_TOOL_IDS};
export const D090_TOOL_IDS=Object.freeze(['britishCastellatedTank','britishCircularReservoir','britishSewageEngine','britishFilterworks','britishTrefoilCemetery','britishLecternDoocot','britishTurnpikeLodge','britishCruciformForge','britishSegmentalFirehouse','britishSaddleLibrary']);
export function catalogueWithD090(original25){const prior=catalogueWithD089(original25);assert.equal(prior.length,76);assert.ok(D090_TOOL_IDS.every(id=>!prior.includes(id)));return[...prior,...D090_TOOL_IDS];}
