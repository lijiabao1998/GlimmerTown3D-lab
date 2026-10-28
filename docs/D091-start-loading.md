# D091 — Responsive welcome and truthful startup feedback

Frozen before implementation, 2026-10-27 03:38 UTC. Owner request Sentinel_c5f8ec585e2081919e58dde5d83d8fb7: polish the existing 3D start menu and add smooth, device-adapted long-loading animation. Base main be875201f9992ede9301df423ee57f9bcd9aa383 freshly fetched; no open PR and no concurrent writer. Product remains the released 200-building web game, not a Rust port.

## Scope and design
The existing root boots directly into the city, not a dedicated start screen. Add an original code-only welcome shell with a clear enter action, concise touch/desktop instructions, warm brass accents and dark British-town silhouette. Desktop has a spacious composition; 412/390/360px phones have single-column safe-area-aware controls. Existing parameterized scene/history links remain direct entries. Never change save selection/overwrite confirmation, simulation, 200 models, camera, renderer, physics, storage format or game controls.

A static shell is present before application initialization. Boot stages describe actual work: journal read, city construction, first rendered frame. Unknown duration uses an indeterminate indicator, never invented percentage. Yield to paint before synchronous heavy work; compositor-friendly transform/opacity animation and reduced-motion presentation. This does not promise that an arbitrary synchronous renderer task cannot stall a browser; no global async/performance rewrite.

## Frozen acceptance
1. Root welcome has a single actionable entry and optional readable instructions, keyboard focus/Enter, at least 44px touch targets, no overflow at 1440/412/390/360 or short landscape, mobile safe areas and reduced motion.
2. No simulation starts before the root entry action. Repeat clicks cannot start two cities. Direct scene/history parameters retain their semantics and still show real loading feedback.
3. Initial loading surface exists without JavaScript; working stages update only at real boundaries. No estimated percentage, artificial completion timer, manufactured performance claims, new dependency or external asset.
4. Loading blocks pointer and keyboard fallthrough. Hide only after initialization and a paint opportunity; normal input is restored. Failure stays visible with a reload/retry action that does not delete saves. Journal fallback preserves existing behavior and is disclosed rather than called success.
5. Preserve all existing model/core bytes and original historical tests/thresholds. Add focused state/source guards plus real browser tests for root entry, repeat click, direct link, failure/retry, reduced motion and viewport originals. Any shared browser harness adaptation must activate the actual visible entry button through real pointer input, not hide overlays or synthetic click bypass.
6. Run typecheck/build, applicable complete existing Node/browser CI plus exact-head new evidence. Keep first failures. Raw PNGs must come from rendered candidate; no generated illustrations as evidence.
7. Draft candidate only. Owner image acceptance, legal merge and publication are separate; no main write or deployment authorized here.

## Not done at freeze
No implementation, tests or preview acceptance. Local browser sandbox limitation remains known; use authorized official CI if local browser remains unavailable. Existing synchronous city build duration remains a limitation to measure and disclose.

## Approved condition change — Plan A, 2026-10-27 05:08 UTC

Owner Sentinel_88c7cd7f4c308191a676f548b39c6ab6 explicitly replied 「允許」 to Plan A. This supersedes acceptance 2's earlier requirement that initialization wait for the root enter action. The engine now auto-initializes exactly as in approved main `be875201f9992ede9301df423ee57f9bcd9aa383`; `src/main.ts` is restored byte-for-byte, the added `src/ui/startup.ts` is removed, and all original 263 source files remain exact. No initialization, simulation, save or journal implementation is relocated into HTML.

Only the presentation in `index.html` observes the existing read-only `__gt.ready` signal, then allows two actual animation-frame opportunities. These opportunities do not prove compositor smoothness or a completed renderer frame during synchronous JavaScript. Root `/` shows an enabled Enter Town action after readiness; that action only dismisses the shell. Nonempty URL parameters retain direct entry. No fabricated percentages or per-stage claims are made. The existing read-only `__gt.journal()` can disclose unavailable/incomplete journal storage on the root welcome; it is never described as success when unavailable.

