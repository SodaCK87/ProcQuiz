# 全面盤點台帳

> 型別：查詢型（一列一個大項，靠「本次」欄過濾）｜由 /蘇-全面盤點 產出｜各組只改自己那段標記之間，手改也照這條

1. 本次盤點：2026-10-03（子代理）
2. 上次盤點：2026-10-02
3. 細項檔：[缺口清單](probe-gap-list.md)｜[結構落差與搬移計畫](structure-plan.md)｜[效能基準](perf-baseline.md)

## 總覽

<!-- 總覽:開始 -->
1. 燈號：綠 3（R07、R08、R14）、黃 19、紅 0、不適用 1（R05）。跟上次比：R12 紅→黃（審查工作區已進 `data/review/work/`，乾淨 clone 核對 2700／2700）、R14 黃→綠（`.gitignore` 7 行逐條 check-ignore 命中、索引與磁碟 194 對 194），其餘 21 項持平。上輪缺口親驗已修 6 筆：A-01（CI 改跑 `run_gate.py`）、A-02（星圖 PQZ-02）、C-01（`tmp/review`）、D-01 與 D-02（requirements 釘版、pypdf 6.19.0）、D-05 的 tag 與版本紀錄。
2. 複核：無紅燈、無變差，主線 2026-10-03 21:50 抽驗 3 條都與子代理一致：乾淨 clone 跑 `round1_check.py` 印「批次題數 2700，已涵蓋 2700」退出 0（R12）；`highlight_check.py` 重導到檔退出 1、stderr 末行 `UnicodeEncodeError: 'cp950'`，設 `PYTHONIOENCODING=utf-8` 後退出 0 印 ✓（B-02，陽性與陰性都對）；`README.md:11-12` 原文 30／25 條（C-01）。
3. 判準衝突（照〈燈號判準〉表判）：R06 參考檔「對比不足且沒探針守」判紅，表判黃（字讀得到、不會卡住）；R19 參考檔的綠定義已達，但 D-03 仍是待處理缺口，表判黃；R22 不到「找誰與版本兩者皆無」，判黃；R23 每個入口都在使用者的線內，黃只因正表待回編號與手機實機未量。
4. 跨組重疊：`highlight_check.py` cp950 崩潰由 B-02 持有，C 的 R16 只引用；`notes.json` 缺檔靜默由 B-01 持有，A 的 R04 只引用；README 條數 30／25 對實跑 32／29 由 C-01 持有，A、D、E 都只引用。E 另發現本機全域 pypdf 6.12.1 與 requirements 的 6.19.0 不同（D 的試裝在 venv 內所以沒碰到），維護者本機跑一次 `pip install -r requirements.txt` 即對齊，不列缺口。
5. 建議先做（跨全部大項挑）：
   1. C-03：問題台帳兩筆 🔴（PQZ-03、PQZ-04）沒進 README 已知限制，練習者照可能過期的官方答案背而不知道；加一支探針守 🔴／🟡 編號要出現在 README，15 分鐘。
   2. B-01＋A-06：`notes.json` 缺檔時轉檔退出 0 且印「0 處變動」，99 則註記無聲消失；`diff_versions` 不報解析與註記變動。兩件一起修約 50 分鐘，是轉檔路徑唯一「看到錯的結果卻不知道」的缺口。
   3. D-06＋D-07（含 B-03 的版本顯示）：頁尾加程式版本與回報連結；線上站已落後 tag 24 個 commit、使用者無處回報，約 40 分鐘。
   4. B-02：`highlight_check.py` 補 `reconfigure` 一行並加一條拿掉 `PYTHONIOENCODING` 的測試，15 分鐘；README 叫維護者直接跑這支，輸出一導向就假紅。
   5. A-02：卡面小字 25.5% 面積對比低於 4.5、答錯選項 98.8%，路線圖「都在 4.5 以上」不成立；探針 60 分鐘，調色由使用者決定。效能 P-01～P-03 都在使用者的線內，不列入先做。
