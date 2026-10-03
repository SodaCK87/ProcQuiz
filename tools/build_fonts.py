"""把思源宋體子集化成網站實際用到的字，取代 @fontsource 的上百個 unicode-range 切片。

用法：python tools/build_fonts.py            寫進 web/src/assets/fonts/ 與 web/src/fonts.css
      python tools/build_fonts.py --check    只比對，與已提交的不同就退出 1

來源是 web/node_modules/@fontsource/noto-serif-tc 的 woff2 切片（package-lock 釘版），先在 web/ 跑過 npm ci。
每種粗細切成兩個檔：ui（介面、首頁、課程名稱與 ASCII）開站就用得到；bank（只出現在題目與解析的字）
到了卡片才會被瀏覽器抓。題庫或介面文字改了就要重跑，tests/test_fonts.py 守「每個字都有字形」。
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
from pathlib import Path

from fontTools.merge import Merger
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
PKG = WEB / "node_modules" / "@fontsource" / "noto-serif-tc"
OUT_DIR = WEB / "src" / "assets" / "fonts"
OUT_CSS = WEB / "src" / "fonts.css"
WEIGHTS = (400, 700)
FAMILY = "Noto Serif TC"

# 介面文字的來源：元件、純邏輯、首頁 HTML。題庫檔裡只有課程名稱、題型標籤與版本算介面（首頁就會顯示）
UI_SOURCES = [*sorted((WEB / "src").rglob("*.svelte")), *sorted((WEB / "src" / "lib").glob("*.js")), WEB / "index.html"]
BANKS = [ROOT / "data" / "questions" / f"{k}.json" for k in ("true-false", "multiple-choice")]


def chars_of(text: str) -> set[int]:
    return {ord(c) for c in text if c >= " " and c not in "​﻿"}


def strings(obj) -> list[str]:
    if isinstance(obj, str):
        return [obj]
    if isinstance(obj, dict):
        return [s for v in obj.values() for s in strings(v)]
    if isinstance(obj, list):
        return [s for v in obj for s in strings(v)]
    return []


def charsets() -> tuple[set[int], set[int]]:
    ui = set(range(0x20, 0x7F))
    for p in UI_SOURCES:
        if p.name.endswith(".test.js"):
            continue
        ui |= chars_of(p.read_text(encoding="utf-8"))
    bank = set()
    for p in BANKS:
        data = json.loads(p.read_text(encoding="utf-8"))
        for k in ("label", "generated", "explanationSource", "source"):
            ui |= chars_of(str(data.get(k, "")))
        for c in data["courses"]:
            ui |= chars_of(c["name"])
        bank |= chars_of("".join(strings(data["questions"])))
    return ui, bank - ui


def parse_ranges(spec: str) -> set[int]:
    out = set()
    for part in spec.split(","):
        part = part.strip().removeprefix("U+").removeprefix("u+")
        if "-" in part:
            a, b = part.split("-")
            out |= set(range(int(a, 16), int(b, 16) + 1))
        else:
            out.add(int(part, 16))
    return out


def slices(weight: int) -> list[tuple[Path, set[int]]]:
    css = (PKG / f"{weight}.css").read_text(encoding="utf-8")
    rows = []
    for src, rng in re.findall(r"src: url\(\./files/([^)]+\.woff2)\).*?unicode-range: ([^;]+);", css, re.S):
        rows.append((PKG / "files" / src, parse_ranges(rng)))
    if not rows:
        raise SystemExit(f"讀不到 {PKG / f'{weight}.css'} 的切片；先在 web/ 跑 npm ci")
    return rows


def subset_font(weight: int, want: set[int]) -> tuple[bytes, set[int]]:
    """把涵蓋 want 的每個切片各自子集化，再合併成一個 woff2；回傳位元組與實際有字形的碼位"""
    parts, covered = [], set()
    for path, rng in slices(weight):
        need = want & rng
        if not need:
            continue
        font = TTFont(path, recalcTimestamp=False)
        stamp = (font["head"].created, font["head"].modified)
        opts = Options()
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        opts.recalc_timestamp = False
        sub = Subsetter(opts)
        sub.populate(unicodes=need)
        sub.subset(font)
        got = set(font.getBestCmap() or {}) & need
        if not got:
            continue  # unicode-range 列了，字型裡其實沒有這些字形
        covered |= got
        font.flavor = None
        buf = io.BytesIO()
        font.save(buf)
        parts.append(buf)
    if not parts:
        raise SystemExit(f"{weight}：沒有任何切片涵蓋要的字")
    merged = Merger().merge(parts) if len(parts) > 1 else TTFont(parts[0])
    merged.flavor = "woff2"
    # 時間戳一律用來源切片的，存檔時也不重算，輸出才會逐位元組可重現
    merged.recalcTimestamp = False
    merged["head"].created, merged["head"].modified = stamp
    out = io.BytesIO()
    merged.save(out, reorderTables=False)
    return out.getvalue(), covered


def ranges_css(points: set[int]) -> str:
    pts = sorted(points)
    out, i = [], 0
    while i < len(pts):
        j = i
        while j + 1 < len(pts) and pts[j + 1] == pts[j] + 1:
            j += 1
        out.append(f"U+{pts[i]:x}" if i == j else f"U+{pts[i]:x}-{pts[j]:x}")
        i = j + 1
    return ",".join(out)


def build() -> dict[Path, bytes]:
    ui, bank = charsets()
    files: dict[Path, bytes] = {}
    faces = []
    for w in WEIGHTS:
        for part, want in (("ui", ui), ("bank", bank)):
            data, covered = subset_font(w, want)
            name = f"noto-serif-tc-{w}-{part}.woff2"
            files[OUT_DIR / name] = data
            faces.append(
                "@font-face{"
                f"font-family:'{FAMILY}';font-style:normal;font-display:swap;font-weight:{w};"
                f"src:url(./assets/fonts/{name}) format('woff2');unicode-range:{ranges_css(covered)}"
                "}"
            )
    head = ("/* tools/build_fonts.py 產生，不要手改：思源宋體子集，"
            "ui 為介面與首頁用字，bank 為只出現在題目與解析的字 */\n")
    files[OUT_CSS] = (head + "\n".join(faces) + "\n").encode("utf-8")
    return files


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="只比對，不寫檔")
    args = ap.parse_args()
    files = build()
    if args.check:
        stale = [p for p, b in files.items() if not p.exists() or p.read_bytes() != b]
        for p in stale:
            print(f"與重跑結果不同：{p.relative_to(ROOT)}")
        return 1 if stale else 0
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for p, b in files.items():
        p.write_bytes(b)
        print(f"{p.relative_to(ROOT)}  {len(b):,} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
