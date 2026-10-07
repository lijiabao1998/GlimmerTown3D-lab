// D053: actual growth-guide modules plus shipped cityView selection functions.
// DOM/event doubles are Node boundary evidence, never native Chrome/Android proof.
// Rules, previews, commits, undo, saves, RNG and uninterrupted daily steps are real.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { d044Load, BLOCKS } from './d044-cities.mjs';
import { d045Load } from './d045-cities.mjs';
import { stepDay } from '../src/sim/day.ts';
import { saveCode, loadCode } from '../src/io/save.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { CIVIC_TOOLS, toolLock, toolSize, gestureOf, labToolOf, previewOp, commitOp, undoOp } from '../src/sim/edit.ts';
import { COST } from '../src/sim/rules/build.ts';
import { RANKS, rankStep, rankOfSave } from '../src/sim/rules/rank.ts';
import * as Guide from '../src/ui/growthGuide.ts';
import { createMapClickGuard } from '../src/ui/mapClickGuard.ts';

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const helperSource = read('src/ui/growthGuide.ts'), catalogSource = read('src/ui/facilityCatalog.ts');
const citySource = read('src/cityView.ts');
const strip = source => stripTypeScriptTypes(source).replace(/^import .*?;\s*$/gm, '').replace(/\bexport (?=(?:function|const)\b)/g, '');
const section = (s, start, end) => {
  assert.equal(s.split(start).length, 2, 'unique source boundary: ' + start);
  const from = s.indexOf(start), to = s.indexOf(end, from);
  assert.ok(to > from, 'closing source boundary: ' + end); return s.slice(from, to);
};
const change = (source, from, to) => {
  assert.equal(source.split(from).length, 2, 'unique mutation target: ' + from);
  return source.replace(from, () => to);
};
const stateBytes = value => JSON.stringify(value, (_key, v) => {
  if (v instanceof Map) return { map: [...v] };
  if (v instanceof Set) return { set: [...v] };
  if (ArrayBuffer.isView(v)) return { type: v.constructor.name, bytes: [...new Uint8Array(v.buffer, v.byteOffset, v.byteLength)] };
  if (v instanceof ArrayBuffer) return { bytes: [...new Uint8Array(v)] };
  if (typeof v === 'function') return { function: String(v) };
  if (typeof v === 'number' && !Number.isFinite(v)) return { number: String(v) };
  return v;
});
const raw = fixture => stateBytes(fixture.sim);
const saved = fixture => saveCode(fixture.sim, fixture.template, fixture.start);
const op = (tool, x, z, x1 = x, z1 = z) => ({ k: gestureOf(tool), tool, x0: x, z0: z, x1, z1 });
const tool = id => CIVIC_TOOLS.find(t => t.id === id);
const instrumentRng = sim => {
  const calls = [];
  for (const key of ['R', 'ri']) {
    const original = sim.rng[key];
    sim.rng[key] = (...args) => { const result = original(...args); calls.push([key, args, result]); return result; };
  }
  return calls;
};

