# Lampstand Project User Manual

Lampstand Project is a local-first Windows workspace for family learning, ministry reading, church service, language work, knowledge search, and media creation.

## Getting started

1. Open **Lampstand Project** from the Desktop or Start menu.
2. Sign in with the exact email address invited by the owner, if verified member access is enabled.
3. Select your profile. The visible workspaces depend on permissions assigned by the owner.
4. Check the status indicator at the bottom of the sidebar. **Backend connected** means local app services are ready.

## Text size

Labels, lists and buttons across the app have a readable minimum size, and entry fields are set a step larger, so nothing renders as micro-print. Three things keep their own scale: the **Recovery Bible** reader has a text-size control on its own page, the **HWMR** reader has a zoom control, and projector slides follow the audience text size you choose in Presentation Studio rather than anything on this computer. Where a name is too long for its row - a processor model in **This computer**, a conversation title - the full text appears when you rest the pointer on it.

## Appearance

Settings → **Appearance and reading** holds two choices. **Colour mode** is **Use device setting**, **Light** or **Dark**; the first follows Windows, so a laptop set to a light theme shows the app in white panels and dark text. Following the device is live: change the Windows theme and the app changes with it, without closing or reloading anything. Choosing **Light** or **Dark** pins the app instead, whatever Windows does. Whichever you choose, every part of the app changes together - the side panel, the page behind it, the tables, cards, buttons, status chips and entry fields - so a light page never keeps a dark strip down one side. **Accent colour** (Cyan, Blue, Teal, Purple, Gold, Green, Burgundy) recolours the highlights, links and the selected destination in the side panel straight away, and each accent has a separate value for light and dark so a Gold highlight stays readable on either background; the choice is remembered on this device.

Readability is measured, not assumed: body text, labels and status chips keep at least the contrast a printed page needs, and the amber *Pending* and green *Indexed* marks on the Documents page are dark enough to read on their own tinted background. Reader paper - the Recovery Bible, Life-Study, HWMR and Ministry Books pages, and the projector preview - stays the same warm off-white in both colour modes on purpose, because it is meant to look like a page rather than a dashboard.

## The side panel

Every workspace is reached from the panel on the left. Destinations are grouped under **Meeting** (Presentation, Church, Ministry), **Study** (Knowledge, Documents, School, Language Tools), **Assistant** (Chat, Agents, Media Studio, History) and **App** (Settings, Help & Guides). A profile only sees the destinations its permissions allow, so the same group can look shorter for a student than for the owner.

The assistant picker and the saved-conversation list belong to chat, so they appear only while you are on the **Chat** page; other pages give that space to the destinations. The panel collapses to an icon rail with the button beside the app name, and it remembers that choice.

Pinned at the bottom is **This computer**:

- **GPU** — the graphics card, how much of its memory is in use, and, on NVIDIA cards, how hard it is working.
- **CPU** — the processor and its current load. The first reading after the app opens says *measuring*; the figure needs two samples to compare.
- **RAM** — memory in use across the whole computer.
- **Lampstand** — how much memory the app itself is holding.

The figures refresh every few seconds while the app is in front, and each bar turns amber then red as it fills. Rest the pointer on a row for the full hardware name and the exact numbers. A card that is not NVIDIA reports its name from the display driver and shows no bars rather than guessing. **No reading from the gateway** means the local services are not answering — the same condition the status card below reports.

The readout is a diagnostic, not a control: nothing in it changes how Lampstand behaves, and a busy machine does not stop a projection already on air.

## Main workspaces

### Chat and Agents

Choose an assistant in the sidebar and start a conversation. Three are available: **General Assistant** for everyday questions and writing, **Ministry Assistant** for Bible study, HWMR, Life-Study, hymns and ministry materials, and **School Assistant** for school subjects. The Agents page lists what each one does, how much of its material is already indexed, and takes you straight into a chat with it.

**Ministry Assistant** works from what is on this computer. A reference such as *John 3:16* is answered straight from the Recovery Bible. A topic is answered from the ministry libraries, and where the exact wording matters the reply names the book and passage it came from, listed as sources you can open under the answer. The buttons under the composer — **All Ministry**, **Recovery Bible**, **HWMR**, **Life-Study**, **Ministry Books**, **Hymnal** — choose which of those shelves it reads, so a Bible question and a hymn question need not return the same mixture. When a shelf holds nothing on the subject, it says so and which one you picked instead of quoting something nearby, and if the local language model is not running you still get the matching passages listed.

