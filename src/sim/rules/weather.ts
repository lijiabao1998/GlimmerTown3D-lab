// 天氣與季節（D009）：實驗線 tick() 54964–54976、38119／38125 @ d23c18d。
// 天氣只在生長之前消耗亂數流、影響住宅幸福（雨 −.02、暴雨 −.05）；彩虹、閃電畫面是視覺，這裡只保留它們消耗的亂數。
import type { Rng } from './lab.ts';

export const inWinter = (day: number) => ((day - 1) % 360) >= 300;                                          // 冬季：每年第 300–360 天
export const season = (day: number) => { const doy = (day - 1) % 360; return doy >= 300 ? 3 : doy >= 200 ? 2 : doy >= 100 ? 1 : 0; };   // 0 春 1 夏 2 秋 3 冬

export interface WeatherState { weather: number; wxT: number }   // 0 晴、1 雨、2 暴雨；wxT＝還剩幾天換態
// 每天一步（day＝已經 ++ 之後的日子）；rainbow／lightning 只回報給畫面用，不影響模擬
export function weatherStep(s: WeatherState, day: number, rng: Rng) {
  let { weather, wxT } = s, rainbow = false, lightning = false;
  if (--wxT <= 0) {
    if (weather === 0) { if (rng.R() < .12) { weather = 1; wxT = 3 + rng.ri(6); } else wxT = 3 + rng.ri(5); }
    else if (weather === 1) {
      if (rng.R() < .20) { weather = 2; wxT = 1 + rng.ri(2); }
      else if (rng.R() < .35) { weather = 0; wxT = 4 + rng.ri(6); if (!inWinter(day)) rainbow = true; }
      else wxT = 2 + rng.ri(3);
    } else {
      if (rng.R() < .35) { weather = 0; wxT = 4 + rng.ri(6); if (!inWinter(day)) rainbow = true; }
      else { weather = 1; wxT = 2 + rng.ri(4); }
    }
  }
  if (weather === 2 && !inWinter(day) && rng.R() < .25) lightning = true;
  return { weather, wxT, rainbow, lightning };
}
