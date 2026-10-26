// Finite additive copies checked against the actual published179 preimages.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url)),BASE='c023a2da0e4999d43e3d4216e800c4c96d06a3c1',sha=x=>createHash('sha256').update(x).digest('hex');
const specs=[
  [
    "tools/unit-d052-d088.mjs",
    "tools/unit-d052-d089.mjs",
    [
      [
        "PUBLIC_SERVICE_TOOLS, TOOL_PRICE",
        "PUBLIC_SERVICE_TOOLS, MARKET_ESTATE_TOOLS, TOOL_PRICE",
        2
      ]
    ]
  ],
  [
    "tools/unit-d053-d088.mjs",
    "tools/unit-d053-d089.mjs",
    [
      [
        "PUBLIC_SERVICE_TOOLS, FACILITY_TOOLS",
        "PUBLIC_SERVICE_TOOLS, MARKET_ESTATE_TOOLS, FACILITY_TOOLS",
        1
      ],
      [
        "import { PUBLIC_SERVICE_BUILDINGS } from '../src/content/britishPublicServices.ts';",
        "import { PUBLIC_SERVICE_BUILDINGS } from '../src/content/britishPublicServices.ts';\nimport { MARKET_ESTATE_BUILDINGS } from '../src/content/britishMarketEstates.ts';",
        1
      ],
      [
        "catalogueWithD088",
        "catalogueWithD089",
        2
      ],
      [
        "'./d088-catalogue-compat.mjs'",
        "'./d089-catalogue-compat.mjs'",
        1
      ],
      [
        "assert.equal(summary.total,65); assert.equal(summary.available,i<21?64:65);",
        "assert.equal(summary.total,76); assert.equal(summary.available,i<21?75:76);",
        1
      ],
      [
        "'PUBLIC_SERVICE_BUILDINGS',strip(source)",
        "'PUBLIC_SERVICE_BUILDINGS','MARKET_ESTATE_BUILDINGS',strip(source)",
        1
      ],
      [
        "WORKING_RURAL_BUILDINGS,PUBLIC_SERVICE_BUILDINGS);",
        "WORKING_RURAL_BUILDINGS,PUBLIC_SERVICE_BUILDINGS,MARKET_ESTATE_BUILDINGS);",
        1
      ],
      [
        "assert.equal(h.rows().length,65);assert.equal(h.rows().filter(r=>r.dataset.locked==='false').length,64);",
        "assert.equal(h.rows().length,76);assert.equal(h.rows().filter(r=>r.dataset.locked==='false').length,75);",
        1
      ],
      [
        "['heritage',40],['all',65]",
        "['heritage',51],['all',76]",
        1
      ],
      [
        "/65／65",
        "/76／76",
        3
      ],
      [
        "/64／65",
        "/75／76",
        1
      ],
      [
        "actual catalog: 65 rows (original25 plus exact D083 eight, D086ten, D087eleven and D088eleven)",
        "actual catalog: 76 rows (original25 plus exact D083 eight, D086ten, D087eleven, D088eleven and D089eleven)",
        1
      ],
      [
        "PUBLIC_SERVICE_TOOLS=d.PUBLIC_SERVICE_TOOLS;",
        "PUBLIC_SERVICE_TOOLS=d.PUBLIC_SERVICE_TOOLS,MARKET_ESTATE_TOOLS=d.MARKET_ESTATE_TOOLS;",
        1
      ],
      [
        "WORKING_RURAL_TOOLS,PUBLIC_SERVICE_TOOLS}),calls",
        "WORKING_RURAL_TOOLS,PUBLIC_SERVICE_TOOLS,MARKET_ESTATE_TOOLS}),calls",
        1
      ]
    ]
  ],
  [
    "tools/unit-d054-ui-d088.mjs",
    "tools/unit-d054-ui-d089.mjs",
    [
      [
        "PUBLIC_SERVICE_TOOLS, FACILITY_TOOLS",
        "PUBLIC_SERVICE_TOOLS, MARKET_ESTATE_TOOLS, FACILITY_TOOLS",
        2
      ]
    ]
  ],
  [
    "tools/unit-d055-native-d088.mjs",
    "tools/unit-d055-native-d089.mjs",
    [
      [
        "catalogueWithD088",
        "catalogueWithD089",
        2
      ],
      [
        "'./d088-catalogue-compat.mjs'",
        "'./d089-catalogue-compat.mjs'",
        1
      ],
      [
        "new Set(E.FACILITY_TOOLS.map(t=>t.id)).size,65",
        "new Set(E.FACILITY_TOOLS.map(t=>t.id)).size,76",
        1
      ]
    ]
  ],
  [
    "tools/unit-d081-touch-lease-d088.mjs",
    "tools/unit-d081-touch-lease-d089.mjs",
    [
      [
        "'./unit-d052-d088.mjs?d081-touch-lease'",
        "'./unit-d052-d089.mjs?d081-touch-lease'",
        1
      ]
    ]
  ],
  [
    "tools/d082-release-integration-d088.mjs",
    "tools/d082-release-integration-d089.mjs",
    [
      [
        "/fieldStudyLodgeOn, coastalRecreationOn, true, true, true\\)/",
        "/fieldStudyLodgeOn, coastalRecreationOn, true, true, true, true\\)/",
        1
      ]
    ]
  ],
  [
    "tools/unit-d082-release-d088.mjs",
    "tools/unit-d082-release-d089.mjs",
    [
      [
        "'./d082-release-integration-d088.mjs'",
        "'./d082-release-integration-d089.mjs'",
        1
      ]
    ]
  ]
];
export function writeCopies(specs,out,reason){const copies=[];for(const[source,target,changes]of specs){const original=fs.readFileSync(new URL('../../'+source,import.meta.url),'utf8');assert.equal(original,execFileSync('git',['show',BASE+':'+source],{cwd:ROOT,encoding:'utf8',maxBuffer:32e6}));let result=original;for(const[before,after,count]of changes){assert.equal(result.split(before).length-1,count,target+' exact seam '+before);result=result.split(before).join(after);}const header='// D089 finite current contract. Original '+source+' remains byte-exact at '+BASE+'.\n';result=header+result;const url=new URL('../../'+target,import.meta.url);if(fs.existsSync(url))assert.equal(fs.readFileSync(url,'utf8'),result,'refuse overwrite changed copy '+target);else fs.writeFileSync(url,result);copies.push({source,target,sourceSha256:sha(original),targetSha256:sha(result),header,changes:changes.map(([before,after,count])=>({before,after,count}))});}const bytes=JSON.stringify({schema:1,baseline:BASE,reason,copies},null,2)+'\n',url=new URL('./'+out,import.meta.url);if(fs.existsSync(url))assert.equal(fs.readFileSync(url,'utf8'),bytes,'refuse changed manifest');else fs.writeFileSync(url,bytes);console.log(JSON.stringify({out,copies:copies.length,sha256:sha(bytes)}));return{copies,bytes};}
writeCopies(specs,'native-guard-versions.json','Exact current76 catalogue dependencies/counts and append-only shape flag; all undeclared inherited assertion bytes retained.');
