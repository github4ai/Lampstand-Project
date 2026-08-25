from __future__ import annotations

import os
import re
import json
import hashlib
import shutil
import struct
import subprocess
import sys
import textwrap
import zipfile
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree

try:
    import fitz
except ImportError:
    fitz = None

try:
    import ocrmypdf
except ImportError:
    ocrmypdf = None


AI_ROOT = Path(os.environ.get("AIOS_AI_ROOT", Path.cwd())).resolve()
KNOWLEDGE_ROOT = Path(os.environ.get("AIOS_KNOWLEDGE_DIR", AI_ROOT / "Knowledge")).resolve()
OCR_ARCHIVE = Path(os.environ.get("AIOS_OCR_ARCHIVE", AI_ROOT / "OCR" / "Archive")).resolve()
INDEX_BUILDER = Path(os.environ.get("AIOS_INDEX_BUILDER", AI_ROOT / "Scripts" / "Indexing" / "build_index.py")).resolve()
INDEX_ROOT = Path(os.environ.get("AIOS_KNOWLEDGE_INDEX_DIR", AI_ROOT / "Index")).resolve()
CONVERTIBLE_EXTENSIONS = {".html", ".htm", ".epub", ".docx", ".pptx", ".txt", ".md", ".markdown", ".pdb"}
INDEX_SUFFIX = ".aios-index.pdf"


class VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style", "svg", "noscript"}:
            self.hidden += 1
        elif not self.hidden and tag in {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "svg", "noscript"} and self.hidden:
            self.hidden -= 1
        elif not self.hidden and tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)

    def text(self) -> str:
        lines = (" ".join(line.split()) for line in "".join(self.parts).splitlines())
        return "\n".join(line for line in lines if line)


