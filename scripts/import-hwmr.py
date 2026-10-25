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
# Some HWMR sheets carry no "WEEK n — OUTLINE" heading in the body at all; the outline is
# identified only by the running header, e.g. "... - Outline - Week 1 - Page 3".
OUTLINE_HEADER_RE = re.compile(r"[-–—]\s*Outline\s*[-–—]\s*Week\s+(\d+)", re.I)
RUNNING_HEADER_RE = re.compile(r"^\s*\S.*?[-–—]\s*Week\s+\d+\s*[-–—]\s*Page\s+\d+\s*$", re.I)
MESSAGE_NUMBERS = {word: index for index, word in enumerate(('One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'), 1)}


def strip_running_headers(text: str) -> str:
    return "\n".join(line for line in text.splitlines() if not RUNNING_HEADER_RE.match(line))


def cropped_sheet(reader: PdfReader) -> bool:
    """True when each sheet holds two pages side by side and the crop box keeps one.

    The bilingual 2026 HWMR prints Chinese and English on opposite halves of one A4 sheet.
    Reading the full media box welds both languages onto every line, so those files must be
    extracted through the crop box instead.
    """
    try:
        page = reader.pages[0]
        return float(page.cropbox.width) < float(page.mediabox.width) * 0.75
    except (AttributeError, IndexError, TypeError, ValueError):
        return False


def extract_pages_cropped(path: Path) -> list[str]:
    """Read only the visible half of each two-up sheet, reproducing the indentation that the
    layout-mode extractor relies on.

    PyMuPDF honours the crop box, so the opposite language is never seen. Fragments are then
    joined left-to-right within each horizontal band — music notation splits a line into
    syllables — and the band is shifted to the page's left margin, which is the measurement
    every downstream parser uses.
    """
    try:
        import fitz
    except ImportError:
        return []
    pages: list[str] = []
    with fitz.open(str(path)) as document:
        for page in document:
            rows: list[tuple[float, float, str]] = []
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    text = "".join(span["text"] for span in line["spans"]).strip()
                    if re.search(r"[A-Za-z0-9]", text):
                        rows.append((line["bbox"][1], line["bbox"][0], text))
            if not rows:
                pages.append("")
                continue
            left = min(row[1] for row in rows)
            bands: dict[int, list[tuple[float, str]]] = {}
            for y0, x0, text in rows:
                bands.setdefault(int(round(y0 / 3)), []).append((x0, text))
            lines = []
            for band in sorted(bands):
                parts = sorted(bands[band], key=lambda item: item[0])
                lines.append(" " * int(round(parts[0][0] - left)) + " ".join(text for _, text in parts))
            pages.append("\n".join(lines))
    return pages


def extract_pages(path: Path, reader: PdfReader) -> list[str]:
    if cropped_sheet(reader):
        cropped = extract_pages_cropped(path)
        if cropped:
            return cropped
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
    # Further Reading is a distinct bibliographic paragraph in the source.
    cleaned = re.sub(r"([^\n])\s+(Further Reading\s*:)", r"\1\n\n\2 ", cleaned, flags=re.I)
    return cleaned


PROSE_LEADIN_RE = re.compile(r"(?:In|Through|By|With|As|And|But|For|See|Compare|of|the)\s+", re.I)
REFERENCE_SHAPE_RE = re.compile(r"^(?:[1-3]\s*)?(?:[A-Za-z][A-Za-z .'&/-]*\s+)?\d+\s*:\s*\d")
BOOK_IN_REFERENCE_RE = re.compile(r"^(.*?)\s*\d+\s*:")


def clean_reference(value: str) -> str:
    """Drop the prose a heading leads with, "In Revelation 20:1-4", so the reference reads alone."""
    reference = compact(value)
    while True:
        leadin = PROSE_LEADIN_RE.match(reference)
        remainder = reference[leadin.end():] if leadin else ""
        if not leadin or not REFERENCE_SHAPE_RE.match(remainder):
            return reference
        reference = remainder


def inherit_book(previous: str, reference: str) -> str:
    """A second verse of the same passage is printed bare, "8:11"; carry its book over."""
    book = BOOK_IN_REFERENCE_RE.match(previous)
    return f"{book.group(1)} {reference}" if book else reference


