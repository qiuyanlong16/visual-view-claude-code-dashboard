# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Claude Code Observatory** — A real-time web dashboard for monitoring Claude Code activity: skills invoked, agents launched, memory accessed, tokens consumed. Live updates via Server-Sent Events (SSE).

## Architecture

```
Claude Code ──(hooks)──► Hook Script ──(HTTP POST)──► Hono Server ──(SSE)──► Svelte SPA
                                                          │
                                                    events.jsonl
                                                    sessions/
```

- **Hook Scripts** (`scripts/hook.js`) — Node.js scripts triggered by Claude Code hooks. Read JSON from stdin, POST to event server.
- **Event Server** (`server/src/`) — Hono server on port 3456. Endpoints: `POST /events`, `GET /events/sse`, `GET /events/history`, `GET /sessions`, `GET /memory`, `GET /stats`.
- **Web UI** (`web/src/`) — Svelte 5 SPA on port 5173. Seven dashboard views, SSE-driven.

## Development Commands

```bash
npm install            # install all workspace dependencies
npm run server         # start Hono server on :3456
npm run dev            # start Svelte dev server on :5173
npm test               # run all tests
```

## Event Types

- `session_start` / `session_end` — session lifecycle
- `turn_end` — full turn transcript (tools, skills, agents, tokens)
- `agent_start` / `agent_end` — sub-agent delegation

## Hook Configuration

Add to Claude Code's `settings.json`:

```json
{
  "hooks": {
    "SessionStartHook": "node /path/to/scripts/hook.js session_start",
    "SessionEndHook": "node /path/to/scripts/hook.js session_end",
    "TurnEndHook": "node /path/to/scripts/hook.js turn_end",
    "SubAgentStartHook": "node /path/to/scripts/hook.js agent_start",
    "SubAgentEndHook": "node /path/to/scripts/hook.js agent_end"
  }
}
```

## Key Decisions

- **SSE over WebSocket** — one-way data flow, native browser auto-reconnect
- **JSONL over SQLite** — append-only event streams, easy replay
- **Hono over Express** — lighter weight, modern API, SSE helpers
- **Dark theme only** — monitoring tools are dark theme
- **English only** — no i18n infrastructure

## Workflow Requirements

Every coding task must end with:
1. **UI Check**: Use the `front-end-design` skill to review UI components
2. **TDD Verification**: Run `npm test` to ensure all tests pass
