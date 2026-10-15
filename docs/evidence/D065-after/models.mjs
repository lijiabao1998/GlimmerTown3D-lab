// D065 八個獨棟屋形的量測（可重跑）：node docs/evidence/D065-after/models.mjs [--write]
// 每個形：加權三角形（牆＋其他各算兩次、點綴算一次）、各網格的三角形數、最高點（格）、佔地（地塊的比例）、六組色的相異數；
// 每個原型內形與形的高度場（41×41）相異格比例；兩座基準城 B、C 兩檔整城的前後（旗標關＝D064）與逐塊成本。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {drawHouseCase,validGeometry,heightMap} from '../../../tools/unit-d065.mjs';
import {HOUSE_FORMS,HOUSE_MODELS,houseBlock} from '../../../src/content/britishHouses.ts';
import {buildCityScene} from '../../../src/render/cityScene.ts';
import {ConState} from '../../../src/render/construction.ts';
import {sceneDigest} from '../../../src/render/digest.ts';
import {STYLES} from '../../../src/render/styles.ts';
import {kindTableFrom} from '../../../src/content/kindTable.ts';
import {d058Blocks,d058City} from '../../../tools/unit-d058.mjs';
import {weighted} from '../../../tools/d060-baseline.mjs';
import {civicOf,isHouse,BASE_FLAGS} from '../../../tools/d065-baseline.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const out={models:{},structure:{},cities:{}};
for(const model of HOUSE_MODELS) {
  const sigs=new Set();let r;
  for(let pal=0;pal<6;pal++){r=drawHouseCase(model,{pal,x0:0,z0:0,y0:0});sigs.add(sha(r.G.map(g=>[...g.col])));}
  r=drawHouseCase(model,{x0:0,z0:0,y0:0});
  const m=validGeometry(r);
  out.models[model]={weighted:r.cost,triangles:{walls:r.G[0].pos.length/9,other:r.G[1].pos.length/9,dress:r.G[2].pos.length/9},height:+m.top.toFixed(3),footprintU:m.lo[0].toFixed(3)+'..'+m.hi[0].toFixed(3),footprintV:m.lo[1].toFixed(3)+'..'+m.hi[1].toFixed(3),colourSets:sigs.size};
}
for(const arche of ['villa','modern']) {
  const maps=HOUSE_FORMS[arche].map(model=>({model,H:heightMap(drawHouseCase(model,{}))})),rows=[];
  for(let i=0;i<maps.length;i++)for(let j=i+1;j<maps.length;j++){let u=0,d=0;for(let c=0;c<maps[i].H.length;c++){const a=maps[i].H[c],b=maps[j].H[c];if(a>0||b>0){u++;if(Math.abs(a-b)>.03)d++;}}rows.push([maps[i].model,maps[j].model,+(100*d/u).toFixed(1)]);}
  out.structure[arche]={minDifferingPercent:Math.min(...rows.map(x=>x[2])),pairs:rows};
}
for(const id of ['seed516','ai120']) {
  const city=d058City(fs.readFileSync(path.join(root,`src/content/samples/${id}.code.txt`),'utf8'));out.cities[id]={};
  for(const mode of ['a','b','c']) {
    const res={};
    for(const on of [false,true]) {
      const blocks={...d058Blocks(city,mode),...BASE_FLAGS,...(on?{houseArt:true}:{})},con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civicOf(),con,true);
      try {
        const meshes=sceneDigest(built).meshes,owner=(n,o)=>meshes[n]?.ownerTris?.[o]??0,costs={};
        blocks.plan.forEach((b,bi)=>{const r=blocks.recipe(b);if(!isHouse(r))return;const o=-(bi+1),c=2*(owner('walls',o)+owner('other',o))+owner('dress',o);const k=`${r.arche} ${b.w}x${b.h}`;(costs[k]??=[]).push(c);});
        res[on?'after':'before']={weighted:weighted(built),houseBlocks:Object.values(costs).reduce((n,a)=>n+a.length,0),houseCost:Object.values(costs).flat().reduce((a,b)=>a+b,0),costRange:Object.fromEntries(Object.entries(costs).map(([k,a])=>[k,[Math.min(...a),Math.max(...a),a.length]]))};
      } finally {built.dispose();con.dispose();}
    }
    res.delta=res.after.weighted-res.before.weighted;out.cities[id][mode]=res;
  }
}
const text=JSON.stringify(out,null,1)+'\n';
if(process.argv.includes('--write'))fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'models.json'),text);else process.stdout.write(text);
