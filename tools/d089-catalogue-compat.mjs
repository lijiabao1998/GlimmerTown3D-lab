// Independent frozen catalogue IDs/order, never derived from current descriptors.
import assert from 'node:assert/strict';
import {D083_TOOL_IDS,D086_TOOL_IDS,D087_TOOL_IDS,D088_TOOL_IDS,catalogueWithD088} from './d088-catalogue-compat.mjs';
export {D083_TOOL_IDS,D086_TOOL_IDS,D087_TOOL_IDS,D088_TOOL_IDS};
export const D089_TOOL_IDS=Object.freeze(['britishCrossVaultMarket','britishCrescentMarket','britishTriangleCourtMarket','britishCrowstepCounting','britishEllipticalExchange','britishRollerMill','britishEstateCreamery','britishCiderWorks','britishLonghouseFarm','britishDoubleCourtFarm','britishPropagationGlasshouse']);
export function catalogueWithD089(original25){const prior=catalogueWithD088(original25);assert.equal(prior.length,65);assert.ok(D089_TOOL_IDS.every(id=>!prior.includes(id)));return[...prior,...D089_TOOL_IDS];}
