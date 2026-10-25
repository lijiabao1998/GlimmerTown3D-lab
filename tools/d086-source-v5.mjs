// Exact V5 one-model source lease; runtime geometry is never projected.
import fs from'node:fs';import{createD086V5Lease}from'./d086-source-v5-contract.mjs';
export{D085_CHANGED,D084_CHANGED,D084_ADDED,D086_MODIFIED,D086_ADDED,D086_CURRENT_PATHS}from'./d086-source-v5-contract.mjs';
export const D086_V5_MANIFEST_SHA='21531c99a5c40eca167a67352906a9cc6021fa65a53bb8c604bea3441379d785';
const lease=createD086V5Lease(fs.readFileSync(new URL('../fixtures/d086/source-v5.json',import.meta.url),'utf8'),D086_V5_MANIFEST_SHA);
export const{d086V5PriorSource,d086PriorSource,d085PriorSource,d084PriorSource,d086PriorInventory,d084PriorInventory}=lease;
