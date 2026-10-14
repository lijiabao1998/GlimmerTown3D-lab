// D064 基線之一：D063 之後，兩座基準城（seed516、ai120）C 檔最高的 30 個結構各屬於哪一波、還有多少是通用美術。
// 只讀、可重跑：node docs/evidence/D064-baseline/skyline.mjs   （寫出同資料夾的 skyline.json）
// 街區高度＝以該街區自己的配方呼叫舊畫法 drawBlock 後的最高頂點（D063 的新畫法高度與舊畫法接近，上限在 unit-d063 的 CEIL）；特殊建築高度＝場景裡該棟的包圍盒頂。單位：格。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),R=path.join(here,'../../..');
const imp=p=>import(pathToFileURL(path.join(R,p)).href);
const {buildCityScene}=await imp('src/render/cityScene.ts');
const {ConState}=await imp('src/render/construction.ts');
const {STYLES}=await imp('src/render/styles.ts');
const {kindTableFrom}=await imp('src/content/kindTable.ts');
const {kindColors,shapeOf}=await imp('src/content/kindShapes.ts');
const {isBritishStreet}=await imp('src/content/britishStreets.ts');
const {villageBlock,villageKind}=await imp('src/content/britishVillage.ts');
const {industryBlock}=await imp('src/content/britishIndustry.ts');
const {commerceBlock}=await imp('src/content/britishCommerce.ts');
const {BRITISH_KINDS}=await imp('src/content/britishCivic.ts');
const {BRITISH_HERITAGE_KINDS}=await imp('src/content/britishHeritage.ts');
const {Geo}=await imp('src/render/scene.ts');
const {drawBlock,emptyCounts}=await imp('src/render/blockArt.ts');
const {facadePlan,trimPlan}=await imp('src/content/facades.ts');
const {dressing}=await imp('src/content/dressing.ts');
const {d058Blocks,d058City}=await imp('tools/unit-d058.mjs');
const read=f=>JSON.parse(fs.readFileSync(path.join(R,f),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
const KIND_NAME=new Map(read('src/content/lab-kinds.json').kinds.map(r=>[r.k,r.name]));
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
const classify=r=>isBritishStreet(r)?'D058':villageBlock(r)?'D059':industryBlock(r)?'D060':commerceBlock(r)?'D063':'generic';
const out={head:null,cities:{}};
for(const id of ['seed516','ai120']){
  const city=d058City(fs.readFileSync(path.join(R,`src/content/samples/${id}.code.txt`),'utf8'));
  const blocks={...d058Blocks(city,'c'),villageArt:true,industryArt:true,commerceArt:true,detail:true};
  const con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
  const rows=[];
  blocks.plan.forEach(b=>{
    const r=blocks.recipe(b);
    const G=[new Geo({ext:true}),new Geo(),new Geo()];for(const g of G)g.owner=-1;
    try{drawBlock(...G,b,r,dressing(r),0,[],emptyCounts(),facadePlan(r),trimPlan(r),null);}catch{return;}
    let top=0;for(const g of G)for(let i=1;i<g.pos.length;i+=3)top=Math.max(top,g.pos[i]);
    rows.push({what:`block k${b.k} lv${r.lv} ${r.arche}/${r.path} ${b.w}x${b.h}`,wave:classify(r),height:+top.toFixed(2)});
  });
  const boxes=built.ownerBoxes();
  for(const b of city.buildings){
    if(b.goneDay!==undefined||b.k<=3||!civic.shape(b.k))continue;
    const bx=boxes[b.id];if(!bx)continue;
    const wave=BRITISH_KINDS.has(b.k)?'D056':BRITISH_HERITAGE_KINDS.has(b.k)?'D057':villageKind(b.k)?'D059':'generic';
    rows.push({what:`special ${b.k} ${KIND_NAME.get(b.k)??''}`,wave,height:+bx[5].toFixed(2)});
  }
  rows.sort((a,b)=>b.height-a.height);
  const top=N=>{const t=rows.slice(0,N),g=t.filter(r=>r.wave==='generic').length;return {n:N,generic:g,share:+(g/N).toFixed(3)};};
  out.cities[id]={structures:rows.length,tallest:rows.slice(0,30),genericShare:[top(10),top(20),top(30)]};
  built.dispose();con.dispose();
}
import {execFileSync} from 'node:child_process';
out.head=execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim();
fs.writeFileSync(path.join(here,'skyline.json'),JSON.stringify(out,null,1)+'\n');
for(const [id,c] of Object.entries(out.cities)){
  console.log(`\n== ${id}: ${c.structures} structures; generic share of the tallest`,JSON.stringify(c.genericShare));
  c.tallest.slice(0,12).forEach((r,i)=>console.log(String(i+1).padStart(2),String(r.height).padStart(6),r.wave.padEnd(8),r.what));
}
