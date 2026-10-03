# 效能基準

> 型別：查詢型｜只增不改：每重量一次就在最後追加一輪，舊的一輪原樣留著｜由 /蘇-全面盤點 組 E 產出｜熱點編號 P-01 起，只在本輪有效｜我只回編號決定做哪幾項

1. 量測腳本：`tools/measure_perf.py`（`python tools/measure_perf.py`，預設 warmup 1 次加正式 5 次）。改完熱點要用同一支、同一組參數重量，量法不改，新進入點只加新段。
2. 檔名與位置跟規範衝突，由組 C 的 S-07 處理（[structure-plan.md](structure-plan.md)）：
   1. 本檔：`docs/檔案結構規範.md` 命名第 1 條要中文檔名，「新檔案放哪」第 9 題也沒有這類文件。本檔沿用盤點 skill 固定的檔名，跨輪對照才接得上。
   2. 量測腳本：skill 預設放 `scripts/`，但規範禁止新增頂層資料夾，所以放 `tools/`，符合第 7 題「維護用的腳本」。
3. 標記：`✅` 本機實測，`⚠️` 已知限制，`📌` 未查證或模型推算。

## 第 1 輪：2026-10-02（首次基準，沒有改任何東西）

### 量測環境

1. 機器：LAPTOP-JI7EEVA5，16 個邏輯核心，Windows 11（`platform` 回報 10.0.26200）。插電、電量 100%，電源計畫「平衡」。
2. 版本：dd97eb9（2026-10-02 21:47）。未 commit 的 4 個檔都是盤點產出，不影響受測程式。
3. 組態：Python 3.11.9 一般執行（沒有 `-X dev`）；Node v24.16.0、npm 11.13.0；vite 8.3.2 的 production 建置。
4. 背景負載：盤點 A～D 組已收工，主線不跑重的指令。腳本量測前 CPU 負載 4%、量測後 22%。
5. 取樣：腳本段 warmup 1 次不計、正式 5 次。瀏覽器段同樣 1 次 warmup、5 次正式，每次都重新載入頁面。
6. 輸入：
   1. `data/source/`：`official.rtf` 6.88 MB；`official.pdf` 905 KB、244 頁；`true-false.xlsx` 405 KB；`multiple-choice.xlsx` 297 KB。
   2. `data/questions/`：是非題 2,686 題（JSON 1.15 MB）、選擇題 913 題（698 KB）。
   3. `data/review/notes.json`：99 則。
7. ⚠️ 星空現在沒有畫：`web/src/lib/starfield.js:55` 的 `W = innerWidth; H = innerHeight;` 被行尾註解吃掉（aefc60f 起），畫布一直是 0×0。下面常駐動畫的「現況」數字都是在這個壞掉的狀態量的。「星空補回後」是用 scratchpad 裡補回賦值的副本代量的假設情境，產品碼沒有改。
8. 瀏覽器代量：使用 Claude 內建瀏覽器 pane，行動版模擬 375×812、DPR 2、Android Chrome UA，對象是線上站 https://sodack87.github.io/ProcQuiz/ 。✅ 線上資產檔名（如 `index-CSTxi_ZP.js`）與本機 dd97eb9 的建置相同。
   1. ⚠️ 量測時 pane 是隱藏狀態：`document.hidden` 為 true，rAF 在 700 ms 內一次都沒跑，`document.timeline` 停在 0。所以頁面不繪製、沒有動畫幀，翻卡、下一題、CSS 常駐動畫都量不到。
   2. ⚠️ pane 沒有網路與 CPU 降速功能，Fast 4G 加 CPU 4 倍降速用模型換算（見〈模型換算〉）。
   3. ✅ Fast 4G 參數取自 Chromium devtools-frontend 的 `front_end/core/sdk/NetworkManager.ts`：下行 9 Mbps × 0.9 = 1,012,500 B/s，每個請求延遲 60 ms × 2.75 = 165 ms。
9. ⚠️ 剖析器：只有標準庫的 cProfile 可用；py-spy、scalene、memray、pyinstrument 都沒裝，本輪也沒裝（新增相依要先問），所以退回埋點計時。

### 入口清單

使用者預期一欄是使用者 2026-10-02 的回答。

| 進入點 | 觸發方式 | 使用者預期等多久 | 要不要開宿主 | 本輪 |
| --- | --- | --- | --- | --- |
| `python tools/convert.py`（量 `--check`，寫檔版會動到受版控的 JSON，不跑） | 官方換版時 | 約 12 秒可接受 | 否 | ✅ 已量 |
| `python -m unittest discover -s tests` | 改 tools 之後 | 1 分鐘內 | 否 | ✅ 已量，超過要求 |
| `npm test`（在 `web/`） | 改網站後；CI 每次 push | 沒有要求 | 否 | ✅ 已量 |
| `npm run build`（輸出到暫存資料夾，量完即刪） | 同上 | 沒有要求 | 否 | ✅ 已量 |
| 開站到首頁可按 | 手機開網址 | 4G 下 3 秒內（Fast 4G＋CPU 4×） | 瀏覽器 | 代量＋模型 |
| 題庫背景下載 | 開站後自動 | 按開始之前到就好 | 瀏覽器 | 大小已量，時間用模型 |
| 按「開始練習」到第一張卡 | 點按鈕 | 不掉幀 | 瀏覽器 | 代量（不含繪製） |
| 作答翻卡 | 點答案 | 不掉幀 | 瀏覽器 | ⚠️ 未量測：pane 隱藏、沒有動畫幀 |
| 按「下一題」 | 點按鈕 | 不掉幀 | 瀏覽器 | ⚠️ 未量測，原因同上；出題邏輯另在 Node 代量 |
| 常駐動畫（星空、卡面流光、符文、火花） | 一直在跑 | 不掉幀，且要算耗電與發燙 | 瀏覽器 | 星空每幀成本已代量；CSS 動畫未量測，原因同上 |
| `tools/fetch_official.py` | 換版時 | — | 否 | 不量：要連政府網站，屬外部相依 |
| CI 發布（`.github/workflows/pages.yml`） | push main | — | 否 | 不量：在 GitHub 雲端跑；要看可用 `gh run list` 讀歷次耗時 |
| `tools/review/*.py` | 審查輪次 | — | 否 | 不量：審查已結束，`round2_*` 還會覆寫 tmp/review |
| `npm run dev` | 本機預覽 | — | 瀏覽器 | 不量：開發用的常駐伺服器 |

### 腳本輸出（`python tools/measure_perf.py --runs 5 --warmup 1`）

量測時間 2026-10-02 22:40，總耗時 1,212 s。數字照腳本輸出，沒有改動；為了好讀，重複的輸入描述改成「同上」，網站列的進入點名稱縮短。表中沒有任何一列被標「環境有噪音」（最大值都沒超過中位數兩倍）。

| 熱點 | 所屬進入點 | 中位數／最大值 | 取樣次數 | 佔該進入點總時間比例 | 輸入檔大小筆數 |
| --- | --- | --- | --- | --- | --- |
| Python 啟動（python -c pass） | 空跑底線 | 62.5 ms／63.4 ms | 5 | — | — |
| Node 啟動（node -e 0） | 空跑底線 | 56.7 ms／57.3 ms | 5 | — | — |
| npm 啟動（npm --version） | 空跑底線 | 346.0 ms／358.7 ms | 5 | — | — |
| convert.py --check 端到端 | tools/convert.py | 9.48 s／9.72 s | 5 | — | 見〈量測環境〉第 6 條 |
| import convert（含 openpyxl） | tools/convert.py | 318.2 ms／320.0 ms | 5 | 3.4% | 同上 |
| import pypdf | tools/convert.py | 104.3 ms／107.2 ms | 5 | 1.1% | 同上 |
| read_rtf：RTF 解析 | tools/convert.py | 571.4 ms／581.5 ms | 5 | 6.0% | 同上 |
| read_pdf_answers：PDF 抽字 | tools/convert.py | 6.59 s／6.80 s | 5 | 69.6% | 同上 |
| cross_check：RTF 與 PDF 逐題比對 | tools/convert.py | 0.633 ms／0.751 ms | 5 | 0.0% | 同上 |
| read_xlsx：是非題解析 xlsx | tools/convert.py | 1.08 s／1.12 s | 5 | 11.4% | 同上 |
| read_xlsx：選擇題解析 xlsx | tools/convert.py | 318.4 ms／336.1 ms | 5 | 3.4% | 同上 |
| apply_review：掛審查註記 | tools/convert.py | 5.544 ms／6.269 ms | 5 | 0.1% | 同上 |
| check_duplicates：同題答案一致 | tools/convert.py | 39.8 ms／40.3 ms | 5 | 0.4% | 同上 |
| build 其餘：題文配對與組裝 | tools/convert.py | 85.5 ms／88.7 ms | 5 | 0.9% | 同上 |
| render 與已提交 JSON 比對 | tools/convert.py | 38.0 ms／39.0 ms | 5 | 0.4% | 同上 |
| 子行程內分段外其餘（直譯器啟動等） | tools/convert.py | 201.2 ms／222.8 ms | 5 | 2.1% | 同上 |
| 端到端減分段子行程（中位數相減） | tools/convert.py | 97.0 ms | 1 | 1.0% | 同上 |
| （分段子行程總時間） | tools/convert.py | 9.38 s／9.55 s | 5 | — | 同上 |
| python -m unittest discover -s tests 端到端 | unittest | 89.32 s／89.63 s | 5 | — | 24 條測試，輸入同上 |
| 類別 Corruption | unittest | 78.80 s／80.24 s | 5 | 88.2% | 同上 |
| 類別 OfficialCrossCheck | unittest | 21.9 ms／27.5 ms | 5 | 0.0% | 同上 |
| 類別 Output | unittest | 1.61 s／1.65 s | 5 | 1.8% | 同上 |
| 類別 PureFunctions | unittest | 0.270 ms／0.443 ms | 5 | 0.0% | 同上 |
| 類別 ReviewNotes | unittest | 17.0 ms／17.9 ms | 5 | 0.0% | 同上 |
| 探索、setUpClass 與測試之間 | unittest | 7.86 s／7.95 s | 5 | 8.8% | 同上 |
| 子行程內分段外其餘（直譯器啟動等） | unittest | 224.0 ms／236.9 ms | 5 | 0.3% | 同上 |
| 端到端減分段子行程（中位數相減） | unittest | 802.5 ms | 1 | 0.9% | 同上 |
| （分段子行程總時間） | unittest | 88.51 s／90.11 s | 5 | — | 同上 |
| npm test 端到端 | npm test | 696.7 ms／716.0 ms | 5 | — | 16 條測試，讀真的題庫 JSON |
| 測試：首頁用題號前綴算的進度，與用整份題庫算的相同 | npm test | 18.3 ms／19.3 ms | 5 | 2.6% | 同上 |
| 測試：首頁的課程清單（建置時產生）與題庫一致：題數、題號前綴 | npm test | 17.5 ms／17.8 ms | 5 | 2.5% | 同上 |
| 測試：加權抽題：錯題出現次數遠多於熟練題，沒作答的介於中間 | npm test | 14.8 ms／15.5 ms | 5 | 2.1% | 同上 |
| 其餘 13 條測試 | npm test | 12.7 ms／14.0 ms | 5 | 1.8% | 同上 |
| 子行程內分段外其餘（直譯器啟動等） | npm test | 184.1 ms／185.2 ms | 5 | 26.4% | 同上 |
| 端到端減分段子行程（中位數相減，即 npm run 包裝） | npm test | 450.2 ms | 1 | 64.6% | 同上 |
| （分段子行程總時間） | npm test | 246.5 ms／249.6 ms | 5 | — | 同上 |
| npm run build 端到端（輸出到暫存資料夾） | npm run build | 2.24 s／2.38 s | 5 | — | 題庫 JSON 兩包＋字型 @fontsource |
| vite 自報 built in（轉換與打包） | npm run build | 734.0 ms／879.0 ms | 5 | 32.8% | 同上 |
| npm／node 啟動與設定載入（端到端扣 vite 自報） | npm run build | 1.51 s／1.53 s | 5 | 67.2% | 同上 |
| bank-index 外掛：解析兩包題庫＋抽課程清單 | npm run build | 4.673 ms／4.740 ms | 5 | 0.2% | JSON 1.15 MB＋698 KB |
| 題庫到手後 JSON 解析（是非，代理指標） | 網站（Node 代量）：題庫下載完成 | 1.790 ms／1.807 ms | 5 | 量不到 | 1.15 MB；瀏覽器實際是執行 JS chunk |
| byId 對照表（App.svelte:29） | 網站（Node 代量）：題庫下載完成 | 0.721 ms／0.791 ms | 5 | 量不到 | 2,686 題 |
| 第一次出題 draw（冷啟動） | 網站（Node 代量）：按開始練習 | 1.264 ms／1.550 ms | 5 | 量不到 | 紀錄滿載：3,599 題都作答過、紀錄 138 KB、是非錯題 1,507 題 |
| 出題 draw：全部模式 | 網站（Node 代量）：按下一題 | 0.249 ms／0.258 ms | 5 | 量不到 | 同上 |
| 出題 draw：錯題模式（兩次 pool） | 網站（Node 代量）：按下一題 | 0.264 ms／0.268 ms | 5 | 量不到 | 同上 |
| stats()：作答後重算範圍統計 | 網站（Node 代量）：作答 | 0.114 ms／0.117 ms | 5 | 量不到 | 同上 |
| save()：JSON.stringify 整份紀錄（不含 localStorage 寫入） | 網站（Node 代量）：作答 | 1.095 ms／1.181 ms | 5 | 量不到 | 同上 |
| load()：讀回紀錄 | 網站（Node 代量）：開站 | 1.408 ms／1.455 ms | 5 | 量不到 | 同上 |
| 首頁課程清單 15 列 statsByPrefix | 網站（Node 代量）：開站、回首頁 | 5.463 ms／5.626 ms | 5 | 量不到 | 同上 |

