# 全面盤點台帳

> 型別：查詢型（一列一個大項，靠「本次」欄過濾）｜由 /蘇-全面盤點 產出｜各組只改自己那段標記之間，手改也照這條

1. 本次盤點：2026-10-02（子代理）
2. 上次盤點：—
3. 細項檔：[缺口清單](probe-gap-list.md)｜[結構落差與搬移計畫](structure-plan.md)｜[效能基準](perf-baseline.md)

## 總覽

<!-- 總覽:開始 -->
1. 燈號：綠 2（R07、R08）、黃 19、紅 1（R12）、不適用 1（R05）。第一次盤點，沒有上次可比。
2. 紅燈複核：R12 主線 2026-10-02 23:20 在乾淨 clone 重跑 `python tools/review/round1_check.py`，印「批次題數 0，已涵蓋 0，未涵蓋 0」、退出 0，`round2_check.py` 擲 FileNotFoundError，與組 C 一致。
3. 判準衝突：R02、R04、R06、R19 依參考檔門檻會判紅，依燈號判準表判黃（不會讓同事卡住或看錯答案），本輪照表判黃；R23 依參考檔判紅，依使用者回答（unittest 要 1 分鐘內，超過判黃）判黃。
4. 跨組重疊：C-04 併入 A-01（A-01 有實跑證據）；B-02 移進「不值得做」，使缺口合計 25 條。A-02（星空）由組 E 先查到、組 A 在瀏覽器複核，效能面記在 P-09。
5. 建議先做（跨全部大項挑）：
   1. A-02：星空從 aefc60f 起整片沒畫，現在就壞著，修一行。修好後要在手機實機重測翻卡，因為 1443ad8「翻卡不再頓」是在星空沒畫時測的（P-09）。
   2. A-01（含 C-04、D-02）：CI 只跑 `npm test`，手改或沒重跑的題庫 JSON 照樣上線；加 `convert.py --check` 前要先補 Python 相依檔。
   3. 第 3 批搬移加 C-01：R12 唯一紅燈，審查工作區在被忽略的 `tmp/review/`，換電腦重審時核對腳本 0／0 還退出 0；要先選方案 A（進 `data/review/work/`）或 B。
   4. D-03：第三方解析 xlsx 的作者與授權查不到，卻在公開 repo 與公開網站上，只有維護者能決定去留。
   5. P-01：unittest 89.32 秒超過 1 分鐘的要求，7 條 Corruption 測試各重跑一次 PDF 抽字，推算可省 50–57 秒。
6. 查不出來：翻卡、下一題、常駐動畫的每幀成本（pane 隱藏時 rAF 不跑，要實機錄 Performance，步驟在 perf-baseline.md）；手機實機項（A-11）；`fetch_official.py` 下載（會送政府站表單，D-08）；Excel 開著來源檔時轉檔（要開宿主）；第三方 xlsx 與官方題庫的授權條款（D-03、D-04）。
<!-- 總覽:結束 -->

## 組 A 探針與測試

<!-- 組A:開始 -->

