"""README 與其他文件對得上的測試。執行：python -m unittest discover -s tests -v

問題台帳裡還開著的缺陷（🔴）與改好但沒探針的（🟡），讀 README 的人看不到台帳，編號一定要出現在 README 的已知限制。
README〈狀態〉寫的兩個測試條數是手打的，兩輪盤點都抓到落後（30 對 32、25 對 29）；這裡拿實際載入的條數比對（全面盤點 C-01）。
1 MiB 以上的檔進版控會讓 repo 隨換版線性長大，規範的「進版控」欄要寫得出理由（全面盤點 B-04）。
"""
import json
import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATUSES = ("🔴", "🟡", "✅", "⏸")


def python_test_count():
    # 不用 defaultTestLoader：python -m unittest -k 會把名稱過濾掛在它身上，數出來只剩被挑中的那幾條
    tests = str(ROOT / "tests")
    return unittest.TestLoader().discover(tests, top_level_dir=tests).countTestCases()


def npm_test_count():
    """跟 README 說的同一個指令：web/package.json 的 test 是 node --test "src/lib/*.test.js"，tap 輸出末尾有 # tests N。"""
    node = shutil.which("node")
    if not node:
        raise AssertionError("找不到 node：README 的 npm test 條數要用 node --test 數出來（網站本來就要 Node 24）")
    r = subprocess.run([node, "--test", "--test-reporter", "tap", "src/lib/*.test.js"], cwd=ROOT / "web",
                       capture_output=True, text=True, encoding="utf-8")
    m = re.search(r"^# tests (\d+)$", r.stdout, re.M)
    if not m:
        raise AssertionError(f"node --test 沒印出 # tests N（退出碼 {r.returncode}）：{r.stderr[-300:]}")
    return int(m.group(1))


def ledger_rows():
    """回傳問題台帳的 [(編號, 狀態欄)]。欄數不是 6 就擲錯：格子裡混進 | 會讓狀態欄錯位而假綠。"""
    rows = []
    for line in (ROOT / "docs" / "問題台帳.md").read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\|\s*(PQZ-\d{2})\s*\|", line)
        if not m:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) != 6:
            raise AssertionError(f"{m.group(1)} 那一列有 {len(cells)} 欄，不是 6 欄；格子裡不能有 |")
        rows.append((m.group(1), cells[4]))
    return rows


class Readme(unittest.TestCase):
    def test_open_defects_are_listed_in_readme(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        rows = ledger_rows()
        self.assertTrue(rows, "問題台帳沒讀到任何 PQZ 列")
        for pid, status in rows:
            self.assertTrue(status.startswith(STATUSES), f"{pid} 的狀態「{status[:6]}」認不出來，開放與否算不準")
            if status.startswith(("🔴", "🟡")):
                # 不用 assertIn：失敗訊息會把整份 README 印出來
                self.assertTrue(pid in readme, f"{pid} 在問題台帳是 {status[:4]}，README 沒提到它")

    def test_large_tracked_files_have_a_reason_in_the_spec(self):
        # 1 MiB 以上的已追蹤檔，在 docs/檔案結構規範.md〈頂層資料夾〉對應列的「進版控」欄不能只寫「是」
        spec = (ROOT / "docs" / "檔案結構規範.md").read_text(encoding="utf-8")
        rows = {}
        for line in spec.splitlines():
            m = re.match(r"^\|\s*`([^`]+)`\s*\|(.*)\|\s*$", line)
            if m and m.group(1).endswith("/"):
                rows[m.group(1)] = [c.strip() for c in m.group(2).split("|")][-1]
        self.assertTrue(rows, "規範〈頂層資料夾〉表沒讀到任何列")
        files = subprocess.run(["git", "-c", "core.quotepath=off", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout.decode("utf-8").split("\0")
        big = [f for f in files if f and (ROOT / f).stat().st_size >= 1 << 20]
        self.assertTrue(big, "沒有 1 MiB 以上的追蹤檔：官方 RTF 不在了？")
        for f in big:
            with self.subTest(f):
                hit = [p for p in rows if f.startswith(p)]
                self.assertTrue(hit, f"{f} 在規範〈頂層資料夾〉找不到對應的資料夾列")
                cell = rows[max(hit, key=len)]
                self.assertTrue(cell.startswith("是") and len(cell) > 6, f"{f} 有 {(ROOT / f).stat().st_size >> 20} MiB，規範 {max(hit, key=len)} 的「進版控」欄只寫「{cell}」，要寫理由")

    def test_support_range_matches_the_configs(self):
        # README〈狀態〉寫的 Node／Python／瀏覽器下限是手打的（D-02）：對 package.json engines、pages.yml、vite build.target
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        ci = (ROOT / ".github" / "workflows" / "pages.yml").read_text(encoding="utf-8")
        engines = json.loads((ROOT / "web" / "package.json").read_text(encoding="utf-8")).get("engines", {})
        node_engine = re.search(r">=\s*(\d+)", engines.get("node", ""))
        node_ci = re.search(r"node-version:\s*'?(\d+)", ci)
        py_ci = re.search(r"python-version:\s*'?(\d+\.\d+)", ci)
        self.assertTrue(node_engine and node_ci and py_ci, "package.json engines.node、pages.yml 的 node-version／python-version 有一個讀不到")
        self.assertEqual(node_engine.group(1), node_ci.group(1), "package.json engines.node 與 CI 的 node-version 不同版")
        for s in (f"Node {node_ci.group(1)}", f"Python {py_ci.group(1)}"):
            self.assertTrue(s in readme, f"README 沒寫「{s}」（CI 用的版本）")
        vite = (ROOT / "web" / "vite.config.js").read_text(encoding="utf-8")
        m = re.search(r"target:\s*\[([^\]]+)\]", vite)
        self.assertTrue(m, "vite.config.js 沒有明寫 build.target")
        target = dict(re.findall(r"'([a-z]+)([\d.]+)'", m.group(1)))
        self.assertEqual(target["chrome"], target["edge"]); self.assertEqual(target["safari"], target["ios"])
        for s in (f"Chrome／Edge {target['chrome']}", f"Firefox {target['firefox']}", f"Safari／iOS {target['safari']}"):
            self.assertTrue(s in readme, f"README 沒寫「{s}」（vite build.target）")

    def test_status_counts_match_the_suites(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        for label, pattern, actual in (
            ("Python", r"`python -m unittest discover -s tests` (\d+) 條全綠", python_test_count()),
            ("npm", r"`npm test`（在 `web/`）(\d+) 條全綠", npm_test_count()),
        ):
            with self.subTest(label):
                m = re.search(pattern, readme)
                self.assertTrue(m, f"README〈狀態〉找不到「{label} … N 條全綠」那句，條數沒得比")
                self.assertEqual(int(m.group(1)), actual, f"README 寫 {label} 測試 {m.group(1)} 條，實際載入 {actual} 條；改 README 第 11–12 行")


if __name__ == "__main__":
    unittest.main()
