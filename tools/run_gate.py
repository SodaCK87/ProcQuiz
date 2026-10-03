"""交付把關的唯一入口：本機交付前與 CI（.github/workflows/pages.yml）跑的是同一支。

依序跑 Python 測試（含「已提交的題庫 JSON 等於重跑轉檔結果」與審查核對）、網站測試、網站建置、建置產出檢查
（頁尾印得出程式版本、commit 與回報連結；package.json、最近的 tag、版本紀錄最新一段三者同版），
任一步失敗就退出非零；全部跑完才印總表，失敗的那步不會擋住後面幾步的結果。

用法：python tools/run_gate.py
前置：pip install -r requirements.txt；在 web/ 執行過 npm ci（或 npm install）；repo 要抓得到 tag（CI 的 checkout 用 fetch-depth 0）。
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from time import perf_counter

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
ISSUES = "github.com/SodaCK87/ProcQuiz/issues"


def git(*args: str) -> str | None:
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def check_dist() -> int:
    """建置產出檢查。頁尾少了版本或回報連結，使用者回報時對不到版本、也不知道去哪講（全面盤點 D-06、D-07）；
    版本的三個落點（web/package.json、最近的 git tag、docs/版本紀錄.md 最新一段）不同就是有人改了版號沒發版或反過來。"""
    problems: list[str] = []
    version = json.loads((WEB / "package.json").read_text(encoding="utf-8"))["version"]
    assets = WEB / "dist" / "assets"
    js = "".join(p.read_text(encoding="utf-8") for p in sorted(assets.glob("index-*.js"))) if assets.exists() else ""
    if not js:
        problems.append("web/dist/assets 沒有 index-*.js：建置沒成功")
    # 與 vite.config.js 同一套取法，CI 與本機各自對得上
    commit = (os.environ.get("GITHUB_SHA") or "")[:7] or git("rev-parse", "--short=7", "HEAD") or ""
    for label, needle in (("程式版本字樣", "程式 v"), ("程式版本", version), ("commit 短碼", commit),
                          ("回報連結", ISSUES), ("回報字樣", "回報問題")):
        if not needle or needle not in js:
            problems.append(f"dist 的入口 JS 找不到{label}「{needle}」：頁尾沒印出來")
    tag = git("describe", "--tags", "--abbrev=0")
    if tag is None:
        problems.append("git describe 找不到可到達的 tag：發版要打 tag vX.Y.Z；CI 的 checkout 要 fetch-depth 0 才抓得到")
    elif tag != f"v{version}":
        problems.append(f"最近的 tag {tag} 與 web/package.json 的 {version} 不同：改版號要同時打 tag、寫版本紀錄")
    m = re.search(r"^## (v[\d.]+)", (ROOT / "docs" / "版本紀錄.md").read_text(encoding="utf-8"), re.M)
    if not m or m.group(1) != f"v{version}":
        problems.append(f"docs/版本紀錄.md 最新一段是 {m.group(1) if m else '（沒有版本標題）'}，與 web/package.json 的 {version} 不同")
    for p in problems:
        print(f"✗ {p}")
    if not problems:
        print(f"✓ 頁尾有 v{version}（{commit}）與回報連結；tag、package.json、版本紀錄都是 v{version}")
    return 1 if problems else 0


# 名稱、指令（或函式）、工作目錄
STEPS = [
    ("Python 測試", [sys.executable, "-m", "unittest", "discover", "-s", "tests"], ROOT),
    ("網站測試", ["npm", "test"], WEB),
    ("網站建置", ["npm", "run", "build"], WEB),
    ("建置產出檢查", check_dist, ROOT),
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
        shown = cmd.__name__ + "()" if callable(cmd) else " ".join(cmd[1:] if cmd[0] == sys.executable else cmd)
        print(f"\n=== {name}：{shown} ===", flush=True)
        t = perf_counter()
        rc = cmd() if callable(cmd) else run(cmd, cwd)
        results.append((name, rc, perf_counter() - t))
    print("\n=== 交付把關結果 ===")
    for name, rc, sec in results:
        print(f"{'✓' if rc == 0 else '✗'} {name}（{sec:.1f} 秒）" + ("" if rc == 0 else f"：退出碼 {rc}"))
    failed = [name for name, rc, _ in results if rc != 0]
    print("全部通過" if not failed else f"沒過：{'、'.join(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