// Independent, pre-D053 tool metadata: do not generate expected values from UI.
const TOOLS = [
  ['park', '公園', '園', 60, 'service', 'rect'], ['water', '水塔', '水', 400, 'utility', 'tap'],
  ['wpipe', '配水管', '管', 10, 'utility', 'line'], ['fire', '消防局', '消', 400, 'service', 'tap'],
  ['police', '警察局', '警', 500, 'service', 'tap'], ['policeBox', '派出所', '派', 250, 'service', 'tap'],
  ['hospital', '醫院', '醫', 600, 'service', 'tap'], ['clinic', '診所', '診', 250, 'service', 'tap'],
  ['school', '學校', '學', 350, 'service', 'tap'], ['library', '圖書館', '圖', 280, 'service', 'tap'],
  ['post', '郵局', '郵', 320, 'service', 'tap'], ['cemetery', '墓園', '墓', 350, 'service', 'tap'],
  ['dump', '垃圾場', '垃', 300, 'utility', 'tap'], ['sewage', '污水廠', '污', 500, 'utility', 'tap'],
  ['oilwell', '油井', '油', 1300, 'resource', 'tap'], ['mine', '礦場', '礦', 1500, 'resource', 'tap'],
  ['gaswell', '天然氣井', '氣', 1400, 'resource', 'tap'], ['megaproject', '太空研究中心', '太', 4500, 'resource', 'tap'],
];
const RANK_NAMES = ['拓荒營地','邊陲聚落','溪畔村落','阡陌村莊','磚瓦小鎮','集市小鎮','石橋鎮','通衢鎮','燈火小城','繁景小城','匠坊之城','商旅之城','學府之城','港灣之城','花園之城','星軌之城','雲塔之城','千帆之都','萬家之都','燈海都會','環帶都會','穹頂都會','星穹大都會','永晝大都會','織夢都會','微光之巔'];
const RANK_POINTS = [0,30,80,160,280,450,680,980,1360,1830,2400,3080,3880,4810,5880,7100,8480,10030,11760,13680,15800,18130,20680,23460,26480,29750];
const ORIGINAL_NOTES = {
  5: '解鎖：文化建築（博物館/劇院/水族館/動物園/遊樂園/電影院/圖書總館）',
  7: '解鎖：小型地標（鐘樓/風車/噴泉/涼亭/燈塔/碼頭亭…）', 11: '解鎖：研究院',
  16: '解鎖：紀念工程（天文台/觀景塔/紀念碑/凱旋門/摩天輪/旋轉木馬）',
  21: '解鎖：太空研究中心', 25: '城市巔峰榮耀：全城住宅幸福 +2%（永久）',
};
function metadata(guide = Guide) {
  assert.deepEqual(CIVIC_TOOLS.map(t => [t.id,t.name,t.short,t.cost]), TOOLS.map(t => t.slice(0,4)));
  assert.deepEqual(Object.keys(guide.FACILITY_NOTES).sort(), TOOLS.map(t => t[0]).sort(), 'exactly all 18 real tools, without invented entries');
  assert.deepEqual(guide.FACILITY_GROUPS, [{id:'all',name:'全部'},{id:'service',name:'生活服務'},{id:'utility',name:'城市管線'},{id:'resource',name:'資源研究'}]);
  for (const [id,name,short,cost,group,gesture] of TOOLS) {
    const t = tool(id);
    assert.equal(COST[id],cost,id+' unchanged original price'); assert.equal(t.name,name); assert.equal(t.short,short);
    assert.equal(gestureOf(id),gesture); assert.equal(labToolOf('civic','road',id),id);
    assert.equal(toolSize(id),id==='megaproject'?3:1);
    for (let rankIdx=0;rankIdx<26;rankIdx++) for (const sandbox of [false,true]) {
      const p = guide.facilityPresentation(t,rankIdx,sandbox), locked = id==='megaproject' && rankIdx<21;
      assert.equal(p.group,group,id+' group'); assert.equal(p.locked,locked,id+' rank '+rankIdx);
      assert.equal(p.status,locked?'Lv.22 開放':'等級可選');
      assert.equal(p.unit,id==='wpipe'?'每格・拉線':id==='park'?'每格1×1・框選':id==='megaproject'?'3×3・點放':'1×1・點放');
      assert.ok(p.price.includes('基價 $'+cost.toLocaleString('en-US')),id+' must retain original base price even in sandbox');
      if(sandbox)assert.match(p.price,/沙盒 \$0/);else assert.doesNotMatch(p.price,/沙盒/);
      assert.ok(p.use.length>3 && p.placement.length>6,id+' non-empty purpose and placement');
      assert.equal(!!toolLock({rankIdx,diff:sandbox?3:1},id),p.locked,id+' matches authoritative selection lock, including sandbox');
    }
  }
  const notes = guide.FACILITY_NOTES;
  for(const id of ['park','fire','police','policeBox','hospital','clinic','school','library','post','cemetery'])assert.match(notes[id].use,/覆蓋/);
  assert.match(notes.park.placement,/拖.*範圍/); assert.match(notes.wpipe.placement,/道路、分區與建築下方/);
  assert.match(notes.wpipe.placement,/已有水管.*略過/); assert.match(notes.sewage.placement,/3×3.*2格水域/);
  assert.match(notes.sewage.placement,/交通線.*電力走廊/);
  for(const id of ['oilwell','gaswell'])assert.match(notes[id].placement,/油田.*黃色/);
  assert.match(notes.mine.placement,/礦藏.*藍色/); assert.match(notes.megaproject.placement,/3×3陸地/);
  assert.match(notes.megaproject.placement,/道路或建築/);
  return '18 exact tools × 26 levels × 2 modes; original names, IDs, costs, groups, units and selection locks';
}
function ranks(guide=Guide) {
  assert.deepEqual(RANKS,RANK_NAMES.map((name,i)=>({name,threshold:RANK_POINTS[i],...(ORIGINAL_NOTES[i]?{unlock:ORIGINAL_NOTES[i]}:{})})));
  const pending = {5:'文化建築',7:'小型地標',11:'研究院',16:'紀念工程'};
  for(let i=0;i<26;i++) {
    const note = guide.rankBuildNote(i), summary = guide.facilitySummary(i);
    if(pending[i]) { assert.ok(note.includes(pending[i])); assert.match(note,/本線尚無建造工具/); assert.match(note,/不會新增/); assert.doesNotMatch(note,/^解鎖/); }
    else if(i===21){assert.match(note,/解鎖：太空研究中心/);assert.match(note,/3×3/);}
    else assert.equal(note,ORIGINAL_NOTES[i]??'');
    assert.equal(summary.total,18); assert.equal(summary.available,i<21?17:18);
    assert.equal(summary.next,i<21?tool('megaproject'):null,'next must be real Lv.22 facility, never imported preview milestones');
    assert.equal(rankStep(i,0).rankIdx,i,'low current points never lower historical rank');
    assert.equal(rankOfSave(i,0),i,'saved rank is preserved');
    if(i<25){assert.equal(rankStep(i,RANK_POINTS[i+1]-1).rankIdx,i);assert.equal(rankStep(i,RANK_POINTS[i+1]).rankIdx,i+1);}
  }
  assert.equal(guide.rankBuildNote(-1),'');assert.equal(guide.rankBuildNote(26),'');
  assert.deepEqual(rankStep(0,29750),{rankIdx:25,promoted:Array.from({length:25},(_,i)=>i+1)});
  return 'all 26 original rank records unchanged; unavailable Lv.6/8/12/17 qualified; Lv.22 actual; Lv.26 honor verbatim';
}
function promotionTruth(source=citySource) {
  const line=source.split('\n').find(line=>line.includes('for (const q of rep.rank.promoted)'));
  assert.ok(line,'actual daily promotion loop exists');
  const toasts=[];
  new Function('rep','city','bui','RANKS','rankBuildNote',strip(line))({rank:{promoted:[5,7,11,16,21,25]}},{name:'測試城'},{toast:(...args)=>toasts.push(args)},RANKS,Guide.rankBuildNote);
  assert.equal(toasts.length,6);
  for(let i=0;i<4;i++){assert.match(toasts[i][0],/本線尚無建造工具/);assert.match(toasts[i][0],/不會新增/);assert.equal(toasts[i][1],'gold');}
  assert.match(toasts[4][0],/Lv.22.*解鎖：太空研究中心.*3×3/);
  assert.match(toasts[5][0],/Lv.26.*城市巔峰榮耀：全城住宅幸福 \+2%（永久）/);
  return 'actual simDay promotion toast loop qualifies four unavailable milestones, actual Lv.22 and unchanged Lv.26';
}
function compileGuide(source=helperSource) {
  return new Function('CIVIC_TOOLS','RANKS',strip(source)+'; return { FACILITY_GROUPS,FACILITY_NOTES,rankBuildNote,facilitySummary,facilityPresentation };')(CIVIC_TOOLS,RANKS);
}
function inspect(fixture, guide=Guide) {
  const s=fixture.sim;
  for(let n=0;n<3;n++) {
    guide.facilitySummary(s.rankIdx);
    for(let i=0;i<26;i++)guide.rankBuildNote(i);
    for(const t of CIVIC_TOOLS)guide.facilityPresentation(t,s.rankIdx,s.diff===3);
  }
}
function readOnly(guide=Guide) {
  const a=d044Load(), b=d044Load(), ar=instrumentRng(a.sim),br=instrumentRng(b.sim);
  const defs=stateBytes({CIVIC_TOOLS,RANKS,notes:guide.FACILITY_NOTES,groups:guide.FACILITY_GROUPS});
  for(const rankIdx of [0,5,7,11,16,20,21,25]) for(const diff of [1,3]) {
    a.sim.rankIdx=b.sim.rankIdx=rankIdx;a.sim.diff=b.sim.diff=diff;
    const before=raw(a),code=saved(a),rng=stateBytes(ar);
    inspect(a,guide);
    assert.equal(raw(a),before,'queries cannot change any enumerable scalar, Map, Set, object or typed-array byte');
    assert.equal(saved(a),code,'queries cannot change any share/save bytes');assert.equal(stateBytes(ar),rng,'queries cannot call either RNG interface');
    assert.equal(raw(a),raw(b));assert.equal(saved(a),saved(b));
  }
  assert.equal(stateBytes({CIVIC_TOOLS,RANKS,notes:guide.FACILITY_NOTES,groups:guide.FACILITY_GROUPS}),defs,'helpers do not reorder/mutate imported definitions');
  assert.deepEqual(ar,br);
  return '16 rank/mode states: full model, exact save bytes, RNG calls and all imported definitions unchanged';
}

