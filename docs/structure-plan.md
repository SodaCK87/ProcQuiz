# 結構落差與搬移計畫

> 型別：查詢型（一列一筆，靠「編號」與「建議動作」過濾）｜由 /蘇-全面盤點 組 C 產出，每輪整份重建｜本輪 2026-10-03｜基準：[檔案結構規範](檔案結構規範.md)｜本輪一個既有檔都沒動，搬移等使用者回批次編號｜上一輪（2026-10-02）的內容在 git：`git show 1e8d320:docs/structure-plan.md`

標記：`✅` 本輪實測、`⚠️` 已知限制、`📌` 未查證。

## 現況

1. ✅ 頂層（磁碟）：`.claude/`、`.github/`、`data/`、`docs/`、`tests/`、`tools/`、`web/` 加根目錄 6 檔（`README.md`、`目標路線圖.md`、`CLAUDE.md`、`.gitignore`、`.gitattributes`、`requirements.txt`）。上一輪的 `tmp/` 已不存在（c083012）。追蹤 194 檔，`git -c core.quotepath=off ls-files` 與 `find` 的完整路徑逐字比對（大小寫敏感），194 對 194、0 筆不符。
2. ✅ 被忽略的只有四類：`tools/__pycache__/`（1 個 `.pyc`，來源 `measure_perf.py` 仍在，不是化石）、`web/dist/`、`web/node_modules/`、`.claude/launch.json`。`git ls-files -i -c --exclude-standard` 0 筆（沒有「被追蹤卻該忽略」）、`git ls-files --others --exclude-standard` 0 筆（沒有「沒追蹤也沒忽略」）。
3. ✅ 上一輪紅燈（審查工作區在被忽略的 `tmp/review/`）的搬移批次已照計畫做完且落點唯一：`data/review/work/` 125 檔進版控（cc0607e）；`tools/review/` 三支的目錄常數都指 `parents[2] / "data" / "review" / "work"`（`round1_check.py:8`、`round2_build.py:7`、`round2_check.py:8`），`highlight_check.py:18` 同；`data/review/notes.json` 依據欄已改指 `data/review/work/laws/`（對追蹤檔搜 `tmp/review` 剩 9 個審查原始紀錄 JSON 與規範、效能基準各 1 行，規範 `data/review/` 列已註明那是當時路徑不改寫）。在 `%TEMP%` 的乾淨 clone（d87d6a0）實跑：`round1_check.py` 印「批次題數 2700，已涵蓋 2700，未涵蓋 0」退出 0；`round2_check.py` 重寫 `final.json` 後 `git status --porcelain` 空（逐位元組重現）；`convert.py --check` 退出 0。陽性對照：把 clone 的 `data/review/work` 改名後 `round1_check.py` 印「✗ 找不到審查批次」退出 1、`highlight_check.py` 印「✗ 找不到 data\review\work\highlight\trap.json」退出 1。
4. ✅ 新檔落點決策樹陽性對照（規範〈新檔案放哪〉逐題走）：

| 檔 | 第一個答「是」的題 | 落點 | 結果 |
| --- | --- | --- | --- |
| `web/src/lib/deck.js`（原始碼） | 第 5 題 | `web/` | 唯一 |
| `data/questions/true-false.json`（產出物） | 第 4 題 | `data/questions/` | 唯一 |
| 本機暫存（例如上一輪的 `tmp/flip-lab/index.html`） | 第 1 題 | `%TEMP%`，不在 repo | 唯一，三者位置互不相同 |
| `data/review/work/laws/政府採購法.txt`（審查依據） | 第 3 題 | `data/review/work/` | 唯一（上一輪的洞 S-12 已補） |
| `tools/measure_browser.mjs`（組 E 本輪新增） | 第 7 題「量測用的腳本」 | `tools/` | 唯一；規範 `tools/` 列已明列它 |
| `web/src/lib/highlight-fixes.json`（由審查紀錄重建、網站 import） | 第 4 題「`tools/` 腳本產生的題庫資料嗎」答是 | `data/questions/` | 與實際位置 `web/src/lib/` 不同，見 S-03 |
| `docs/perf-baseline.md`（盤點產出） | 第 9 題只列五種文件，都不是 | 第 10 題「先問使用者」 | 有洞，見 S-02 |
| `.claude/launch.json`（本機預覽設定） | 第 1 題答否（刪了預覽就開不起來）、2–9 題皆否 | 第 10 題 | 有洞，見 S-01 |