Loading, welcome and observed startup failure shield underlying pointer/keyboard input and focus. Body siblings added by the automatic engine are temporarily inert; their original inert state and normal focus navigation are restored on entry. A long wait offers reload while remaining labelled loading. An actual error offers reload. Neither action adds save handling or changes the original overwrite/backup policy. The desktop/phone layouts, safe areas, visible instructions, at least 44px controls and reduced-motion presentation remain required at 1440/412/390/360 and 844×390 landscape.

The earlier 7ed20e3 CI results remain historical first-red evidence: seven workflows failed, three succeeded. The first source errors name the extra `src/ui/startup.ts` / exact263 inventory; primary historical Node first failed at D053. Original logs were retrieved from GitHub into the fresh remote environment. A separate protected hash pins all of `tools/smoke.mjs`; its earlier D091 call is therefore restored to approved main. D091's focused tests run separately. Existing workflows, protected validators, inventories, all 200 models, performance thresholds and historical assertions are unchanged. The proposed 31-file successor-validation scheme is abandoned.

Validation for this candidate uses the actual inline presentation script, original source contracts, and native Chromium mouse/touch/keyboard input. A 1500ms delayed IndexedDB success callback is an explicitly labelled loading screenshot control; a denied journal and one failed WebGL navigation are explicitly labelled negative controls. They are not hardware performance evidence. Retry and ordinary reload compare a valid engine-generated save byte-for-byte, and baseline/default engine state is compared against an actual build of approved main. Original viewport PNGs and SHA256 provenance are delivered separately. Exact-head CI, independent review and owner image acceptance remain separate gates. PR47 stays Draft; no merge, release, publication or Rust migration is authorized.

Local Plan A qualification: typecheck/build, exact263 source/smoke identity, 13 existing source/control tests, 262 existing CI-integrity tests, and 15 D091 Chromium scenarios passed. The browser run produced 19 original PNGs, including all five required viewport sizes, loading/error/journal controls, persistent original corrupt-save warning and actual baseline/default parity. Native touch on the instructions and CTA retains zero engine pointers; the first city touch places one legal road on both 360px and 844×390. Exact persisted save bytes survive the actual retry and ordinary reload. Independent review caught and prompted these pointer, phone-landscape instruction and warning-visibility fixes. First local failures remain in the evidence bundle; none was retried unchanged for luck. Physical phones and hardware compositor smoothness remain unmeasured.

The unchanged full D090 foundation runner also passed all three actual-source domains: immutable6c 417/417, immutablee4c 79/79, and current 1292/1292. This is Node qualification only, not a substitute for complete official CI. Independent code/pixel review approved the worktree after checking all 19 raw PNG hashes and the actual baseline/default images.

## 減少動態載入指示修補 — 2026-10-28

**缺陷。** 在 `prefers-reduced-motion: reduce` 下，d0a22a2 的規則 `.startup-loader i { animation: none; transform: none; width: 100%; opacity: .65; }` 讓整段載入都顯示一條靜止、滿格的實心條。2026-10-27 獨立核驗在真實載入期間量到：390 寬軌道 310px、填色 310px，填色從軌道起點開始。看起來就像「已經載完」，違反本卡「未知時長用不定指示，絕不假造進度或完成」。原有 19 張原圖沒有一張拍到這個狀態（`D091-390-welcome` 是歡迎狀態，載入條已隱藏）。

**業主決定（2026-10-28）。** 業主選「先修再給你看圖」：Claude 在 PR #47 分支上做最小 CSS 修補，減少動態時只顯示靜態、沒有完成暗示的指示；10 個工作流重跑、重拍畫面給業主看過，才談合併。範圍只有這一項。

