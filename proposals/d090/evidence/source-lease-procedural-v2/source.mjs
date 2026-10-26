// Exact D090 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD090Lease} from './d090-source-contract.mjs';
export * from './d090-source-contract.mjs';
export const D090_MANIFEST_SHA='9098ad54802b1ab9d0e783be59706020ea5d0acfb1caf89cacba0ccf9406890e';
const lease=createD090Lease(fs.readFileSync(new URL('../fixtures/d090/source.json',import.meta.url),'utf8'),D090_MANIFEST_SHA);
export const {d090PriorSource,d090PriorInventory,d089PriorSource,d089PriorInventory,d088PriorSource,d088PriorInventory,d087PriorSource,d087PriorInventory,d086PriorSource,d085PriorSource,d084PriorSource,d086PriorInventory,d084PriorInventory}=lease;
