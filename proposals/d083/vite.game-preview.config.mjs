import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
const root=process.cwd(),target=path.join(root,'src/render/cityScene.ts').replaceAll('\\','/'),source=fs.readFileSync(target,'utf8'),pin=createHash('sha256').update(source).digest('hex');
const token='  return {\n    scene, pick, timing: T,';if(source.split(token).length!==2)throw new Error('Original scene return must be exact and unique');
export default defineConfig({base:'./',plugins:[{name:'d083-local-scene-only',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/')!==target)return null;if(createHash('sha256').update(code).digest('hex')!==pin)throw new Error('Original scene changed during preview build');return {code:"import {installD083GamePreview} from '../../proposals/d083/game-preview.ts';\n"+code.replace(token,"  installD083GamePreview(scene,c,top,otherMesh,disposables);\n"+token),map:null};}},viteSingleFile()],build:{outDir:'scratch/d083-game-dist',emptyOutDir:true,target:'es2022',assetsInlineLimit:100000000,cssCodeSplit:false,chunkSizeWarningLimit:4000}});
