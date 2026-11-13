#!/usr/bin/env python3
"""Runs stelint on each example and writes assets/data.js.

Each example folder holds a small project: .stelint/config.toml,
.stelint/DICTIONARY.md and the two stages of one text (before/, after/). This script runs the real
stelint binary on each stage and keeps its diagnostics. The site shows only
these diagnostics. No diagnostic on the site is written by hand.

The help texts of stelint can give replacements from a private word list.
The script removes them, because the site must not publish that list.

Usage: scripts/build_data.py [path/to/stelint]
"""

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STELINT = sys.argv[1] if len(sys.argv) > 1 else (shutil.which("stelint") or "stelint")

EXAMPLES = [
    # id, folder, file name, language, tab label, the pain it shows
    ("retry", "examples/retry", "retry.rs", "rust", "retry.rs", "verbose"),
    ("cache", "examples/cache", "price_cache.rs", "rust", "price_cache.rs", "names"),
    ("readme", "examples/readme", "README.md", "markdown", "README.md", "noise"),
    ("deploy", "examples/deploy", "deploy.md", "markdown", "deploy.md", "contradiction"),
]

# One sentence each, in examples/cases: id, tag, title.
CASES = [
    ("names", "New name", "A name that is not in the dictionary"),
    ("verb", "Part of speech", "A noun as a verb"),
    ("hedge", "Soft words", "A guess in place of a fact"),
    ("slang", "Slang", "Phrasal verbs"),
    ("jargon", "Jargon", "A term that the reader must look up"),
    ("long", "Length", "Too many facts in one sentence"),
]


def run(project: Path, rel: str) -> list[dict]:
    out = subprocess.run(
        [STELINT, "--root", str(project), "--format", "json", rel],
        capture_output=True,
        text=True,
        cwd=project,
    )
    if out.returncode == 2:
        sys.exit(f"stelint failed on {project}/{rel}:\n{out.stderr}")
    return [json.loads(line) for line in out.stdout.splitlines() if line.strip()]


def clean_help(text: str | None) -> str:
    if not text:
        return ""
    # "... (ADP). use: because (conj), ..." -> keep the part before "use:".
    text = re.split(r"(?:^|\.\s)use:", text)[0].strip().rstrip(".")
    return text or "the word list gives an approved replacement"


def span(lines: list[str], d: dict) -> tuple[int, int, int]:
    """Gives (line, start, length) in characters, 0-based start."""
    ln = d["line"]
    line = lines[ln - 1] if 0 < ln <= len(lines) else ""
    # stelint gives byte columns. Convert to a character index.
    raw = line.encode()
    col = len(raw[: max(d["column"] - 1, 0)].decode(errors="ignore"))
    m = re.search(r'"([^"]+)"', d["message"])
    if d["rule_id"] == "line-width":
        return ln, 80, max(len(line) - 80, 1)
    if m and d["rule_id"] != "sentence-length":
        word = m.group(1)
        best = None
        for hit in re.finditer(re.escape(word), line):
            if best is None or abs(hit.start() - col) < abs(best - col):
                best = hit.start()
        if best is not None:
            return ln, best, len(word)
    # A sentence rule: mark to the end of the line.
    tail = re.match(r"\S+", line[col:])
    length = len(line) - col if d["rule_id"] == "sentence-length" else (len(tail.group(0)) if tail else 1)
    return ln, col, max(length, 1)


def prose_words(text: str, lang: str) -> int:
    count = 0
    fence = False
    for line in text.splitlines():
        if line.strip().startswith("```"):
            fence = not fence
            continue
        if fence:
            continue
        if lang == "rust":
            m = re.match(r"\s*//[/!]?\s?(.*)", line)
            if not m:
                continue
            line = m.group(1)
        line = re.sub(r"`[^`]*`", "x", line)
        count += len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'’\-]*", line))
    return count


def stage(project: Path, rel: str, lang: str) -> dict:
    text = (project / rel).read_text()
    lines = text.splitlines()
    diags = []
    for d in run(project, rel):
        ln, start, length = span(lines, d)
        diags.append(
            {
                "line": ln,
                "start": start,
                "len": length,
                "rule": d["rule_id"],
                "msg": d["message"],
                "help": clean_help(d.get("help")),
            }
        )
    return {"text": text, "words": prose_words(text, lang), "diags": diags}


def dictionary(project: Path) -> list[list[str]]:
    rows = []
    path = project / ".stelint" / "DICTIONARY.md"
    if not path.exists():
        return rows
    for line in path.read_text().splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 2 and cells[0] not in ("Term", "---") and not cells[0].startswith("-"):
            rows.append(cells)
    return rows


def main() -> None:
    data = {"examples": []}
    for ex_id, folder, name, lang, label, pain in EXAMPLES:
        project = ROOT / folder
        data["examples"].append(
            {
                "id": ex_id,
                "file": label,
                "lang": lang,
                "pain": pain,
                "before": stage(project, f"before/{name}", lang),
                "after": stage(project, f"after/{name}", lang),
                "dictionary": dictionary(project),
            }
        )
    cases = ROOT / "examples" / "cases"
    data["cases"] = [
        {
            "id": case_id,
            "tag": tag,
            "title": title,
            "before": stage(cases, f"before/{case_id}.rs", "rust"),
            "after": stage(cases, f"after/{case_id}.rs", "rust"),
        }
        for case_id, tag, title in CASES
    ]
    for ex in data["examples"] + data["cases"]:
        if ex["after"]["diags"]:
            sys.exit(f"{ex['id']}: the after text has diagnostics")
    js = "// Generated by scripts/build_data.py from real stelint runs. Do not edit.\n"
    js += "window.STELINT_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    (ROOT / "assets" / "data.js").write_text(js)
    for ex in data["examples"]:
        print(f"{ex['id']:8} before {len(ex['before']['diags']):3} diags {ex['before']['words']:4} words | after {ex['after']['words']:4} words")
    for case in data["cases"]:
        print(f"case {case['id']:8} {len(case['before']['diags'])} diags")


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
