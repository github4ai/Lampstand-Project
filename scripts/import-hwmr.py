import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


SECTION_RE = re.compile(r"WEEK\s+(\d+)\s*[—-]\s*(OUTLINE|DAY\s+(\d+)|HYMN)", re.I)
MESSAGE_NUMBERS = {word: index for index, word in enumerate(('One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'), 1)}


def extract_pages(path: Path, reader: PdfReader) -> list[str]:
    pages = [page.extract_text(extraction_mode="layout") or "" for page in reader.pages]
    tesseract = shutil.which("tesseract")
    if not tesseract:
        return pages
    try:
        import pypdfium2 as pdfium
        document = pdfium.PdfDocument(str(path))
        for index, text in enumerate(pages):
            if len(compact(text)) >= 30:
                continue
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as image_file:
                image_path = Path(image_file.name)
            try:
                document[index].render(scale=2.2).to_pil().save(image_path)
                result = subprocess.run([tesseract, str(image_path), "stdout", "-l", "eng"], capture_output=True, text=True, encoding="utf-8", errors="replace", check=False)
                if result.stdout and result.stdout.strip():
                    pages[index] = result.stdout
            finally:
                image_path.unlink(missing_ok=True)
    except (ImportError, OSError):
        pass
    return pages


def compact(value: str) -> str:
    value = value.replace("\u00ad", "").replace("\u200b", "")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def clean_section(value: str) -> str:
    value = re.sub(r"‹‹|››", " ", value)
    value = re.sub(r"Back to the table of contents", " ", value, flags=re.I)
    value = re.sub(r"<\s*Previous\s*(?:\||$)|Next\s*>", " ", value, flags=re.I)
    value = re.sub(r"©\s*\d{4}\s+Living Stream Ministry\s+All rights reserved\.?", " ", value, flags=re.I)
    return compact(value)


def clean_layout(value: str) -> str:
    """Keep the paragraph and line structure exposed by the PDF layout layer."""
    value = value.replace("\u00ad", "").replace("\u200b", "")
    value = re.sub(r"‹‹|››", " ", value)
    value = re.sub(r"Back to the table of contents", " ", value, flags=re.I)
    value = re.sub(r"^\s*<\s*Previous\s*$|^\s*\|\s*$|^\s*Next\s*>\s*$", "", value, flags=re.I | re.M)
    value = re.sub(r"©\s*\d{4}\s+Living Stream Ministry\s*\n\s*All rights reserved\.?", "", value, flags=re.I)
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    output = []
    blank = False
    for line in lines:
        if not line:
            if output and not blank:
                output.append("")
            blank = True
            continue
        output.append(line)
        blank = False
    return "\n".join(output).strip()


def join_wrapped(lines: list[str]) -> str:
    result = ""
    for line in lines:
        line = re.sub(r"\s+", " ", line).strip()
        if not line:
            continue
        if result.endswith("-"):
            result += line
        else:
            result += (" " if result else "") + line
    return result.strip()


def clean_paragraphs(value: str) -> str:
    layout = clean_layout(value)
    return "\n\n".join(join_wrapped(group.splitlines()) for group in re.split(r"\n{2,}", layout) if group.strip())


def clean_indented_paragraphs(value: str) -> str:
    lines = [line for line in value.splitlines() if line.strip()]
    if not lines:
        return ""
    indents = [len(line) - len(line.lstrip()) for line in lines]
    baseline = min(indents)
    groups = []
    current = []
    for line, indent in zip(lines, indents):
        starts_paragraph = bool(current) and (indent >= baseline + 3 or line.strip().lower().startswith("further reading:"))
        if starts_paragraph:
            groups.append(join_wrapped(current))
            current = []
        current.append(line)
    if current:
        groups.append(join_wrapped(current))
    cleaned = "\n\n".join(groups)
    # Bibliographic references are frequently wrapped at page-layout column
    # boundaries. Keep CWWL/CWWN year, volume, title, and chapter together.
    cleaned = re.sub(r"\b(vol\.)\s*\n+\s*(\d+)", r"\1 \2", cleaned, flags=re.I)
    cleaned = re.sub(r"\b(chs?\.)\s*\n+\s*([\d—–-]+)", r"\1 \2", cleaned, flags=re.I)
    cleaned = re.sub(r"(Further Reading:[^\n]*)\n+(?=(?:CWW[NL]|Life-study|The |Messages?\b))", r"\1 ", cleaned, flags=re.I)
    return cleaned


