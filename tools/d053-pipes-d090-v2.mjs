// Independent finite D090 selector expectation. This is validation, not product code.
// Exactly four new native water/sewage tools inherit pipe visibility; no new default.
import assert from 'node:assert/strict';
import {catalogueWithD089} from './d089-catalogue-compat.mjs';
const CIVIC=['park','water','wpipe','fire','police','policeBox','hospital','clinic','school','library','post','cemetery','dump','sewage','oilwell','mine','gaswell','megaproject'];
const FOOD=['farm','ranch','bigFarm','greenhouse','foodPlant','market','tradepost'];
export const D090_PIPE_TOOL_ROWS=Object.freeze([
 ['britishCastellatedTank','water'],['britishCircularReservoir','water'],
 ['britishSewageEngine','sewage'],['britishFilterworks','sewage'],
 ['britishTrefoilCemetery','cemetery'],['britishLecternDoocot','heritageDovecote'],
 ['britishTurnpikeLodge','heritageTollhouse'],['britishCruciformForge','heritageSmithy'],
 ['britishSegmentalFirehouse','fire'],['britishSaddleLibrary','library'],
].map(Object.freeze));
export const D090_PIPE_IDS=Object.freeze(['britishCastellatedTank','britishCircularReservoir','britishSewageEngine','britishFilterworks']);
export const D090_PIPE_PRIOR_IDS=Object.freeze(catalogueWithD089([...CIVIC,...FOOD]));
const IDS=Object.freeze([...D090_PIPE_PRIOR_IDS,...D090_PIPE_TOOL_ROWS.map(r=>r[0])]);
export function assertD090PipeCatalogue(rows){assert.ok(Array.isArray(rows));assert.deepEqual(rows.map(r=>[r.tool,r.baseTool]),D090_PIPE_TOOL_ROWS,'all ten independently fixed ID/base-tool pairs, exact order and no missing/duplicate/extra rows');return true;}
export function expectedD090Pipes(id){assert.ok(IDS.includes(id),'known exact86 catalogue ID required');return ['water','wpipe','sewage'].includes(id)||D090_PIPE_IDS.includes(id);}
export function assertD090SelectedPipeState(id,ui,shown){assert.ok(ui&&typeof ui==='object');assert.equal(ui.civicTool,id,'observed selected ID must be the actual activated catalogue entry');assert.equal(ui.tool,FOOD.includes(id)?'food':'civic','actual selected mode remains food/civic');assert.equal(typeof shown,'boolean');assert.equal(shown,expectedD090Pipes(id),'pipe visibility for actual selected '+id);}
