#!/usr/bin/env python3
"""Runs stelint on each example and writes assets/data.js.

Each example folder holds a small project: .stelint/config.toml,
.stelint/dictionaries/ and the two stages of one text (before/, after/).
This script runs the real stelint binary on each stage and keeps its
diagnostics. The site shows only these diagnostics. No diagnostic on the
site is written by hand.

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
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STELINT = sys.argv[1] if len(sys.argv) > 1 else (shutil.which("stelint") or "stelint")

# The project of the compare editor. Each stage is a full project root with
# the same .stelint/: before/ holds the text of the agent, and after/ holds
# the text that passes.
PROJECT = ROOT / "examples" / "project"
PROJECT_FILES = [
    # path, language, the problem that the file shows
    ("README.md", "markdown", "noise"),
    ("docs/deploy.md", "markdown", "contradiction"),
    ("src/cache/price_cache.rs", "rust", "names"),
    ("src/client/retry.rs", "rust", "verbose"),
]

# One sentence each, in examples/cases: id, tag, title.
CASES = [
    ("names", "Two names", "\u201cIngestion pipeline\u201d is the importer"),
    ("hedge", "A guess", "\u201cShould probably be fine\u201d gives no fact"),
    ("long", "Length", "Four facts in one sentence"),
    ("jargon", "Jargon", "Not every reader knows \u201cidempotent\u201d"),
    ("slang", "Idioms", "\u201cSpins up\u201d and \u201ckicks off\u201d"),
    ("verb", "Part of speech", "\u201cBatch\u201d is a noun in the dictionary"),
]


def json_lines(project: Path, cmd: list[str]) -> list[dict]:
    out = subprocess.run(cmd, capture_output=True, text=True, cwd=project)
    if out.returncode == 2:
        sys.exit(f"stelint failed in {project}: {' '.join(cmd[1:])}\n{out.stderr}")
    return [json.loads(line) for line in out.stdout.splitlines() if line.strip()]


def run(project: Path, *paths: str) -> list[dict]:
    """Checks the paths of a project. No path checks all the project."""
    return json_lines(project, [STELINT, "--root", str(project), "--format", "json", *paths])


def run_dictionary(project: Path, command: str, *args: str) -> list[dict]:
    """Runs a command of `stelint dictionary` in a project."""
    return json_lines(project, [STELINT, "dictionary", command, "--root", str(project), "--format", "json", *args])


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


def table_rows(text: str) -> list[list[str]]:
    """Gives the rows of the tables `| Term | Meaning |` of a dictionary."""
    rows = []
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 2 and cells[0] not in ("Term", "---") and not cells[0].startswith("-"):
            rows.append(cells)
    return rows


def dictionaries(project: Path) -> list[dict]:
    """Gives the path, the paths of the front matter and the rows of each dictionary."""
    out = []
    for path in sorted((project / ".stelint" / "dictionaries").glob("*.md")):
        text = path.read_text()
        front = re.match(r"---\n(.*?)\n---\n", text, re.S)
        paths = re.findall(r'^\s*-\s*"([^"]+)"', front.group(1), re.M) if front else []
        out.append({"path": f".stelint/dictionaries/{path.name}", "paths": paths, "rows": table_rows(text)})
    return out


def project() -> dict:
    """Runs the two stages of the project of the compare editor."""
    before_root, after_root = PROJECT / "before", PROJECT / "after"
    if run(after_root):
        sys.exit("project: the after stage has diagnostics")
    files = []
    for rel, lang, pain in PROJECT_FILES:
        files.append(
            {
                "file": rel,
                "lang": lang,
                "pain": pain,
                "before": stage(before_root, rel, lang),
                "after": stage(after_root, rel, lang),
                "dictionaries": run_dictionary(after_root, "resolve", rel)[0]["dictionaries"],
            }
        )
    whole = len(run(before_root))
    if whole != sum(len(f["before"]["diags"]) for f in files):
        sys.exit("project: the before stage has diagnostics in a file that the page does not show")
    return {"dictionaries": dictionaries(after_root), "files": files}


# The example of the layered dictionaries: a shop with three modules.
LAYERS = ROOT / "examples" / "layers"
LAYER_FILE = "crates/shipping/src/customs.rs"
LAYER_WORD = "label"
MOVED_TERM = "invoice"


def layers() -> dict:
    """Runs the example of the layered dictionaries, before and after one move.

    The file `LAYER_FILE` uses a term of a dictionary that does not apply to
    it. The move puts that term in the project dictionary. Then the project
    must pass.
    """
    dicts = dictionaries(LAYERS)
    whole = run(LAYERS)
    if len(whole) != 1 or whole[0]["path"] != LAYER_FILE:
        sys.exit(f"layers: the project must have one diagnostic in {LAYER_FILE}, not {len(whole)}")
    resolve = run_dictionary(LAYERS, "resolve", LAYER_FILE)[0]["dictionaries"]
    # Only the entries of the dictionaries: the word lists stay private.
    find = [e for e in run_dictionary(LAYERS, "find", LAYER_WORD) if e["source"].startswith(".stelint/")]
    before = stage(LAYERS, LAYER_FILE, "rust")
    with tempfile.TemporaryDirectory() as tmp:
        copy = Path(tmp) / "layers"
        shutil.copytree(LAYERS, copy)
        source = copy / ".stelint" / "dictionaries" / "billing.md"
        lines = source.read_text().splitlines(keepends=True)
        row = next(line for line in lines if line.startswith(f"| {MOVED_TERM} |"))
        source.write_text("".join(line for line in lines if line is not row))
        target = copy / ".stelint" / "dictionaries" / "project.md"
        target.write_text(target.read_text() + row)
        left = run(copy)
        if left:
            sys.exit(f"layers: the project has {len(left)} diagnostics after the move")
        after = stage(copy, LAYER_FILE, "rust")
    return {
        "file": LAYER_FILE,
        "dictionaries": dicts,
        "resolve": resolve,
        "word": LAYER_WORD,
        "find": find,
        "before": before,
        "after": after,
        "moved": {"term": MOVED_TERM, "from": ".stelint/dictionaries/billing.md", "to": ".stelint/dictionaries/project.md"},
    }


def main() -> None:
    data = {"project": project()}
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
    data["layers"] = layers()
    # The comment that how.html follows through the check.
    how = ROOT / "examples" / "how"
    data["how"] = {"before": stage(how, "before/lib.rs", "rust"), "after": stage(how, "after/lib.rs", "rust")}
    if data["how"]["after"]["diags"]:
        sys.exit("how: the after text has diagnostics")
    for case in data["cases"]:
        if case["after"]["diags"]:
            sys.exit(f"{case['id']}: the after text has diagnostics")
    js = "// Generated by scripts/build_data.py from real stelint runs. Do not edit.\n"
    js += "window.STELINT_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    (ROOT / "assets" / "data.js").write_text(js)
    for f in data["project"]["files"]:
        print(f"{f['file']:26} before {len(f['before']['diags']):3} diags | {len(f['dictionaries'])} dictionaries")
    for case in data["cases"]:
        print(f"case {case['id']:8} {len(case['before']['diags'])} diags")
    lay = data["layers"]
    print(f"layers   {len(lay['dictionaries'])} dictionaries | before {len(lay['before']['diags'])} diags | after {len(lay['after']['diags'])} diags")


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
