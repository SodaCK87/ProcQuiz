# 結構落差與搬移計畫

> 型別：查詢型（一列一筆，靠「編號」與「建議動作」過濾）｜由 /蘇-全面盤點 組 C 產出，每輪整份重建｜本輪 2026-10-02｜基準：[檔案結構規範](檔案結構規範.md)｜本輪一個既有檔都沒動，搬移等使用者回批次編號

標記：`✅` 本輪實測、`⚠️` 已知限制、`📌` 未查證。

## 現況

1. ✅ 頂層（磁碟）：`.claude/`、`.github/`、`data/`、`docs/`、`tests/`、`tmp/`、`tools/`、`web/` 加根目錄 6 檔。追蹤 46 檔，逐檔逐層比對 `git ls-files` 與磁碟大小寫，0 筆不符。
2. ✅ 被忽略的：`tmp/`（102＋2 檔，`tmp/review/` 3.4 MB）、`web/dist/`、`web/node_modules/`、`.claude/launch.json`。
3. ✅ `tmp/` 實際分兩種東西：`tmp/flip-lab/`（翻卡實驗頁，符合「暫存」）與 `tmp/review/`（四輪審查的工作區：法規原文、批次、指控、各輪輸入輸出、`final.json`）。後者被追蹤的 `tools/review/*.py` 三支當資料目錄讀、被 `docs/審查指示/` 四份當路徑引用、被 `data/review/notes.json` 24 行當法規依據引用——這就是交付把關 E10「頂層有出口資料夾：tmp」在本專案的實際內容。
4. ✅ 新檔落點決策樹陽性對照（規範〈新檔案放哪〉逐題走）：

| 檔 | 第一個答「是」的題 | 落點 | 結果 |
| --- | --- | --- | --- |
| `web/src/lib/deck.js`（原始碼） | 第 5 題 | `web/` | 唯一 |
| `data/questions/true-false.json`（產出物） | 第 4 題 | `data/questions/` | 唯一 |
| `tmp/flip-lab/index.html`（暫存） | 第 1 題 | `tmp/` | 唯一 |
| `tmp/review/laws/政府採購法.txt`（審查依據） | 第 1 題答否（刪了 notes.json 的依據就斷），2–9 題皆否 | 第 10 題「先問使用者」 | 有洞，見 S-12 |
| `docs/review-inventory.md`（盤點產出） | 第 9 題只列五種文件，都不是 | 第 10 題 | 有洞，見 S-07 |
| `tools/measure_perf.py`（組 E 本輪建） | 第 7 題「維護用的腳本」 | `tools/` | 唯一；skill 預設的 `scripts/` 不採用，見 S-07 |

5. ✅ 文件行數（`wc -l` 與 `(Get-Content $p -Encoding UTF8).Count` 交叉，兩者全數相同）：

| 文件 | 行數 | 宣告的型 | 上限 | 讀法 |
| --- | --- | --- | --- | --- |
| `README.md` | 82 | 從頭讀型 | 400 | 從頭翻 |
| `目標路線圖.md` | 38 | 從頭讀型 | 120 | 從頭翻 |
| `CLAUDE.md` | 9 | 未宣告 | — | 自動載入 |
| `docs/檔案結構規範.md` | 64 | 從頭讀型 | 100 | 兩者都有 |
| `docs/問題台帳.md` | 18 | 查詢型 | 不設 | 搜編號 |
| `docs/版本紀錄.md` | 5（0 個版本） | 敘事追加型 | 12 個版本 | 從頭翻 |
| `docs/審查指示/指示-第一輪.md` | 76 | 未宣告 | — | 子代理從頭讀 |
| `docs/審查指示/指示-第二輪.md` | 55 | 未宣告 | — | 子代理從頭讀 |
| `docs/審查指示/指示-第三輪.md` | 42 | 未宣告 | — | 子代理從頭讀 |
| `docs/審查指示/指示-第四輪.md` | 36 | 未宣告 | — | 子代理從頭讀 |
| `docs/review-inventory.md` | 86 | 查詢型 | 不設 | 搜編號 |
| `docs/probe-gap-list.md` | 30 | 查詢型 | 不設 | 搜編號 |

## 表一：位置與命名違規

引用數用 ripgrep 對全專案（排除 `tmp/`、`web/node_modules/`、`web/dist/`、盤點台帳與缺口清單）實搜，陽性對照：`convert.py` 搜得到程式 6、文件 3 行，中文樣式 `審查指示` 搜得到 3 行，搜法沒壞。`tools/review/` 是 glob 消費者，檔名不出現在程式碼，所以改搜目錄常數 `"tmp" / "review"`。

