"""產生網站用的題庫 data/questions/*.json。

題目、答案、法源取自工程會官方題庫（data/source/official.rtf，並以 official.pdf 交叉核對）；
解析取自第三方 xlsx，只掛在題文完全相同（正規化後）的題目上，題文改過的就不掛，免得解析對到舊題。

用法：python tools/convert.py          轉檔、寫出 JSON，並列出與上一版 JSON 的差異
      python tools/convert.py --check  只核對，不寫檔（已提交的 JSON 與重跑結果不同時回非零）
"""
from __future__ import annotations

import difflib
import hashlib
import json
import sys
from pathlib import Path

from official import cross_check, norm, parse_pdf_answers, read_rtf, start_pdf_text
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


REVIEW = ROOT / "data" / "review" / "notes.json"
NOTE_TYPES = {"取代解析": "replace", "更正出處": "correct", "法條更正": "law", "答案註記": "answer"}


def fingerprint(text: str | None) -> str | None:
    return hashlib.sha1(norm(text).encode("utf-8")).hexdigest()[:12] if text else None


def apply_review(questions: list[dict], review: Path) -> set[str]:
    """把人工審查定案的註記掛上題目。題文或解析與審查當時不同就中止：編號可能被官方重排，
    註記若照編號掛上去會對到別題。"""
    applied: set[str] = set()
    require_review(review)
    by_id = {q["id"]: q for q in questions}
    for n in json.loads(review.read_text(encoding="utf-8")):
        q = by_id.get(n["id"])
        if q is None:
            continue  # 另一個題型的註記
        if n["類型"] not in NOTE_TYPES:
            raise BankError(f"審查註記 {n['id']}：類型不合法 {n['類型']}")
        if fingerprint(question_key(q)) != n["題目指紋"]:
            raise BankError(f"審查註記 {n['id']}：題目與審查當時不同（可能是官方改題或重排編號），請重審這則註記")
        if n["類型"] in ("取代解析", "更正出處") and fingerprint(q["explanation"]) != n["解析指紋"]:
            raise BankError(f"審查註記 {n['id']}：解析與審查當時不同，請重審這則註記")
        if any(x["type"] == NOTE_TYPES[n["類型"]] for x in q["notes"]):
            raise BankError(f"審查註記 {n['id']}：同一題有兩則「{n['類型']}」")
        if n["類型"] == "取代解析":
            q["explanation"] = None
        q["notes"].append({"type": NOTE_TYPES[n["類型"]], "text": n["內容"]})
        applied.add(n["id"])
    return applied


def require_review(review: Path) -> None:
    """註記檔不在就中止。原本當成「沒有註記」照常寫檔：99 則審查註記無聲消失、被取代的解析換回來，
    差異報告還印「0 處變動」（PQZ-07）。檔案在版控裡，不會有正當理由不在。"""
    if not review.exists():
        raise BankError(f"找不到審查註記 {review}：沒有它，審查定案的註記會整批消失、被取代的解析會換回來；"
                        "這個檔進版控，請確認路徑或用 git 還原")


def start_pdf_answers(path: Path):
    """先把 PDF 抽字送進子行程，回傳「給課程名、拿 {(題型, 課程): [(編號, 答案)]}」的函式；主行程這段時間解析 RTF 與 xlsx，
    端到端少掉重疊的那段（效能基準第 13 輪，P-02 第三步）。測試把這個名字換成走快取的版本，不會每次都起子行程。"""
    job = start_pdf_text(path)

    def finish(course_names: set[str]):
        return parse_pdf_answers(job.result(), course_names)
    finish.cancel = job.cancel
    return finish


