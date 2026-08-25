from __future__ import annotations

import argparse
import html
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


BOOKS = [
    ("Genesis", 50), ("Exodus", 40), ("Leviticus", 27), ("Numbers", 36),
    ("Deuteronomy", 34), ("Joshua", 24), ("Judges", 21), ("Ruth", 4),
    ("1Samuel", 31), ("2Samuel", 24), ("1Kings", 22), ("2Kings", 25),
    ("1Chronicles", 29), ("2Chronicles", 36), ("Ezra", 10), ("Nehemiah", 13),
    ("Esther", 10), ("Job", 42), ("Psalms", 150), ("Proverbs", 31),
    ("Ecclesiastes", 12), ("SongofSongs", 8), ("Isaiah", 66), ("Jeremiah", 52),
    ("Lamentations", 5), ("Ezekiel", 48), ("Daniel", 12), ("Hosea", 14),
    ("Joel", 3), ("Amos", 9), ("Obadiah", 1), ("Jonah", 4), ("Micah", 7),
    ("Nahum", 3), ("Habakkuk", 3), ("Zephaniah", 3), ("Haggai", 2),
    ("Zechariah", 14), ("Malachi", 4), ("Matthew", 28), ("Mark", 16),
    ("Luke", 24), ("John", 21), ("Acts", 28), ("Romans", 16),
    ("1Corinthians", 16), ("2Corinthians", 13), ("Galatians", 6),
    ("Ephesians", 6), ("Philippians", 4), ("Colossians", 4),
    ("1Thessalonians", 5), ("2Thessalonians", 3), ("1Timothy", 6),
    ("2Timothy", 4), ("Titus", 3), ("Philemon", 1), ("Hebrews", 13),
    ("James", 5), ("1Peter", 5), ("2Peter", 3), ("1John", 5),
    ("2John", 1), ("3John", 1), ("Jude", 1), ("Revelation", 22),
]

DISPLAY_NAMES = {
    "1Samuel": "1 Samuel", "2Samuel": "2 Samuel", "1Kings": "1 Kings",
    "2Kings": "2 Kings", "1Chronicles": "1 Chronicles", "2Chronicles": "2 Chronicles",
    "SongofSongs": "Song of Songs", "1Corinthians": "1 Corinthians",
    "2Corinthians": "2 Corinthians", "1Thessalonians": "1 Thessalonians",
    "2Thessalonians": "2 Thessalonians", "1Timothy": "1 Timothy",
    "2Timothy": "2 Timothy", "1Peter": "1 Peter", "2Peter": "2 Peter",
    "1John": "1 John", "2John": "2 John", "3John": "3 John",
}


class VerseParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_verse = False
        self.depth = 0
        self.parts: list[str] = []
        self.verses: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        attributes = dict(attrs)
        classes = set(attributes.get("class", "").split())
        if tag == "p" and "verse" in classes and not self.in_verse:
            self.in_verse = True
            self.depth = 1
            self.parts = []
        elif self.in_verse:
            self.depth += 1

    def handle_endtag(self, tag: str) -> None:
        if not self.in_verse:
            return
        self.depth -= 1
        if self.depth == 0:
            text = " ".join(html.unescape("".join(self.parts)).split())
            if text:
                self.verses.append(text)
            self.in_verse = False

    def handle_data(self, data: str) -> None:
        if self.in_verse:
            self.parts.append(data)


def extract_verses(path: Path) -> list[str]:
    parser = VerseParser()
    parser.feed(path.read_text(encoding="utf-8-sig", errors="replace"))
    return parser.verses


def import_bible(source: Path, destination: Path) -> dict[str, object]:
    source = source.resolve()
    destination = destination.resolve()
    if not source.is_dir():
        raise FileNotFoundError(f"Bible HTML folder not found: {source}")

    files: dict[tuple[str, int], Path] = {}
    pattern = re.compile(r"^\d{2}_(.+)_(\d+)\.html$", re.IGNORECASE)
    for path in source.glob("*.html"):
        match = pattern.match(path.name)
        if match:
            files[(match.group(1), int(match.group(2)))] = path

    expected = {(book, chapter) for book, chapters in BOOKS for chapter in range(1, chapters + 1)}
    missing = sorted(expected.difference(files), key=lambda item: (next(i for i, book in enumerate(BOOKS) if book[0] == item[0]), item[1]))
    if missing:
        raise ValueError("Missing Bible chapters: " + ", ".join(f"{book} {chapter}" for book, chapter in missing))

    destination.mkdir(parents=True, exist_ok=True)
    verse_total = 0
    output_files: list[str] = []
    for number, (book, chapter_count) in enumerate(BOOKS, start=1):
        display = DISPLAY_NAMES.get(book, book)
        lines = [f"Holy Bible Recovery Version — {display}", ""]
        for chapter in range(1, chapter_count + 1):
            verses = extract_verses(files[(book, chapter)])
            if not verses:
                raise ValueError(f"No verses found in {files[(book, chapter)].name}")
            lines.extend((f"{display} {chapter}", ""))
            lines.extend(verses)
            lines.append("")
            verse_total += len(verses)
        filename = f"{number:02d} {display} - Recovery Version.txt"
        (destination / filename).write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
        output_files.append(filename)

    manifest = {
        "version": 1,
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "source": str(source),
        "books": len(BOOKS),
        "chapters": len(expected),
        "verses": verse_total,
        "files": output_files,
        "notice": "Source text supplied by the user. Observe the publisher's applicable copyright and API terms.",
    }
    (destination / "import-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a clean Recovery Version Bible collection.")
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print(json.dumps(import_bible(args.source, args.destination), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
