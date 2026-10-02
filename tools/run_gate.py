"""交付把關的唯一入口：本機交付前與 CI（.github/workflows/pages.yml）跑的是同一支。

依序跑 Python 測試（含「已提交的題庫 JSON 等於重跑轉檔結果」與審查核對）、網站測試、網站建置，
任一步失敗就退出非零；全部跑完才印總表，失敗的那步不會擋住後面幾步的結果。

用法：python tools/run_gate.py
前置：pip install -r requirements.txt；在 web/ 執行過 npm ci（或 npm install）。
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from time import perf_counter

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"

# 名稱、指令、工作目錄
STEPS = [
    ("Python 測試", [sys.executable, "-m", "unittest", "discover", "-s", "tests"], ROOT),
    ("網站測試", ["npm", "test"], WEB),
    ("網站建置", ["npm", "run", "build"], WEB),
]


def run(cmd: list[str], cwd: Path) -> int:
    # Windows 上 npm 是 npm.cmd，subprocess 不經 shell 時要給完整路徑才找得到
    exe = shutil.which(cmd[0]) or cmd[0]
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    return subprocess.run([exe, *cmd[1:]], cwd=cwd, env=env).returncode


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    results = []
    for name, cmd, cwd in STEPS:
        print(f"\n=== {name}：{' '.join(cmd[1:] if cmd[0] == sys.executable else cmd)} ===", flush=True)
        t = perf_counter()
        rc = run(cmd, cwd)
        results.append((name, rc, perf_counter() - t))
    print("\n=== 交付把關結果 ===")
    for name, rc, sec in results:
        print(f"{'✓' if rc == 0 else '✗'} {name}（{sec:.1f} 秒）" + ("" if rc == 0 else f"：退出碼 {rc}"))
    failed = [name for name, rc, _ in results if rc != 0]
    print("全部通過" if not failed else f"沒過：{'、'.join(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
