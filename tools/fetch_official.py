"""從工程會「採購法規題庫」下載全部題庫的 DOC（實為 RTF）與 PDF，存成 data/source/official.rtf／.pdf。

用法：python tools/fetch_official.py
下載完接著跑 python tools/convert.py，它會核對兩份檔案並列出與上一版的差異。
"""
from __future__ import annotations

import http.cookiejar
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://web.pcc.gov.tw/psms/plrtqdm/questionPublic/"
TARGETS = {"DOC": ("official.rtf", b"{\\rtf1"), "PDF": ("official.pdf", b"%PDF")}


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    opener.addheaders = [("User-Agent", "Mozilla/5.0"), ("Referer", BASE + "indexReadQuestion")]
    page = opener.open(BASE + "indexReadQuestion", timeout=60).read().decode("utf-8", "replace")
    m = re.search(r'name="_csrf" value="([^"]+)"', page)
    if not m:
        print("✗ 題庫頁找不到 _csrf，官方網頁可能改版了")
        return 1

    # 兩份都下載成功才覆蓋，避免只換掉一份造成 RTF 與 PDF 版本不同
    fetched = {}
    for fmt, (name, magic) in TARGETS.items():
        form = {"isAllDownload": "DOWNLOADALL", "pdfOrDoc": fmt, "downloadProgrammeType": "z", "_csrf": m.group(1)}
        body = opener.open(BASE + "downloadQuestionAll", data=urllib.parse.urlencode(form).encode(), timeout=600).read()
        if not body.startswith(magic):
            print(f"✗ {fmt} 下載內容不是預期格式（開頭 {body[:20]!r}），未覆蓋任何檔案")
            return 1
        fetched[name] = body
        print(f"✓ {fmt}：{len(body):,} bytes")
    for name, body in fetched.items():
        (ROOT / "data" / "source" / name).write_bytes(body)
    print("已更新 data/source/，接著執行 python tools/convert.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
