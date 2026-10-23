// Local isolated candidate only; normal product config/source remain unchanged.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
const hash=s=>createHash('sha256').update(s).digest('hex');
const receipt=JSON.parse(fs.readFileSync('scratch/d083-plank-proposal/complete-delta-and-physical-proof.json'));
export default defineConfig({base:'./',plugins:[{name:'isolated-granary-plank-candidate',enforce:'pre',transform(code,id){if(id.split('?')[0].replaceAll('\\','/').endsWith('/src/render/d083AcceptedModels.mjs')){assert.ok([receipt.acceptedSourceSha256,receipt.candidateSourceSha256].includes(hash(code)));const candidate=fs.readFileSync('scratch/d083-plank-proposal/candidate-models.mjs','utf8');assert.equal(hash(candidate),receipt.candidateSourceSha256);return{code:candidate,map:null};}}},viteSingleFile()],build:{outDir:path.resolve('scratch/d083-plank-proposal/dist'),target:'es2022',assetsInlineLimit:100_000_000,cssCodeSplit:false,chunkSizeWarningLimit:4000}});
