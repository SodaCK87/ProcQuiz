"""把 data/source/ 的題庫 xlsx 轉成 data/questions/*.json，並核對正確度。

用法：python tools/convert.py          轉檔並寫出 JSON
      python tools/convert.py --check  只核對，不寫檔（已提交的 JSON 與重跑結果不同時回非零）

核對失敗（題數對不上目錄頁、答案不合法、選項拆不出四個）一律中止，不寫出半套資料。
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "source"
OUT = ROOT / "data" / "questions"

KINDS = {
    "true-false": {"label": "是非題"},
    "multiple-choice": {"label": "選擇題"},
}

# 題庫用「藍底」標示與前一版不同的題目；實測為佈景色 4、tint 0.8
CHANGED_THEME, CHANGED_TINT = 4, 0.8
OPTION_MARK = re.compile(r"[(（]([1-4１-４])[)）]")

# 已查過、確認是題庫來源本身的不一致（見 docs/問題台帳.md），只在數字完全相同時放行。
# 換版後數字變了就照樣中止，逼人重新查一次。
KNOWN_TOC_O_MISMATCH = {
    ("115.7.23", 5): (76, 77),  # PQZ-01
}


class BankError(Exception):
    pass


def _text(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _is_changed(cell) -> bool:
    c = cell.fill.fgColor if cell.fill and cell.fill.fill_type else None
    return bool(c is not None and c.type == "theme" and c.theme == CHANGED_THEME
                and c.tint is not None and abs(c.tint - CHANGED_TINT) < 0.01)


def read_toc(ws, kind: str) -> tuple[str, dict[int, dict]]:
    """回傳（版次, {課程編號: {name, count, o_count}}）。目錄頁左右兩欄並排。"""
    version = None
    for row in ws.iter_rows(min_row=1, max_row=3, values_only=True):
        for v in row:
            m = re.search(r"(\d+\.\d+\.\d+)版", str(v or ""))
            if m:
                version = m.group(1)
    if not version:
        raise BankError(f"{kind}：目錄頁找不到版次字樣（例如 115.7.23版）")

    width = 6 if kind == "true-false" else 4  # 是非題多「答案題數 O／X」兩欄
    toc: dict[int, dict] = {}
    for row in ws.iter_rows(min_row=1, values_only=True):
        for base in (0, width):
            cells = row[base:base + width]
            if len(cells) < 3 or not isinstance(cells[0], int) or not isinstance(cells[2], int):
                continue
            entry = {"name": str(cells[1]).strip(), "count": cells[2]}
            if kind == "true-false":
                entry["o_count"] = cells[4]
            toc[cells[0]] = entry
    if sorted(toc) != list(range(1, 15)):
        raise BankError(f"{kind}：目錄頁應有課程 1–14，實際讀到 {sorted(toc)}")
    return version, toc


def split_options(text: str, where: str) -> tuple[str, list[str]]:
    marks = list(OPTION_MARK.finditer(text))
    nums = [unicodedata.normalize("NFKC", m.group(1)) for m in marks]
    if nums != ["1", "2", "3", "4"]:
        raise BankError(f"{where}：選項標記應為 (1)(2)(3)(4)，實際 {nums}")
    stem = text[:marks[0].start()].strip()
    options = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        options.append(text[m.end():end].strip())
    if not stem or any(not o for o in options):
        raise BankError(f"{where}：題幹或選項為空")
    return stem, options


def parse_answer(raw, kind: str, where: str):
    s = unicodedata.normalize("NFKC", str(raw or "")).strip().upper()
    if kind == "true-false":
        if s not in ("O", "X"):
            raise BankError(f"{where}：是非題答案應為 O／X，實際 {raw!r}")
        return s
    if s not in ("1", "2", "3", "4"):
        raise BankError(f"{where}：選擇題答案應為 1–4，實際 {raw!r}")
    return int(s)


def convert(kind: str, path: Path) -> tuple[dict, list[str]]:
    """回傳（題庫資料, 提醒清單）。提醒是不擋轉檔、但要讓人看到的資料異狀。"""
    wb = openpyxl.load_workbook(path)
    version, toc = read_toc(wb.worksheets[0], kind)
    notes: list[str] = []
    questions = []

    for ws in wb.worksheets[1:]:
        m = re.match(r"(\d+)-(.+)", ws.title)
        if not m:
            raise BankError(f"{kind}：工作表名稱不是「編號-課程」格式：{ws.title}")
        course = int(m.group(1))
        if course not in toc or toc[course]["name"] != m.group(2).strip():
            raise BankError(f"{kind}：工作表「{ws.title}」與目錄頁課程名稱對不上")

        seen: set[int] = set()
        prev = 0
        for row in ws.iter_rows(min_row=3):
            no_text = _text(row[0].value)
            if no_text is None or not no_text.isdigit():
                # 編號欄非數字的列是課程說明或分組標題，不是題目
                if no_text and any(_text(c.value) for c in row[2:4]):
                    raise BankError(f"{ws.title} 第 {row[0].row} 列：編號不是數字卻有答案或題目")
                continue
            no = int(no_text)
            where = f"{KINDS[kind]['label']} {ws.title} 第 {no} 題"
            if no in seen:
                raise BankError(f"{where}：編號重複")
            if no != prev + 1:
                notes.append(f"{where}：編號順序不連續（前一題是 {prev}）")
            seen.add(no)
            prev = no

            raw_answer = row[2].value
            answer = parse_answer(raw_answer, kind, where)
            if str(raw_answer).strip() != str(answer):
                notes.append(f"{where}：答案 {raw_answer!r} 已正規化為 {answer!r}")
            text = _text(row[3].value)
            if not text:
                raise BankError(f"{where}：題目為空")
            q = {"id": f"{'tf' if kind == 'true-false' else 'mc'}-{course:02d}-{no:04d}",
                 "course": course, "no": no, "answer": answer}
            if kind == "multiple-choice":
                q["stem"], q["options"] = split_options(text, where)
            else:
                q["stem"] = text
            q["law"] = _text(row[4].value)
            q["explanation"] = _text(row[5].value)
            q["changed"] = _is_changed(row[3])
            questions.append(q)

        if sorted(seen) != list(range(1, len(seen) + 1)):
            raise BankError(f"{kind} {ws.title}：編號不是 1–{len(seen)} 連號")

    # 題數與答案分布逐課程對目錄頁
    for course, entry in toc.items():
        qs = [q for q in questions if q["course"] == course]
        if len(qs) != entry["count"]:
            raise BankError(f"{kind} 課程 {course}：目錄頁寫 {entry['count']} 題，實際 {len(qs)} 題")
        if kind == "true-false":
            o = sum(q["answer"] == "O" for q in qs)
            if KNOWN_TOC_O_MISMATCH.get((version, course)) == (entry["o_count"], o):
                notes.append(f"是非題 課程 {course}：目錄頁寫答案 O 有 {entry['o_count']} 題，實際 {o} 題（已知，PQZ-01）")
            elif o != entry["o_count"]:
                raise BankError(f"{kind} 課程 {course}：目錄頁寫答案 O 有 {entry['o_count']} 題，實際 {o} 題")

    # 同題重出時答案必須一致，否則至少有一題答案是錯的
    by_text: dict[str, list[dict]] = {}
    for q in questions:
        key = re.sub(r"\s", "", q["stem"] + "".join(q.get("options") or []))
        by_text.setdefault(key, []).append(q)
    for group in by_text.values():
        if len(group) > 1:
            ids = "、".join(q["id"] for q in group)
            if len({json.dumps(q["answer"]) for q in group}) > 1:
                raise BankError(f"{kind}：同一題目答案不一致：{ids}")
            notes.append(f"{KINDS[kind]['label']}：題目重複出現（答案一致）：{ids}")

    data = {
        "kind": kind,
        "label": KINDS[kind]["label"],
        "version": version,
        "courses": [{"id": c, "name": toc[c]["name"], "count": toc[c]["count"]} for c in sorted(toc)],
        "questions": questions,
    }
    return data, notes


def render(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, indent=1) + "\n"


def main(argv: list[str]) -> int:
    check_only = "--check" in argv
    sys.stdout.reconfigure(encoding="utf-8")
    failed = False
    for kind in KINDS:
        src = SOURCE / f"{kind}.xlsx"
        dst = OUT / f"{kind}.json"
        try:
            data, notes = convert(kind, src)
        except BankError as e:
            print(f"✗ {e}")
            failed = True
            continue
        text = render(data)
        changed = sum(q["changed"] for q in data["questions"])
        print(f"✓ {data['label']} {data['version']}版：{len(data['questions'])} 題，本版變更 {changed} 題")
        for n in notes:
            print(f"  ⚠ {n}")
        if check_only:
            current = dst.read_text(encoding="utf-8") if dst.exists() else None
            if current != text:
                print(f"✗ {dst.relative_to(ROOT)} 與重跑結果不同，請執行 python tools/convert.py")
                failed = True
        else:
            OUT.mkdir(parents=True, exist_ok=True)
            dst.write_text(text, encoding="utf-8", newline="\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
