// Exact D102 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD102Lease} from './d102-source-contract.mjs';
export * from './d102-source-contract.mjs';
export const D102_MANIFEST_SHA='238e51ba887a29d7e814204179cb43212b68b02f6e4974d7c8db8b69c91b2de8';
const lease=createD102Lease(fs.readFileSync(new URL('../fixtures/d102/source.json',import.meta.url),'utf8'),D102_MANIFEST_SHA);
export const {d102PriorSource,d102PriorInventory,d100PriorSource,d100PriorInventory,d099PriorSource,d099PriorInventory,d090PriorSource,d090PriorInventory,d085PriorSource,d084PriorSource,d084PriorInventory}=lease;
