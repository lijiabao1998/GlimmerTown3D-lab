// Exact D100 outer source lease. Runtime imports never use preimages.
import fs from 'node:fs';import {createD100Lease} from './d100-source-contract.mjs';
export * from './d100-source-contract.mjs';
export const D100_MANIFEST_SHA='b2ab45562218139478105e6c3957e1561fb3918e3dd44f576937343084350463';
const lease=createD100Lease(fs.readFileSync(new URL('../fixtures/d100/source.json',import.meta.url),'utf8'),D100_MANIFEST_SHA);
export const {d100PriorSource,d100PriorInventory,d099PriorSource,d099PriorInventory,d090PriorSource,d090PriorInventory,d084PriorSource,d084PriorInventory}=lease;
