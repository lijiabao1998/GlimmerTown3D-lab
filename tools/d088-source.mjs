// Exact D088 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD088Lease} from './d088-source-contract.mjs';
export * from './d088-source-contract.mjs';
export const D088_MANIFEST_SHA='131d75a623e4d6c25af739d073eea3bf6bc7d919d783dde7d61106f0ea380e2c';
const lease=createD088Lease(fs.readFileSync(new URL('../fixtures/d088/source.json',import.meta.url),'utf8'),D088_MANIFEST_SHA);
export const {d088PriorSource,d088PriorInventory,d087PriorSource,d087PriorInventory,d086PriorSource,d085PriorSource,d084PriorSource,d086PriorInventory,d084PriorInventory}=lease;