6. 查不出來：`fetch_official.py` 送表單（D-01，維護者在試裝複本手跑）；手機實機項（A-08：長解析手指捲到底、翻卡發熱、Android 強制深色、LINE 轉址、字級放大）與手機 GPU／耗電（R23）；Excel 開著來源 xlsx 時轉檔（要開宿主，R04 列有指令）；題庫下載失敗畫面（dev server 下重現不了，要拿 dist 刪 chunk，A-05）；`highlight_check.py` 在互動主控台會不會崩（📌 使用者在自己終端機跑一次）；OFL Reserved Font Name 與解析 xlsx 再散布許可（D-04、D-05，法律判斷）；unittest 夾一行 pypdf「EOF marker not found」警告的來源（D 看到、本輪沒追，📌）。
7. 上限：缺口 24 條（A 9、B 4、C 4、D 7），不值得做 2 條；結構落差 S-01～S-09 全是改規範一句話、不動檔，搬移批次本輪一個都不排；效能正表 6 條（P-01～P-06）。
<!-- 總覽:結束 -->

## 組 A 探針與測試

<!-- 組A:開始 -->

| 編號 | 大項 | 上次 | 本次 | 證據 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| R01 | 探針清點與陽性對照 | 黃 | 黃 | ✅ E1 PASS（`Probe-Delivery.ps1` 12 項 FAIL 0，入口 `tools/run_gate.py`）。清點：`unittest` 32 條（複本 36.4 秒 OK；README 寫 30，C-01）、`npm test` 29 條（0.5 秒 OK；README 寫 25）、`convert.py --check` 與 `build_fonts.py --check` 複本都退出 0、`tools/review/` 4 支由 unittest 以子行程跑。陽性對照本輪親做 21 案，全在 %TEMP% 複本、產品檔零碰：J1 PQZ-02 寬高賦值放回註解→starfield 4 條紅；J2 PQZ-05 拿掉補畫→1 條紅；J3b 6d55dd9 resize 改回只比 innerHeight→1 條紅；J4 拿掉限幀→1 條紅；J5 暫停規則搬到 style 最前→cardface 紅；J6 拿掉出題冷卻→deck 2 條紅；J7 NEG 少「不得」→highlight 4 條紅；J8 fixes 多一筆→1 條紅；J9 連續答對不歸零→3 條紅；J10 課程前綴算錯→2 條紅；P1 手改 JSON 一題答案→`test_committed_json` 紅且 `--check` 退出 1；P2 PQZ-01 放行不看數字→紅；P3 round1_check 拿掉空批次退出→紅；P4 highlight_check 拿掉引文核對→紅；P5 介面加「龘」→test_fonts 紅「400 粗細缺 1 字」、`build_fonts --check` 退出 1；P6 cross_check 不比對→3 條紅；P7 拿掉解析指紋核對→紅；P9 第二輪改一筆嚴重度→round2 紅；G1 deck 壞一條→`run_gate.py` 退出 1 印「沒過：網站測試」（Python 36.5 秒 ✓、建置 ✓）。假探針 1 支、非核心：`tests/test_convert.py:193` 把 PDF 快取鍵改成只看路徑仍綠（失效模式 15），A-09。⚠️ 第一輪複本 `scratchpad\copy` 在 20:57–21:01 間被同一 scratchpad 的別組拿掉 `.git`、`node_modules`、字型檔，J5、P5、G1 當時的紅是載入錯誤，已在獨立路徑的 clone 重做（上面寫的是重做結果） | A-09 |
| R02 | 回歸缺口 | 黃 | 黃 | ✅ 台帳 5 筆：PQZ-01 ⏸（P2 紅）、PQZ-02 ✅（J1 紅）、PQZ-05 ✅（J2 紅），PQZ-03／04 🔴 是題目內容，探針碰不到（README 沒列見 C-03）。git 標題撈 8 筆修正 commit（陽性對照撈得到 cf0db1f）逐筆對：6d55dd9 J3b 紅、7d9e29d J2 紅；aefc60f／5d640a8／1443ad8 翻卡頓是手機實機效能，沒有會紅的探針（E 組基準、A-08）；5d640a8＋214e4dd 字型延後載入沒探針：複本把 `fonts.css` 改回靜態 import，建置照過、入口 CSS 13,493 B→34,353 B、@font-face 0→4（不值得做 1）；45093a2 閒置寫入與 pagehide flush、955f06e LINE 轉址、b0eb94d 微調下載順序都沒測試（A-05）；上輪 A-02 星圖已修且 J1 親驗會紅，A-01（CI 只跑 npm test）已修：`pages.yml:34` 跑 `run_gate.py`，G1 親驗會擋。README 已知限制 3 條（線索作答前顯示、第 X 條之 N、函釋）是內容限制不是程式行為。沒守的那幾筆壞了都不會回錯答案或寫錯檔 → 黃 | A-05、A-06 |
| R03 | 測試覆蓋 | 黃 | 黃 | ✅ 入口對測試整字搜尋（陰性對照 `zzz_not_exist` 0 筆、陽性 `read_xlsx` 命中）：Python 49 個 def，25 個被 tests 直接引用、9 個由子行程跑整支腳本涵蓋、15 個沒碰：`convert.py:165 diff_versions`（A-06）、`xlsx_bank.py:32,39 text_of／read_toc`（經 `read_xlsx` 間接走到）、`measure_perf.py` 12 個（E 組量測工具，壞了印「讀不到」）。JS 31 個 export，22 個被 `*.test.js` 引用，沒碰的 9 個是 `weight`／`ruleHits`（被測函式內部呼叫）、`runes.js` 3 個、`starfield.js setAvoid／burst`、`textures.js` 2 個（純視覺）。Svelte 元件 `App`／`QuizCard`／`StartScreen` 零測試：判對錯 `QuizCard.svelte:15,86`、出題與錯題穿插 `App.svelte:86-101`、下載失敗訊息 `App.svelte:41`、LINE 轉址 `main.js:9`（A-05）；`CardFace` 只有 CSS 順序一條。「被引用」之上抽驗 20 案（R01 的 J／P）都會紅，不是只呼叫不斷言。核心邏輯（轉檔、核對、出題、紀錄、重點字、字型）都有會紅的測試，UI 層沒有 → 黃 | A-05、A-06 |
| R04 | 失敗模式 | 黃 | 黃 | ✅ 吞錯樣式：Python `except: pass` 0 筆；JS 空 catch 2 筆都是刻意退回預設（`progress.js:19`、`highlight.js:90`）；`App.svelte:44` 的 `.catch(() => {})` 是背景預抓，訊息已在 `ensure()` 設給 `loadError`；`App.svelte:51` 微調下載失敗靜默（只少重點字）、`textures.js:26` 退回 SVG（刻意）。壞輸入（%TEMP% 複本跑 `convert.py`）：IO1 是非題 xlsx 各課程表刪第 6 欄→退出 1 但訊息指錯原因「審查註記 tf-02-0028：解析與審查當時不同」；IO2 同時把 `notes.json` 清成 []→退出 0、印「掛上解析 0 題」「0 處變動」並寫出 JSON；IO2b 之後 `test_committed_json`、`explanation_only`、`every_review_note` 3 條全綠，把關放行（A-01）；IO3 `notes.json` 不存在→退出 0、1133→1143 題、「0 處變動」（B-01，本組不重列）；IO4 0 位元組 xlsx→退出 1、英文 `zipfile.BadZipFile` 堆疊；IO5 `official.rtf` 缺→退出 1、英文 FileNotFoundError 堆疊（上輪移入不值得做）。中止時不留半套輸出（`convert.py:180` 先 build 全部通過才寫）。網站：練習紀錄寫入失敗無提示——瀏覽器 5181 把 `Storage.prototype.setItem` 換成擲 QuotaExceededError，答一題後畫面出「答錯了」、等 3 秒 alert／error／hint 0 個、localStorage 仍 null（A-04）。📌 題庫下載失敗訊息本輪沒重現（dev server 下讓不了 import 失敗，要用 dist 刪 chunk）。檔案鎖：來源 xlsx 被 Excel 開著時跑轉檔要開宿主，列給使用者：Excel 開著 `data/source/true-false.xlsx` 跑一次 `python tools/convert.py --check` 看退出碼（📌 openpyxl 讀取是否受共用鎖影響未查證） | A-01、A-04 |
| R05 | 產出檔的消費端 | 不適用 | 不適用 | 不適用：專案不產生 xlsx／docx／pptx／csv。✅ `tools/` 只讀 xlsx（`xlsx_bank.py:94 load_workbook`），`grep Workbook\(、to_csv、csv.writer、docx、pptx` 在 `tools/` 與 `tests/` 0 筆（唯一的 `wb.save` 在 `tests/test_convert.py:218` 寫暫存複本當測資）；寫出的只有 JSON、woff2、CSS 與 dist，消費端是瀏覽器與 Node：`npm test` 讀真的題庫 JSON、G1 建置成功、dev server 5181 開頁正常 | 無 |
| R06 | 外觀 | 黃 | 黃 | ✅ 瀏覽器 pane（dev server 5181；375×812 DPR 2、320×700）。(1) 對比：字色取 computed style，底色照 CSS 疊法用 `textures.js` 烘好的紋理 blob 在 canvas 逐像素合成（陽性對照 #777 對 #FFF 得 4.48、#000 對 #FFF 得 21）：卡面 `--ink-2`（`.meta` 12px、`.verdict span` 14px、`.none`）中位 4.75、25.5% 面積低於 4.5、最低 3.45，金墨暈染最亮時 93.2% 低於 4.5；`.btn.is-wrong` 98.8% 低於 4.5（中位 3.71、最低 2.82）；`.btn.is-ans` 51.7%；`.verdict strong` 答錯 46.0%；頁尾 27.6%（最低 3.66）；題型鈕按下態 #1a1208 壓金色漸層 31.1%；`.lbl` 5.5%；`.stem`、`mark`、`.mc .btn`、`.btn.primary`、課程列、提示框全在 4.5 以上。路線圖:17「卡面小字對比都在 4.5 以上」不成立且沒腳本在算 → A-02。disabled 與 hover 沒有另外的顏色（`app.css:49-50`），placeholder 無。(2) 宿主注入樣式：不適用（靜態網頁）；Android 強制深色歸 A-08。(3) 深淺色：調色盤寫死、`color-scheme:dark`，模擬 light 後 body 仍 rgb(13,10,7)，兩種模式同一組數字 → 已涵蓋。(4) 版面：320 寬 scrollWidth 320 無橫向捲動、按鈕 0 個被祖先 overflow 裁切、最長課程名正常折行；quiz 列最長狀態字串「錯題剩 123 題・穿插複習・熟練 123／2686」在 320 折成 2 行不溢出 → 已涵蓋。(5) 溢出與 DPI：320 已量；DPR 2 以 mobile 模擬量過，桌機 150%／200% 只等於較窄的 CSS 寬度 → 已涵蓋。(6) 字型：已提交 4 個 woff2 的 cmap 聯集 1,588 字，網站用字 1,615 個缺 29（28 個 CJK 相容字＋✦ U+2726），落在 35 題（題幹 8、選項 3、解析 25），`tests/test_fonts.py:17` 以 `NOT_IN_SOURCE` 刻意放行 → A-07（B）。(7) 焦點：quiz 畫面 Tab 7 次順序「‹ 選題、✦ 重點字、O、X、看題目、下一題、‹ 選題」，第 5、6 個在 `.face.back`（aria-hidden=true、pointer-events none、inert false）；題型鈕 focus ring 是 UA `auto 1px offset 0`，鈕的上緣＝`.seg` 內緣且 `.seg{overflow:hidden}`（`StartScreen.svelte:62`）→ 三邊被裁；課程鈕父層 overflow visible 正常 → A-03。(8) 只靠顏色：對錯有「正／誤」印章與「答對了／答錯了」文字，按下的題型鈕加粗，課程選取靠亮邊框（亮度差非色相差）→ 已涵蓋。(9) 繁中：對 `web/src` 的 svelte／js／html 掃 200 個簡體專用字，0 筆真命中（5 筆是通增系致制這類繁簡共用字；陽性對照檔「简体测试」命中）→ 已涵蓋。⚠️ 燈號：參考檔對「對比不足且沒探針守」寫紅，照 SKILL 總表（不會卡住、不會看到錯的結果）判黃，請主線裁定 | A-02、A-03、A-07、A-08（C 類，使用者實機） |