網站那幾列的佔比量不到，因為瀏覽器端（排版、繪製）沒有一起量。Node 跑在桌機的 V8，不等於手機，只拿來比相對大小。

建置產出大小（腳本以 zlib 等級 6 估 gzip；線上實際大小見下一節）：

| 項目 | 檔數 | 原始 | gzip 估 |
| --- | --- | --- | --- |
| 首屏關鍵路徑（index.html＋入口 js／css） | 3 | 79 KB | 29 KB |
| 是非題題庫 chunk（背景下載） | 1 | 1011 KB | 200 KB |
| 選擇題題庫 chunk（背景下載） | 1 | 613 KB | 151 KB |
| 字型 CSS 400＋700（題庫到手後載入） | 2 | 258 KB | 106 KB |
| 字型切片 woff2（只抓用到的 unicode-range） | 208 | 5.83 MB | 5.84 MB |
| 字型切片 woff（舊格式備援，新瀏覽器不抓） | 210 | 7.34 MB | 7.33 MB |
| dist 全部（部署上傳量） | 425 | 15.09 MB | 13.65 MB |

### 瀏覽器代量（Claude pane，2026-10-02 22:45 前後）

這一節的數字不是腳本產生的，量法寫在每一列。數字都是桌機 CPU、沒有降速。

| 項目 | 中位數／最大值 | 取樣 | 量法 |
| --- | --- | --- | --- |
| ✅ 首屏 CPU：DCL 減 HTML 收完（含快取 JS 解析與執行、Svelte 掛載，不含排版與繪製） | 33 ms／52 ms | 5 | 每次換 query 重新載入，讀 Navigation Timing |
| ✅ 首屏 TTFB（真實網路，本機 Wi-Fi） | 70 ms／540 ms | 5 | 同上。⚠️ 最大值超過中位數兩倍，是網路雜訊，不拿來判斷 |
| ✅ 按「開始練習」到卡片 DOM 與版面完成（不含繪製） | 24.5 ms／28.7 ms | 5 | 題庫到手後 `click()`，等 microtask 與一個 MessageChannel 任務，再強制 `getBoundingClientRect`。其中 script 5.7 ms／8.9 ms，版面 16.4 ms／23.2 ms |
| ✅ 開站烘焙 5 張紋理（DPR 2，牆鐘，含解碼與 PNG 編碼） | 146 ms／155 ms | 5 | 頁內跑 `textures.js` 的同一段做法。主緒上同步的 drawImage 合計只有 1.2 ms／1.6 ms；warmup 那次 1,088 ms（第一次初始化） |
| ✅ 星空每幀，現況（0×0 畫布） | 低於 0.1 ms／0.5 ms | 5 次 × 300 格 | 頁內載入原樣副本，直接呼叫 `loop()`。計時器解析度是 0.1 ms |
| 📌 星空每幀，補回後，只算 JS（GPU canvas） | 0.2 ms／1.6 ms，p95 0.3–0.4 ms | 5 次 × 300 格 | 假設情境：頁內載入補回賦值的副本，畫布 562×1218、90 顆星 |
| 📌 星空每幀，補回後，JS＋CPU 點陣化（上界） | 1.3 ms／7.8 ms，p95 2.1–2.4 ms | 5 次 × 300 格 | 同上，改用 `willReadFrequently` 的軟體 canvas，每格 `getImageData` 一次逼它畫完。5 次的中位數落在 1.2–1.3 ms，最大值是單格離群值 |

⚠️ 量法修正：原本每格用 GPU canvas 加 `getImageData` 逼它畫完，得到 34 ms。但只畫一個 8 px 小圖的對照組就要 6.4 ms，可見那 34 ms 主要是 GPU 回讀的同步等待，不是畫的成本，這個量法已作廢，改成上表的軟體 canvas 上界。

✅ 線上實際傳輸大小：GitHub Pages 回 `content-encoding: gzip`、`cache-control: max-age=600`，數字取自 Resource Timing 的 encodedBodySize。

| 資源 | 實際傳輸 |
| --- | --- |
| HTML | 728 B |
| 入口 JS ＋ CSS | 26,220 ＋ 3,391 B |
| 是非題題庫 chunk | 209,712 B |
| 選擇題題庫 chunk | 158,632 B |
| 字型 CSS 400 ＋ 700 | 54,391 ＋ 54,469 B |
| 首頁字型切片 | 19 塊、858 KB（400 粗細 12 塊 534 KB，700 粗細 7 塊 324 KB） |

`web/src/App.svelte:43` 的註解寫「首頁就要 16 塊、約 700 KB」，與實測對不上，那個數字已經過期。

### 模型換算：Fast 4G＋CPU 4 倍

📌 以下都是模型推算，不是實測。網路用上面的 Fast 4G 參數，CPU 時間直接乘 4，沒有算繪製（pane 隱藏量不到）。

1. 首頁可按 ≈ 0.63 s，保守估 1.7 s，低於使用者要的 3 s。
   1. 一般估：HTML 166 ms、入口 JS 與 CSS 194 ms、CPU 4×(33＋16) ≈ 198 ms、本機 TTFB 70 ms。首屏版面成本用「開始練習」實測的版面 16 ms 代入。
   2. 保守估：CPU 用最大值 4×(52＋23)、TTFB 用最大值 540 ms，再加首次連線 3 個 165 ms。
2. 題庫到手 ≈ 首頁可按之後 0.37 s。按「開始練習」時還沒下載完的機率低。
3. 字型換上 ≈ 題庫之後再 1.3 s，也就是開站後約 2.3 s 文字從系統字型換成思源宋體：CSS 273 ms，加 19 塊切片 1,033 ms。
4. 開始練習到出現卡片 ≈ 98 ms（最大 115 ms），還沒算繪製。
5. 星空補回後每幀：只算 JS 是 0.8 ms，每秒 60 幀約佔 4.8% 單核；含 CPU 點陣化的上界 5.2 ms，約佔每幀 16.7 ms 預算的 31%，連續跑約 31% 單核。手機 2D canvas 通常走 GPU，實際會落在這兩個數字之間；GPU 時間量不到。

### 熱點清單

優先級判準是「使用者實際等待時間 × 發生頻率」。

| 編號 | 熱點 | 所屬進入點 | 實測中位數／最大值 | 取樣次數 | 佔該進入點總時間比例 | 使用者感覺得到嗎（等待 × 頻率） | 疑似原因 | 建議改法 | 預估改善幅度 | 改動風險 | 要不要開宿主 | 狀態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | Corruption 類 7 條破壞型測試，每條都重跑整個 build | unittest | 78.80 s／80.24 s | 5 | 88.2% | 感覺得到：每次改 tools 全套要等 89 s，超過使用者要的 60 s | 每條各解析一次 6.88 MB RTF 與 244 頁 PDF（`tests/test_convert.py:178-268`），各條 7.7–10.4 s，第一條含 `built()` 為 20.3 s | 依檔案內容雜湊快取 RTF 與 PDF 的解析結果，只有真的改了 RTF 的那條才重新解析 | 📌 推算：整輪 PDF 抽字從 9 次降到 1 次、RTF 解析從 9 次降到 2 次，約省 50–57 s（含 P-03）。改完用同一腳本重量才算數 | 中：快取鍵必須含檔案內容，否則破壞型測試會讀到未破壞的快取而假綠；要重做 `test_rtf_answer_changed_on_disk_is_caught_by_pdf` 的陽性對照 | 否 | 已量 |
| P-02 | `read_pdf_answers` 用 pypdf 逐頁抽字 | convert，同時是 P-01 與 P-03 的主成本 | 6.59 s／6.80 s | 5 | 69.6% | convert 等 9.5 s 使用者可接受；但它在 unittest 裡會跑 9 次 | `extract_text()` 對 244 頁做完整抽字，其實只要每題第一行的「編號＋答案」（`tools/official.py:101-105`） | 先量 pypdf 的其他抽字模式；換別的抽字套件屬新增相依，要先問 | 未知 | 中：PDF 是交叉核對的第二來源，抽法一變就要重做「RTF 改答案會被 PDF 抓到」的陽性對照 | 否 | 已量 |
| P-03 | OfficialCrossCheck 的 setUpClass 又解析一次 RTF 與 PDF | unittest | 7.86 s／7.95 s | 5 | 8.8% | 併入 P-01 | `tests/test_convert.py:155-159` 沒有共用 `built()` 已經解析過的結果 | 與 `built()` 共用同一份解析結果 | 📌 推算約 7 s | 低 | 否 | 已量 |
| P-04 | 是非題 xlsx 用 openpyxl 一般模式載入 | convert | 1.08 s／1.12 s | 5 | 11.4% | 不太會：convert 整體使用者可接受；在 unittest 裡每條 Corruption 也各讀一次 | `tools/xlsx_bank.py:94` 的 `load_workbook` 沒開 `read_only`，會建出整個物件模型 | `read_only=True` | 未知（📌 沒量過） | 低～中：唯讀模式的 cell 少部分屬性，`xlsx_bank.py:114` 的錯誤訊息用到 `row[0].row`，要先驗證 | 否 | 已量 |
| P-05 | `read_rtf` 用正則逐 token 解析 | convert | 571.4 ms／581.5 ms | 5 | 6.0% | 不會 | `tools/official.py:22-49` 對 6.88 MB 字串逐 token 跑 Python 迴圈 | 目前不建議動 | 未知 | 中：是主來源解析器 | 否 | 已量 |
| P-06 | build 端到端扣掉 vite 自報的時間（npm 包裝加 vite／rolldown 載入，還沒拆開） | npm run build | 1.51 s／1.53 s | 5 | 67.2% | 不會：使用者對 build 沒有要求 | npm CLI 啟動約 0.35 s（見底線），其餘在載入建置工具 | 不建議（照現況記基準） | — | — | 否 | 已量 |
| P-07 | `npm run` 的包裝開銷 | npm test | 450.2 ms（中位數相減） | 5 | 64.6% | 不會：使用者對 npm test 沒有要求 | npm CLI 啟動加 shell | 不建議（CI 與文件都用 `npm test`） | — | — | 否 | 已量 |
| P-08 | 首頁字型 19 塊、858 KB | 開站（題庫之後） | 858 KB（定值）；📌 換上字型約在開站後 2.3 s | 1 | 量不到 | 可能：慢網路下約 2.3 s 時文字從系統字型換成思源宋體、版面跳一下，行動網路流量也大 | 首頁的字橫跨 19 個 unicode-range 切片，400 與 700 兩種粗細各抓一套（`web/src/App.svelte:46-51`） | 用到 700 粗細的字很少，可考慮改用合成粗體或子集化 | 📌 推算可省 700 粗細的 324 KB | 低～中：外觀會變，要使用者看過 | 瀏覽器 | 代量（大小已量，時間是模型） |
| P-09 | 星空修好之後的每幀成本 | 常駐動畫 | JS 0.2 ms／1.6 ms；JS＋CPU 點陣化上界 1.3 ms／7.8 ms | 5 次 × 300 格 | 量不到 | 要實機看：上界乘 4 後每幀 5.2 ms、約 31% 單核；1443ad8「手機實測翻卡不再頓」是在星空沒畫的期間測的 | 每格 90 次 drawImage 加 lighter 合成，畫在全螢幕 DPR 1.5 的 canvas 上（`web/src/lib/starfield.js:60-95`） | 補回 `:55` 之後先在實機重測翻卡；真的發燙再考慮降到 30 幀、把星星烘成靜態底圖只畫連線與流星，或閒置時停掉 rAF | 未知 | 低 | 瀏覽器 | 代量（假設情境） |

