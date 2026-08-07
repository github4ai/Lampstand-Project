# AIOS Studio

AIOS Studio is a local React workspace for chatting with AIOS agents, browsing indexed knowledge, searching chunks, managing conversation history, and monitoring local services.

## Requirements

- Node.js 20 or newer
- npm
- Ollama for private local translation
- An OpenAI-compatible local Whisper server for private transcription

## Development

```powershell
npm install
npm run setup:whisper
npm run whisper
npm run api
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The frontend expects the AIOS API at `http://127.0.0.1:8765` by default.

The included API runs in hybrid mode: it tries local Ollama and Whisper providers first, then uses OpenAI only when an `OPENAI_API_KEY` is configured. Copy `.env.example` to `.env.local` to customize providers. Secrets in `.env.local` are ignored by Git.

The hybrid API also acts as a gateway for the original AIOS API at `http://127.0.0.1:8765`. Existing agents, chat, and knowledge routes are forwarded automatically, while language routes are handled by the hybrid providers.

The first transcription downloads the multilingual Faster Whisper `small` model. It then runs locally using CPU `int8` inference. Set `WHISPER_LOCAL_MODEL` in `.env.local` to choose another model.

To use another API address, copy `.env.example` to `.env.local` and change:

```text
VITE_AIOS_API_URL=http://127.0.0.1:8765
```

Restart the development server after changing environment variables.

## Commands

- `npm run dev` — start the development server
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