def parse_morning(value: str) -> tuple[list[dict], str]:
    lines = [line for line in value.splitlines() if line.strip()]
    reference_re = re.compile(r"^\s*((?:[1-3]\s*)?[A-Za-z]+\.?(?:\s+[A-Za-z]+)*\s+\d+:\d+(?:-\d+)?)\s*$")
    verses = []
    current = None
    commentary = []
    in_commentary = False
    for line in lines:
        match = reference_re.match(line)
        indent = len(line) - len(line.lstrip())
        if match and not in_commentary:
            if current:
                verses.append({"reference": current[0], "text": join_wrapped(current[1])})
            current = [compact(match.group(1)), [], indent]
            continue
        # PDF text extraction preserves each publisher template's indentation,
        # but that base indentation is not consistent between HWMR volumes.
        # Commentary is indented relative to the verse reference/text, so use
        # the reference line as the baseline instead of assuming two spaces.
        if current and current[1] and indent >= current[2] + 2:
            verses.append({"reference": current[0], "text": join_wrapped(current[1])})
            current = None
            in_commentary = True
        if in_commentary:
            commentary.append(line)
        elif current:
            current[1].append(line)
    if current:
        verses.append({"reference": current[0], "text": join_wrapped(current[1])})
    return verses, clean_indented_paragraphs("\n".join(commentary))


def validate_books(books: list[dict]) -> dict:
    """Reject silently malformed daily portions on every HWMR import."""
    errors = []
    weekly_books = 0
    daily_portions = 0
    morning_verses = 0
    for book in books:
        if book.get("structure") == "messages":
            continue
        weekly_books += 1
        for week in book.get("weeks", []):
            week_location = f'{book.get("generalSubject", book.get("id"))} / Week {week.get("number")}'
            if not str(week.get("outline", "")).strip():
                errors.append(f"{week_location}: weekly outline is empty")
            hymn = week.get("hymn") or {}
            if not str(hymn.get("text", "")).strip():
                errors.append(f"{week_location}: weekly hymn text is empty")
            seen_days = set()
            for day in week.get("days", []):
                daily_portions += 1
                day_number = day.get("day")
                location = f'{book.get("generalSubject", book.get("id"))} / Week {week.get("number")} / Day {day_number}'
                if day_number in seen_days:
                    errors.append(f"{location}: duplicate day")
                seen_days.add(day_number)
                pages = day.get("pages") or []
                if len(pages) != 2 or not all(isinstance(page, int) and page > 0 for page in pages) or pages[0] > pages[1]:
                    errors.append(f"{location}: invalid source-page range {pages}")
                if not str(day.get("todaysReading", "")).strip():
                    errors.append(f"{location}: Today's Reading is empty")
                verses = day.get("morningVerses") or []
                if not verses:
                    errors.append(f"{location}: Morning Nourishment has no parsed verses")
                for verse in verses:
                    morning_verses += 1
                    if not str(verse.get("reference", "")).strip():
                        errors.append(f"{location}: verse reference is empty")
                    if not str(verse.get("text", "")).strip():
                        errors.append(f'{location}: verse text is empty after {verse.get("reference", "unknown reference")}')
            if seen_days != set(range(1, 7)):
                errors.append(f"{week_location}: expected Days 1-6, found {sorted(seen_days)}")
    if errors:
        preview = "\n - ".join(errors[:25])
        suffix = f"\n...and {len(errors) - 25} more" if len(errors) > 25 else ""
        raise ValueError(f"HWMR import quality check failed:\n - {preview}{suffix}")
    return {"weeklyBooks": weekly_books, "dailyPortions": daily_portions, "morningVerses": morning_verses}


