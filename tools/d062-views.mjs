// D062 擷取共用：六個畫面沿用 D061（鏡頭同 docs/D061-landscape.md 與 docs/D062-seasons-weather.md 的基線表，所以繪製呼叫、三角形可以逐字對 D061 預設），
// 十種季節狀態、等鏡頭穩定。tools/d062-capture.mjs 用。
import {D061_VIEWS,settle} from './d061-views.mjs';

export {settle};
export const D062_VIEWS=D061_VIEWS;
// flag＝接在 sample=…&clean=1 後面的網址旗標。`pin`＝這個狀態在畫面上應該就是「純某一季」（拿來對照 auto 與轉季）。
// 「樣本城的日子」：newcity 第 1 天（春）、seed516 第 210963 天（doy 2，春）、ai120 第 121 天（doy 120，夏）——auto 必須跟著這個日子走。
export const D062_STATES=[
  {id:'off',flag:'season=off',label:'無季節（＝D061 預設）'},
  {id:'auto',flag:'',label:'auto（預設：跟著城市的日子）'},
  {id:'0',flag:'season=0',label:'春（基準，釘住）',pin:0},
  {id:'1',flag:'season=1',label:'夏',pin:1},
  {id:'2',flag:'season=2',label:'秋',pin:2},
  {id:'3',flag:'season=3',label:'冬',pin:3},
  {id:'s1',flag:'season=1&seasonStyle=soft',label:'柔 夏',pin:1,soft:true},
  {id:'s2',flag:'season=2&seasonStyle=soft',label:'柔 秋',pin:2,soft:true},
  {id:'s3',flag:'season=3&seasonStyle=soft',label:'柔 冬',pin:3,soft:true},
  {id:'mid',flag:'season=auto&seasonDay=94',label:'轉季中途（第 94 天：春→夏，約 45% 的格已換）'},
];
export const D062_SAMPLE_SEASON={newcity:0,seed516:0,ai120:1};   // auto 在各樣本城的畫面上＝這一季的純色
// 兩張對照表（每個畫面各一張）：上排全季（春夏秋冬），下排柔（夏秋冬）與轉季中途
export const D062_SHEETS=[
  {id:'bold',states:['0','1','2','3']},
  {id:'soft',states:['s1','s2','s3','mid']},
];
