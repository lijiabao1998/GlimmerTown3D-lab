// 瀏覽器用的建築種類表：把 lab-kinds.json 打包進單檔（建置時內嵌，執行時不抓任何東西）。
import data from './lab-kinds.json' with { type: 'json' };
import { kindTableFrom, type KindData } from './kindTable.ts';
import { withUtilityHeritageHeights } from './britishUtilityHeritage.ts';
import { withRuralHeritageKinds } from './britishRuralHeritage.ts';
import { withCivicMarketVariants, withCivicMarketHeights } from './britishCivicMarkets.ts';
import { withWorkingRuralVariants } from './britishWorkingRural.ts';
import { withMarketEstateVariants } from './britishMarketEstates.ts';
import { withPublicServiceVariants, withPublicServiceHeights } from './britishPublicServices.ts';

// JSON 推出來的型別比 KindData 細（每種的等級鍵不同），經 unknown 轉；內容的正確性由 tools/unit.mjs 逐項驗
export const KINDS = withUtilityHeritageHeights(withPublicServiceHeights(withCivicMarketHeights(kindTableFrom(withMarketEstateVariants(withPublicServiceVariants(withWorkingRuralVariants(withCivicMarketVariants(withRuralHeritageKinds(data as unknown as KindData)))))))));
