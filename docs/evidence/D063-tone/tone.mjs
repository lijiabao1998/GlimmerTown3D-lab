// 前後對照圖的整體色調量測（分析用；結果存成同資料夾的 tone-2026-10-14.json；node docs/evidence/D063-tone/tone.mjs 可重跑）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decodePng} from '../../../tools/png.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),dir=path.join(here,'../../img/D063');
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.png')).sort();
const rows=[];
for(const f of files){
  const buf=fs.readFileSync(path.join(dir,f)),img=decodePng(buf),{w,h,bpp,data}=img,vw=(w-8)/2;
  const half=(x0,x1)=>{
    let n=0,r=0,g=0,b=0,l=0,sat=0;const colours=new Set();
    for(let y=24;y<h-4;y++)for(let x=x0;x<x1;x++){
      const o=(y*w+x)*bpp,R=data[o],G=data[o+1],B=data[o+2];
      n++;r+=R;g+=G;b+=B;l+=0.2126*R+0.7152*G+0.0722*B;
      const mx=Math.max(R,G,B),mn=Math.min(R,G,B);sat+=mx?(mx-mn)/mx:0;colours.add((R<<16)|(G<<8)|B);
    }
    return {luma:+(l/n).toFixed(3),redMinusBlue:+((r-b)/n).toFixed(3),saturation:+(sat/n).toFixed(4),distinctColours:colours.size,pixels:n};
  };
  const A=half(0,vw),B=half(vw+8,w);
  rows.push({file:f,sha256:crypto.createHash('sha256').update(buf).digest('hex'),viewWidth:vw,before:A,after:B,
    dLumaPct:+((B.luma/A.luma-1)*100).toFixed(2),dRedMinusBlue:+(B.redMinusBlue-A.redMinusBlue).toFixed(2),dSaturation:+(B.saturation-A.saturation).toFixed(4)});
}
const out={card:'D063',savedAt:'2026-10-14',
  method:'Each docs/img/D063/D063-pair-*.png is BEFORE (commerceArt=legacy) | 8px divider | AFTER (default) at the same camera. For each half, rows 24..h-4 are used (the label badge is excluded). luma = mean(0.2126R+0.7152G+0.0722B) over 0..255; redMinusBlue = mean(R-B), a crude warmth proxy; saturation = mean HSV saturation; distinctColours = number of different RGB triples. Decoder: tools/png.mjs. Whole frame, not only commerce blocks, so the numbers dilute the effect on the redrawn buildings themselves.',
  limits:['whole-frame averages over a picture that also contains non-commerce buildings, ground and sky','one camera per picture; two reference cities','luma/R-B are proxies for "darker/warmer", not a perceptual colour-difference metric (no ΔE computed)'],
  rows};
fs.writeFileSync(path.join(here,'tone-2026-10-14.json'),JSON.stringify(out,null,1)+'\n');
const pick=n=>rows.find(r=>r.file===`D063-pair-${n}.png`);
for(const n of ['seed516-far-1440','seed516-downtown-1440','seed516-downtown-close-1440','seed516-downtown-360','seed516-downtown-412','ai120-default-1440','gothicHotel-main-se-1440','steppedOffice-main-se-1440','domedTower-main-se-1440','bridgedCourt-main-se-1440']){
  const r=pick(n);console.log(n.padEnd(30),'dLuma%',String(r.dLumaPct).padStart(6),'dR-B',String(r.dRedMinusBlue).padStart(6),'dSat',String(r.dSaturation).padStart(7),'colours',r.before.distinctColours,'→',r.after.distinctColours);
}
const m=rows.filter(r=>r.file.includes('-main-se-'));
console.log('model-pairs n=',m.length,'luma% range',Math.min(...m.map(r=>r.dLumaPct)),Math.max(...m.map(r=>r.dLumaPct)),'dR-B range',Math.min(...m.map(r=>r.dRedMinusBlue)),Math.max(...m.map(r=>r.dRedMinusBlue)));
