"""網站子集字型（tools/build_fonts.py 產生、已提交）的測試。

缺字不會報錯，瀏覽器只會靜靜退回系統字型；題庫或介面文字改了卻忘了重跑 build_fonts.py，這裡會紅。
"""
import re
import sys
import unittest
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import build_fonts  # noqa: E402

# 思源宋體本來就沒有的字（@fontsource 的切片也沒有）：相容表意字與介面上的 ✦，換字型前後一樣走系統字型
NOT_IN_SOURCE = set(range(0xF900, 0xFB00)) | {0x2726}


def cmap(weight, part):
    return set(TTFont(build_fonts.OUT_DIR / f"noto-serif-tc-{weight}-{part}.woff2").getBestCmap())


class Fonts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui, cls.bank = build_fonts.charsets()

    def test_every_char_on_site_has_a_glyph(self):
        for w in build_fonts.WEIGHTS:
            missing = (self.ui | self.bank) - cmap(w, "ui") - cmap(w, "bank") - NOT_IN_SOURCE
            self.assertFalse(missing, f"{w} 粗細缺 {len(missing)} 字：{''.join(sorted(map(chr, missing)))[:40]}；重跑 python tools/build_fonts.py")

    def test_home_only_needs_ui_files(self):
        # 題目專用字那一檔的 unicode-range 若含介面用字，首頁就會多抓一個大檔
        css = build_fonts.OUT_CSS.read_text(encoding="utf-8")
        for w in build_fonts.WEIGHTS:
            self.assertFalse((self.ui - NOT_IN_SOURCE) - cmap(w, "ui"), f"{w} 粗細的介面檔缺字")
            m = re.search(rf"font-weight:{w};src:url\(\./assets/fonts/noto-serif-tc-{w}-bank\.woff2\) format\('woff2'\);unicode-range:([^}}]+)}}", css)
            self.assertIsNotNone(m, f"fonts.css 找不到 {w} 粗細的題目字檔")
            self.assertFalse(build_fonts.parse_ranges(m.group(1)) & self.ui, f"{w} 粗細的題目字檔涵蓋了介面用字")


if __name__ == "__main__":
    unittest.main()
