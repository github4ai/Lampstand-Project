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

## Video training library

`server/video-training.mjs` serves a folder of training media rather than a parsed library, so a file copied in by hand appears exactly like one uploaded in the app.

- The folder is `AIOS_VIDEO_TRAINING_DIR`, defaulting to `<AIOS_KNOWLEDGE_DIR>/Ministry/Video Training`; `AIOS_MAX_VIDEO_TRAINING_MB` (default 2048) caps a single upload. In the packaged app `AIOS_KNOWLEDGE_DIR` already points at `data/knowledge` under the user profile, so the folder is writable and survives updates.
- `GET /video-training/library` reads the directory, keeps only allowed extensions, and returns `{ root, total, items }` newest-first with `media: 'video' | 'document'`. `POST /video-training/upload?name=`, `GET|HEAD /video-training/file?name=` and `DELETE /video-training/file?name=` cover the rest.
- Uploads stream the raw request body to disk — chunks are flushed to `<file>.part` and renamed on success — because `readForm` buffers the whole body in memory and a video is far too large for that. An interrupted or oversized upload leaves no half-written file in the library, and a second file with the same name is refused with 409 instead of overwriting.
- File reads honour `Range` requests (`206` with `Content-Range`, `416` past the end, suffix `bytes=-N` for the tail), which is what lets `<video>` seek without downloading the file first. `Content-Type` is taken from the extension map, not from the client.
- Every name is reduced to a single basename, checked against the extension allowlist, and re-checked to stay inside the folder before it touches the disk. `server/video-training.test.mjs` covers the allowlist, the traversal refusal, the range arithmetic, the size cap, and the duplicate name.
- Gateway routes that write the response themselves must `await` the handler inside the server's `try`. Returning the promise skips that `catch`, and the rejection becomes an unhandled rejection that stops the whole gateway.
- The client is `src/api/videoTraining.ts` (the upload uses `XMLHttpRequest` so the page can show real progress) and `src/pages/VideoTrainingPage.tsx`, whose sheet reuses the HWMR reading typography. The Ministry dashboard card sits beside HWMR and Hymns.

## Scripture and phrase search

Both reading libraries are served by the gateway from locally held text; neither depends on the legacy API or on embeddings.

- `/recovery-bible/concordance?q=&limit=&match=` reads the 66 chapter files under `AIOS_RECOVERY_BIBLE_DIR` through `server/recovery-bible.mjs`, which caches the ~31,000 verse lines in memory as a concordance. The default `match=words` requires each typed word to appear somewhere in the verse. `match=phrase` requires the whole string, in order. Omitting `match` keeps the historical behaviour, which is what the Recovery Bible and Ministry Books browsing pages rely on.
- `/ministry-books/search?q=&limit=&match=` queries the FTS5 table `block_search` over `data/ministry-books/library.sqlite` and ranks with `bm25()`. Word mode ANDs the individual words; `match=phrase` quotes the whole sanitized string as one FTS5 phrase, which is what gives adjacency. If the SQLite library is absent, the same handler falls back to the HTML source folders and applies the identical word/phrase distinction in code.
- Presentation Studio uses phrase mode in its **Find a phrase** boxes; the picked result seeds the verse basket or the section picker through a deferred-selection ref, because the chapter the result names may still be loading when it is clicked.

## Presentation projection

The audience output is one persistent window owned by `desktop/main.cjs`. It is created on the first take-live and reused for every later slide so nothing flashes open mid-meeting; the same document is reproduced in a browser popup when the desktop bridge is unavailable.

