# Lampstand Project Technical Documentation

## Architecture

Lampstand Project is an Electron desktop application containing a React and TypeScript frontend and a local Node.js gateway.

- Electron serves the production frontend on `127.0.0.1:5173`.
- The unified local gateway runs on `127.0.0.1:9656`.
- A legacy API can be proxied from `127.0.0.1:9655`. The gateway answers Knowledge browsing itself and forwards only the paths it has not taken over.
- Ollama normally runs on `127.0.0.1:11434`.
- Local Whisper normally runs on `127.0.0.1:8000`.
- Optional media providers use their separately configured local endpoints.

The application is local-first. Supabase supplies verified member identity and remote workspace policy; it is not the primary store for the bundled reading libraries.

## Project layout

- `src/` — React pages, components, stores, API clients, and styles.
- `server/` — local gateway, library readers, indexing routes, and provider integration.
- `desktop/` — Electron main process, preload bridge, service startup, and updater.
- `scripts/` — importers, indexing, OCR, translation, dependency setup, backup, and release preparation.
- `data/` — package-ready built-in libraries and definitions.
- `docs/` — user, installation, operational, and Supabase migration documentation.
- `release/` — generated Windows installer artifacts.

## Bundled library layout

The Windows installer packages `data/` as an Electron extra resource. Release preparation must provide:

- `data/hwmr-library.json`
- `data/hymnal-library.json`
- `data/ministry-books/library.sqlite`
- `data/ministry/recovery-bible/`
- `data/ministry/recovery-footnotes/`
- `data/ministry/life-study/`

Run `pnpm run prepare:library-bundle` before packaging. The command stages externally maintained source libraries and fails when a required library is missing. Backup SQLite files are excluded from the installer.

At runtime, `desktop/main.cjs` explicitly maps every packaged library to its resource path, together with the script locations (`AIOS_AI_ROOT`, `AIOS_HWMR_IMPORTER_SCRIPT`, `AIOS_INDEX_SCRIPT`), because `process.cwd()` in an installed application is not the repository. User-created Ministry imports are stored separately under Electron's user-data directory.

## Knowledge and indexing

Knowledge documents are organized by category, subcollection, and optional subject. The indexing pipeline extracts supported text, chunks it, builds embeddings and FAISS data, and records document metadata. Scanned PDFs pass through OCR before indexing. Production user knowledge and indexes live under the Electron user-data directory unless overridden.

Category, document, outline, viewer, and chunk-context browsing is answered locally by `server/knowledge.mjs` from the files the indexer writes, so the Knowledge screens work while the legacy API is stopped. Document detail reports its page, chunk, vector, and word counts from the stored artifacts, takes the embedding dimensions from each `.npy` header, and hashes the source file itself.

Key environment variables include:

- `AIOS_KNOWLEDGE_DIR`
- `AIOS_KNOWLEDGE_INDEX_DIR`
- `AIOS_KNOWLEDGE_TRASH_DIR`
- `AIOS_INDEX_PYTHON`
- `AIOS_INDEX_SCRIPT`
- `AIOS_INDEX_BUILDER`
- `AIOS_AI_ROOT` — the sibling AI root that locates `Knowledge/`, `Index/`, and the Python runtimes when the app is packaged

## Ministry import pipeline

- HWMR PDFs are transformed by `scripts/import-hwmr.py` into structured daily and weekly content. The importer reads `<AIOS_KNOWLEDGE_DIR>/Ministry/HWMR`, which is where Documents uploads land, so a PDF added through the app is picked up by the next refresh. `AIOS_HWMR_SOURCE_DIR` overrides that folder and `AIOS_HWMR_IMPORT_PYTHON` the interpreter used for it.
- Every refresh ends in a quality check of `passed` or `passed_with_exclusions`, and both publish. A file the reader cannot use is returned as an exclusion naming the file and the reason, which the app appends to the upload message; a refresh that throws reports the importer's own closing lines rather than a bare failure.
- Morning Nourishment references are stored so each one resolves on its own: a heading's prose lead-in ("In Revelation 20:1-4") is dropped, and a bare `8:11` inherits the book printed above it. `src/utils/bibleReferences.test.ts` requires every stored reference to link exactly one passage, which is the release gate for this library.
- Weekly hymns set as music are rebuilt from the two-up PDF sheets: syllable fragments are rejoined along the printed hyphen strokes, and chord rows — including the flat the sheet draws as `©` — are kept out of the lyric text.
- Recovery Bible text and study aids use the Recovery import scripts.
- Ministry Books are imported from the authorized single-file HTML archive into SQLite by `scripts/import-ministry-books-singlefile.py`.
- The Ministry Books importer distinguishes Content, Prefaces, numbered chapters, and appendices. Section display titles combine the role/number and actual heading.
- Scripture references preserve a return target so a reader can return to the same source position.

## Authentication and remote access

The desktop client uses only the Supabase project URL and public publishable key. Never distribute a service-role key. Row Level Security protects membership and workspace policies. Database setup and repairs are maintained in:

- `docs/lampstand-cloud-schema.sql`
- `docs/lampstand-cloud-members-migration.sql`
- `docs/lampstand-cloud-owner-bootstrap.sql`
- `docs/lampstand-cloud-fix-policy-recursion.sql`

The owner invites the exact member email and assigns role/workspace permissions. The desktop app refreshes expired sessions and denies access when no active membership exists.

## Development

```powershell
pnpm install
pnpm run start:local
pnpm run dev
```

Open `http://localhost:5173`. Put local overrides and secrets in `.env.local`; never commit it.

Useful verification commands:

```powershell
pnpm run lint
pnpm test
pnpm run build
pnpm run verify:release
```

## Windows packaging and updates

Create an installer with:

```powershell
pnpm run desktop:installer
```

This stages the reading libraries, builds the frontend, and creates an NSIS x64 installer in `release/`. Updates are published through the configured GitHub Releases repository with the installer, blockmap, and `latest.yml`. The Electron updater downloads only after the user requests it.

## Data protection and backups

Keep packaged reference libraries immutable. Store member-created knowledge, progress, annotations, conversations, media history, and imports in user-data locations. Backups should include those user-data folders and knowledge indexes; downloadable AI models may be omitted.

## Release checklist

1. Rebuild or refresh source libraries.
2. Run `pnpm run prepare:library-bundle`.
3. Verify every required library has non-zero files and size.
4. Run lint, tests, and production build.
5. Smoke-test sign-in, Ministry readers, School lesson/quiz selection, Documents, Knowledge, and service repair.
6. Build the installer on Windows.
7. Install on a clean test account without `I:\AI` source folders.
8. Publish installer, blockmap, and `latest.yml` only after approval.

## Compatibility

Historical internal `AIOS` names remain in selected environment variables, routes, folders, and saved keys to preserve existing data and integrations. User-facing branding is Lampstand Project.
