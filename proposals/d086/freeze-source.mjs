// Explicit finite source lease authoring, before review only; never called by runtime or CI.
import fs from'node:fs';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
const baseline='77b8616382f6115711b2b8eb39735a769b859cde',sha=x=>createHash('sha256').update(x).digest('hex');
const modified=['src/cityView.ts','src/content/kindShapes.ts','src/content/kinds.ts','src/render/kindArt.ts','src/sim/edit.ts','src/ui/growthGuide.ts'];
const added=['src/content/britishCivicMarkets.ts','src/render/britishCivicMarketArt.ts','src/render/britishCivicMarketModels.d.mts','src/render/britishCivicMarketModels.mjs','src/sim/nativeArtVariant.ts'];
const baselineFiles=execFileSync('git',['ls-tree','-r','--name-only',baseline,'src']).toString().trim().split('\n').sort();
const currentFiles=fs.readdirSync('src',{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>e.parentPath+'/'+e.name).sort();
if(JSON.stringify(currentFiles)!==JSON.stringify([...baselineFiles,...added].sort()))throw Error('D086 source inventory is not the exact declared additions');
const m={schema:1,baseline,modified:{},added:{},baselineFiles,currentFiles};for(const f of baselineFiles){const b=execFileSync('git',['show',baseline+':'+f],{maxBuffer:32e6}).toString(),a=fs.readFileSync(f,'utf8');if(modified.includes(f))m.modified[f]={before:b,beforeSha256:sha(b),afterSha256:sha(a)};else if(a!==b)throw Error('Undeclared source edit '+f);}for(const f of added)m.added[f]=sha(fs.readFileSync(f));
const text=JSON.stringify(m,null,2)+'\n';fs.writeFileSync('fixtures/d086/source-v1.json',text);console.log(sha(text));
