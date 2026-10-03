"""重點字答案線索的核對紀錄是否撐得起網站上線的那份微調。

讀 data/review/work/highlight/（第一輪合併版 trap.json、受核線索 clues.json、核對判定 verify/、成對補核 pair/），
逐條確認：每段線索都有判定；放行（pass）與改標（fail＋fix）的依據引文逐字出現在原文裡；fix 原樣在題文且 15 字內；
再用這些判定重建微調，必須等於 web/src/lib/highlight-fixes.json。任何一項不符就退出非零。

原文＝該題與相鄰題號（±1）的法條欄、解析、審查註記，加上 data/review/work/laws/ 兩部法規全文。
第一輪核對當時不收相鄰題，這裡一律收，只會更寬、不會讓當時通過的判定變成不通過。
執行：python tools/review/highlight_check.py
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

# 輸出導向檔案或管線時 Windows 主控台用 cp950，印 ✓ 會擲 UnicodeEncodeError、資料一致也退出 1（PQZ-06）
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent.parent
WORK = ROOT / "data" / "review" / "work"
HL = WORK / "highlight"
FIXES = ROOT / "web" / "src" / "lib" / "highlight-fixes.json"
VERDICTS = ("pass", "fail", "unverifiable")


def die(msg):
    print(f"✗ {msg}", file=sys.stderr)
    sys.exit(1)


def load(p: Path):
    if not p.exists():
        die(f"找不到 {p.relative_to(ROOT)}")
    return json.loads(p.read_text(encoding="utf-8"))


def squash(s):
    # 空白不計；相容字（U+F900–FAFF）視同標準字，官方題文與解析都混有這種字
    s = re.sub(r"\s+", "", s or "")
    return "".join(unicodedata.normalize("NFC", c) if "豈" <= c <= "﫿" else c for c in s)


def verdict_files(sub):
    files = sorted((HL / sub).glob("*.json")) if (HL / sub).exists() else []
    if not files:
        die(f"找不到 {(HL / sub).relative_to(ROOT)} 底下的判定檔")
    out = {}
    for f in files:
        out.update(load(f))
    return out


def main():
    trap, clues = load(HL / "trap.json"), load(HL / "clues.json")
    first, pair = verdict_files("verify"), verdict_files("pair")
    qs = {q["id"]: q for k in ("true-false", "multiple-choice")
          for q in load(ROOT / "data" / "questions" / f"{k}.json")["questions"]}
    laws = "\n".join(squash((WORK / "laws" / f"{n}.txt").read_text(encoding="utf-8"))
                     for n in ("政府採購法", "政府採購法施行細則") if (WORK / "laws" / f"{n}.txt").exists())
    if not laws:
        die("找不到 data/review/work/laws/ 的法規全文")

    def pool(qid):
        m = re.match(r"^(.*-)(\d{4})$", qid)
        ids = [qid] + [f"{m.group(1)}{int(m.group(2)) + d:04d}" for d in (-1, 1)]
        texts = []
        for i in ids:
            q = qs.get(i)
            if q:
                texts += [q.get("law"), q.get("explanation"), *(n["text"] for n in q["notes"])]
        return "\n".join(squash(t) for t in texts) + "\n" + laws

    errs, final = [], {}
    for qid, clue in clues.items():
        q = qs.get(qid)
        if not q:
            errs.append(f"{qid}：題號不存在"); continue
        if clue not in q["stem"]:
            errs.append(f"{qid}：受核線索不在題文裡"); continue
        r = first.get(qid)
        if not r:
            errs.append(f"{qid}：沒有核對判定"); continue
        # 成對補核只在改判（不再是 unverifiable）時取代第一輪
        if pair.get(qid, {}).get("verdict", "unverifiable") != "unverifiable":
            r = pair[qid]
        if r.get("verdict") not in VERDICTS:
            errs.append(f"{qid}：判定「{r.get('verdict')}」不合法"); continue
        if r["verdict"] != "unverifiable" and (not r.get("evidence") or squash(r["evidence"]) not in pool(qid)):
            errs.append(f"{qid}：依據引文在原文裡找不到"); continue
        fix = r.get("fix")
        if fix is not None and (not fix or len(fix) > 15 or fix not in q["stem"]):
            errs.append(f"{qid}：fix 不在題文裡或超過 15 字"); continue
        for d in r.get("restore", []):
            if d not in trap.get(qid, {}).get("drop", []):
                errs.append(f"{qid}：restore「{d}」不是第一輪拿掉的字")
        final[qid] = r

    # 用判定重建微調：第一輪合併版＋放行的線索（pass 用原線索、fail 用 fix）＋ restore 還原
    want = {k: {"add": list(v.get("add", [])), "drop": list(v.get("drop", []))} for k, v in trap.items()}
    count = {v: 0 for v in VERDICTS}
    live = 0
    for qid, r in final.items():
        count[r["verdict"]] += 1
        add = clues[qid] if r["verdict"] == "pass" else r.get("fix")
        f = want.setdefault(qid, {"add": [], "drop": []})
        if add:
            f["add"].append(add); live += 1
        f["drop"] = [d for d in f["drop"] if d not in r.get("restore", [])]
    norm = lambda d: {k: (sorted(v.get("add", [])), sorted(v.get("drop", []))) for k, v in d.items() if v.get("add") or v.get("drop")}
    got = norm(load(FIXES))
    want = norm(want)
    for qid in sorted(set(got) | set(want)):
        if got.get(qid) != want.get(qid):
            errs.append(f"{qid}：highlight-fixes.json 與核對紀錄重建的結果不同")

    print(f"線索 {len(clues)}：通過 {count['pass']}、判錯 {count['fail']}、無法核對 {count['unverifiable']}；上線 {live}")
    if errs:
        print("\n".join(f"✗ {e}" for e in errs[:30]), file=sys.stderr)
        die(f"共 {len(errs)} 項不符")
    print("✓ 核對紀錄與 highlight-fixes.json 一致")


if __name__ == "__main__":
    main()
