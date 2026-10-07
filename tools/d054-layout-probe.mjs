// D054 independent native geometry probe of immutable ORIGINAL D053 HTML.
// Supports only the verified original build, never derives a baseline from candidate.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {loadD054,d054Select,d054Hash,d054Snapshot,d054World} from './d054-capture.mjs';
import {D054_BASELINE,D054_OPS} from './d054-scenes.mjs';
export const D054_LAYOUT=`(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return[b.left,b.top,b.right,b.bottom,b.width,b.height]},bar=r('#playBar'),seg=r('#spd'),button=r('#spd button'),c=r('#civicSub'),w=r('#civicWrap');return {playHeight:bar[5],segmentHeight:seg[5],segmentButtonHeight:button[5],segmentBorders:[parseFloat(getComputedStyle(document.querySelector('#spd')).borderTopWidth),parseFloat(getComputedStyle(document.querySelector('#spd')).borderBottomWidth)],dock:r('#dock'),playBar:bar,civic:[c[1],c[3]],wrap:[w[1],w[3]],rows:new Set([...document.querySelectorAll('#civicSub button')].map(e=>Math.round(e.getBoundingClientRect().top))).size,buttons:[...document.querySelectorAll('#civicSub button')].map(e=>{const q=e.getBoundingClientRect();return[q.width,q.height,q.left,q.right,q.top,q.bottom]})};})()`;
export async function d054OriginalLayout({root,out=path.join(ROOT,'scratch/shots/D054-original-layout.json')}={}){
 assert.ok(root,'--root must explicitly identify original dist directory');root=path.resolve(root);const bytes=fs.readFileSync(path.join(root,'index.html')),report={phase:'original-only',baseline:D054_BASELINE,htmlSha256:d054Hash(bytes),device:'Original real Chrome with native CDP input; not Android hardware',cases:[],passed:false};assert.equal(report.htmlSha256,D054_BASELINE.htmlSha256,'immutable original HTML required');fs.mkdirSync(path.dirname(out),{recursive:true});
 try{for(const opt of [{W:360,H:740},{W:412,H:860},{W:1280,H:800,mobile:false}])await withBrowser({root,width:Math.max(960,opt.W),height:900},async({page,open})=>{
   const p=await pageSession(page,open,opt);await loadD054(p,'sewage');await d054Select(p,'sewage',opt.mobile!==false);const layout=await p.ev(D054_LAYOUT),at=await p.cell(D054_OPS.sewage.x0,D054_OPS.sewage.z0),hit=await p.hit(at),inputs=await p.ev('__d054Inputs'),state=await d054Snapshot(p);assert.equal(hit,'CANVAS','same original shore remains a usable map target');assert.equal(layout.rows,3);assert.equal(layout.buttons.length,18);assert.ok(inputs.length&&inputs.every(e=>e.trusted));assert.deepEqual(page.errors,[]);assert.deepEqual(page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u)),[]);
   const item={viewport:{width:opt.W,height:opt.H,mobile:opt.mobile!==false},layout,shore:{cell:D054_OPS.sewage,at,hit},camera:await p.ev('__gt.cam()'),worldSha256:d054Hash(d054World(state)),inputs,passed:true};report.cases.push(item);console.log('PASS immutable original layout',JSON.stringify(item.viewport),'playbar',layout.playHeight,'dock',JSON.stringify(layout.dock));
  });report.passed=report.cases.length===3&&report.cases.every(c=>c.passed);return report;
 }finally{fs.writeFileSync(out,JSON.stringify(report,null,2));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const root=process.argv.find(v=>v.startsWith('--root='))?.slice(7),out=process.argv.find(v=>v.startsWith('--out='))?.slice(6);const r=await d054OriginalLayout({root,out});process.exitCode=r.passed?0:1;}