**先寫測試，保留第一個紅燈。** 2ee1562 只加測試，`index.html` 不動，既有情境與斷言一行不改：
- `tools/d091-startup-browser.mjs` 在所有既有情境之後追加一個情境：390×844、`prefers-reduced-motion: reduce`，沿用 `D091-390-loading-delayed-journal-control` 同一個明示標籤的 1500 ms IndexedDB 延遲對照。先斷言 phase 是 `loading`、引擎尚未 ready、`animationName` 是 `none`、指示看得到；接著拍 `D091-390-reduced-motion-loading-control.png`，收進同一份 receipt，拍完再讀一次 phase，仍是 `loading` 才算數；最後斷言指示寬度不超過軌道四分之一、在軌道中置中（不是從起點長出來的進度）、是漸層圖樣且底色透明（不是實心填色）。用 10-27 量到的 310／310 套進去，d0a22a2 會在「四分之一」這條斷言失敗。
- `tools/d091-startup-tests.mjs` 追加原始碼守衛 `reducedMotionGuards()`。它放在 `startupGuards()` 之外，因為瀏覽器工具一開始就跑 `startupGuards()`，放進去的話瀏覽器情境自己的紅燈就看不到了。第一個紅燈原樣保留：`node tools/d091-startup-tests.mjs` 先印出既有的 Plan A PASS，接著 `AssertionError: reduced motion must not draw a full-width bar that reads as completed`，actual 是 `' animation: none; transform: none; width: 100%; opacity: .65; '`，exit 1。

**修補。** 只改 `index.html` 減少動態的那條規則，外加上方一行註解：保留 `animation: none; transform: none`，把 `width: 100%; opacity: .65` 換成 `width: 36px; margin: 0 auto; background: repeating-linear-gradient(90deg, #d8ba7e 0 8px, transparent 8px 14px)`。畫面上是軌道正中一個靜止的三短劃記號（每劃 8px、間隔 6px）：不動、沒有百分比、不從起點填、不會滿格。「正在準備你的城市…」和等候說明照舊。一般動態版（40% 段落漂移）、44px 觸控目標、安全區、溢出規則、JS 都沒動；`src/` 263 檔、200 個模型、`tools/smoke.mjs`、`.github/` 都沒動。建置後的 CSS 保留這條規則，而且排在基本規則之後，層疊上蓋過基本規則。

**本輪跑過的檢查。** `npm ci`；`npm run typecheck` 綠；`npm run build` 綠；`node tools/d091-startup-tests.mjs` 修補前紅（上面那個第一個紅燈），修補後兩段都 PASS。

**沒做成的事。**
- 本輪沒開瀏覽器：煙霧測試 `tools/smoke.mjs`（無頭 Chrome）沒跑；新情境在 2ee1562 的瀏覽器紅燈、修補後的綠燈、重拍的 `D091-390-reduced-motion-loading-control.png` 都還沒有，留給下一步。
- 10 個官方工作流還沒在新 head 重跑；業主還沒看圖；PR #47 仍是 Draft，沒有合併、沒有發布。
- 實機（手機、硬體合成）一樣沒量。
- 這一輪只修減少動態這一項，其餘小意見一律照舊開著，例如：沒有 JavaScript 時殼層仍寫「正在準備你的城市…」並顯示載入條，跟 noscript 提示互相矛盾（no-JS 文案）；歡迎畫面由程式把焦點移到「進入小鎮」時看不到焦點框（10-27 量到 `:focus-visible` 為 false、outline 為 none）。

**瀏覽器驗收（2026-10-28，接續上一輪）。** 用 repo 自己的 `tools/d091-startup-browser.mjs`，Chrome for Testing 153.0.8010.12，`D091_BASELINE_DIST` 指向核准 main be87520 的建置：
- 紅燈（2ee1562，只改測試）：原有 15 個情境全過，唯一失敗是新斷言 `reduced-motion loading must not read as a completed bar: fill 310px of 310px track`，exit 1。缺陷那一格（sha256 27028158…）跟 10-27 補充探針拍到的逐位元組相同。
- 綠燈（76f86b3，修補）：`D091 Plan A browser PASS: 16 scenario receipts, 20 original PNGs`。receipt head 76f86b3、dirty false、indexSha256 d6c02e31…、buildSha256 1d07dccb…、testSha256 e4a7b344…；20 張 PNG 的 sha256、大小、寬高全部重算吻合。新圖 `D091-390-reduced-motion-loading-control.png`（cec8fb12…）實測：phase loading、ready false、animationName none；軌道 310px，指示 36×3px 置中（左右各 137px），底色透明、漸層圖樣。
- 跟 10-27 那 19 張比：16 張逐位元組相同；不同的 3 張（1440、390 一般動態載入，360 操作說明）是每次跑都會有的漂移相位或觸碰框亮度，同一份頁面跑兩次也會不同，跟本修補無關。修補前後的減少動態畫面，只差那條 3px 高的載入列。
- 獨立核驗另用自寫探針，把 IndexedDB 延後 3000 ms（低於引擎 4000 ms 逾時），在 390、360、1440、844×390 與 DPR3 都拍到真的載入中：同一個靜止置中記號，0 錯誤；一般動態的四個時間點，新舊建置逐位元組相同。
- 這個 commit 只改卡面與 LOG.md；`index.html`、tools、dist 都跟 76f86b3 相同。推送前會在這個 head 重跑同一支工具，最終 receipt 以 PR 上的紀錄為準。