def parse_morning(value: str) -> tuple[list[dict], str]:
    lines = [line for line in value.splitlines() if line.strip()]
    # A range may stop mid-verse, printed as "2 Sam. 7:12-14a".
    verses_range = r"\d+:\d+[a-c]?(?:-\d+[a-c]?)?"
    reference_re = re.compile(rf"^\s*((?:[1-3]\s*)?[A-Za-z]+\.?(?:\s+[A-Za-z]+)*\s+{verses_range})\s*$")
    # Some editions set the reference on its own line; the bilingual training sheets print
    # "Gal. 2:20 I am crucified..." with the verse text following on the same line.
    inline_reference_re = re.compile(rf"^\s*((?:[1-3]\s*)?[A-Z][a-z]+\.?(?:\s+[A-Z][A-Za-z]+\.?){{0,2}}\s+{verses_range})\s+(\S.*)$")
    bare_reference_re = re.compile(rf"^\s*({verses_range})\s+(\S.*)$")
    verses = []
    current = None
    commentary = []
    in_commentary = False
    for line in lines:
        indent = len(line) - len(line.lstrip())
        reference = None
        inline_text = None
        if not in_commentary:
            own = reference_re.match(line)
            inline = inline_reference_re.match(line)
            bare = bare_reference_re.match(line) if not inline else None
            if own:
                reference = clean_reference(own.group(1))
            elif inline:
                reference, inline_text = clean_reference(inline.group(1)), inline.group(2)
            elif bare and current and abs(indent - current[2]) <= 1:
                reference, inline_text = inherit_book(current[0], clean_reference(bare.group(1))), bare.group(2)
        if reference:
            if current:
                verses.append({"reference": current[0], "text": join_wrapped(current[1])})
            current = [reference, [inline_text] if inline_text else [], indent]
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


CHORD_TOKEN_RE = re.compile(r"^[A-G][#b♯♭]?(?:maj|min|dim|aug|sus|add|m)?\d{0,2}(?:/[A-G][#b♯♭]?)?$")
SUNG_LABEL_RE = re.compile(r"^\(?(?:c|chorus|refrain|repeat)\)?\.?$", re.I)


def _sheet_lines(page) -> list[tuple[float, float, float, str]]:
    rows = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = re.sub(r"[\x00-\x1f\x80-\x9f]", "", "".join(span["text"] for span in line["spans"])).strip()
            if re.search(r"[A-Za-z0-9]", text):
                rows.append((line["bbox"][1], line["bbox"][0], line["bbox"][2], text))
    return rows


def _sheet_hyphens(page) -> list[tuple[float, float]]:
    """The syllable dashes of a music sheet are drawn, not written, so they come back as paths."""
    marks = []
    for drawing in page.get_drawings():
        box = drawing["rect"]
        if box.height < 0.6 and 0.8 < box.width < 4 and box.x0 > 0:
            marks.append(((box.y0 + box.y1) / 2, (box.x0 + box.x1) / 2))
    return marks


def _is_notation_band(band: list[tuple[float, float, float, str]]) -> bool:
    return all(CHORD_TOKEN_RE.match(part) for _, _, _, text in band for part in re.sub(r"[^\x20-\x7e]", "", text).split())


def _is_chord(text: str, off_baseline: float = 0.0) -> bool:
    """A chord symbol, where the PDF draws a flat as a copyright glyph and the sheet's own
    brackets can leave a parenthesis attached to the letter."""
    token = text.strip("()").replace("©", "b")
    if not CHORD_TOKEN_RE.match(token):
        return False
    return any(character.isdigit() or character.islower() or character in "/b" for character in token) or abs(off_baseline) > 4


def _sung_fragments(band: list[tuple[float, float, float, str]], baseline: float) -> list[tuple[float, float, float, str]]:
    parts = []
    for left, right, top, text in sorted(band):
        text = re.sub(r"^\(C\)\s*", "", text).strip()
        if text and not _is_chord(text, top - baseline) and not SUNG_LABEL_RE.match(text):
            parts.append((left, right, top, text))
    return parts


def _known(word: str, vocabulary: set[str]) -> bool:
    core = re.sub(r"[^a-z]", "", word.lower())
    return len(core) <= 1 or core in vocabulary