組A 完成：2026-10-03 21:16

<!-- 組A:結束 -->

## 組 B 程式碼與安全

<!-- 組B:開始 -->

| 編號 | 大項 | 上次 | 本次 | 證據 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| R07 | 編碼紅線 | 綠 | 綠 | ✅ 沒有 `.ps1`／`.bat`（`git ls-files` 0 筆，E5 無對象）；替換字元 U+FFFD 全樹 0 筆（陽性對照：scratchpad 造的檔 1 筆命中）；Python 讀寫文字檔 14 處全帶 `encoding="utf-8"`，唯二例外是刻意的：`tools/official.py:54` RTF 以 latin-1 讀（RTF 本身是 ASCII 跳脫）、`tools/measure_perf.py:465,484` 以 mbcs 解 Windows 指令輸出；`.gitattributes` 把 `data/source/**` 與字型標 binary。主控台輸出編碼的問題歸 R10（B-02） | 無 |
| R08 | 安全 | 綠 | 綠 | ✅ 金鑰三條內容樣式對全樹 0 筆、檔名樣式對 `ls-files` 與未追蹤檔 0 筆（陽性對照 11 行假金鑰全中、3 個假檔名全中、`RE_TOKEN`／`get_token()` 沒中）；注入：`subprocess` 6 處全是串列參數且無 `shell=True`（`run_gate.py:33`、`measure_perf.py:187,465,470,472,484`），`measure_browser.mjs:34` 的 `spawn` 參數是常數加自己的 argv，無 eval／exec／pickle／yaml，Svelte 無 `{@html}`、產品碼無 `innerHTML`（只有 `web/prototype/highlight-style.html:206,217` 對常數陣列，不進建置）；覆蓋原檔：`convert.py:207` 寫自己的產出、`fetch_official.py:41` 兩份都下載成功才覆蓋受版控的來源檔；動態驗證：%TEMP% 複本跑 `python tools/convert.py` 前後 5 個輸入檔 sha256 全同、工作樹 `git status` 無新變動 | 無 |
| R09 | 設定管理 | 黃 | 黃 | ✅ 寫死路徑三條樣式（排除 .md／.txt）只中 1 筆 `tools/measure_browser.mjs:21`：Chrome 系統安裝位置當預設、可用環境變數 `CHROME` 覆蓋、找不到時第 41 行印中文提示，判綠；專案沒有設定檔，常數在程式碼裡，網站紀錄只在 `localStorage`（`progress.js:3`）。缺檔行為：`data/review/notes.json` 不在時轉檔退出 0、99 則註記全部無聲消失（複本實測 `"type": "` 由 53／46 變 0／0，摘要仍印「0 處變動」），上輪 B-01 未修，本輪重列 B-01；`official.pdf` 缺檔退出 1 但只有英文 FileNotFoundError 堆疊（上輪移入「不值得做」，維持） | B-01 |
| R10 | 日誌與診斷輸出 | 黃 | 黃 | ✅ 轉檔的資料錯誤走 `BankError`：複本把一則註記類型改壞，印「✗ 審查註記 mc-02-0010：類型不合法 亂寫」退出 1（陽性對照）；非 BankError 例外是英文堆疊。`tools/review/highlight_check.py` 沒 `reconfigure`，stdout 導向管線或檔案時以 cp950 印 `✓` 擲 UnicodeEncodeError、退出 1——資料一致也報失敗（複本實測；`run_gate.py:32` 與 `tests/test_review_tools.py:16` 都設了 `PYTHONIOENCODING` 所以測試看不到；互動主控台 📌未查證），B-02。網站只攔題庫下載失敗（`App.svelte:55`），無 `onerror`／`unhandledrejection`（grep 0 筆），頁尾只有題庫版本沒有建置版本（`App.svelte:158`），B-03。專案不寫 log 檔，無洩漏面；CI 的紀錄在 GitHub Actions | B-02、B-03 |
| R11 | git 歷史衛生 | 黃 | 黃 | ✅ 秘密兩條 ERE 對 `git log --all -G` 0 筆（陽性對照：拋棄式 repo 加再刪假金鑰，兩條都列出 add／del 兩個 commit）；已刪檔 3 個（`1`、`4`、`8`，4e57844 誤存的法規全文、cb0b56d 刪，公開法規不是客戶資料）；xlsx／pdf 只有 `data/source/` 三個來源檔（官方題庫與第三方解析，授權歸 R20）；55 commit、pack 3.11 MiB；1 MiB 以上 blob：`official.rtf` 7.2 MB×1、`true-false.json` 1.15–1.20 MB×3（可重建產出物，理由在 `檔案結構規範.md:46`）；`data/source/` 進版控理由仍只寫「是」（`檔案結構規範.md:12`），上輪 B-04 未修，重列 B-04 | B-04 |

