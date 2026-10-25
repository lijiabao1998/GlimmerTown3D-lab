// Exact V6 one-model source lease; runtime geometry is never projected.
import fs from'node:fs';import{createD086V6Lease}from'./d086-source-v6-contract.mjs';
export{D085_CHANGED,D084_CHANGED,D084_ADDED,D086_MODIFIED,D086_ADDED,D086_CURRENT_PATHS}from'./d086-source-v6-contract.mjs';
export const D086_V6_MANIFEST_SHA='e85742c1d08e053884ab58f994f10ff748395f8b2ed9dfdcd2fb1e42da43b51a';
const lease=createD086V6Lease(fs.readFileSync(new URL('../fixtures/d086/source-v6.json',import.meta.url),'utf8'),D086_V6_MANIFEST_SHA);
export const{d086V6PriorSource,d086PriorSource,d085PriorSource,d084PriorSource,d086PriorInventory,d084PriorInventory}=lease;