| 編號 | 大項 | 上次 | 本次 | 證據 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| R01 | 探針清點與陽性對照 | — | 黃 | ✅ 本輪實跑：unittest 24 條 OK（產品樹 141.9 s；%TEMP% 含中文、空白、括號路徑的複本 136 s）、`npm test` 16 條全過（0.33 s）、`convert.py --check` 退出 0。✅ 陽性對照全做在 %TEMP% 複本（Python 22 種、JS 15 種破壞；產品樹 46 個追蹤檔雜湊前後相同）：unittest 24 條有 23 條這輪轉紅過，第 24 條 `test_roundtrip_untouched_copy_is_identical` 是設計上的陰性對照；`npm test` 16 條全轉紅過；沒有假探針。三筆既有紀錄原樣重做都對得上：PQZ-01 放行改壞 1 紅、7249173 改壞課程篩選 3 紅、3217414 改壞前綴 2 紅。⚠️ 交付把關 E1 FAIL，CI 只跑 `npm test`（A-01）；README 寫 `npm test` 10 條、實為 16（C-02）。⚠️ `tools/review` 兩支核對腳本破壞後會印 ✗，但退出碼恆為 0（見 C-01）。⚠️ 量法：unittest 輸出是 CRLF，第一輪解析漏抓 FAIL，改正後重讀 | A-01 |
| R02 | 回歸缺口 | — | 黃 | ✅ 曾壞過的來源：問題台帳 1 列（PQZ-01）、git 標題 3 筆修正（參考檔原樣式只撈到 5d640a8，加「修」才撈到 aefc60f，陽性對照）、README 兩題來源差異、dd97eb9 窄螢幕。有探針且本輪轉紅：PQZ-01、tf-02-0332 與 mc-11-0033 不掛解析（P04、P20b）。⚠️ 沒探針：aefc60f 改星圖時把畫布寬高賦值寫進註解，星圖現在整片沒畫，瀏覽器量得緩衝區 0×0（A-02）；5d640a8 字型延後載入，改回靜態 import 時 CI 全綠（A-06）；翻卡頓只能實機（A-11）；dd97eb9 判定列本輪 320 寬量得「其實是猜的」右緣 246＝內容右緣 246，目前正常但無探針。E2、E8 PASS 是空集合通過（待驗 0、已修 0，失效模式 19） | A-02、A-06、A-11 |
| R03 | 測試覆蓋 | — | 黃 | ✅ 入口對照（陰性：不存在名稱 0 筆；陽性：pool 命中）：`tools/` 與 `web/src/lib` 46 個入口，測試引用 31 個；未引用的 15 個裡 text_of、read_toc、KNOWN_TOC_O_MISMATCH、weight 經間接路徑且破壞會紅。零測試：`diff_versions`（換成回空陣列，24 條照綠，A-10）、`convert.main` 與 `--check`（本輪手跑退出 0）、`fetch_official.main`（連網，見 D-08）、runes／starfield／textures（星圖已壞，A-02）、三個 Svelte 元件（A-09）。轉檔、核對、出題、紀錄的核心邏輯都有會紅的測試。⚠️ 存活的破壞：RTF 與 xlsx 的 1–N 連號與編號重複三處一起拿掉仍 24 條全綠（題數核對與 RTF／PDF 交叉核對兜底）；`statsByPrefix` 的上限拿掉 16 條全綠 | A-09、A-10 |
| R04 | 失敗模式 | — | 黃 | ✅ 吞錯樣式（多行 Grep，陽性樣本 7 段全中、相似字 0）產品碼 2 處：`App.svelte:41`（錯誤已先寫進 loadError，有中文提示）、`progress.js:19`（讀不到當空紀錄，README 有寫）；另 `progress.js:24` 寫入失敗回 false 被忽略，瀏覽器實測畫面沒有提示（A-04）。✅ %TEMP% 複本壞輸入 9 案：RTF 空檔、xlsx 少第二欄有中文訊息且退出 1；xlsx 少解析欄退出 1 但訊息指向審查註記（A-03）；xlsx 空檔、PDF 截斷、PDF 不見、註記 JSON 截斷只有英文堆疊（缺檔見 B-02）；第二份 JSON 唯讀時第一份已寫、留下半套；註記清空再少解析欄則退出 0、解析 1133→0、報「0 處變動」（A-03）。除唯讀那案外都沒動到產出檔。📌 沒跑：Excel 開著來源檔時轉檔（要開宿主）、網站下載失敗畫面（要另起伺服器，A-09） | A-03、A-04 |
| R05 | 產出檔的消費端 | — | 不適用 | 不適用：不產出 xlsx／docx／pptx／csv，Office 檔只當來源讀（`data/source/`）。產出物只有 `data/questions/*.json`，消費端是網站：`deck.test.js` 讀真檔、`npm run build` 解析（本輪 %TEMP% 複本 build 退出 0）；JSON 與重產一致只在本機守（A-01） | — |
| R06 | 外觀 | — | 黃 | ✅ 瀏覽器 pane 開既有 dev server（5180 被另一個 session 佔用，沿用它），字色取 computed style、紋理逐像素合成：卡面次要小字中位數 4.51、近半面積低於 4.5，與路線圖「都在 4.5 以上」不符（A-05）；Tab 會停在隱藏背面按鈕（A-07）；思源宋體缺 28 個相容字（A-08）；星圖整片沒畫（A-02）；手機實機項（A-11）。⚠️ 參考檔門檻判紅（對比不足且沒有探針守），燈號判準表判黃（字仍讀得到、不會卡住或看錯），照表判黃。⚠️ 隱藏的 pane 不跑 requestAnimationFrame（document.timeline 停住），翻卡後的狀態只能量 DOM 版面。九項見表下 | A-05、A-07、A-08、A-11 |

