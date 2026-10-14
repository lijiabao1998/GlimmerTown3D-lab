// 存證守衛：D056–D058 的核准圖已存進 repo（docs/img/D05x/{before,after}），清單在 docs/evidence/approval-images-D056-D058.json。
// 只證明三件事：存進來的檔案沒被改過、沒漏檔、前後成對且尺寸正確；每張圖的雜湊都有該卡 CI 擷取報告背書。
// 不證明畫面好看，也不證明業主看的就是這些檔案（業主核准紀錄只寫候選 SHA 與張數，限制見 docs/evidence/approval-images-D056-D058.md）。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const MANIFEST='docs/evidence/approval-images-D056-D058.json';
const PAIRS={D056:30,D057:27,D058:62};                                   // 各卡的前後對數（60／54／124 張）
const SIZE={1440:[1440,1000],360:[360,740],412:[412,860]};              // 檔名尾碼＝視口寬度 → 實際像素
const PNG_SIGNATURE='89504e470d0a1a0a';
const REPORT_WITH_HASHES=/(capture|before|after)\.json$|pairs\.json$/;   // 這些報告逐張記了 PNG 的 SHA-256
const sha=buf=>createHash('sha256').update(buf).digest('hex');

const realIo={
  read:rel=>{try{return fs.readFileSync(path.join(ROOT,rel));}catch{return null;}},
  list:rel=>{try{return fs.readdirSync(path.join(ROOT,rel));}catch{return [];}}
};

// 回傳問題清單（空陣列＝全部成立）。io 可替換，負向控制用它餵被改過的內容。
export function auditEvidence(manifest,io=realIo) {
  const problems=[],bad=message=>problems.push(message);
  for(const [id,pairs] of Object.entries(PAIRS)) {
    const set=manifest.sets?.[id];
    if(!set){bad(`${id}：清單缺這一卡`);continue;}
    const {artifact,workflowRun}=set;
    if(!/^[0-9a-f]{64}$/.test(artifact?.zipSha256??''))bad(`${id}：artifact ZIP 雜湊格式不對`);
    if(!/^[0-9a-f]{40}$/.test(workflowRun?.headSha??'')||!String(artifact?.name).endsWith(workflowRun.headSha))bad(`${id}：artifact 名稱必須以候選 SHA 結尾`);
    const dims=new Map();
    for(const phase of ['before','after']) {
      const list=set.images?.[phase]??[],dir=`docs/img/${id}/${phase}`;
      if(list.length!==pairs)bad(`${id} ${phase}：${list.length} 張，應為 ${pairs}`);
      const onDisk=io.list(dir).filter(name=>/\.png$/i.test(name)).sort(),listed=list.map(item=>item.file).sort();
      if(JSON.stringify(onDisk)!==JSON.stringify(listed))bad(`${dir}：目錄裡的 PNG 與清單不一致`);
      for(const item of list) {
        const buf=io.read(`${dir}/${item.file}`);
        if(!buf){bad(`${dir}/${item.file}：檔案不存在`);continue;}
        if(buf.length!==item.bytes)bad(`${dir}/${item.file}：位元組數 ${buf.length}≠清單 ${item.bytes}`);
        if(sha(buf)!==item.sha256)bad(`${dir}/${item.file}：SHA-256 與清單不符`);
        if(buf.subarray(0,8).toString('hex')!==PNG_SIGNATURE){bad(`${dir}/${item.file}：不是 PNG`);continue;}
        dims.set(`${phase}:${item.file}`,[buf.readUInt32BE(16),buf.readUInt32BE(20)]);
      }
    }
    for(const item of set.images?.before??[]) {
      const mate=item.file.replace(`${id}-before-`,`${id}-after-`),a=dims.get(`before:${item.file}`),b=dims.get(`after:${mate}`);
      if(!b){bad(`${id}：${item.file} 沒有成對的 ${mate}`);continue;}
      const want=SIZE[Number(/-(\d+)\.png$/.exec(item.file)?.[1])];
      if(!want){bad(`${id}：${item.file} 檔名尾碼不是三種視口寬度之一`);continue;}
      for(const [name,size] of [[item.file,a],[mate,b]])if(size&&(size[0]!==want[0]||size[1]!==want[1]))bad(`${id}：${name} 尺寸 ${size.join('×')}，應為 ${want.join('×')}`);
    }
    let reportText='';
    for(const report of set.reports??[]) {
      const buf=io.read(report.file);
      if(!buf){bad(`${report.file}：報告不存在`);continue;}
      if(sha(buf)!==report.sha256||buf.length!==report.bytes)bad(`${report.file}：報告與清單不符`);
      if(REPORT_WITH_HASHES.test(report.file))reportText+=buf.toString('utf8')+'\n';
    }
    for(const phase of ['before','after'])for(const item of set.images?.[phase]??[])if(!reportText.includes(item.sha256))bad(`${id}：${phase}/${item.file} 的雜湊沒有出現在該卡的 CI 擷取報告`);
  }
  return problems;
}