def _syllable_line(fragments: list[tuple[float, float, float, str]], hyphens: list[tuple[float, float]], vocabulary: set[str]) -> tuple[str, bool]:
    """Rebuild one sung line from the fragments printed under the staves.

    Note spacing, not word spacing, sets the fragment positions, so the gaps cannot tell a
    syllable boundary from a word boundary. The dash drawn between two fragments can, and the
    words of the book itself settle the gaps left without one.
    """
    rows: dict[int, int] = {}
    for _, _, top, _ in fragments:
        rows[round(top)] = rows.get(round(top), 0) + 1
    # The sung row carries the most fragments; the sparser rows around it are chords and melisma.
    baseline = max(rows, key=lambda row: (rows[row], row))
    parts = _sung_fragments(fragments, baseline)
    if not parts:
        return "", False

    def dashed(x0: float, x1: float) -> bool:
        return any(x0 < mark_x < x1 and abs(mark_y - baseline) <= 8 for mark_y, mark_x in hyphens)

    units = [parts[0][3]]
    for left, right in zip(parts, parts[1:]):
        if dashed(left[1], right[0]):
            units[-1] += right[3]
        else:
            units.append(right[3])
    # A slur can be drawn between two words, but no dash joins across the punctuation that ends
    # one, so a unit carrying both is a false pair.
    units = [piece for unit in units for piece in re.split(r"(?<=[,.;:!?])(?=[^\s,.;:!?])", unit) if piece]
    runs_on = dashed(parts[-1][1], parts[-1][1] + 30)
    memo: dict[int, tuple[tuple[int, int], list[str]]] = {}

    def solve(index: int) -> tuple[tuple[int, int], list[str]]:
        """Read the syllables of one printed row as words.

        A dash is the publisher's own word break, so units no dash joins stay apart unless the
        words of the book prove them to be one word that was set without a dash.
        """
        if index >= len(units):
            return ((0, 0), [])
        if index in memo:
            return memo[index]
        best = None
        for span in range(1, 5):
            group = units[index:index + span]
            if len(group) < span or any(not unit[:1].islower() for unit in group[1:]):
                break
            word = "".join(group)
            # Two whole words set side by side are not one word, however the score falls out.
            if span > 1 and (not _known(word, vocabulary) or all(_known(unit, vocabulary) for unit in group)):
                continue
            score, words = solve(index + span)
            candidate = ((score[0] + (1 if _known(word, vocabulary) else 0), score[1] - 1), [word] + words)
            if best is None or candidate[0] > best[0]:
                best = candidate
        memo[index] = best
        return best

    line = re.sub(r"^(\d+)[.)]\s+", r"\1 ", " ".join(solve(0)[1]))
    return (line + "-" if runs_on and line else line), runs_on


def build_vocabulary(pages: list[str]) -> set[str]:
    """The words this publication actually uses, to settle syllable splits on a music sheet."""
    words: set[str] = set()
    for text in pages:
        for line in text.splitlines():
            if len(line.split()) < 3:
                continue
            words.update(word for word in (re.sub(r"[^a-z]", "", token.lower()) for token in line.split()) if len(word) > 1)
    return words


