"""讀工程會「採購法規題庫」官方下載檔：全部題庫.doc（實為 RTF）與全部題庫.pdf。

RTF 是表格結構，題目、答案、法源分欄，當主來源；PDF 只拿每題的「編號＋答案」
當第二來源交叉核對，任何一題對不上就中止——兩者同一次下載、出自同一個資料庫，
對不上只會是解析錯了。
"""
from __future__ import annotations

import os
import re
import unicodedata
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from xlsx_bank import BankError, KINDS, parse_answer, split_options

LABEL_TO_KIND = {v["label"]: k for k, v in KINDS.items()}

# 只認這幾種 RTF 記號；Apache FOP 產生的檔案中文全是 \uNNNN\'3f
_TOKEN = re.compile(
    r"\\u(-?\d+)\\'[0-9a-f]{2}|\\'([0-9a-f]{2})|\\([a-z]+)(-?\d+)? ?|\\([{}\\])|([{}])|\r?\n|([^\\{}\r\n]+)")


def rtf_events(raw: str) -> list[tuple[str, object]]:
    """把 RTF 拆成段落（par）與表格列（row）事件。"""
    buf: list[str] = []
    cells: list[str] = []
    events: list[tuple[str, object]] = []
    for m in _TOKEN.finditer(raw):
        u, hx, word, num, esc, brace, text = m.groups()
        if u is not None:
            n = int(u)
            buf.append(chr(n + 65536 if n < 0 else n))
        elif text is not None:
            buf.append(text)
        elif esc:
            buf.append(esc)
        elif hx is not None:
            raise BankError(f"RTF 出現未預期的位元組跳脫 \\'{hx}，解析器不認得這種編碼")
        elif word == "par":
            events.append(("par", "".join(buf).strip()))
            buf = []
        elif word == "cell":
            cells.append("".join(buf).strip())
            buf = []
        elif word == "row":
            events.append(("row", cells))
            cells = []
        elif word in ("line", "tab"):
            buf.append(" ")
    return events


def read_rtf(path: Path) -> tuple[str, dict[tuple[str, str], list[dict]]]:
    """回傳（資料產生日期, {(kind, 課程名): [題目]}）。"""
    events = rtf_events(path.read_bytes().decode("latin-1"))
    date = None
    kind = course = None
    sections: dict[tuple[str, str], list[dict]] = {}
    for typ, val in events:
        if typ == "par":
            m = re.search(r"資料產生日期：(\d+/\d+/\d+)", val)
            if m:
                date = m.group(1)
            elif val in LABEL_TO_KIND:
                kind = LABEL_TO_KIND[val]
                if (kind, course) in sections:
                    raise BankError(f"官方 RTF：{course} {val} 出現兩次")
                sections[(kind, course)] = []
            elif val:
                course = val
            continue
        if val[:3] == ["編號", "答案", "試題"]:
            continue
        if kind is None or course is None:
            raise BankError(f"官方 RTF：表格列出現在課程與題型標題之前：{val[:3]}")
        sections[(kind, course)].append(_row(kind, course, val))
    if not date:
        raise BankError("官方 RTF：找不到「資料產生日期」")
    for (kind, course), qs in sections.items():
        nos = [q["no"] for q in qs]
        if nos != list(range(1, len(nos) + 1)):
            raise BankError(f"官方 {KINDS[kind]['label']} {course}：編號不是 1–{len(nos)} 連號")
    return date, sections


def _row(kind: str, course: str, cells: list[str]) -> dict:
    where = f"官方 {KINDS[kind]['label']} {course} 第 {cells[0] if cells else '?'} 題"
    if len(cells) not in (3, 4) or not cells[0].isdigit():
        raise BankError(f"{where}：表格列應為 編號／答案／試題（／依據法源），實際 {cells[:4]}")
    q = {"no": int(cells[0]), "answer": parse_answer(cells[1], kind, where), "text": cells[2]}
    if kind == "multiple-choice":
        q["stem"], q["options"] = split_options(cells[2], where)
    else:
        q["stem"] = cells[2]
    law = cells[3].strip() if len(cells) == 4 else ""
    q["law"] = re.sub(r"\s+", "", law) or None
    return q


# 抽字跟主行程解析 RTF／xlsx 重疊（convert.build），行程多了反而跟主行程搶 CPU：本機 16 核有背景負載時端到端 4 行程 4.07 s、
# 6 行程 4.26 s、8 行程 4.40 s、12 行程 4.60 s（第 13 輪），取 6；CI 4 核照 cpu_count。環境變數 PQZ_PDF_WORKERS 可改，量測掃行程數用
PDF_WORKERS = min(int(os.environ.get("PQZ_PDF_WORKERS", "6")), os.cpu_count() or 1)


