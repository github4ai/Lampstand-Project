# Lampstand Project

Lampstand Project is a private local workspace for reading, learning, creating, and serving. It brings assistants, knowledge libraries, Ministry and Church tools, School learning, language tools, and media creation into one Windows application.

## Guides

- [User Manual](docs/USER-MANUAL.md)
- [Installation Guide](docs/INSTALLATION-GUIDE.md)
- [Technical Documentation](docs/TECHNICAL-DOCUMENTATION.md)

> Compatibility note: some internal folders, environment variables, API routes, and saved browser keys retain the historical `AIOS` name. They are intentionally preserved so existing libraries, settings, conversations, and integrations continue to work.

## Requirements

- Node.js 20 or newer
- npm
- Ollama for private local translation
- An OpenAI-compatible local Whisper server for private transcription

## Development

```powershell
npm install
npm run setup:whisper
npm run start:local
```

Open [http://localhost:5173](http://localhost:5173).

The frontend expects the unified AIOS gateway at `http://127.0.0.1:9656` by default. The gateway forwards existing features to the original API on port `9655`.

The included API runs in hybrid mode: it tries local Ollama and Whisper providers first, then uses OpenAI only when an `OPENAI_API_KEY` is configured. Copy `.env.example` to `.env.local` to customize providers. Secrets in `.env.local` are ignored by Git.

The hybrid API also acts as a gateway for the original AIOS API at `http://127.0.0.1:9655`. Existing agents, chat, and knowledge routes are forwarded automatically, while language routes are handled by the hybrid providers.

The first transcription downloads the multilingual Faster Whisper `small` model. It then runs locally using CPU `int8` inference. Set `WHISPER_LOCAL_MODEL` in `.env.local` to choose another model.

To use another API address, copy `.env.example` to `.env.local` and change:

```text
VITE_AIOS_API_URL=http://127.0.0.1:9656
```

Restart the development server after changing environment variables.

## Commands

- `npm run dev` — start the development server
- `npm run start:local` — start all local AIOS services and the web app
- `npm run api` — start the hybrid AIOS backend
- `npm run setup:whisper` — create the isolated local transcription environment
- `npm run whisper` — start the local transcription service
- `npm run lint` — run static analysis
- `npm test` — run unit tests
- `npm run build` — type-check and create a production build
- `npm run preview` — preview the production build

## Workspaces

- Chat
- Knowledge Library and Search
- Documents
- Agents
- Conversation History
- Settings

Conversation data and interface preferences are stored locally in the browser.

## Windows desktop controls

Run `Install-Lampstand-Desktop.cmd` once to add **Lampstand Project** to the desktop and Start Menu. The installer adds user-level shortcuts and does not move the application or its libraries.

- `Start-AIOS-Studio.cmd` starts dependencies, verifies each service, and opens the app.
- `Repair-AIOS-Studio.cmd` starts any dependency that is missing or stopped.
- `Stop-AIOS-Studio.cmd` stops AIOS processes by their assigned local ports and releases memory.
- `Backup-AIOS-Studio.cmd` copies Studio data, Knowledge, Index, Ministry libraries, and detected generated-media outputs into a timestamped folder under `I:\AI\AIOS Backups`. Re-downloadable AI model files are intentionally excluded.
- `Uninstall-Lampstand-Shortcuts.cmd` removes the shortcuts without deleting Lampstand Project or its data.
- The older `AIOS` launcher filenames remain as compatibility entry points.

The Settings page also provides live service health, diagnostics, model unloading, and **Repair services** when the gateway is reachable.

Before a release, run `npm run verify:release`. It performs static analysis, all automated tests, type checking, and the production build.

## Media production workflow

Media Studio keeps its generation queue in `data/media-jobs.json`, recovers active and completed jobs after a gateway or browser restart, and retains the project and generation settings required for an accurate retry. The production history supports project, type, status, favorite, text, and date filtering; active jobs can be cancelled; failed or cancelled jobs can be retried immediately; and downloads are verified before being saved by the browser. Completed WanGP/LTX videos can be synchronized from the configured local output folder.
