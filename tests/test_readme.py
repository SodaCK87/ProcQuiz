"""README 與其他文件對得上的測試。執行：python -m unittest discover -s tests -v

問題台帳裡還開著的缺陷（🔴）與改好但沒探針的（🟡），讀 README 的人看不到台帳，編號一定要出現在 README 的已知限制。
README〈狀態〉寫的兩個測試條數是手打的，兩輪盤點都抓到落後（30 對 32、25 對 29）；這裡拿實際載入的條數比對（全面盤點 C-01）。
"""
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
