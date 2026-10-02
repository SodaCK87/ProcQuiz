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