| 編號 | 檔案 | 現在位置 | 依規則應在哪 | 建議動作 | 引用數 | 風險 |
| --- | --- | --- | --- | --- | --- | --- |
| S-01 | 審查工作區：`batches/`（41）、`findings/`（26）、`round2/`～`round4-out/`、`final.json`、`answer-doubts.json` | `tmp/review/` | 規範無位置；方案 A：`data/review/work/`（進版控） | 搬移＋規範加列 | 程式 3（`tools/review/` 三支的目錄常數，`round1_check.py:8`、`round2_build.py:7`、`round2_check.py:8`）；文件 14 行（審查指示四份） | ✅ 乾淨 clone 跑 `round1_check.py` 印「批次題數 0，已涵蓋 0，未涵蓋 0」退出 0（原專案同指令印 2700／2700，陽性對照）；`round2_check.py` 擲 FileNotFoundError。照規範「`tmp/` 隨時可整個刪掉」做，唯一一份審查證據就沒了，它不在 git 歷史 |
| S-02 | `政府採購法.txt`、`政府採購法施行細則.txt` | `tmp/review/laws/` | `data/review/work/laws/`（跟 S-01 一起） | 搬移；檔名照命名第 1 條要改英文，或規範加例外（📌 要使用者決定） | 程式 0（經 S-01 的目錄常數）；文件 5 行；資料 24 行（`notes.json` 依據欄寫死 `tmp/review/laws/...`） | 改 `notes.json` 的路徑字串等於動審查定案檔，專案 CLAUDE.md 第 5 條要求經審查流程（📌 路徑字串算不算實質修改要使用者決定）；✅ `data/questions/` 沒有這段字串（rg 0 筆），改它不影響題庫 JSON |
| S-03 | `docs/審查指示/指示-第二輪.md:11` 的引用 `tmp/review/指示-第一輪.md` | 指向 `tmp/` 的副本 | 指向正本 `docs/審查指示/指示-第一輪.md` | 改引用 | 1 行 | ✅ 兩份目前逐字相同（diff）；乾淨 clone 裡指向的檔不存在 |
| S-04 | `round1_check.py`、`round2_build.py`、`round2_check.py`、`指示-第一～四輪.md`（7 檔） | `tmp/review/` | 正本已在 `tools/review/`、`docs/審查指示/` | 刪除（先備份到 `%TEMP%`：`tmp/` 不在 git 歷史，刪了救不回） | 程式 0；文件 1（就是 S-03 那行，先改） | ✅ 腳本與正本只差 `R =` 那一行（舊版用 `Path(__file__).parent`）；指示四份與正本相同 |
| S-05 | `tmp/flip-lab/parchment.html` | `tmp/flip-lab/` | 已有正本 `web/prototype/card-style.html` | 刪除 | 0／0 | ✅ `cmp` 逐位元組相同 |
| S-06 | `tmp/flip-lab/index.html` | `tmp/flip-lab/` | `tmp/`（符合規範） | 留或刪由使用者決定 | 0／0 | 無；翻卡樣式已定案（路線圖〈翻卡動畫〉） |
| S-07 | `docs/review-inventory.md`、`probe-gap-list.md`、`structure-plan.md`，以及組 E 的 `perf-baseline.md`（22:05 尚未出現） | `docs/` | 命名第 1 條要中文檔名；第 9 題沒有這類文件。組 E 的量測腳本實際建在 `tools/measure_perf.py`（22:05 看到），合規範第 7 題與 Python 底線命名，不需要 `scripts/` | 改規範收錄，不改名（建議）；規範註明量測腳本放 `tools/` | 程式 0；文件：台帳 1 行；專案外：`/蘇-全面盤點` skill 寫死這些檔名 | 改名會斷掉 skill 的跨輪對照（skill 規定沿用舊檔名）；專案外引用，依規則不進搬移批次 |
| S-08 | `.claude/`（內有 `launch.json`） | 頂層 | 頂層表沒列，規範說不得新增表外頂層資料夾；`.gitignore:21` 有擋但〈不進版控〉表沒有對應列，違反 `.gitignore:1` 自稱「每一行對應一列」 | 改規範：頂層表與〈不進版控〉表各加一列 | 程式 0；文件 0；`.gitignore` 1 行 | 無 |
| S-09 | `docs/審查指示/`（資料夾名中文） | `docs/` | 命名第 1 條：資料夾用英文小寫；但規範自己的頂層表與第 9 題就寫這個名字 | 改規範：加一句「`docs/` 底下的文件資料夾比照文件用中文」（建議）；或改名 `docs/review-prompts/` | 文件 3 行（`README.md:64`、`檔案結構規範.md:15`、`:33`） | 規範自相矛盾；改名要同步三處並驗 README 的連結 |