function placementTruth(guide=Guide) {
  const fixture=d044Load(),s=fixture.sim,N=s.w.N,[x,z]=BLOCKS.C;
  const at=(cx=x,cz=z)=>s.w.tiles[cz*N+cx];
  const clean=()=>{for(let dz=-1;dz<4;dz++)for(let dx=-1;dx<4;dx++)Object.assign(at(x+dx,z+dz),{t:2,road:0,bld:null,zone:0,tree:0,wp:0,ruin:0,crater:0,tram:0,hv471:0,ug471:0});};
  const check=(id,ok,why)=>{const pv=previewOp(s,op(id,x,z));assert.equal(pv.count>0,ok,id+' placement');if(why)assert.equal(pv.reason,why);return pv;};
  for(const [id] of TOOLS) {
    clean();s.res.resource[z*N+x]=id==='mine'?2:1;
    if(id==='sewage'){at(x-1,z-1).t=0;at(x+1,z-1).t=0;}
    assert.equal(check(id,true).total,COST[id]);
    const presentation=guide.facilityPresentation(tool(id),21,false);
    at().tree=1;assert.equal(check(id,true).total,COST[id]+2,id+' tree adjustment is real preview only');
    assert.ok(presentation.price.includes('基價 $'+COST[id].toLocaleString('en-US')),'guide never advertises adjusted price as base');
    at().tree=0;at().ruin=1;check(id,false,'焦土需先清理');at().ruin=0;at().crater=1;check(id,false,'隕石坑需先剷除');at().crater=0;
    at().t=0;check(id,false);at().t=2;at().road=1;
    check(id,id==='wpipe');at().road=0;at().bld={k:4,lv:1,v:0,age:0,pw:true,h:1};check(id,id==='wpipe');at().bld=null;
  }
  clean();s.res.resource[z*N+x]=0;
  check('oilwell',false,'需油田資源格');check('gaswell',false,'需油田資源格（天然氣伴生）');check('mine',false,'需礦藏資源格');
  s.res.resource[z*N+x]=2;check('mine',true);check('oilwell',false,'需油田資源格');
  clean();check('sewage',false,'需鄰近水域(≥2格)');at(x-1,z-1).t=0;check('sewage',false,'需鄰近水域(≥2格)');at(x+1,z-1).t=0;check('sewage',true);
  for(const [key,why] of [['tram','交通線上不能建造'],['hv471','高壓電力走廊擋住'],['ug471','高壓電力走廊擋住']]){at()[key]=1;check('sewage',false,why);at()[key]=0;}
  clean();at().wp=1;check('wpipe',false,'已有水管');
  clean();const mega=check('megaproject',true);assert.equal(mega.cells.length,9);assert.equal(mega.count,1);assert.equal(mega.cells.filter(q=>q.foot).length,8);
  at(x+2,z+2).road=1;check('megaproject',false,'交通線擋住');at(x+2,z+2).road=0;at(x+1,z+2).t=0;check('megaproject',false,'需 3×3 陸地');
  clean();s.edu.tech=['B5','C8','D4a'];s.edu.spec='hub';at().tree=1;
  assert.equal(check('park',true).total,62*.95*.95*.9*1.05);assert.match(guide.facilityPresentation(tool('park'),21,false).price,/基價 \$60/);
  s.diff=3;assert.equal(check('park',true).total,0);assert.match(guide.facilityPresentation(tool('park'),21,true).price,/沙盒 \$0/);
  return 'all tools checked against actual preview: base/tree/tech/spec/sandbox price; land/road/building/ruin/crater; pipe reuse; oil/ore; sewage 0/1/2 water; 3×3 footprint';
}

function trajectories(guide=Guide) {
  const factories=[()=>d044Load(),()=>d045Load({rk:25,tech343:{act:'A1',prog:{A1:5},done:[]}},10000),()=>d045Load({rk:20,df:3},10000)];
  let days=0;
  for(const make of factories) {
    const a=make(),b=make(),ar=instrumentRng(a.sim),br=instrumentRng(b.sim);
    const equal=why=>{assert.equal(raw(a),raw(b),why+' full model');assert.equal(saved(a),saved(b),why+' save bytes');assert.deepEqual(ar,br,why+' RNG calls/results');};
    equal('starting pair');
    for(let day=0;day<12;day++) {
      inspect(a,guide);equal('queries before day '+day);
      assert.deepEqual(stepDay(a.sim),stepDay(b.sim),'exact original report day '+day);equal('after uninterrupted day '+day);days++;
    }
    const code=saved(a),r=loadCode(code,a.KT,a.vrank);assert.ok(r.ok);assert.equal(decodeLabCode(code).save.raw.rk,a.sim.rankIdx);assert.equal(r.sim.rankIdx,a.sim.rankIdx);
  }
  return days+' uninterrupted paired days across buildable, active-research high-rank and sandbox cities; exact reports/model/save/RNG';
}

