// Full original context only. This module never edits source or compiled bytes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {configureReleaseTrace,releaseTraceSummary} from './release-trace.mjs';
const CONDITIONS={
 baseline:{commit:'7ec70a96b01437ab4576b0962905be16b1591e79',tree:'c0395ac4eef9d869056db06e4daca51e89ab3680',html:'d5aabce535e8fbcc7500a7d5473666bc159facb433063dcc69d59245d0d5394d',bytes:1433062},
 formal:{commit:'9e3452a438331feec4082f6821cfcb0b0e653c4b',tree:'22b5bb0fe01364d1b37e52734f472e9bbfdcd25a',html:'ca7d4ca6c434cbbc6a08278b2a90c2d0a0de7a1b351f514e12fe7313b169842d',bytes:1441431},
};
const PINNED={
 'tools/smoke.mjs':'a76445a4766df5c4c26126eee47898d5a0320c28a1da67e74433f61aef98f2f8',
 'tools/smoke-d052.mjs':'1775d0302219894d998df34efe36f3dbcd884d056fe5ab2b5aaa5fc5865654ac',
 'src/ui/panelPress.ts':'2e3011d22cb999a9a6d5366b229861ea6e73438259a369f82e66718a3eb4a422',
};
const [repoArg,condition,outArg,...extra]=process.argv.slice(2);
assert.ok(repoArg&&outArg&&CONDITIONS[condition]&&!extra.length,'usage: node run.mjs SOURCE baseline|formal OUTPUT');
const repo=path.resolve(repoArg),out=path.resolve(outArg),expected=CONDITIONS[condition];
const sha=s=>createHash('sha256').update(s).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
assert.ok(!fs.existsSync(out),'fresh unique observer output is required');fs.mkdirSync(out,{recursive:true});
const manifest={title:'D081 one full historical smoke invocation, observation only',condition,expected,startedAt:new Date().toISOString(),node:process.version,sourceRoot:repo,nonAcceptance:true,transformCount:0,invocations:0,sources:{},limitations:['Observers may perturb timing.','No geometry/hit-test/stack reads; no native interleaving is forced.','Pass does not resolve first-red or constitute a production repair.'],failedBrowser:{product:'Chrome/155.0.8059.39',revision:'@3ff7ac5a9224be9156d7f8703a06e22890aafd34'}};
const persist=()=>fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({...manifest,sessions:releaseTraceSummary()},null,2)+'\n');
process.once('exit',code=>{manifest.exitCode=code;manifest.endedAt=new Date().toISOString();try{
 for(const file of Object.keys(manifest.sources))assert.equal(sha(fs.readFileSync(path.join(repo,file))),manifest.sources[file],`unchanged after execution: ${file}`);
 assert.equal(git('diff','--name-only','HEAD'),'','tracked source unchanged after execution');
 manifest.sourceBytesUnchanged=true;
}catch(error){manifest.integrityError=error.stack;process.exitCode=1;manifest.exitCode=1;}persist();});
persist();
try{
 assert.equal(process.version,'v24.21.0','exact Node version');
 assert.deepEqual(Object.entries(process.env).filter(([k,v])=>v&&/^D\d+[A-Z]*_(SMOKE_ONLY|WIDTHS|VIEWS|PARTS)$/.test(k)),[],'no partial-suite filters');
 manifest.commit=git('rev-parse','HEAD');manifest.tree=git('rev-parse','HEAD^{tree}');
 assert.equal(manifest.commit,expected.commit);assert.equal(manifest.tree,expected.tree);
 assert.equal(git('diff','--name-only','HEAD'),'','source checkout must remain clean');
 for(const [file,pin] of Object.entries({...PINNED,'dist/index.html':expected.html})){
  manifest.sources[file]=sha(fs.readFileSync(path.join(repo,file)));assert.equal(manifest.sources[file],pin,`exact source/HTML pin ${file}`);
 }
 assert.equal(fs.statSync(path.join(repo,'dist/index.html')).size,expected.bytes);
 const inventory=git('ls-files','-z').split('\0').filter(Boolean).map(file=>({file,sha256:sha(fs.readFileSync(path.join(repo,file)))}));
 fs.writeFileSync(path.join(out,'source-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
 const runtimeDir=path.resolve(process.env.D081_RUNTIME_DIR??'');
 assert.ok(process.env.D081_RUNTIME_DIR&&process.env.CHROME_PATH,'explicit verified runtime required');
 const runtime=JSON.parse(fs.readFileSync(path.join(runtimeDir,'runtime-manifest.json'),'utf8'));
 assert.equal(runtime.zipSha256,process.env.D081_ZIP_SHA,'prepared archive digest');
 assert.equal(sha(fs.readFileSync(path.join(runtimeDir,'chrome-linux64.zip'))),runtime.zipSha256);
 for(const file of runtime.files)assert.equal(sha(fs.readFileSync(path.join(runtimeDir,file.path))),file.sha256,`runtime inventory ${file.path}`);
 const chrome=fs.realpathSync(process.env.CHROME_PATH);
 assert.equal(chrome,fs.realpathSync(path.join(runtimeDir,'chrome-linux64/chrome')),'no ambient Chrome fallback');
 assert.equal(sha(fs.readFileSync(chrome)),runtime.chromeSha256);
 const version=execFileSync(chrome,['--version'],{encoding:'utf8'}).trim();
 assert.match(version,/\b155\.0\.8059\.39\b/);
 const font='/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc';
 assert.equal(execFileSync('dpkg-query',['-W','-f=${Version}','fonts-wqy-zenhei'],{encoding:'utf8'}),'0.9.45-8');
 const fontSha=sha(fs.readFileSync(font));assert.equal(fontSha,'79c18ebe7b811951e8311bad7103ebeae8c337ed9988ea69e8a78a66cfe029b9');
 const libraries=binary=>{
  const raw=execFileSync('ldd',[binary],{encoding:'utf8'});
  assert.equal(raw.includes('not found'),false,'all linked library paths resolve');
  const files=[...new Set([...raw.matchAll(/(?:=>\s+|^\s*)(\/[^\s]+)/gm)].map(m=>m[1]))].sort();
  return {raw,files:files.map(file=>({file,sha256:sha(fs.readFileSync(file))}))};
 };
 const cdpSource=fs.readFileSync(path.join(repo,'tools/cdp.mjs'),'utf8');
 const launchStart=cdpSource.indexOf('const chrome = spawn(chromePath, [');
 const launchEnd=cdpSource.indexOf("'about:blank',",launchStart);assert.ok(launchStart>=0&&launchEnd>launchStart);
 const component={artifactId:process.env.D081_RUNTIME_ARTIFACT_ID,artifactDigest:process.env.D081_RUNTIME_ARTIFACT_DIGEST,zipSha256:runtime.zipSha256,chromeSha256:runtime.chromeSha256,node:process.version,nodeSha256:sha(fs.readFileSync(process.execPath)),fontSha256:fontSha,os:fs.readFileSync('/etc/os-release','utf8'),kernel:execFileSync('uname',['-r'],{encoding:'utf8'}).trim(),imageOS:process.env.ImageOS??null,imageVersion:process.env.ImageVersion??null,launchSource:cdpSource.slice(launchStart,launchEnd+14),cdpSha256:sha(cdpSource),chromeLibraries:libraries(chrome).files,nodeLibraries:libraries(process.execPath).files};
 assert.ok(component.artifactId&&component.artifactDigest&&component.imageOS&&component.imageVersion,'runtime artifact and image identity required');
 manifest.runtime={component,chromePath:chrome,executableVersion:version,distribution:'official Chrome for Testing, not byte-verified original Stable'};persist();
 // Original cdp launcher only, about:blank, no navigation, input or altered flags.
 const {withBrowser}=await import(pathToFileURL(path.join(repo,'tools/cdp.mjs')).href);
 let preflightCount=0;
 await withBrowser({root:path.join(repo,'dist')},async({page})=>{
  preflightCount++;const actual=await page.send('Browser.getVersion');manifest.runtime.cdp=actual;persist();
  assert.equal(actual.product,'Chrome/155.0.8059.39');
  assert.equal(actual.revision,'@3ff7ac5a9224be9156d7f8703a06e22890aafd34');
 });
 assert.equal(preflightCount,1);component.cdpProduct=manifest.runtime.cdp.product;component.cdpRevision=manifest.runtime.cdp.revision;
 fs.writeFileSync(path.join(out,'runtime-components.json'),JSON.stringify(component,null,2)+'\n');
 configureReleaseTrace(out);
 const runner=pathToFileURL(path.join(repo,'tools/smoke.mjs')).href;
 const originalCall='await d052Smoke(withBrowser, log)',replacement='await d052Smoke(diagnosticBrowser(withBrowser), log)';
 const added=`import { diagnosticBrowser } from ${JSON.stringify(new URL('./release-trace.mjs',import.meta.url).href)};\n`;
 const hooks=registerHooks({load(url,context,next){const result=next(url,context);if(url!==runner)return result;
  assert.equal(manifest.transformCount,0,'only one full runner load');
  const source=typeof result.source==='string'?result.source:Buffer.from(result.source).toString();
  assert.equal(sha(source),PINNED['tools/smoke.mjs']);assert.equal(source.split(originalCall).length,2);assert.equal(source.includes('diagnosticBrowser'),false);
  const observed=added+source.replace(originalCall,replacement);
  assert.equal(observed.slice(added.length).replace(replacement,originalCall),source,'inverse transform recovers exact original');
  manifest.transformCount++;manifest.transform={addedImport:added,originalCall,replacement,originalSha:sha(source),observedSha:sha(observed)};
  fs.writeFileSync(path.join(out,'smoke.observed.mjs.txt'),observed);persist();return {...result,source:observed};
 }});
 try{manifest.invocations++;assert.equal(manifest.invocations,1);persist();await import(runner);assert.equal(manifest.transformCount,1);manifest.completedNormally=true;}
 finally{hooks.deregister();persist();}
}catch(error){manifest.error={name:error.name,message:error.message,stack:error.stack};persist();throw error;}