**仍然沒做成的事（更新）。** 煙霧測試 `tools/smoke.mjs` 本機沒跑（10-27 本機整套跑了 66 分鐘），交給官方 CI；官方工作流都不跑 D091 工具，所以減少動態畫面只有本機 receipt 可證。業主還沒看圖；PR #47 仍是 Draft，沒有合併、沒有發布。forced-colors 高對比加上減少動態時，修補前後的指示都看不見（Chromium 把漸層算成 none），屬既有問題，照範圍列為開著。no-JS 文案矛盾、焦點框看不到也照舊開著。實機沒量。


## 載入動畫精修（參考 Lab #boot453）— 2026-10-28

**業主要求（原話）。** 「對照圖 的動畫 還可以 精修一下 參考 town lab 其它的沒問題」。範圍只有載入動畫；版面、文案、流程照舊。

**出處（串台標注）。** 參考 2D 實驗線 `lijiabao1998/GlimmerTown-lab` main `dde12ad` 的 `index.html` `#boot453`，只取動畫語言，全部用 CSS 重寫，沒有外部素材：
- L695 `.boot453B:after` 加 L698 `boot453Windows`：窗燈 2.1s 一次 `steps(2,end)` 明滅，透明度 .18↔.78，所有窗同步。
- L697 `#boot453Glow` 加 L699 `boot453Glow`：地面光 2.4s 一次呼吸，透明度 .45↔1，`scaleX` .88↔1。
- L701–703 `#boot453Track`／`#boot453Bar`：11px 軌道、漸層條。

刻意沒搬的：
- `#boot453Pct` 百分比和 `#boot453Steps` 四格階段。本卡禁止假造百分比。Plan A 的殼層只觀察 `__gt.ready` 和之後兩次 rAF，沒有能誠實對上的階段。
- Lab 的藍綠金配色。本線用黃銅色和奶油色。

**三檔對照（同一畫面、同一時間點）。**
- **A：只精修載入條。**
  - 3px 細線改成 8px 軌道，內描一圈黃銅邊。
  - 實心段改成漸層光點：奶油色光頭，尾巴漸淡。
  - 光點以 2.2s 緩入緩出，從軌道左外側滑進、右外側滑出。
  - 場景不動。
- **B：A 加場景呼吸（選定）。**
  - 窗燈移到房子各自的 `::after` 層，底下改成未亮的玻璃。
  - 每棟房子在 9.6s 週期裡各自暗下約 1 秒，彼此錯開。
  - 月暈和房後的街燈光以 4.8s 輪流呼吸。
  - 軌道與 A 相同。
- **C：照 Lab 原節奏。**
  - 所有窗同步，每 2.1s 以 steps 明滅一次。
  - 地面光 2.4s 呼吸，軌道 11px 粗。
  - 三色漸層換成青綠到金。

**為什麼選 B。**
- A 修好了載入條，但等待可能很長，整個場景卻完全不動。
- C 把 Lab 的節奏照搬過來：所有窗同時一明一暗，每兩秒一次。放在這張安靜的英式小鎮上，顯得機械又忙。青綠色和 11px 粗條也不在本線的黃銅色系裡，比卡片文字還搶眼。
- B 保留本線克制的調子：一次只暗一棟房子，光暈慢慢呼吸。
- 業主看了不喜歡，可以改成 A 或 C。三檔只差 CSS。

**減少動態下的記號。** 原本的三短劃記號 3px 高。放進 8px 軌道後會變成 8px 高，還繼承軌道的圓角：左右兩段成了半圓，中間一段是方的。我比較了「8×8 方點」和「8×4 短槓」兩種，選 8×4 短槓，延續業主上一輪看過的樣式：65bb6a6 改成 4px 高、直角、垂直置中，寬度、置中、分段、透明底色都不變。

