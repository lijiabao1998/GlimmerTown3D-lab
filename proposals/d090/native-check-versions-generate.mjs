import {writeCopies} from './native-guard-versions-generate.mjs';
writeCopies([
  [
    "proposals/d083/native-integration-check-d089.mjs",
    "proposals/d083/native-integration-check-d090.mjs",
    [
      [
        "assertD089PreD086KindMetadata",
        "assertD090PreD086KindMetadata",
        2
      ],
      [
        "'../../tools/d089-kind-metadata-contract.mjs'",
        "'../../tools/d090-kind-metadata-contract.mjs'",
        1
      ],
      [
        "'scratch/d089-native/d083-current'",
        "'scratch/d090-native/d083-current'",
        1
      ],
      [
        "assertD090PreD086KindMetadata(KINDS.data.kinds.slice(0,baseData.kinds.length),baseData.kinds);",
        "assertD090PreD086KindMetadata(KINDS.data.kinds,withRuralHeritageKinds(baseData).kinds);",
        1
      ]
    ],
    "// D090 finite current contract. Original proposals/d083/native-integration-check-d089.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "proposals/d086/native-variant-check-d089.mjs",
    "proposals/d086/native-variant-check-d090.mjs",
    [
      [
        "checkedD089D086Predecessor",
        "checkedD090D086Predecessor",
        2
      ],
      [
        "'../../tools/d089-kind-metadata-contract.mjs'",
        "'../../tools/d090-kind-metadata-contract.mjs'",
        1
      ],
      [
        "'scratch/d089-native/d086-current'",
        "'scratch/d090-native/d086-current'",
        1
      ]
    ],
    "// D090 finite current contract. Original proposals/d086/native-variant-check-d089.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "tools/d055-capture-d089.mjs",
    "tools/d055-capture-d090.mjs",
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
      ]
    ],
    "// D090 finite current contract. Original tools/d055-capture-d089.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "proposals/d089/native-current-inherited-ui-guards.mjs",
    "proposals/d090/native-current-inherited-ui-guards.mjs",
    [
      [
        "assertD089CurrentGuardVersions",
        "assertD090CurrentGuardVersions",
        2
      ],
      [
        "'../../tools/d089-current-guards.mjs'",
        "'../../tools/d090-current-guards.mjs'",
        1
      ],
      [
        "unit-d052-d089.mjs",
        "unit-d052-d090.mjs",
        1
      ],
      [
        "unit-d054-ui-d089.mjs",
        "unit-d054-ui-d090.mjs",
        1
      ],
      [
        "unit-d081-touch-lease-d089.mjs",
        "unit-d081-touch-lease-d090.mjs",
        1
      ],
      [
        "scratch/d089-native/current-inherited-ui",
        "scratch/d090-native/current-inherited-ui",
        2
      ]
    ],
    "// D090 finite current contract. Original proposals/d089/native-current-inherited-ui-guards.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "proposals/d089/native-current-food-guards.mjs",
    "proposals/d090/native-current-food-guards.mjs",
    [
      [
        "'../../tools/unit-d055-native-d089.mjs'",
        "'../../tools/unit-d055-native-d090.mjs'",
        1
      ]
    ],
    "// D090 finite current contract. Original proposals/d089/native-current-food-guards.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "proposals/d087/native-variant-d089.test.mjs",
    "proposals/d087/native-variant-d090.test.mjs",
    [
      [
        "import{KINDS as D089_CURRENT_KINDS}from'../../src/content/kinds.ts';",
        "import{KINDS as D090_CURRENT_KINDS}from'../../src/content/kinds.ts';\nimport{checkedD090PredecessorTable}from'../../tools/d090-native-support.mjs';\nconst D089_CURRENT_KINDS=checkedD090PredecessorTable(D090_CURRENT_KINDS);",
        1
      ],
      [
        "assert.equal(facilitySummary(0).total,76);assert.equal(facilitySummary(0).available,75);",
        "assert.equal(facilitySummary(0).total,86);assert.equal(facilitySummary(0).available,85);",
        1
      ],
      [
        "new Set(FACILITY_TOOLS.map(m=>m.id)).size,76",
        "new Set(FACILITY_TOOLS.map(m=>m.id)).size,86",
        1
      ],
      [
        "FACILITY_TOOLS.length,76",
        "FACILITY_TOOLS.length,86",
        1
      ]
    ],
    "// D090 finite current contract. Original proposals/d087/native-variant-d089.test.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "proposals/d088/native-integration-d089.test.mjs",
    "proposals/d088/native-integration-d090.test.mjs",
    [
      [
        "import{KINDS as D089_CURRENT_KINDS}from'../../src/content/kinds.ts';",
        "import{KINDS as D090_CURRENT_KINDS}from'../../src/content/kinds.ts';\nimport{checkedD090PredecessorTable}from'../../tools/d090-native-support.mjs';\nconst D089_CURRENT_KINDS=checkedD090PredecessorTable(D090_CURRENT_KINDS);",
        1
      ],
      [
        "assert.equal(facilitySummary(0).total,76);assert.equal(facilitySummary(0).available,75);",
        "assert.equal(facilitySummary(0).total,86);assert.equal(facilitySummary(0).available,85);",
        1
      ],
      [
        "new Set(FACILITY_TOOLS.map(m=>m.id)).size,76",
        "new Set(FACILITY_TOOLS.map(m=>m.id)).size,86",
        1
      ],
      [
        "FACILITY_TOOLS.length,76",
        "FACILITY_TOOLS.length,86",
        1
      ]
    ],
    "// D090 finite current contract. Original proposals/d088/native-integration-d089.test.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "proposals/d088/native-ui-actions-d089.test.mjs",
    "proposals/d088/native-ui-actions-d090.test.mjs",
    [
      [
        "tools/unit-d053-d089.mjs",
        "tools/unit-d053-d090.mjs",
        1
      ],
      [
        "['...WORKING_RURAL_TOOLS, ...PUBLIC_SERVICE_TOOLS, ...MARKET_ESTATE_TOOLS].some','...WORKING_RURAL_TOOLS, ...MARKET_ESTATE_TOOLS].some']",
        "['...WORKING_RURAL_TOOLS, ...PUBLIC_SERVICE_TOOLS, ...MARKET_ESTATE_TOOLS, ...UTILITY_HERITAGE_TOOLS].some','...WORKING_RURAL_TOOLS, ...MARKET_ESTATE_TOOLS, ...UTILITY_HERITAGE_TOOLS].some']",
        1
      ]
    ],
    "// D090 finite current contract. Original proposals/d088/native-ui-actions-d089.test.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "tools/d089-native-catalogue.test.mjs",
    "tools/d089-native-catalogue-d090.test.mjs",
    [
      [
        "import {KINDS} from '../src/content/kinds.ts';",
        "import {KINDS as CURRENT_D090_KINDS} from '../src/content/kinds.ts';\nimport {checkedD090PredecessorTable} from './d090-native-support.mjs';\nconst KINDS=checkedD090PredecessorTable(CURRENT_D090_KINDS);",
        1
      ],
      [
        "assertMarketEstateMetadata();",
        "assertMarketEstateMetadata(KINDS);",
        1
      ],
      [
        "import {catalogueWithD089,D089_TOOL_IDS} from './d089-catalogue-compat.mjs';",
        "import {D089_TOOL_IDS} from './d089-catalogue-compat.mjs';\nimport {catalogueWithD090 as catalogueWithD089} from './d090-catalogue-compat.mjs';",
        1
      ],
      [
        "assert.equal(facilitySummary(0).total,76);assert.equal(facilitySummary(0).available,75);",
        "assert.equal(facilitySummary(0).total,86);assert.equal(facilitySummary(0).available,85);",
        1
      ]
    ],
    "// D090 finite current contract. Original tools/d089-native-catalogue.test.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "tools/d089-native-ui-actions.test.mjs",
    "tools/d089-native-ui-actions-d090.test.mjs",
    [
      [
        "const harnessSource=section(read('tools/unit-d053-d088.mjs'),'function selectionHarness(','function selectionAndCommit(').replace('PUBLIC_SERVICE_TOOLS=d.PUBLIC_SERVICE_TOOLS;','PUBLIC_SERVICE_TOOLS=d.PUBLIC_SERVICE_TOOLS,MARKET_ESTATE_TOOLS=d.MARKET_ESTATE_TOOLS;').replace('WORKING_RURAL_TOOLS,PUBLIC_SERVICE_TOOLS})','WORKING_RURAL_TOOLS,PUBLIC_SERVICE_TOOLS,MARKET_ESTATE_TOOLS})');",
        "const harnessSource=section(read('tools/unit-d053-d090.mjs'),'function selectionHarness(','function selectionAndCommit(');",
        1
      ],
      [
        "['...PUBLIC_SERVICE_TOOLS, ...MARKET_ESTATE_TOOLS].some','...PUBLIC_SERVICE_TOOLS].some']",
        "['...PUBLIC_SERVICE_TOOLS, ...MARKET_ESTATE_TOOLS, ...UTILITY_HERITAGE_TOOLS].some','...PUBLIC_SERVICE_TOOLS, ...UTILITY_HERITAGE_TOOLS].some']",
        1
      ]
    ],
    "// D090 finite current contract. Original tools/d089-native-ui-actions.test.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "tools/d089-native-scene-dispatch.test.mjs",
    "tools/d089-native-scene-dispatch-d090.test.mjs",
    [
      [
        "'marketEstateSlot(b.k,b.v)) ? villageKind'",
        "'marketEstateSlot(b.k,b.v)) && !(shape?.p?.nativeUtilityHeritage === true && utilityHeritageSlot(b.k,b.v)) ? villageKind'",
        2
      ],
      [
        "'true) ? villageKind'",
        "'true) && !(shape?.p?.nativeUtilityHeritage === true && utilityHeritageSlot(b.k,b.v)) ? villageKind'",
        1
      ],
      [
        "'marketEstateSlot(b.k,0)) ? villageKind'",
        "'marketEstateSlot(b.k,0)) && !(shape?.p?.nativeUtilityHeritage === true && utilityHeritageSlot(b.k,b.v)) ? villageKind'",
        1
      ]
    ],
    "// D090 finite current contract. Original tools/d089-native-scene-dispatch.test.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.\n"
  ],
  [
    "tools/d089-native-lifecycle.test.mjs",
    "tools/d089-native-lifecycle-d090.test.mjs",
    [
      [
        "import{KINDS}from'../src/content/kinds.ts';",
        "import{KINDS as D090_CURRENT_KINDS}from'../src/content/kinds.ts';\nimport{checkedD090PredecessorTable}from'./d090-native-support.mjs';\nimport{catalogueWithD090}from'./d090-catalogue-compat.mjs';\nimport{D053_TOOL_IDS}from'./d053-scenes.mjs';\nconst KINDS=checkedD090PredecessorTable(D090_CURRENT_KINDS);",
        1
      ],
      [
        "new Set(FACILITY_TOOLS.map(m=>m.id)).size,76",
        "new Set(FACILITY_TOOLS.map(m=>m.id)).size,86",
        1
      ],
      [
        "FACILITY_TOOLS.length,76",
        "FACILITY_TOOLS.length,86",
        1
      ],
      [
        "assert.equal(facilitySummary(0).total,76);assert.equal(facilitySummary(0).available,75);",
        "assert.equal(facilitySummary(0).total,86);assert.equal(facilitySummary(0).available,85);assert.deepEqual(FACILITY_TOOLS.map(m=>m.id),catalogueWithD090([...D053_TOOL_IDS,...FOOD_TOOLS.map(m=>m.id)]));",
        1
      ]
    ],
    "// D090 current version: all actual200 metadata checked before bounded190 predecessor; exact86 catalogue and unchanged old11 lifecycle assertions.\n"
  ]
],'native-check-versions.json',"Actual current200 metadata validated first; old actual lifecycle/UI/geometry still exercised; only finite current catalogue/harness/source-literal seams.");
