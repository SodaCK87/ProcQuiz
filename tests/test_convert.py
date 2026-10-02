"""題庫轉檔正確度的測試。執行：python -m unittest discover -s tests -v

破壞型測試都做在暫存複本上，data/source/ 的原檔一個字都不碰。
"""
import copy
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import convert  # noqa: E402
import official  # noqa: E402
import xlsx_bank  # noqa: E402
from xlsx_bank import BankError  # noqa: E402

SRC = ROOT / "data" / "source"
_built = None


def built():
    # build() 讀三份大檔要十幾秒，整輪只跑一次
    global _built
    if _built is None:
        _built = convert.build()
    return _built


class PureFunctions(unittest.TestCase):
    def test_split_options(self):
        stem, opts = xlsx_bank.split_options("何者正確？(1)甲。(2)乙。（3）丙。(４)丁。", "t")
        self.assertEqual(stem, "何者正確？")
        self.assertEqual(opts, ["甲。", "乙。", "丙。", "丁。"])

    def test_split_options_rejects_missing_option(self):
        with self.assertRaises(BankError):
            xlsx_bank.split_options("何者？(1)甲(2)乙(4)丁", "t")

    def test_parse_answer(self):
        self.assertEqual(xlsx_bank.parse_answer("Ｘ", "true-false", "t"), "X")
        self.assertEqual(xlsx_bank.parse_answer(" o ", "true-false", "t"), "O")
        self.assertEqual(xlsx_bank.parse_answer("3", "multiple-choice", "t"), 3)
        for bad, kind in (("Y", "true-false"), ("5", "multiple-choice"), (None, "true-false")):
            with self.assertRaises(BankError):
                xlsx_bank.parse_answer(bad, kind, "t")

    def test_rtf_events(self):
        raw = ("{\\rtf1 {\\b0 \\u24037\\'3f\\u31243\\'3f\n\\par }{\\trowd \\intbl "
               "{1\n\\cell }{X\n\\cell }{\\u35430\\'3f (1)a\n\\cell }\\row }}")
        self.assertEqual(official.rtf_events(raw), [("par", "工程"), ("row", ["1", "X", "試 (1)a"])])

    def test_norm_unifies_width_and_compat_chars(self):
        # 官方與 xlsx 的差異實測只有全半形括號、全形數字與相容字（U+F967 不）
        self.assertEqual(official.norm("（１）不 可"), official.norm("(1)不可"))

    def test_duplicate_with_conflicting_answer(self):
        qs = [{"id": "a", "stem": "同一題", "answer": "O"}, {"id": "b", "stem": "同一題 ", "answer": "X"}]
        with self.assertRaisesRegex(BankError, "答案不一致"):
            convert.check_duplicates(qs, "是非題")
        qs[1]["answer"] = "O"
        convert.check_duplicates(qs, "是非題")


class Output(unittest.TestCase):
    def test_committed_json_matches_regeneration(self):
        # 產出物進版控，這條守「換了來源檔或改了腳本卻忘了重跑」
        result, _ = built()
        for kind, data in result.items():
            committed = (convert.OUT / f"{kind}.json").read_text(encoding="utf-8")
            self.assertTrue(committed == convert.render(data), f"{kind}.json 與重跑結果不同")

    def test_explanation_only_on_same_text_and_same_answer(self):
        # 解析是第三方的；只要掛上去，那題在 xlsx 的題文與答案就必須與官方相同
        result, _ = built()
        for kind, data in result.items():
            xdata, _ = xlsx_bank.read_xlsx(kind, SRC / f"{kind}.xlsx")
            index = {}
            for x in xdata["questions"]:
                index.setdefault((x["course"], official.norm(x["text"])), []).append(x)
            for q in data["questions"]:
                if q["explanation"] is None:
                    continue
                text = q["stem"] + "".join(f"({i})" + o for i, o in enumerate(q.get("options") or [], 1))
                hits = index.get((q["course"], official.norm(text)))
                self.assertTrue(hits, f"{q['id']} 掛了解析卻找不到同題文的 xlsx 題目")
                self.assertEqual(hits[0]["answer"], q["answer"], q["id"])


class OfficialCrossCheck(unittest.TestCase):
    """RTF 與 PDF 是同一次下載的兩種格式，逐題（編號, 答案）必須一致。"""

    @classmethod
    def setUpClass(cls):
        _, cls.rtf = official.read_rtf(SRC / "official.rtf")
        names = {c for _, c in cls.rtf}
        cls.pdf = official.read_pdf_answers(SRC / "official.pdf", names)

    def test_untouched_passes(self):
        official.cross_check(self.rtf, self.pdf)

    def test_flipped_answer_is_caught(self):
        rtf = copy.deepcopy(self.rtf)
        q = rtf[("true-false", "電子採購實務")][50]
        q["answer"] = "O" if q["answer"] == "X" else "X"
        with self.assertRaisesRegex(BankError, "電子採購實務.*第 51 題"):
            official.cross_check(rtf, self.pdf)

    def test_missing_question_is_caught(self):
        pdf = copy.deepcopy(self.pdf)
        del pdf[("multiple-choice", "採購契約")][-1]
        with self.assertRaisesRegex(BankError, "採購契約"):
            official.cross_check(self.rtf, pdf)