def decode_text(data: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-16", "cp1252"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def html_to_text(data: bytes) -> str:
    parser = VisibleTextParser()
    parser.feed(decode_text(data))
    return parser.text()


def decompress_palmdoc(data: bytes) -> bytes:
    output = bytearray()
    position = 0
    while position < len(data):
        marker = data[position]
        position += 1
        if marker == 0 or 9 <= marker <= 0x7F:
            output.append(marker)
        elif 1 <= marker <= 8:
            output.extend(data[position:position + marker])
            position += marker
        elif 0x80 <= marker <= 0xBF:
            if position >= len(data):
                raise ValueError("PalmDOC back-reference is incomplete.")
            pair = (marker << 8) | data[position]
            position += 1
            distance = (pair >> 3) & 0x7FF
            length = (pair & 0x07) + 3
            if distance == 0 or distance > len(output):
                raise ValueError("PalmDOC back-reference is invalid.")
            for _ in range(length):
                output.append(output[-distance])
        else:
            output.extend((0x20, marker ^ 0x80))
    return bytes(output)


def extract_palmdoc(data: bytes) -> str:
    if len(data) < 78:
        raise ValueError("The PDB header is incomplete.")
    document_type = data[60:64]
    creator = data[64:68]
    if document_type == b"SDoc" and creator == b"SilX":
        raise ValueError(
            "This is an iSilo 3 SDoc PDB. Its proprietary compression cannot be indexed directly. "
            "Export the authorized document from iSilo as HTML, TXT, or PDF, then upload the exported file."
        )
    record_count = struct.unpack_from(">H", data, 76)[0]
    if record_count < 2 or len(data) < 78 + record_count * 8:
        raise ValueError("The PDB does not contain PalmDOC text records.")
    offsets = [struct.unpack_from(">I", data, 78 + index * 8)[0] for index in range(record_count)]
    offsets.append(len(data))
    records = [data[offsets[index]:offsets[index + 1]] for index in range(record_count)]
    if len(records[0]) < 16:
        raise ValueError("The PalmDOC metadata record is incomplete.")
    compression, _, text_length, text_records, _ = struct.unpack_from(">HHIHH", records[0], 0)
    if compression not in {1, 2}:
        raise ValueError(f"PDB compression type {compression} is not supported. Use PalmDOC or uncompressed PDB.")
    if text_records < 1 or text_records >= len(records):
        raise ValueError("The PalmDOC text-record count is invalid.")
    blocks = records[1:text_records + 1]
    content = b"".join(decompress_palmdoc(block) if compression == 2 else block for block in blocks)
    return decode_text(content[:text_length]).replace("\x00", "")


def extract_source_text(source: Path) -> str:
    extension = source.suffix.lower()
    if extension in {".txt", ".md", ".markdown"}:
        return decode_text(source.read_bytes())
    if extension in {".html", ".htm"}:
        return html_to_text(source.read_bytes())
    if extension == ".epub":
        with zipfile.ZipFile(source) as archive:
            pages = [name for name in archive.namelist() if Path(name).suffix.lower() in {".html", ".htm", ".xhtml"}]
            return "\n\n".join(html_to_text(archive.read(name)) for name in sorted(pages))
    if extension == ".docx":
        with zipfile.ZipFile(source) as archive:
            root = ElementTree.fromstring(archive.read("word/document.xml"))
        namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        paragraphs = []
        for paragraph in root.iter(f"{namespace}p"):
            text = "".join(node.text or "" for node in paragraph.iter(f"{namespace}t")).strip()
            if text:
                paragraphs.append(text)
        return "\n".join(paragraphs)
    if extension == ".pptx":
        with zipfile.ZipFile(source) as archive:
            slide_names = sorted(name for name in archive.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", name))
            namespace = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
            slides = []
            for name in slide_names:
                root = ElementTree.fromstring(archive.read(name))
                text = "\n".join("".join(node.text or "" for node in paragraph.iter(f"{namespace}t")).strip()
                                 for paragraph in root.iter(f"{namespace}p"))
                if text.strip(): slides.append(text)
        return "\n\n".join(slides)
    if extension == ".pdb":
        return extract_palmdoc(source.read_bytes())
    raise ValueError(f"Unsupported source format: {extension}")


def write_searchable_pdf(source: Path, destination: Path, text: str) -> None:
    document = fitz.open()
    lines: list[str] = [source.name, ""]
    for paragraph in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if not paragraph.strip():
            lines.append("")
        else:
            lines.extend(textwrap.wrap(paragraph.strip(), width=105, replace_whitespace=True,
                                       drop_whitespace=True, break_long_words=False) or [""])
    for offset in range(0, len(lines), 54):
        page = document.new_page(width=595, height=842)
        page.insert_text((48, 55), "\n".join(lines[offset:offset + 54]), fontsize=10.5,
                         fontname="helv", lineheight=1.25)
    temporary = destination.with_name(f".{destination.name}.tmp")
    document.save(temporary, garbage=4, deflate=True)
    document.close()
    os.replace(temporary, destination)


def prepare_convertible_sources() -> int:
    failures = 0
    for source in sorted(path for path in KNOWLEDGE_ROOT.rglob("*") if path.is_file() and path.suffix.lower() in CONVERTIBLE_EXTENSIONS):
        destination = source.with_name(f"{source.stem}{INDEX_SUFFIX}")
        if destination.is_file() and destination.stat().st_mtime_ns >= source.stat().st_mtime_ns:
            continue
        try:
            print(f"CONVERT : {source.relative_to(KNOWLEDGE_ROOT).as_posix()}", flush=True)
            text = extract_source_text(source).strip()
            if not text:
                raise ValueError("No readable text was found.")
            write_searchable_pdf(source, destination, text)
            print(f"CONVERTED : {destination.relative_to(KNOWLEDGE_ROOT).as_posix()}", flush=True)
        except Exception as error:
            failures += 1
            print(f"CONVERSION FAILED : {source.name}\n{error}", flush=True)
    return failures


def has_searchable_text(pdf: Path) -> bool:
    try:
        with fitz.open(pdf) as document:
            if not len(document):
                return False
            page_characters = [len(page.get_text("text").strip()) for page in document]
            readable_pages = sum(characters >= 40 for characters in page_characters)
            required_pages = max(1, int(len(page_characters) * .7))
            searchable = sum(page_characters) >= 80 and readable_pages >= required_pages
            if not searchable:
                print(f"OCR NEEDED : {pdf.name} ({readable_pages}/{len(page_characters)} pages contain searchable text)", flush=True)
            return searchable
    except Exception as error:
        print(f"OCR CHECK FAILED : {pdf.name}\n{error}", flush=True)
        return True


def make_searchable(pdf: Path) -> bool:
    relative = pdf.relative_to(KNOWLEDGE_ROOT)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    archived = OCR_ARCHIVE / stamp / relative
    temporary = pdf.with_name(f".{pdf.stem}.aios-ocr.pdf")
    print(f"OCR : {relative.as_posix()}", flush=True)
    try:
        archived.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pdf, archived)
        ocrmypdf.ocr(pdf, temporary, skip_text=True, deskew=True, rotate_pages=True,
                     jobs=max(1, min(4, os.cpu_count() or 1)), progress_bar=False)
        os.replace(temporary, pdf)
        print(f"OCR COMPLETED : {relative.as_posix()}", flush=True)
        return True
    except Exception as error:
        temporary.unlink(missing_ok=True)
        print(f"OCR FAILED : {relative.as_posix()}\n{error}", flush=True)
        return False


def normalize_index_categories() -> None:
    """Keep chunk metadata aligned with the top-level index directory."""
    if not INDEX_ROOT.is_dir():
        return

    for category_dir in sorted(path for path in INDEX_ROOT.iterdir() if path.is_dir()):
        category = category_dir.name
        chunks_dir = category_dir / "Chunks"
        for chunk_file in sorted(chunks_dir.glob("*_chunks.json")):
            try:
                chunks = json.loads(chunk_file.read_text(encoding="utf-8"))
                changed = False
                for chunk in chunks:
                    if chunk.get("category") != category:
                        chunk["category"] = category
                        changed = True
                if changed:
                    chunk_file.write_text(
                        json.dumps(chunks, indent=4, ensure_ascii=False),
                        encoding="utf-8",
                    )
            except Exception as error:
                print(f"CATEGORY REPAIR FAILED : {chunk_file.name}\n{error}", flush=True)

        manifest_file = category_dir / "Metadata" / "chunk_manifest.json"
        if manifest_file.is_file():
            try:
                records = json.loads(manifest_file.read_text(encoding="utf-8"))
                changed = False
                for record in records:
                    if record.get("category") != category:
                        record["category"] = category
                        changed = True
                if changed:
                    manifest_file.write_text(
                        json.dumps(records, indent=4, ensure_ascii=False),
                        encoding="utf-8",
                    )
            except Exception as error:
                print(f"MANIFEST REPAIR FAILED : {manifest_file}\n{error}", flush=True)

    print("Index categories normalized.", flush=True)


def normalize_page_text(value: str) -> str:
    """Normalize extracted text while preserving enough order for page matching."""
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def find_source_pdf(category: str, document_stem: str) -> Path | None:
    category_root = KNOWLEDGE_ROOT / category
    if not category_root.is_dir():
        return None
    names = [f"{document_stem}.pdf"]
    if document_stem.endswith(".aios-index"):
        names.append(f"{document_stem[:-len('.aios-index')]}.pdf")
    for name in names:
        matches = sorted(category_root.rglob(name))
        if matches:
            return matches[0]
    return None


def match_chunk_page(chunk_text: str, page_texts: list[str], start: int) -> int | None:
    normalized = normalize_page_text(chunk_text)
    if not normalized:
        return None

    words = normalized.split()
    probes: list[str] = []
    for offset in (0, 1, 2, 3):
        if len(words) > offset + 8:
            probes.append(" ".join(words[offset:offset + 28]))
            probes.append(" ".join(words[offset:offset + 14]))

    ordered_pages = list(range(start, len(page_texts))) + list(range(0, start))
    for probe in probes:
        if len(probe) < 35:
            continue
        for page_index in ordered_pages:
            if probe in page_texts[page_index]:
                return page_index

    # OCR and PDF extraction occasionally disagree on punctuation or a few words.
    # Use an ordered-token overlap fallback, while keeping matches sequential.
    sample = set(words[:40])
    if len(sample) < 6:
        return None
    best_page = None
    best_score = 0.0
    for page_index in ordered_pages:
        candidate = set(page_texts[page_index].split())
        score = len(sample & candidate) / len(sample)
        if score > best_score:
            best_page, best_score = page_index, score
    return best_page if best_score >= 0.72 else None


def enrich_index_pages(category_filter: str | None = None) -> tuple[int, int]:
    """Attach original, one-based PDF page numbers to indexed chunks."""
    updated_files = 0
    updated_chunks = 0
    if not INDEX_ROOT.is_dir():
        return updated_files, updated_chunks

    category_dirs = sorted(path for path in INDEX_ROOT.iterdir() if path.is_dir())
    if category_filter:
        category_dirs = [path for path in category_dirs if path.name.casefold() == category_filter.casefold()]

    for category_dir in category_dirs:
        chunks_dir = category_dir / "Chunks"
        for chunk_file in sorted(chunks_dir.glob("*_chunks.json")):
            source_pdf = find_source_pdf(category_dir.name, chunk_file.name[:-len("_chunks.json")])
            if source_pdf is None:
                continue
            try:
                chunks = json.loads(chunk_file.read_text(encoding="utf-8"))
                if fitz is not None:
                    with fitz.open(source_pdf) as document:
                        page_texts = [normalize_page_text(page.get_text("text")) for page in document]
                else:
                    from pypdf import PdfReader
                    reader = PdfReader(str(source_pdf))
                    page_texts = [normalize_page_text(page.extract_text() or "") for page in reader.pages]
                cursor = 0
                changed = False
                for chunk in chunks:
                    existing = chunk.get("page")
                    if isinstance(existing, (int, float)) and int(existing) > 0:
                        cursor = max(cursor, int(existing) - 1)
                        continue
                    page_index = match_chunk_page(str(chunk.get("text") or ""), page_texts, cursor)
                    if page_index is None:
                        continue
                    chunk["page"] = page_index + 1
                    metadata = chunk.get("metadata")
                    if isinstance(metadata, dict):
                        metadata["page"] = page_index + 1
                    cursor = page_index
                    updated_chunks += 1
                    changed = True
                if changed:
                    temporary = chunk_file.with_suffix(".tmp")
                    temporary.write_text(json.dumps(chunks, indent=4, ensure_ascii=False), encoding="utf-8")
                    os.replace(temporary, chunk_file)
                    updated_files += 1
                    print(f"PAGE MAP : {category_dir.name}/{source_pdf.relative_to(KNOWLEDGE_ROOT / category_dir.name)}", flush=True)
            except Exception as error:
                print(f"PAGE MAP FAILED : {chunk_file}\n{error}", flush=True)

    print(f"Mapped {updated_chunks} chunk(s) in {updated_files} document(s) to original PDF pages.", flush=True)
    return updated_files, updated_chunks


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(65536), b""):
            digest.update(block)
    return digest.hexdigest()


