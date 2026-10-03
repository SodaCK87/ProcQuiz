# 缺口清單

> 型別：查詢型｜本輪 2026-10-03｜編號只在本輪有效，跨輪追蹤要轉進 docs\問題台帳.md｜我只回編號決定做哪幾項｜上一輪（2026-10-02）的內容在 git：`git show 1e8d320:docs/probe-gap-list.md`

欄位：編號 ｜ 大項 ｜ 缺口 ｜ 分類 A/B/C ｜ 失敗時使用者會看到的症狀 ｜ 建議驗法 ｜ 消費端是誰 ｜ 陽性對照怎麼做 ｜ 要不要開宿主 ｜ 能不能進 CI ｜ 單次執行時間 ｜ 成本估（分鐘）｜ 優先級（後果 × 機率）

## 組 A

<!-- 組A缺口:開始 -->

上輪 A-01（CI 只跑 `npm test`）✅ 本輪親驗已修：`pages.yml:34` 跑 `tools/run_gate.py`，%TEMP% clone 把 `deck.js` 的出題冷卻拿掉後 `run_gate.py` 退出 1 印「沒過：網站測試」。上輪 A-02（星圖 0×0，PQZ-02）✅ 已修：把 `starfield.js:57` 的寬高賦值放回註解，`starfield.test.js` 4 條紅。上輪 A-06（字型靜態 import）移入「不值得做」。其餘重新評估後重新編號如下。

