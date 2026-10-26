// Exact D089 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD089Lease} from './d089-source-contract.mjs';
export * from './d089-source-contract.mjs';
export const D089_MANIFEST_SHA='c7860f157c826a41bb7548a39e470f37f43b511c51dc1f6a3ca0aa80a66f9dce';
const lease=createD089Lease(fs.readFileSync(new URL('../fixtures/d089/source.json',import.meta.url),'utf8'),D089_MANIFEST_SHA);
export const {d089PriorSource,d089PriorInventory,d088PriorSource,d088PriorInventory,d087PriorSource,d087PriorInventory,d086PriorSource,d085PriorSource,d084PriorSource,d086PriorInventory,d084PriorInventory}=lease;
