// Independent fixed-geometry before/after fixture; no timing gate and no prewarm.
// Exact actual Geo Float64/Float32 words and all five full production scenes.
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{spawnSync}from'node:child_process';
const out='scratch/d086-compile-v3',baseline=out+'/unoptimized',fixture=fs.readFileSync('fixtures/d086/model-pre-compile-v3.mjs');
assert.equal(createHash('sha256').update(fixture).digest('hex'),'87ffff34de755778f2aaecb2191b76d56428cf5f5ff3ea081d125218d4afc61d','independent unoptimized same-geometry source');
assert.ok(!fs.existsSync(out),'preserve first-red/current parity receipt');fs.mkdirSync(out,{recursive:true});fs.mkdirSync(baseline);fs.cpSync('src',baseline+'/src',{recursive:true});fs.symlinkSync(path.resolve('node_modules'),baseline+'/node_modules','dir');fs.writeFileSync(baseline+'/src/render/britishCivicMarketModels.mjs',fixture);
const args=['proposals/d086/compile-optimization-parity.mjs',baseline,'src/render/britishCivicMarketModels.mjs',out+'/optimized'],r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:32e6});fs.writeFileSync(out+'/parity.log',(r.stdout??'')+(r.stderr??''));assert.equal(r.status,0,'complete production geometry parity; see preserved parity.log');assert.equal(r.signal,null);console.log(r.stdout);
