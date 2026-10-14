// D061 瀏覽器層的 legacy 對照（人工、一次性；不在 CI）：D060 候選基線建置（d4cef37，不認 landArt）與現行建置的 ?landArt=legacy，
// 同世界、同鏡頭、同固定的模擬日進度，PNG 逐位元組比較。Node 守衛已證明地面像素與整座場景相同；這一支再證明「畫到螢幕上也相同」（含後製天空的閘門）。
//   git worktree add --detach ../d061-base d4cef37ae05b1ab65c801e8f3b76a1a4d40a91e4
//   (cd ../d061-base && ln -s <本倉庫>/node_modules node_modules && npm run build)
//   npm run build && node tools/d061-legacy-eq.mjs ../d061-base/dist
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {pageSession} from './smoke-d011.mjs';
import {D061_VIEWS,settle} from './d061-views.mjs';

const baseline=path.resolve(process.argv[2]??'');
if(!process.argv[2]||!fs.existsSync(path.join(baseline,'index.html'))){console.error('用法：node tools/d061-legacy-eq.mjs <D060 候選基線建置的 dist 目錄>');process.exit(2);}
const sha=b=>createHash('sha256').update(b).digest('hex').slice(0,16);
async function shot(root,v,flag,port) {
  let bytes;
  await withBrowser({root,width:Math.max(960,v.W),height:Math.max(900,v.H),port},async({page,open})=>{
    const p=await pageSession(page,open,{W:v.W,H:v.H,mobile:v.mobile});
    await p.open(`sample=${v.sample}&clean=1${flag?'&'+flag:''}`);await settle(p,v);await p.frames(3);
    bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
  });
  return bytes;
}
let all=true;
for(const v of D061_VIEWS) {
  const a=await shot(baseline,v,'',8371),b=await shot(path.join(ROOT,'dist'),v,'landArt=legacy',8372),same=Buffer.compare(a,b)===0;all&&=same;
  console.log(v.id.padEnd(18),same?'IDENTICAL':'DIFFERENT',a.length,b.length,sha(a),sha(b));
}
console.log(all?'ALL IDENTICAL':'SOME DIFFER');process.exitCode=all?0:1;
