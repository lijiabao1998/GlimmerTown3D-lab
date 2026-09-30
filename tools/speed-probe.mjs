// 機器速度校準（D030 補）：把「推進一天 ≤ 5 ms」這種牆上時間的預算，換成「這台機器上的 5 ms」。
// 起因：D030 那一輪 main 的 CI 煙霧紅在 D011 驗收 8（5.41 ms > 5），同一棵樹（ce65a7f）在同步工作階段分支的 CI 卻綠；本機三次重演各 4.1–5.0 ms。
//   CI 機器比開發機慢（約 1.2–1.3 倍）、又常有鄰居，牆上時間的絕對門檻在這條線上會隨機紅。門檻的意思是「一天的推進不要卡住一幀」，跟機器速度有關。
// 做法：在同一個頁面、同一個瀏覽器裡跑一段跟遊戲程式碼無關的固定工作（探針：72×72 個物件格上的洪水填充＋掃描，跟模擬的讀寫形狀相似），取最小值 P；
//   上限 ＝ 基準門檻 × clamp(P / 基準探針時間 R, 1, 2)。
//   · 比開發機快的機器不會更嚴（係數下限 1）；慢到兩倍以上不再放寬（上限 2）。
//   · 探針跟遊戲程式碼無關，所以模擬變慢（退步）不會被校準吃掉：模擬慢了、探針沒變，係數不變、照樣判紅。
//   · R＝開發機（這個容器、Chromium 141）上同一個探針取最小值的中位數；換了開發機要重量並改這個數（量法：node tools/probe-speed.mjs，見 docs/D030-city-events.md「CI 補救」）。
export const SPEED_REF_MS = 5.9;
export const SPEED_CAP = 2;
// 探針：回傳 { ms, sink }。ms＝九批（每批 8 輪）裡最快的一批；sink＝工作的結果（固定，守衛核對探針真的是同一份工作，沒被編譯器整段丟掉）
export const SPEED_PROBE = `(()=>{const N=72,T=[];for(let i=0;i<N*N;i++)T.push({t:i%7,road:(i%5===0||((i/N|0)%6===0))?1:0,rc:2,zone:i%3,bld:(i%11===0)?{k:i%9,lv:1+(i%3),h:i%13}:null,tree:i%17===0?1:0,rp:false,seen:0});`
  + `const D=[[0,-1],[1,0],[0,1],[-1,0]];`
  + `const once=()=>{let s=0;for(let k=0;k<12;k++){for(const t of T){t.seen=0;t.rp=false;}const q=new Int32Array(N*N);let h=0,tl=0;for(let i=k;i<N*N;i+=97){if(T[i].road){T[i].seen=1;q[tl++]=i;}}`
  + `while(h<tl){const j=q[h++],x=j%N,y=(j/N)|0,t=T[j];if(t.road)t.rp=true;s+=t.rc+(t.bld?t.bld.lv:0);for(const [dx,dy] of D){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=N||ny>=N)continue;const nj=ny*N+nx,nt=T[nj];if((nt.road||nt.tree)&&!nt.seen){nt.seen=1;q[tl++]=nj;}}}`
  + `for(let i=0;i<N*N;i++){const t=T[i];if(t.bld&&t.zone)s+=t.bld.h*(t.road?2:1);}}return s;};`
  + `let best=1e9,sink=0;for(let r=0;r<9;r++){const a=performance.now();sink=0;for(let i=0;i<8;i++)sink+=once();const b=performance.now()-a;if(b<best)best=b;}return {ms:best,sink};})()`;
export const speedFactor = probeMs => Math.min(SPEED_CAP, Math.max(1, probeMs / SPEED_REF_MS));
export const speedLimit = (baseMs, probeMs) => baseMs * speedFactor(probeMs);