export async function evidenceImageGuards(log) {
  const test=(name,fn)=>{try{fn();log(true,'存證 '+name);}catch(e){log(false,'存證 '+name,e.stack??String(e));}};
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,MANIFEST),'utf8'));
  const first=(id,phase)=>manifest.sets[id].images[phase][0];
  const over=(files,{hide=[],extra=[]}={})=>({
    read:rel=>files.has(rel)?files.get(rel):realIo.read(rel),
    list:rel=>[...realIo.list(rel).filter(name=>!hide.includes(`${rel}/${name}`)),...extra.filter(e=>e.startsWith(rel+'/')).map(e=>e.slice(rel.length+1))]
  });
  const flip=buf=>{const copy=Buffer.from(buf);copy[copy.length>>1]^=1;return copy;};

  test('D056／D057／D058 的 238 張核准圖與清單逐位元組一致，前後成對、尺寸正確，且每張都有 CI 擷取報告背書',()=>{
    assert.deepEqual(auditEvidence(manifest),[]);
    const total=Object.values(manifest.sets).reduce((n,set)=>n+set.images.before.length+set.images.after.length,0);
    assert.equal(total,238);
    for(const [id,set] of Object.entries(manifest.sets)) {
      const hashes=[...set.images.before,...set.images.after].map(item=>item.sha256);
      assert.equal(new Set(hashes).size,hashes.length,`${id}：兩張圖不該逐位元組相同`);
    }
  });

  test('負向控制：改一個位元組、換掉前後兩張、藏一張、多一張、改候選 SHA，都必須被抓到',()=>{
    const a=first('D056','before'),pathA=`docs/img/D056/before/${a.file}`,bufA=realIo.read(pathA);
    let problems=auditEvidence(manifest,over(new Map([[pathA,flip(bufA)]])));
    assert.ok(problems.some(p=>p.includes('SHA-256 與清單不符')),'改一個位元組');

    const b=manifest.sets.D058.images.before[1],c=manifest.sets.D058.images.after.find(item=>item.file===b.file.replace('-before-','-after-'));
    const pathB=`docs/img/D058/before/${b.file}`,pathC=`docs/img/D058/after/${c.file}`;
    problems=auditEvidence(manifest,over(new Map([[pathB,realIo.read(pathC)],[pathC,realIo.read(pathB)]])));
    assert.ok(problems.filter(p=>p.includes('SHA-256 與清單不符')).length>=2,'前後兩張對調');

    const d=first('D057','after');
    problems=auditEvidence(manifest,over(new Map(),{hide:[`docs/img/D057/after/${d.file}`]}));
    assert.ok(problems.some(p=>p.includes('目錄裡的 PNG 與清單不一致')),'藏一張');

    problems=auditEvidence(manifest,over(new Map(),{extra:['docs/img/D056/after/D056-after-extra-1440.png']}));
    assert.ok(problems.some(p=>p.includes('目錄裡的 PNG 與清單不一致')),'多一張');

    const forged=structuredClone(manifest);forged.sets.D057.workflowRun.headSha='0'.repeat(40);
    assert.ok(auditEvidence(forged).some(p=>p.includes('artifact 名稱必須以候選 SHA 結尾')),'候選 SHA 與 artifact 名稱不一致');

    const short=structuredClone(manifest);short.sets.D058.images.after.pop();
    assert.ok(auditEvidence(short).some(p=>p.includes('應為 62')),'少一張');
  });

  test('負向控制：圖與清單一起被改成新位元組（自洽的偽造），仍因 CI 擷取報告裡沒有這個雜湊而被抓到',()=>{
    const forged=structuredClone(manifest),item=forged.sets.D058.images.after[0];
    const rel=`docs/img/D058/after/${item.file}`,fake=flip(realIo.read(rel));
    item.bytes=fake.length;item.sha256=sha(fake);
    const problems=auditEvidence(forged,over(new Map([[rel,fake]])));
    assert.deepEqual(problems,[`D058：after/${item.file} 的雜湊沒有出現在該卡的 CI 擷取報告`]);
  });
}
