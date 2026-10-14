// D064 基線之二：四種特殊高樓（33 住宅摩天樓、34 商業摩天樓、105 住宅巨廈、106 商業綜合體）舊畫法每個變體的加權三角形與高度；
// 並列同類的其他高大特殊種類做對照。加權＝牆與其他兩個會投影的網格各算兩次、點綴算一次（跟 d060／d063 基線同一個式子）。
// 只讀、可重跑：node docs/evidence/D064-baseline/oldcost.mjs   （寫出同資料夾的 oldcost.json）
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url)),R=path.join(here,'../../..');
const imp=p=>import(pathToFileURL(path.join(R,p)).href);
const {kindTableFrom}=await imp('src/content/kindTable.ts');
const {kindColors,shapeOf}=await imp('src/content/kindShapes.ts');
const {Geo}=await imp('src/render/scene.ts');
const {drawKind}=await imp('src/render/kindArt.ts');
const read=f=>JSON.parse(fs.readFileSync(path.join(R,f),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
const tri=g=>g.pos.length/9;
const TARGET=[33,34,105,106],CONTEXT=[103,127,135,136,174,123];
const out={head:execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim(),target:TARGET,kinds:{}};
for(const r of read('src/content/lab-kinds.json').kinds.filter(r=>[...TARGET,...CONTEXT].includes(r.k))){
  const lv=1,vars=r.variants?.['1']??1,sh=civic.shape(r.k),rows=[];
  for(let v=0;v<vars;v++){
    const G=[new Geo({ext:true}),new Geo(),new Geo()];for(const g of G)g.owner=1;
    const H=Math.max(0.12,KT.height(r.k,lv,v));
    drawKind({W:G[0],O:G[1],D:G[2],trees:[],x0:0,z0:0,s:r.size,y0:0,H,k:r.k,v,C:civic.colors(r.k,lv)},sh);
    let top=0;for(const g of G)for(let i=1;i<g.pos.length;i+=3)top=Math.max(top,g.pos[i]);
    rows.push({variant:v,H:+H.toFixed(2),top:+top.toFixed(2),walls:tri(G[0]),other:tri(G[1]),dress:tri(G[2]),weighted:2*(tri(G[0])+tri(G[1]))+tri(G[2])});
  }
  out.kinds[r.k]={name:r.name,size:r.size,target:TARGET.includes(r.k),shape:sh?.type,params:sh?.p,variants:rows};
}
fs.writeFileSync(path.join(here,'oldcost.json'),JSON.stringify(out,null,1)+'\n');
for(const [k,v] of Object.entries(out.kinds))console.log(`k${k} ${v.name} ${v.size}×${v.size} ${v.target?'[D064]':'     '} weighted/variant`,v.variants.map(x=>x.weighted).join(','),'height',v.variants.map(x=>x.H).join(','));