#### 不值得做

1. convert 的小段：cross_check 0.0%、apply_review 0.1%、check_duplicates 0.4%、render 與比對 0.4%、build 其餘 0.9%、import pypdf 1.1%、子行程其餘 2.1%、import convert 3.4%、選擇題 read_xlsx 3.4%，各段都不到 5%。
2. unittest 的其他類別：Output 1.8%，PureFunctions、ReviewNotes、OfficialCrossCheck 的測試本體都是 0.0%。真正的成本在 P-01 與 P-03。
3. npm test 的各條測試都不到 3%。
4. bank-index 外掛只佔 build 的 0.2%（4.7 ms）。
5. 網站純邏輯（Node 代量）：出題 0.25 ms、stats 0.11 ms、save 1.1 ms、load 1.4 ms、首頁 15 列 5.5 ms、byId 0.7 ms、題庫解析 1.8 ms。乘 4 後最大的也只有約 22 ms，在 100 ms 回應與每幀預算之內。
6. 星空回歸本身的效能面：每格低於 0.1 ms。它是功能缺陷（看不到星空），由組 A 追，效能上不用處理。
7. 紋理烘焙：牆鐘 146 ms，但在 DCL 之後非同步跑，不擋「可按」；主緒同步只有 1–2 ms。
8. 開始練習到出現卡片：24.5 ms，乘 4 約 98 ms，在 100 ms 內。
9. 首屏 CPU 33 ms，乘 4 後模型的首頁可按約 0.63 s，在 3 s 內。

#### 量不到的部分

1. 作答翻卡、下一題的掉幀，以及 CSS 常駐動畫（`CardFace.svelte:62-65` 流光、`:19-25` 每面 28 個符文、`:112` 火花的 drop-shadow，`QuizCard.svelte:166-168` 光暈）。
   1. 原因：pane 隱藏時 rAF 與 `document.timeline` 都停住，動畫不會前進；`next()` 等的 `animation.finished` 也永遠不會 resolve。
   2. pane 沒有 CPU 與網路降速；GPU 合成與點陣化的時間在頁內 JS 拿不到。
   3. 替代判斷：照下面的步驟在 DevTools 或實機量。
2. 使用者實機抽驗步驟（只有使用者能做）：
   1. 桌機 Chrome 開 https://sodack87.github.io/ProcQuiz/ ，F12 → Network 勾 Disable cache、節流選 Fast 4G；Performance 面板齒輪的 CPU 選 4x slowdown；按 Ctrl+Shift+E 重新整理並錄製。看「開始練習」按鈕出現的時間（Screenshots 列或 LCP）是否在 3 s 內，並記下字型換上的時間。
   2. 同樣設定錄製：按開始練習，作答再按下一題，重複 3 次。看 Frames 列有沒有紅色或黃色的掉幀，Main 有沒有超過 50 ms 的長任務。
   3. 常駐動畫：停在首頁、卡片各 10 秒不動並錄製，記下 Summary 裡 Scripting＋Rendering＋Painting 佔總時間的比例，作為閒置 CPU 佔用。星空修好之後再錄一次比較。
   4. 實機：Android 手機開 USB 偵錯，桌機 `chrome://inspect` 連上後照 1–3 錄製；另外練 10 分鐘，看設定裡電池用量中瀏覽器的耗電與機身溫度。

## 第 2 輪：2026-10-02 23:30（改 P-01）

改了什麼：`tests/test_convert.py` 以「PDF 內容雜湊＋課程名」為鍵快取 `read_pdf_answers` 的結果，P-03 一併受惠（產品碼未動）。同一輪另加 4 條測試（PDF 快取守門 1 條、審查核對腳本 3 條），全套由 24 條變 28 條。
量法：同一支腳本 `python tools/measure_perf.py --runs 5 --warmup 1 --only baseline,unittest`，版本 cc0607e 加未 commit 的 P-01。⚠️ 量測前 CPU 負載 54%、量後 35%，比第 1 輪的 4% 吵；Output 類最大值超過中位數兩倍。

| 熱點 | 第 1 輪中位數／最大值 | 第 2 輪中位數／最大值 | 判讀 |
| --- | --- | --- | --- |
| unittest 端到端 | 89.32 s／89.63 s | 36.79 s／40.58 s | 走出雜訊帶（第 2 輪最大值仍低於第 1 輪最小值一半），低於使用者要的 60 s |
| Corruption 類 | 78.80 s／80.24 s | 33.37 s／34.54 s | 佔 90.7%；剩下的是每條各自的 RTF 與 xlsx 解析（P-04、P-05） |
| OfficialCrossCheck 類（含 setUpClass） | 7.86 s（setUpClass 等）| 29.0 ms／33.8 ms | P-03 併入 P-01 解掉 |
| 空跑底線 Python／Node／npm | — | 63.2 ms／55.0 ms／357.7 ms | 供下一輪對照 |

P-01、P-03 狀態改為已改善；P-02、P-04～P-09 不變。

## 第 3 輪：2026-10-03（網站效能掃描，只量測、沒有改程式）

範圍只有網站：首屏、題庫載入、字型、翻卡、下一題、常駐動畫。Python 的 convert 與 unittest 這輪沒有動到，不重量。熱點編號 P-01 起重新配發，只在本輪有效，跟第 1 輪的 P-01～P-09 無關。

### 量測環境

1. 版本：c083012。腳本段用 `git archive` 解到 `%TEMP%` 的乾淨快照（`web/node_modules` 以 junction 共用，量完已移除），不受另一個 session 當時未 commit 的重點字改動影響；瀏覽器段量線上站，GitHub Actions 已部署 c083012。量完時 main 已多一個未 push 的 38be386（重點字），本輪數字不含它，行號則對照 38be386。
2. ⚠️ 背景負載高：腳本量測前 CPU 45%、量後 60%（第 1 輪 4%）。空跑底線也一起變慢（Node 啟動 +11%、npm 啟動 +37%），所以下表各段多出的 10–40% 是環境雜訊，不是退化。
3. 瀏覽器：Claude 內建 pane，375×812、DPR 2、Android Chrome UA，桌機 CPU 沒有降速。✅ 這輪 pane 是顯示中的，rAF 正常跑，翻卡、下一題、常駐動畫第一次量得到。⚠️ 螢幕更新率 165 Hz，每幀預算 6.06 ms，比手機的 16.7 ms（60 Hz）或 8.3 ms（120 Hz）嚴，所以下面用「超過 8 ms 的幀」當掉幀指標。
4. 主緒佔用的量法：頁內用 MessageChannel 連續排 1 ms 的忙迴圈，數 N 秒內排進幾塊，佔用率 = 1 − 排進的毫秒數 ÷ N。這個數字包含 JS、樣式、版面、繪製記錄這些在主緒上跑的工作，不含 GPU 與合成緒。A／B 一律在同一個頁面內交錯量，降低漂移的影響。
5. 原始輸出：`%TEMP%\pqz-perf-r3-out.md`、`%TEMP%\pqz-perf-r3-raw.json`（不進 repo）。

### 腳本輸出對照（`python tools/measure_perf.py --runs 5 --warmup 1 --only baseline,npmtest,build,web`）

| 熱點 | 第 1 輪中位數 | 第 3 輪中位數／最大值 | 判讀 |
| --- | --- | --- | --- |
| Node 啟動（空跑底線） | 56.7 ms | 62.8 ms／65.5 ms | +11%，環境變慢的基準 |
| npm 啟動（空跑底線） | 346.0 ms | 473.6 ms／768.4 ms | +37%，最大值超過中位數 1.6 倍，雜訊大 |
| npm test 端到端 | 696.7 ms | 866.3 ms／1.15 s | 16 條變 17 條；幅度跟空跑底線同級 |
| npm run build 端到端 | 2.24 s | 3.14 s／3.35 s | vite 自報 734 → 978 ms，同上 |
| 題庫 JSON 解析（Node 代量） | 1.790 ms | 2.400 ms／4.108 ms | 同上 |
| 首頁 15 列 statsByPrefix（Node 代量） | 5.463 ms | 7.210 ms／7.662 ms | 同上 |
| 建置產出大小 | — | 跟第 1 輪逐列相同 | 首屏 29 KB、是非 chunk 200 KB、選擇 chunk 151 KB（gzip 估） |

### 瀏覽器實測（線上站 c083012）

| 項目 | 中位數（範圍） | 取樣 | 跟第 1 輪比 |
| --- | --- | --- | --- |
| ✅ 首屏 FCP | 196 ms（160–296） | 5 | 第 1 輪 pane 隱藏、量不到 |
| ✅ 首屏 CPU（DCL 減 HTML 收完） | 48 ms（45–60） | 5（另一組 5 次為 62 ms） | 第 1 輪 33 ms；⚠️ 這輪 pane 顯示中會穿插繪製，加上背景負載，不能直接比 |
| ✅ 首頁字型切片 | 20 塊、898 KB（400 粗細 12 塊 547 KB，700 粗細 8 塊 350 KB） | 1 | 第 1 輪 19 塊、858 KB |
| ✅ 首頁閒置的主緒佔用 | 9.7%（8.2–11.5） | 5 × 3 s | 停掉星空後 0.2%，也就是首頁閒置的主緒成本幾乎都是星空 |
| ✅ 卡片閒置的主緒佔用 | 29.1%（28.2–34.9） | 5 × 3 s | 75 個 CSS 動畫在跑：符文 56、火花 10、金墨 6、流光 2、光暈 1，兩面合計 |
| ✅ 卡片閒置分解 | 全開 36.4%；CSS 全停只留星空 12.7%；只開符文 24.3%；符文以外全開 21.2% | 各 3 × 2.5 s | 星空約 10 點、符文約 11 點、其他 CSS 動畫約 9 點 |
| ✅ 星空每幀 JS（GPU canvas） | 0.1 ms，p95 0.2–0.3 ms | 5 × 300 格 | 第 1 輪假設情境 0.2 ms，這輪是修好後的現況（cf0db1f） |
| 📌 星空每幀 JS＋CPU 點陣化上界 | 1.9 ms（1.8–2.0），p95 3.0–3.3 ms | 5 × 300 格 | 第 1 輪 1.3 ms，量法相同 |
| ✅ 按「開始練習」後的前 5 幀 | 超過 8 ms 的幀合計 73 ms（61–79），最長一幀 37 ms（36–43） | 5 次冷載 | 每次都是第 3、4 幀變長；原因要 DevTools trace 才拆得開 |
| ✅ 作答翻卡 1.2 s 內超過 8 ms 的幀 | 16 格、合計 206 ms，最長 12–73 ms | 6 次 | 另有 5 次整段掉到每秒 15–35 幀，A 組與 B 組同樣發生，判定為環境干擾，不計 |
| ✅ 按「下一題」1.5 s 內超過 8 ms 的幀 | 1–10 格，最長 12–24 ms | 3 次 | — |
| ✅ 紋理烘焙 5 張（DPR 2，牆鐘） | 206 ms（187–235），主緒同步 1.8 ms | 5 | 第 1 輪 146 ms。⚠️ pane 隱藏時 toBlob 每張會被延到約 1,030 ms，那時的數字作廢 |
| ✅ 是非題 chunk：import（compile＋執行） | 26.3 ms（20–31） | 8 | 對照組：同內容 fetch＋`r.json()` 14.1 ms（11–18），只算 JSON.parse 1.3 ms |

