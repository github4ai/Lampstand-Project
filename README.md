# AIOS Studio

AIOS Studio is a local React workspace for chatting with AIOS agents, browsing indexed knowledge, searching chunks, managing conversation history, and monitoring local services.

## Requirements

- Node.js 20 or newer
- npm
- AIOS API running locally

## Development

```powershell
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The frontend expects the AIOS API at `http://127.0.0.1:8765` by default.

To use another API address, copy `.env.example` to `.env.local` and change:

```text
VITE_AIOS_API_URL=http://127.0.0.1:8765
```

Restart the development server after changing environment variables.

## Commands

- `npm run dev` — start the development server
- `npm run lint` — run static analysis
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
