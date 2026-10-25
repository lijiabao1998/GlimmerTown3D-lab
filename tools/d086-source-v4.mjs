// Exact finite V4 source lease; runtime geometry/cameras are never projected.
import fs from'node:fs';import{createD086V4Lease}from'./d086-source-v4-contract.mjs';
export{D085_CHANGED,D084_CHANGED,D084_ADDED,D086_MODIFIED,D086_ADDED,D086_CURRENT_PATHS}from'./d086-source-v4-contract.mjs';
export const D086_V4_MANIFEST_SHA='d4c9971c16a4c8a6e83ff4d0d03de6af21200ae0877fd89d01ad94965718039f';
const lease=createD086V4Lease(fs.readFileSync(new URL('../fixtures/d086/source-v4.json',import.meta.url),'utf8'),D086_V4_MANIFEST_SHA);
export const{d086V4PriorSource,d086PriorSource,d085PriorSource,d084PriorSource,d086PriorInventory,d084PriorInventory}=lease;
