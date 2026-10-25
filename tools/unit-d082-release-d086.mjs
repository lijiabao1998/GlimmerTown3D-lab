// Explicit version migration: original ten runs on its immutable source; current nine
// retains independent geometry/integration and D083 functionality gates.
import assert from 'node:assert/strict';
import {runHistoricalTenQualification} from './d082-historical-release.mjs';
import {d082ReleaseMeshV2} from './d082-release-mesh-v2.mjs';
import {d082ReleaseIntegrationV2} from './d082-release-integration-d086.mjs';
export async function d082Guards(log=()=>{}){
 let failed=0;const report={schema:2,passed:false,tests:[],qualification:'Versioned Node qualification, not real Chromium or release.'};
 try{report.historical=runHistoricalTenQualification({phase:'integration'});assert.equal(report.historical.passed,true);log(true,'D082 immutable original ten geometry, architecture, integration, isolation and browser API');}catch(e){failed++;log(false,'D082 immutable original ten contracts',e.stack);report.historicalError=e.stack;}
 try{report.mesh=d082ReleaseMeshV2(log);assert.equal(report.mesh.passed,true);}catch(e){failed++;log(false,'D082 independent current geometry qualification',e.stack);report.meshError=e.stack;}
 const current=await d082ReleaseIntegrationV2(log);failed+=current.failed;report.current=current.report;report.tests=current.report.tests;report.passed=failed===0;return{failed,report};
}