### 同頁 A／B（線上頁面裡暫時注入 CSS 或暫停動畫，產品碼沒有改）

| 試驗 | A：現況 | B：改法 | 取樣 |
| --- | --- | --- | --- |
| 翻卡期間替 `.shade`、`.sheen`、`.sheen b`、`.floor` 加 will-change | 超過 8 ms 的幀 16 格、合計 206 ms | 1.5 格、合計 18 ms | 各 6 次有效，交錯進行 |
| 卡片落定後暫停背面 37 個動畫 | 33.2%（32.1–34.0） | 26.1%（24.7–26.6） | 各 3 組 |
| 星空限 60 fps（165 Hz 螢幕上） | 34.3%（33.7–35.0） | 26.9%（25.4–27.6） | 各 3 組 |
| 符文 keyframes 裡的 `var()` 改寫死成 .42／1 | 39.0%、33.6% | 46.4%、33.4% | 各 2 組；差異落在雜訊內，判定沒效果 |

### 熱點清單

依「使用者實際感受 × 發生頻率」排序。行號對照目前的 HEAD 38be386。

| 編號 | 熱點 | 現況數字 | 問題在哪 | 建議做法 | 預估效益 | 改外觀 | 風險 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | 翻卡每幀重繪整面 | 1.2 s 內超過 8 ms 的幀 16 格、合計 206 ms | `QuizCard.svelte:38-44` 每幀用 inline style 改 `.floor`、`.shade`、`.sheen`、`.sheen b` 的 opacity 與 transform；這些元素在 `CardFace.svelte:113-116` 沒有 will-change，不會升成合成層，於是整面跟著重新點陣化 | 翻卡開始時掛 class 加 `will-change:opacity`（`.sheen b` 用 transform），回到 idle（`:55`）就拿掉 | ✅ 同頁 A／B：16 → 1.5 格、206 → 18 ms。每次作答都會發生 | 不變 | 低。每個面的圖層在 DPR 3 約 6 MB，只在翻卡期間掛。要截圖確認落定後畫面跟現在一樣。⚠️ QuizCard.svelte 是另一個 session 剛改過的檔 |
| P-02 | 看不到的背面動畫照跑 | 卡片閒置主緒 33.2% | `CardFace.svelte:16-25` 加流光（`:65`）、符文（`:94`），兩面各 37 個動畫，背面也在跑 | 卡片落定後替背面加 `animation-play-state:paused`，flipTo 一開始就恢復 | ✅ 同頁 A／B：33.2% → 26.1%，卡片閒置主緒少約 21%。整段練習都在省，影響耗電與發燙 | 看得到的那一面不變；背面恢復後動畫相位不同 | 中。暫停可能讓圖層被回收，翻到 90° 時要重新點陣化，可能重現 5d640a8 修過的「翻卡 90° 頓一下」。要用翻卡 A／B 驗 |
| P-03 | 星空在高更新率螢幕上跟著跑滿 | 165 Hz 上卡片閒置 34.3%；首頁閒置主緒幾乎全是星空（9.7% 對 0.2%） | `starfield.js:102` 的 `requestAnimationFrame(loop)` 沒有幀率上限 | 距離上次畫不到 15 ms 就跳過這一幀，迴圈照跑 | ✅ 165 Hz 上 34.3% → 26.9%。60 Hz 手機沒有效果，120 Hz 手機約省星空成本的一半（📌 推算） | **會變**：120 Hz 以上的裝置，流星與火花從 120 fps 降成 60 fps。要先問使用者 | 低 |
| P-04 | 按「開始練習」出卡時卡兩格 | 超過 8 ms 的幀合計 73 ms，最長 37 ms；📌 手機乘 4 約 150–300 ms | 第 3、4 幀固定變長，推測是兩面卡（5 層紙紋背景與預先繪製的背面）第一次點陣化，還沒拆證 | 先用 DevTools Performance 錄一次，看這兩幀落在 Paint、Raster 還是 Layout，再決定改法 | 沒量過 | 未定 | 未定 |
| P-05 | 題庫 chunk 是 JS 物件字面值 | import 26.3 ms，對照 fetch＋json 14.1 ms | `App.svelte:14-15` 的 `import('…json')` 被 Vite 8 輸出成 1 MB 的 JS；子代理試過 `json.stringify` 選項，Vite 8 不吃 | 改成 `import u from '…json?url'` 再 `fetch(u).then(r => r.json())` | ✅ 桌機約省 12 ms，📌 手機約 50 ms。發生在首頁可按之後的背景，只有剛開站就立刻按開始的人感覺得到 | 不變 | 低～中：載入與錯誤處理要跟著改；gzip 傳輸量多 0.6–3% |
| P-06 | 字型 CSS 宣告了用不到的切片 | 400＋700 兩份 CSS 傳輸 109 KB，每份 108 個 @font-face | `App.svelte:54-55` 整份引入 @fontsource；子代理算出題庫加 UI 只用到 52 個切片 | 建置時用 Vite 外掛（比照 bank-index）只輸出用得到的宣告 | 📌 子代理以原始 CSS 估 gzip −44%，約省 50 KB，Fast 4G 下字型約早 50 ms 換上；建置後實際數字沒量 | 不變（字元全涵蓋時） | 中：漏掉的字會靜默退回系統字型，要加測試守「題庫加 UI 的每個字都有切片」 |
| P-07 | 字型切片逐塊下載 | 首頁 20 塊、898 KB；題庫用到的字散在 400 粗細的 51 塊、1.72 MB | 同上，加上 GitHub Pages 回 `max-age=600` | 建置時把題庫加 UI 子集化成每種粗細一檔，或用 service worker 快取雜湊檔 | 沒量過 | 不變 | 中～高：要新增相依（pyftsubset 等），要先問 |
| P-08 | 作答當下同步存紀錄 | save() 1.3 ms（Node），📌 手機約 5 ms | `QuizCard.svelte:81` 先呼叫 onresult 才 `:82` flipTo；`progress.js:24` 在同一個 task 裡 stringify 整份紀錄再 setItem | `save()` 延到落定或 requestIdleCallback | 📌 翻卡第一幀早約 5 ms，沒量過 | 不變 | 低：延遲期間分頁被殺會掉最後一筆 |
| P-09 | 全螢幕 page-dim 層 | 沒量過 | `App.svelte:98,140` 多一個 fixed 全螢幕黑色半透明層，星空每幀都在合成 | 併進 `.page-bg` 的背景，多疊一層同色漸層 | 沒量過 | 不變（數學上等價），要截圖比對 | 低 |
| P-10 | 流光元素比需要的大 | 每面 662×1040 css px | `CardFace.svelte:61` 的 `inset:-50%` | 改成邊長等於對角線的正方形 | 只省 GPU 記憶體（📌 DPR 3 每面約 25 → 14 MB），不省每幀成本 | 不變，要截圖比對 | 中：hypot() 與容器單位的支援度未查證 |
| P-11 | 紋理圖解析度 | 5 張共 3.8 M 像素、PNG 3.58 MB 常駐記憶體 | `textures.js:24` 一律以 DPR 2 烘；兩張 stain 是低頻雜訊 | stain 兩張改用 DPR 1 | 📌 兩張 stain 由 2.44 M 降到 0.61 M px（−75%），全部紋理由 3.8 M 降到 1.97 M；沒量過畫面差異 | **可能會變**：要先看過 | 低 |
| P-12 | 紋理變數分 5 次寫 | 沒量過 | `textures.js:28` 每烘好一張就 setProperty 一次 | Promise.all 之後一次寫完 | 沒量過，預期很小 | 5 張改成同時出現（現在前後差幾 ms） | 極低 |
| P-13 | LINE 轉址前照樣掛載 | 只影響 LINE 內開啟 | `main.js:11-14` 轉址後仍 mount，開始抓 206 KB 題庫 | 有轉址就不 mount | 只省 LINE 使用者那一次的流量 | 不變 | 低 |

#### 建議先做的三項

1. P-01 翻卡 will-change：每次作答都會發生，A／B 掉幀減少約 90%，外觀不變。
2. P-02 背面動畫暫停：整段練習都在省主緒，A／B 少 21%。但有重現 90° 頓一下的風險，要拿翻卡 A／B 當驗收。
3. P-03 星空限 60 fps：效益只在 120 Hz 以上的手機，而且會改變外觀，要使用者點頭才做；不同意就改做 P-05。

#### 不值得做

1. 符文 keyframes 的 `var()` 改寫死：同頁 A／B 沒差。
2. 星空每幀 JS 0.1 ms：成本在繪製與合成，不在 JS 本身，所以 P-03 是降幀率，而不是優化 JS。
3. 紋理烘焙：主緒同步只有 1.8 ms，其餘是非同步。
4. 按「下一題」：最長一幀 12–24 ms，是三個操作裡最輕的。
5. 純邏輯（Node 代量）：各項乘 4 後仍在 30 ms 內，與第 1 輪結論相同。

#### 38be386（重點字）的效能面，本輪沒量

1. `App.svelte:46` 開站就動態載入 `highlight-fixes.json`：26 KB、gzip 約 3.8 KB，是一個獨立的請求，跟首屏平行，不擋可按。可以考慮併進 `ensure()` 跟題庫一起載。
2. 重點字 `mark` 用 700 粗細：子代理算出練習過程可能多抓 6 塊 700 切片、約 259 KB（📌）。要不要保留粗體屬於外觀決定。
3. 星芒 `.star` 帶 drop-shadow 與無限動畫，每題平均 0.82 顆，會疊加到 P-01 與 P-02 的成本上；下一輪要用同一套 A／B 重量。

#### 量不到的部分與實機步驟

1. GPU 與合成緒的時間頁內拿不到；pane 不能降速 CPU 或網路，手機數字都是乘 4 的 📌 模型。
2. 使用者實機抽驗（只有使用者能做）：Android 手機開 USB 偵錯，桌機 `chrome://inspect` 連上：
   1. Rendering 面板開 Paint flashing 後翻卡，確認現況兩面卡會整面閃綠（P-01 的機制）。
   2. Performance 錄「開始練習」，看第 3、4 幀的時間花在 Paint、Raster 還是 Layout（P-04）。
   3. 停在卡片 10 秒錄製，記 GPU 列佔比；120 Hz 手機另記 rAF 實際頻率（P-02、P-03）。

## 第 4 輪：2026-10-03（做第 3 輪的 P-02，P-01 待外觀確認）

改了什麼：7251dfe 在卡片落定後暫停背對畫面那面的常駐動畫，翻卡一開始就恢復（第 3 輪 P-02）。P-01（翻卡期間的 will-change）已實作並量過，但截圖比對發現翻卡中的像素有細微差異，依「動外觀先問」沒有 commit。P-03 星空限幀會改外觀，等使用者決定。

量法：內建瀏覽器 pane 這輪又變回隱藏，rAF 不跑，所以改用無頭 Chrome（本機 Chrome，`--headless=new`）經 CDP 驅動本機建置，行動版 375×812、DPR 2，A／B 一樣在同一個頁面裡注入覆寫 CSS、交錯進行。量測腳本放在 session 暫存區，沒有進 repo。
1. 有 GPU 的無頭模式跟著螢幕跑到約 160 Hz；CPU 降速 4 倍時三種變體每幀都超過預算（每秒約 70 幀），掉幀指標飽和、分不出差異，所以這組不採用。
2. 加 `--disable-gpu` 時固定 60 Hz，合成改由軟體做，比較接近弱手機，預算取 1.5 倍幀距（25 ms）。