**先寫測試，保留第一個紅燈。** 913f559 只改測試，`index.html` 和 10707fc 相同。
- `tools/d091-startup-tests.mjs` 追加 `loadingMotionGuards()`，同樣放在 `startupGuards()` 之外。它檢查五件事：
  - startup 的 keyframes 只動 transform 和 opacity；
  - 場景動畫只放在 `prefers-reduced-motion: no-preference` 之內；
  - 要有窗燈（Lab boot453Windows）和呼吸光（Lab boot453Glow）；
  - 原始碼裡寫明 Lab 出處；
  - 載入條沒有百分比，也沒有 progressbar 的值。

  第一個紅燈原樣保留：前兩段 PASS，接著 `AssertionError: startup ambience keyframes besides the rail light`。
- `tools/d091-startup-browser.mjs` 在所有既有情境之後追加情境。它用明示標籤的 3000 ms IndexedDB 延遲對照，低於引擎 `src/idbJournal.ts` 的 `OPEN_MS = 4000`。
  - 1440 和 390 一般動態：軌道光要在走；至少 3 個窗燈在動；要有一個光在呼吸；每個動畫只動 transform 和 opacity；軌道至少 6px 高；光點是漸層。接著用 Web Animations 的 `currentTime` 把動畫定格在 550、1100、1650 ms，拍原圖。拍完再讀一次 phase，仍是 loading 才算數。
  - 390 減少動態：載入中和歡迎畫面都必須是 0 個動畫。

  瀏覽器紅燈：原有 16 個情境全過，第一個失敗是 `Lab boot453Windows: window lights animate during loading (rail)`，也就是只有軌道光在動。receipt 為 FAIL，head 913f559，dirty 為 false。

**實作。** 只改 `index.html` 的 CSS。呈現腳本、標記、引擎、既有規則都沒動。
- 9c56f79：
  - 軌道和光點；
  - `.startup-houses i::after` 亮窗層。靜止時不透明度是 1，看起來跟原本完全一樣；
  - `.startup-moon::after` 月暈；
  - `.startup-scene::before` 房後街燈光，畫在月亮和房子後面；
  - 三組 keyframes（`startup-drift`、`startup-windows`、`startup-breathe`）。場景動畫全部在 `no-preference` 裡。
- 65bb6a6：減少動態下的 4px 短槓。

**綠燈（65bb6a6）。** `D091 Plan A browser PASS: 19 scenario receipts, 26 original PNGs`。
- receipt：head 65bb6a6，dirty 為 false，indexSha256 `8323c327…`，buildSha256 `27bcd196…`，testSha256 `cdb9ee6e…`，瀏覽器 Chrome for Testing 153.0.8010.12。26 張 PNG 的 sha256 和大小全部重算吻合。
- 1440 和 390 一般動態：共 8 個動畫，軌道光 1、窗燈 5、月暈 1、街燈光 1，keyframes 只有 transform 和 opacity。軌道 8px 高，1440 寬 410px、390 寬 310px。
- 390 減少動態：載入中和歡迎畫面都是 0 個動畫。靜止記號 36×8，在 310×8 的軌道正中，左右各 137px，底色透明。
- 6 張定格原圖 `D091-{1440,390}-loading-motion-t{550,1100,1650}.png` 在 9c56f79 和 65bb6a6 兩次跑出來逐位元組相同，定格可以重現。
- 進入遊戲後的 7 張圖（5 張 entered、baseline、parity）跟 10707fc 逐位元組相同，遊戲畫面沒受影響。
- 歡迎、操作說明、錯誤、日誌、存檔警告這幾張，現在每次跑都會不同，因為拍的時候場景燈光在動。原本的載入條漂移也一樣。
- `npm run typecheck`、`npm run build` 綠；`node tools/d091-startup-tests.mjs` 三段 PASS。
- Node 和瀏覽器紅燈、綠燈的 log 和 receipt 另行交付。

