# Claude Code Observatory — Design Specification

**Date:** 2026-04-17
**Status:** Draft

## Overview

A real-time web dashboard for monitoring Claude Code activity — skills invoked, agents launched, memory accessed, tokens consumed — with live updates via Server-Sent Events (SSE). Built with Svelte for the frontend, Hono for the backend event server, and JSONL for event persistence.

**Language:** All UI text, labels, messages, and documentation are in English.

## Architecture

```
Claude Code ──(hooks)──► Hook Script ──(HTTP POST)──► Hono Server ──(SSE)──► Svelte SPA
                                                          │
                                                    events.jsonl
                                                    sessions/
```

### Components

**1. Hook Scripts** — Small Node.js scripts triggered by Claude Code hooks. Claude Code passes session context as JSON via stdin. The script reads stRdin, enriches with memory file metadata, and POSTs the event to the Hono server. Fire-and-forget; must not block Claude Code (2s POST timeout).

**2. Event Server (Hono)** — Lightweight Node.js server on port 3456.
- `POST /events` — receive events from hooks
- `GET /events/sse` — SSE stream for live events
- `GET /events/history` — replay recent events by ID
- `GET /sessions` — list active/completed sessions
- `GET /memory` — read `.claude/memory` files
- `GET /stats` — aggregated usage statistics
- Storage: `events.jsonl` (append-only JSON Lines), `sessions/` directory (one JSON per session)

**3. Web UI (Svelte + Vite)** — Single-page app on port 5173. Connects to server via EventSource (SSE) for real-time updates, fetch API for history/stats. Uses Svelte stores for reactive state management.

## Event Schema

```json
{
  "type": "turn_end",
  "session_id": "abc123",
  "timestamp": "2026-04-17T10:30:00Z",
  "project": "/path/to/project",
  "data": {
    "turn_number": 5,
    "model": "claude-opus-4-6",
    "tokens_used": { "input": 12000, "output": 3500 },
    "tools_used": ["Bash", "Read", "Edit"],
    "skills_invoked": ["superpowers:brainstorming"],
    "agents_launched": [{"name": "Explore", "type": "general-purpose", "status": "completed"}],
    "memory_accessed": { "read": ["user_role.md"], "written": ["project_current.md"] },
    "transcript_summary": "User asked about monitoring dashboard..."
  }
}
```

### Event Types

| Type | Hook | Purpose |
|---|---|---|
| `session_start` | SessionStartHook | New session begins |
| `session_end` | SessionEndHook | Session closes, final stats |
| `turn_end` | TurnEndHook | Full turn transcript available |
| `agent_start` | SubAgentStartHook | Agent delegation begins |
| `agent_end` | SubAgentEndHook | Agent result, tokens, duration |

### Hook Configuration

Configured in Claude Code's `settings.json`:

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

## Dashboard Views

All views support a global time range selector, session/project filter, and dark theme.

### 1. Live Feed
Auto-scrolling list of real-time events. Each event displays a timestamp, type badge (color-coded), session label, and expandable detail panel. Filter by event type, session, or project.

### 2. Session Timeline
Horizontal timeline with nodes for each turn. Click a turn to see details: tools used, skills invoked, agents launched, memory accessed. Built from `turn_end` events in sequence.

### 3. Memory Inspector
Lists all files in `.claude/memory/`. Shows last modified time, last accessed time (from events), file size, and content preview. Click to read full content. Correlates memory access with sessions.

### 4. Agent Chain Viewer
Visual node graph showing agent parent→child delegation relationships. `agent_start`/`agent_end` events build a tree. Rendered with SVG-based layout (no heavy graph library).

### 5. Skills Usage Stats
Bar chart of skill call frequency over time. Line chart showing daily/weekly trends. Filter by project or session.

### 6. Cost & Token Analytics
Token usage per session (input vs output stacked bars), cumulative cost line, per-model breakdown. Cost calculated from known Claude API pricing. Trend comparison across sessions.

### 7. Multi-Session Overview
Grid of active sessions with live status indicators. Click any session to jump to its timeline. Aggregate stats across all sessions: total tokens, total skill calls, total cost.

## Error Handling

| Scenario | Handling |
|---|---|
| Hook script fails | Fire-and-forget; 2s POST timeout. Event loss acceptable. |
| Server restarts | Replays last N events from `events.jsonl` on boot. |
| SSE disconnects | EventSource auto-reconnects. Fetches `/events/history` with `Last-Event-ID` for catch-up. |
| JSONL corruption | Validates each line on load; skips malformed lines, logs warning. |
| Multiple sessions | Events include `session_id` and `project`; views filter accordingly. |

## Startup Flow

1. `npm run server` — starts Hono server on port 3456
2. `npm run dev` — starts Svelte dev server on port 5173
3. User opens `http://localhost:5173` — EventSource connects, replays history, begins live stream
4. Claude Code hooks pre-configured in `settings.json` — no per-session setup needed

## Key Decisions

- **SSE over WebSocket:** One-way data flow (server → client), simpler protocol, native browser support with auto-reconnect.
- **JSONL over SQLite:** Append-only event streams are a natural fit for JSON Lines. No query layer needed beyond time-range filtering and replay.
- **Hono over Express:** Lighter weight, modern API, built-in SSE helpers, smaller dependency tree.
- **No build step for hooks:** Hook scripts are plain Node.js, run directly — no TypeScript compilation needed for the hook layer.
- **Dark theme only:** Monitoring tools are dark theme; no light theme toggle.
- **English only:** All UI, labels, and messages in English. No i18n infrastructure needed.