**General Assistant** answers from the language model alone and never quotes your documents — that is its purpose, for writing, rewriting and planning. **Web** under the composer searches the internet instead of your library and needs a search key in Settings → AI Services; without it, Chat tells you exactly that.

Start a new conversation when changing subjects to avoid carrying unrelated context forward. **New conversation** in the side panel opens Chat with a fresh session for the assistant you have picked. If the conversation on screen is still untouched — nothing sent in it yet — it keeps that one and says so instead of stacking identical empty sessions. The button waits while an answer is still being written, so stop that answer first. If it tells you no assistant is connected, the AI service has not answered, or your profile cannot open Chat; the status card at the bottom of the panel re-checks the connection.

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
- **Video Training:** play training messages and open handouts kept on this computer, and add new ones from inside the app.
- **Recovery Bible:** choose a book and chapter, follow footnotes and cross-references, select verses for reading or copying, and return from linked study pages.
- **Life-Study:** browse books and messages with Scripture links, reading controls, highlights, and annotations.
- **Ministry Books:** browse by author, title, and section. Content, Prefaces, chapters, and appendices are labeled separately.

Reading pages support full-page mode. Use the panel button to show or hide navigation while remaining in full-page reading.

**Video Training** opens the local training library. Every stored video and document is listed across the top; choose one to open it. Videos play in the page with the normal controls and seek without waiting for the whole file. PDF and HTML handouts open beside it; text and Markdown handouts print as text. **Add videos or documents** accepts MP4, WebM, MOV, AVI, MKV, WMV video and PDF, TXT, Markdown, or HTML files, and several can be chosen at once; the progress bar shows how much of each file has been stored. Files you copy into the Ministry **Video Training** folder of the local library appear in the same list, so a shared folder works as well as the button. **Remove** deletes the selected file from that folder after asking once. The library starts empty until the first file is added.

The **Recovery Bible** is opened with two lists — **Book** and **Chapter** — the same way Life-Study is. Type a reference such as `John 3:16` in the box beside them to jump to it, or use the arrows on either side to step one chapter at a time.

### Presentation Studio

Presentation Studio (sidebar: **Presentation**) builds the running order for a meeting and projects it onto one persistent audience window. That window stays open from the first slide to the last, so nothing flashes open or closed while the meeting is under way.

**Load a source.** The source rack has nine tabs:

- **Recovery Bible** — type words into **Find a phrase** and the app lists every verse that uses that exact wording, in the order typed, with the phrase marked in the verse. Pick a result and that verse goes into the verse basket, even if it is in a book or chapter you have not opened. To browse instead, choose **Old Testament** or **New Testament**, then the book and chapter abbreviations, and tick the verses. Ticked verses stay in the basket when you change books or chapters, so a single slide can carry verses from several places. Type the **Display heading** the slide should carry.
- **Hymnal** — search by number or title, then set **Lyrics** (text only or with chords), **Columns** (1, 2, or 3), and **Chorus** (once, or after every stanza). With chords you can also transpose with **Key**. The line under the hymn title says whether the complete hymn fits one slide or needs more columns.
- **HWMR** — add the week outline, one day (Morning Nourishment verses with its message and Today's Reading), or the weekly hymn. The day and outline slides are laid out the way the reading page is, with each printed reference above its verse, and every Scripture reference in them is clickable.
- **Ministry Books** — type words into **Find a phrase** to search inside the books; each result names the book and the section and shows the passage found, and picking it opens that section in the picker below. Choose the book and section directly to add a whole section as one slide.
- **Media** — add images, video, audio, PDFs and PowerPoint decks, then project any of them. See **Project media** and **PowerPoint decks** below.
- **Announcements** — type a heading, one announcement per line, and an optional closing line. The window carries the same toolbar as the **Custom portion** below, so a date can be made bold, a place made bigger or an invitation coloured while the rest of the line stays plain. **Number the items** at the end of that toolbar marks the notices 1, 2, 3; press it again for bullets — it sets the whole slide, not the words under the caret. Each line is read from the stage, so it stands on its own on the slide; a long list scrolls on the projector.
- **Web output** — a map, a stream, a meeting, or any other web page fills the projector window, including a page that needs a sign-in. See **Send a map, a stream or a meeting to the projector** below.
- **Custom portion** — type or paste an announcement, a burden-verse, an outline, or any other text into a window that reads the way the projector will; drag its bottom edge to open it taller. Select the words to shape them: **Bold**, **Italic**, **Underline** and **Strike through**; a **Typeface** picker that lists the fonts installed on this computer (type a name and press Enter to use one the list cannot show); a **size** box that multiplies the slide's own text, so those words grow with the audience text size too; a **colour** for the words — **Slide colour** hands them back to whatever the projection theme gives them — and a **highlight** behind them, both from the presets or any colour you pick; **Heading**, **Bulleted list**, **Numbered list**, and the eraser that takes the formatting off again. `Ctrl+B`, `Ctrl+I` and `Ctrl+U` work while you type, and pasting from Word or a web page keeps its typography. The three alignment marks set the line the caret stands on, so a verse can stay left while a response is centered, and the last menu sets the room between the lines of the whole slide. Everything you format travels onto the projector, not just into the preview.

**Show footnotes on a Scripture slide.** Under the book and chapter buttons, choose **Footnotes → Show** before adding the verses, and the Recovery Bible notes print under the verse they explain. **Hide** projects the verses alone. Notes are set smaller than the Scripture so the verse stays primary, but large enough to read from the back of the room. While **Show** is selected, the studio tells you how many notes the basket will carry. The choice is fixed when the slide is created: change it and add the slide again.

**Follow a Scripture reference.** Every verse reference on a slide is a link, in the studio preview and on the audience screen. Click one — on the projector itself, with the mouse or a clicker — and that verse alone fills the screen while you explain it, using the same text, projection theme and text size as the rest of the show. The live channel then reads **Verse: …** and a **Return to** *slide title* button appears in the console; pressing it puts the slide you were on back up. An interlude never changes your run of show, and taking any slide live ends it.

**Project media.** **Add images, video, audio, PDF or PowerPoint** stores the files on this computer, inside the `Presentation Media` folder of your data directory, and the projector reads them from there — nothing is uploaded anywhere. Filter the list with **Everything / Images / Video / Audio / Docs / PowerPoint**, and the options under it carry only what the filter is showing: **Fill the whole screen** for images and video, **Start playing on take-live**, **Repeat** and **Keep it silent** for video and audio, **First page** for a PDF. Under **PowerPoint** there is nothing to set — a deck is turned into slides first, see below. Press **Project** and the slide appears on your own screen in **Program Output**, ready but not yet on air; a video or song never starts playing there, only on the audience screen when you **Take live**. A PDF always fills the whole screen, page by page, with no grey border around it.

While media is on air, a transport bar appears in **Program Output**. For a video or song it carries **Play / Pause**, **Restart**, the time elapsed and the length of the clip, a **progress bar** you can drag to jump to any moment, **Mute** and a **Level** slider; video also gets **Fullscreen**. Projected media opens at one fifth volume, and the bar remembers whatever you last set — including silence — so a clip never starts at full blast and you do not have to dial it back every meeting. A PDF and a PowerPoint deck get **Previous page / Next page** instead, and an image gets its own shorter bar. Either way, a still frame — an image, a PDF page or a PowerPoint slide — also gets **zoom**: each press enlarges the frame by a quarter, centred, and the projector cuts off what runs past its edges; **Whole frame** puts it back. Zooming changes only the picture — the sound keeps playing and the rest of the show is untouched. When **Live transition** is set to **Fade**, the picture and the sound fade out together as one media slide replaces another, so a change neither snaps nor clicks. Remove a file from the library with the trash button; a converted deck removes all of its slides at once.

**A file that has gone.** Media is read from this computer at the moment it is projected, so a file that is deleted or moved after you queued it will not appear. Taking such a slide live says so on the console — naming the slide and the tab that puts it back — instead of the audience screen simply going dark. The slide still goes live; you decide whether to fix it, move on, or press **Blank**.

**PowerPoint decks.** On the **Media** tab, choose the **PowerPoint** filter and press **Make slides** on a `.pptx` or `.ppt` file. Lampstand opens the deck in PowerPoint on this computer and exports one full-screen image per slide. The deck then joins **Run of show** as a **single entry** — not one row per slide — and while it is on air the arrows in the transport bar step it slide by slide, with the slide number beside them, so a forty-slide deck never buries the rest of your order. The rest of the projector is untouched while you step: your run of show stays exactly as it was. If PowerPoint is not installed, the app says so: open the deck yourself, save it as a PDF, add that PDF, and project it page by page with the page buttons. **Remove every slide of this deck** deletes the exported images and leaves the queued entry alone — if you then take it live, see **A file that has gone** above.

**Send a map, a stream or a meeting to the projector.** The **Web output** tab loads a real web page into the projector window, so the page keeps its own player, chat and controls. Type a **Place on the map** to get Google Maps at the zoom and view you choose (Road, Satellite, Hybrid, Terrain). Or paste any address — a YouTube video opens in the clean full-screen player, a YouTube *live* page keeps its own stream player, and Google Meet, Zoom, Teams or any other site load as they are. Then **Project now** puts it on screen immediately, **Add to the show** queues it so it can be taken live in order, and **Save link** keeps it in the saved list for next time.

**Work the page before the room sees it.** Press **Open on my screen** instead and the page opens in its own window on *your* display — the console marks it **On your screen, not on air**. Sign in, choose a seat, join the meeting, drag the map to the street you want, and the audience screen stays dark the whole time. When it looks right, press **Take it live** and that exact page — the same signed-in view, at whatever the map is showing — fills the projector. While your window is open the same row gives you **Reload**, **Back**, **Forward** and **Close**. The staged window shares the projector's web profile, so anything you log into there is logged in on the wall, and the room never sees a sign-in screen.

A page taken straight from the panel is not in your order, so **Live** names it as **Web: …** and marks it **off the run of show**, with a **Return** button that puts the last slide back on air. Taking any other slide live, or blanking the output, replaces the page. Closing the projector window from outside the app tells the console too — it stops claiming anything is on a screen that has gone dark.

**A page that needs a sign-in.** The projector window has its own browser profile, separate from the studio. Open the page on your screen and sign in there, or open **Audience monitor and remote**: it mirrors what the projector is showing, and every click, scroll and keystroke you make on the mirror goes to the real page. Sign in once and the next meeting opens already logged in. Lampstand never stores, sends or records the password; it only forwards what you type.

**Room audio.** In **Program Output**, choose the **Speaker output for the room** — the port the projector cable or the mixer is plugged into. The microphone and any web page you project — a stream, a meeting, a webcast — leave through that speaker, at the level the console's media slider last set. A projected video or song slide plays through the sound output Windows gives the projector window, so set that to the same port in Windows sound settings and everything agrees. Pick the **Microphone input** and press **Send the microphone to the room** to make a speaker's voice come out of that same output; the bar beside the button is the live microphone level, so you can see it is open. **Mute the room** silences the microphone and whatever is playing at the same time, and pressing it again brings both back. **Refresh devices** re-reads the list when a device only names itself after access is allowed. The microphone is a live path only: nothing is recorded and nothing leaves the computer.

**Run the show.** Every added item appears in **Run of show**, which saves itself and can be reordered, duplicated, removed, exported as a show file, or imported on another computer. The **Program Output** panel at the top of the console keeps **Preview** (what you are cueing) and **Live** (what the audience sees) side by side in one compact row, with the meeting timer beside them. From there:

- **Take live** — or `Ctrl+Enter` — puts the cued slide on the projector.
- **Previous live / Next live** — steps the audience through the queue without disturbing your preview.
- **Blank the audience screen** — or `B` — blacks out the projector while the window stays open.
- `←` / `→` — move the preview through the queue.

**The control rail.** One rail under those two headings carries everything you touch, in three groups of icons: **Preview** (step the cue back and forward, and choose which screen the projector window opens on), **Live** (step what the audience sees, take the cue live, blank the screen) and **Output** (how the room reads it). Each icon says what it does when you rest the pointer on it, and the small keyboard chip at the right of the **Program Output** strip lists the shortcuts.

**Working the list without the mouse.** `Tab` walks the run of show: pressing `Enter` or `Space` on a row previews that slide, and the four buttons beside its title — **Move up**, **Move down**, **Duplicate**, **Delete** — do exactly what they are named. After a move or a duplicate the same button keeps the focus, so pressing `Enter` again keeps working on the same slide as it travels through the list.

**Audience settings** sit in the **Output** group of that rail and take effect on the next slide you take live; they are remembered between meetings. From left to right: the eye shows or hides the slide title on the projector, **AA** sets the audience text size, the sun and moon choose a light or dark projection theme, the overlapping circles or the barred circle fade the next slide in or cut straight to it, and **Fade speed** — only live while a fade is chosen — sets how long that fade takes. The screen picker is in the **Preview** group: choose the projector there when more than one display is connected, and press the re-scan button beside it after a projector or cable is plugged in or unplugged.

**Presenter notes** sit below the preview behind a **Presenter notes** button. The preview always shows the whole slide at its projection shape; the notes stay folded away until you need them, and the button tells you when the current slide already has notes written. Notes are private to this screen and never reach the projector.

**During the meeting**, a slide that is longer than the window scrolls with the mouse wheel, `↑`/`↓`, `Page Up`/`Page Down`, `Space`, `Home` or `End`. Selecting text on the audience screen opens a small highlight toolbar, so a word can be marked while it is being read. The **meeting timer** in the console tracks elapsed time and can be paused or reset.

### School

Use **Read Lessons** to select a subject, material, and exact lesson or chapter. The School workspace also provides:

- study planning and progress;
- revision sheets and flashcards;
- interactive quizzes with selected subject and chapters;
- results and answer review;
- highlights and annotations on lesson content.

**Quiz, Flashcards and the Revision sheet write their questions from the lessons you tick.** Pressing Start asks the local model to compose about ten questions from the indexed text of exactly those lessons, so Chapter 19 and Chapter 3 give different questions and each answer is explained in the lesson's own words. Allow a short pause: the button reads **Writing questions from your selection…** while it works. The questions and their choices are shuffled, so **More Questions** gives a fresh round from the same lessons.

If the local model is not running, or the lessons you chose have no readable indexed text, the banner at the top of the page says so and the activity starts with the subject practice set instead. A quiz score is saved to **Results** only when you press **Check answers**.

The School Assistant should answer only from the selected or indexed School material. If the requested lesson is unclear, identify the subject and lesson number.

**Explain a lesson** on the dashboard and **Create notes from selected lesson** under **Create notes** open the Chat page with the School Assistant already selected and your question waiting in the box, so you can read it and edit it before sending.

### Church

The Church home page is grouped into three blocks. **Status** shows the next prayer meeting, any drafts still open, how many records are saved, reminders due, the groups on file, and how many records still need a valid group. **Tools** holds the four destinations below it. **Recent activity** lists the last few items saved or posted, with **View all** at the right end of the heading to open the full history.

Prepare Prayer Points and Announcements, select an approved WhatsApp group, and save publishing history. WhatsApp-ready text is created for review; confirm the final message before posting it.

### Language Tools

- Translate typed text between supported languages.
- Hear pronunciation using a local Windows voice or the configured online fallback.
- Transcribe audio with Voice Studio when it is running, otherwise with Local Whisper.
- Translate documents while preserving supported layout and folder structure.

#### Translation model fallbacks

In **Hybrid** provider mode, Language Tools first tries the configured Ollama translation model. It automatically corrects the common `quen`/`qwen` model-name typo and, if that model is unavailable, can try another installed Ollama model that is suitable for text generation. Embedding-only models are excluded.

If local translation does not succeed, Lampstand tries configured cloud providers in this order: **Gemini**, **OpenAI**, then **Anthropic**. Only providers with a saved API key are attempted. **Local** mode never sends translation text to a cloud provider; **Cloud** mode skips Ollama.

The result identifies the provider and model used. If every available provider fails, check **Settings → AI Services**, confirm Ollama is running or add a permitted cloud-provider key, and try again.

#### Voice Studio

[Voice Studio](https://github.com/debpalash/VoiceStudio) is a separate, optional program you install yourself. When it is running on the same computer, Lampstand uses it for two jobs:

- **Audio transcription** in Language Tools. Recorded or uploaded audio is transcribed locally by Voice Studio, and the result line reads **Processed by voice studio**. When Voice Studio is not running, the same recording goes to Local Whisper instead, so nothing changes for you apart from that line.
- **Speech audio** in Media Studio. The **Speech** provider turns **Ready** while Voice Studio is running, and **Create speech** on a Language Tools result produces a spoken English file you can play, download and project.

The four status names across the top of Language Tools tell you which of these are answering before you press a button. **Voice Studio** reads *Ready*, *Offline* (installed but not running) or *Not installed*. Voice Studio is not bundled with Lampstand and is not part of the installer.

Voice Studio does not replace pronunciation. **Pronunciation** on the Language Tools page still uses the voices installed in Windows, with Microsoft online voices as the fallback you can switch off, because Voice Studio's speech engine has been verified only for English. The same limit applies to speech audio: choose English there.

### Media Studio

Create images, speech, music, songs, instrumental audio, and video through installed providers. Large generation models are optional and can be installed or started from Settings on capable computers.

## Reading tools

- Select one or more verses or paragraphs before choosing **Read** or **Copy**.
- Use **Highlight** to apply a preset or custom colour.
- Add an annotation to a selection; selecting an existing highlight reopens its note.
- Scripture links open the Recovery Bible. Use the return control to go back to the same reading location.
- Full-page mode collapses the main sidebar for distraction-free reading.

## Help & Guides

The guide buttons sit directly under the page title. **User Manual**, **Installation Guide** and **Documentation** open inside the app at a comfortable reading width, and **Download this guide** saves the guide you are reading as a file.

Below the guide is **Quick tips** - the short how-to cards for things that are easy to miss. It starts folded so the guide has the whole page. The button at the right-hand end of that bar says **Show 23 tips**; press it to open the cards, grouped under Getting started, Reading & study, Building slides, On the projector and Sound & language, and **Hide tips** to fold them away again. Typing in **Search the tips** filters the cards by title or wording and opens the list for you.

## Profiles and access

The owner controls which workspaces each verified member can use. Student profiles normally receive School and approved learning tools. Access changes sync after sign-in and may require reopening the app.

Lampstand remembers the most recently selected local profile on that computer and restores it when the app opens again. This profile memory does not store a password or bypass a profile PIN. To use a different person, choose another profile from the sidebar; the newly selected profile becomes the remembered profile for the next launch.

## Backups and updates

Use **Settings** to check services, create backups, install optional dependencies, and check for app updates. The page is grouped into four labelled blocks: **Access and devices**, **Services and models**, **Appearance and reading**, and **Data and updates**. Most Settings controls show only an icon to keep each decision on one row - hover the pointer over one, or tab to it, to read what it does. App updates and reinstalls replace program files only; your profiles, sign-in, reading progress, annotations and conversations stay in the Lampstand data folder unless you deliberately choose **Reset personal data** under Backup and restore.

Every install — the downloaded Setup file or an update the app starts for you — shows an **Existing data on this computer** page. **Keep my data (recommended)** is selected and nothing is removed. Choosing **Erase all Lampstand data on this computer and start fresh** asks you to confirm once more, then clears the personal data folder for every profile on that computer, including files added to the local library. Downloaded and generated media are not stored there and are left where they are. Back up from **Settings** first if you may want any of it later.

## Common problems

- **Backend unavailable:** reopen the app, then use **Settings → AI Services** and select the wrench (Repair services).
- **No search results:** verify that the document is indexed and that the correct category, subcollection, and subject were selected.
- **Scanned PDF has no answers:** run OCR and re-index it.
- **Ollama or Whisper offline:** install or start the optional service in Settings.
- **Voice Studio Offline in Language Tools:** the program is installed but not running. Start Voice Studio, or select **AI services** in Settings to start it with your other local models. Transcription still works through Local Whisper while it is closed.
- **Newly added document is not searchable:** open **Documents** and run **Index knowledge**.
- **Nothing appears on the projector:** the audience window opens with the first **Take live**. Confirm the screen chosen in the **Preview** group of the control rail; if the output was blanked, take any slide live to bring it back.
- **The projector shows a verse you did not queue:** a verse reference on the audience screen was clicked. Use **Return to** *slide title* in the console, or take any slide live.
- **A phrase search finds nothing:** the Bible phrase box needs the words in the order typed, so a shorter phrase usually works. The Recovery Version wording differs from other versions in places — *kingdom of the heavens*, not *kingdom of heaven* — so search the wording the Recovery Version actually prints.
- **A training video will not play:** the file was stored, but Windows cannot always decode that video inside the app — MKV, AVI and WMV in particular. Converting it to MP4 makes it playable everywhere; the file itself is not damaged.
- **Access is not available:** sign in again with the exact invited email or ask the owner to restore access.
