#!/usr/bin/env python3
"""Checks the prose of each page with stelint.

The script takes the text of each HTML page and writes it as Markdown in a
temporary project. Then it runs stelint on that project with the
configuration in `.stelint/` of this repository. An element with `data-nolint` is not
prose of the site: it is an example of bad text, or code.

Usage: scripts/check_prose.py [path/to/stelint]
"""

import shutil
import subprocess
import sys
import tempfile
import textwrap
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STELINT = sys.argv[1] if len(sys.argv) > 1 else (shutil.which("stelint") or "stelint")
PAGES = ["index.html", "how.html"]
SKIP = {"script", "style", "pre", "svg", "head"}
BLOCK = {"p", "li", "td", "dd", "figcaption", "blockquote"}
LABEL = {"h1", "h2", "h3", "h4", "th", "dt", "summary", "button", "a", "label", "title"}
LABEL_CLASSES = {"eyebrow", "lab", "tag", "kind", "num", "k", "v", "s", "box-head", "file-head", "pane-head", "who", "pass", "chip", "lbl", "no", "crate"}
VOID = {"br", "img", "meta", "link", "input", "hr", "source"}


class Extract(HTMLParser):
    """Collects the prose blocks and the labels of one page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        # Each entry: tag, skip, opened (the element started a block).
        self.stack: list[tuple[str, bool, bool]] = []
        self.blocks: list[tuple[str, str]] = []
        self.buf: list[str] = []
        self.kind = ""
        self.label_attr: list[str] = []

    def skipping(self) -> bool:
        return any(skip for _, skip, _ in self.stack)

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        a = dict(attrs)
        classes = set((a.get("class") or "").split())
        skip = tag in SKIP or "data-nolint" in a or a.get("aria-hidden") == "true"
        skip = skip or self.skipping()
        opened = False
        if not skip:
            for key in ("aria-label", "title"):
                if a.get(key):
                    self.label_attr.append(a[key])
            is_label = tag in LABEL or bool(classes & LABEL_CLASSES)
            if (tag in BLOCK or is_label) and not self.kind:
                self.kind = "h" if is_label else "p"
                self.buf = []
                opened = True
            elif tag == "code" and self.kind:
                self.buf.append("`")
        self.stack.append((tag, skip, opened))

    def handle_endtag(self, tag):
        if tag in VOID or not any(t == tag for t, _, _ in self.stack):
            return
        while self.stack:
            t, skip, opened = self.stack.pop()
            if t == tag:
                break
        if skip:
            return
        if tag == "code" and self.kind:
            self.buf.append("`")
        elif self.kind and not opened:
            self.buf.append(" " if tag in ("span", "div", "td", "li") else "")
        if opened:
            text = " ".join("".join(self.buf).split())
            if text:
                self.blocks.append((self.kind, text))
            self.kind = ""
            self.buf = []

    def handle_data(self, data):
        if self.skipping():
            return
        if self.kind:
            self.buf.append(data)
        elif data.strip():
            self.blocks.append(("h", " ".join(data.split())))


def to_markdown(html: str) -> str:
    p = Extract()
    p.feed(html)
    out = []
    for kind, text in p.blocks:
        if kind == "h":
            out.append("### " + text.rstrip(".") if not text.endswith((".", "?", "!")) else text)
        else:
            out.append(textwrap.fill(text, 78, break_on_hyphens=False, break_long_words=False))
    for text in p.label_attr:
        out.append("### " + text)
    return "\n\n".join(out) + "\n"


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="stelint-site-"))
    shutil.copytree(ROOT / ".stelint", tmp / ".stelint")
    shutil.copy(ROOT / "README.md", tmp / "README.md")
    for page in PAGES:
        path = ROOT / page
        if path.exists():
            (tmp / (path.stem + ".md")).write_text(to_markdown(path.read_text()))
    print(f"prose in {tmp}")
    return subprocess.run([STELINT, "--root", str(tmp)], cwd=tmp).returncode


if __name__ == "__main__":
    sys.exit(main())
