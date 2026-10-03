"""README 與其他文件對得上的測試。執行：python -m unittest discover -s tests -v

問題台帳裡還開著的缺陷（🔴）與改好但沒探針的（🟡），讀 README 的人看不到台帳，編號一定要出現在 README 的已知限制。
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATUSES = ("🔴", "🟡", "✅", "⏸")


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


if __name__ == "__main__":
    unittest.main()
