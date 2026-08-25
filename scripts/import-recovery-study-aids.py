from __future__ import annotations

import argparse
import html
import json
import shutil
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


class TourContentParser(HTMLParser):
    """Extract only the primary Quick Tour article, excluding site navigation."""

    BLOCK_TAGS = {"h1", "h2", "h3", "h4", "p", "li", "br"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.capture_depth: int | None = None
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        attrs_dict = dict(attrs)
        classes = set(attrs_dict.get("class", "").split())
        self.depth += 1
        if self.capture_depth is None and {"large-8", "cell", "tour"}.issubset(classes):
            self.capture_depth = self.depth
        elif self.capture_depth is not None and tag == "sup":
            self.parts.append("[")
        elif self.capture_depth is not None and tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_startendtag(self, tag: str, attrs) -> None:
        if self.capture_depth is not None and tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if self.capture_depth is not None and tag == "sup":
            self.parts.append("]")
        elif self.capture_depth is not None and tag in self.BLOCK_TAGS:
            self.parts.append("\n")
        if self.capture_depth == self.depth:
            self.capture_depth = None
        self.depth -= 1

    def handle_data(self, data: str) -> None:
        if self.capture_depth is not None:
            self.parts.append(data)

    def text(self) -> str:
        cleaned: list[str] = []
        for line in "".join(self.parts).splitlines():
            normalized = " ".join(html.unescape(line).split())
            if normalized and (not cleaned or normalized != cleaned[-1]):
                cleaned.append(normalized)
        return "\n\n".join(cleaned)


def extract_article(path: Path) -> str:
    parser = TourContentParser()
    parser.feed(path.read_text(encoding="utf-8-sig", errors="replace"))
    text = parser.text()
    if not text:
        raise ValueError(f"No Quick Tour article found in {path}")
    return text


def site_file(root: Path, filename: str) -> Path:
    matches = list(root.rglob(filename))
    matches = [path for path in matches if "www.recoveryversion.bible" in str(path)]
    if len(matches) != 1:
        raise FileNotFoundError(f"Expected one {filename} below {root}; found {len(matches)}")
    return matches[0]


def write_document(destination: Path, name: str, heading: str, body: str, note: str | None = None) -> Path:
    path = destination / name
    sections = [heading]
    if note:
        sections.append(note)
    sections.append(body)
    path.write_text("\n\n".join(sections).strip() + "\n", encoding="utf-8")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Import clean Recovery Version Quick Tour study aids.")
    parser.add_argument("destination", type=Path)
    parser.add_argument("--introduction", type=Path, required=True)
    parser.add_argument("--preface", type=Path, required=True)
    parser.add_argument("--footnotes", type=Path, required=True)
    parser.add_argument("--cross-references", type=Path, required=True)
    args = parser.parse_args()

    destination = args.destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)

    specs = [
        (
            args.introduction,
            "intro.html",
            "Recovery Version - Introduction.txt",
            "Recovery Version — Introduction",
            None,
        ),
        (
            args.preface,
            "preface.html",
            "Recovery Version - Preface Excerpt.txt",
            "Recovery Version — Preface (Excerpt)",
            "This source identifies itself as an excerpt from the Recovery Version preface.",
        ),
        (
            args.introduction,
            "outlines.html",
            "Recovery Version - Outlines Overview.txt",
            "Recovery Version — Outlines Overview",
            "This overview describes the outlines; the supplied files contain the complete Genesis outline only.",
        ),
        (
            args.footnotes,
            "footnotes.html",
            "Recovery Version - Footnote Samples.txt",
            "Recovery Version — Footnote Samples",
            "Sample material only. This is not the complete Recovery Version footnote collection.",
        ),
        (
            args.cross_references,
            "cross_ref.html",
            "Recovery Version - Cross Reference Sample.txt",
            "Recovery Version — Cross-Reference Sample",
            "Sample material only. This is not the complete Recovery Version cross-reference collection.",
        ),
    ]

    files: list[str] = []
    for root, source_name, output_name, heading, note in specs:
        source = site_file(root.resolve(), source_name)
        output = write_document(destination, output_name, heading, extract_article(source), note)
        files.append(output.name)

    outline_source = site_file(args.introduction.resolve(), "Genesis-Outline.pdf")
    outline_output = destination / "Recovery Version - Genesis Outline.pdf"
    shutil.copy2(outline_source, outline_output)
    files.append(outline_output.name)

    manifest = {
        "version": 1,
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "destination": str(destination),
        "files": files,
        "coverage": {
            "introduction": "full supplied web article",
            "preface": "excerpt",
            "outlines": "overview plus Genesis outline PDF",
            "footnotes": "samples only",
            "cross_references": "sample only",
        },
        "notice": "Source material supplied by the user. Observe the publisher's applicable copyright terms.",
    }
    (destination / "study-aids-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
