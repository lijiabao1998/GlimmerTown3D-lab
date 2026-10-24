import {build} from 'vite';
import {resolve} from 'node:path';
await build({configFile:false,root:resolve('tools/d082'),base:'./',build:{outDir:resolve('scratch/d082-review'),emptyOutDir:true,target:'es2022'}});
