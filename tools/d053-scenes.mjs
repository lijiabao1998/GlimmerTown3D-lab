// D053 immutable synthetic save fixtures, shared by original/candidate captures.
// No runtime world mutation; all interactions use trusted CDP input.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { mk } from './d034-cities.mjs';
import { d048ReviewCode, D048_CAMERA, D048_BASELINE_CAMERA, D048_VIEWS, D048_SAVE_KEY } from './d048-scenes.mjs';
export { D048_CAMERA as D053_CAMERA, D048_BASELINE_CAMERA as D053_BASELINE_CAMERA, D048_VIEWS as D053_VIEWS, D048_SAVE_KEY as D053_SAVE_KEY };
export const D053_BASELINE = { commit: '39bfa913ac2e955490448ef52c2f587f9c237101', htmlSha256: '4c3c4e05a2ab5cbdde1b7055593ca8531c0ac7814c7049e6522a6ea4825cb075' };
export const D053_MODES = ['rank6', 'catalog', 'rank8', 'rank12', 'rank17', 'rank21', 'space-rank', 'space-catalog', 'space-build', 'rank-live'];
export const D053_SPACE_SITE = { x: 29, z: 25, size: 3 };
// Center the complete 3×3 construction site; shared by before and candidate.
export const D053_SPACE_CAMERA = { x: 30.5, z: 26.5, zoom: 4.4 };
export const D053_TOOL_IDS = ['park','water','wpipe','fire','police','policeBox','hospital','clinic','school','library','post','cemetery','dump','sewage','oilwell','mine','gaswell','megaproject'];
export const D053_SHOTS = [
  { mode: 'rank6', width: 412, height: 860, scene: 'rank6-current-line' },
  { mode: 'catalog', width: 360, height: 740, scene: 'civic-navigation' },
  { mode: 'space-rank', width: 412, height: 860, scene: 'rank22-space-entry' },
  { mode: 'space-catalog', width: 412, height: 860, scene: 'space-tool-detail' },
  { mode: 'space-build', width: 412, height: 860, scene: 'space-build-result' },
  { mode: 'rank-live', width: 360, height: 740, scene: 'open-rank-after-day' },
];
const hash = s => createHash('sha256').update(s).digest('hex');
export function d053ReviewCode(mode='rank6') {
  assert.ok(D053_MODES.includes(mode), `Unknown D053 fixture: ${mode}`);
  if(mode==='rank-live') return mk(1,50,'城市成長跨日驗收',b=>{b.road(4,30,60,30,3).put(3,30,5);for(let x=10;x<42;x++)b.put(x,29,1,1,{den:3});},{rk:2,money:10000,cms385:{act:'',st:0,acc:0,hold:0,n:0,done:[]}});
  const d=decodeLabCode(d048ReviewCode());assert.equal(d.ok,true);const raw=structuredClone(d.save.raw);
  delete raw.z;delete raw.d3;delete raw.cms3d;
  raw.nm='城市成長導覽驗收';raw.money=10000;
  raw.rk=mode.startsWith('space-')?21:mode==='catalog'?5:Number(mode.slice(4))-1;
  raw.cms385={act:'',st:0,acc:0,hold:0,n:0,done:[]};raw.tech343={act:'',prog:{},done:[]};
  return encodeLabCode(raw,{prefix:true,deflate:true});
}
export function d053FixtureManifest(mode='rank6') {
  const code=d053ReviewCode(mode),d=decodeLabCode(code);assert.equal(d.ok,true);
  return {synthetic:true,injection:'localStorage save fixture before real page load; no runtime world mutation',device:'Chrome CDP touch emulation, or explicit desktop mouse/keyboard; no Android hardware',baseline:D053_BASELINE,mode,cityName:d.save.nm,seed:d.save.seed,day:d.save.day,rankIndex:d.save.raw.rk,paused:true,codeSha256:hash(code),codeLength:code.length,rawCodeSha256:hash(JSON.stringify(d.save.raw)),camera:mode==='space-build'?D053_SPACE_CAMERA:D048_CAMERA,measuredBaselineCamera:mode==='space-build'?null:D048_BASELINE_CAMERA,views:D048_VIEWS,visT:2.2,dayFrac:0,spaceSite:D053_SPACE_SITE,qualification:mode==='rank-live'?'seed1, 32 original level1 density3 houses: original simDay changes day50/Lv3 to day51/Lv4, 169 city points. No runtime rank/pop override.':'Saved rank preserves original only-up rank semantics; points may be below the historical rank threshold. No claim of a naturally played city.'};
}