| 編號 | 大項 | 缺口 | 分類 | 失敗時使用者會看到的症狀 | 建議驗法 | 消費端 | 陽性對照怎麼做 | 開宿主 | 進 CI | 單次執行時間 | 成本（分鐘） | 優先級 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-01 | R04 | `tools/xlsx_bank.py:109-130` 的 `read_xlsx` 不核對標題列：解析欄消失或與法源欄對調時，只靠審查註記的「解析指紋」碰巧擋下，訊息還指錯原因；該題型沒有帶解析指紋的註記時就照樣寫出。上輪 A-03，未修 | A | 維護者換新版 xlsx：有指紋註記時看到「審查註記 tf-02-0028：解析與審查當時不同，請重審這則註記」而去重審（根因是少一欄）；沒指紋可擋時退出 0，網站上該題型解析整批消失（卡片寫「這題目前沒有解析」）、欄位對調時解析位置顯示的是法條文字 | `read_xlsx` 讀標題列逐欄比對欄名（📌 欄名以檔內第 1–2 列為準，本輪未逐字抄），不符就 `BankError` 點名欄位；`tests/test_convert.py` 的 Corruption 加兩條：刪解析欄、對調 E／F 欄 | 維護者跑轉檔，之後同事的瀏覽器 | ✅ 本輪 IO1／IO2／IO2b（%TEMP% 複本）：是非題各課程表刪第 6 欄且 `notes.json` 清成 [] → `convert.py` 退出 0、印「掛上解析 0 題」「0 處變動」並寫出 JSON，接著 `test_committed_json`、`explanation_only`、`every_review_note` 3 條全綠；加表頭核對後要退出 1 並點名「解析」欄 | 無 | 能（`run_gate.py` 已跑 unittest） | 一次轉檔 9–10 秒（本輪實量） | 30 | 看到錯的結果卻不知道 × 低（第三方換版改欄位，且該題型沒有解析指紋註記時才漏） |
| A-02 | R06 | `目標路線圖.md:17` 寫「卡面小字對比都在 4.5 以上」，沒有任何腳本在算；本輪實量不成立。上輪 A-05，未修 | A | 手機戶外強光或低視力時，卡面出處行（`.meta` 12px）、「正解 X｜你選 Y」（14px）、「這題目前沒有解析」、選擇題答錯選項、頁尾（12px）讀起來吃力 | 對比探針：字色讀 `app.css` 的 token（或 computed style），底色用 `web/src/lib/textures.js` 的 SVG 逐像素合成紙紋、暈影與 `.dim`，報低於 4.5 的面積比例與最低值，門檻寫在探針裡；調色（`--ink-2`、`--bad`、`--ok`、頁尾 opacity）由使用者決定 | 同事的瀏覽器（手機為主） | ✅ 本輪瀏覽器 pane 以同一套疊法合成（陽性對照 #777 對 #FFF 得 4.48、#000 對 #FFF 得 21）：`--ink-2` #C2AA7C 中位 4.75、25.5% 面積低於 4.5、最低 3.45（金墨暈染最亮時 93.2% 低於 4.5）；`.btn.is-wrong` 98.8%（中位 3.71、最低 2.82）；`.btn.is-ans` 51.7%；`.verdict strong` 答錯 46.0%；頁尾 27.6%（最低 3.66）；題型鈕按下態 31.1%；`.lbl` 5.5%。調色後同一支要轉綠 | 無 | 能（Node 或 Python 合成版不需瀏覽器） | 瀏覽器內合成約 1 秒（未精量） | 60 | 都不會卡住（3.4–4.5 仍讀得到）× 每次都會（每張卡都有） |
| A-03 | R06 | 鍵盤焦點落到 `aria-hidden` 的背面：`QuizCard.svelte:164-165` 的「看題目」「下一題」只設 pointer-events none，沒有 `inert`；題型與出題分段鈕的 UA focus ring 被 `.seg` 的 `overflow:hidden`（`StartScreen.svelte:62`）裁掉三邊。上輪 A-07，未修 | A | 桌機用鍵盤的同事 Tab 到看不見的按鈕上，按 Enter 等於跳題；報讀器焦點落在被隱藏的內容；分段鈕看不出焦點在哪 | 背面不可見時加 `inert`（或 `tabindex=-1`）；`.seg button:focus-visible` 改用 `outline-offset:-3px` 或在 `.seg` 外畫；探針在瀏覽器逐次按 Tab，斷言焦點元素沒有 `aria-hidden` 祖先、outline 不超出最近的 overflow hidden 容器 | 同事的瀏覽器（桌機鍵盤、報讀器） | ✅ 本輪瀏覽器 pane（320×700，quiz 畫面）實按 Tab 7 次：順序「‹ 選題、✦ 重點字、O、X、看題目、下一題、‹ 選題」，第 5、6 個在 `.face.back`（aria-hidden=true、inert false）；題型鈕 `focus({focusVisible:true})` 後 outline `auto 1px offset 0`，鈕上緣 98.48 ＝ `.seg` 內緣 98.48。修好後同一走法不能停在背面、ring 要在容器內 | 無 | 要 headless 瀏覽器（`tools/measure_browser.mjs` 已能驅動無頭 Chrome，可借用；Playwright 類要先問） | 未量測（數秒內） | 30 | 當場卡住（鍵盤操作會跳題）× 低（對象以手機觸控為主） |
| A-04 | R04 | 練習紀錄寫不進去時畫面沒有提示：`progress.js:24` 的 `save()` 失敗回 false，`App.svelte:65-66` 的 `flush()`／`persist()` 不看回傳值（README:36 寫「只是不記」，同事看不到 README）。上輪 A-04，未修 | A | 同事以為有記到（畫面統計照常變），下次回來紀錄全沒了 | 把 `save()` 的回傳值接到畫面提示（一次性的中文訊息）；判斷部分抽成純函式進 `npm test`；瀏覽器探針把 `Storage.prototype.setItem` 換成擲例外後作答，斷言出現 `[role=alert]` | 同事的瀏覽器 | ✅ 本輪瀏覽器 pane（5181）：`setItem` 擲 QuotaExceededError 後點「O」→ 畫面出「答錯了」，等 3 秒 `[role=alert]`、`.error`、`.hint` 都 0 個、localStorage 仍 null。加提示後同一操作要出現訊息 | 無 | 純函式能；瀏覽器版借 `measure_browser.mjs` 的無頭 Chrome | 未量測（數秒內） | 30 | 看到錯的結果卻不知道 × 低（儲存被封鎖或額滿才發生） |
| A-05 | R03 | 網站互動層沒有任何自動化：判對錯（`QuizCard.svelte:15`、`:86`）、出下一題與錯題穿插（`App.svelte:86-101`）、題庫下載失敗訊息（`App.svelte:41`）、閒置寫入與 pagehide flush（`App.svelte:63-68`，45093a2）、LINE 轉址（`main.js:9`，955f06e）、微調等題庫到手才下載（`App.svelte:40-51`，b0eb94d）都沒有測試。上輪 A-09，未修 | A | 判對錯或出題改壞時，同事看到「答錯了」而正解與你選相同，或一直出同一題；關掉分頁前一秒的作答沒存到；下載失敗的提示若被改壞，按開始沒反應 | 先把判對錯與 `draw()` 抽到 `web/src/lib` 成純函式進 `npm test`；其餘用無頭瀏覽器：建置後刪掉題庫 chunk 再開頁，斷言出現「題庫下載失敗」；pagehide 後讀 localStorage | 同事的瀏覽器 | 判對錯抽出後把比較改成 `!==` 要紅；下載失敗探針：刪 chunk 要出現訊息、不刪不出現。📌 本輪沒重現下載失敗畫面（dev server 下讓不了 import 失敗） | 無 | 純函式能；瀏覽器部分借 `measure_browser.mjs`（新相依要先問） | 純函式 1 秒內；瀏覽器版未量測 | 60 | 當場看得出錯（畫面自相矛盾）× 低（改到那幾行才會） |
| A-06 | R03 | `tools/convert.py:165` 的 `diff_versions`（換版差異報告）零測試，且只報新增、刪除、改答案，不報解析與註記變動。上輪 A-10，未修 | A | 維護者換版時看到「0 處變動」而解析其實整批變了；同事看到的仍是重產結果 | 為 `diff_versions` 寫純函式測試：改答案、改題文、只改解析、只改註記四種，斷言報告內容；報告加列「解析變動 N 題、註記增減 N 則」 | 維護者（轉檔畫面） | ✅ 本輪 IO2（解析 1133→0）與 IO3（註記 99→0）都印「0 處變動」；補測試後把 `diff_versions` 換成 `return []` 要紅（上輪 P16 親驗現況 24 條全綠） | 無 | 能 | 1 秒內（純函式，未量測） | 20 | 都不會（同事看到的題庫仍正確）× 每次換版 |
| A-07 | R06 | 29 個碼位不在網站自帶的思源宋體子集裡：28 個 CJK 相容字（U+F909 契、U+F96B 參、U+F9DF 履 等）加介面的 ✦ U+2726，出現在 35 題（題幹 8、選項 3、解析 25），各平台改用系統字型顯示；`tests/test_fonts.py:17` 以 `NOT_IN_SOURCE` 刻意放行。上輪 A-08，未修 | B（守得到「用字都在 woff2 的 cmap 裡」，`test_fonts` 已守其餘 1,586 字；線外是各平台後備字型實際長怎樣） | 那 35 題個別字的字型跳動；系統字型也沒有時變成方塊（📌 各平台未查證） | 修不修由使用者決定（CLAUDE.md 第 5 條：題目不得改；可在 `build_fonts.py` 用 NFC 對應的標準字字形補進去，或在顯示層 normalize）。替代檢查：實機從 35 題挑 3 題看 | 同事的瀏覽器 | ✅ 本輪 fontTools 讀 4 個 woff2 cmap 聯集 1,588 字，網站用字 1,615 缺 29；陽性對照「採」在、U+20000 不在 | 無 | 能（fonttools 已在 requirements） | 0.5 秒 | 20（另加實機目視） | 看到錯的結果（方塊時看得出；字型跳動不影響理解）× 35 題（約 1%） |
| A-08 | R06 | 只有手機實機看得到的：長解析在 3D 卡片內用手指捲到底（路線圖:33 列為未確認）、翻卡頓與發熱（aefc60f、5d640a8、1443ad8 修過）、Android 強制深色與 Samsung 瀏覽器深色模式、LINE 內建瀏覽器轉址、系統字級放大。上輪 A-11；d87d6a0 只確認了星空不重排 | C | 長解析捲不到底、翻卡又頓、強制深色把暗金配色反轉成難讀、字級放大後按鈕文字被擠 | 替代檢查（只有使用者能做）：iPhone 與一支 Android（Chrome、Samsung Internet 各開一次深色模式）各走一次：選「選擇題」→答一題長解析→翻面後用手指捲到底→連續答 10 題看翻卡→系統字級調到最大再看選題頁→從 LINE 開網址看會不會跳到瀏覽器；結果記進路線圖〈現在卡在哪〉 | 同事的手機 | 不適用（實機目視）；桌機能量的本輪已做：320 寬無橫向捲動、按鈕 0 個被裁、模擬 light 配色不變 | 無 | 不能 | 📌 未量測 | 15（使用者） | 當場卡住（捲不到底）× 📌未查證 |
| A-09 | R01 | `tests/test_convert.py:193` 的 `test_changed_pdf_is_not_served_from_cache` 分不出快取鍵是「檔案內容」還是「路徑」：它寫截斷的 PDF 到新的暫存路徑再讀，路徑鍵的實作也一樣會擲例外（失效模式 15）。只守測試自己的快取，不在產品路徑上 | A | 無（Corruption 測試每案都用新的暫存路徑，路徑鍵也不會讀到舊結果）；只是這條綠燈不代表它的名字說的事 | 改成先用原路徑讀一次填快取，再把同一路徑的檔覆蓋成截斷內容讀第二次，斷言擲例外 | 維護者（測試本身） | ✅ 本輪 P8（%TEMP% 複本）：快取鍵改成 `(str(path), …)` 這條仍綠；改寫後同一破壞要紅 | 無 | 能 | 約 9 秒（含一次 PDF 抽字） | 10 | 都不會 × 低 |