def pdf_pages_text(path: str, start: int, stop: int) -> list[str]:
    """抽第 start 到 stop（不含）頁的文字。獨立成模組層函式，子行程才 pickle 得到。"""
    import pypdf

    reader = pypdf.PdfReader(path)
    return [reader.pages[i].extract_text() or "" for i in range(start, stop)]


class PdfTextJob:
    """PDF 抽字工作：建構時就把頁段送進子行程，result() 才接回；主行程這段時間可以先解析 RTF 與 xlsx（convert.build）。
    抽字佔轉檔七成（pypdf 純 Python、每頁都有題目所以跳不掉）：單獨量本機 16 核安靜時 8 行程 7.7 s→2.4 s（第 12 輪），
    與 RTF／xlsx 解析重疊後端到端 10.8 s→4.3 s（第 13 輪，P-02）。頁的順序照段落接回，4–16 行程的結果都與順序抽逐字相同。"""

    def __init__(self, path: Path):
        import pypdf

        self.path = str(path)
        self.n = len(pypdf.PdfReader(self.path).pages)  # 檔壞掉在這裡就擲例外，不會進到子行程
        workers = min(PDF_WORKERS, self.n)
        self.pool = self.futures = None
        if workers > 1:
            step = -(-self.n // workers)
            ranges = [(i, min(i + step, self.n)) for i in range(0, self.n, step)]
            self.pool = ProcessPoolExecutor(max_workers=len(ranges))
            self.futures = [self.pool.submit(pdf_pages_text, self.path, a, b) for a, b in ranges]

    def result(self) -> list[str]:
        """每頁的文字，照頁序"""
        if self.pool is None:
            return pdf_pages_text(self.path, 0, self.n)
        try:
            return [t for f in self.futures for t in f.result()]
        finally:
            self.pool.shutdown()

    def cancel(self) -> None:
        # 主行程在等結果前就失敗（RTF 核對不過）時叫：還沒開始的段取消；已在跑的子行程殺不掉，直譯器結束時會等它們
        if self.pool is not None:
            self.pool.shutdown(wait=False, cancel_futures=True)


def start_pdf_text(path: Path) -> PdfTextJob:
    return PdfTextJob(path)


def read_pdf_answers(path: Path, course_names: set[str]) -> dict[tuple[str, str], list[tuple[int, str]]]:
    """從 PDF 每題第一行「編號 答案 題目…」取出（編號, 答案）。課程名稱用 RTF 讀到的那組辨認。"""
    return parse_pdf_answers(start_pdf_text(path).result(), course_names)


def parse_pdf_answers(texts: list[str], course_names: set[str]) -> dict[tuple[str, str], list[tuple[int, str]]]:
    """把每頁文字解析成 {(題型, 課程): [(編號, 答案)]}"""
    lines: list[str] = [line for text in texts for line in text.split("\n")]

    first = re.compile(r"^(\d+) ([OX1-4]) ")
    kind = course = None
    out: dict[tuple[str, str], list[tuple[int, str]]] = {}
    for line in lines:
        s = line.strip()
        if s in course_names:
            course, kind = s, None
        elif s in LABEL_TO_KIND:
            kind = LABEL_TO_KIND[s]
            out.setdefault((kind, course), [])
        elif kind:
            m = first.match(s)
            seq = out[(kind, course)]
            # 換行後剛好以「數字 空白 答案」開頭的續行，靠連號排除
            if m and int(m.group(1)) == len(seq) + 1:
                seq.append((int(m.group(1)), m.group(2)))
    return out


def cross_check(rtf: dict[tuple[str, str], list[dict]], pdf: dict[tuple[str, str], list[tuple[int, str]]]) -> None:
    if set(rtf) != set(pdf):
        raise BankError(f"官方 RTF 與 PDF 的課程／題型不一致：只在 RTF {sorted(set(rtf) - set(pdf))}，"
                        f"只在 PDF {sorted(set(pdf) - set(rtf))}")
    for key, qs in rtf.items():
        a = [(q["no"], str(q["answer"])) for q in qs]
        b = pdf[key]
        if a != b:
            i = next((i for i, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
            raise BankError(f"官方 {KINDS[key[0]]['label']} {key[1]}：RTF 與 PDF 不一致（RTF {len(a)} 題、PDF {len(b)} 題），"
                            f"第一個差異在第 {i + 1} 題：RTF {a[i] if i < len(a) else '無'}，PDF {b[i] if i < len(b) else '無'}")


def norm(text: str) -> str:
    """比對題文用：全形半形統一、相容字統一、去掉所有空白。"""
    return re.sub(r"\s", "", unicodedata.normalize("NFKC", text))