| 試驗 | 環境 | A | B | 取樣 |
| --- | --- | --- | --- | --- |
| P-02 卡片閒置主緒 | 無頭、有 GPU、CPU 1× | 29.8%（28.7–33.5） | 23.1%（22.0–23.7） | 各 4 |
| P-02 卡片閒置主緒 | 無頭、關 GPU、CPU 1× | 14.3%（13.9–14.6） | 11.7%（11.5–12.8） | 各 3 |
| P-02 對翻卡的影響（含 90° 處） | 無頭、關 GPU | 不暫停：超過 25 ms 的幀 5 格、合計 167 ms | 暫停：5 格、167 ms | 各 6；兩組相同，恢復動畫沒有造成頓點 |
| P-01 翻卡掉幀 | 無頭、關 GPU | 沒有 will-change：9 格、300 ms | 只在翻卡期間掛：5 格、167 ms；常駐掛：6 格、200 ms | 各 6 |
| P-01 外觀 | 無頭，動畫凍結、遮罩給固定值後截圖 | — | 有、無 will-change 兩張相比：48% 的像素有差，最大差 9／255（關 GPU 時 10／255）；對照組同條件截兩次無差異 | 1 |

判讀：
1. P-02 在三種環境都少 18–22% 的卡片閒置主緒，跟第 3 輪內建瀏覽器的 21% 一致；第 3 輪設的目標「≤ 27%」是內建瀏覽器的指標，這輪 pane 隱藏沒能重量。
2. P-01 只在翻卡期間掛 will-change，效果不比常駐掛差，記憶體又省，所以採這個做法。差異只出現在翻卡那 0.75 s 遮罩半透明的時候，落定後 will-change 已經拿掉，畫面跟現在逐像素相同。
3. ⚠️ 第 3 輪的翻卡目標「超過 8 ms 的幀 ≤ 2 格」是 165 Hz pane 上的指標，這輪沒能重量；關 GPU 的無頭模式還剩 5 格超過 25 ms。

範圍外修掉一項：減少動態效果時改視窗大小星空會消失（PQZ-05，7d9e29d）。

P-02 狀態改為已改善；P-01 實作完成、等外觀確認；P-03 等使用者決定；P-04～P-13 不變。

## 第 5 輪：2026-10-03（P-01、P-03 經使用者同意後落地）

改了什麼：6d02075 翻卡期間掛 will-change（第 3 輪 P-01，數字見第 4 輪），a26325d 星空在高更新率螢幕上只畫約 60 格（第 3 輪 P-03）。兩項會在翻卡中或 120 Hz 以上的裝置改變畫面，使用者 2026-10-03 同意。

量法：同第 4 輪的無頭 Chrome（有 GPU，螢幕 165 Hz），首頁閒置，本機建置與線上站 c083012 交錯各量 3 次；每秒畫格數是數星空 `clearRect` 的呼叫次數。

| 項目 | 線上站 c083012 | 本機（含 P-03） |
| --- | --- | --- |
| 星空每秒畫格 | 162.5–165 | 60–60.5 |
| 首頁閒置主緒 | 8.3%（8.0–9.3） | 3.9%（3.8–4.0） |

⚠️ 第 3 輪兩個目標要用內建瀏覽器 pane 的原指標重量，這輪 pane 仍是隱藏狀態，還沒重量。

P-01、P-03 狀態改為已改善；P-02 見第 4 輪；P-04～P-13 不變。

## 第 6 輪：2026-10-03（用第 3 輪的同一套方法重量）

量法：同第 3 輪，內建瀏覽器 pane 顯示中，375×812、DPR 2、螢幕 165 Hz，桌機 CPU 沒有降速。對象是本機建置的 2a0198a（P-01、P-02、P-03 都在），A／B 在同一個頁面裡注入覆寫 CSS、交錯進行。量測當下 CPU 負載 14%（第 3 輪是 45%），所以絕對值不能直接跟第 3 輪比，能比的是同頁 A／B。

| 項目 | 現況 | 同頁拿掉該項 | 第 3 輪目標 | 取樣 |
| --- | --- | --- | --- | --- |
| 翻卡 1.2 s 內超過 8 ms 的幀 | 0 格（0–3），合計 0 ms，最長 6 ms | 拿掉 P-01：3.5 格（0–19），合計 42 ms，最長 12 ms | ≤ 2 格：✅ 達成 | 各 8 次，沒有整段掉幀的次數 |
| 卡片閒置主緒 | 19.3%（19.0–19.6） | 拿掉 P-02：28.7%（28.3–29.5） | ≤ 27%：✅ 達成 | 各 4 組 × 3 × 2 s |
| 首頁閒置主緒 | 4.8%（4.5–4.9） | — | — | 5 × 2.5 s；第 3 輪 9.7%，差在 P-03 |

判讀：翻卡的兩組都比第 3 輪輕（第 3 輪 16 格），一部分是這輪背景負載低，一部分是 P-03 讓星空少畫；同頁 A／B 下，P-01 仍讓超過預算的幀從 3.5 格降到 0 格。卡片閒置的 19.3% 同時包含 P-02 與 P-03。

第 3 輪的兩個目標都用原指標驗過了。

## 第 7 輪：2026-10-03（做第 3 輪 P-04～P-13 與延後項）

量法：`tools/measure_browser.mjs`（本輪起進版控，第 4 輪那支腳本的整理版），對象是本機建置；改動前的版本用 `git archive` 另建一份，放在同一個靜態伺服器的另一個路徑，兩版交錯量。另以內建瀏覽器 pane（實體 GPU、165 Hz）補量出卡那一項。

| 編號 | 結果 | 數字 | commit |
| --- | --- | --- | --- |
| P-04 出卡卡兩格 | 查到原因：卡片兩面第一次點陣化，成本在 GPU 執行緒 | 無頭 Chrome trace：第 4 幀 309 ms，其中 GPU 點陣化 290 ms、主緒版面 44 ms。拿掉單一層的診斷（最長一幀中位數）：現況 49 ms、去流光 30、去金墨與符文 24、藏背面 24、去紙紋 42。只有流光能在不改外觀下縮小，即 P-10；其餘要改外觀或會讓翻卡 90° 重新頓一下，不動 | — |
| P-05 題庫改用 fetch | ❌ 量過無效，已還原 | CPU 4 倍時，題庫到手到開始抓字型：改前 116 ms、改後 135 ms。V8 會在背景執行緒邊下載邊 compile 題庫 JS，主緒只剩執行；改成 `r.json()` 反而把解析搬回主緒。第 3 輪用 Blob 量的 26 ms 對 14 ms 沒有算到背景 compile | — |
| P-06 字型 CSS 瘦身 | 由 P-07 取代 | 字型 CSS 從 109 KB 降到 4.5 KB（gzip） | — |
| P-07 字型子集化 | ✅ | 首頁字型 20 檔 898 KB → 2 檔 266 KB（−70%）；出一張卡 22 檔約 1.0 MB → 3 檔 462 KB；全部用到也只有 4 檔 664 KB。截圖與原切片比對最大差 1／255。dist 少 418 個檔 | 214e4dd |
| P-08 存檔延到閒置 | ✅ | 紀錄滿載、CPU 4 倍：按答案的同步處理 8.1 → 1.1 ms | 45093a2 |
| P-09 page-dim 併入背景 | ✅ 外觀相同、少一層 | 首頁截圖最大差 1／255；主緒 8.1% 對 8.2% 沒差，GPU 合成成本量不到 | 157b75f |
| P-10 流光縮小 | ✅ 只在軟體點陣化時有感 | 出卡最長一幀：無頭（軟體點陣化）48 → 36 ms；pane（實體 GPU）30 → 30 ms。截圖 0.85% 像素差 1–2／255 | bff063f |
| P-11 汙漬紋理 1 倍 | ⏸ 等使用者看截圖 | 首頁與卡片最大差 3／255（19–25% 像素）；紋理像素 3.8 M → 1.97 M | — |
| P-12 紋理變數一次寫 | ✅ 效益沒有單獨量 | 樣式重算 5 次 → 1 次；截圖最大差 1／255 | 82925fd |
| P-13 LINE 轉址不掛載 | ❌ 已還原 | LINE 的 UA 下改前改後題庫都只抓 1 次，看不到效益；而且 LINE 若攔下轉址、留在原頁，不掛載就會整頁空白 | — |
| 延後項：星空隨網址列重抽 | ✅ | 畫布高度改跟 100lvh，只有寬度或畫布實際高度變了才重設；Node 測試守（修正前紅）。網址列行為要手機實機確認 | 6d55dd9 |
| 延後項：重點字微調開站就抓 | ✅ | 改在題庫到手後才抓，實際瀏覽器確認它排在題庫之後 | b0eb94d |

App.svelte 的過期字型註解併在 214e4dd 改寫。

## 第 8 輪：2026-10-03（P-11 經使用者看過截圖後落地）

兩張汙漬紋理改用 1 倍解析度烘焙，紋理像素 3.8 M → 1.97 M；截圖最大差 3／255，使用者看過前後截圖同意。註解新增的字一併重切字型。

## 第 9 輪：2026-10-03（實機驗收）

使用者在手機上開線上站 8b8d47f，在首頁上下捲動讓網址列收合，星空沒有整片重排；第 7 輪「星空隨網址列重抽」（6d55dd9）實機確認。

## 第 10 輪：2026-10-03（全面盤點第二輪基準）

目的：第 1 輪（dd97eb9）之後 29 個 commit、第 2～9 輪各做了一部分，這一輪在 HEAD d87d6a0 用同一套量法重建一份可比的全套基準，並盤第 3 輪 13 個熱點與延後項的現況。沒有改任何產品碼。量測腳本只加段：`tools/measure_perf.py` 新段 `gate`（run_gate.py 端到端＋三步佔比）、`buildfonts`（build_fonts.py --check 端到端＋分段）、`web` 段尾加重點字 `segments()` 兩列、產出大小表加 4 列、環境多印 pypdf／openpyxl／fontTools 版本；`tools/measure_browser.mjs` 新增 `serve:<資料夾>`（腳本內建靜態伺服器：文字資源 gzip、`max-age=600` 比照 GitHub Pages，量完關掉）、`load`（開站）與 `next`（下一題）兩個模式。既有段的量法一字未改（`git diff` 的刪除行只有段落清單、用法字串與 `finish` 關伺服器）。熱點編號 P-01 起重新配發，只在本輪有效。

### 量測環境

1. 機器：LAPTOP-JI7EEVA5，16 個邏輯核心，Windows 11（10.0.26200）。插電、電量 100%，電源計畫「平衡」。
2. 版本：d87d6a0（2026-10-03 20:41）。未 commit 5 檔：三份盤點產出與上述兩支量測腳本，受測的產品碼與 HEAD 相同。
3. 組態：Python 3.11.9、pypdf 6.12.1、openpyxl 3.1.5、fontTools 4.63.0；Node v24.16.0、npm 11.13.0、vite 8.3.2 的 production 建置。⚠️ 本機 pypdf 6.12.1 與 `requirements.txt` 釘的 6.19.0 不同，CI 跑的是 6.19.0；PDF 抽字是 convert 的最大成本，兩版速度本輪沒有比較（屬 R18／R19 範圍）。
4. 背景負載：A～D 四組已收工、主線沒跑指令。腳本段量測前 CPU 負載 10%、量後 1%（第 1 輪 4%／22%，第 3 輪 45%／60%）；瀏覽器段跑完 19%。
5. 取樣：腳本段 warmup 1 次不計、正式 5 次。瀏覽器 `load` warmup 1 次不計、正式 5 次（每次關快取重新載入）；`start` 5 次；`flip-idle` 翻卡 6 次、閒置 3 組 × 2.5 s；`next` 6 次；`home-idle` 5 次 × 2 s。
6. 輸入：`data/source/` 與第 1 輪相同（RTF 6.88 MB、PDF 905 KB 244 頁、xlsx 405 KB＋297 KB）；題庫是非 2,686 題 1.15 MB、選擇 913 題 698 KB、註記 99 則；新增 `web/src/lib/highlight-fixes.json` 92 KB（微調 1,366 題）。unittest 32 條（第 1 輪 24、第 2 輪 28），npm test 29 條（第 1 輪 16）。
7. 瀏覽器：本機 Chrome `--headless=new`（有 GPU，跟螢幕跑 162–165 Hz，幀預算取 1.5 倍幀距 ≈ 9.1 ms，比手機的 16.7 ms 嚴）經 CDP 驅動，375×812、DPR 2、mobile。對象是 HEAD 的本機建置（`npm run build -- --outDir` 到 session 暫存區，沒碰 `web/dist`），由 `measure_browser.mjs` 的 `serve:` 供應。開站那段用 CDP 關快取、模擬 Fast 4G（下行 1,012,500 B/s、上行 168,750 B/s、每請求 165 ms；✅ 本輪從 Chromium devtools-frontend `front_end/core/sdk/NetworkManager.ts` 原文核對：`9 * 1000 * 1000 / 8 * .9`、`1.5 * 1000 * 1000 / 8 * .9`、`60 * 2.75`）＋CPU 4 倍降速，是第 1 輪模型換算的實量版。⚠️ 導航請求的 TTFB 在 CDP 節流下只有 4 ms、不含 165 ms 延遲（HTML 到手 195 ms 才含），開站的時間軸以「HTML 到手」起算，不用 TTFB。
8. ⚠️ 第 3／6 輪用的內建瀏覽器 pane（165 Hz、實體 GPU）本輪沒用：量法改以進版控的 `measure_browser.mjs` 為正本，跨輪對照以第 4、5、7 輪的無頭數字為準。
9. 剖析器：同第 1 輪，只有埋點計時。
10. 原始輸出：session 暫存區 `r10-perf.md`、`r10-perf.json`、`r10-load-4g.json`、`r10-load-none.json`、`r10-start.json`、`r10-flip.json`、`r10-next.json`、`r10-home.json`、`r10-fonts.json`（不進 repo）。

