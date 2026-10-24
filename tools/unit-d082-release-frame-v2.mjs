// Both immutable ten-model and current accepted-nine frame contracts are mandatory.
// This is Node qualification only; real Chromium captures remain a separate gate.
import assert from 'node:assert/strict';
import {runHistoricalTenQualification} from './d082-historical-release.mjs';
import {d082ReleaseFrameV2} from './d082-release-frame-v2.mjs';
import {d082ReleaseScenesV2} from './d082-release-scenes-v2.mjs';
import {d082ReleaseCapturePlanV2} from './d082-release-capture-plan-v2.mjs';
export async function d082FrameGuards(log=()=>{}){
 let failed=0;const report={schema:2,passed:false,tests:[],qualification:'Versioned Node frames and exact capture planning, not browser pixels or release.'};
 const check=(name,fn)=>{try{const value=fn();assert.equal(value.passed,true,name);report.tests.push({name,passed:true,value});log(true,name);return value;}catch(error){failed++;report.tests.push({name,passed:false,error:error.stack});log(false,name,error.stack);return null;}};
 report.historical=check('D082 immutable original ten full frame and surface contracts',()=>runHistoricalTenQualification({phase:'frame'}));
 report.runtime=check('D082 accepted-nine exact whole-scene budget and camera arithmetic',()=>d082ReleaseFrameV2());
 report.scenes=check('D082 accepted-nine full three-mode forced scenes and non-target invariance',()=>d082ReleaseScenesV2());
 report.surface=check('D082 accepted-nine exact capture planner, nine slots and three widths',()=>{const r=d082ReleaseCapturePlanV2({log});assert.equal(r.rows.length,27,'all nine slots at three original viewport widths');return r;});
 report.passed=failed===0;return{failed,report};
}