**對照圖（另行交付，不進 repo）。** 下面三張是衍生預覽，不是原圖。
- 原型頁的做法：實際 `index.html` 的樣式和 `#startup` 區塊，加上各檔的 CSS。B 頁直接用 9c56f79 的 `index.html`。
- 拍法：Playwright 1.63.0 的 headless shell，用 `currentTime` 每 0.1s 定格一次，共 96 幀（9.6s），再合成 GIF。
- 預覽 B 和正式建置同一時間點的幀相比，差異只在邊緣反鋸齒和光暈漸層：多數 1–3 階，最大 68 階，在邊緣。

| 檔案 | sha256 |
|---|---|
| `D091-loading-motion-ABC-1440.gif`（四檔 2×2，1440 卡片縮 50%） | `f1ca3b8d…` |
| `D091-loading-motion-ABC-390.gif`（四檔並排，390） | `52084f78…` |
| `D091-loading-rail-ABC-390-dpr3.gif`（載入條特寫，DPR 3） | `9d74b0ba…` |

**仍然沒做成的事。**
- 實機沒量：手機、硬體合成都沒有。8 個合成層在中階 Android 上的流暢度和耗電沒有數字。
- 官方工作流不跑 D091 工具，動畫和減少動態的瀏覽器證據只有本機 receipt。
- 煙霧測試 `tools/smoke.mjs` 本機沒跑，交給官方 CI。
- 高對比 forced-colors：修改前後的載入條都看不到。Chromium 用系統色蓋掉軌道和光點，四種組合的截圖都只有一種顏色。這是既有問題，照舊開著。
- no-JS 文案矛盾、焦點框看不到，照舊開著。
- 手機寬度下，月亮本來就被房子擋住，所以月暈在手機上幾乎看不到。構圖沒改。
- 業主還沒看新圖。PR #47 仍是 Draft，沒有合併、沒有發布。

## 獨立核驗後修正：場景動畫只在載入中、窗燈只畫一次 — 2026-10-28

這一節記兩輪獨立核驗，以及各自的修正。中間版本 4666198 的卡面草稿有好幾處說法和數字不對，第二次核驗指出後，整節改寫成下面的內容。

**第一次核驗（d8167ef）。** approve-with-issues，6 項 minor，全部是本輪自己的工作。前三項是 9c56f79 造成的行為缺陷：
1. **靜止窗燈不是逐像素相同。** 部分窗旁露出 1px 暗玻璃細條，1440 有 214 px 不同，最大差 159 階。卡面和 9c56f79 的 commit 訊息說「完全一樣」，說過頭了。
2. **街燈光底部有一條水平硬邊。**
3. **範圍比業主說的大。** 一般動態下，歡迎和錯誤畫面也各跑 7 個動畫，10707fc 是 0 個；靜止外觀也多了月暈和光暈。原本跨兩次跑逐位元組相同的 7 張圖，因此每次跑都不同。
4. **「8 個合成層」不準。**
5. **測試有漏洞。** 這幾種情況沒有斷言：longhand `animation-name`、非 `startup-*` 命名的 keyframes、全寬光點、4px 短槓。`resume` 也沒有限定在 `#startup`。
6. **用字不精確。** 「靜止記號 36×8」。

**第一輪修正（86c8b19 測試，fa11b0a CSS）。**
- 場景圖層只在 `@media (prefers-reduced-motion: no-preference)` 之內、而且只對 `#startup[data-phase="loading"]` 生成。
- 房子規則還原成 10707fc 原文。
- 街燈光漸層改成在橢圓邊緣就降到透明。
- 手機不生成月暈。
- 窗燈改成在亮窗上淡入一層暗玻璃。

紅燈：Node 首紅 `ambience is scoped to the loading phase: .startup-houses i::after`；瀏覽器原有 19 個情境全過，首紅 `normal motion: no startup animation on the welcome`。綠燈：23 個 receipt。

**第二次核驗（4666198，三個獨立角度並行）。**
- **像素與範圍。**
  - 成立的部分：歡迎和錯誤畫面在 6 種尺寸、兩種動態、三種進入方式下，跟 10707fc 都是 0 像素不同。街燈光盒子邊緣的跳變是 0 階，同一量法在 d8167ef 量到 11–12 階。月暈只在寬度大於 640px 時生成。
  - 被推翻的一項：房子全暗時，窗邊仍有亮色細條。5 個尺寸都有，每個 71–93 px，最亮 R 178。原因在合成：暗玻璃 `::after` 因為有 opacity 動畫，自成一個合成層，在房子的旋轉下另外光柵化；亮窗畫在房子的層裡。兩邊邊緣的覆蓋率不同，所以對不齊。卡面寫的「不會有對齊誤差」不成立。