R06 九項：

1. 對比（含 disabled、hover、選取、placeholder）：A（A-05）。disabled 與一般同色（`.btn:disabled` 只改游標）；沒有 :hover 樣式（Grep 0 筆，同路徑陽性對照 focus-visible 命中）；沒有輸入框，placeholder 不適用；焦點框對底 5.74–11.61；已選課程框 11.61，未選框 1.95（裝飾，選取靠亮框區分）。
2. 宿主注入樣式：C（A-11）。網站不是外掛、沒有宿主；瀏覽器層的強制深色與 LINE 內建瀏覽器只能實機看，`:root` 已宣告 `color-scheme: dark`（computed 值為 dark）。
3. 深色與淺色：已涵蓋。兩種模擬各量一次，matchMedia 分別為真，9 組 computed 值完全相同（只有深色一套，定案如此）。
4. 版面：已涵蓋（桌機可量的部分）。320 與 375 寬無橫向捲動；320 寬「其實是猜的」右緣 246＝內容右緣 246；背面長內容以程式捲到底看得到最後一段；手指捲動歸 A-11。
5. 文字溢出、最小寬度、DPI：B（A-11）。320 寬按鈕 0 個被裁、課程名 1 列換行；系統字級放大與手機 DPR 在這裡模擬不了。
6. 字型缺字與 fallback：B（A-08）。
7. 焦點可見性與 Tab 順序：A（A-07）。選題頁 Tab 順序合理、焦點框可見，分段鈕除外。
8. 狀態只靠顏色：已涵蓋。判定有「答對了／答錯了」與「正／誤」印章，正解以文字列出；已選分段鈕用亮底深字、已選課程用亮框，差在亮度不只色相；前面板的綠／紅選項是輔助（揭曉要等動畫，pane 隱藏時量不到，讀碼確認）。
9. 繁中字串：已涵蓋。介面中文 423 字 cp950 全部編得出，唯一例外是分隔用的日文中點「・」（U+30FB，標點選字，不是簡體）；陽性對照「这是题库」抓到 3 字；沒有英文漏翻，只有 LINE、Chrome、Safari 專有名詞與 O／X。

組A 完成：2026-10-02 22:34

<!-- 組A:結束 -->

## 組 B 程式碼與安全

<!-- 組B:開始 -->

| 編號 | 大項 | 上次 | 本次 | 證據 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| R07 | 編碼紅線 | — | 綠 | E5 PASS（本專案 0 支 .ps1／.bat，此條空轉）。替換字元 U+FFFD 全樹 0 筆（scratchpad 陽性樣本中 1）。46 個追蹤檔扣掉 data/source 後全數可解為 UTF-8、無 BOM、無 CRLF（cp950 陽性樣本被抓到）。Python 文字讀寫 16 處全帶 encoding，RTF 以 latin-1 讀是刻意的（official.py:54）。.gitattributes 把 data/source 設 binary、題庫 JSON 固定 LF | 無 |
| R08 | 安全 | — | 綠 | 金鑰三條內容樣式與檔名樣式：追蹤檔與未忽略的未追蹤檔 0 筆（陽性樣本 7 行全中、RE_TOKEN 與 token = get_token() 未中）。注入：Python 五條 0 筆（陽性 5／5）；網頁 {@html}／innerHTML 類 src 0 筆，僅 web/prototype/card-style.html:723 插入常數 SVG。覆蓋原檔：%TEMP% 複本跑 convert.py，data/source 與 data/questions 雜湊前後相同、--check 退出 0（陽性：竄改輸出後雜湊差異抓得到）。fetch_official.py:41 依設計覆寫 data/source/official.*，兩份都過檔頭檢查才寫、git 即備份；未實跑（會下載官方檔） | 無 |
| R09 | 設定管理 | — | 黃 | 寫死路徑三條在產品碼 0 筆（陽性 3／3）；唯一常數是官方網址 fetch_official.py:16。缺 data/review/notes.json 時 convert.py 退出 0、報「0 處變動」卻拿掉 99 則審查註記，見 B-01。缺 official.rtf 時擲英文 FileNotFoundError 堆疊，見 B-02 | B-01、B-02 |
| R10 | 日誌與診斷輸出 | — | 黃 | 無 log 檔（寫 log 樣式 0 筆，陽性 2／2）。Python 預期錯誤印中文「✗」並退出 1（壞 RTF 實測：「找不到資料產生日期」退出 1），非預期錯誤只有原始堆疊、無版本與時間。網站題庫下載失敗有中文提示（App.svelte:38、105），其餘執行期例外沒有全域攔截，頁面也沒有建置版本可回報，見 B-03 | B-03 |
| R11 | git 歷史衛生 | — | 黃 | 歷史秘密兩條 ERE 0 筆（拋棄式 repo 陽性：加與刪兩個 commit 都列出）。刪除過的檔只有根目錄 1、4、8（4e57844 加、cb0b56d 刪），內容是公開法規全文，無秘密。1 MiB 以上 blob：official.rtf 7.2 MB 一份、true-false.json 約 1.2 MB 三版；JSON 進版控理由寫在 檔案結構規範.md:47，data/source 的理由沒寫，見 B-04。pack 共 2.36 MiB，遠低於 GitHub 50 MiB 警告線 | B-04 |

