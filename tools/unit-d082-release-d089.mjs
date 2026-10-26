// D089 finite current contract. Original tools/unit-d082-release-d088.mjs remains byte-exact at c023a2da0e4999d43e3d4216e800c4c96d06a3c1.
// D088 finite current contract. Original tools/unit-d082-release-d087.mjs remains byte-exact at cdd541da74973dba2ca73b782936c012d315add9.
// D087 finite current contract. Original tools/unit-d082-release-d086.mjs is unchanged at b4275bda73e72a9fb48343376fccaab52bbc8e84.
// Explicit version migration: original ten runs on its immutable source; current nine
// retains independent geometry/integration and D083 functionality gates.
import assert from 'node:assert/strict';
import {runHistoricalTenQualification} from './d082-historical-release.mjs';
import {d082ReleaseMeshV2} from './d082-release-mesh-v2.mjs';
import {d082ReleaseIntegrationV2} from './d082-release-integration-d089.mjs';
export async function d082Guards(log=()=>{}){
 let failed=0;const report={schema:2,passed:false,tests:[],qualification:'Versioned Node qualification, not real Chromium or release.'};
 try{report.historical=runHistoricalTenQualification({phase:'integration'});assert.equal(report.historical.passed,true);log(true,'D082 immutable original ten geometry, architecture, integration, isolation and browser API');}catch(e){failed++;log(false,'D082 immutable original ten contracts',e.stack);report.historicalError=e.stack;}
 try{report.mesh=d082ReleaseMeshV2(log);assert.equal(report.mesh.passed,true);}catch(e){failed++;log(false,'D082 independent current geometry qualification',e.stack);report.meshError=e.stack;}
 const current=await d082ReleaseIntegrationV2(log);failed+=current.failed;report.current=current.report;report.tests=current.report.tests;report.passed=failed===0;return{failed,report};
}
