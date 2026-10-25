// Independent finite expected IDs; not derived from product descriptors.
import assert from'node:assert/strict';
import{D083_TOOL_IDS,D086_TOOL_IDS,catalogueWithD086}from'./d086-catalogue-compat.mjs';
export{D083_TOOL_IDS,D086_TOOL_IDS};
export const D087_TOOL_IDS=Object.freeze(['britishEngineFarm','britishDairyFarm','britishBankBarn','britishStonePiggery','britishModelFarm','britishCurvedGlasshouse','britishRidgeGlasshouse','britishBayGlasshouse','britishMaltings','britishSmokingWorks','britishConfectioneryWorks']);
export function catalogueWithD087(original25){const prior=catalogueWithD086(original25);assert.equal(prior.length,43);assert.ok(D087_TOOL_IDS.every(id=>!prior.includes(id)));return[...prior,...D087_TOOL_IDS];}