def clean_outline(value: str) -> str:
    lines = clean_layout(value).splitlines()
    item_re = re.compile(r"^(?:Day\s+\d+|[IVX]+\s*\.|[A-Z]\s*\.|\d+\s*\.|[a-z]\s*\.)\s*", re.I)
    items = []
    current = []
    for line in lines:
        if not line:
            continue
        if item_re.match(line) or line.lower().startswith("scripture reading"):
            if current:
                items.append(join_wrapped(current))
            current = [line]
        else:
            current.append(line)
    if current:
        items.append(join_wrapped(current))
    return "\n".join(items)


def clean_hymn(value: str) -> str:
    lines = clean_layout(value).splitlines()
    stanzas = []
    current = []
    for line in lines:
        match = re.match(r"^(\d+)\s+(.+)$", line)
        if match:
            if current:
                stanzas.append("\n".join(current))
            current = [match.group(1) + "\t" + match.group(2)]
        elif line and current:
            current.append(line)
    if current:
        stanzas.append("\n".join(current))
    return "\n\n".join(stanzas)


def title_from_outline(text: str) -> str:
    text = SECTION_RE.sub(" ", text, count=1)
    before = re.split(r"Scripture Reading\s*:", text, maxsplit=1, flags=re.I)[0]
    return compact(before)


def parse_event(pages: list[str]) -> str:
    front = "\n".join(pages[:12])
    match = re.search(r"Semiannual Training\s*\(([^)]+)\)", front, re.I)
    if match:
        return f"Semiannual Training ({compact(match.group(1))})"
    match = re.search(r"International Training\s+for Elders and Responsible Ones\s*\(([^)]+)\)", front, re.I)
    if match:
        return f"International Training for Elders and Responsible Ones ({compact(match.group(1))})"
    match = re.search(r"(\d{4}\s+December Semiannual Training)", front, re.I)
    return compact(match.group(1)) if match else ""


def parse_key_statements(pages: list[str]) -> list[str]:
    for text in pages[:15]:
        if "Key Statements:" not in text:
            continue
        body = text.split("Key Statements:", 1)[1]
        lines = [compact(line) for line in body.splitlines() if compact(line)]
        statements = []
        current = []
        for line in lines:
            current.append(line)
            if line.endswith("."):
                statements.append(" ".join(current))
                current = []
        if current:
            statements.append(" ".join(current))
        return statements
    return []


def parse_conference_key_statements(page: str) -> list[str]:
    body = re.sub(r"^.*?CONFERENCE", "", page, count=1, flags=re.I | re.S)
    body = re.split(r"©|Š\s*\d{4}\s+Living", body, maxsplit=1, flags=re.I)[0]
    paragraphs = clean_paragraphs(body).split("\n\n")
    return [paragraph for paragraph in paragraphs if len(paragraph.split()) >= 8]


def parse_conference_messages(pages: list[str]) -> list[dict]:
    markers = []
    message_re = re.compile(r"\bMessage\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b", re.I)
    for page_index, page in enumerate(pages):
        match = message_re.search(compact(page))
        if match:
            number = MESSAGE_NUMBERS[match.group(1).title()]
            markers.append((page_index, number, match.group(0)))
    messages = []
    for index, (start, number, marker) in enumerate(markers):
        end = markers[index + 1][0] if index + 1 < len(markers) else len(pages)
        raw = "\n".join(pages[start:end])
        compact_raw = compact(raw)
        after_marker = re.split(re.escape(marker), compact_raw, maxsplit=1, flags=re.I)[-1]
        title = compact(re.split(r"Scripture\s+Reading\s*:", after_marker, maxsplit=1, flags=re.I)[0])
        scripture = re.search(r"Scripture\s+Reading\s*:", raw, re.I)
        outline = clean_outline(raw[scripture.start():] if scripture else raw)
        messages.append({"number": number, "title": title, "outline": outline, "days": [], "hymn": None})
    return messages