// Reuse the established D052 DOM boundary implementation verbatim, without
// exporting/modifying that guard or pretending its events came from a browser.
function makeDom() {
  const d052=read('tools/unit-d052.mjs');
  const boundary=section(d052,'const sameNode =','// Frozen original action handlers');
  const {doc,Element}=new Function('assert',boundary+';return {doc:domDocument(),Element};')(assert);
  const originalCreate=doc.createElement;
  doc.createElement=tag=>{
    const e=originalCreate(tag);
    e.classList.toggle=(name,on)=>{const names=new Set(e.className.split(/\s+/).filter(Boolean));if(on??!names.has(name))names.add(name);else names.delete(name);e.className=[...names].join(' ');return names.has(name);};
    return e;
  };
  Element.prototype.matches=function(selector){
    if(selector.startsWith('#'))return this.id===selector.slice(1);
    if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));
    if(selector.startsWith('[')){const [,name,value]=selector.match(/^\[([^=\]]+)(?:="?([^"\]]+)"?)?\]$/)??[];return !!name&&this.hasAttribute(name)&&(value===undefined||this.getAttribute(name)===value);}
    return this.tagName===selector.toUpperCase();
  };
  Element.prototype.querySelectorAll=function(selector){return this.all(e=>e.matches(selector));};
  Element.prototype.querySelector=function(selector){return this.querySelectorAll(selector)[0]??null;};
  Object.defineProperty(Element.prototype,'id',{configurable:true,get(){return this.getAttribute('id')??'';},set(v){this.setAttribute('id',v);}});
  Object.defineProperty(Element.prototype,'innerHTML',{configurable:true,set(html){
    // Parse only the shipped static catalog shell. Content/handlers are still
    // created by the actual module; this is not a general HTML parser.
    this.replaceChildren();const stack=[this];
    for(const token of html.match(/<[^>]+>|[^<]+/g)??[]) {
      if(token.startsWith('</')){stack.pop();continue;}
      if(token.startsWith('<')){const [,tag,attrs]=token.match(/^<([a-z0-9]+)([^>]*)>$/i)??[];assert.ok(tag,'catalog shell tag');const e=doc.createElement(tag);for(const m of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g))e.setAttribute(m[1],m[2]??'');stack.at(-1).append(e);stack.push(e);}
      else stack.at(-1).append(token);
    }
    assert.equal(stack.length,1,'balanced catalog static template');
  }});
  return {doc,Element};
}
function catalogHarness({guide=Guide,source=catalogSource,onSelect}={}) {
  const {doc,Element}=makeDom(),selected=[],closed=[];
  const dependencies={CIVIC_TOOLS,...guide,document:doc,HTMLElement:Element,Element};
  const js=[read('src/ui/panelContent.ts'),read('src/ui/panelPress.ts'),source].map(strip).join('\n');
  const create=new Function(...Object.keys(dependencies),js+';return createFacilityCatalog;')(...Object.values(dependencies));
  const catalog=create({select:id=>{selected.push(id);onSelect?.(id);},close:()=>{closed.push('close');},rank:()=>{closed.push('rank');}});
  doc.body.append(catalog.root);
  return {doc,catalog,selected,closed,button:id=>catalog.root.querySelectorAll('button').find(b=>b.dataset.tool===id),filter:id=>catalog.root.querySelectorAll('button').find(b=>b.dataset.group===id),rows:()=>catalog.root.querySelectorAll('li')};
}
function catalogBehavior(source=catalogSource) {
  const h=catalogHarness({source});const {catalog:c,doc}=h;c.root.hidden=false;c.update({rankIdx:20,sandbox:false,day:150});
  assert.equal(c.root.getAttribute('role'),'dialog');assert.equal(c.root.getAttribute('aria-modal'),'true');assert.equal(c.root.getAttribute('aria-labelledby'),c.title.id);
  assert.equal(h.rows().length,18);assert.equal(h.rows().filter(r=>r.dataset.locked==='false').length,17);
  for(const [id,name,,,group] of TOOLS){const row=h.rows().find(r=>r.dataset.k===id);assert.equal(row.querySelector('h3').textContent,name);assert.ok(row.querySelector('.meta').textContent.includes('基價 $'+tool(id).cost.toLocaleString('en-US')));assert.equal(h.button(id).disabled,id==='megaproject');if(id!=='megaproject'){h.button(id).click();assert.equal(h.selected.at(-1),id);}assert.equal(Guide.FACILITY_NOTES[id].group,group);}
  h.button('megaproject').click();assert.equal(h.selected.length,17,'locked button cannot dispatch a selection');
  for(const [group,count] of [['service',10],['utility',4],['resource',4],['all',18]]){h.filter(group).click();assert.equal(c.group(),group);assert.equal(h.rows().length,count);assert.equal(h.filter(group).getAttribute('aria-pressed'),'true');}
  h.filter('resource').click();const button=h.button('mine'),body=c.root.querySelector('.body');body.scrollTop=73;button.focus({preventScroll:true});const oldRows=h.rows();
  c.update({rankIdx:21,sandbox:true,day:151});assert.equal(c.group(),'resource');assert.equal(body.scrollTop,73);assert.ok(doc.activeElement===button);assert.ok(h.button('mine')===button,'real reconciliation retains button identity');assert.ok(h.rows().every((r,i)=>r===oldRows[i]));
  assert.equal(h.button('megaproject').disabled,false);assert.match(c.root.querySelector('.sub').textContent,/18／18.*151/);h.button('megaproject').click();assert.equal(h.selected.at(-1),'megaproject');
  // A held original button's entire presentation remains fixed until its one
  // original click. The latest update is used, not the first queued day.
  const held=h.button('gaswell'),text=c.root.textContent,selectionCount=h.selected.length;
  doc.emit('pointerdown',{target:held,pointerId:41});c.update({rankIdx:21,sandbox:true,day:152});c.update({rankIdx:21,sandbox:true,day:153});
  assert.equal(c.root.textContent,text);doc.emit('pointerup',{target:held,pointerId:41});assert.equal(c.root.textContent,text);
  doc.emit('click',{target:held,pointerId:41});doc.runTimers();assert.equal(h.selected.length,selectionCount+1);assert.equal(h.selected.at(-1),'gaswell');assert.match(c.root.querySelector('.sub').textContent,/153/);
  doc.emit('pointerdown',{target:held,pointerId:42});c.update({rankIdx:21,sandbox:true,day:154});doc.emit('pointercancel',{target:held,pointerId:42});doc.runTimers();assert.match(c.root.querySelector('.sub').textContent,/154/);assert.equal(h.selected.length,selectionCount+1);
  doc.emit('pointerdown',{target:held,pointerId:43});c.update({rankIdx:21,sandbox:true,day:155});c.reset();c.root.hidden=true;doc.emit('pointerup',{target:held,pointerId:43});doc.runTimers();assert.match(c.root.querySelector('.sub').textContent,/154/,'reset cancels stale pending presentation');
  c.root.hidden=false;c.update({rankIdx:21,sandbox:false,day:156});c.root.querySelector('#catalogClose').click();c.root.querySelector('#catalogRank').click();doc.emit('click',{target:c.root});assert.deepEqual(h.closed,['close','rank','close']);
  return 'actual catalog: 18 rows, group counts, rank lock, identity/focus/scroll, latest held-day presentation, single release, cancel/reset and callbacks';
}