5. ✅ 文件行數（`wc -l` 與 `(Get-Content $p -Encoding UTF8).Count` 交叉，17 檔全數相同）：

| 文件 | 行數 | 宣告的型 | 上限 | 讀法 |
| --- | --- | --- | --- | --- |
| `README.md` | 97 | 從頭讀型（第 3 行） | 400 | 從頭翻 |
| `目標路線圖.md` | 38 | 從頭讀型（第 3 行） | 120 | 從頭翻 |
| `CLAUDE.md` | 9 | 未宣告 | — | 自動載入 |
| `docs/檔案結構規範.md` | 63 | 從頭讀型（第 3 行） | 100 | 兩者都有 |
| `docs/問題台帳.md` | 22 | 查詢型（第 3 行） | 不設 | 搜編號 |
| `docs/版本紀錄.md` | 13（1 個版本） | 敘事追加型（第 3 行） | 12 個版本 | 從頭翻 |
| `docs/審查指示/指示-第一輪.md` | 76 | 未宣告 | — | 子代理從頭讀 |
| `docs/審查指示/指示-第二輪.md` | 55 | 未宣告 | — | 子代理從頭讀 |
| `docs/審查指示/指示-第三輪.md` | 42 | 未宣告 | — | 子代理從頭讀 |
| `docs/審查指示/指示-第四輪.md` | 36 | 未宣告 | — | 子代理從頭讀 |
| `docs/審查指示/指示-重點字第一輪.md` | 45 | 未宣告 | — | 子代理從頭讀 |
| `docs/審查指示/指示-重點字線索核對.md` | 52 | 未宣告 | — | 子代理從頭讀 |
| `docs/審查指示/指示-重點字成對補核.md` | 14 | 未宣告 | — | 子代理從頭讀 |
| `docs/review-inventory.md` | 87 | 查詢型（檔頭） | 不設 | 搜編號 |
| `docs/probe-gap-list.md` | 30 | 查詢型（檔頭） | 不設 | 搜編號 |
| `docs/structure-plan.md` | 141（本輪重建前） | 查詢型（檔頭） | 不設 | 搜編號 |
| `docs/perf-baseline.md` | 398 | 查詢型、只增不改（檔頭） | 不設 | 搜編號 |

6. ✅ 交付把關 `Probe-Delivery.ps1 -Project` 本輪 12 項全 PASS、退出碼 0：E0（規範列的 4 份文件都在）、E9（沒有帶版號的檔名）、E10（頂層列舉得完）、E11（頂層 14 項大小寫對得上）。

## 表一：位置與命名違規

引用數用 grep 對全專案（排除 `web/node_modules/`、`web/dist/`、盤點產出三檔）實搜，程式碼涵蓋 `.py`／`.js`／`.svelte`／`.mjs`／`.yml`／`.json`，文件涵蓋 `.md`。陽性對照：`convert.py` 搜得到程式 11、文件 22 行；中文樣式 `審查指示` 搜得到文件 6 行，搜法沒壞。`tools/review/` 是 glob 消費者，檔名不出現在程式碼，所以 S-05 改看 glob 樣式。

