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