// Execute original rank render/open/close/selection and syncUi wiring; modal
// focus mechanics themselves remain covered by prior guards and native Chrome.
function growthHarness(fixture,source=citySource) {
  const {doc,Element}=makeDom(),nodes=new Map(),calls=[],x={sim:fixture.sim,calls};
  const ui=doc.createElement('div');doc.body.append(ui);
  const node=selector=>{
    if(!nodes.has(selector)) {const e=doc.createElement(/X$|Catalog$/.test(selector)?'button':'div');nodes.set(selector,e);if(selector==='#rk'){e.hidden=true;ui.append(e);}else node('#rk').append(e);}
    return nodes.get(selector);
  };
  const dependencies={CIVIC_TOOLS,RANKS,...Guide,document:doc,HTMLElement:Element,Element,ui,node};
  const mods=[read('src/ui/panelContent.ts'),read('src/ui/panelPress.ts'),catalogSource].map(strip).join('\n');
  const chunks=[section(source,"  const rk = $<HTMLElement>('#rk')",'  // D032：'),section(source,'  function syncUi() {','  // D040：資源圖。')];
  const js=`let sim=x.sim,city=sim.city,playing=true;const $=node,addEventListener=document.defaultView.addEventListener.bind(document.defaultView);
    ${mods}
    const menu=document.createElement('button'),background=document.createElement('div');
    const bui={root:background,menuOpen:()=>x.calls.push('menuClose'),setHud:()=>x.calls.push('hud')};
    const renderer={domElement:document.createElement('canvas')};
    const createSaveModalAccess=()=>{let current=null;return {show:(panel)=>{if(current)current.hidden=true;current=panel;panel.hidden=false;x.calls.push('show');},close:()=>{if(current)current.hidden=true;current=null;x.calls.push('close');},isOpen:()=>!!current};};
    const interruptBuild=()=>x.calls.push('interrupt'),closeDecisionPanels=()=>x.calls.push('decisionClose'),saveModal={isOpen:()=>false},closeSavePanels=()=>x.calls.push('savePanelClose');
    const pickCivic=()=>true,setTool=()=>x.calls.push('tool');
    const syncRes=()=>x.calls.push('resources'),liveBuildings=()=>[],powerStatus=()=>({powered:0,unpowered:0,cap:0}),simCounts=()=>[[0],[0,0,0],[0,0,0],[0,0,0]];
    const label='fixture',loadDay=sim.day,autosaves=()=>true,saveErr='',jstore=null,jwhy='',saveWarnings=()=>({}),saveStatus={setState:()=>{}},syncCommissionHud=()=>{},syncDock=()=>x.calls.push('dock');
    const saveNow=()=>x.calls.push('save'),kickJournal=()=>x.calls.push('journal');
    ${chunks.map(strip).join('\n')}
    return {openRank,renderRank,rankList,openCatalog,closeGrowth,syncUi,catalog,rk,playing:()=>playing};`;
  const h=new Function('x',...Object.keys(dependencies),js)(x,...Object.values(dependencies));
  return {...h,doc,node,calls,fixture};
}
function growthBehavior(source=citySource) {
  const a=d045Load({rk:5},10000),b=d045Load({rk:5},10000),ar=instrumentRng(a.sim),br=instrumentRng(b.sim),h=growthHarness(a,source);
  const text=()=>[h.node('#rk .sub').textContent,h.node('#rk ol').textContent,h.node('#rk .growthGuide h3').textContent,h.node('#rk .nextBuild').textContent];
  for(const rankIdx of [0,5,7,11,16,20,21,25]) {
    a.sim.rankIdx=b.sim.rankIdx=rankIdx;a.sim.cityPoints=b.sim.cityPoints=0;
    const before=raw(a),code=saved(a);h.openRank();
    assert.equal(h.rk.hidden,false);assert.equal(h.catalog.root.hidden,true);assert.equal(h.playing(),true,'opening cannot pause/resume');
    assert.equal(raw(a),before);assert.equal(saved(a),code);assert.deepEqual(ar,br);
    const result=h.rankList();assert.equal(result.pct,rankIdx===25?100:0,'retained high rank with fallen points clamps to 0');
    assert.equal(h.node('#rk .bar i').style.width,(rankIdx===25?100:0)+'%');
    assert.match(text()[2],rankIdx<21?/17／18/:/18／18/);
    if(rankIdx<21)assert.match(text()[3],/Lv.22 太空研究中心/);else assert.doesNotMatch(text()[3],/下一個/);
    if([5,7,11,16].includes(rankIdx))assert.match(text()[1],/本線尚無建造工具/);
    if(rankIdx===25)assert.match(text()[1],/全城住宅幸福 \+2%（永久）/);
    if(rankIdx<25){a.sim.cityPoints=(RANK_POINTS[rankIdx]+RANK_POINTS[rankIdx+1])/2;h.renderRank();assert.equal(h.rankList().pct,50);a.sim.cityPoints=RANK_POINTS[rankIdx+1]+100;h.renderRank();assert.equal(h.rankList().pct,100);}
  }
  a.sim.rankIdx=b.sim.rankIdx=20;a.sim.cityPoints=b.sim.cityPoints=0;h.openRank();
  const original=raw(a),code=saved(a);h.openCatalog();assert.equal(h.rk.hidden,true);assert.equal(h.catalog.root.hidden,false);assert.equal(raw(a),original);assert.equal(saved(a),code);assert.deepEqual(ar,br);
  h.openRank();assert.equal(h.catalog.root.hidden,true);assert.equal(h.rk.hidden,false);
  const close=h.node('#rkX');h.doc.emit('pointerdown',{target:close,pointerId:51});const held=text();
  a.sim.day=b.sim.day=151;a.sim.cityPoints=b.sim.cityPoints=18130;a.sim.rankIdx=b.sim.rankIdx=21;h.syncUi();assert.deepEqual(text(),held,'rank presentation stays stationary under held control');
  h.doc.emit('pointercancel',{target:close,pointerId:51});h.doc.runTimers();assert.match(text()[0],/151/);assert.match(text()[2],/18／18/);
  h.openCatalog();const oldCatalogText=h.catalog.root.textContent;a.sim.day=b.sim.day=152;h.syncUi();assert.notEqual(h.catalog.root.textContent,oldCatalogText);assert.match(h.catalog.root.querySelector('.sub').textContent,/152/);
  const closedRank=text(),closedCatalog=h.catalog.root.textContent;h.closeGrowth();a.sim.day=b.sim.day=153;h.syncUi();assert.deepEqual(text(),closedRank);assert.equal(h.catalog.root.textContent,closedCatalog,'closed catalog not refreshed by actual syncUi');
  assert.equal(raw(a),raw(b),'all user-visible refreshes leave exact full state unchanged');assert.equal(saved(a),saved(b));assert.deepEqual(ar,br);assert.equal(h.playing(),true);assert.ok(!h.calls.includes('save')&&!h.calls.includes('journal'),'guide cannot save/write journal');
  h.openRank();h.doc.emit('pagehide',{target:h.doc.defaultView});assert.equal(h.rk.hidden,true);assert.equal(h.catalog.root.hidden,true);
  return 'actual rank/open/catalog/syncUi: 8 retained-rank states; 0/50/100% clamps; live visible-only refresh; held presentation; close/pagehide; no pause/save/history/RNG';
}

