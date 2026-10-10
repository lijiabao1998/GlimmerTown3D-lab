// D056: derive the ai120 render budget from actual decoded/restyled geometry.
// Pipeline.sceneInfo includes the main scene AND its directional-light shadow pass.
// Therefore walls/other count twice, while non-shadow-casting dress counts once.
// No browser, WebGL, recorded browser result, or replacement geometry is used here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
import {drawOne} from './d018-kinds.mjs';
import {D056_LEGACY} from './d056-legacy.mjs';
import {viewCode} from '../src/io/save.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {kindColors,shapeOf} from '../src/content/kindShapes.ts';
import {gridOf,drawPlan} from '../src/content/blocks.ts';
import {recipe} from '../src/content/recipes.ts';
import {dressing} from '../src/content/dressing.ts';
import {facadePlan,trimPlan} from '../src/content/facades.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {STYLES} from '../src/render/styles.ts';

const read = file => JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const sum = values => values.reduce((a,b) => a+b,0);
const triangleCounts = drawing => drawing.G.map(g => g.pos.length/9);

export function assertD056RenderBudget() {
  const kinds=kindTableFrom(read('src/content/lab-kinds.json'));
  const looks=read('src/content/lab-looks.json').looks;
  const arche=read('src/content/lab-arche.json').arche;
  const vrank=read('src/content/samples/d009-live.json').vrank;
  const code=fs.readFileSync(path.join(ROOT,'src/content/samples/ai120.code.txt'),'utf8').trim();
  const loaded=viewCode(code,kinds,vrank); // Exactly the read-only sample path in cityView.load.
  assert.equal(loaded.ok,true);
  assert.equal(loaded.restyled,132);
  const city=loaded.city;
  assert.equal(city.buildings.length,399);

  // Independently count each actual school/hospital/clinic, retaining its lv/v/size.
  const expected={
    7:{count:8,old:[8,28,22],now:[24,46,190],delta:[16,18,168]},
    12:{count:1,old:[10,0,40],now:[32,44,152],delta:[22,44,112]},
    13:{count:10,old:[10,0,40],now:[16,36,160],delta:[6,36,120]},
  };
  const counts={},delta=[0,0,0];
  for(const b of city.buildings) {
    if(b.goneDay!==undefined || !D056_LEGACY[b.k]) continue;
    const pin=expected[b.k];
    assert.ok(pin,'unexpected revised kind in ai120: '+b.k);
    counts[b.k]=(counts[b.k]??0)+1;
    const old=drawOne(kinds,looks,b.k,b.lv,b.v,b.size,D056_LEGACY[b.k]);
    const now=drawOne(kinds,looks,b.k,b.lv,b.v,b.size);
    assert.deepEqual(triangleCounts(old),pin.old,'legacy W/O/D '+b.k);
    assert.deepEqual(triangleCounts(now),pin.now,'current W/O/D '+b.k);
    assert.deepEqual(old.trees,[]); assert.deepEqual(now.trees,[]);
    const change=triangleCounts(now).map((n,i)=>n-triangleCounts(old)[i]);
    assert.deepEqual(change,pin.delta);
    change.forEach((n,i)=>delta[i]+=n);
  }
  assert.deepEqual(counts,{7:8,12:1,13:10});
  assert.deepEqual(delta,[210,548,2656]);
  const primaryDelta=sum(delta),shadowDelta=delta[0]+delta[1];
  const submittedDelta=primaryDelta+shadowDelta;
  assert.equal(primaryDelta,8*202+178+10*162);
  assert.equal(primaryDelta,3414);
  assert.equal(shadowDelta,8*34+66+10*42);
  assert.equal(shadowDelta,758);
  assert.equal(submittedDelta,8*236+244+10*204);
  assert.equal(submittedDelta,4172);

  // Rebuild the complete production scene in each density mode. Verify real mesh
  // shadow flags and unchanged non-civic geometry, then recover the old budgets
  // and derive the new ones. This does not merely accept browser-observed pins.
  const modes={},oldPins={a:80078,b:69682,c:76644};
  for(const mode of ['a','b','c']) {
    const recipeOf=b=>recipe(arche,b.k,b.lv,b.w,b.h,b.v);
    const blocks={mode,plan:drawPlan(gridOf(city),arche,mode),recipe:recipeOf,
      dress:b=>dressing(recipeOf(b)),detail:mode!=='a',
      facade:b=>facadePlan(recipeOf(b)),trim:b=>trimPlan(recipeOf(b))};
    const snapshots=[];
    for(const legacy of [true,false]) {
      const civic={shape:k=>legacy?(D056_LEGACY[k]??shapeOf(k,false)):shapeOf(k,false),
        colors:(k,lv)=>kindColors(looks,k,lv,kinds.catColor(kinds.cat(k)))};
      const con=new ConState(city.n);
      const built=buildCityScene(city,kinds,STYLES.A,blocks,'d',civic,con,true);
      try {
        let shadowLights=0;
        built.scene.traverse(o=>{if(o.isLight&&o.castShadow)shadowLights++;});
        assert.equal(shadowLights,1);
        const meshes=built.meshStats();
        for(const name of ['walls','other','dress']) {
          const mesh=meshes.find(m=>m.name===name);
          assert.ok(mesh);
          assert.equal(mesh.shadow,name!=='dress','production shadow flag '+name);
        }
        snapshots.push({meshes,total:sum(meshes.map(m=>m.tris*(m.shadow?2:1)))});
      } finally {built.dispose();con.dispose();}
    }
    const [old,now]=snapshots;
    assert.equal(old.total,oldPins[mode],'independently rebuilt legacy '+mode);
    assert.deepEqual(now.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),
      old.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),
      'all non-building meshes remain unchanged '+mode);
    assert.deepEqual(['walls','other','dress'].map(name=>
      now.meshes.find(m=>m.name===name).tris-old.meshes.find(m=>m.name===name).tris),delta);
    assert.equal(now.total-old.total,submittedDelta,'complete scene delta '+mode);
    modes[mode]={legacy:old.total,current:now.total,delta:now.total-old.total};
  }
  return {restyled:loaded.restyled,counts,arenaDelta:delta,primaryDelta,shadowDelta,submittedDelta,modes};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(assertD056RenderBudget(),null,2));
}
