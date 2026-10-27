// Exact D090 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD090Lease} from './d090-source-contract.mjs';
export * from './d090-source-contract.mjs';
export const D090_MANIFEST_SHA='8d32f362f2266c70178af8df7fa3bff668b1ad2ceaa5d128d16e258a8f931b1c';
const lease=createD090Lease(fs.readFileSync(new URL('../fixtures/d090/source.json',import.meta.url),'utf8'),D090_MANIFEST_SHA);
export const {d090PriorSource,d090PriorInventory,d089PriorSource,d089PriorInventory,d088PriorSource,d088PriorInventory,d087PriorSource,d087PriorInventory,d086PriorSource,d085PriorSource,d084PriorSource,d086PriorInventory,d084PriorInventory}=lease;