組B 完成：2026-10-03 20:57

<!-- 組B:結束 -->

## 組 C 結構與文件

<!-- 組C:開始 -->

| 編號 | 大項 | 上次 | 本次 | 證據 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| R12 | 目錄結構與檔案落點 | 紅 | 黃 | ✅ 上輪紅燈已修：審查工作區在 `data/review/work/`（125 檔追蹤），乾淨 clone 跑 `round1_check.py` 2700／2700、`round2_check.py` 逐位元組重現 `final.json`，陽性對照改名工作區後兩支退出 1（structure-plan 現況 3）。✅ `Probe-Delivery.ps1` 12 項 PASS（E0 4 份都在、E10 頂層列舉得完、E11 14 項對得上）；`git ls-files` 與磁碟 194 對 194 大小寫逐字相符。決策樹 8 個真實檔名走一遍：原始碼、產出物、暫存三者唯一且不同；`.claude/launch.json`、盤點產出 4 檔走到第 10 題，`highlight-fixes.json` 落到與實際不同的位置（S-01～S-03）。黃：有違規但入口與測試都指對檔，不會找錯 | 等使用者回 S-01～S-05、S-08、S-09 要不要改規範本體（全是改規範、不動檔） |
| R13 | 命名與版本化檔名 | 黃 | 黃 | ✅ E9 PASS。對 194 個追蹤檔名掃版號樣式（`_v\d`、日期、final、copy、superseded、`R\d+b`），只命中 `data/review/work/findings/R23.superseded` 與 `R23b.json`：同一審查員兩版產出，現行版帶「b」；入口 `round2_build.py:15` 只 glob `*.json`，作廢版不會被讀（S-05）。黃：有版本化檔名但入口只指向其中一份 | S-05 改規範一句話即可，只列不排 |
| R14 | .gitignore 與版控邊界 | 黃 | 綠 | ✅ E4、E11 PASS。`.gitignore` 7 行逐條 `git check-ignore -v`：`~$*`、`__pycache__/`、`.pytest_cache/`、`.venv/`、`node_modules/`、`web/dist/`、`.claude/launch.json` 各命中自己那行；反向對照 `tools/run_gate.py`、`data/questions/true-false.json`、`web/src/App.svelte` 都未被忽略；`ls-files -i -c` 0 筆、`--others --exclude-standard` 0 筆；被忽略的 `.pyc` 只 1 個且來源仍在。追蹤的大檔只有規範刻意收的來源檔（`official.rtf` 7.2 MB，理由缺寫見 B-04）。規範〈不進版控〉表少 `.claude/launch.json` 一列是文件落差，記在 S-01 | 無（S-01 歸 R12） |
| R15 | 文件長度 | 黃 | 黃 | ✅ 17 份 `.md` 全量，`wc -l` 與 `(Get-Content -Encoding UTF8).Count` 17 筆全相同（structure-plan 現況 5）；有宣告型的都在上限內：README 97／400、路線圖 38／120、規範 63／100、版本紀錄 1／12 版。未歸型：`CLAUDE.md` 9 行、`docs/審查指示/` 7 檔 14～76 行（S-06、S-07）；型別沒集中列（S-08）。黃：有未歸型，但每次開工要讀的兩份都在上限內 | S-06～S-08 只改規範與各檔第 3 行，等使用者回編號 |
| R16 | 文件與程式同步 | 黃 | 黃 | ✅ E2、E3、E7（8 支都在）、E8 PASS。照 README 走：clone 跑 `unittest` 32 條 OK 35.6 秒、`convert.py --check` 退出 0、`highlight_check.py` 數字 1523／1011／494／1027 與 README 相符；工作樹 `npm test` 29 條過、`build_fonts.py --check` 退出 0；`deck.js:16-18` 的 8 倍／32 倍／冷卻 4 題與 README:24 相符。對不上的：README:11-12 條數 30／25 對實跑 32／29（C-01）、README:10 手機一句與路線圖、效能基準第 9 輪相反（C-02）、🔴 PQZ-03／04 沒進 README 已知限制（C-03）、74%／每題 5 處沒人算（C-04）；`highlight_check.py` 重導輸出時 cp950 崩潰見 B-02。黃：過期的是數字與狀態句，照 README 操作不會失敗 | C-01～C-04 等使用者回編號；B-02 由組 B 的編號走 |

