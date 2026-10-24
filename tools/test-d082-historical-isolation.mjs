// Browser-recipe regression only. Does not substitute for real WebGL reruns.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {D081_CAPTURE_SOURCES,d081CaptureQuery,assertD081CaptureUrl} from './d081-capture.mjs';
import {shapeOf} from '../src/content/kindShapes.ts';
import {d081City} from './unit-d081.mjs';
import {d058City} from './unit-d058.mjs';
import {d055ReviewCode} from './d055-scenes.mjs';
import {d059ReviewCode} from './d059-scenes.mjs';
import {d060ReviewCode} from './d060-scenes.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
export function d082HistoricalIsolationGuards(){
 const source=read('src/cityView.ts');
 const flag=name=>{const m=source.match(new RegExp('const '+name+' = ([^;]+);'));assert.ok(m,'actual production flag '+name);return q=>Function('q','return ('+m[1]+')')(new URLSearchParams(q));};
 const coastal=flag('coastalRecreationOn'),fieldStudy=flag('fieldStudyLodgeOn');
 let queries=0,negativeControls=0;
 for(const viewport of [360,412,1440])for(const scenario of D081_CAPTURE_SOURCES)for(const phase of ['before','after']){
  const query=d081CaptureQuery(scenario.sample,phase);assert.equal(coastal(query),false,'D081 '+viewport+' '+scenario.id+' '+phase+' excludes only new coastal layer');assert.equal(fieldStudy(query),phase==='after','D081 own phase remains intact');
  assertD081CaptureUrl('http://127.0.0.1:8380/?'+query,scenario.sample,phase);queries++;
  for(const bad of [query.replace('&coastalArt=legacy',''),query.replace('coastalArt=legacy','coastalArt=current'),query+'&coastalArt=current']){assert.throws(()=>assertD081CaptureUrl('http://127.0.0.1:8380/?'+bad,scenario.sample,phase),/actual browser URL/);negativeControls++;}
  if(phase==='after')assert.equal(coastal(query.replace('&coastalArt=legacy','')),true,'negative control reproduces formerly contaminated D081 after recipe');
 }
 // Read the actual D082 browser recipe rather than duplicating its flags in this test.
 const inspect=read('tools/d082-inspect.mjs'),recipe=inspect.match(/await open\(('sample='\+sample[^;]+)\);/);assert.ok(recipe,'D082 actual browser load recipe');const query082=Function('sample','phase','return '+recipe[1]);
 for(const sample of ['gallery','seed516','ai120'])for(const phase of ['before','after']){
  const q=query082(sample,phase);assert.equal(coastal(q),phase==='after','D082 retains its real default-on after phase');assert.equal(fieldStudy(q),true,'both D082 phases preserve preceding artwork');queries++;
  for(const k of [126,179,185,154]){const selected=shapeOf(k,...Array(17).fill(true),coastal(q));assert.equal(!!selected.p.coastalRecreation,phase==='after','actual production dispatch follows the selected recipe');}
 }
 assert.equal(coastal(''),true,'unqualified production default remains D082');
 // D072–D080 already select the next historical opt-out, which cascades to D082.
 for(const wave of ['072','073','074','076','077','078','079','080']){
  const text=read('tools/d'+wave+'-capture.mjs'),m=text.match(new RegExp('export function d'+wave+'CaptureQuery\\(sample,phase\\)\\{[\\s\\S]*?return ([^;]+);'));assert.ok(m,'actual historical query '+wave);const query=Function('sample','phase','return '+m[1]);
  for(const sample of ['gallery','seed516','ai120'])for(const phase of ['before','after']){assert.equal(coastal(query(sample,phase)),false,'D'+wave+' '+phase+' already excludes later artwork');queries++;}
 }
 // D068–D071 inline recipes carry their own/next-wave legacy flag in both phases.
 for(const wave of ['068','069','070','071']){const text=read('tools/d'+wave+'-capture.mjs'),m=text.match(/query:(`sample=\$\{source.sample\}&clean=1`\+\(phase==='before'\?[^\n]+?\)),shots:/);assert.ok(m,'inline historical recipe '+wave);const query=Function('source','phase','return '+m[1]);for(const phase of ['before','after']){assert.equal(coastal(query({sample:'gallery'},phase)),false);queries++;}}
 const smoke=read('tools/smoke.mjs');assert.match(smoke,/open:q=>open\(q\+\(q\?'&':''\)\+'streetArt=legacy'\)/,'historical smoke retains its existing boundary wrapper');assert.equal(coastal('sample=gallery&clean=1&streetArt=legacy'),false);queries++;
 // Earlier current-art exploratory captures use these real city samples, with no D082 owners.
 for(const sample of ['seed516','ai120'])assert.equal(d081City(sample).buildings.filter(b=>[126,179,185,154].includes(b.k)&&[0,1,2].includes(b.v)).length,0,sample+' has no new-art owners');
 for(const [name,make]of [['D055',d055ReviewCode],['D059',d059ReviewCode],['D060',d060ReviewCode]])assert.equal(d058City(make()).buildings.filter(b=>[126,179,185,154].includes(b.k)).length,0,name+' authored review fixture has no new-art kinds');
 return {passed:true,queries,negativeControls,qualification:'Production flag/dispatch and exact browser-recipe tests. Real browser geometry rerun still required.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(d082HistoricalIsolationGuards(),null,2));