def extract_hymn_sheet(path: Path, page_indexes: list[int], vocabulary: set[str]) -> tuple[str, str]:
    """Read the weekly hymn from a music sheet: verse one is set under the notes, the rest
    print as two columns of ordinary text below the staves."""
    try:
        import fitz
    except ImportError:
        return "", ""
    lines: list[str] = []
    number = ""
    with fitz.open(str(path)) as document:
        for page_index in page_indexes:
            if page_index >= document.page_count:
                break
            page = document[page_index]
            rows = _sheet_lines(page)
            if len(rows) < 5:
                continue
            if not number:
                corner = [text for top, left, _, text in rows if text.isdigit() and top < float(page.rect.height) * 0.25 and left > float(page.rect.width) * 0.6]
                number = corner[0] if corner else ""
            hyphens = _sheet_hyphens(page)
            bands: dict[int, list[tuple[float, float, float, str]]] = {}
            for top, left, right, text in rows:
                if re.search(r"[A-Za-z]", text) or re.fullmatch(r"\d+[.)]", text):
                    bands.setdefault(int(round(top / 3)), []).append((left, right, top, text))
            half = float(page.rect.width) / 2
            header: list[str] = []
            left_column: list[str] = []
            right_column: list[str] = []
            sung: list[tuple[str, bool]] = []
            fragments: list[tuple[float, float, float, str]] = []
            fragment_y = 0.0

            def sing() -> None:
                nonlocal fragments
                if not fragments:
                    return
                line, runs_on = _syllable_line(fragments, hyphens, vocabulary)
                fragments = []
                if not line:
                    return
                if sung and sung[-1][1]:
                    # The dash says only that the hyphenated word continues; the row below it is
                    # still the next line of the verse, not the end of the previous one.
                    first, _, rest = line.partition(" ")
                    if first[:1].islower():
                        sung[-1] = (sung[-1][0][:-1] + first, runs_on)
                        if rest:
                            sung.append((rest, runs_on))
                        return
                    sung[-1] = (sung[-1][0][:-1] + line, runs_on)
                else:
                    sung.append((line, runs_on))

            for key in sorted(bands):
                band = sorted(bands[key])
                if _is_notation_band(band):
                    continue
                top = key * 3
                written = [text for _, _, _, text in band if not text.isdigit()]
                if written and any(" " in text for text in written) and all(" " in text for text in written):
                    if not fragments and not sung:
                        header.extend(text for _, _, _, text in band)
                    else:
                        for left, _, _, text in band:
                            (left_column if left < half else right_column).append(text)
                    continue
                if fragments and top - fragment_y > 14:
                    sing()
                fragments.extend(band)
                fragment_y = top
            sing()
            lines.extend(header + [line for line, _ in sung] + left_column + right_column)
    return "\n".join(lines), number


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
    cropped = cropped_sheet(reader)
    markers = []
    for page_index, text in enumerate(pages):
        match = SECTION_RE.search(compact(text))
        if match:
            kind = "day" if match.group(3) else match.group(2).lower()
            markers.append({"page": page_index, "week": int(match.group(1)), "kind": kind, "day": int(match.group(3) or 0)})
    outline_starts: dict[int, int] = {}
    for page_index, text in enumerate(pages):
        match = OUTLINE_HEADER_RE.search(compact(text))
        if match:
            outline_starts.setdefault(int(match.group(1)), page_index)
    for week_number, page_index in outline_starts.items():
        if not any(marker["week"] == week_number and marker["kind"] == "outline" for marker in markers):
            markers.append({"page": page_index, "week": week_number, "kind": "outline", "day": 0})
    markers.sort(key=lambda marker: marker["page"])
    # The sung verse is the only text split into syllable fragments, so the pages carrying it
    # must not feed the word list used to rejoin those fragments.
    hymn_pages: set[int] = set()
    for marker_index, marker in enumerate(markers):
        if marker["kind"] != "hymn":
            continue
        stop = markers[marker_index + 1]["page"] if marker_index + 1 < len(markers) else len(pages)
        hymn_pages.update(range(marker["page"], stop))
    vocabulary = build_vocabulary([text for index, text in enumerate(pages) if index not in hymn_pages]) if cropped else set()

    weeks = {}
    for marker_index, marker in enumerate(markers):
        end = markers[marker_index + 1]["page"] if marker_index + 1 < len(markers) else len(pages)
        raw = strip_running_headers("\n".join(pages[marker["page"]:end]))
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
            if cropped:
                sheet, sheet_number = extract_hymn_sheet(path, range(marker["page"], end), vocabulary)
                body, number = sheet, number or (re.match(r"(\d+)", sheet_number) if sheet_number else None)
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
    books = []
    excluded = []
    # Validating book by book keeps one unreadable file from freezing the whole library;
    # previously a single failure discarded every parsed book and rewrote nothing at all.
    for path in sorted(source.glob("*.pdf")):
        try:
            book = parse_book(path)
            validate_books([book])
        except Exception as error:
            excluded.append({"file": path.name, "reason": " ".join(str(error).split())[:400]})
            continue
        books.append(book)
    if not books:
        details = "; ".join(f"{item['file']}: {item['reason']}" for item in excluded)
        raise ValueError(f"No HWMR file passed its quality check — {details}")
    audit = validate_books(books)
    audit_record = {
        "status": "passed" if not excluded else "passed_with_exclusions",
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "books": len(books),
        "weeks": sum(len(book["weeks"]) for book in books),
        "excluded": excluded,
        **audit,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"books": books, "audit": audit_record}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({**audit_record, "qualityCheck": audit_record["status"], "output": str(output)}))


if __name__ == "__main__":
    main()