組C 完成：2026-10-03 21:02

<!-- 組C:結束 -->

## 組 D 交付與相依

<!-- 組D:開始 -->

| 編號 | 大項 | 上次 | 本次 | 證據 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| R17 | 交付與安裝 | 黃 | 黃 | ✅ 在 `%TEMP%\盤點 (D) 試裝\採購題庫 (複本)`（含中文、括號、空白）git clone d87d6a0，乾淨 venv 照 README 一字不改走完：`pip install -r requirements.txt` 15 秒、`npm install` 5 秒、`python -m unittest discover -s tests` 32 條 OK 40 秒、`npm test` 29 條 OK 9 秒、`npm run build` 4 秒、`tools/convert.py` 12 秒「0 處變動」、`tools/build_fonts.py` 20 秒、`tools/run_gate.py` 38 秒全部通過；每步之後 `git status --porcelain` 都是空，沒有卡住的點。沒寫死路徑、不要管理員、不寫 Program Files（Grep 只命中 `tools/measure_browser.mjs:21` 的 Chrome 預設路徑，可用環境變數覆寫，且是維護者量測工具）。連網只在 `pip install`／`npm install`（裝相依本身）與 `tools/fetch_official.py:16`；📌 `fetch_official.py` 本輪沒跑（送表單），D-01。⚠️ README 狀態行寫 30／25 條，實跑 32／29 條（R16 範圍，已知會給組 C） | D-01 由維護者在複本手跑一次 fetch_official |
| R18 | 版本相容面 | 黃 | 黃 | ✅ 宣告只在 CI（`.github/workflows/pages.yml` Python 3.11、Node 24）與 README 狀態行（Python 3.11.9、Node 24），`web/package.json` 沒有 `engines`，沒有 `requires-python`，README 沒寫支援的瀏覽器；`vite.config.js` 沒設 `build.target`，vite 8.3.2 預設目標讀自 `web/node_modules/vite/dist/node/chunks/node.js:720`：chrome111、edge111、firefox114、safari16.4、ios16.4。本機 Python 3.11.9、Node 24.16.0 與 CI 一致，沒有衝突；無 `.ps1`／`.psm1`，PowerShell 5.1 那條不適用。沒有探針守宣告與 CI 一致 | D-02 |
| R19 | 相依版本與弱點 | 黃 | 黃 | ✅ Python 5 筆全 `==`（`requirements.txt`），試裝 venv `pip list` 與釘版一致；npm 用 `^` 但 `web/package-lock.json`（lockfileVersion 3，65 套件）鎖死且 CI 走 `npm ci`。`python -m pip_audit --disable-pip --no-deps -r requirements.txt`（本機 pip-audit 2.10.1）2.7 秒 0 筆，陽性對照 `pypdf==3.9.0` 報 PYSEC-2026-4155、4157、CVE-2026-57204 退出碼 1；`npm audit` 1.8 秒 0 筆（prod 2、dev 64），陽性對照在複本加 `lodash@4.17.15` 報 high 1 退出碼 1。沒有隨附二進位。缺口只剩掃描沒進把關（D-03）；參考檔的綠定義（全釘版、來源可追、掃過 0 筆）已達，照 SKILL 表「沒有待處理的缺口」判黃 | D-03 |
| R20 | 授權 | 黃 | 黃 | ✅ venv 7 套件授權：MIT 6、BSD-3-Clause 1（pypdf），無 GPL；npm 65 套件（`node_modules` 一層）：MIT 32、Apache-2.0 3、MPL-2.0 2、ISC 1、BSD-3-Clause 1、OFL-1.1 1（`@fontsource/noto-serif-tc`），無授權欄 0。隨包發出去的第三方只有思源宋體子集 4 個 woff2（`web/dist/assets/`，建置產出 12 檔）；`rg -i 'SIL Open Font|OFL|MIT License|copyright' web/dist` 0 筆，陽性對照同樣式在 `node_modules/@fontsource/noto-serif-tc/LICENSE` 命中，即 dist 沒附 OFL 文字（D-04）。repo 無 LICENSE（`gh repo view` licenseInfo null）。「題庫解析」xlsx 的來源 README:67 有寫（私人筆記與政府公開資料），但再散布許可與官方題庫再利用條款都沒有紀錄（D-05，📌 法律判斷由維護者） | D-04、D-05 |
| R21 | 發佈與版本號流程 | 黃 | 黃 | ✅ 八條版本樣式加 `"version":` 掃全樹（排除 lock 與 data），只命中 `web/package.json:4` 0.1.0，單一來源；`git tag` 只有 v0.1.0（annotated，指向 ea542e8），`docs/版本紀錄.md:5` 最新段 v0.1.0 引用 PQZ-01、PQZ-02，交付把關 E6 PASS（本輪 12 項 FAIL 0）。`git log v0.1.0..HEAD` 24 個 commit，而 `pages.yml` 每次推 main 就部署，線上站已是 d87d6a0、不是 v0.1.0，頁尾（`web/src/App.svelte:144`）只印題庫產生日期、沒有程式版本或 commit 短碼（D-06）。打包：`tools/run_gate.py` 在複本一步重建 dist 12 檔，沒混進測試素材、`.git`、暫存檔 | D-06 |
| R22 | 使用者回饋管道 | 黃 | 黃 | ✅ Grep 回報字樣（回報、聯絡、feedback、issues…）在 README 與 `web/src` 命中 0 行有效（命中的是審查表與註解）；頁尾 `web/src/App.svelte:144` 沒有回報連結、沒有程式版本，只有題庫版本 115/10/02；repo Issues 開著（`gh repo view` hasIssuesEnabled true），`gh issue list --state all` 0 筆，站上與 README 都沒連過去；網站沒有 log，紀錄只在 localStorage（README:36）。回報有去處：`docs/問題台帳.md` 5 筆都有 PQZ 編號（PQZ-03、04 來自子代理，不是使用者）。四件缺兩件半（找誰、程式版本、log），不到「兩者皆無」的紅 | D-07 |

