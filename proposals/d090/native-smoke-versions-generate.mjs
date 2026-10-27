import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';import{writeCopies}from'./native-guard-versions-generate.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const result=writeCopies([
  [
    "tools/smoke-d053-d089.mjs",
    "tools/smoke-d053-d090.mjs",
    [
      [
        "from './d053-capture-d089.mjs';",
        "from './d053-capture-d090.mjs';",
        1
      ],
      [
        "import { D087_TOOL_IDS, D088_TOOL_IDS, D089_TOOL_IDS, catalogueWithD089 as catalogueWithD086 } from './d089-catalogue-compat.mjs';",
        "import { D087_TOOL_IDS, D088_TOOL_IDS, D089_TOOL_IDS, D090_TOOL_IDS, catalogueWithD090 as catalogueWithD086 } from './d090-catalogue-compat.mjs';",
        1
      ],
      [
        "Object.freeze([...D086_BRITISH_CATALOGUE_IDS,...D087_TOOL_IDS,...D088_TOOL_IDS,...D089_TOOL_IDS]);",
        "Object.freeze([...D086_BRITISH_CATALOGUE_IDS,...D087_TOOL_IDS,...D088_TOOL_IDS,...D089_TOOL_IDS,...D090_TOOL_IDS]);",
        1
      ]
    ]
  ],
  [
    "tools/d053-capture-d089.mjs",
    "tools/d053-capture-d090.mjs",
    [
      [
        "import {catalogueWithD089 as catalogueWithD086} from './d089-catalogue-compat.mjs';",
        "import {catalogueWithD090 as catalogueWithD086} from './d090-catalogue-compat.mjs';",
        1
      ],
      [
        "'D089 exact retained65 then new11 catalogue order'",
        "'D090 exact retained76 then new10 catalogue order'",
        1
      ],
      [
        "'tools/d089-catalogue-compat.mjs'",
        "'tools/d089-catalogue-compat.mjs','tools/d053-capture-d090.mjs','tools/smoke-d053-d090.mjs','tools/d090-catalogue-compat.mjs'",
        1
      ]
    ]
  ]
], 'native-smoke-copies.json','Only exact76+10 catalogue/capture and source inventory seams; every original smoke interaction and threshold retained.');
const file='tools/smoke.mjs',before="import { d053Smoke } from './smoke-d053-d089.mjs';",after="import { d053Smoke } from './smoke-d053-d090.mjs';",original=execFileSync('git',['show','5b41bac165ba2b29146e6835490357bebc3cd549:'+file],{cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8'});assert.equal(original.split(before).length-1,1);assert.ok([original,original.replace(before,after)].includes(fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8')),'root is exact old or exact bounded current route');const rootRoute={file,before,after,count:1,sourceSha256:sha(original),targetSha256:sha(original.replace(before,after))};
const m={...JSON.parse(result.bytes),rootRoute},bytes=JSON.stringify(m,null,2)+'\n',url=new URL('./native-smoke-versions.json',import.meta.url);if(fs.existsSync(url))assert.equal(fs.readFileSync(url,'utf8'),bytes);else fs.writeFileSync(url,bytes);console.log(JSON.stringify({manifest:sha(bytes),rootRoute}));
