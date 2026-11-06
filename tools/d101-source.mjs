// Exact D101 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD101Lease} from './d101-source-contract.mjs';
export * from './d101-source-contract.mjs';
export const D101_MANIFEST_SHA='cf1a55bf885c7531c72674ba6848eb98982e9bfd567bfd96247bbcdcb4a74963';
const lease=createD101Lease(fs.readFileSync(new URL('../fixtures/d101/source.json',import.meta.url),'utf8'),D101_MANIFEST_SHA);
export const {d101PriorSource,d101PriorInventory,d102PriorSource,d102PriorInventory,d100PriorSource,d100PriorInventory,d099PriorSource,d099PriorInventory,d090PriorSource,d090PriorInventory,d085PriorSource,d084PriorSource,d084PriorInventory}=lease;
