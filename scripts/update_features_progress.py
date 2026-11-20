#!/usr/bin/env python3
"""Regenerate the "Overall Progress" table in featureslist.md from its checkboxes.

Usage:
  python scripts/update_features_progress.py            # rewrite featureslist.md
  python scripts/update_features_progress.py --check    # exit 1 if the table is out of date (CI)

Rows come from the numbered "## N." section headings; counts from "- [x]" and "- [ ]" lines
(any indentation). Never edit the table by hand — run this script instead (AGENTS.md rule 25).
"""
import re
import sys
from pathlib import Path

HEADING = re.compile(r"^## (\d+(?:\.\d+)?)\.?\s+(.*)$")
DONE = re.compile(r"^\s*- \[[xX]\]")
OPEN = re.compile(r"^\s*- \[ \]")


def section_name(raw: str) -> str:
    name = re.sub(r"\(`[^`]*`\)", "", raw)
    name = re.sub(r"^[^\w]+", "", name).strip()
    if len(name) > 60:
        name = re.sub(r"\s+[—-]\s+.*$", "", name)
    return name


def build_table(lines):
    rows, cur = [], None
    for line in lines:
        m = HEADING.match(line)
        if m:
            if cur and cur[1] + cur[2]:
                rows.append(cur)
            cur = [f"{m.group(1)}. {section_name(m.group(2))}", 0, 0]
        elif cur and DONE.match(line):
            cur[1] += 1
        elif cur and OPEN.match(line):
            cur[2] += 1
    if cur and cur[1] + cur[2]:
        rows.append(cur)
    out = ["| Module | Total | ✅ Done | ⏳ Remaining | % Complete |",
           "|--------|-------|---------|-------------|-----------|"]
    done = sum(r[1] for r in rows)
    open_ = sum(r[2] for r in rows)
    for name, d, o in rows:
        out.append(f"| {name} | {d + o} | {d} | {o} | {round(100 * d / (d + o))}% |")
    total = done + open_
    out.append(f"| **TOTAL** | **{total}** | **{done}** | **{open_}** | **{round(100 * done / total) if total else 0}%** |")
    return out


def update(path: Path, check: bool) -> bool:
    raw = path.read_bytes().decode("utf-8")
    bom = raw.startswith("﻿")
    text = raw.lstrip("﻿")
    eol = "\r\n" if "\r\n" in text else "\n"
    lines = text.replace("\r\n", "\n").split("\n")
    start = next((i for i, l in enumerate(lines) if l.startswith("## ") and "Overall Progress" in l), None)
    if start is None:
        sys.exit(f"{path}: no '## ... Overall Progress' heading found")
    t0 = next(i for i in range(start + 1, len(lines)) if lines[i].startswith("|"))
    t1 = t0
    while t1 < len(lines) and lines[t1].startswith("|"):
        t1 += 1
    new_table = build_table(lines[t1:])
    if lines[t0:t1] == new_table:
        print(f"{path}: progress table up to date")
        return True
    if check:
        print(f"{path}: progress table is OUT OF DATE - run: python scripts/update_features_progress.py")
        return False
    lines[t0:t1] = new_table
    path.write_bytes((("﻿" if bom else "") + eol.join(lines)).encode("utf-8"))
    print(f"{path}: progress table updated ({new_table[-1]})")
    return True


if __name__ == "__main__":
    check = "--check" in sys.argv
    files = [a for a in sys.argv[1:] if not a.startswith("--")] or ["featureslist.md"]
    ok = all([update(Path(f), check) for f in files])
    sys.exit(0 if ok else 1)
