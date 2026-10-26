// Finite additive copies checked against actual published190 source.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url)),BASE='5b41bac165ba2b29146e6835490357bebc3cd549',sha=x=>createHash('sha256').update(x).digest('hex');
const specs=[
  [
    "tools/unit-d052-d089.mjs",
    "tools/unit-d052-d090.mjs",
    [
      [
        "MARKET_ESTATE_TOOLS, TOOL_PRICE",
        "MARKET_ESTATE_TOOLS, UTILITY_HERITAGE_TOOLS, TOOL_PRICE",
        2
      ]
    ]
  ],
  [
    "tools/unit-d053-d089.mjs",
    "tools/unit-d053-d090.mjs",
    [
      [
        "MARKET_ESTATE_TOOLS, FACILITY_TOOLS",
        "MARKET_ESTATE_TOOLS, UTILITY_HERITAGE_TOOLS, FACILITY_TOOLS",
        1
      ],
      [
        "import { MARKET_ESTATE_BUILDINGS } from '../src/content/britishMarketEstates.ts';",
        "import { MARKET_ESTATE_BUILDINGS } from '../src/content/britishMarketEstates.ts';\nimport { UTILITY_HERITAGE_BUILDINGS } from '../src/content/britishUtilityHeritage.ts';",
        1
      ],
      [
        "catalogueWithD089",
        "catalogueWithD090",
        2
      ],
      [
        "'./d089-catalogue-compat.mjs'",
        "'./d090-catalogue-compat.mjs'",
        1
      ],
      [
        "assert.equal(summary.total,76); assert.equal(summary.available,i<21?75:76);",
        "assert.equal(summary.total,86); assert.equal(summary.available,i<21?85:86);",
        1
      ],
      [
        "'MARKET_ESTATE_BUILDINGS',strip(source)",
        "'MARKET_ESTATE_BUILDINGS','UTILITY_HERITAGE_BUILDINGS',strip(source)",
        1
      ],
      [
        "PUBLIC_SERVICE_BUILDINGS,MARKET_ESTATE_BUILDINGS);",
        "PUBLIC_SERVICE_BUILDINGS,MARKET_ESTATE_BUILDINGS,UTILITY_HERITAGE_BUILDINGS);",
        1
      ],
      [
        "assert.equal(h.rows().length,76);assert.equal(h.rows().filter(r=>r.dataset.locked==='false').length,75);",
        "assert.equal(h.rows().length,86);assert.equal(h.rows().filter(r=>r.dataset.locked==='false').length,85);",
        1
      ],
      [
        "['heritage',51],['all',76]",
        "['heritage',61],['all',86]",
        1
      ],
      [
        "/76／76",
        "/86／86",
        3
      ],
      [
        "/75／76",
        "/85／86",
        1
      ],
      [
        "actual catalog: 76 rows (original25 plus exact D083 eight, D086ten, D087eleven, D088eleven and D089eleven)",
        "actual catalog: 86 rows (original25 plus exact D083 eight, D086ten, D087eleven, D088eleven, D089eleven and D090ten)",
        1
      ],
      [
        "MARKET_ESTATE_TOOLS=d.MARKET_ESTATE_TOOLS;",
        "MARKET_ESTATE_TOOLS=d.MARKET_ESTATE_TOOLS,UTILITY_HERITAGE_TOOLS=d.UTILITY_HERITAGE_TOOLS;",
        1
      ],
      [
        "PUBLIC_SERVICE_TOOLS,MARKET_ESTATE_TOOLS}),calls",
        "PUBLIC_SERVICE_TOOLS,MARKET_ESTATE_TOOLS,UTILITY_HERITAGE_TOOLS}),calls",
        1
      ]
    ]
  ],
  [
    "tools/unit-d054-ui-d089.mjs",
    "tools/unit-d054-ui-d090.mjs",
    [
      [
        "MARKET_ESTATE_TOOLS, FACILITY_TOOLS",
        "MARKET_ESTATE_TOOLS, UTILITY_HERITAGE_TOOLS, FACILITY_TOOLS",
        2
      ],
      [
        "import * as Site from '../src/ui/siteDiagnostics.ts';",
        "import * as Site from '../src/ui/siteDiagnostics.ts';\nimport {utilityHeritageTool} from '../src/content/britishUtilityHeritage.ts';",
        1
      ],
      [
        "const deps = { ...Site, CIVIC_TOOLS",
        "const deps = { ...Site, utilityHeritageTool, CIVIC_TOOLS",
        1
      ]
    ]
  ],
  [
    "tools/unit-d055-native-d089.mjs",
    "tools/unit-d055-native-d090.mjs",
    [
      [
        "catalogueWithD089",
        "catalogueWithD090",
        2
      ],
      [
        "'./d089-catalogue-compat.mjs'",
        "'./d090-catalogue-compat.mjs'",
        1
      ],
      [
        "new Set(E.FACILITY_TOOLS.map(t=>t.id)).size,76",
        "new Set(E.FACILITY_TOOLS.map(t=>t.id)).size,86",
        1
      ]
    ]
  ],
  [
    "tools/unit-d081-touch-lease-d089.mjs",
    "tools/unit-d081-touch-lease-d090.mjs",
    [
      [
        "'./unit-d052-d089.mjs?d081-touch-lease'",
        "'./unit-d052-d090.mjs?d081-touch-lease'",
        1
      ]
    ]
  ],
  [
    "tools/d082-release-integration-d089.mjs",
    "tools/d082-release-integration-d090.mjs",
    [
      [
        "/fieldStudyLodgeOn, coastalRecreationOn, true, true, true, true\\)/",
        "/fieldStudyLodgeOn, coastalRecreationOn, true, true, true, true, true\\)/",
        1
      ]
    ]
  ],
  [
    "tools/unit-d082-release-d089.mjs",
    "tools/unit-d082-release-d090.mjs",
    [
      [
        "'./d082-release-integration-d089.mjs'",
        "'./d082-release-integration-d090.mjs'",
        1
      ]
    ]
  ]
];
export function writeCopies(specs,out,reason){const copies=[];for(const[source,target,changes,headerOverride]of specs){const original=fs.readFileSync(new URL('../../'+source,import.meta.url),'utf8');assert.equal(original,execFileSync('git',['show',BASE+':'+source],{cwd:ROOT,encoding:'utf8',maxBuffer:32e6}));let result=original;for(const[before,after,count]of changes){assert.equal(result.split(before).length-1,count,target+' exact seam '+before);result=result.split(before).join(after);}const header=headerOverride??'// D090 finite current contract. Original '+source+' remains byte-exact at '+BASE+'.\n';result=header+result;const url=new URL('../../'+target,import.meta.url);if(fs.existsSync(url))assert.equal(fs.readFileSync(url,'utf8'),result,'refuse overwrite changed copy '+target);else fs.writeFileSync(url,result);copies.push({source,target,sourceSha256:sha(original),targetSha256:sha(result),header,changes:changes.map(([before,after,count])=>({before,after,count}))});}const bytes=JSON.stringify({schema:1,baseline:BASE,reason,copies},null,2)+'\n',url=new URL('./'+out,import.meta.url);if(fs.existsSync(url))assert.equal(fs.readFileSync(url,'utf8'),bytes,'refuse changed manifest');else fs.writeFileSync(url,bytes);console.log(JSON.stringify({out,copies:copies.length,sha256:sha(bytes)}));return{copies,bytes};}
writeCopies(specs,'native-guard-versions.json','Exact current86 catalogue dependencies/counts, append-only shape flag, original assertions retained.');