function selectionHarness(fixture,source=citySource) {
  const calls=[],toasts=[],x={sim:fixture.sim,calls,toasts};
  const chunks=[section(source,'  function selectCatalogTool(','  // D032：'),section(source,'  function pickCivic(','  function syncDock()'),section(source,'  function setTool(','  const toolColor'),section(source,'  function opOf(','  function updatePreview()'),section(source,'  function commitStroke(','  // 手勢和測試出口')];
  const js=`let sim=x.sim,city=sim.city,tool='road',roadTool='alley',civicTool='police',stroke={old:true},lastPreview={old:true};
    const toolLock=d.toolLock,labToolOf=d.labToolOf,gestureOf=d.gestureOf,CIVIC_TOOLS=d.CIVIC_TOOLS;
    const closeGrowth=restore=>x.calls.push(['closeGrowth',restore]);
    const controls={touches:{ONE:'rotate'},mouseButtons:{LEFT:'rotate'}},THREE={TOUCH:{ROTATE:'rotate'},MOUSE:{ROTATE:'rotate'}};
    const preview={clear:()=>x.calls.push('clear')},bui={root:{querySelector:()=>({focus:options=>x.calls.push(['focus',options])})},hideCost:()=>x.calls.push('hideCost'),toast:(...args)=>x.toasts.push(args)};
    const syncPipes=()=>x.calls.push('pipes'),closeCard=()=>x.calls.push('closeCard'),syncDock=()=>x.calls.push('dock'),invalidate=()=>x.calls.push('invalidate');
    const runOp=op=>{x.calls.push('commit');return d.commitOp(sim,op,0);},saveNow=()=>x.calls.push('save'),kickJournal=()=>x.calls.push('journal');
    ${chunks.map(strip).join('\n')}
    return {selectCatalogTool,pickCivic,setTool,opOf,commitStroke,setSim:value=>{sim=value;},read:()=>({tool,civicTool,stroke,lastPreview,controls}),setStroke:s=>{stroke=s;lastPreview={old:true};}};`;
  return {...new Function('x','d',js)(x,{toolLock,labToolOf,gestureOf,commitOp,CIVIC_TOOLS}),calls,toasts,fixture};
}
function selectionAndCommit(source=citySource) {
  let builds=0;
  for(const [id] of TOOLS) {
    const a=d044Load(),b=d044Load();a.sim.rankIdx=b.sim.rankIdx=21;const ar=instrumentRng(a.sim),br=instrumentRng(b.sim),h=selectionHarness(a,source);
    const before=raw(a),code=saved(a);h.selectCatalogTool(id);
    assert.deepEqual(h.calls.filter(c=>Array.isArray(c)),[['closeGrowth',false],['focus',{preventScroll:true}]],'original callback closes before selecting and restores visible tool focus');
    assert.equal(h.read().civicTool,id);assert.equal(h.read().tool,'civic');assert.equal(h.read().stroke,null);assert.equal(h.read().lastPreview,null);assert.equal(h.read().controls.touches.ONE,null);assert.equal(h.read().controls.mouseButtons.LEFT,null);
    assert.ok(!h.calls.includes('save')&&!h.calls.includes('journal'));assert.equal(raw(a),before,'selection only is read-only: '+id);assert.equal(saved(a),code);assert.deepEqual(ar,[]);
    const N=a.sim.w.N;
    if(id==='sewage')for(const f of [a,b])for(const [dx,dz]of [[-1,-1],[1,-1]]){const i=(BLOCKS.C[1]+dz)*N+BLOCKS.C[0]+dx;f.sim.w.tiles[i].t=0;f.sim.city.ter[i]=0;}
    const target=(()=>{for(let z=0;z<N;z++)for(let x=0;x<N;x++){const q=previewOp(a.sim,op(id,x,z));if(q.count===1)return[x,z];}return null;})();
    assert.ok(target,'fixture includes valid location for '+id);const [x,z]=target,s={pid:1,a:[x,z],b:[x+(id==='park'||id==='wpipe'?1:0),z],moved:false};
    const candidate=h.commitStroke(s),control=commitOp(b.sim,op(id,x,z,...s.b),0);
    assert.deepEqual(candidate,control);assert.equal(candidate.ok,true);assert.equal(raw(a),raw(b),'exact commit model for '+id);assert.equal(saved(a),saved(b));assert.deepEqual(ar,br);builds++;
    assert.deepEqual(undoOp(a.sim),undoOp(b.sim));assert.equal(raw(a),raw(b),'exact undo for '+id);assert.equal(saved(a),saved(b));assert.deepEqual(ar,br);
    // Actual tap cancellation does not spend or save/history/RNG. A dragged
    // line/rect remains a valid operation, as checked in the paired commit.
    if(gestureOf(id)==='tap'){const beforeCancel=raw(a),codeCancel=saved(a),rng=stateBytes(ar);assert.equal(h.commitStroke({...s,moved:true}),null);assert.equal(raw(a),beforeCancel);assert.equal(saved(a),codeCancel);assert.equal(stateBytes(ar),rng);}
  }
  for(const rankIdx of [0,20,21,25])for(const diff of [1,3]) {
    const a=d044Load();a.sim.rankIdx=rankIdx;a.sim.diff=diff;const h=selectionHarness(a,source),before=raw(a),code=saved(a),ar=instrumentRng(a.sim);
    // Snapshot after tracing is installed, since the function property itself
    // is part of the full model representation.
    const model=raw(a);const result=h.pickCivic('megaproject');assert.equal(result,rankIdx>=21);assert.equal(h.read().civicTool,rankIdx>=21?'megaproject':'police');assert.equal(raw(a),model);assert.equal(saved(a),code);assert.deepEqual(ar,[]);void before;
  }
  return builds+' shipped pickCivic→setTool→commitStroke paired against original commitOp/undo; 8 rank/mode locks; tap drag cancellation';
}