| 編號 | 檔案 | 現在位置 | 依規則應在哪 | 建議動作 | 引用數 | 風險 |
| --- | --- | --- | --- | --- | --- | --- |
| S-01 | `.claude/launch.json` | 頂層 `.claude/` | 規範〈頂層資料夾〉沒列 `.claude/`，又寫「不得新增上表以外的頂層資料夾」；〈不進版控〉表沒有對應列，但 `.gitignore:18` 有擋，違反 `.gitignore:1` 自稱「每一行對應規範的一列」 | 改規範：頂層表加 `.claude/` 一列（本機預覽設定，不進版控）、〈不進版控〉表加一列；檔案不動 | 程式 0；文件 0；`.gitignore` 1 行 | 無；上一輪 S-08 原樣未處理 |
| S-02 | `docs/review-inventory.md`、`probe-gap-list.md`、`structure-plan.md`、`perf-baseline.md` | `docs/` | 命名第 1 條要中文檔名；第 9 題只列五種文件，盤點產出走到第 10 題 | 改規範收錄（第 9 題加「盤點產出放 `docs/`，檔名沿用 /蘇-全面盤點 skill 的固定英文名」），不改名 | 程式 3（`tools/measure_perf.py` 提到 `perf-baseline`）；文件：台帳檔頭互連 3 行；專案外：`~\.claude\skills\蘇-全面盤點\SKILL.md` 寫死這四個檔名 | 改名會斷掉 skill 的跨輪對照；專案外引用，依規則不進搬移批次。上一輪 S-07 原樣未處理 |
| S-03 | `web/src/lib/highlight-fixes.json` | `web/src/lib/` | 決策樹第 4 題「`tools/` 腳本產生的題庫資料」答是 → `data/questions/`，與實際位置不同；〈產出物〉表也沒列它。實際上它由 `data/review/work/highlight/` 的核對紀錄重建而來，`highlight_check.py` 只比對不寫檔，所以沒有重建指令 | 改規範（建議）：第 4 題改寫成「`convert.py` 轉出的題庫 JSON」、〈產出物〉加一列並寫明「重建＝照 README 改紀錄後手改 JSON，`highlight_check.py` 比對守一致」；或搬到 `data/` 並改 `App.svelte:50` 的 import（📌 要使用者決定；搬了就不再被 Vite 打包） | 程式 11（`App.svelte:50` import、`highlight.js:44`、`highlight.test.js:44,46`、`highlight_check.py:5,20,112,118`、`test_review_tools.py:55,63,77`）；文件 3（README） | 不搬就無風險；搬要同步改 import 與兩支測試的路徑，並重跑 `npm test` 與 Python 測試 |
| S-04 | `docs/審查指示/`（7 檔） | `docs/審查指示/` | 命名第 1 條：資料夾檔名用英文小寫；但規範頂層表 `docs/` 列與第 9 題自己寫這個中文名 | 改規範：命名第 1 條加「`docs/` 底下只放文件的資料夾比照文件用中文」（建議）；或改名 `docs/review-prompts/` 並同步 README 連結 | 程式 0；文件 6 行（`README.md:28,79`、規範 2、版本紀錄／問題台帳 2） | 規範自相矛盾；改名要驗 `README.md:79` 的連結（`github-docs-verify`）。上一輪 S-09 原樣未處理 |
| S-05 | `data/review/work/findings/R23.superseded` 與 `R23b.json` | `data/review/work/findings/` | 同一位審查員（R23）的兩版產出，現行版檔名帶「b」，命名第 3 條「現行版檔名不帶版號」；但規範 `data/review/` 列又說各輪產出是原始紀錄不改寫，兩條相衝 | 改規範：`data/review/` 列加「`work/` 內作廢的產出以 `.superseded` 副檔名原地保留，不適用版號規則」；檔案不動 | 程式 0（`round2_build.py:15`、`round1_check.py:19` 只 glob `*.json`，`.superseded` 不會被讀）；文件 0 | 無：入口只讀 `R23b.json` |

## 表二：長度違規

✅ 沒有任何文件超過所屬型的上限。下面兩筆是「未歸型」：判準要求每份文件都標型，沒標型就無從判斷有沒有超。

| 編號 | 檔案 | 屬於哪一型 | 現在行數 | 該型上限 | 該下放哪一節 | 下放到哪個檔 | 原處留什麼 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-06 | `CLAUDE.md` | 未宣告；建議從頭讀型 | 9 | 建議 40 | 不需 | — | 加一行型別宣告（上一輪 S-10 原樣未處理） |
| S-07 | `docs/審查指示/` 7 檔 | 未宣告；建議從頭讀型（給子代理的一次性指示，定案後凍結） | 14～76 | 建議 100 | 不需 | — | 規範〈頂層資料夾〉的 `docs/` 列寫明型別，各檔不必逐一加（上一輪 S-11 原樣未處理） |

## 規範沒回答的題

上一輪的 S-12（審查工作區放哪）與 S-13（暫存何時清）已由第 3 題與第 1 題回答，本輪不列。

| 編號 | 題 | 現況 | 建議的明確答案 |
| --- | --- | --- | --- |
| S-08 | 每份文件的型別與上限集中在哪 | 散在各檔第 3 行；`CLAUDE.md`、審查指示 7 檔沒有 | 規範加一張「文件 ｜ 型 ｜ 上限」表，或在第 9 題逐項補型別 |
| S-09 | 同一條規則只有一個正本 | 「`data/questions/` 不得手改」同時寫在 `CLAUDE.md:8` 與 `檔案結構規範.md:50` | 保留 `CLAUDE.md` 那條（會自動載入），規範那句改成「見 CLAUDE.md 第 4 條」；或維持現狀並在規範註明是刻意的 |