## 表二：長度違規

✅ 沒有任何文件超過所屬型的上限。下面兩筆是「未歸型」：判準要求每份文件都標型，沒標型就無從判斷有沒有超。

| 編號 | 檔案 | 屬於哪一型 | 現在行數 | 該型上限 | 該下放哪一節 | 下放到哪個檔 | 原處留什麼 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-10 | `CLAUDE.md` | 未宣告；建議從頭讀型 | 9 | 建議 40 | 不需 | — | 加一行型別宣告 |
| S-11 | `docs/審查指示/指示-第一～四輪.md` | 未宣告；建議從頭讀型（給子代理的一次性指示，定案後凍結） | 76／55／42／36 | 建議 100 | 不需 | — | 規範〈頂層資料夾〉的 `docs/` 列寫明型別，各檔不必逐一加 |

## 規範沒回答的題

| 編號 | 題 | 現況 | 建議的明確答案 |
| --- | --- | --- | --- |
| S-12 | 決策樹第 1 題「刪了不影響任何東西」之外，審查流程的工作檔與法規原文該放哪 | 走到第 10 題；實際放在 `tmp/` | 加一題「是審查流程的輸入、指控、中間檔或法規原文嗎 → `data/review/work/`」（方案 A），或寫明不進版控、放哪、留到什麼時候（方案 B） |
| S-13 | 暫存什麼時候清 | 只寫「隨時可整個刪掉」，沒寫時機；實際上沒人敢刪 | 寫死：`tmp/` 只放本次開工內用完即丟的東西，任何追蹤檔不得引用 `tmp/` 路徑（可加進交付把關：`rg -F "tmp/"` 對追蹤檔要 0 筆） |
| S-14 | 每份文件的型別與上限集中在哪 | 散在各檔第 3 行；`CLAUDE.md`、審查指示、盤點產出沒有 | 規範加一張「文件 ｜ 型 ｜ 上限」表，或在第 9 題逐項補型別 |
| S-15 | 同一條規則只有一個正本 | 「`data/questions/` 不得手改」同時寫在 `CLAUDE.md:8` 與 `檔案結構規範.md:50` | 保留 `CLAUDE.md` 那條（會自動載入），規範那句改成「見 CLAUDE.md 第 4 條」；或維持現狀並在規範註明是刻意的 |

## 搬移計畫

R12 是紅燈，所以只排第 3 批（S-01～S-04 與它需要的規範修改）。其他各筆對應黃燈，依規則只列不排。

| 批次 | 內容 | 本輪狀態 |
| --- | --- | --- |
| 第 1 批 | 零引用暫存：S-05、S-06 | 只列不排（黃燈項） |
| 第 2 批 | 可重建產出物移出版控 | 沒有候選：`web/dist/` 已不進版控，`data/questions/` 依規範刻意進版控 |
| 第 3 批 | S-01～S-04 加規範修改 | **排入，等核准**；S-02 的 `notes.json` 字串拆成 3c，可單獨核准 |
| 第 4 批 | S-07（專案外引用：skill）、S-08、S-09、S-10、S-11、S-12～S-15 | 只改規範與型別宣告，本輪不排；S-07 先決定方案 |

### 第 3 批（S-01～S-04）

先選方案：

1. 方案 A（建議）：審查工作區整包進版控，放 `data/review/work/`。代價是 repo 多 3.4 MB（102 檔，未壓縮）；好處是任何一台機器 clone 下來都能重跑核對、查得到 `notes.json` 依據的原文。
2. 方案 B：只把 `laws/` 進版控，其餘中間檔留在 `tmp/review/`，規範寫明「下一輪審查開始前不得刪」。代價是 `tools/review/` 三支在別台機器上仍然跑不動，C-01 的空轉只能靠加檢查擋。

以下按方案 A 寫。每一步都能單獨回復；指令是 PowerShell 5.1。