組B 完成：2026-10-02 22:00

<!-- 組B:結束 -->

## 組 C 結構與文件

<!-- 組C:開始 -->

| 編號 | 大項 | 上次 | 本次 | 證據 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| R12 | 目錄結構與檔案落點 | — | 紅 | ✅ E0 PASS、E11 PASS、E10 FAIL（tmp 是出口）。E10 不是假紅：`tmp/review/` 是審查工作區，被追蹤的 `tools/review/` 三支（目錄常數）、審查指示四份與 `notes.json` 24 行引用，與規範「tmp 刪了不影響任何東西」矛盾。乾淨 clone 跑 `round1_check.py` 印 0／0 退出 0，原專案印 2700／2700（陽性對照）。決策樹三檔對照各落唯一位置，審查依據與盤點產出走到第 10 題。見 S-01～S-04、S-12 | 核准第 3 批（先選方案 A／B） |
| R13 | 命名與版本化檔名 | — | 黃 | ✅ E9 PASS。`tmp/review/` 有 7 份追蹤檔的副本（S-04，diff：腳本差一行、指示相同）；`指示-第二輪.md:11` 指向 tmp 副本而非正本（S-03，內容目前相同）。規範自相矛盾：資料夾英文規則與 `docs/審查指示/`（S-09）、文件中文檔名規則與盤點產出英文檔名（S-07） | S-03、S-04 隨第 3 批；S-07、S-09 改規範 |
| R14 | .gitignore 與版控邊界 | — | 黃 | ✅ E4 PASS、E11 PASS；46 個追蹤路徑逐層比對磁碟大小寫 0 筆不符。`git check-ignore -v` 10 條該擋的全中、7 條不該擋的全沒被擋。追蹤檔最大 7.2 MB（`official.rtf`，規範刻意進版控，理由見 B-04），無憑證。缺口：`tmp/` 這行連帶擋掉審查證據，那份不在 git 歷史（S-01）；`.gitignore:21` 的 launch.json 在規範〈不進版控〉表沒有對應列（S-08） | S-08 改規範；S-01 隨第 3 批 |
| R15 | 文件長度 | — | 黃 | ✅ 12 份 .md 以 wc -l 與 Get-Content -Encoding UTF8 交叉實量，兩者全同，都在上限內：README 82／400、路線圖 38／120、規範 64／100、版本紀錄 0／12 版。未宣告型別：`CLAUDE.md`（9 行）、審查指示四份（36～76 行），見 S-10、S-11、S-14 | 補型別宣告（第 4 批） |
| R16 | 文件與程式同步 | — | 黃 | ✅ E2、E3、E7、E8 PASS。照 README〈更新題庫〉第 2 步在 %TEMP% clone 實跑 `convert.py`：兩題型都是「0 處變動」、工作樹乾淨，題數與掛解析數和 README 相同；Python 24 條 OK。不符：`npm test` 實跑 16 條、README 寫 10（C-02）；README 說沒在手機試過、路線圖說試過（C-03）；第 5 步的審查流程在乾淨 clone 跑不動且空轉（C-01）；CI 只跑網站測試（C-04） | C-01～C-04 |