def parse_book(path: Path) -> dict:
    reader = PdfReader(str(path))
    pages = extract_pages(path, reader)
    markers = []
    for page_index, text in enumerate(pages):
        match = SECTION_RE.search(compact(text))
        if match:
            kind = "day" if match.group(3) else match.group(2).lower()
            markers.append({"page": page_index, "week": int(match.group(1)), "kind": kind, "day": int(match.group(3) or 0)})

    weeks = {}
    for marker_index, marker in enumerate(markers):
        end = markers[marker_index + 1]["page"] if marker_index + 1 < len(markers) else len(pages)
        raw = "\n".join(pages[marker["page"]:end])
        text = clean_layout(raw)
        week = weeks.setdefault(marker["week"], {"number": marker["week"], "title": "", "outline": "", "days": [], "hymn": None})
        if marker["kind"] == "outline":
            week["title"] = title_from_outline(raw)
            outline_body = SECTION_RE.sub("", raw, count=1)
            scripture_start = re.search(r"Scripture Reading\s*:", outline_body, re.I)
            if scripture_start:
                outline_body = outline_body[scripture_start.start():]
            week["outline"] = clean_outline(outline_body)
        elif marker["kind"] == "day":
            without_header = SECTION_RE.sub(" ", raw, count=1)
            parts = re.split(r"Today[’']s Reading", without_header, maxsplit=1, flags=re.I)
            morning = re.sub(r"^.*?Morning Nourishment", "", parts[0], count=1, flags=re.I | re.S)
            reading = parts[1] if len(parts) > 1 else ""
            reading = re.split(r"Enlightenment and inspiration", reading, maxsplit=1, flags=re.I)[0]
            morning_verses, morning_commentary = parse_morning(morning)
            week["days"].append({
                "day": marker["day"],
                "pages": [marker["page"] + 1, end],
                "morningVerses": morning_verses,
                "morningNourishment": morning_commentary,
                "todaysReading": clean_indented_paragraphs(reading),
            })
        elif marker["kind"] == "hymn":
            number = re.search(r"Hymns?,\s*#(\d+)", raw, re.I)
            body = SECTION_RE.sub(" ", raw, count=1)
            body = re.sub(r"Hymns?,\s*#\d+", " ", body, count=1, flags=re.I)
            week["hymn"] = {"number": number.group(1) if number else "", "pages": [marker["page"] + 1, end], "text": clean_hymn(body)}

    metadata = reader.metadata or {}
    title = compact(str(metadata.get("/Title") or path.stem))
    author = compact(str(metadata.get("/Author") or "Watchman Nee & Witness Lee"))
    volume_match = re.search(r"\bvol\.\s*([^,]+)$", title, re.I)
    event = parse_event(pages)
    general_subject = re.sub(r"^HWMR\s*-\s*", "", title, flags=re.I)
    structure = "weekly"
    if not weeks:
        conference_messages = parse_conference_messages(pages)
        if conference_messages:
            weeks = {item["number"]: item for item in conference_messages}
            structure = "messages"
            front = compact("\n".join(pages[:3]))
            subject_match = re.search(r"GENERAL\s+SUBJECT\s*:\s*(.+?)\s+Message\s+One\b", front, re.I)
            if subject_match:
                general_subject = compact(subject_match.group(1))
                title = general_subject
            date_match = re.search(r"International\s+Memorial\s+Day\s+Blending\s+Conference\s+(May\s+\d{1,2}-\d{1,2},\s*\d{4})", front, re.I)
            event = f"International Memorial Day Blending Conference ({compact(date_match.group(1))})" if date_match else "International Memorial Day Blending Conference"
    book_id = re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")
    return {
        "id": book_id,
        "fileName": path.name,
        "sourcePath": str(path),
        "title": title,
        "generalSubject": general_subject,
        "volume": compact(volume_match.group(1)) if volume_match else "",
        "author": author,
        "event": event,
        "keyStatements": parse_key_statements(pages) or (parse_conference_key_statements(pages[0]) if structure == "messages" else []),
        "structure": structure,
        "pageCount": len(pages),
        "weeks": sorted(weeks.values(), key=lambda item: item["number"]),
    }


def main() -> None:
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    books = [parse_book(path) for path in sorted(source.glob("*.pdf"))]
    audit = validate_books(books)
    audit_record = {
        "status": "passed",
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "books": len(books),
        "weeks": sum(len(book["weeks"]) for book in books),
        **audit,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"books": books, "audit": audit_record}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({**audit_record, "qualityCheck": "passed", "output": str(output)}))


if __name__ == "__main__":
    main()