function originalScope() {
  const expected={
    'src/sim':[42,'925eff90599c4e58e4d966d33a6462af52526d7e726b8fa64fc67c0b72b7c6de'],
    'src/io':[3,'3fc04802b3cb5b65f738239db7b355e13432901fa65c02db3c7648c2cd00a4fb'],
    'src/render':[15,'2adb379c0a1a309fc1de97c249af9bd98d994ec2408d9c6677a6bae57896542f'],
    'src/content':[96,'85f9d524f33f91a96d8c23bda36e358f8e7d21c14f40ece4ceaf77cf1de4618e'],
  };
  for(const [dir,[count,sha]] of Object.entries(expected)) {
    const base=path.join(ROOT,dir),files=fs.readdirSync(base,{recursive:true,withFileTypes:true}).filter(d=>d.isFile()).map(d=>path.relative(ROOT,path.join(d.parentPath,d.name)).replaceAll('\\','/')).sort(),hash=createHash('sha256');
    for(const file of files)hash.update(file+'\0').update(fs.readFileSync(path.join(ROOT,file))).update('\0');
    assert.equal(files.length,count,dir+' original file count');assert.equal(hash.digest('hex'),sha,dir+' entire original-main byte fingerprint');
  }
  return '156 original-main files byte-identical: simulation/rank/RNG, save, renderer and content';
}
function selectionPurity(source=citySource) {
  const a=d044Load(),calls=instrumentRng(a.sim);a.sim.rankIdx=20;const h=selectionHarness(a,source);
  const before=raw(a),code=saved(a);h.selectCatalogTool('megaproject');assert.equal(h.read().civicTool,'police');assert.equal(h.read().tool,'road');assert.deepEqual(h.calls,[]);
  h.selectCatalogTool('invented-tool');assert.deepEqual(h.calls,[]);h.selectCatalogTool('police');assert.equal(h.read().tool,'civic');assert.equal(raw(a),before);assert.equal(saved(a),code);assert.deepEqual(calls,[]);
  assert.equal(h.commitStroke({pid:1,a:BLOCKS.B,b:BLOCKS.B,moved:true}),null);assert.equal(raw(a),before);assert.equal(saved(a),code);assert.deepEqual(calls,[]);assert.ok(!h.calls.includes('save')&&!h.calls.includes('journal'));
  const ui=stateBytes(h.read()),effects=stateBytes(h.calls);h.setSim(null);h.selectCatalogTool('fire');assert.equal(stateBytes(h.read()),ui);assert.equal(stateBytes(h.calls),effects);
}
function mutations() {
  // A failing baseline must never masquerade as successfully killed mutants.
  metadata();ranks();catalogBehavior();selectionPurity();
  const helpers=[
    ['premature Lv.21 unlock','rankIdx + 1 < t.unlockRank','rankIdx + 2 < t.unlockRank',metadata],
    ['sandbox bypasses level lock','const locked = !!t.unlockRank','const locked = !sandbox && !!t.unlockRank',metadata],
    ['summary omits one unlocked tool','available: available.length','available: available.length - 1',ranks],
    ['summary retains unlocked next tool','rankIdx + 1 < t.unlockRank','rankIdx + 1 <= t.unlockRank',ranks],
    ['unimplemented milestone falsely claims unlock','本線尚無建造工具；升級不會新增這類可建設施。','現在可從工具列建造。',ranks],
    ['top-rank honor replaced',"return RANKS[idx]?.unlock ?? '';","return idx === 25 ? '' : RANKS[idx]?.unlock ?? '';",ranks],
    ['pipe operation falsely shown as point',"t.id === 'wpipe' ? '每格・拉線'","t.id === 'wpipe' ? '1×1・點放'",metadata],
    ['mine claims oil field',"必須在礦藏資源格；選取後以藍色","必須在油田資源格；選取後以黃色",metadata],
  ];
  for(const [name,from,to,check] of helpers) {
    // A shared expression occurs in summary and presentation. Mutate only the
    // intended function, while still executing valid actual module code.
    const start=name.startsWith('summary')?'export function facilitySummary(':check===metadata&&(name.includes('unlock')||name.includes('sandbox'))?'export function facilityPresentation(':null;
    const end=start==='export function facilitySummary('?helperSource.indexOf('export function facilityPresentation('):helperSource.length;
    const altered=start?helperSource.slice(0,helperSource.indexOf(start))+change(helperSource.slice(helperSource.indexOf(start),end),from,to)+helperSource.slice(end):change(helperSource,from,to);
    const guide=compileGuide(altered);assert.throws(()=>check(guide),e=>e?.code==='ERR_ASSERTION',name+' must fail behavior, not parse/reference errors');
  }
  const catalogs=[
    ['locked button enabled','choose.disabled = p.locked','choose.disabled = false'],
    ['selection sends wrong tool','on.select(t.id)','on.select("police")'],
    ['daily update discards focus/identity','updatePanelContent(list, ...items);','list.replaceChildren(...items);'],
    ['held rendering gate removed','if (!state || gate.defer(render)) return;','if (!state) return;'],
    ['latest model update discarded','state = s; render();','state ??= s; render();'],
    ['filter ignores selected category',"group === 'all' || FACILITY_NOTES[t.id].group === group","true"],
  ];
  for(const [name,from,to] of catalogs)assert.throws(()=>catalogBehavior(change(catalogSource,from,to)),e=>e?.code==='ERR_ASSERTION',name+' must fail behavior');
  const selection=[
    ['locked selection bypasses lock','if (lk) { bui.toast(lk, \'bad\'); return false; }','if (false) { bui.toast(lk, \'bad\'); return false; }'],
    ['selection consumes RNG','civicTool = id; return true;','sim.rng.R(); civicTool = id; return true;'],
    ['selection charges money','civicTool = id; return true;','sim.money--; civicTool = id; return true;'],
    ['selection writes save','civicTool = id; return true;','saveNow(); civicTool = id; return true;'],
    ['dragged tap commits anyway',"if (op.k === 'tap' && s.moved) { invalidate(); return null; }","if (false) { invalidate(); return null; }"],
  ];
  for(const [name,from,to] of selection)assert.throws(()=>selectionPurity(change(citySource,from,to)),e=>e?.code==='ERR_ASSERTION',name+' must fail actual action behavior');
  const growth=[
    ['rank panel uses misleading imported note','const note = rankBuildNote(idx);','const note = RANKS[idx].unlock;'],
    ['rank progress always zero', 'pct = next ? Math.min(100,', 'pct = next ? 0 * Math.min(100,'],
    ['closed rank redraws', 'if (!rk.hidden) renderRank();', 'renderRank();'],
    ['open catalog stops refreshing', 'if (!catalog.root.hidden && sim) catalog.update', 'if (false && sim) catalog.update'],
  ];
  growthBehavior();promotionTruth();
  for(const [name,from,to]of growth)assert.throws(()=>growthBehavior(change(citySource,from,to)),e=>e?.code==='ERR_ASSERTION',name);
  const misleading=citySource.replaceAll('rankBuildNote(q)','RANKS[q].unlock');assert.notEqual(misleading,citySource);assert.throws(()=>promotionTruth(misleading),e=>e?.code==='ERR_ASSERTION','actual toast wiring reverts to misleading imported unlocks');
  return helpers.length+catalogs.length+selection.length+growth.length+1+' valid helper/catalog/action/growth/toast mutations rejected by behavioral assertions';
}

