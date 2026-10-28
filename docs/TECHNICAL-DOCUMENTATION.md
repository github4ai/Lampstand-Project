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
- **The formatted text window (`PortionEditor`).** `src/components/studio/PortionEditor.tsx` is the window both the **Custom portion** (`CustomSourcePanel.tsx`) and the **Announcements** (`AnnouncementSourcePanel.tsx`) panels write in, so one set of tools teaches the operator once. It is a `contentEditable` div driven by `document.execCommand`, so the formatting it offers depends on Chromium and the produced HTML is what the audience window is given, not a rich-text document model. Two document-level settings are applied once on mount: `styleWithCSS` so every command writes inline `style` rather than `<b>`/`<font>` tags (a style sheet travels to the projector, a tag may not), and `defaultParagraphSeparator` pinned to `p` so the window and the audience slide break lines identically. A toolbar press would take focus — and therefore the selection — away from the words being formatted, so `onMouseDown` is prevented on the buttons and the last in-editor `Range` is restored before a command runs. Three commands needed more than the editor offers: the **typeface** picker reads installed faces through `window.queryLocalFonts()` (a refused read still leaves the field usable — the name can be typed and Enter applies `localFontStack(name)`; the list is capped at 120 rows because a picker is only useful while it is being filtered), the **size** box is a multiple of the slide's own text while `fontSize` knows seven fixed sizes, so it marks the words `7` and rewrites the resulting `xxx-large` spans to `${multiple}em` (clamped `0.5`–`6`), and **highlight** re-reads every `span[style]` afterwards and sets its colour to `legibleInk(background)` with `data-markInk` so the words always read on the colour laid under them — and hands the ink back when the background is removed. Both pickers are commands, not readouts: they return to their own name after use, because a row of mixed faces or sizes must not claim to be one of them. The three alignment marks answer for the *line* under the caret (`alignOfCaret()` walks up to the first node with a declared `textAlign`, falling back to the slide's own), so a verse can stay left while a response is centered. Line spacing is the one property left to the whole slide, so it keeps a menu of its own; anything a host wants at slide level rides in the `slideTools` slot at the end of the toolbar (announcements put **Number the items** there), wrapped with the rule that parts it from the word tools so the pair wraps together. The window itself is `resize: vertical` from `190px` up to `70vh`, scrolling past that rather than pushing the rest of the panel away. Whatever is added passes through `sanitizeRichText()` in `src/utils/customSlide.ts` — a hand-written allowlist tokenizer, since the vitest environment has no DOM. It drops unknown tags *with their words* (so `<script>alert(1)</script>` leaves nothing), converts `<div>` to `<p>` and a legacy `<font face|size|color>` to a `<span>` of declarations, keeps only properties in `ALLOWED_STYLE`, and refuses anything containing `<`, `>`, `url(`, `expression` or `javascript:`. Two behaviours of real editor output shaped it: a quoted typeface arrives inside `innerHTML` as `&quot;`, whose trailing `;` split the name in half until the value is decoded *before* the declaration split; and `innerHTML` already encodes `&nbsp;`, so the rich-text path escapes only `<` and `&` that begin no entity, or the projector prints the literal `&nbsp;`. `customSlideRules()` is injected as a `<style>` into the editor itself, which is why the window reads the way the slide will; the same rules give every paragraph the slide's own serif at weight 400 so inline bold or size always stands out. Slide-level state is only `align` (`left`/`center`/`justify`) and `spacing` (`normal`/`roomy`/`open`) — the earlier slide-wide typeface and emphasis defaults were removed because each word now carries its own. The console's shortcuts must not fire while text is being written, so the global keydown handler in `src/pages/PresentationPage.tsx` also returns for `event.target instanceof HTMLElement && event.target.isContentEditable` (`B` would otherwise blank the projector mid-sentence).
- **Announcement slides.** `src/utils/announcementSlide.ts` turns the same window markup into a slide: `richItems()` in `customSlide.ts` splits it into one item per block or `<br>` (a leading bare text node is wrapped into a `<p>` by `sanitizeRichText`, so a loose first line still counts as its own item), and each item becomes an `<li>` carrying only the line's own `text-align`. The marker comes from the slide, not the words — **Number the items** chooses `<ol>` over `<ul>` for the whole list — so a date made bold never loses the numbering the notices are read by. The heading and closing line are plain escaped text; the list is centred on the screen while each item is left-aligned, and a long list scrolls on the projector with the heading held in place.
- Scripture references are rendered as `<a class="verse-link" data-book data-chapter data-verse data-verse-end>` by `src/utils/bibleLinks.ts`, which is shared by the Bible slide and HWMR slide builders. A small script appended to the audience document intercepts the click and calls `window.lampstandAudience.selectVerse(reference)` — exposed by `desktop/presentation-preload.cjs`, sent as `lampstand:presentation-verse`, and re-emitted by the main process as `lampstand:audience-verse` to the studio window. The popup path uses `window.opener.postMessage({ type: 'lampstand:audience-verse' })` instead. The studio resolves the reference against the local Recovery Bible library and projects the verse as an interlude; the queued slide and run of show are untouched, and taking any slide live clears the interlude.
- `PresentOnDisplay` asks the main process for the display list when the picker mounts and again when the re-scan button beside it is pressed, so a projector connected after launch becomes selectable without restarting the app. The studio's **Preview** group renders only the picker (`AudienceScreenPicker`); the full card — picker plus its own take-live button — is what the Bible and School pages use. Preferences (screen, title, theme, text size, transition, fade speed and the chosen room speaker) are stored under `lampstand.presentation.prefs`, resolve on the next take-live, and reach the audience window as `audioSinkId`.
- **The control rail is icon-only, and the theme fights it.** `src/styles/theme-overrides.css` ends with `.workspace-panel button { min-height:36px; padding-inline:13px }` — specificity `0,1,1`, which beats a single class. An icon button styled with one class therefore gets 13px of side padding on a 32px box and its glyph is squeezed to a 4px sliver, and any colour its own class sets loses to the same rule. Every rail control is therefore addressed with two classes (`.console-bar .icon-action`, `.present-on-display button.present-detect`). This is not visible in a unit test: the vitest environment has no DOM, so the rail is verified against the running dev server by measuring each control's box.
- **Media library.** `server/presentation-media.mjs` serves a second, user-owned folder (`config.presentationMediaDir`, default `<knowledgeDir>/Presentation Media`) over `GET /presentation-media/library`, `POST /presentation-media/upload?name=`, `GET|HEAD /presentation-media/file?name=`, `DELETE /presentation-media/file|group?name=` and `POST /presentation-media/deck?name=`. Names are sanitised before they touch the disk (`safeRelativePath`: at most three `/` segments, no leading dot, no Windows-illegal character, 120-character stem, extension allowlist) and every read re-checks that the resolved path is still inside the root. Files stream with full HTTP Range support (`206`/`Content-Range`, `bytes=-N`, `416`), which is what lets the projector seek inside a large video; `server/media.mjs` has no range handling and is not used for this. Like the video-training routes, the streaming route `await`s inside the gateway's `try` and only then `return`s — returning the promise would bypass the catch and kill the Node process. SVG is excluded on purpose: an uploaded vector file is an HTML document that would run inside the projector window. **Go-live check.** `mediaProjectionWarning()` in `src/components/PresentOnDisplay.tsx` sends one `HEAD` for the file the slide is about to show — the current page, resolved with `deckSlidePath` for a deck — before `presentOnSavedDisplay` runs, on every path that puts media on air (**Take live**, **Take preview live**, previous/next live, Ctrl+Enter, the deck and PDF page arrows, and the return from a verse interlude). Only a `404` raises the console warning; a refused or failing request stays silent, because a stopped gateway must not be reported as a deleted file. The slide still goes live — the message names the tab that restores the file and the operator decides what to do next.
- **Media slides.** `src/utils/mediaSlide.ts` builds image, video, audio and PDF slides from a library path and always emits the *absolute* gateway URL, because the audience document is a `data:` URL and cannot resolve a relative one (a probe confirmed a `data:` document may still load `http://127.0.0.1:9656` media). Video is projected without `controls` — the studio drives the player through IPC. Height comes from `var(--media-max, 66vh)` so the same slide fits the small studio preview.
- **Zoom on a still frame.** `MediaSlideSource.zoom` is carried into the html as an inline `--media-zoom` custom property, and the slide's own style sheet scales the stage (`transform:scale(var(--media-zoom,1)); transform-origin:center`) — full-bleed stages get `overflow:hidden` so the enlarged frame is cut off at the projector edge instead of growing the document. `clampZoom()` pins the value to `MIN_ZOOM`/`MAX_ZOOM` (`1`–`4`) in quarter steps and rounds to two decimals, because the number is interpolated straight into a `style` attribute; exactly `1` prints no attribute at all, so an unzoomed slide keeps its previous byte-for-byte html. Changing zoom regenerates the html and re-projects with `transition:'none'` (the same in-place path `stepMediaPage` uses) — **there is no new IPC command**, and the audience document is never reloaded, so only the picture moves and the sound keeps playing. Zoom is offered for images, PDF pages and deck slides only: re-projecting a live video would restart it.
- **The console preview never plays media.** `PresentationPage.tsx` builds the preview from the same html the projector gets, so the queue item's own `autoplay` flag is stripped before rendering (`mediaSlideHtml({ ...active.media, autoplay: false })`) — otherwise a cued song started the moment it was selected, in the operator's room. The Media tab's option row is scoped to the active filter (`all` shows the union): fill-screen for image/video, autoplay/repeat/silent for video/audio, first page for documents, and nothing at all for the PowerPoint filter, which has no per-file option to set.
- **PowerPoint.** `server/presentation-decks.mjs` shells out to `scripts/export-presentation-deck.ps1` (PowerPoint COM, one PNG per slide plus the title text) and returns `{ group, total, pages[] }`; the converter's single JSON line is parsed there, `422` carries the "save it as a PDF" instruction when PowerPoint is missing, and `504` when the conversion is killed. The script path arrives as `AIOS_PRESENTATION_DECK_SCRIPT` and ships through `extraResources`.
- **Web output.** `ipcMain` handler `lampstand:open-presentation-web` loads any `http(s)` URL into the same audience window. That window uses `partition: 'persist:lampstand-audience'`, so a sign-in done once survives to the next meeting; `configureMediaPermissions()` grants `media`, `mediaKeySystem` and `fullscreen` on that partition only, and `autoplay-policy=no-user-gesture-required` lets a take-live video start without a click. `lampstand:presentation-command` runs fixed, key-allowlisted snippets (`play`, `pause`, `toggle`, `restart`, `mute`, `unmute`, `volume`, `fullscreen`, plus `reload`/`back`/`forward`) through `webContents.executeJavaScript`, which also reaches cross-origin players such as YouTube; the volume value is clamped to `0..1` and interpolated only as a number. `lampstand:presentation-capture` (`capturePage`) and `lampstand:presentation-input` (normalised `move`/`click`/`double-click`/`wheel` and an allowlisted `key`/`insertText`) drive the audience monitor used for login pages — the studio never sees or stores a password.
- **Audio routing.** `src/utils/audioRouting.ts` lists input and output devices, routes an `HTMLMediaElement` with `setSinkId()`, and opens a monitor path (`getUserMedia` → hidden `<audio>` → chosen sink → `AnalyserNode` meter). Nothing is recorded; the path exists only while the button is engaged.
- **Run of show, from the keyboard.** Each queue row is a `<button>` that selects the slide for preview, and its four actions are `role="button"` spans inside it (`QueueAction` in `src/pages/PresentationPage.tsx`) — real nested buttons would be invalid inside a button, so the spans carry `tabIndex` and their own `onClick`/`onKeyDown`. Two Chromium behaviours make this harder than it looks, both measured against a headless page with trusted CDP key events: **Enter on one of the spans makes the browser click the row button as well** (a simulated click, `detail === 0`, dispatched even though the keydown was `preventDefault`ed), so the row's `onClick` ignores exactly that combination with `isActionKeyEcho` — `detail === 0` while the focused element is not the click target. Space does not produce the echo, and a mouse click always reports `detail >= 1`, so ordinary clicking is unaffected. And **moving a focused DOM node blurs it**, which is what a keyed list reorder does in React, so `QueueAction` re-focuses its own node in a `requestAnimationFrame` after the state update commits; the operator can hold `Enter` and keep walking one slide up or down. A keyboard **Delete** has nothing left to refocus — its node is gone and `focus()` on a detached element is a no-op — so focus returns to the top of the page.

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

The browser shows the console but not the desktop surface: `window.lampstandDesktop` is injected by
`desktop/preload.cjs`, so the projector window, media transport, staging and audio routing are absent
there. `pnpm run desktop:dev` opens a real app window that hot-reloads, with no build, installer or
version bump. It starts Vite on `127.0.0.1:5173`, waits until it answers 200, then launches Electron
with `LAMPSTAND_DEV_URL` set; `desktop/main.cjs` skips its own static `dist/` server and loads that
URL instead. Closing the window stops Vite.

That window reads the gateway on 9656 like any other build, and it uses the same user-data folder as
the installed app, so profiles, queue and annotations are the real ones. If the installed app is still
running it already owns 9656, and the dev window silently reads that older server — the script warns
about this, because a server-side edit then appears to do nothing.

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