### 入口清單（HEAD d87d6a0）

使用者預期一欄：標「上輪」的是 2026-10-02 的回答，標「本輪」的是 2026-10-03 全面盤點時的回答。

| 進入點 | 觸發方式 | 使用者預期等多久 | 要不要開宿主 | 第 1 輪 → HEAD | 本輪 |
| --- | --- | --- | --- | --- | --- |
| `python tools/convert.py --check` | 官方換版時 | 約 12 秒可接受（上輪） | 否 | 沿用 | ✅ 已量 9.06 s |
| `python -m unittest discover -s tests` | 改 tools 之後 | 1 分鐘內（上輪） | 否 | 24 條 → 32 條 | ✅ 已量 32.23 s |
| `python tools/run_gate.py` | 本機交付前；CI 每次 push 跑同一支 | 1 分鐘內，超過黃、超過 2 分鐘紅（本輪） | 否 | f7bb0d3 新增 | ✅ 已量 34.86 s |
| `python tools/build_fonts.py --check`／重跑 | 題庫或介面文字改了 | 30 秒內（本輪） | 否 | 214e4dd 新增 | ✅ 已量 16.10 s |
| `npm test` | 改網站後；CI | 沒有要求 | 否 | 16 條 → 29 條 | ✅ 已量 0.91 s |
| `npm run build` | 同上 | 沒有要求 | 否 | 產出 425 檔 15.09 MB → 11 檔 2.39 MB | ✅ 已量 1.62 s |
| 開站到首頁可按 | 手機開網址 | 4G 下 3 秒內（上輪） | 瀏覽器 | 第 1 輪只有模型 | ✅ 模擬實量：Fast 4G＋CPU 4× 首次繪製 0.544 s |
| 題庫背景下載 | 開站後自動 | 按「開始練習」前到手就好（上輪） | 瀏覽器 | 沿用 | ✅ 同上：0.850 s |
| 重點字微調 chunk（highlight-fixes） | 題庫到手後自動 | 比照題庫：按開始前到手就好（本輪） | 瀏覽器 | 38be386、6af33bd 新增；gzip 18 KB | ✅ 同上：1.074 s |
| 思源宋體子集換上 | 題庫到手後自動 | 比照題庫：按開始前到手就好，不另設幾秒的線（本輪） | 瀏覽器 | 19 塊 858 KB → 首頁 2 檔 268 KB | ✅ 同上：1.525 s |
| 按「開始練習」到第一張卡 | 點按鈕 | 不掉幀（上輪） | 瀏覽器 | 沿用 | ✅ 已量：最長一幀 36 ms |
| 作答翻卡 | 點答案 | 不掉幀（上輪） | 瀏覽器 | 沿用 | ✅ 已量：超過預算 0 格 |
| 按「下一題」 | 點按鈕 | 不掉幀（上輪） | 瀏覽器 | 第 3 輪只手量 3 次 | ✅ 已量（新模式 `next`）：0 格 |
| 常駐動畫（星空、流光、符文、火花、星芒） | 一直在跑 | 不掉幀、要算耗電與發燙（上輪）；卡片閒置時主緒佔用 ≤ 20%（本輪） | 瀏覽器 | 星芒為 38be386 新增 | ✅ 已量：卡片閒置 14.6%、首頁閒置 4.6% |
| CI 發布（`.github/workflows/pages.yml`） | push main | 不設線，只記數字（本輪） | GitHub | 沿用 | ✅ 讀 `gh run`：push 到上線 62–73 s |
| `tools/fetch_official.py`、`npm run dev`、`tools/review/*.py`（含新 highlight_check.py） | — | — | — | review 腳本已由 unittest 的 ReviewChecks／HighlightCheck 兩類以子行程計入 | 不量 |

消失的入口與產出：`tmp/review`（搬進 `data/review/work`）、@fontsource 執行期 418 個切片與 400／700 兩份 CSS、page-dim 全螢幕層；第 3 輪 P-05、P-13 已還原，沒有留下新入口。

### 腳本輸出（`python tools/measure_perf.py --runs 5 --warmup 1`）

量測時間 2026-10-03 21:21，總耗時 927 s（含新段 gate 與 buildfonts）。數字照腳本輸出，沒有改動；重複的輸入描述改成「同上」，網站列的進入點名稱縮短。71 列沒有任何一列被標「環境有噪音」（最大值都沒超過中位數兩倍）。

| 熱點 | 所屬進入點 | 中位數／最大值 | 取樣次數 | 佔該進入點總時間比例 | 輸入檔大小筆數 |
| --- | --- | --- | --- | --- | --- |
| Python 啟動（python -c pass） | 空跑底線 | 58.8 ms／62.5 ms | 5 | — | — |
| Node 啟動（node -e 0） | 空跑底線 | 50.8 ms／51.5 ms | 5 | — | — |
| npm 啟動（npm --version） | 空跑底線 | 311.3 ms／320.0 ms | 5 | — | — |
| convert.py --check 端到端 | tools/convert.py | 9.06 s／9.17 s | 5 | — | RTF 6.88 MB、PDF 905 KB 244 頁、xlsx 405 KB＋297 KB、題數 2686＋913、註記 99 則 |
| import convert（含 openpyxl） | tools/convert.py | 295.3 ms／309.5 ms | 5 | 3.3% | 同上 |
| import pypdf | tools/convert.py | 100.4 ms／107.9 ms | 5 | 1.1% | 同上 |
| read_rtf：RTF 解析 | tools/convert.py | 557.6 ms／560.0 ms | 5 | 6.2% | 同上 |
| read_pdf_answers：PDF 抽字 | tools/convert.py | 6.27 s／6.35 s | 5 | 69.2% | 同上 |
| cross_check：RTF 與 PDF 逐題比對 | tools/convert.py | 0.587 ms／0.704 ms | 5 | 0.0% | 同上 |
| read_xlsx：是非題解析 xlsx | tools/convert.py | 1.07 s／1.11 s | 5 | 11.8% | 同上 |
| read_xlsx：選擇題解析 xlsx | tools/convert.py | 308.4 ms／312.3 ms | 5 | 3.4% | 同上 |
| apply_review：掛審查註記 | tools/convert.py | 5.273 ms／5.588 ms | 5 | 0.1% | 同上 |
| check_duplicates：同題答案一致 | tools/convert.py | 38.0 ms／38.5 ms | 5 | 0.4% | 同上 |
| build 其餘：題文配對與組裝 | tools/convert.py | 81.1 ms／82.6 ms | 5 | 0.9% | 同上 |
| render 與已提交 JSON 比對 | tools/convert.py | 36.4 ms／39.1 ms | 5 | 0.4% | 同上 |
| 子行程內分段外其餘（直譯器啟動等） | tools/convert.py | 180.8 ms／199.7 ms | 5 | 2.0% | 同上 |
| 端到端減分段子行程（中位數相減） | tools/convert.py | 176.3 ms／176.3 ms | 1 | 1.9% | 同上 |
| （分段子行程總時間） | tools/convert.py | 8.89 s／9.05 s | 5 | — | 同上 |
| python -m unittest discover -s tests 端到端 | unittest | 32.23 s／34.10 s | 5 | — | 32 條測試；RTF 6.88 MB、PDF 905 KB 244 頁、xlsx 405 KB＋297 KB、題數 2686＋913、註記 99 則 |
| 類別 Corruption | unittest | 27.77 s／27.93 s | 5 | 86.2% | 同上 |
| 類別 OfficialCrossCheck | unittest | 22.2 ms／22.5 ms | 5 | 0.1% | 同上 |
| 類別 Output | unittest | 1.43 s／1.45 s | 5 | 4.4% | 同上 |
| 類別 PureFunctions | unittest | 0.239 ms／0.265 ms | 5 | 0.0% | 同上 |
| 類別 ReviewNotes | unittest | 12.8 ms／13.0 ms | 5 | 0.0% | 同上 |
| 類別 Fonts | unittest | 37.4 ms／37.8 ms | 5 | 0.1% | 同上 |
| 類別 HighlightCheck | unittest | 826.8 ms／841.8 ms | 5 | 2.6% | 同上 |
| 類別 ReviewChecks | unittest | 720.4 ms／730.0 ms | 5 | 2.2% | 同上 |
| 探索、setUpClass 與測試之間 | unittest | 1.04 s／1.05 s | 5 | 3.2% | 同上 |
| 子行程內分段外其餘（直譯器啟動等） | unittest | 221.5 ms／244.4 ms | 5 | 0.7% | 同上 |
| 端到端減分段子行程（中位數相減） | unittest | 146.4 ms／146.4 ms | 1 | 0.5% | 同上 |
| （分段子行程總時間） | unittest | 32.08 s／32.21 s | 5 | — | 同上 |
| npm test 端到端 | npm test | 911.7 ms／918.2 ms | 5 | — | 29 條測試，讀真的題庫 JSON |
| 測試：highlight-fixes.json 每一筆都對得上現行題目 | npm test | 39.0 ms／47.3 ms | 5 | 4.3% | 同上 |
| 測試：緊鄰的重點字併成一段，片段接回去等於原文 | npm test | 28.7 ms／33.6 ms | 5 | 3.1% | 同上 |
| 測試：首頁用題號前綴算的進度，與用整份題庫算的相同 | npm test | 17.3 ms／17.6 ms | 5 | 1.9% | 同上 |
| 其餘 26 條測試 | npm test | 64.3 ms／72.0 ms | 5 | 7.0% | 同上 |
| 子行程內分段外其餘（直譯器啟動等） | npm test | 391.8 ms／398.0 ms | 5 | 43.0% | 同上 |
| 端到端減分段子行程（中位數相減） | npm test | 367.2 ms／367.2 ms | 1 | 40.3% | 同上 |
| （分段子行程總時間） | npm test | 544.5 ms／550.3 ms | 5 | — | 同上 |
| npm run build 端到端（輸出到暫存資料夾） | npm run build | 1.62 s／1.64 s | 5 | — | 題庫 JSON 兩包＋字型 @fontsource |
| vite 自報 built in（轉換與打包） | npm run build | 360.0 ms／366.0 ms | 5 | 22.2% | — |
| npm／node 啟動與設定載入（端到端扣 vite 自報） | npm run build | 1.27 s／1.28 s | 5 | 77.8% | — |
| bank-index 外掛：解析兩包題庫＋抽課程清單 | npm run build | 4.402 ms／4.520 ms | 5 | 0.3% | JSON 1.15 MB＋698 KB |
| 題庫到手後 JSON 解析（是非，代理指標） | 網站（Node 代量）：題庫下載完成 | 1.737 ms／1.794 ms | 5 | — | 1.15 MB；瀏覽器實際是執行 JS chunk |
| byId 對照表（App.svelte:29） | 網站（Node 代量）：題庫下載完成 | 0.559 ms／0.689 ms | 5 | — | 2686 題 |
| 第一次出題 draw（冷啟動） | 網站（Node 代量）：按開始練習 | 1.035 ms／1.340 ms | 5 | — | 紀錄滿載：3599 題都作答過、紀錄 138 KB、是非錯題 1507 題 |
| 出題 draw：全部模式 | 網站（Node 代量）：按下一題 | 0.219 ms／0.221 ms | 5 | — | 同上 |
| 出題 draw：錯題模式（兩次 pool） | 網站（Node 代量）：按下一題 | 0.231 ms／0.235 ms | 5 | — | 同上 |
| stats()：作答後重算範圍統計 | 網站（Node 代量）：作答 | 0.102 ms／0.104 ms | 5 | — | 同上 |
| save()：JSON.stringify 整份紀錄（不含 localStorage 寫入） | 網站（Node 代量）：作答 | 1.016 ms／1.080 ms | 5 | — | 同上 |
| load()：讀回紀錄 | 網站（Node 代量）：開站 | 1.299 ms／1.363 ms | 5 | — | 同上 |
| 首頁課程清單 15 列 statsByPrefix | 網站（Node 代量）：開站／回首頁 | 5.135 ms／5.166 ms | 5 | — | 同上 |
| 重點字 segments()：全部題目各跑一次（冷） | 網站（Node 代量）：出卡（第 10 輪新段） | 13.3 ms／13.7 ms | 5 | — | 3599 題、微調 1366 題（JSON 92 KB）、標到 3582 處 |
| 重點字 segments()：每題一次（穩態） | 網站（Node 代量）：出卡（第 10 輪新段） | 0.003 ms／0.003 ms | 5 | — | 同上 |
| python tools/run_gate.py 端到端（交付把關） | tools/run_gate.py | 34.86 s／35.09 s | 5 | — | unittest＋npm test＋npm run build；RTF 6.88 MB、PDF 905 KB 244 頁、xlsx 405 KB＋297 KB、題數 2686＋913、註記 99 則 |
| 把關步驟：Python 測試（run_gate 自報） | tools/run_gate.py | 32.20 s／32.50 s | 5 | 92.4% | 同上 |
| 把關步驟：網站測試（run_gate 自報） | tools/run_gate.py | 900.0 ms／900.0 ms | 5 | 2.6% | 同上 |
| 把關步驟：網站建置（run_gate 自報） | tools/run_gate.py | 1.60 s／1.60 s | 5 | 4.6% | 同上 |
| 把關其餘（直譯器啟動與印總表） | tools/run_gate.py | 148.5 ms／209.1 ms | 5 | 0.4% | 同上 |
| build_fonts.py --check 端到端（子集化並與已提交檔比對） | tools/build_fonts.py | 16.10 s／16.21 s | 5 | — | @fontsource 切片 → noto-serif-tc-400-ui.woff2 129 KB＋noto-serif-tc-400-bank.woff2 191 KB＋noto-serif-tc-700-ui.woff2 133 KB＋noto-serif-tc-700-bank.woff2 196 KB；RTF 6.88 MB、PDF 905 KB 244 頁、xlsx 405 KB＋297 KB、題數 2686＋913、註記 99 則 |
| import build_fonts（含 fontTools） | tools/build_fonts.py | 134.8 ms／135.1 ms | 5 | 0.8% | 同上 |
| charsets：掃介面與題庫用字 | tools/build_fonts.py | 73.8 ms／76.0 ms | 5 | 0.5% | 同上 |
| subset_font：400 粗細 ui（700 字） | tools/build_fonts.py | 3.19 s／3.20 s | 5 | 19.8% | 同上 |
| subset_font：400 粗細 bank（915 字） | tools/build_fonts.py | 4.83 s／4.85 s | 5 | 30.0% | 同上 |
| subset_font：700 粗細 ui（700 字） | tools/build_fonts.py | 3.05 s／3.08 s | 5 | 18.9% | 同上 |
| subset_font：700 粗細 bank（915 字） | tools/build_fonts.py | 4.71 s／4.74 s | 5 | 29.2% | 同上 |
| build 其餘：組 CSS | tools/build_fonts.py | 1.910 ms／1.982 ms | 5 | 0.0% | 同上 |
| 與已提交檔比對 | tools/build_fonts.py | 0.924 ms／0.998 ms | 5 | 0.0% | 同上 |
| 子行程內分段外其餘（直譯器啟動等） | tools/build_fonts.py | 134.8 ms／135.7 ms | 5 | 0.8% | 同上 |
| 端到端減分段子行程（中位數相減） | tools/build_fonts.py | -25.6 ms／-25.6 ms | 1 | -0.2% | 同上 |
| （分段子行程總時間） | tools/build_fonts.py | 16.12 s／16.18 s | 5 | — | 同上 |
convert 的「端到端減分段子行程」176 ms 與 unittest 的 146 ms 都在雜訊內，埋點沒有改變成本；npm test 的 367 ms 是 `npm run` 包裝開銷（與第 1 輪 450 ms 同級）。

