// D064 基線之三：兩座基準城、三個畫法檔（A 一格一棟／B／C）的整城加權三角形，在 D062 候選畫法（commerceArt 關）與 D063 畫法（commerceArt 開）下，
// 以及四種合併塔（33、34、105、106）的合計。加權＝牆與其他兩個會投影的網格各算兩次、點綴算一次（跟 tools/d060-baseline.mjs 的 weighted 同一個式子）。
// 只讀、可重跑：node docs/evidence/D064-baseline/modes.mjs   （寫出同資料夾的 modes.json）
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url)),R=path.join(here,'../../..');
const imp=p=>import(pathToFileURL(path.join(R,p)).href);
const {buildCityScene}=await imp('src/render/cityScene.ts');
const {ConState}=await imp('src/render/construction.ts');
const {sceneDigest}=await imp('src/render/digest.ts');
const {STYLES}=await imp('src/render/styles.ts');
const {kindTableFrom}=await imp('src/content/kindTable.ts');
const {kindColors,shapeOf}=await imp('src/content/kindShapes.ts');
const {d058Blocks,d058City}=await imp('tools/unit-d058.mjs');
const {weighted}=await imp('tools/d060-baseline.mjs');
const read=f=>JSON.parse(fs.readFileSync(path.join(R,f),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
const out={head:execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim(),flags:'villageArt industryArt on; commerceArt off = D062 candidate, on = D063',cities:{}};
for(const id of ['seed516','ai120']){
  const city=d058City(fs.readFileSync(path.join(R,`src/content/samples/${id}.code.txt`),'utf8'));
  const towers=city.buildings.filter(b=>b.goneDay===undefined&&[33,34,105,106].includes(b.k));
  const byKind={};for(const b of towers)byKind[b.k]=(byKind[b.k]??0)+1;
  out.cities[id]={towers:towers.length,byKind,modes:{}};
  for(const mode of ['a','b','c']){
    const row={};
    for(const commerce of [false,true]){
      const blocks={...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:commerce};
      const con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
      try{
        const meshes=sceneDigest(built).meshes,owner=(name,o)=>meshes[name]?.ownerTris?.[o]??0;
        let t=0;for(const b of towers)t+=2*(owner('walls',b.id)+owner('other',b.id))+owner('dress',b.id);
        row[commerce?'d063':'d062']={scene:weighted(built),towers:t};
      }finally{built.dispose();con.dispose();}
    }
    out.cities[id].modes[mode]=row;
    console.log(id,mode,JSON.stringify(row));
  }
}
fs.writeFileSync(path.join(here,'modes.json'),JSON.stringify(out,null,1)+'\n');
