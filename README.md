# Lampstand Project

A local-first desktop app for church and ministry work: a Recovery Bible reader with
annotations and highlighting, a hymnal of over 3,200 hymns with chord display and key
transposition, HWMR and ministry-book libraries, and Presentation Studio for driving a
projector and a live audience screen.

Everything runs on your own machine. Transcription, translation and study lookup use
local providers (Ollama, Whisper) with an optional cloud fallback.

## Download

Get `Lampstand-Project-Setup-<version>.exe` from
[the latest release](https://github.com/github4ai/Lampstand-Project/releases/latest).
Installed copies check the same Releases page for updates.

## Development

Node 24 and pnpm.

```bash
pnpm install
pnpm run dev              # browser UI at http://localhost:5173
pnpm test                 # vitest
pnpm run verify:release   # lint, tests, typecheck, production build
pnpm run desktop          # Electron shell against the built UI
pnpm run desktop:installer  # NSIS installer into release/
```

## Layout

- `src/` — React renderer
- `desktop/` — Electron main process, including the audience projector window
- `server/` — local API and library importers
- `data/` — the hymnal, Bible and ministry libraries the app ships with
- `scripts/` — provider setup and machine control scripts