def checkpoint_completed_artifacts() -> int:
    """Recover index checkpoints from complete chunk/embedding/FAISS sets."""
    recovered = 0
    if not KNOWLEDGE_ROOT.is_dir():
        return recovered
    for category_dir in sorted(path for path in KNOWLEDGE_ROOT.iterdir() if path.is_dir()):
        index_category = INDEX_ROOT / category_dir.name
        metadata_file = index_category / "Metadata" / "indexed_files.json"
        try:
            records = json.loads(metadata_file.read_text(encoding="utf-8")) if metadata_file.is_file() else {}
        except Exception:
            records = {}
        changed = False
        for pdf in sorted(category_dir.rglob("*.pdf")):
            stem = pdf.stem
            artifacts = (
                index_category / "Chunks" / f"{stem}_chunks.json",
                index_category / "Embeddings" / f"{stem}_embeddings.npy",
                index_category / "FAISS" / f"{stem}.index",
            )
            if not all(path.is_file() and path.stat().st_size > 0 for path in artifacts):
                continue
            relative_key = str(Path(KNOWLEDGE_ROOT.name) / pdf.relative_to(KNOWLEDGE_ROOT))
            if relative_key in records:
                continue
            digest = file_hash(pdf)
            records[relative_key] = {"hash": digest}
            recovered += 1
            changed = True
        if changed:
            metadata_file.parent.mkdir(parents=True, exist_ok=True)
            temporary = metadata_file.with_suffix(".tmp")
            temporary.write_text(json.dumps(records, indent=4), encoding="utf-8")
            os.replace(temporary, metadata_file)
    print(f"Recovered {recovered} completed index checkpoint(s).", flush=True)
    return recovered


def main() -> int:
    if "--pages-only" in sys.argv:
        category = None
        if "--category" in sys.argv:
            position = sys.argv.index("--category")
            if position + 1 < len(sys.argv):
                category = sys.argv[position + 1]
        enrich_index_pages(category)
        return 0

    failures = prepare_convertible_sources()
    checkpoint_completed_artifacts()
    for pdf in sorted(KNOWLEDGE_ROOT.rglob("*.pdf")):
        if not has_searchable_text(pdf) and not make_searchable(pdf):
            failures += 1
    result = subprocess.run([sys.executable, str(INDEX_BUILDER)], cwd=AI_ROOT, check=False)
    if result.returncode == 0:
        normalize_index_categories()
        enrich_index_pages()
    return result.returncode or (2 if failures else 0)


if __name__ == "__main__":
    raise SystemExit(main())
