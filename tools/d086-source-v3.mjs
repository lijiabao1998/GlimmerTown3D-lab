// Exact finite V3 source lease; runtime geometry/cameras are never projected.
import fs from'node:fs';import{createD086V3Lease}from'./d086-source-v3-contract.mjs';
export{D085_CHANGED,D084_CHANGED,D084_ADDED,D086_MODIFIED,D086_ADDED,D086_CURRENT_PATHS}from'./d086-source-v3-contract.mjs';
export const D086_V3_MANIFEST_SHA='2ca52c74a615948ad9f6a4c34c1ae1bdba3b990cf2aeb102548fb83182a9a5b3';
const lease=createD086V3Lease(fs.readFileSync(new URL('../fixtures/d086/source-v3.json',import.meta.url),'utf8'),D086_V3_MANIFEST_SHA);
export const{d086V3PriorSource,d086PriorSource,d085PriorSource,d084PriorSource,d086PriorInventory,d084PriorInventory}=lease;