組C 完成：2026-10-02 22:05

<!-- 組C:結束 -->

## 組 D 交付與相依

<!-- 組D:開始 -->

| 編號 | 大項 | 上次 | 本次 | 證據 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| R17 | 交付與安裝 | — | 黃 | ✅ 使用者端：線上站 HTTP 200，首頁引用的 `index-CSTxi_ZP.js` 與 HEAD 重建的相同。✅ 維護者端：git clone 到 `%TEMP%\盤點 (D) 試裝\採購題庫 (複本)`，`npm ci` 5 秒、`npm test` 16 條全過、`npm run build` 成功，`python -m unittest discover -s tests` 24 條全過（120 秒），`python tools/convert.py` 重產 0 處變動、工作樹乾淨。⚠️ 乾淨 venv 照 README 跑測試直接 `ModuleNotFoundError: openpyxl`：README 只寫「需 openpyxl、pypdf」，沒有安裝指令與版本（D-02）。📌 `fetch_official.py` 沒跑：它會向政府站送表單下載，本輪不送表單（D-08） | 補 Python 相依檔與安裝步驟（D-02） |
| R18 | 版本相容面 | — | 黃 | ✅ 宣告與實際沒有衝突：vite 8.3.2 要 Node `^20.19 或 >=22.12`、plugin-svelte 7.3.1 要 `^20.19、^22.12 或 >=24`，CI 與本機都是 Node 24（本機 24.16.0）。⚠️ 支援範圍沒寫明：`web/package.json` 沒有 `engines`、沒有 `requires-python`，README 只記測試環境（Python 3.11.9、Node 24），沒寫支援哪些瀏覽器，`vite.config.js` 沒設 `build.target`（D-07）。不適用：PowerShell 5.1 掃描，版控內沒有 `.ps1`／`.psm1` | 寫明支援範圍（D-07） |
| R19 | 相依版本與弱點 | — | 黃 | ✅ npm：`package-lock.json`（lockfileVersion 3）進版控、CI 用 `npm ci`，每筆都有 resolved 與 integrity；在試裝複本跑 `npm audit` 0 筆、`npm outdated` 無輸出。陽性對照：另開一個只有 lodash 4.17.15 的鎖檔，audit 報 high、outdated 列出 lodash。⚠️ Python：沒有 requirements 也沒有鎖檔；本機 pypdf 6.12.1 經 `pip-audit`（2.10.1，本機已有）查出 24 筆不重複弱點，其中 10 筆 GHSA 標 high，全是 DoS 類（無窮迴圈、吃記憶體），修正版到 6.19.0；pypdf 在 `tools/official.py:104` 讀下載來的官方 PDF。陽性對照：pypdf 3.9.0 報 87 筆。openpyxl 3.1.5、et_xmlfile 2.0.0 為 0 筆（D-01、D-02）。⚠️ 參考檔門檻判紅（high 弱點落在處理外部檔的路徑），燈號判準表判黃（只影響維護者轉檔、使用者不會卡住或看到錯的結果），照表判黃 | 釘版並升級 pypdf（D-01） |
| R20 | 授權 | — | 黃 | ✅ 網站實際發出去的第三方元件只有 svelte 執行期（MIT）與 `@fontsource/noto-serif-tc` 5.3.0（OFL-1.1）；鎖檔內 MPL-2.0 12 筆、Apache-2.0 3 筆都只在 devDependencies，沒有 GPL／AGPL。維護端 openpyxl MIT、pypdf BSD-3-Clause，不隨站發佈。⚠️ GitHub repo 是公開的、沒有 LICENSE；`web/dist` 裡沒有任何授權聲明檔（MIT 與 OFL 聲明都沒附）；第三方「題庫解析」xlsx 的作者、出處與授權在 repo 裡查不到，卻以 `data/source/*.xlsx` 進公開版控、解析文字顯示在站上（D-03）；官方題庫的再利用條款也沒有紀錄（D-04）。只標出待決，不下法律結論 | 由維護者決定第三方 xlsx 的去留（D-03） |
| R21 | 發佈與版本號流程 | — | 黃 | ✅ 版本號單一來源 `web/package.json:4`（0.1.0；`package-lock.json` 第 3、9 行由 npm 同步）。✅ 打包一步重建：CI `npm ci`、`npm test`、`npm run build`，最近 3 次 run 都 success，最新那次對到 HEAD dd97eb9，本機複本重建出的資產檔名與線上相同。⚠️ 沒有 tag（`git describe`：No names found，22 個 commit 都沒有 tag）；`docs/版本紀錄.md` 寫「尚無發行版本」，交付把關 E6 FAIL；0.1.0 沒有顯示在站上任何地方（D-05）。⚠️ 參考檔八條版本樣式合跑 0 筆，但 `web/package.json:4` 是確定存在的宣告，樣式 1 抓不到 JSON 的 `"version":` 寫法，陽性對照失敗；本輪改用補充樣式找到 | 第一次發版就打 tag、寫版本紀錄（D-05） |
| R22 | 使用者回饋管道 | — | 黃 | ⚠️ README 用回饋樣式查只中 1 行（`README.md:71` 是審查流程的「核對意見」，不是回報管道）；網站原始碼查不到聯絡方式、回報連結或 GitHub 連結。repo 有開 Issues，但站上與 README 都沒有連過去。⚠️ 版本：頁尾顯示題庫版本（`web/src/App.svelte:129`），網站本身的版本 0.1.0 與 commit 都沒顯示。⚠️ 網站沒有 log，練習紀錄只存在 localStorage，使用者拿不出診斷資料。✅ `docs/問題台帳.md` 存在，PQZ-01 有編號，但是內部查到的，不是使用者回報。綜合判黃不判紅：使用者找不到回報管道，但題庫版本看得到（D-06） | 頁尾加回報連結與網站版本（D-06） |

