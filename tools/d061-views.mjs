// D061 擷取共用：六個畫面（鏡頭同 docs/D061-landscape.md 的基線表）、四個檔位、等鏡頭穩定。tools/d061-capture.mjs 與 tools/d061-legacy-eq.mjs 共用。
import assert from 'node:assert/strict';

// Same cameras as the numbers in docs/D061-landscape.md (the D060 baseline table), so the before column is comparable.
export const D061_VIEWS=[
  {id:'newcity-far',sample:'newcity',x:32,z:32,zoom:1.2,W:1440,H:1000,mobile:false,sky:true},
  {id:'newcity-near',sample:'newcity',x:32,z:32,zoom:4,W:412,H:860,mobile:true},
  {id:'seed516-district',sample:'seed516',x:40.4,z:6.7,zoom:2.56,W:412,H:860,mobile:true},
  {id:'seed516-far',sample:'seed516',x:36,z:36,zoom:1.2,W:1440,H:1000,mobile:false,sky:true},
  {id:'ai120-district',sample:'ai120',x:27.4,z:53.3,zoom:2.56,W:412,H:860,mobile:true},
  {id:'ai120-default',sample:'ai120',x:null,z:null,zoom:null,W:1440,H:1000,mobile:false,sky:true},
];
export const D061_LEVELS=[{id:'legacy',flag:'landArt=legacy',label:'legacy 舊畫法'},{id:'1',flag:'landArt=1',label:'1 細'},{id:'2',flag:'landArt=2',label:'2 中（預設）'},{id:'3',flag:'landArt=3',label:'3 強'}];

export async function settle(p,v) {
  await p.ev(`${v.x===null?'':`__gt.view(${v.x},${v.z},${v.zoom});`}__gt.spin(0);__gt.setVisT(2.2);__gt.setDayFrac(0)`);
  await p.frames(30);let stable=0,last=await p.ev('__gt.cam()');
  for(let i=0;i<24&&stable<2;i++){await p.frames(25);const next=await p.ev('__gt.cam()'),delta=Math.max(...next.pos.map((q,j)=>Math.abs(q-last.pos[j])));stable=delta<1e-9?stable+1:0;last=next;}
  assert.equal(stable,2,'observed a settled camera');
}

