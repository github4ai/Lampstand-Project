# Lampstand Project User Manual

Lampstand Project is a local-first Windows workspace for family learning, ministry reading, church service, language work, knowledge search, and media creation.

## Getting started

1. Open **Lampstand Project** from the Desktop or Start menu.
2. Sign in with the exact email address invited by the owner, if verified member access is enabled.
3. Select your profile. The visible workspaces depend on permissions assigned by the owner.
4. Check the status indicator at the bottom of the sidebar. **Backend connected** means local app services are ready.

## Main workspaces

### Chat and Agents

Choose an assistant in the sidebar and start a conversation. Responses can use indexed documents and show their sources. Start a new conversation when changing subjects to avoid carrying unrelated context forward.

### Knowledge and Documents

- **Documents** adds, categorizes, indexes, verifies, and removes source files.
- **Knowledge** searches indexed content and opens the exact matching passage.
- Supported content includes PDF, HTML/HTM, EPUB, DOCX, TXT, Markdown, PDB, and supported presentation files.
- Scanned PDFs require OCR before their text can be searched reliably.
- An added file is stored immediately but is only searchable after **Index knowledge** has run.

Uploading a **Holy Word for Morning Revival** PDF to its Ministry category also rebuilds the HWMR reader. The message reports the verified daily portions and verse blocks, and names any file the reader could not use and why.

When adding School material, Level C is used automatically. Select its subject so School searches and activities remain grounded in the correct textbook.

#### Custom document categories

When a document does not belong in School, Ministry, or General:

1. Open **Documents** and choose the files to upload.
2. In **Category**, choose **Add custom category…**.
3. Enter a clear category name, such as *Personal Notes*, *Business*, or *Research*.
4. Optionally add a subcollection and folder, then upload the files.

Custom categories become part of the local knowledge library and can be used to keep unrelated material separate. Access to the Documents and Chat workspaces still follows the active profile's permissions.

### Ministry

The Ministry dashboard contains:

- **Holy Word for Morning Revival (HWMR):** daily portions, weekly progress, hymns, highlights, annotations, and study outputs.
- **Hymnal:** browse and search hymns; read lyrics and chords; use available tunes and sheets.
- **Recovery Bible:** choose a book and chapter, follow footnotes and cross-references, select verses for reading or copying, and return from linked study pages.
- **Life-Study:** browse books and messages with Scripture links, reading controls, highlights, and annotations.
- **Ministry Books:** browse by author, title, and section. Content, Prefaces, chapters, and appendices are labeled separately.

Reading pages support full-page mode. Use the panel button to show or hide navigation while remaining in full-page reading.

### Presentation Studio

Presentation Studio (sidebar: **Presentation**) builds the running order for a meeting and projects it onto one persistent audience window. That window stays open from the first slide to the last, so nothing flashes open or closed while the meeting is under way.

**Load a source.** The source rack has five tabs:

- **Recovery Bible** — type words into **Find a phrase** and the app lists every verse that uses that exact wording, in the order typed, with the phrase marked in the verse. Pick a result and that verse goes into the verse basket, even if it is in a book or chapter you have not opened. To browse instead, choose **Old Testament** or **New Testament**, then the book and chapter abbreviations, and tick the verses. Ticked verses stay in the basket when you change books or chapters, so a single slide can carry verses from several places. Type the **Display heading** the slide should carry.
- **Hymnal** — search by number or title, then set **Lyrics** (text only or with chords), **Columns** (1, 2, or 3), and **Chorus** (once, or after every stanza). With chords you can also transpose with **Key**. The line under the hymn title says whether the complete hymn fits one slide or needs more columns.
- **HWMR** — add the week outline, one day (Morning Nourishment verses with its message and Today's Reading), or the weekly hymn. The day and outline slides are laid out the way the reading page is, with each printed reference above its verse, and every Scripture reference in them is clickable.
- **Ministry Books** — type words into **Find a phrase** to search inside the books; each result names the book and the section and shows the passage found, and picking it opens that section in the picker below. Choose the book and section directly to add a whole section as one slide.
- **Custom portion** — paste an announcement, a burden-verse, an outline, or any other text.

**Show footnotes on a Scripture slide.** Under the book and chapter buttons, choose **Footnotes → Show** before adding the verses, and the Recovery Bible notes print under the verse they explain. **Hide** projects the verses alone. Notes are set smaller than the Scripture so the verse stays primary, but large enough to read from the back of the room. While **Show** is selected, the studio tells you how many notes the basket will carry. The choice is fixed when the slide is created: change it and add the slide again.

**Follow a Scripture reference.** Every verse reference on a slide is a link, in the studio preview and on the audience screen. Click one — on the projector itself, with the mouse or a clicker — and that verse alone fills the screen while you explain it, using the same text, projection theme and text size as the rest of the show. The live channel then reads **Verse: …** and a **Return to** *slide title* button appears in the console; pressing it puts the slide you were on back up. An interlude never changes your run of show, and taking any slide live ends it.

**Run the show.** Every added item appears in **Run of show**, which saves itself and can be reordered, duplicated, removed, exported as a show file, or imported on another computer. The **Program Output** panel at the top of the console keeps **Preview** (what you are cueing) and **Live** (what the audience sees) side by side in one compact row, with the meeting timer beside them. From there:

- **Take preview live** — or `Ctrl+Enter` — puts the cued slide on the projector.
- **Previous live / Next live** — steps the audience through the queue without disturbing your preview.
- **Blank** — or `B` — blacks out the projector while the window stays open.
- `←` / `→` — move the preview through the queue.

**Audience settings** take effect on the next slide you take live and are remembered between meetings: title on or off, audience text size, light or dark projection theme, fade or cut transition, and fade speed. Choose the projector in **Screen** when more than one display is connected, and use **Detect displays** after a projector or cable is plugged in or unplugged — it re-reads the connected screens and reports how many it finds. Presenter notes stay on the studio screen and never reach the projector.

**During the meeting**, a slide that is longer than the window scrolls with the mouse wheel, `↑`/`↓`, `Page Up`/`Page Down`, `Space`, `Home` or `End`. Selecting text on the audience screen opens a small highlight toolbar, so a word can be marked while it is being read. The **meeting timer** in the console tracks elapsed time and can be paused or reset.

### School

Use **Read Lessons** to select a subject, material, and exact lesson or chapter. The School workspace also provides:

- study planning and progress;
- revision sheets and flashcards;
- interactive quizzes with selected subject and chapters;
- results and answer review;
- highlights and annotations on lesson content.

The School Assistant should answer only from the selected or indexed School material. If the requested lesson is unclear, identify the subject and lesson number.

### Church

Prepare Prayer Points and Announcements, select an approved WhatsApp group, and save publishing history. WhatsApp-ready text is created for review; confirm the final message before posting it.

### Language Tools

- Translate typed text between supported languages.
- Hear pronunciation using a local Windows voice or the configured online fallback.
- Transcribe audio with Local Whisper.
- Translate documents while preserving supported layout and folder structure.

#### Translation model fallbacks

In **Hybrid** provider mode, Language Tools first tries the configured Ollama translation model. It automatically corrects the common `quen`/`qwen` model-name typo and, if that model is unavailable, can try another installed Ollama model that is suitable for text generation. Embedding-only models are excluded.

If local translation does not succeed, Lampstand tries configured cloud providers in this order: **Gemini**, **OpenAI**, then **Anthropic**. Only providers with a saved API key are attempted. **Local** mode never sends translation text to a cloud provider; **Cloud** mode skips Ollama.

The result identifies the provider and model used. If every available provider fails, check **Settings → AI Services**, confirm Ollama is running or add a permitted cloud-provider key, and try again.

### Media Studio

Create images, speech, music, songs, instrumental audio, and video through installed providers. Large generation models are optional and can be installed or started from Settings on capable computers.

## Reading tools

- Select one or more verses or paragraphs before choosing **Read** or **Copy**.
- Use **Highlight** to apply a preset or custom colour.
- Add an annotation to a selection; selecting an existing highlight reopens its note.
- Scripture links open the Recovery Bible. Use the return control to go back to the same reading location.
- Full-page mode collapses the main sidebar for distraction-free reading.

## Profiles and access

The owner controls which workspaces each verified member can use. Student profiles normally receive School and approved learning tools. Access changes sync after sign-in and may require reopening the app.

Lampstand remembers the most recently selected local profile on that computer and restores it when the app opens again. This profile memory does not store a password or bypass a profile PIN. To use a different person, choose another profile from the sidebar; the newly selected profile becomes the remembered profile for the next launch.

## Backups and updates

Use **Settings** to check services, create backups, install optional dependencies, and check for app updates. App updates do not remove local user data unless **Reset personal data after update** is explicitly selected before installing an update.

## Common problems

- **Backend unavailable:** reopen the app, then use **Settings → Repair services**.
- **No search results:** verify that the document is indexed and that the correct category, subcollection, and subject were selected.
- **Scanned PDF has no answers:** run OCR and re-index it.
- **Ollama or Whisper offline:** install or start the optional service in Settings.
- **Newly added document is not searchable:** open **Documents** and run **Index knowledge**.
- **Nothing appears on the projector:** the audience window opens with the first **Take live**. Confirm the **Screen** choice in the Presentation card; if the output was blanked, take any slide live to bring it back.
- **The projector shows a verse you did not queue:** a verse reference on the audience screen was clicked. Use **Return to** *slide title* in the console, or take any slide live.
- **A phrase search finds nothing:** the Bible phrase box needs the words in the order typed, so a shorter phrase usually works. The Recovery Version wording differs from other versions in places — *kingdom of the heavens*, not *kingdom of heaven* — so search the wording the Recovery Version actually prints.
- **Access is not available:** sign in again with the exact invited email or ask the owner to restore access.