3a. 備份並搬移（不含 S-04 的 7 個副本）：

```powershell
$P = 'C:\Users\ben12\Downloads\ClaudeOnly\採購題庫-ProcQuiz'
$B = Join-Path $env:TEMP ('pqz-tmp-review-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
Copy-Item -LiteralPath "$P\tmp\review" -Destination $B -Recurse
New-Item -ItemType Directory -Force "$P\data\review\work" | Out-Null
foreach ($n in 'laws','batches','findings','round2','round2-out','round3','round3-out','round4','round4-out','final.json','answer-doubts.json') {
  Move-Item -LiteralPath "$P\tmp\review\$n" -Destination "$P\data\review\work\$n"
}
```

3b. 用 Edit 改引用（含中文的檔不准用 `Set-Content` 轉手）：`tools/review/` 三支的 `R =` 改成 `parents[2] / "data" / "review" / "work"`，`round2_check.py:1` 的說明字串一併改；`docs/審查指示/` 四份的 `tmp/review/` 改成 `data/review/work/`，`指示-第二輪.md:11` 改指 `docs/審查指示/指示-第一輪.md`（S-03）；規範的 `data/review/` 列與決策樹加 S-12 那一題。

3c.（單獨核准）`data/review/notes.json` 依據欄 24 行的 `tmp/review/laws` 改成 `data/review/work/laws`。不核准就不動，改在規範寫一句「`notes.json` 依據欄的 `tmp/review/laws` 指 2026-10-02 起的 `data/review/work/laws`」。

3d. 刪 S-04 的 7 個副本（備份在 `$B`）：

```powershell
foreach ($n in 'round1_check.py','round2_build.py','round2_check.py','指示-第一輪.md','指示-第二輪.md','指示-第三輪.md','指示-第四輪.md') {
  Remove-Item -LiteralPath "$P\tmp\review\$n" -Confirm:$false
}
```

搬完怎麼驗（每一步做完就跑，不要整批做完才驗）：

1. `python tools/review/round1_check.py` 要印「批次題數 2700，已涵蓋 2700，未涵蓋 0」。
2. `python tools/review/round2_check.py` 跑完後 `git diff --stat data/review/work/final.json` 要沒有差異。📌 未查證它重寫的 `final.json` 是否逐位元組相同；不同就先看差異是不是只有順序。
3. `python -m unittest discover -s tests` 要 24 條 OK；`python tools/convert.py` 要印兩次「0 處變動」，且 `git status --porcelain data/questions` 沒有輸出。
4. 對追蹤檔搜 `tmp/review` 要 0 行（搬移前是 6 個檔 39 行，陽性對照）；不做 3c 時剩 `notes.json` 24 行。
5. commit 之後 clone 到 `%TEMP%` 再跑第 1 步，要印 2700／2700（搬移前同一條印 0／0，2026-10-02 實測）。
6. README 的連結本批不動；若選了 S-09 改名，照 `github-docs-verify` 的消費端驗法驗 `README.md:64` 的連結。

驗不過怎麼退：

1. commit 前：`git checkout -- tools docs data/review/notes.json`，再把 `$B` 底下的東西搬回 `tmp\review`：`Copy-Item -Path "$B\*" -Destination "$P\tmp\review" -Recurse -Force`，最後刪掉 `data\review\work`。
2. commit 後：`git revert --no-edit HEAD`，然後同樣從 `$B` 搬回 `tmp\review`。不要用 `git reset --hard`，那會連同別的未 commit 改動一起蓋掉。

結果標級：做到第 1–5 步全過算 `L2`。

### 執行時的硬規則

1. 含中文路徑一律用 `Move-Item`／`Rename-Item`／`Remove-Item -LiteralPath`；改內容一律用 Edit，不可用 `Get-Content` 加 `Set-Content`、`awk`、`sed`。
2. 資料夾只改大小寫時不可用一次 `git mv`，要走兩段（`docs_tmp` 中轉），改完用 `ls` 與 `git -c core.quotepath=off ls-files` 對照。本批沒有這種情況。
3. 每一步搬完立刻跑對應的驗證，不要整批搬完才一次驗。
4. 動到 `.md` 的位置或標題後，照 `github-docs-verify` 的消費端驗法驗目錄連結與錨點。
5. 文件下放出去的那一節，原處只留一行連結，不准兩邊都留一份。
6. `tmp/` 底下的檔不在 git 歷史，刪除前一律先備份到 `%TEMP%`。