class Corruption(unittest.TestCase):
    """陽性對照：每一種來源錯誤都要讓轉檔中止，或照規則拿掉解析。"""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        for f in SRC.iterdir():
            shutil.copy(f, self.tmp / f.name)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _edit_xlsx(self, kind, mutate):
        p = self.tmp / f"{kind}.xlsx"
        wb = openpyxl.load_workbook(p)
        mutate(wb)
        wb.save(p)

    @staticmethod
    def _row(ws, no):
        for row in ws.iter_rows(min_row=3):
            if str(row[0].value or "").strip() == str(no):
                return row
        raise AssertionError(f"找不到第 {no} 題")

    def test_roundtrip_untouched_copy_is_identical(self):
        # 陰性對照：xlsx 原樣存回、其餘原檔複製，結果要與原檔一致，後面的紅才歸得到破壞頭上
        for kind in xlsx_bank.KINDS:
            self._edit_xlsx(kind, lambda wb: None)
        got, _ = convert.build(self.tmp)
        want, _ = built()
        self.assertTrue(got == want)

    def test_rtf_answer_changed_on_disk_is_caught_by_pdf(self):
        p = self.tmp / "official.rtf"
        raw = p.read_bytes().decode("latin-1")
        target = "\nX\n\\cell"
        self.assertIn(target, raw)
        p.write_bytes(raw.replace(target, "\nO\n\\cell", 1).encode("latin-1"))
        with self.assertRaisesRegex(BankError, "RTF 與 PDF 不一致"):
            convert.build(self.tmp)

    def test_xlsx_answer_conflict_drops_explanation(self):
        result, _ = built()
        q = next(q for q in result["multiple-choice"]["questions"] if q["explanation"] and q["course"] == 1)
        xdata, _ = xlsx_bank.read_xlsx("multiple-choice", SRC / "multiple-choice.xlsx")
        text = q["stem"] + "".join(f"({i})" + o for i, o in enumerate(q["options"], 1))
        x = next(x for x in xdata["questions"] if x["course"] == 1 and official.norm(x["text"]) == official.norm(text))

        def flip(wb):
            row = self._row(wb["1-政府採購全生命週期概論"], x["no"])
            row[2].value = x["answer"] % 4 + 1
        self._edit_xlsx("multiple-choice", flip)
        got, notes = convert.build(self.tmp)
        after = next(g for g in got["multiple-choice"]["questions"] if g["id"] == q["id"])
        self.assertIsNone(after["explanation"])
        self.assertEqual(after["answer"], q["answer"])  # 答案仍照官方
        self.assertTrue(any(q["id"] in n and "以官方為準" in n for n in notes))

    def test_xlsx_flipped_tf_answer_breaks_o_count(self):
        def flip(wb):
            row = self._row(wb["1-政府採購全生命週期概論"], 1)
            row[2].value = "X" if row[2].value == "O" else "O"
        self._edit_xlsx("true-false", flip)
        with self.assertRaisesRegex(BankError, "課程 1"):
            convert.build(self.tmp)

    def test_xlsx_known_mismatch_does_not_mask_further_change(self):
        # PQZ-01 的放行只認 76／77；課程 5 再多錯一題就要中止
        def flip(wb):
            ws = wb["5-工程及技術服務採購作業"]
            row = next(r for r in ws.iter_rows(min_row=3) if r[2].value == "X")
            row[2].value = "O"
        self._edit_xlsx("true-false", flip)
        with self.assertRaisesRegex(BankError, "課程 5"):
            convert.build(self.tmp)

    def test_xlsx_deleted_question_breaks_count(self):
        def delete(wb):
            ws = wb["3-政府採購法之履約管理及驗收"]
            ws.delete_rows(self._row(ws, 97)[0].row)
        self._edit_xlsx("true-false", delete)
        with self.assertRaisesRegex(BankError, "目錄頁寫 97 題"):
            convert.build(self.tmp)

    def test_xlsx_missing_option(self):
        def bad(wb):
            row = self._row(wb["1-政府採購全生命週期概論"], 1)
            row[3].value = row[3].value.replace("(3)", "")
        self._edit_xlsx("multiple-choice", bad)
        with self.assertRaisesRegex(BankError, "選項標記"):
            convert.build(self.tmp)


if __name__ == "__main__":
    unittest.main()