組D 完成：2026-10-02 22:03

<!-- 組D:結束 -->

## 組 E 效能

<!-- 組E:開始 -->

| 編號 | 大項 | 上次 | 本次 | 證據 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| R23 | 效能基準與熱點 | — | 黃 | ✅ 4 個自動類進入點這一輪都量過（`python tools/measure_perf.py --runs 5 --warmup 1`，22:40，插電、量測前 CPU 4%，沒有一列超過雜訊門檻）：`convert.py --check` 9.48 s／9.72 s，在使用者可接受的約 12 s 內；`npm test` 0.70 s；`npm run build` 2.24 s。⚠️ unittest 89.32 s／89.63 s，超過使用者要求的 1 分鐘，照使用者的指示判黃不判紅（參考檔寫的是判紅，以使用者回答為準）。主因是 Corruption 類佔 88.2%，每條都重新解析一次 PDF，而 PDF 抽字在 convert 裡就佔 69.6%（P-01～P-03）。📌 開站到首頁可按：Claude pane 代量（pane 隱藏、沒有降速）加 Fast 4G＋CPU 4 倍模型，約 0.63 s、保守估 1.7 s，在 3 s 內。⚠️ 翻卡、下一題與 CSS 常駐動畫未量測：pane 隱藏時 rAF 在 700 ms 內 0 次。⚠️ 星空現在沒畫（`starfield.js:55`），補回後的每幀成本以假設情境代量（P-09）。首頁字型實測 19 塊、858 KB，程式註解寫的 16 塊、700 KB 已過期（P-08）。熱點清單與實機抽驗步驟見 perf-baseline.md | 由使用者回編號；建議先做 P-01，再在實機依 perf-baseline.md 的步驟量翻卡與常駐動畫（星空補回後） |

組E 完成：2026-10-02 23:12

<!-- 組E:結束 -->

## 盤點紀錄

| 日期 | 綠 | 黃 | 紅 | 不適用 | 模式 | 備註 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | 2 | 19 | 1 | 1 | 子代理 | 第一次盤點；紅燈 R12（審查工作區在被忽略的 tmp/）；另查到星空回歸 A-02 |