## 搬移計畫

本輪 R12～R15 沒有紅燈，所以不排任何批次；下表只列，等使用者回編號才動。S-01、S-02、S-04、S-05、S-08、S-09 都只改規範本體、不動檔案，不屬搬移。

| 批次 | 內容 | 本輪狀態 |
| --- | --- | --- |
| 第 1 批 | 零引用的暫存／實驗檔 → 封存 | 沒有候選：repo 內已無暫存檔，`tmp/` 已移除 |
| 第 2 批 | 可重建的產出物 → 移出版控 | 沒有候選：`web/dist/` 已不進版控；`data/questions/` 與字型檔依規範刻意進版控，✅ `convert.py --check`（clone）與 `build_fonts.py --check`（工作樹）本輪都退出 0 |
| 第 3 批 | 有引用、引用全在專案內 → 搬移＋同步改引用 | 只有 S-03 的「搬到 `data/`」方案；只列不排，先等使用者在 S-03 兩個方案中選 |
| 第 4 批 | 有專案外引用 | S-02（skill 寫死檔名），本輪不搬 |

### 第 3 批若核准（S-03 搬移方案）要怎麼做

1. `Move-Item -LiteralPath "$P\web\src\lib\highlight-fixes.json" -Destination "$P\data\review\highlight-fixes.json"`（PowerShell 5.1；`$P` 是專案根）。
2. 用 Edit 改 `web/src/App.svelte:50` 的 import、`web/src/lib/highlight.test.js:44` 的 `readFileSync` 路徑、`tools/review/highlight_check.py:20` 的 `FIXES`、`tests/test_review_tools.py:63,77` 的路徑；規範〈產出物〉加一列、第 4 題改寫。
3. 驗：在 `web/` 跑 `npm test` 要 29 條全過；`python -m unittest discover -s tests` 要 32 條 OK；`npm run build` 後 `web/dist/assets/` 要有 `highlight-fixes-*.js`（📌 搬出 `src/` 後 Vite 是否仍打包成 chunk 未查證，不打包就要改成 `fetch`）。
4. 退：commit 前 `git checkout -- web tools tests docs` 再 `Move-Item` 搬回；commit 後 `git revert --no-edit HEAD`。不用 `git reset --hard`。
5. 結果標級：第 3 步全過算 `L2`。

### 執行時的硬規則

1. 含中文路徑一律用 `Move-Item`／`Rename-Item`／`Remove-Item -LiteralPath`；改內容一律用 Edit，不可用 `Get-Content` 加 `Set-Content`、`awk`、`sed`。
2. 資料夾只改大小寫時不可用一次 `git mv`，要走兩段（`docs_tmp` 中轉），改完用 `ls` 與 `git -c core.quotepath=off ls-files` 對照。本輪沒有這種情況。
3. 每一步搬完立刻跑對應的驗證，不要整批搬完才一次驗。
4. 動到 `.md` 的位置或標題後，照 `github-docs-verify` 的消費端驗法驗目錄連結與錨點。
5. 文件下放出去的那一節，原處只留一行連結，不准兩邊都留一份。

## 2026-10-03 處置（/蘇-一路做完）

S-01～S-09 全部以改規範處理，一個檔都沒搬：`docs/檔案結構規範.md` 頂層表加 `.claude/` 列、〈不進版控〉加 `launch.json` 列（S-01）；第 9 題與〈命名〉1 收錄盤點產出四檔的英文名（S-02）；第 4 題改寫成「`convert.py` 轉出的題庫 JSON」、〈產出物〉加 `highlight-fixes.json` 列（S-03，選改規範不搬檔）；〈命名〉1 加「`docs/` 下只放文件的資料夾用中文」（S-04）；〈命名〉3 加 `.superseded` 例外（S-05）；`CLAUDE.md` 第 3 行加型別宣告（S-06）；`docs/` 列寫明審查指示的型別（S-07）；新增〈文件型別〉索引表（S-08）；題庫 JSON 不得手改只留 `CLAUDE.md` 第 4 條為正本（S-09）。