建置產出大小（腳本以 zlib 等級 6 估 gzip）：

| 項目 | 檔數 | 原始 | gzip 估 | 第 1 輪 |
| --- | --- | --- | --- | --- |
| 首屏關鍵路徑（index.html＋入口 js／css） | 3 | 84 KB | 31 KB | 79 KB／29 KB |
| 是非題題庫 chunk（背景下載） | 1 | 1011 KB | 200 KB | 同 |
| 選擇題題庫 chunk（背景下載） | 1 | 613 KB | 151 KB | 同 |
| 字型 CSS 400＋700（@fontsource，HEAD 已不存在） | 0 | 0 | 0 | 2 檔 258 KB／106 KB |
| 字型切片 woff2（舊列名；HEAD 數到的就是下面 4 個子集檔） | 4 | 649 KB | 649 KB | 208 檔 5.83 MB |
| 字型切片 woff（HEAD 已不存在） | 0 | 0 | 0 | 210 檔 7.34 MB |
| 字型 CSS（子集宣告，題庫到手後載入）（新列） | 1 | 20 KB | 4 KB | — |
| 字型子集 ui 兩檔 400＋700（首頁就抓）（新列） | 2 | 262 KB | 262 KB | — |
| 字型子集 bank 兩檔 400＋700（出卡才抓）（新列） | 2 | 387 KB | 387 KB | — |
| 重點字微調 chunk（題庫之後載入）（新列） | 1 | 66 KB | 18 KB | — |
| dist 全部（部署上傳量） | 11 | 2.39 MB | 1.03 MB | 425 檔 15.09 MB／13.65 MB |

### 瀏覽器實測（`node tools/measure_browser.mjs <模式> serve:<HEAD 建置>`，2026-10-03 21:37–21:41）

| 項目 | 中位數／最大值（或範圍） | 取樣 | 量法與對照 |
| --- | --- | --- | --- |
| ✅ 開站 HTML 到手，Fast 4G＋CPU 4× | 195 ms／198 ms | 5 | `load --cpu 4 --net fast4g`，每次關快取；含 165 ms 模擬延遲 |
| ✅ 開站「開始練習」按鈕進 DOM（可按） | 458 ms／464 ms | 5 | 文件建立前注入的 MutationObserver；在 DCL（521／536 ms）之前，Svelte 同步掛載 |
| ✅ 開站首次繪製 FCP（＝LCP） | 544 ms／564 ms | 5 | 同上。這是使用者看得到按鈕的時刻，低於 3 s 的線；第 1 輪模型估 0.63 s（保守 1.7 s） |
| ✅ 題庫 chunk 到手（205,393 B） | 850 ms／856 ms | 5 | Resource Timing responseEnd；可按之後 0.39 s（第 1 輪模型 0.37 s） |
| ✅ 重點字微調 chunk 到手（17,987 B） | 1,074 ms／1,095 ms | 5 | 同上；排在題庫之後（b0eb94d） |
| ✅ 字型 CSS 到手（4,259 B） | 1,057 ms／1,081 ms | 5 | 同上 |
| ✅ 字型檔到手：ui 兩檔 268,168 B | 1,525 ms／1,546 ms | 5 | 同上；第 1 輪模型 2.3 s（19 塊 858 KB）。⚠️ 開站 1.5 s 內就按「開始練習」的人，字會在卡片出現後才換成思源宋體 |
| ✅ 開站，無節流、CPU 1×（對照） | HTML 4／17 ms、可按 25／37 ms、FCP 68／80 ms、題庫 48／60 ms、字型檔 93／107 ms | 5 | `load`，本機伺服器；只給相對大小 |
| ✅ 傳輸量（gzip 後實際位元組） | HTML 427、入口 JS 28,164、入口 CSS 3,716、題庫 205,393、微調 17,987、字型 CSS 4,259、字型 ui 2 檔 268,168 | 1 | Resource Timing encodedBodySize；第 1 輪線上站入口 JS 26,220、題庫 209,712 |
| ✅ 按「開始練習」後前 8 幀最長一幀 | 36 ms（36–36）；5 次為 358、36、36、36、36 | 5 | `start`；第一次是 Chrome 新開後第一次出卡（字型與紙紋第一次點陣化），其餘 4 次一致。第 7 輪無頭 36 ms、pane 30 ms |
| ✅ 作答翻卡 1.4 s 內超過 9.2 ms 的幀 | 0 格（0–1），合計 0 ms（0–12），最長 6 ms（6–12） | 6 | `flip-idle`，162.5 Hz；第 3 輪 16 格 206 ms、第 6 輪 0 格 |
| ✅ 卡片閒置主緒佔用 | 14.6%（14.4–14.9） | 3 × 2.5 s | 同上；使用者線 ≤ 20%。第 4 輪同環境（無頭有 GPU）29.8%，第 6 輪 pane 19.3% |
| ✅ 同頁 A／B：拿掉星芒（`.star{animation:none;filter:none}`） | 翻卡 0 格（0–4）；閒置 14.9%（14.6–15.2） | 6／3 | 與現況交錯量；差異在雜訊內，星芒的成本量不出來 |
| ✅ 按「下一題」1.5 s 內超過 9.1 ms 的幀 | 0 格（0–0），最長 6 ms | 6 | 新模式 `next`，165.5 Hz；第 3 輪 1–10 格 |
| ✅ 首頁閒置主緒佔用 | 4.6%（4.5–5.4） | 5 × 2 s | `home-idle`；第 3 輪 9.7%、第 5 輪無頭 3.9%、第 6 輪 pane 4.8% |
| ✅ 星空每秒畫格 | 60（60–60.5） | 5 | 同上，數 `clearRect`；a26325d 的 60 格上限生效 |
| ✅ 字型檔數與位元組 | 首頁 2 檔 268,168 B；出卡後 3 檔 463,476 B | 1 | `fonts`；第 7 輪 2 檔 266 KB、3 檔 462 KB |
| ✅ CI：push 到線上更新 | 62、72、73 s（最近 3 次，d87d6a0、8b8d47f、e349a77） | 3 | `gh run list`／`gh run view`：build job 47–56 s（其中 `run_gate` 步驟 34–35 s、`npm ci` 2–4 s、`pip install` 3 s）、deploy job 8–12 s。使用者不設線 |

### 跨輪對照

