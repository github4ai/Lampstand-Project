import{a as e,n as t,t as n}from"./jsx-runtime-B-hcVAMW.js";import{t as r}from"./folder-plus-n1uv0X4w.js";import{t as i}from"./wrench-M-acrWBk.js";import{Sn as a,Tn as o,an as s,fn as c,un as l}from"./index-BR740aUH.js";import u from"./MarkdownMessage-eCILcmKJ.js";var d=o(`user-round-check`,[[`path`,{d:`M2 21a8 8 0 0 1 13.292-6`,key:`bjp14o`}],[`circle`,{cx:`10`,cy:`8`,r:`5`,key:`o932ke`}],[`path`,{d:`m16 19 2 2 4-4`,key:`1b14m6`}]]),f=e(t(),1),p=`# Lampstand Project Installation Guide

## Windows requirements

- Windows 10 or Windows 11, 64-bit.
- At least 4 GB of free space for the application and bundled reading libraries.
- Additional space is required only for optional local AI models.
- A GPU is optional for reading, School, Church, documents, and ordinary chat. A capable NVIDIA GPU is recommended for high-quality local image, audio, and video generation.

## Install the app

1. Download \`Lampstand-Project-Setup-<version>.exe\` from the approved Lampstand release page.
2. Close any older Lampstand window.
3. Run the installer and choose an installation folder.
4. Launch **Lampstand Project** from the Desktop or Start menu.
5. Sign in with the exact email invited by the Lampstand owner.

Reinstallation is not required when changing a profile from Owner, Adult, or Student. Access is assigned remotely and applied after the member signs in.

## What the installer includes

The installer includes the application and packaged reading libraries:

- Holy Word for Morning Revival;
- Hymnal;
- Recovery Bible;
- Recovery Bible footnotes;
- Life-Study of the Bible;
- Ministry Books.

The source folders used to prepare a release are not required on a family member's computer.

## Optional AI dependencies

Ollama, Local Whisper, ComfyUI, ACE-Step, and WanGP are not part of the core reading-library bundle. They are large, hardware-dependent components. Install only the features needed on that computer from **Settings → Services and dependencies**.

- **Ollama:** local chat and translation models.
- **Local Whisper:** private audio transcription.
- **ComfyUI:** local image generation.
- **ACE-Step:** local song and instrumental generation.
- **WanGP/LTX:** local video generation.

Computers with limited storage can use the core app without these large model packages.

## First-run checks

1. Open **Settings**.
2. Choose **Check all services**.
3. Confirm the Lampstand backend is connected.
4. Install optional services only when their features are required.
5. Open Ministry and verify that the bundled library cards appear.

## Updates

Open **Settings → App updates → Check for updates**. Downloaded updates install after Lampstand restarts. Locally stored profiles, annotations, progress, and preferences are retained.

## Troubleshooting

- If the window is blank, close Lampstand completely and reopen it. If necessary, use the installed repair option.
- If \`127.0.0.1:9656\` is unavailable, use **Repair services** and review the desktop startup log from Settings.
- If sign-in says the email is not invited, the owner must add that exact email in remote access control.
- If a JWT has expired, choose **Use another email** and sign in again.
- If Windows blocks an unsigned installer, confirm it came from the approved Lampstand release before continuing.

## Uninstalling

Use **Windows Settings → Apps → Installed apps → Lampstand Project → Uninstall**. The installer is configured not to delete user data automatically. Back up important notes and progress before manually removing data folders.

`,m=`# Lampstand Project User Manual

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

In **Hybrid** provider mode, Language Tools first tries the configured Ollama translation model. It automatically corrects the common \`quen\`/\`qwen\` model-name typo and, if that model is unavailable, can try another installed Ollama model that is suitable for text generation. Embedding-only models are excluded.

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
- **Access is not available:** sign in again with the exact invited email or ask the owner to restore access.
`,h=`# Lampstand Project Technical Documentation

## Architecture

Lampstand Project is an Electron desktop application containing a React and TypeScript frontend and a local Node.js gateway.

- Electron serves the production frontend on \`127.0.0.1:5173\`.
- The unified local gateway runs on \`127.0.0.1:9656\`.
- A legacy API can be proxied from \`127.0.0.1:9655\`.
- Ollama normally runs on \`127.0.0.1:11434\`.
- Local Whisper normally runs on \`127.0.0.1:8000\`.
- Optional media providers use their separately configured local endpoints.

The application is local-first. Supabase supplies verified member identity and remote workspace policy; it is not the primary store for the bundled reading libraries.

## Project layout

- \`src/\` — React pages, components, stores, API clients, and styles.
- \`server/\` — local gateway, library readers, indexing routes, and provider integration.
- \`desktop/\` — Electron main process, preload bridge, service startup, and updater.
- \`scripts/\` — importers, indexing, OCR, translation, dependency setup, backup, and release preparation.
- \`data/\` — package-ready built-in libraries and definitions.
- \`docs/\` — user, installation, operational, and Supabase migration documentation.
- \`release/\` — generated Windows installer artifacts.

## Bundled library layout

The Windows installer packages \`data/\` as an Electron extra resource. Release preparation must provide:

- \`data/hwmr-library.json\`
- \`data/hymnal-library.json\`
- \`data/ministry-books/library.sqlite\`
- \`data/ministry/recovery-bible/\`
- \`data/ministry/recovery-footnotes/\`
- \`data/ministry/life-study/\`

Run \`pnpm run prepare:library-bundle\` before packaging. The command stages externally maintained source libraries and fails when a required library is missing. Backup SQLite files are excluded from the installer.

At runtime, \`desktop/main.cjs\` explicitly maps every packaged library to its resource path. User-created Ministry imports are stored separately under Electron's user-data directory.

## Knowledge and indexing

Knowledge documents are organized by category, subcollection, and optional subject. The indexing pipeline extracts supported text, chunks it, builds embeddings and FAISS data, and records document metadata. Scanned PDFs pass through OCR before indexing. Production user knowledge and indexes live under the Electron user-data directory unless overridden.

Key environment variables include:

- \`AIOS_KNOWLEDGE_DIR\`
- \`AIOS_KNOWLEDGE_INDEX_DIR\`
- \`AIOS_KNOWLEDGE_TRASH_DIR\`
- \`AIOS_INDEX_PYTHON\`
- \`AIOS_INDEX_SCRIPT\`
- \`AIOS_INDEX_BUILDER\`

## Ministry import pipeline

- HWMR PDFs are transformed by \`scripts/import-hwmr.py\` into structured daily and weekly content.
- Recovery Bible text and study aids use the Recovery import scripts.
- Ministry Books are imported from the authorized single-file HTML archive into SQLite by \`scripts/import-ministry-books-singlefile.py\`.
- The Ministry Books importer distinguishes Content, Prefaces, numbered chapters, and appendices. Section display titles combine the role/number and actual heading.
- Scripture references preserve a return target so a reader can return to the same source position.

## Authentication and remote access

The desktop client uses only the Supabase project URL and public publishable key. Never distribute a service-role key. Row Level Security protects membership and workspace policies. Database setup and repairs are maintained in:

- \`docs/lampstand-cloud-schema.sql\`
- \`docs/lampstand-cloud-members-migration.sql\`
- \`docs/lampstand-cloud-owner-bootstrap.sql\`
- \`docs/lampstand-cloud-fix-policy-recursion.sql\`

The owner invites the exact member email and assigns role/workspace permissions. The desktop app refreshes expired sessions and denies access when no active membership exists.

## Development

\`\`\`powershell
pnpm install
pnpm run start:local
pnpm run dev
\`\`\`

Open \`http://localhost:5173\`. Put local overrides and secrets in \`.env.local\`; never commit it.

Useful verification commands:

\`\`\`powershell
pnpm run lint
pnpm test
pnpm run build
pnpm run verify:release
\`\`\`

## Windows packaging and updates

Create an installer with:

\`\`\`powershell
pnpm run desktop:installer
\`\`\`

This stages the reading libraries, builds the frontend, and creates an NSIS x64 installer in \`release/\`. Updates are published through the configured GitHub Releases repository with the installer, blockmap, and \`latest.yml\`. The Electron updater downloads only after the user requests it.

## Data protection and backups

Keep packaged reference libraries immutable. Store member-created knowledge, progress, annotations, conversations, media history, and imports in user-data locations. Backups should include those user-data folders and knowledge indexes; downloadable AI models may be omitted.

## Release checklist

1. Rebuild or refresh source libraries.
2. Run \`pnpm run prepare:library-bundle\`.
3. Verify every required library has non-zero files and size.
4. Run lint, tests, and production build.
5. Smoke-test sign-in, Ministry readers, School lesson/quiz selection, Documents, Knowledge, and service repair.
6. Build the installer on Windows.
7. Install on a clean test account without \`I:\\AI\` source folders.
8. Publish installer, blockmap, and \`latest.yml\` only after approval.

## Compatibility

Historical internal \`AIOS\` names remain in selected environment variables, routes, folders, and saved keys to preserve existing data and integrations. User-facing branding is Lampstand Project.
`,g=n(),_={manual:{label:`User Manual`,icon:a,content:m,filename:`Lampstand-Project-User-Manual.md`},installation:{label:`Installation Guide`,icon:c,content:p,filename:`Lampstand-Project-Installation-Guide.md`},documentation:{label:`Documentation`,icon:i,content:h,filename:`Lampstand-Project-Documentation.md`}},v=[{icon:r,title:`Custom categories`,text:`In Documents, choose Add custom category to keep personal, business, research, or other material separate.`},{icon:d,title:`Remembered profile`,text:`Lampstand restores the last selected profile on this computer. PIN protection and assigned permissions still apply.`},{icon:s,title:`Translation fallback`,text:`Hybrid mode tries suitable local Ollama models first, then only the cloud providers configured in Settings.`}];function y(){let[e,t]=(0,f.useState)(`manual`),n=_[e];function r(){let e=URL.createObjectURL(new Blob([n.content],{type:`text/markdown;charset=utf-8`})),t=document.createElement(`a`);t.href=e,t.download=n.filename,t.click(),URL.revokeObjectURL(e)}return(0,g.jsxs)(`section`,{className:`help-page`,children:[(0,g.jsxs)(`header`,{children:[(0,g.jsx)(`span`,{children:(0,g.jsx)(l,{size:27})}),(0,g.jsxs)(`div`,{children:[(0,g.jsx)(`h1`,{children:`Help & Guides`}),(0,g.jsx)(`p`,{children:`Read the user manual, installation instructions, and technical documentation inside Lampstand Project.`})]})]}),(0,g.jsx)(`aside`,{className:`help-quick-notes`,"aria-label":`Common help topics`,children:v.map(e=>{let t=e.icon;return(0,g.jsxs)(`div`,{children:[(0,g.jsx)(t,{size:18}),(0,g.jsxs)(`span`,{children:[(0,g.jsx)(`strong`,{children:e.title}),(0,g.jsx)(`small`,{children:e.text})]})]},e.title)})}),(0,g.jsxs)(`nav`,{"aria-label":`Lampstand guides`,children:[Object.entries(_).map(([n,r])=>{let i=r.icon;return(0,g.jsxs)(`button`,{type:`button`,className:e===n?`active`:``,onClick:()=>t(n),children:[(0,g.jsx)(i,{size:16}),r.label]},n)}),(0,g.jsxs)(`button`,{type:`button`,onClick:r,children:[(0,g.jsx)(c,{size:16}),` Download this guide`]})]}),(0,g.jsx)(`article`,{className:`help-document`,children:(0,g.jsx)(u,{content:n.content})})]})}export{y as default};