<!-- 組A缺口:結束 -->

## 組 B

<!-- 組B缺口:開始 -->

| 編號 | 大項 | 缺口 | 分類 | 失敗時使用者會看到的症狀 | 建議驗法 | 消費端 | 陽性對照怎麼做 | 開宿主 | 進 CI | 單次執行時間 | 成本（分鐘） | 優先級 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-01 | R09 | `data/review/notes.json` 不存在時 `convert.py:45` 當成「沒有註記」：退出 0、印「與上一版相比：0 處變動」，99 則註記全被拿掉、13 題換回已判定有誤的解析（掛解析題數 1133→1143、717→720）。`diff_versions` 只比題文與答案，不比 notes 與 explanation。上輪 B-01，未修（✅ 2026-10-03 複本重驗） | A | 網站上 99 則審查註記消失、13 題換回錯的解析；轉檔摘要說沒變動，只有 `git diff data/questions/` 看得出來 | `convert.py` 對 notes.json 缺檔改成中止並印中文訊息（或要求明確旗標才允許無註記），差異摘要加列「註記增減」；`tests/test_convert.py` 加一支「拿掉 notes.json 要退出非零」 | 維護者跑轉檔、之後所有網站使用者 | 在 %TEMP% 複本拿掉 notes.json 跑 `python tools/convert.py`：現況退出 0、兩份 JSON 的 `"type": "` 由 53／46 變 0／0 | 無 | 能（`run_gate.py` 已跑 unittest） | 一次轉檔約 10 秒，未精量 | 30 | 看到錯的結果卻不知道 × 低（notes.json 有進版控，要誤刪或換路徑才會發生） |
| B-02 | R10 | `tools/review/highlight_check.py` 沒有 `sys.stdout.reconfigure(encoding="utf-8")`（另三支 `tools/review/*.py` 有），stdout 是管線或檔案時以 cp950 編碼，第 118 行印 `✓` 擲 UnicodeEncodeError、退出 1：核對紀錄一致也被報成失敗。stderr 走 backslashreplace 不會擲，但 `✗` 變成 `✗`。README:32 叫維護者直接跑這支；`run_gate.py:32` 與 `tests/test_review_tools.py:16` 都設了 `PYTHONIOENCODING=utf-8`，所以把關與測試都看不到 | A | 跑 `python tools/review/highlight_check.py > log.txt` 或由另一支程式呼叫時，最後一行是 UnicodeEncodeError 堆疊、退出 1，看不出資料到底有沒有一致；互動主控台（PEP 528 走 UTF-8）📌未查證 | 腳本開頭加 `sys.stdout.reconfigure(encoding="utf-8")`（與 `round1_check.py:7` 同）；`tests/test_review_tools.py` 新增一條：子行程環境**拿掉** `PYTHONIOENCODING`、stdout 用 pipe，斷言退出 0 且輸出含 `✓` | 維護者（Windows 主控台、cp950） | 把 reconfigure 拿掉、以 pipe 跑：退出 1、stderr 含 `UnicodeEncodeError: 'cp950'`（✅ 2026-10-03 複本實測，即現況） | 無 | 能（Linux CI 預設 UTF-8 不會紅，要在測試裡設 `PYTHONIOENCODING=cp950` 才守得住） | 約 3 秒，未精量 | 15 | 看到錯的結果卻不知道 × 中（輸出一導向就發生；互動跑不受影響） |
| B-03 | R10 | 網站除了題庫下載失敗（`App.svelte:55`）之外沒有全域錯誤攔截（`main.js`／`App.svelte` 無 `onerror`／`unhandledrejection`，grep 0 筆），頁尾只顯示題庫版本不顯示建置 commit（`App.svelte:158`），同事回報「卡住」時拿不出可對照的版本與錯誤。上輪 B-03，未修 | B（探針守得到「例外有被攔下並顯示中文訊息」；守不到行動裝置各瀏覽器實際會丟哪些例外） | 卡片點了沒反應或畫面停住，沒有任何訊息；回報時說不出是哪一版 | 加全域攔截顯示中文訊息與版本；`vite.config.js` 以 `define` 注入 `git rev-parse --short HEAD` 到頁尾 | 網站使用者（手機瀏覽器、LINE 內建瀏覽器） | 開發版在元件裡故意擲錯，確認畫面出現中文訊息與版本；拿掉攔截要變回無訊息 | 無（瀏覽器） | 部分能（Playwright 類需新增相依，要先問；`tools/measure_browser.mjs` 已能驅動無頭 Chrome，可借用） | 未量測 | 60 | 看到卡住卻不知道原因 × 低（未見實際回報，📌未查證） |
| B-04 | R11 | `data/source/` 進版控的理由沒寫（`檔案結構規範.md:12` 只寫「是」；`data/questions/` 的理由在第 46 行有）。官方 RTF 單檔 7.2 MB 是歷史裡最大的 blob，每次換版再多一份（目前 pack 3.11 MiB、55 commit）。上輪 B-04，未修 | A | 無立即症狀；repo 隨換版次數線性長大 | 在規範的 `data/source` 列補理由（理由由使用者決定；「官方只提供最新版、舊版無法重抓」是候選，📌未查證），並訂換版時檢查 `git count-objects -vH` | 維護者 | 不需（文件項）；可在把關加一條「1 MiB 以上二進位要在規範寫理由」，拿掉理由行要變紅 | 無 | 能 | 數秒 | 10 | 都不會 × 每次換版都發生 |

