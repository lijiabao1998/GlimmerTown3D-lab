// Exact D087 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD087Lease} from './d087-source-contract.mjs';
export * from './d087-source-contract.mjs';
export const D087_MANIFEST_SHA='70d26982ac9ccbd133c8207c353e9b2f641cb0b93ea310f8bb8c14cf0d00e2f3';
const lease=createD087Lease(fs.readFileSync(new URL('../fixtures/d087/source.json',import.meta.url),'utf8'),D087_MANIFEST_SHA);
export const {d087PriorSource,d087PriorInventory,d086PriorSource,d085PriorSource,d084PriorSource,d086PriorInventory,d084PriorInventory}=lease;
