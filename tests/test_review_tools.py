"""審查核對腳本（tools/review/）的測試。執行：python -m unittest discover -s tests -v

審查工作區曾放在被忽略的 tmp/，換一台電腦時核對腳本印「0 之 0 全涵蓋」並退出 0。
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools" / "review"
ENV = {**os.environ, "PYTHONIOENCODING": "utf-8"}


def run(script: Path):
    return subprocess.run([sys.executable, str(script)], capture_output=True, text=True, encoding="utf-8", env=ENV)


class ReviewChecks(unittest.TestCase):
    def test_round1_covers_every_question(self):
        r = run(TOOLS / "round1_check.py")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("批次題數 2700，已涵蓋 2700，未涵蓋 0", r.stdout)

    def test_round2_reproduces_committed_final(self):
        # round2_check 會重寫 final.json，在複本上跑，再與已提交的那份比；
        # 它用文字模式寫檔，Windows 寫出 CRLF、Linux 寫出 LF，換行先統一再比
        with tempfile.TemporaryDirectory() as d:
            shutil.copytree(ROOT / "data" / "review" / "work", Path(d) / "data" / "review" / "work")
            (Path(d) / "tools" / "review").mkdir(parents=True)
            script = shutil.copy(TOOLS / "round2_check.py", Path(d) / "tools" / "review")
            r = run(Path(script))
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            lf = lambda p: p.read_bytes().replace(b"\r\n", b"\n")
            self.assertEqual(lf(Path(d) / "data" / "review" / "work" / "final.json"),
                             lf(ROOT / "data" / "review" / "work" / "final.json"))

    def test_missing_workspace_fails_loudly(self):
        # 把腳本放進沒有審查資料的目錄樹，模擬資料目錄不在的機器
        for name in ("round1_check.py", "round2_build.py", "round2_check.py", "highlight_check.py"):
            with self.subTest(name), tempfile.TemporaryDirectory() as d:
                (Path(d) / "tools" / "review").mkdir(parents=True)
                script = shutil.copy(TOOLS / name, Path(d) / "tools" / "review")
                r = run(Path(script))
                self.assertNotEqual(r.returncode, 0, r.stdout)
                # 只認自己的訊息：中文 Windows 的 OSError 也寫「找不到指定的路徑」，會讓這條假綠
                self.assertIn("✗ 找不到", r.stderr)


class HighlightCheck(unittest.TestCase):
    """重點字答案線索：核對紀錄要撐得起上線的 highlight-fixes.json"""

    @staticmethod
    def copy_tree(d: Path):
        # 只複製核對腳本會讀的東西，在複本上動手腳
        for sub in ("data/review/work/highlight", "data/review/work/laws", "data/questions"):
            shutil.copytree(ROOT / sub, d / sub)
        (d / "web" / "src" / "lib").mkdir(parents=True)
        shutil.copy(ROOT / "web" / "src" / "lib" / "highlight-fixes.json", d / "web" / "src" / "lib")
        (d / "tools" / "review").mkdir(parents=True)
        return Path(shutil.copy(TOOLS / "highlight_check.py", d / "tools" / "review"))

    def test_records_rebuild_committed_fixes(self):
        r = run(TOOLS / "highlight_check.py")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("上線 1027", r.stdout)

    def test_tampering_is_caught(self):
        # 陽性對照：竄改一條依據引文、或在微調裡偷加一段沒核對過的線索，都要退出非零
        cases = {
            "evidence": ("data/review/work/highlight/verify/v01.json", lambda d: next(
                v.update(evidence="這段引文不在任何原文裡") for v in d.values() if v["verdict"] == "pass")),
            "unreviewed": ("web/src/lib/highlight-fixes.json", lambda d: d.setdefault("tf-01-0001", {}).setdefault("add", []).append("物價")),
        }
        for name, (rel, mutate) in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as d:
                script = self.copy_tree(Path(d))
                f = Path(d) / rel
                data = json.loads(f.read_text(encoding="utf-8"))
                mutate(data)
                f.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                r = run(script)
                self.assertNotEqual(r.returncode, 0, r.stdout)
                self.assertIn("✗", r.stderr)


if __name__ == "__main__":
    unittest.main()