function clickOriginBehavior(create = createMapClickGuard) {
  const canvas = {}, button = {}, pending = [], g = create(canvas, task => pending.push(task));
  const e = (target, pointerId = 1, buttonCode = 0) => ({ target, pointerId, button: buttonCode, blocked: false, stopped: false, preventDefault() { this.blocked = true; }, stopPropagation() { this.stopped = true; } });
  const down = e(canvas); g.down(down); g.up(down); const released = e(button); g.click(released); assert.ok(released.blocked && released.stopped);
  g.down(e(button)); g.up(e(button)); const fresh = e(button); g.click(fresh); assert.equal(fresh.blocked, false);
  g.down(down); const keyboard = e(button, -1); g.click(keyboard); assert.equal(keyboard.blocked, false); const heldRelease = e(button); g.click(heldRelease); assert.equal(heldRelease.blocked, true);
  g.down(down); g.up(down); const runOld = pending.splice(0); g.down(down); runOld.forEach(task => task()); const reused = e(button); g.click(reused); assert.equal(reused.blocked, true, 'old cleanup cannot forget a newer press');
  g.down(down); g.up(down); pending.splice(0).forEach(task => task()); const noClick = e(button); g.click(noClick); assert.equal(noClick.blocked, false, 'no-click release cleans up');
  g.down(down); g.cancel(down); const cancelled = e(button); g.click(cancelled); assert.equal(cancelled.blocked, false);
  g.down(down); g.clear(); const abandoned = e(button); g.click(abandoned); assert.equal(abandoned.blocked, false);
  g.down(e(canvas, 2)); g.down(e(canvas, 3)); g.up(e(canvas, 2)); for(const id of [2, 3]) { const event = e(button, id); g.click(event); assert.equal(event.blocked, true); }
  g.down(e(canvas, 4, 2)); const right = e(button, 4); g.click(right); assert.equal(right.blocked, false);
  g.down(down); g.up(down); const canvasClick = e(canvas); g.click(canvasClick); assert.equal(canvasClick.blocked, false);
}
function clickOriginGuard() {
  clickOriginBehavior();
  const source = read('src/ui/mapClickGuard.ts');
  for (const [from, to] of [
    ['if (fromMap && e.target !== canvas)', 'if (false)'],
    ['if (origins.get(e.pointerId) === origin)', 'if (true)'],
    ['e.preventDefault(); e.stopPropagation();', 'e.preventDefault();'],
  ]) {
    const create = new Function(strip(change(source, from, to)) + ';return createMapClickGuard;')();
    assert.throws(() => clickOriginBehavior(create), error => error?.code === 'ERR_ASSERTION');
  }
  assert.match(citySource, /mapClicks.down\(e\)/); assert.match(citySource, /mapClicks.click\(e\)/); assert.match(citySource, /mapClicks.up\(e\)/); assert.match(citySource, /mapClicks.cancel\(e\)/); assert.match(citySource, /mapClicks.clear\(\)/);
  return 'real origin guard: old canvas release rejected, native UI/keyboard/canvas click retained, two pointers, cancel, lifetime cleanup, reused-ID race; 3 mutations rejected';
}

export function d053Guards(log,match='') {
  const tests=[['native click origin and cleanup safety',clickOriginGuard],['original 156-file rule/save/RNG/render/content scope',originalScope],['18-tool metadata, base cost and all rank/mode locks',metadata],['rank presentation versus untouched authoritative ladder',ranks],['actual promotion notification truth',promotionTruth],['deep read-only helper queries',readOnly],['placement and cost claims match real preview rules',placementTruth],['uninterrupted model/report/save/RNG control trajectories',trajectories],['actual catalog module state and held control lifecycle',catalogBehavior],['actual growth panel and visible refresh integration',growthBehavior],['actual city selection, placement and undo integration',selectionAndCommit],['behavior mutation sensitivity',mutations]];
  for(const [name,fn] of tests)if(!match||name.includes(match))try{log(true,'D053 '+name,fn());}catch(error){log(false,'D053 '+name,error.stack);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  let bad=0;d053Guards((ok,name,detail)=>{console.log(ok?'OK':'NG',name,detail??'');if(!ok)bad++;},process.argv[2]??'');process.exitCode=bad?1:0;
}
