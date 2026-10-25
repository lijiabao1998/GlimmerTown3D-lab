// Independent frozen expected IDs, not generated from the product catalogue.
import assert from'node:assert/strict';
import{D083_TOOL_IDS,catalogueWithD083}from'./d083-catalogue-compat.mjs';
export{D083_TOOL_IDS};
export const D086_TOOL_IDS=Object.freeze(['britishIronMarket','britishGuildMarket','britishButterMarket','britishWoolExchange','britishCustomsHouse','britishFreeLibrary','britishSortingPost','britishBoardSchool','britishFireStation','britishGardenClinic']);
export const BRITISH_CATALOGUE_IDS=Object.freeze([...D083_TOOL_IDS,...D086_TOOL_IDS]);
export function catalogueWithD086(original25){const prior=catalogueWithD083(original25);assert.equal(prior.length,33);assert.ok(D086_TOOL_IDS.every(id=>!prior.includes(id)));return[...prior,...D086_TOOL_IDS];}