- Slide payloads are built in `src/utils/` (`bibleSlide.ts`, `hymnalSlide.ts`, `hwmrSlide.ts`) and each builder embeds its own `<style>` in the HTML it hands to the audience window. Footnote, hymn and HWMR typography therefore travels with the slide and cannot silently drift from the studio. Audience *layout* CSS is the exception: it exists in three places — `audienceLayoutStyles` in `src/components/PresentOnDisplay.tsx`, the inline `<style>` written by `desktop/main.cjs`, and `src/pages/PresentationPage.css` for the studio preview. Change all three together.
- Scripture references are rendered as `<a class="verse-link" data-book data-chapter data-verse data-verse-end>` by `src/utils/bibleLinks.ts`, which is shared by the Bible slide and HWMR slide builders. A small script appended to the audience document intercepts the click and calls `window.lampstandAudience.selectVerse(reference)` — exposed by `desktop/presentation-preload.cjs`, sent as `lampstand:presentation-verse`, and re-emitted by the main process as `lampstand:audience-verse` to the studio window. The popup path uses `window.opener.postMessage({ type: 'lampstand:audience-verse' })` instead. The studio resolves the reference against the local Recovery Bible library and projects the verse as an interlude; the queued slide and run of show are untouched, and taking any slide live clears the interlude.
- `PresentOnDisplay` asks the main process for the current display list on demand — the **Detect displays** control — so a projector connected after launch becomes selectable without restarting the app. Preferences (screen, theme, text size, transition, fade speed and the chosen room speaker) are stored under `lampstand.presentation.prefs`, resolve on the next take-live, and reach the audience window as `audioSinkId`.
- **Media library.** `server/presentation-media.mjs` serves a second, user-owned folder (`config.presentationMediaDir`, default `<knowledgeDir>/Presentation Media`) over `GET /presentation-media/library`, `POST /presentation-media/upload?name=`, `GET|HEAD /presentation-media/file?name=`, `DELETE /presentation-media/file|group?name=` and `POST /presentation-media/deck?name=`. Names are sanitised before they touch the disk (`safeRelativePath`: at most three `/` segments, no leading dot, no Windows-illegal character, 120-character stem, extension allowlist) and every read re-checks that the resolved path is still inside the root. Files stream with full HTTP Range support (`206`/`Content-Range`, `bytes=-N`, `416`), which is what lets the projector seek inside a large video; `server/media.mjs` has no range handling and is not used for this. Like the video-training routes, the streaming route `await`s inside the gateway's `try` and only then `return`s — returning the promise would bypass the catch and kill the Node process. SVG is excluded on purpose: an uploaded vector file is an HTML document that would run inside the projector window.
- **Media slides.** `src/utils/mediaSlide.ts` builds image, video, audio and PDF slides from a library path and always emits the *absolute* gateway URL, because the audience document is a `data:` URL and cannot resolve a relative one (a probe confirmed a `data:` document may still load `http://127.0.0.1:9656` media). Video is projected without `controls` — the studio drives the player through IPC. Height comes from `var(--media-max, 66vh)` so the same slide fits the small studio preview.
- **PowerPoint.** `server/presentation-decks.mjs` shells out to `scripts/export-presentation-deck.ps1` (PowerPoint COM, one PNG per slide plus the title text) and returns `{ group, total, pages[] }`; the converter's single JSON line is parsed there, `422` carries the "save it as a PDF" instruction when PowerPoint is missing, and `504` when the conversion is killed. The script path arrives as `AIOS_PRESENTATION_DECK_SCRIPT` and ships through `extraResources`.
- **Web output.** `ipcMain` handler `lampstand:open-presentation-web` loads any `http(s)` URL into the same audience window. That window uses `partition: 'persist:lampstand-audience'`, so a sign-in done once survives to the next meeting; `configureMediaPermissions()` grants `media`, `mediaKeySystem` and `fullscreen` on that partition only, and `autoplay-policy=no-user-gesture-required` lets a take-live video start without a click. `lampstand:presentation-command` runs fixed, key-allowlisted snippets (`play`, `pause`, `toggle`, `restart`, `mute`, `unmute`, `volume`, `fullscreen`, plus `reload`/`back`/`forward`) through `webContents.executeJavaScript`, which also reaches cross-origin players such as YouTube; the volume value is clamped to `0..1` and interpolated only as a number. `lampstand:presentation-capture` (`capturePage`) and `lampstand:presentation-input` (normalised `move`/`click`/`double-click`/`wheel` and an allowlisted `key`/`insertText`) drive the audience monitor used for login pages — the studio never sees or stores a password.
- **Audio routing.** `src/utils/audioRouting.ts` lists input and output devices, routes an `HTMLMediaElement` with `setSinkId()`, and opens a monitor path (`getUserMedia` → hidden `<audio>` → chosen sink → `AnalyserNode` meter). Nothing is recorded; the path exists only while the button is engaged.

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

`build-assets/installer.nsh` adds two pages after the installation folder is chosen: the optional AI components, and **Existing data on this computer**. The data page offers Keep (selected) and Erase; `customInstall` only touches `%APPDATA%\lampstand-studio` when the erase radio is checked *and* the confirmation `MessageBox` answers Yes. The `MessageBox` carries `/SD IDNO`, so a silent `/S` run keeps data without any prompt. The folder name is Electron's `app.getPath('userData')` value, which follows package.json `name` (`lampstand-studio`) rather than the product title, so a rename of `productName` in the future also means updating `LAMPSTAND_DATA_DIR`.

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