def build(source: Path = SOURCE, review: Path = REVIEW) -> tuple[dict[str, dict], list[str]]:
    """回傳（{kind: 題庫資料}, 提醒清單）。任何核對失敗擲 BankError。"""
    require_review(review)  # 先擋，不必等讀完三份大檔才發現
    pdf = start_pdf_answers(source / "official.pdf")  # 子行程抽字的同時，主行程解析 RTF 與兩份 xlsx
    try:
        date, sections = read_rtf(source / "official.rtf")
        names = {course for _, course in sections}
        if names != set(COURSES):
            raise BankError(f"官方課程名稱與預期不同：多了 {sorted(names - set(COURSES))}，少了 {sorted(set(COURSES) - names)}")
        if set(sections) != {(k, c) for k in KINDS for c in COURSES}:
            raise BankError("官方 RTF 不是每個課程都有是非題與選擇題兩段")
        xlsx = {kind: read_xlsx(kind, source / f"{kind}.xlsx") for kind in KINDS}
        cross_check(sections, pdf(names))
    except BaseException:
        pdf.cancel()
        raise

    notes: list[str] = []
    applied: set[str] = set()
    result = {}
    for kind, meta in KINDS.items():
        xdata, xnotes = xlsx[kind]
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
        for q in questions:
            q["notes"] = []
        applied |= apply_review(questions, review)
        result[kind] = {
            "kind": kind,
            "label": meta["label"],
            "source": "工程會採購法規題庫",
            "generated": date,
            "explanationSource": f"題庫解析 xlsx {xdata['version']}版（非官方）",
            "courses": [{"id": i, "name": c, "count": len(sections[(kind, c)])} for i, c in enumerate(COURSES, 1)],
            "questions": questions,
        }
    unknown = {n["id"] for n in json.loads(review.read_text(encoding="utf-8"))} - applied
    if unknown:
        raise BankError(f"審查註記指向不存在的題目：{sorted(unknown)}")
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
    """以題文比對新舊兩版，列出新增、刪除、改答案、改解析、改註記。編號會因官方重排而變，不拿編號比。"""
    o = {question_key(q): q for q in old["questions"]}
    n = {question_key(q): q for q in new["questions"]}
    both = n.keys() & o.keys()
    brief = lambda t: t[:20] if t else "（無）"
    lines = [f"新增 {n[k]['id']}：{n[k]['stem'][:40]}" for k in n.keys() - o.keys()]
    lines += [f"刪除 {o[k]['id']}：{o[k]['stem'][:40]}" for k in o.keys() - n.keys()]
    lines += [f"改答案 {n[k]['id']}：{o[k]['answer']} → {n[k]['answer']}" for k in both if o[k]["answer"] != n[k]["answer"]]
    # 解析與註記不在官方檔裡：換 xlsx、改 notes.json 時只有這兩類會動，不報的話整批消失也是「0 處變動」（PQZ-07）
    lines += [f"改解析 {n[k]['id']}：{brief(o[k].get('explanation'))} → {brief(n[k].get('explanation'))}"
              for k in both if o[k].get("explanation") != n[k].get("explanation")]
    lines += [f"改註記 {n[k]['id']}：{len(o[k].get('notes') or [])} → {len(n[k].get('notes') or [])} 則"
              for k in both if (o[k].get("notes") or []) != (n[k].get("notes") or [])]
    return sorted(lines)


def date_only_note(old: dict, new: dict, changes: list[str]) -> str | None:
    """官方下載檔的「資料產生日期」就是下載當天，每次重抓都會變；題目沒動時只會讓 JSON 差兩行、歷史多一個 7 MiB 的來源檔，
    這種換版不值得 commit，印一句講明。有任何題目變動就不印（那時日期變是正常的）。"""
    if changes or old.get("generated") == new.get("generated"):
        return None
    return f"題庫內容相同，只有產生日期 {old.get('generated')}→{new.get('generated')}；不必 commit，git checkout -- data/ 換回去即可"


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
            by_kind: dict[str, list[str]] = {}
            for c in changes:
                by_kind.setdefault(c.split(" ", 1)[0], []).append(c)
            summary = "、".join(f"{k} {len(v)}" for k, v in by_kind.items())
            print(f"  與上一版相比：{len(changes)} 處變動" + (f"（{summary}）" if changes else ""))
            note = date_only_note(json.loads(current), data, changes)
            if note:
                print(f"  {note}")
            for k, v in by_kind.items():  # 每類最多列 30 筆，整批換解析時不會刷掉幾千行
                for c in v[:30]:
                    print(f"    {c}")
                if len(v) > 30:
                    print(f"    …{k}另 {len(v) - 30} 筆，看 git diff data/questions/")
        OUT.mkdir(parents=True, exist_ok=True)
        dst.write_text(text, encoding="utf-8", newline="\n")

    for note in notes:
        print(f"  ⚠ {note}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
