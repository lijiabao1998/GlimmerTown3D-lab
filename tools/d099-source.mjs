// Exact D099 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD099Lease} from './d099-source-contract.mjs';
export * from './d099-source-contract.mjs';
export const D099_MANIFEST_SHA='cedb55e6caa9c2315cbdfe2fc21275942ff97b504e23fe04c73ea0fefbef03b0';
const lease=createD099Lease(fs.readFileSync(new URL('../fixtures/d099/source.json',import.meta.url),'utf8'),D099_MANIFEST_SHA);
export const {d099PriorSource,d099PriorInventory,d090PriorSource,d090PriorInventory,d084PriorSource,d084PriorInventory}=lease;