組D 完成：2026-10-03 20:57

<!-- 組D:結束 -->

## 組 E 效能

<!-- 組E:開始 -->

| 編號 | 大項 | 上次 | 本次 | 證據 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| R23 | 效能基準與熱點 | 黃 | 黃 | ✅ 第 10 輪全套重量（perf-baseline 第 10 輪，HEAD d87d6a0，CPU 10%→1%，71 列無噪音）：16 個入口全量過，每個有線的都在使用者的線內——`unittest` 32.23 s／34.10 s（線 60 s；第 1 輪 89.3 s）、`convert.py --check` 9.06 s（線 12 s）、新入口 `run_gate.py` 34.86 s（線 60 s）、`build_fonts.py --check` 16.10 s（線 30 s）、開站首次繪製 0.544 s（Fast 4G＋CPU 4× 模擬，線 3 s）、題庫／微調／字型到手 0.85／1.07／1.53 s（線：按開始前）、翻卡與下一題超過預算 0 格、卡片閒置主緒 14.6%（線 20%）、首頁閒置 4.6%、CI push 到上線 62–73 s（不設線）。沒有紅。黃的理由：正表 P-01～P-06 等使用者回編號（P-01 Corruption 類佔 unittest 86%、P-02 PDF 抽字佔 convert 69%、P-03 子集化佔 build_fonts 98%），且瀏覽器那一半是無頭 Chrome 桌機模擬，手機實機只能由使用者做。第 3 輪 13 個熱點：10 個 ✅、2 個 ❌ 已還原、P-04 查明是 GPU 點陣化保留為本輪 P-06。⚠️ 本機 pypdf 6.12.1 ≠ requirements 6.19.0（R19 範圍）。量測腳本只加段：`measure_perf.py` 新段 gate、buildfonts、重點字兩列、產出大小 4 列；`measure_browser.mjs` 新增 `serve:`、`load`、`next` | 使用者回 P-01～P-06 的編號（建議 P-01、P-02 第一步、P-03）；手機實機抽驗照 perf-baseline 第 10 輪〈量不到的部分〉 |

組E 完成：2026-10-03 21:47

<!-- 組E:結束 -->

## 盤點紀錄

| 日期 | 綠 | 黃 | 紅 | 不適用 | 模式 | 備註 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | 2 | 19 | 1 | 1 | 子代理 | 第一次盤點；紅燈 R12（審查工作區在被忽略的 tmp/）；另查到星空回歸 A-02 |
| 2026-10-03 | 3 | 19 | 0 | 1 | 子代理 | 第二輪；R12 紅→黃（審查工作區已進版控）、R14 黃→綠；上輪缺口已修 6 筆；新發現 B-02（highlight_check 重導輸出 cp950 崩潰）、C-03（🔴 台帳未進 README） |
