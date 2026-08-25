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

When adding School material, Level C is used automatically. Select its subject so School searches and activities remain grounded in the correct textbook.

### Ministry

The Ministry dashboard contains:

- **Holy Word for Morning Revival (HWMR):** daily portions, weekly progress, hymns, highlights, annotations, and study outputs.
- **Hymnal:** browse and search hymns; read lyrics and chords; use available tunes and sheets.
- **Recovery Bible:** choose a book and chapter, follow footnotes and cross-references, select verses for reading or copying, and return from linked study pages.
- **Life-Study:** browse books and messages with Scripture links, reading controls, highlights, and annotations.
- **Ministry Books:** browse by author, title, and section. Content, Prefaces, chapters, and appendices are labeled separately.

Reading pages support full-page mode. Use the panel button to show or hide navigation while remaining in full-page reading.

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

## Backups and updates

Use **Settings** to check services, create backups, install optional dependencies, and check for app updates. App updates do not remove local user data.

## Common problems

- **Backend unavailable:** reopen the app, then use **Settings → Repair services**.
- **No search results:** verify that the document is indexed and that the correct category, subcollection, and subject were selected.
- **Scanned PDF has no answers:** run OCR and re-index it.
- **Ollama or Whisper offline:** install or start the optional service in Settings.
- **Access is not available:** sign in again with the exact invited email or ask the owner to restore access.