- **測試。** 題目列的 9 類突變全部被抓到。另有 28 個突變活下來，都是防未來回歸的缺口：
  - 換拼法的靜態月暈或光暈；
  - 覆寫規則；
  - 顏色改動；
  - 光點寬度只有靜態檢查；
  - 錯誤畫面只量 390；
  - 手機月暈只檢查「沒動畫」。
- **卡面與效能：判 reject，只針對文件。**
  - 效能段拿「有開始畫面腳本」的頁面（10707fc、65bb6a6），跟「沒腳本」的頁面（fa11b0a）比，所以 trace 的「0 對 150」和層數表的 fa11b0a 那一列都不成立。用同一種頁面比，三版的主執行緒工作一樣；fa11b0a 在 390@3x 比 10707fc 多 9 層、約 9.7 MB，不是更少。
  - 另有幾處不準：16 張相同的列舉漏了 844 操作說明；LOG 括號裡的說法錯；「前兩項」和「8 張」不準；手機上月亮並沒有全被擋住；沒寫新 head 還沒推。

**第二輪修正（c1d5182 測試，44f00f8 CSS）。**
- **窗燈改用 Lab 的做法，只畫一次。** 載入中，房子背景不畫窗（`background-image: none`）；每棟的亮窗只由它的 `::after` 畫一次，用房子自己的窗格幾何和 `#e5c37d`。這層的不透明度在 9.6 秒週期裡降到 .15，約 1 秒，一次一棟。沒有第二份窗格，就不會有對不齊的細條。載入以外和減少動態下，房子背景就是 10707fc 的亮窗。
- **Node 守衛 `sceneInvariantGuards()`。**
  - 只准一個 `<style>`。
  - 守衛外的場景規則正規化後，釘成 10707fc 的 15 條（sha256 `465eaebc…`），唯一多出來的是手機月暈規則。所以換拼法的靜態月暈、覆寫、顏色改動都會紅。
  - 載入中房子背景不畫窗；`::after` 畫的是亮窗，並且用自己的不透明度暗下。
- **瀏覽器情境。** 1440 和 390 定格在 1100 ms，檢查：
  - 房子背景的 computed 值是 `none`；
  - 五個 `::after` 都帶 `rgb(229, 195, 125)`；
  - 光點最多半條軌道；
  - 月暈在 ≤640px 時 computed `display: none`，更寬時會生成；
  - 歡迎畫面的房子背景回到亮窗；
  - 1440 錯誤畫面 0 個動畫。
- **紅燈（c1d5182，只改測試）。**
  - Node：場景指紋檢查先通過，首紅是 `while loading, the house background draws no windows`。
  - 瀏覽器：原有 23 個情境全過，首紅 `while loading the house background draws no windows: repeating-linear-gradient(… rgb(229, 195, 125) …)`。receipt 為 FAIL，head c1d5182，dirty 為 false。

**綠燈（44f00f8）。** `D091 Plan A browser PASS: 26 scenario receipts, 26 original PNGs`。
- receipt：head 44f00f8，dirty 為 false，indexSha256 `f7f7f7b5…`，buildSha256 `d2757292…`，testSha256 `cf651ed7…`。26 張 PNG 的 sha256 和大小全部重算吻合。Node 五段 PASS，typecheck、build 綠。
- 載入中、一般動態：1440 有 8 個動畫（軌道光 1、窗 5、月暈 1、街燈光 1）；390 有 7 個，月暈是 `display: none`。keyframes 只有 transform 和 opacity。光點佔軌道 0.38。
- 一般動態下，歡迎畫面（1440、390）和錯誤畫面（1440、390）都是 0 個動畫。減少動態下，載入中和歡迎畫面也都是 0 個。
- 減少動態記號：盒子 36×8，在 310×8 軌道正中；看得到的是三條 8×4 直角短槓（`background-size` 為 `100% 4px`，圓角 `0px`）。
- 跟 10707fc 的 20 張原圖比，16 張逐位元組相同：5 張歡迎、5 張進入遊戲、日誌不可用／存檔警告／錯誤三個控制組、基準、parity、844 操作說明。不同的 4 張：
  - 本卡改的三張載入畫面：一般動態載入控制 1440 和 390、減少動態載入控制 390。
  - 360 操作說明：差異只在「第一次來？看看操作方式」那一列（x 40–319、y 575–618），最大 17 階，是觸碰後的高亮漂移。10707fc 之前的跑次，就在同一個框裡漂移過。
