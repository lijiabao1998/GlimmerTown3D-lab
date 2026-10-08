// D054 immutable synthetic saves. No live state, money, resource or RNG mutation.
// Same original D053 fixtures/camera/time are used by both screenshot phases.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeLabCode } from '../src/io/labcode.ts';
import { mk } from './d034-cities.mjs';
export const D054_BASELINE = { commit:'74b884fea79afad8909cea606ff8ad3ebdc7fba7', htmlSha256:'0b04a77ac7672de00e01a68cc2fe90c6c7c7faaf77d7eb95abe9fc7a8c5b54cd', sourceFiles:173, sourceTreeSha256:'f1ec3eb25ee035f2cafcc552a051a2d48867a37563afb7d6fd1f6c0bf839a65f' };
export const D054_SAVE_KEY='gt3d.v1.save';
export const D054_MODES=['mixed-pipe','low-road','low-rect','depleted-oil','depleted-mine','sewage'];
export const D054_VIEWS=[{width:360,height:740},{width:412,height:860},{width:1280,height:800,mobile:false}];
export const D054_SHOTS=D054_MODES.flatMap(mode=>[{mode,stage:'preview',width:mode==='mixed-pipe'||mode==='sewage'?360:412,height:mode==='mixed-pipe'||mode==='sewage'?740:860},...(['mixed-pipe','low-road','low-rect'].includes(mode)?[{mode,stage:'result',width:mode==='mixed-pipe'?360:412,height:mode==='mixed-pipe'?740:860}]:[])]);
const op=(tool,x0,z0,x1=x0,z1=z0,k='tap')=>({tool,x0,z0,x1,z1,k});
export const D054_OPS={
 'mixed-pipe':op('wpipe',28,26,33,26,'line'),
 'low-road':op('road',28,26,31,26,'line'),
 'low-rect':op('park',28,26,29,27,'rect'),
 'depleted-oil':op('oilwell',34,22),
 'depleted-mine':op('mine',39,40),
 sewage:op('sewage',31,27),
};
export const d054Camera=mode=>{const o=D054_OPS[mode];assert.ok(o);return {x:(o.x0+o.x1)/2+.5,z:(o.z0+o.z1)/2+.5,zoom:4.4};};
const cms=()=>({act:'',st:0,acc:0,hold:0,n:0,done:[]});
export function d054ReviewCode(mode='mixed-pipe') {
 assert.ok(D054_MODES.includes(mode),'D054 known fixture');
 const p=D054_OPS[mode],depleted=mode.startsWith('depleted-');
 return mk(5166004,150,'建造現場驗收',b=>{
   const cx=depleted?p.x0:30,cz=depleted?p.z0:26;
   b.road(cx-5,cz+6,cx+5,cz+6,3).put(cx-6,cz+6,5).put(cx-3,cz+5,1,1,{v:5}).put(cx+3,cz+5,2,1,{v:2}).put(cx-1,cz+5,4);
   if(mode==='mixed-pipe') {b.pipeAt(29,26).water(30,26,30,26).flag('tre',31,26,1).put(32,26,1,1,{v:5});}
   if(mode==='low-road')b.water(29,26,29,26);
   if(depleted)b.put(p.x0,p.z0,mode==='depleted-oil'?49:50);
   if(mode==='sewage'){b.water(30,26,32,26);b.pipe(26,27,30,27).put(25,27,10);b.put(28,28,1,1,{v:5});}
 },{rk:21,money:mode==='low-road'?30:mode==='low-rect'?180:10000,tech343:{act:'',prog:{},done:[]},cms385:cms(),...(depleted?{rdep:[[p.z0*72+p.x0,240]]}:{rdep:null})});
}
const hash=x=>createHash('sha256').update(x).digest('hex');
export function d054FixtureManifest(mode) {
 const code=d054ReviewCode(mode),decoded=decodeLabCode(code);assert.ok(decoded.ok);
 return {mode,synthetic:true,injection:'localStorage fixture loaded before page creation; no runtime world mutation',device:'real Chrome CDP touch emulation or explicit native desktop mouse/keyboard; no Android hardware',baseline:D054_BASELINE,seed:decoded.save.seed,day:decoded.save.day,money:decoded.save.money,paused:true,codeSha256:hash(code),rawSha256:hash(JSON.stringify(decoded.save.raw)),camera:d054Camera(mode),visT:2.2,dayFrac:0,operation:D054_OPS[mode],preparation:mode.startsWith('depleted-')?'Genuine native demolition of saved exhausted matching well, then select same well tool. RDEP remains240.':'Original saved fixture only',qualification:'Synthetic authored city, not claimed naturally played. Saved historical rank22 unlocks original tools. All simulator behavior is original.'};
}