| 入口 | 第 1 輪 | 中間各輪 | 第 10 輪中位數／最大值 | 判讀 |
| --- | --- | --- | --- | --- |
| convert.py --check | 9.48 s／9.72 s | — | 9.06 s／9.17 s | 沒改程式；空跑底線同向變快（Python 啟動 62.5 → 58.8 ms），視為環境差異。低於 12 s 線 |
| unittest | 89.32 s／89.63 s（24 條） | 第 2 輪 36.79／40.58（28 條，CPU 54%） | 32.23 s／34.10 s（32 條） | 低於 60 s 線，餘裕 26 s；比第 2 輪少是第 2 輪環境吵 |
| run_gate.py | — | — | 34.86 s／35.09 s | 新入口；低於 60 s 線。CI 的 ubuntu 跑同一支 34–35 s |
| build_fonts.py --check | — | — | 16.10 s／16.21 s | 新入口；低於 30 s 線 |
| npm test | 696.7 ms（16 條） | 第 3 輪 866 ms（17 條，吵） | 911.7 ms／918.2 ms（29 條） | 測試本體 150 ms，其餘是 npm 包裝與 node 啟動；沒有要求 |
| npm run build | 2.24 s | 第 3 輪 3.14 s（吵） | 1.62 s／1.64 s | 字型子集化後 dist 15 MB → 2.4 MB；沒有要求 |
| 開站首次繪製（Fast 4G＋CPU 4×） | 📌 模型 0.63 s | — | ✅ 0.544 s／0.564 s | 低於 3 s 線 |
| 字型換上 | 📌 模型 2.3 s | 第 7 輪 20 檔 → 2 檔 | ✅ 1.525 s／1.546 s | 在「按開始前到手」的線內 |
| 翻卡掉幀 | 量不到 | 第 3 輪 16 格、第 6 輪 0 格 | 0 格（0–1） | 不掉幀 |
| 卡片閒置主緒 | 量不到 | 第 3 輪 29.1%、第 4 輪無頭 29.8%、第 6 輪 19.3% | 14.6%（14.4–14.9） | 低於 20% 線 |
| 首頁閒置主緒 | 量不到 | 第 3 輪 9.7%、第 6 輪 4.8% | 4.6%（4.5–5.4） | — |
| 出卡最長一幀 | 量不到 | 第 7 輪 48 → 36 ms（無頭） | 36 ms | 每次按「開始練習」一次；見 P-06 |

### 第 3 輪 13 個熱點與延後項、第 1 輪 9 個熱點的現況

| 第 3 輪編號 | 現況 | 本輪數字或依據 |
| --- | --- | --- |
| P-01 翻卡 will-change | ✅ 已改善（6d02075） | 翻卡超過預算 0 格 |
| P-02 背面動畫暫停 | ✅ 已改善（7251dfe） | 卡片閒置 14.6% |
| P-03 星空限 60 格 | ✅ 已改善（a26325d） | 60 格／秒、首頁閒置 4.6% |
| P-04 出卡卡兩格 | 已查明、保留 | 第 7 輪 trace：GPU 第一次點陣化；不改外觀只剩 P-10 能縮；本輪 36 ms，轉為本輪 P-06 |
| P-05 題庫改 fetch | ❌ 量過無效、已還原 | — |
| P-06 字型 CSS 瘦身 | ✅ 由 P-07 取代 | 字型 CSS gzip 4 KB |
| P-07 字型子集化 | ✅ 已改善（214e4dd） | 首頁 2 檔 268 KB、出卡 3 檔 463 KB |
| P-08 存檔延到閒置 | ✅ 已改善（45093a2） | — |
| P-09 page-dim 併入 | ✅ 已改善（157b75f） | — |
| P-10 流光縮小 | ✅ 已改善（bff063f） | 出卡最長一幀 36 ms |
| P-11 汙漬紋理 1 倍 | ✅ 已改善（e349a77） | — |
| P-12 紋理變數一次寫 | ✅ 已改善（82925fd） | — |
| P-13 LINE 不掛載 | ❌ 已還原 | — |
| 延後項：星空隨網址列重抽 | ✅（6d55dd9，第 9 輪實機） | — |
| 延後項：重點字微調開站就抓 | ✅（b0eb94d） | 微調到手 1,074 ms，在題庫 850 ms 之後 |
| 延後項：星芒疊加成本 | 本輪量過，在雜訊內 | 同頁 A／B 14.6% 對 14.9% |

第 1 輪 P-01、P-03（測試重跑 PDF）✅ c11fcc6；P-02（PDF 抽字）、P-04（xlsx 非唯讀）、P-05（RTF 逐 token）未動，本輪重列為 P-02、P-04、P-05；P-06、P-07（npm 包裝）不建議，照舊；P-08（字型 858 KB）✅ 214e4dd；P-09（星空每幀）✅ cf0db1f、a26325d。

### 熱點清單

優先級判準是「使用者實際等待時間 × 發生頻率」。本輪每個有線的入口都在使用者的線內，正表列的是佔比 5% 以上、改了會縮短實際等待的項目；沒有非做不可的。

| 編號 | 熱點 | 所屬進入點 | 實測中位數／最大值 | 取樣次數 | 佔該進入點總時間比例 | 使用者感覺得到嗎（等待 × 頻率） | 疑似原因 | 建議改法 | 預估改善幅度 | 改動風險 | 要不要開宿主 | 狀態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | Corruption 類 7 條破壞型測試，每條重新解析 RTF 與兩份 xlsx | unittest；同時是 run_gate「Python 測試」步驟（32.20 s，92.4%）的主體 | 27.77 s／27.93 s | 5 | 86.2% | 感覺得到：改 tools 後等 32 s、交付前等 35 s，都在 60 s 線內 | `tests/test_convert.py:206-210` 每條 setUp 複製 4 檔 8.6 MB；`:243-297` 6 條各跑 `convert.build(tmp)`，各重跑 read_rtf 0.56 s＋兩份 read_xlsx 1.38 s；`_edit_xlsx`（`:214-218`）再 load＋save 一次。第 2 輪只快取了 PDF | 比照第 2 輪的 PDF 快取：以檔案內容雜湊為鍵快取 `read_rtf`、`read_xlsx` 的結果（深複製回傳），只有真的改了那份檔的那條才重新解析 | 📌 推算省 10–14 s（RTF 7 → 2 次、xlsx 14 → 8 次）；改完用同一腳本重量才算數 | 中：快取鍵必須含內容，否則破壞型測試讀到未破壞的快取而假綠；要重做 `test_rtf_answer_changed_on_disk_is_caught_by_pdf` 與 xlsx 三條的陽性對照 | 否 | 已量 |
| P-02 | `read_pdf_answers` 用 pypdf 逐頁抽字 | convert | 6.27 s／6.35 s | 5 | 69.2% | convert 9.06 s 在 12 s 線內；換版才跑 | `tools/official.py:105` 對 244 頁做完整 `extract_text()`，其實只要每題第一行的「編號＋答案」。⚠️ 本機 pypdf 6.12.1，CI 與 requirements 是 6.19.0 | 第一步零改動：`pip install -r requirements.txt` 換到 6.19.0 後用同一腳本重量，確認本機與 CI 同速；之後再評估 pypdf 的其他抽字模式。換抽字套件屬新增相依，要先問 | 未知 | 中：PDF 是交叉核對的第二來源，抽法一變要重做「RTF 改答案會被 PDF 抓到」的陽性對照 | 否 | 已量 |
| P-03 | `subset_font` 四次子集化 | build_fonts.py --check | 400 ui 3.19／3.20 s、400 bank 4.83／4.85 s、700 ui 3.05／3.08 s、700 bank 4.71／4.74 s | 5 | 合計 97.9% | 感覺得到：16 s，在 30 s 線內；改題庫或介面文字才跑 | `tools/build_fonts.py:93-125` 每個涵蓋切片各建 `TTFont` → `Subsetter` → save，再 `Merger` 合併；同一粗細的切片檔被 ui 與 bank 各解析一次；bank 915 字比 ui 700 字多 1.6 s | 同一粗細一次載入切片、兩個子集共用解析結果；切片解析與子集化的佔比要先拆開再決定 | 未知（沒拆） | 低～中：輸出要逐位元組相同（`--check` 與 `tests/test_fonts.py` 守） | 否 | 已量 |
| P-04 | 是非題 xlsx 用 openpyxl 一般模式載入 | convert；Corruption 每條再各一次 | 1.07 s／1.11 s | 5 | 11.8% | 不太會：在線內；併入 P-01 的重跑次數 | `tools/xlsx_bank.py:94` `load_workbook` 沒開 `read_only`（第 1 輪 P-04 未動） | `read_only=True` | 未知（📌 沒量過） | 低～中：唯讀模式的 cell 少部分屬性，`xlsx_bank.py:114` 的 `row[0].row` 要先驗 | 否 | 已量 |
| P-05 | `read_rtf` 正則逐 token 解析 6.88 MB | convert；Corruption 每條再各一次 | 557.6 ms／560.0 ms | 5 | 6.2% | 不會 | `tools/official.py:22-49`（第 1 輪 P-05 未動） | 不動解析器，靠 P-01 的快取避免重跑 | — | 中：主來源解析器 | 否 | 已量 |
| P-06 | 按「開始練習」出卡時的最長一幀 | 開始練習 | 36 ms（📌 手機乘 4 約 150 ms） | 5 | 量不到（GPU 緒） | 可能：每次開始練習一次、卡一下 | 第 7 輪 trace 已查明是卡片兩面第一次點陣化，成本在 GPU 執行緒；去流光、去符文、藏背面都要改外觀或重現翻卡 90° 頓點 | 不改外觀下沒有剩餘做法；保留觀察，實機看得出來再議 | — | — | 瀏覽器 | 已量（代量） |

#### 建議先做的三項（都不是必須）

1. P-01：唯一會縮短使用者每天等待的項目（改 tools 後 32 s、交付前 35 s），做法已有第 2 輪 PDF 快取的範本，風險在快取鍵。
2. P-02 的第一步：換到 requirements 釘的 pypdf 6.19.0 重量，零程式碼改動，先確認本機與 CI 的 convert 成本是同一回事。
3. P-03：30 s 線還有 14 s 餘裕、改字才跑，優先度最低；要做先拆「切片解析」與「子集化」的佔比。

#### 不值得做

1. `npm run` 包裝 367 ms 與 node 啟動 392 ms 佔 npm test 83%：使用者對 npm test 沒有要求；CI 與文件都用 `npm test`。
2. npm run build 的 npm／node 啟動 1.27 s（77.8%）：沒有要求。
3. 首頁字型 ui 兩檔 268 KB、1.525 s 到手：在「按開始前到手」的線內；700 粗細那檔 136 KB 要省就得改外觀（合成粗體）。
4. 重點字微調 chunk gzip 18 KB、1.074 s 到手：在線內；比第 3 輪記的 26 KB 原始大 2.6 倍是 6af33bd 加了 1,027 段線索，內容不是效能問題。
5. 星芒 `.star`（drop-shadow＋無限動畫，3,599 題標到 3,582 處）：同頁 A／B 14.6% 對 14.9%，在雜訊內。
6. unittest 其他類：Output 4.4%、HighlightCheck 2.6%＋ReviewChecks 2.2%（9 個子行程）、探索與 setUpClass 3.2%、Fonts 0.1%；都不到 5%。
7. convert 其他段：import convert 3.3%、選擇題 xlsx 3.4%、子行程其餘 2.0%、import pypdf 1.1%、build 其餘 0.9%，各不到 5%。
8. 網站純邏輯（Node 代量）：重點字 `segments()` 每題 0.003 ms、全部 3,599 題 13.3 ms；出題 0.22 ms、stats 0.10 ms、save 1.0 ms、load 1.3 ms、首頁 15 列 5.1 ms；乘 4 後最大的約 21 ms。
9. 翻卡、下一題：超過預算 0 格；星空每幀與首頁閒置 4.6%：已在第 3、5、6 輪處理。
10. 首屏關鍵路徑 gzip 31 KB（第 1 輪 29 KB）：多的是重點字邏輯，開站 0.544 s 在線內。

#### 量不到的部分

1. 手機實機：無頭 Chrome 跑的是桌機 GPU，CPU 4 倍降速不等於手機；GPU 與合成緒的時間頁內拿不到；發燙與耗電只能實機看。替代判斷：照第 1 輪〈量不到的部分〉第 2 條與第 3 輪的實機步驟，由使用者在 Android 上 `chrome://inspect` 錄 Performance。
2. 螢幕 162–165 Hz 的幀預算 9.1 ms 比手機 16.7 ms 嚴，掉幀「0 格」在手機上只會更寬，但絕對幀時間不能直接換算。
3. 第 3／6 輪 pane 上的指標本輪沒重量（量法改以腳本為正本），pane 與無頭的差異只有第 3／4 輪那一組可對照（29.1% 對 29.8%）。
4. CI 時間只讀 GitHub 回報的紀錄，沒有在本機重現 ubuntu runner。
5. pypdf 6.19.0 下的 convert 成本：本機沒裝，見 P-02。
