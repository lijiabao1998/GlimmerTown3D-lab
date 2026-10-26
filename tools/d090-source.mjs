// Exact D090 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD090Lease} from './d090-source-contract.mjs';
export * from './d090-source-contract.mjs';
export const D090_MANIFEST_SHA='e30677d68cff47dfead05eac5ac9cde406a1958ebf10942c5f5d0fae8a26f7d0';
const lease=createD090Lease(fs.readFileSync(new URL('../fixtures/d090/source.json',import.meta.url),'utf8'),D090_MANIFEST_SHA);
export const {d090PriorSource,d090PriorInventory,d089PriorSource,d089PriorInventory,d088PriorSource,d088PriorInventory,d087PriorSource,d087PriorInventory,d086PriorSource,d085PriorSource,d084PriorSource,d086PriorInventory,d084PriorInventory}=lease;
