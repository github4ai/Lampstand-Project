"""Convert the authorized LSM single-file HTML archive into Lampstand's SQLite library."""

from __future__ import annotations

import argparse
import csv
import html
import io
import re
import sqlite3
import zipfile
from pathlib import Path

BOOK_START = re.compile(r'<section class="book" id="book-(\d+)">', re.I)
BLOCK = re.compile(r'<(h2|h3|p)\b([^>]*)>(.*?)</\1>', re.I | re.S)
TAG = re.compile(r'<[^>]+>')


def clean(value: str) -> str:
    value = TAG.sub(' ', value)
    value = html.unescape(value).replace('\u200b', '').replace('\ufeff', '')
    return re.sub(r'\s+', ' ', value).strip()


def entry_text(archive: zipfile.ZipFile, suffix: str) -> str:
    name = next((item for item in archive.namelist() if item.endswith(suffix)), None)
    if not name:
        raise FileNotFoundError(f'Archive does not contain {suffix}')
    return archive.read(name).decode('utf-8-sig')


def book_sections(document: str):
    starts = list(BOOK_START.finditer(document))
    for index, match in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(document)
        yield match.group(1).zfill(4), document[match.start():end]


def chapters_from_book(section: str):
    body_start = section.find('<div class="text">')
    body = section[body_start + len('<div class="text">'):] if body_start >= 0 else section
    chapters = []
    title = 'Content'
    blocks = []

    def finish():
        nonlocal blocks
        if blocks:
            chapters.append((title, blocks))
            blocks = []

    for match in BLOCK.finditer(body):
        tag = match.group(1).lower()
        text = clean(match.group(3))
        if not text:
            continue
        if tag == 'h2':
            finish()
            title = text
            continue
        blocks.append(('heading' if tag == 'h3' else 'paragraph', 3 if tag == 'h3' else None, text))
    finish()
    if not chapters:
        return [('Content', [('paragraph', None, clean(body))])]

    # Some source books repeat section headings inside the table of contents.
    # Keep those entries with Content instead of exposing false Preface/Appendix
    # reading sections. A real section contains prose; a TOC fragment is made up
    # primarily of numbered entries (occasionally with a heading between them).
    if chapters[0][0].strip().lower() in {'content', 'table of contents'}:
        content_title, content_blocks = chapters[0]
        first_real_section = 1
        while first_real_section < len(chapters):
            _, candidate_blocks = chapters[first_real_section]
            paragraphs = [text for kind, _, text in candidate_blocks if kind == 'paragraph']
            numbered = [text for text in paragraphs if re.match(r'^\d+\.(?:\s|$)', text)]
            if not paragraphs or len(numbered) < max(1, (len(paragraphs) + 1) // 2):
                break
            content_blocks.extend(candidate_blocks)
            first_real_section += 1
        chapters = [('Content', content_blocks), *chapters[first_real_section:]]

    return chapters


def navigation_title(section_title: str, blocks):
    base = section_title.strip().title()
    if base.lower() in {'content', 'contents', 'front matter', 'table of contents'}:
        return 'Content'
    heading_index = next((index for index, (kind, _, text) in enumerate(blocks)
                          if kind == 'heading'
                          and text.strip().lower() != section_title.strip().lower()
                          and text.strip().lower() not in {'content', 'contents', 'front matter', 'table of contents'}), -1)
    heading_parts = []
    if heading_index >= 0:
        for kind, _, text in blocks[heading_index:]:
            if kind != 'heading':
                break
            heading_parts.append(text.strip())
    subtitle = ' '.join(heading_parts)
    return f'{base} — {subtitle}' if subtitle else base


def create_database(output: Path):
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()
    database = sqlite3.connect(output)
    database.executescript('''
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA temp_store=MEMORY;
        CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE books (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL,
          chapters INTEGER NOT NULL, first_chapter INTEGER NOT NULL,
          last_chapter INTEGER NOT NULL, source_url TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE chapters (
          book_id TEXT NOT NULL, number INTEGER NOT NULL, title TEXT NOT NULL,
          PRIMARY KEY (book_id, number)
        );
        CREATE TABLE blocks (
          row_id INTEGER PRIMARY KEY, book_id TEXT NOT NULL,
          chapter_number INTEGER NOT NULL, block_number INTEGER NOT NULL,
          type TEXT NOT NULL, level INTEGER, text TEXT NOT NULL,
          UNIQUE (book_id, chapter_number, block_number)
        );
        CREATE INDEX blocks_chapter ON blocks(book_id, chapter_number, block_number);
        CREATE VIRTUAL TABLE block_search USING fts5(
          text, content='blocks', content_rowid='row_id',
          tokenize='unicode61 remove_diacritics 2'
        );
        CREATE TABLE missing_titles (index_position INTEGER, title TEXT NOT NULL);
    ''')
    return database


def import_archive(source: Path, output: Path):
    with zipfile.ZipFile(source) as archive:
        document = entry_text(archive, 'Living Stream Ministry Library.html')
        manifest = list(csv.DictReader(io.StringIO(entry_text(archive, 'source/manifest.csv'))))
        missing = list(csv.DictReader(io.StringIO(entry_text(archive, 'source/missing_index_titles.csv'))))

    manifest_by_number = {str(row['book_no']).zfill(4): row for row in manifest}
    database = create_database(output)
    total_chapters = total_blocks = 0
    try:
        database.execute('BEGIN')
        for book_id, section in book_sections(document):
            manifest_row = manifest_by_number.get(book_id, {})
            heading = re.search(r'<header class="book-head"><h1>(.*?)</h1>', section, re.I | re.S)
            title = clean(heading.group(1)) if heading else manifest_row.get('title', f'Book {book_id}')
            source_match = re.search(r'https?://www\.ministrybooks\.org/[^\s"\'<>]+', section, re.I)
            source_url = html.unescape(source_match.group(0)) if source_match else ''
            chapters = chapters_from_book(section)
            database.execute(
                'INSERT INTO books VALUES (?, ?, ?, ?, ?, ?, ?)',
                (f'book-{book_id}', title, 'Living Stream Ministry', len(chapters), 1, len(chapters), source_url),
            )
            for chapter_number, (chapter_title, blocks) in enumerate(chapters, 1):
                database.execute('INSERT INTO chapters VALUES (?, ?, ?)', (f'book-{book_id}', chapter_number, navigation_title(chapter_title, blocks)))
                for block_number, (kind, level, text) in enumerate(blocks, 1):
                    database.execute(
                        'INSERT INTO blocks(book_id, chapter_number, block_number, type, level, text) VALUES (?, ?, ?, ?, ?, ?)',
                        (f'book-{book_id}', chapter_number, block_number, kind, level, text),
                    )
                    total_blocks += 1
                total_chapters += 1
        database.executemany('INSERT INTO missing_titles VALUES (?, ?)', ((int(row['index_position']), row['title']) for row in missing))
        database.executemany('INSERT INTO metadata VALUES (?, ?)', [
            ('version', '1'), ('source_file', source.name), ('books', str(len(manifest))),
            ('chapters', str(total_chapters)), ('blocks', str(total_blocks)),
            ('missing_titles', str(len(missing))),
        ])
        database.execute("INSERT INTO block_search(block_search) VALUES('rebuild')")
        database.commit()
        database.execute('VACUUM')
    finally:
        database.close()
    print(f'Imported {len(manifest)} books, {total_chapters} chapters, and {total_blocks} blocks into {output}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=Path('data/ministry-books/library.sqlite'))
    args = parser.parse_args()
    import_archive(args.source.resolve(), args.output.resolve())


if __name__ == '__main__':
    main()
