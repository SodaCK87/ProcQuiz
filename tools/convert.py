"""產生網站用的題庫 data/questions/*.json。

題目、答案、法源取自工程會官方題庫（data/source/official.rtf，並以 official.pdf 交叉核對）；
解析取自第三方 xlsx，只掛在題文完全相同（正規化後）的題目上，題文改過的就不掛，免得解析對到舊題。

用法：python tools/convert.py          轉檔、寫出 JSON，並列出與上一版 JSON 的差異
      python tools/convert.py --check  只核對，不寫檔（已提交的 JSON 與重跑結果不同時回非零）
"""
from __future__ import annotations

import difflib
import json
import sys
from pathlib import Path

from official import cross_check, norm, read_pdf_answers, read_rtf
from xlsx_bank import BankError, KINDS, read_xlsx

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "source"
OUT = ROOT / "data" / "questions"

# 課程順序照訓練課程編號；官方檔的課程順序不固定，不拿來排序
COURSES = [
    "政府採購全生命週期概論", "政府採購法之總則、招標及決標", "政府採購法之履約管理及驗收",
    "政府採購法之罰則及附則", "工程及技術服務採購作業", "財物及勞務採購作業",
    "最有利標及評選優勝廠商", "電子採購實務", "錯誤採購態樣", "投標須知及招標文件製作",
    "採購契約", "底價及價格分析", "政府採購法之爭議處理", "道德規範及違法處置",
]


def build(source: Path = SOURCE) -> tuple[dict[str, dict], list[str]]:
    """回傳（{kind: 題庫資料}, 提醒清單）。任何核對失敗擲 BankError。"""
    date, sections = read_rtf(source / "official.rtf")
    names = {course for _, course in sections}
    if names != set(COURSES):
        raise BankError(f"官方課程名稱與預期不同：多了 {sorted(names - set(COURSES))}，少了 {sorted(set(COURSES) - names)}")
    if set(sections) != {(k, c) for k in KINDS for c in COURSES}:
        raise BankError("官方 RTF 不是每個課程都有是非題與選擇題兩段")
    cross_check(sections, read_pdf_answers(source / "official.pdf", names))

    notes: list[str] = []
    result = {}
    for kind, meta in KINDS.items():
        xdata, xnotes = read_xlsx(kind, source / f"{kind}.xlsx")
        notes += xnotes
        if list(xdata["courses"].values()) != COURSES:
            raise BankError(f"xlsx {kind} 的課程名稱或順序與官方不同")

        questions = []
        for cid, course in enumerate(COURSES, 1):
            off = sections[(kind, course)]
            xs = [q for q in xdata["questions"] if q["course"] == cid]
            by_text: dict[str, list[dict]] = {}
            for x in xs:
                by_text.setdefault(norm(x["text"]), []).append(x)
            used: set[str] = set()
            unmatched = []
            for o in off:
                q = {"id": f"{meta['prefix']}-{cid:02d}-{o['no']:04d}", "course": cid, "no": o["no"],
                     "answer": o["answer"], "stem": o["stem"]}
                if kind == "multiple-choice":
                    q["options"] = o["options"]
                q["law"] = o["law"]
                q["explanation"] = None
                hits = by_text.get(norm(o["text"]))
                if hits:
                    x = hits[0]
                    used.update(h["id"] for h in hits)
                    if x["answer"] != o["answer"]:
                        notes.append(f"答案與 xlsx 不同，以官方為準：{q['id']} 官方 {o['answer']}，"
                                     f"xlsx {x['id']} {x['answer']}；該題不掛 xlsx 解析")
                    else:
                        q["explanation"] = x["explanation"]
                else:
                    unmatched.append((q, o))
                questions.append(q)

            # 題文對不上的只做報告：找最像的 xlsx 題目，讓人看出是改字還是新題
            rest = [x for x in xs if x["id"] not in used]
            for q, o in unmatched:
                best = max(rest, key=lambda x: difflib.SequenceMatcher(None, norm(x["text"]), norm(o["text"])).ratio(),
                           default=None)
                ratio = difflib.SequenceMatcher(None, norm(best["text"]), norm(o["text"])).ratio() if best else 0
                if best and ratio >= 0.8:
                    same = "答案相同" if best["answer"] == o["answer"] else f"答案不同（xlsx {best['answer']}）"
                    notes.append(f"題文與 xlsx 不同，不掛解析：{q['id']} ≈ xlsx {best['id']}（相似度 {ratio:.2f}，{same}）")
                else:
                    notes.append(f"官方有、xlsx 找不到相近題目：{q['id']}")

        check_duplicates(questions, meta["label"])
        result[kind] = {
            "kind": kind,
            "label": meta["label"],
            "source": "工程會採購法規題庫",
            "generated": date,
            "explanationSource": f"題庫解析 xlsx {xdata['version']}版（非官方）",
            "courses": [{"id": i, "name": c, "count": len(sections[(kind, c)])} for i, c in enumerate(COURSES, 1)],
            "questions": questions,
        }
    return result, notes


def question_key(q: dict) -> str:
    return norm(q["stem"] + "".join(q.get("options") or []))


def check_duplicates(questions: list[dict], label: str) -> None:
    """同題重出時答案必須一致，否則至少有一題答案是錯的。"""
    groups: dict[str, list[dict]] = {}
    for q in questions:
        groups.setdefault(question_key(q), []).append(q)
    for g in groups.values():
        if len({json.dumps(q["answer"]) for q in g}) > 1:
            raise BankError(f"官方{label}同一題目答案不一致：{'、'.join(q['id'] for q in g)}")


def render(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, indent=1) + "\n"


def diff_versions(old: dict, new: dict) -> list[str]:
    """以題文比對新舊兩版，列出新增、刪除、改答案。編號會因官方重排而變，不拿編號比。"""
    o = {question_key(q): q for q in old["questions"]}
    n = {question_key(q): q for q in new["questions"]}
    lines = [f"新增 {n[k]['id']}：{n[k]['stem'][:40]}" for k in n.keys() - o.keys()]
    lines += [f"刪除 {o[k]['id']}：{o[k]['stem'][:40]}" for k in o.keys() - n.keys()]
    lines += [f"改答案 {n[k]['id']}：{o[k]['answer']} → {n[k]['answer']}"
              for k in n.keys() & o.keys() if o[k]["answer"] != n[k]["answer"]]
    return sorted(lines)


def main(argv: list[str]) -> int:
    check_only = "--check" in argv
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        result, notes = build()
    except BankError as e:
        print(f"✗ {e}")
        return 1

    failed = False
    for kind, data in result.items():
        n = len(data["questions"])
        with_expl = sum(q["explanation"] is not None for q in data["questions"])
        print(f"✓ {data['label']}：{n} 題（官方 {data['generated']} 產生，RTF 與 PDF 逐題一致），掛上解析 {with_expl} 題")
        dst = OUT / f"{kind}.json"
        text = render(data)
        current = dst.read_text(encoding="utf-8") if dst.exists() else None
        if check_only:
            if current != text:
                print(f"✗ {dst.relative_to(ROOT)} 與重跑結果不同，請執行 python tools/convert.py")
                failed = True
            continue
        if current:
            try:
                changes = diff_versions(json.loads(current), data)
            except (KeyError, json.JSONDecodeError):
                changes = ["（上一版格式不同，無法比對）"]
            print(f"  與上一版相比：{len(changes)} 處變動")
            for c in changes:
                print(f"    {c}")
        OUT.mkdir(parents=True, exist_ok=True)
        dst.write_text(text, encoding="utf-8", newline="\n")

    for note in notes:
        print(f"  ⚠ {note}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
