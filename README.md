# Claude Code Observatory

A real-time web dashboard for monitoring Claude Code activity — skills invoked, agents launched, memory accessed, tokens consumed. Live updates via Server-Sent Events (SSE).

## Architecture

```
Claude Code ──(hooks)──► Hook Script ──(HTTP POST)──► Hono Server ──(SSE)──► Svelte SPA
                                                          │
                                                    events.jsonl
                                                    sessions/
```

### Components

- **Hook Scripts** (`scripts/hook.js`) — Node.js scripts triggered by Claude Code hooks. Reads JSON from stdin, POSTs events to the Hono server with a 2s timeout (fire-and-forget, must not block Claude Code).
- **Event Server** (`server/src/`) — Hono server on port 3456. Receives events, persists to JSONL, broadcasts via SSE.
- **Web UI** (`web/src/`) — Svelte 5 SPA on port 5173. Seven dashboard views with real-time SSE-driven updates.

## Quick Start

```bash
npm install            # install all workspace dependencies
npm run server         # start Hono server on :3456
npm run dev            # start Svelte dev server on :5173
npm test               # run all tests
```

Then open http://localhost:5173 in your browser.

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

## Memory Inspector Configuration

The Memory Inspector page shows memory files, agents, and project configurations.
It reads project paths from `~/.view-claude.json`:

```json
{
  "projects": [
    "/path/to/your/project"
  ]
}
```

On Windows, this file is at `%USERPROFILE%/.view-claude.json`.

You can manage projects in two ways:

1. **Via the UI:** Navigate to Memory Inspector → click "+ Add Project" → enter path → Save
2. **Manually:** Edit `~/.view-claude.json` directly

## Event Types

| Type | Hook | Purpose |
|---|---|---|
| `session_start` | SessionStartHook | New session begins |
| `session_end` | SessionEndHook | Session closes, final stats |
| `turn_end` | TurnEndHook | Full turn transcript available |
| `agent_start` | SubAgentStartHook | Agent delegation begins |
| `agent_end` | SubAgentEndHook | Agent result, tokens, duration |

## Dashboard Views

### 1. Live Feed
Auto-scrolling real-time event list with color-coded event type badges, session labels, and expandable detail panels. Supports filtering by event type, session, project, and time range.

### 2. Session Timeline
Vertical timeline of turn events with clickable nodes showing tools used, skills invoked, agents launched, and memory accessed. Filterable by session.

### 3. Memory Inspector
Lists memory files from configured projects and the global `~/.claude/memory/` directory. Shows file size, modification time, and inline content preview. Supports adding/removing projects directly in the UI.

### 4. Agent Chain Viewer
Tree visualization of agent parent-to-child delegation relationships built from `agent_start`/`agent_end` events. Expandable nodes with status indicators.

### 5. Skills Usage Stats
Bar charts of skill and tool call frequency. SVG-based charts (no external dependencies) render usage data aggregated across all sessions.

### 6. Cost & Token Analytics
Summary cards for total tokens and estimated cost. Daily token usage line chart, model distribution bar chart, and per-session cost breakdown. Uses known Claude API pricing.

### 7. Session Overview
Grid of active and completed sessions with live status indicators. Shows project, start time, duration, turn count, token usage, and estimated cost per session.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/events` | Receive event from hook |
| GET | `/events/sse` | SSE stream for live events |
| GET | `/events/history` | Replay events after given ID |
| GET | `/events` | Get all events (with limit) |
| GET | `/sessions` | List all sessions |
| GET | `/sessions/:id` | Get session details |
| GET | `/memory` | List memory files for a project |
| GET | `/memory/content` | Read memory file content by path |
| GET | `/memory/config` | Get configured project paths |
| POST | `/memory/config` | Add or remove project paths |
| GET | `/memory/global` | List global memory files and agents |
| GET | `/memory/projects/data` | Get all configured projects' data |
| GET | `/stats` | Aggregated usage statistics |
| GET | `/health` | Health check |

## Tech Stack

- **Frontend:** Svelte 5 + Vite, custom SVG charts (no charting libraries)
- **Backend:** Hono on Node.js with `@hono/node-server`
- **Persistence:** JSONL append-only event streams
- **Transport:** Server-Sent Events (EventSource API, native browser auto-reconnect)
- **Styling:** Custom CSS variables, dark theme only

## Key Decisions

- **SSE over WebSocket** — one-way data flow, simpler protocol, native browser auto-reconnect
- **JSONL over SQLite** — append-only event streams are a natural fit for JSON Lines; no query layer needed beyond time-range filtering and replay
- **Hono over Express** — lighter weight, modern API, built-in SSE helpers
- **Dark theme only** — monitoring tools are dark theme; no light theme toggle
- **English only** — all UI, labels, and messages in English; no i18n infrastructure

## Project Structure

```
├── package.json              # Root workspace
├── scripts/hook.js           # Claude Code hook script
├── server/
│   ├── package.json          # Server dependencies
│   ├── src/
│   │   ├── index.js          # Hono server entry (port 3456)
│   │   ├── store.js          # JSONL event store
│   │   └── routes/
│   │       ├── events.js     # Event + SSE routes
│   │       ├── sessions.js   # Session routes
│   │       ├── memory.js     # Memory file routes
│   │       └── stats.js      # Stats aggregation route
│   └── test/
│       └── api.test.js       # API tests
└── web/
    ├── package.json          # Web dependencies
    ├── src/
    │   ├── main.js           # Svelte app entry
    │   ├── App.svelte        # Shell with navigation
    │   ├── app.css           # Global dark theme styles
    │   ├── stores/           # Svelte stores (events, sessions, stats, memory)
    │   ├── components/       # Shared UI components
    │   └── views/            # Dashboard views
    └── index.html
```
