import {writeCopies} from './native-guard-versions-generate.mjs';
writeCopies([
 ['proposals/d083/native-integration-check-d087.mjs','proposals/d083/native-integration-check-d088.mjs',[
 ['assertD087KindMetadata','assertD088KindMetadata',2],["'../../tools/d087-kind-metadata-contract.mjs'","'../../tools/d088-kind-metadata-contract.mjs'",1],["'scratch/d087-native/d083-current'","'scratch/d088-native/d083-current'",1]]],
 ['proposals/d086/native-variant-check-d087.mjs','proposals/d086/native-variant-check-d088.mjs',[
 ['checkedD087Predecessor','checkedD088D086Predecessor',2],["'../../tools/d087-kind-metadata-contract.mjs'","'../../tools/d088-kind-metadata-contract.mjs'",1],["'scratch/d087-native/d086-current'","'scratch/d088-native/d086-current'",1]]],
 ['tools/d055-capture-d087.mjs','tools/d055-capture-d088.mjs',[
 ['catalogueWithD087','catalogueWithD088',2],["'./d087-catalogue-compat.mjs'","'./d088-catalogue-compat.mjs'",1]]],
 ['proposals/d087/native-current-inherited-ui-guards.mjs','proposals/d088/native-current-inherited-ui-guards.mjs',[
 ['assertD087CurrentGuardVersions','assertD088CurrentGuardVersions',2],["'../../tools/d087-current-guards.mjs'","'../../tools/d088-current-guards.mjs'",1],['unit-d052-d087.mjs','unit-d052-d088.mjs',1],['unit-d054-ui-d087.mjs','unit-d054-ui-d088.mjs',1],['unit-d081-touch-lease-d087.mjs','unit-d081-touch-lease-d088.mjs',1],['scratch/d087-native/current-inherited-ui','scratch/d088-native/current-inherited-ui',2]]],
 ['proposals/d087/native-current-food-guards.mjs','proposals/d088/native-current-food-guards.mjs',[["'../../tools/unit-d055-native-d087.mjs'","'../../tools/unit-d055-native-d088.mjs'",1]]],
 ['proposals/d087/native-variant.test.mjs','proposals/d087/native-variant-d088.test.mjs',[
 ["import{KINDS}from'../../src/content/kinds.ts';","import{KINDS}from'../../src/content/kinds.ts';\nimport{assertPublicServiceMetadata,BASE_DATA as D088_PRIOR_DATA,BASE_KINDS as D088_PRIOR_KINDS}from'../d088/native-integration-check.mjs';\nimport{checkedD088Predecessor}from'../../tools/d088-kind-metadata-contract.mjs';",1],
 ["test('eleven exact frozen descriptors are independent of scope; registry is append-only',()=>{", "test('eleven exact frozen descriptors are independent of scope; registry is append-only',()=>{assertPublicServiceMetadata();const prior=checkedD088Predecessor(KINDS.data.kinds,D088_PRIOR_DATA.kinds);return ((KINDS)=>{",1],
 ["assert.equal(facilitySummary(0).total,54);assert.equal(facilitySummary(0).available,53);\n});", "assert.equal(facilitySummary(0).total,65);assert.equal(facilitySummary(0).available,64);\n})({...D088_PRIOR_KINDS,data:{...D088_PRIOR_DATA,kinds:prior}});});",1],
 ['new Set(FACILITY_TOOLS.map(m=>m.id)).size,54','new Set(FACILITY_TOOLS.map(m=>m.id)).size,65',1],['FACILITY_TOOLS.length,54','FACILITY_TOOLS.length,65',1]]],
], 'native-check-versions.json','Exact old-native metadata validation followed only by finite checked predecessor for historical row assertions; every runtime behavior continues on actual current app. Current catalogue/capture/receipt seams only.');