- **窗燈細條（自己量）。** 比照核驗員的理想參考法：把暗下那棟的窗直接畫成預期的混色、拿掉 `::after`，再數房子範圍內差超過 25 階的像素。
  - fa11b0a：1440 每棟 28–46 px，最大 109 階；手機和 844×390 也有。
  - 44f00f8：1440、412、390、360、844×390、390@3x 的 5 棟房子全部是 0 px；最大差 1–17 階，都是反鋸齒。

**合成與主執行緒（同一種頁面重量）。**
- 主要頁面：實際 `index.html` 拿掉 module script、保留開始畫面腳本，最接近實際產品。對照頁面：只有樣式和區塊。
- 量測條件：無頭 Chromium 153，軟體光柵，不是手機。面積是把 CSS px² 換算成 RGBA 位元組的估計，不是實測 GPU 記憶體。

| 版本 | 1440@1x 畫內容的層數／面積 | 390@3x 畫內容的層數／面積 |
|---|---|---|
| 10707fc | 4／9.9 MB | 7／47.2 MB |
| 65bb6a6 | 15／11.5 MB | 17／57.1 MB |
| 44f00f8 | 15／11.8 MB | 16／56.9 MB |

- 減少動態下，四個版本都是 4／9.9 MB 和 7／47.2 MB。
- 載入中的場景動畫在 390@3x 多 9 層、約 9.7 MB（約 +21%）。手機不生成月暈只省 1 層。
- trace：有開始畫面腳本時，10707fc 和 44f00f8 每 2.5 秒都約 150 次主執行緒更新，全部來自腳本等 `__gt.ready` 的 rAF 輪詢（FireAnimationFrame 150，Paint 0）。拿掉腳本後，兩版都是 0–1 次。所有動畫都沒有 compositeFailed。所以場景動畫本身不增加主執行緒工作。

**月亮與手機。** 手機寬度下，月亮大多被房子擋住：412 露出一彎，390 露出一小條，360 完全擋住。10707fc 本來就沒有月暈。手機不生成月暈，是為了少一個一直在動的合成層，不是因為完全看不到。

**對照圖重拍。** B 檔改用 44f00f8 重拍：9.6 秒、每 0.1 秒定格一次、共 96 幀。A、C 和現行三檔不變。

| 檔案 | sha256 |
|---|---|
| `D091-loading-motion-ABC-1440.gif` | `86b64d8e…` |
| `D091-loading-motion-ABC-390.gif` | `425bf73d…` |
| `D091-loading-rail-ABC-390-dpr3.gif`（軌道沒變，位元組跟先前相同） | `9d74b0ba…` |

**仍然沒做成的事。**
- 本節的 commit（86c8b19 到本 commit）寫成時還沒推上 PR #47。10 個官方工作流（含 smoke）要在推送後的新 head 重跑，結果記在 PR。
- 實機沒量：手機、硬體合成、耗電都沒有數字。
- 官方工作流不跑 D091 工具。動畫、範圍、窗燈和減少動態的瀏覽器證據，只有本機 receipt。
- 高對比 forced-colors 下，修改前後的載入條都看不到，屬既有問題。no-JS 文案矛盾、焦點框看不到，照舊開著。
- 測試核驗列出的未來回歸缺口，還有一部分沒補：靜態守衛對寫法（空白、大小寫）敏感，靠瀏覽器情境補位；只要有動畫，瀏覽器都抓得到。已補的有場景指紋、光點寬度、1440 錯誤畫面、手機月暈不生成。
- 業主還沒看這一版的圖。PR #47 仍是 Draft，沒有合併、沒有發布。