<!-- 組B缺口:結束 -->

## 組 C

<!-- 組C缺口:開始 -->

上輪 C-01（審查工作區在被忽略的 `tmp/`，乾淨 clone 核對腳本印 0 之 0）✅ 本輪親驗已修：`%TEMP%` 乾淨 clone（d87d6a0）`round1_check.py` 印 2700／2700，`round2_check.py` 逐位元組重現 `final.json`；陽性對照：改名 `data/review/work` 後兩支都印「✗ 找不到…」退出 1（`tests/test_review_tools.py:42` 也守著）。上輪 C-02、C-03 原樣未修，本輪重編為 C-01、C-02。`highlight_check.py` 輸出重導時以 cp950 擲 UnicodeEncodeError 退出 1 這件，組 B 查得較深，見 B-02，本組不重列。

| 編號 | 大項 | 缺口 | 分類 | 失敗時使用者會看到的症狀 | 建議驗法 | 消費端 | 陽性對照怎麼做 | 開宿主 | 進 CI | 單次執行時間 | 成本（分鐘） | 優先級 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 | R16 | `README.md:11` 寫 Python 測試「30 條全綠」，✅ 本輪 clone 實跑 `Ran 32 tests`；`README.md:12` 寫 `npm test`「25 條全綠」，✅ 實跑 `tests 29`／`pass 29`；`README.md:14` 列的測試主題漏了 `cardface-css.test.js`（背面暫停規則順序）。條數是手寫的，沒有腳本比對；上輪 C-02 時是 10 對 16，改過一次又落後 | A | 讀者以為測試比實際少；測試數掉了也沒人發現 | `tests/` 加一支：解析 README〈狀態〉的兩個條數，與 `unittest` 載入的測試數、`node --test` 的 `tests N` 行比對；或 `run_gate.py` 跑完把兩個條數印出來並與 README 比對，不同就退出非零 | 讀 README 的人 | 把 README 改成 32／29 後，再改回 30／25 要變紅 | 無 | 能 | 數秒（另需兩套測試的結果：Python 35.6 秒、npm 0.6 秒，本輪實量） | 20 | 都不會 × 每次加測試都會發生（兩輪都發生） |
| C-02 | R16 | `README.md:10` 寫「尚未在手機實機操作過」；`目標路線圖.md:33` 寫 2026-10-02 手機實測翻卡已修、`docs/perf-baseline.md:395-397` 第 9 輪 2026-10-03 使用者在手機實機確認星空不再重排、commit d87d6a0 同義。上輪 C-03 原樣未改 | C（語意一致探針碰不到）；替代檢查：每次改路線圖〈現在卡在哪〉或效能基準加實機輪時對讀 README〈狀態〉，使用者本人執行 | 同事讀 README 以為網站完全沒在手機上試過 | 改 `README.md:10` 那一句，寫明已實機確認哪幾項、還沒確認哪幾項（路線圖第 33 行已列） | 讀 README 的同事 | 不適用（文件內容） | 無 | 否 | — | 5 | 都不會 × 已發生 |
| C-03 | R16 | 問題台帳兩筆 🔴 開放（PQZ-03 `tf-04-0225`、PQZ-04 `tf-12-0009`／`0095`：官方答案疑似沿用舊條文或依據函釋）沒寫進 README 已知限制（`README.md:31,97` 兩段都沒提，grep 題號與編號 0 筆）；交付把關 E2 只對 🟡，🔴 沒人守 | A | 同事練到這三題照官方答案背，不知道現行條文可能不同；只有翻台帳才看得到 | `tests/` 加一支：解析 `docs/問題台帳.md` 狀態為 🔴 或 🟡 的列，README 內要出現該 `PQZ-NN` 編號（或在 README 加「待釐清的題目」一段列編號） | 讀 README 的同事、練習者 | 把 README 補上編號後，再拿掉一個要變紅；現況即紅 | 無 | 能 | 1 秒內 | 15 | 看到錯的結果卻不知道 × 低（3,599 題中 3 題，且官方答案才是考試正解） |
| C-04 | R16 | `README.md:30` 的「74% 題目有標記，每題最多 5 處」與「改標 16 段」沒有任何程式在算：`highlight_check.py:114` 只印「線索 1523：通過 1011、判錯 18、無法核對 494；上線 1027」（✅ 本輪實跑），`web/src/lib/highlight.js` 與元件 grep 不到每題上限 5 的常數或 74 這個數；判錯 18 對 README 的改標 16，差的 2 段是判錯而無 fix（📌 未逐筆查證） | A | 數字過期沒人知道；若有題目超過 5 處重點字，卡片會比 README 說的更花 | `highlight_check.py` 加印「有標記題數／總題數」與「單題最多處數」，README 的數字改成引用它的輸出，或 `tests/` 比對 | 讀 README 的人、網站使用者 | 把 README 的 74 改成 70 要變紅；或在微調加第 6 處要變紅 | 無 | 能 | 約 3 秒（`highlight_check.py` 本輪實量在 clone 約 3 秒，未精量） | 20 | 都不會 × 低 |

