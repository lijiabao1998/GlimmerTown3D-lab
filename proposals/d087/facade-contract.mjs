// New D087 raw-intent observation seam; original D086 verifier/thresholds unchanged.
import{authoritativeProceduralSource}from'./precompiled-cache.mjs';import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{assertFacadeImprint,facadeNegatives}from'./facade-imprint-geometry.mjs';
export{assertFacadeImprint,facadeNegatives};
export const INTENTS=[27,27,22,18,45,49,56,55,49,51,76];
export async function rawFacadeReference(){const path=new URL('../../src/render/britishWorkingRuralModels.mjs',import.meta.url),bytes=fs.readFileSync(path),source=authoritativeProceduralSource(bytes.toString()),from='freezeModel(imprintFacades(BUILDERS[i]()))',to='freezeModel(BUILDERS[i]())';assert.equal(source.split(from).length,2);assert.equal(source.split("from 'three'").length,2);const raw=source.replace(from,to).replace("from 'three'","from "+JSON.stringify(import.meta.resolve('three')));return{sourceSha256:createHash('sha256').update(bytes).digest('hex'),module:await import('data:text/javascript;base64,'+Buffer.from(raw).toString('base64'))};}