<!-- 組C缺口:結束 -->

## 組 D

<!-- 組D缺口:開始 -->

上輪 D-01（pypdf 弱點、沒釘版）與 D-02（沒有 requirements）✅ 本輪親驗已修：`requirements.txt` 5 筆 `==`、pip-audit 0 筆、乾淨 venv 照 README 裝完 32 條測試綠。上輪 D-05 的 tag 與版本紀錄已補（v0.1.0、E6 PASS），剩下的部分重編為 D-06。其餘重新評估後重新編號如下。

| 編號 | 大項 | 缺口 | 分類 | 失敗時使用者會看到的症狀 | 建議驗法 | 消費端 | 陽性對照怎麼做 | 開宿主 | 進 CI | 單次執行時間 | 成本（分鐘） | 優先級 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D-01 | R17 | `tools/fetch_official.py` 本輪沒跑：它向 `web.pcc.gov.tw` 送下載表單，盤點不送表單；更新題庫第 1 步依賴外部站台表單格式不變 | C | 維護者換版時才發現下載失敗或格式變了；網站使用者不受影響 | 維護者在 `%TEMP%\盤點 (D) 試裝\採購題庫 (複本)` 手跑 `python tools/fetch_official.py`，看兩份都下載成功且 `convert.py` 列出 0 處或合理變動。只有維護者能決定要不要送 | 維護者 | 不適用（外部站台） | 無 | 不能（不該在 CI 打政府站） | 📌 未量測（程式 timeout 600 秒） | 10 | 當場卡住（維護者換版時）× 📌未查證 |
| D-02 | R18 | 支援範圍沒宣告：`web/package.json` 無 `engines`、無 `requires-python`、README 沒寫支援瀏覽器；建置目標吃 vite 8 預設（chrome111／edge111／firefox114／safari16.4／ios16.4，讀自 `node_modules/vite/dist/node/chunks/node.js:720`），升 vite 大版預設會變而沒人知道 | B（守得到「宣告存在且與 CI 的 Python／Node 版本一致」；守不到真實手機能不能開） | 舊手機或 LINE 內建瀏覽器開站空白、不知原因；維護者換機器用到不同 Node 大版才發現建不起來 | `package.json` 補 `engines.node`，`vite.config.js` 明寫 `build.target`，README 寫支援瀏覽器下限；探針比對 `engines` 與 `pages.yml` 的 `node-version`、README 寫的 Python 版與 `python-version` | 網站使用者（手機）、維護者 | 把 `engines.node` 改成不含 24 的範圍，探針要紅；`npm ci --engine-strict` 也會紅 | 無（實機要手機） | 宣告檢查能；實機不能 | 數秒 | 15 | 當場卡住（空白頁）× 📌未查證（使用者手機分布不明） |
| D-03 | R19 | 弱點掃描只靠人手跑：`run_gate.py` 與 `pages.yml` 都沒跑 `pip-audit`／`npm audit`，釘死的版本之後出新弱點沒人知道 | A | 維護者面：舊版 pypdf 那類 DoS 弱點重演（處理下載的官方 PDF 時卡住或吃光記憶體）；網站使用者不受影響 | CI 加 `python -m pip_audit --disable-pip --no-deps -r requirements.txt` 與 `npm audit --audit-level=high`（兩者都要連網，放 CI 比放本機把關合適）；本機 pip-audit 2.10.1 已有，不必新裝 | 維護者 | `requirements.txt` 改成 `pypdf==3.9.0` 要紅（✅ 本輪實測報 3 筆、退出碼 1）；複本 `package.json` 加 `lodash@4.17.15` 要紅（✅ 本輪實測 high 1、退出碼 1） | 無 | 能（要連網） | pip-audit 2.7 秒、npm audit 1.8 秒 | 15 | 都不會（使用者面）× 低（來源是政府站 HTTPS） |
| D-04 | R20 | `web/dist` 隨包發出思源宋體子集 4 個 woff2（OFL-1.1）卻沒附 OFL 授權文字；repo 沒有 LICENSE；子集是 OFL 的「修改版」仍用 `Noto Serif TC` 家族名（📌 Noto 有沒有宣告 Reserved Font Name 本機 LICENSE 開頭只見「Google Inc.」一行，未查證） | B（探針守得到「dist 有授權聲明檔且列出 fontsource 的 OFL」；守不到 RFN 的法律判斷） | 使用者面沒有症狀 | 建置時把 `node_modules/@fontsource/noto-serif-tc/LICENSE` 複製進 dist（或產 THIRD-PARTY-NOTICES），探針 `rg -i 'SIL Open Font' web/dist` 要有命中；repo 要不要加 LICENSE 由維護者決定 | 網站讀者、看 repo 的人 | 拿掉複製步驟，探針要紅（✅ 本輪 dist 0 筆、node_modules LICENSE 命中，樣式有效） | 無 | 能 | 數秒 | 20 | 都不會 × 📌未查證 |
| D-05 | R20 | 「題庫解析」xlsx 的作者與再散布許可沒有紀錄（README:67 只寫整理自私人筆記與政府公開資料），檔案在公開 repo（`data/source/*.xlsx`）且解析原文顯示在公開站；官方題庫的再利用條款也沒記 | C | 使用者面沒有症狀；權利人主張時要下架解析或改寫歷史 | 探針碰不到授權判斷。替代：維護者向 xlsx 作者確認可否再散布、查政府資料開放條款，結論寫進 README〈題庫來源〉加「授權」欄；寫下後探針檢查每列該欄非空 | 公開網站讀者、看 repo 的人 | 不適用（人工判斷）；欄位探針：把授權欄清空要紅 | 無 | 欄位檢查能 | 數秒 | 📌 查來源時間未知 | 都不會 × 📌未查證 |
| D-06 | R21 | 推 main 即部署，但版本號不跟：v0.1.0 之後 24 個 commit 已上線，`web/package.json` 仍 0.1.0、無新 tag；頁尾（`web/src/App.svelte:144`）只印題庫產生日期，看不到程式版本或 commit 短碼 | A | 使用者回報「翻卡壞了」對不到哪一版；維護者答不出某個改動上線了沒 | 建置時把 `npm_package_version` 與 `GITHUB_SHA` 前 7 碼注入頁尾（vite `define`）；探針：dist 的 index 含版本字串，且 `git describe --tags` 的最新 tag 等於 package.json 版本（tag 落後就紅）；發版節奏（每次合併升 patch，或只在版本紀錄加段時打 tag）由維護者定 | 使用者、維護者 | 改 package.json 版本不打 tag，探針要紅；拿掉 `define`，dist 檢查要紅 | 無 | 能 | 數秒 | 25 | 都不會 × 每次回報都會（現在就落後 24 commit） |
| D-07 | R22 | 站上與 README 都沒有回報管道：repo Issues 開著但零連結、零 issue；頁尾沒有「回報問題」；README 沒有「出問題找誰、附什麼」 | A | 使用者發現題目或解析錯了不知去哪講，回報散在聊天紀錄進不了 `docs/問題台帳.md` | 頁尾加「回報問題」連到 GitHub Issues（或維護者指定窗口，📌 由維護者決定），README 加〈回報〉一節寫要附頁尾版本字串與手機型號；探針檢查 dist 含該連結 | 網站使用者 | 拿掉頁尾連結，dist 檢查要紅 | 無 | 能 | 數秒 | 15 | 看到錯的解析卻無處回報 × 📌未查證（尚無使用者回報紀錄） |

<!-- 組D缺口:結束 -->

## 不值得做

<!-- 不值得做:開始 -->

1. 組 A：上輪 A-06（R02）字型改回靜態 import 沒探針守——214e4dd 把字型改成建置前子集化後，後果縮成入口 CSS 13,493 B→34,353 B、介面兩檔 266 KB 與題庫 JSON 同時下載（✅ 本輪 %TEMP% 複本實量，建置照過），不再是上輪的「首頁等十幾秒」；首頁字型載入時間歸 E 組基準量，比寫探針划算。
2. 組 A：IO4（0 位元組 xlsx）與 IO5（`official.rtf` 缺檔）只有英文堆疊：退出碼非零、檔名在最後一行看得到，維護者就是使用者本人，與上輪 B-02 同一判斷。
<!-- 不值得做:結束 -->
