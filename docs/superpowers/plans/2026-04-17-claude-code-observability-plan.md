# Claude Code Observatory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time web dashboard for monitoring Claude Code activity — skills, agents, memory, tokens — via hooks, SSE, and a Svelte frontend.

**Architecture:** Claude Code hooks fire on session/turn/agent events → small Node.js hook scripts POST events to a Hono server → server persists to JSONL and broadcasts via SSE → Svelte SPA renders 7 dashboard views.

**Tech Stack:** Svelte 5 + Vite (frontend), Hono on Node.js (backend), JSONL (persistence), EventSource (SSE, no library), no CSS framework (custom dark theme CSS).

**Project:** Greenfield. No existing code. Node.js v24 available.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Root workspace: scripts for server, dev, install all |
| `.gitignore` | Ignore node_modules, dist, data files |
| `CLAUDE.md` | Updated with project overview |
| `server/package.json` | Server deps (hono, @hono/node-server) |
| `server/index.js` | Hono server entry, port 3456, CORS, route mounting |
| `server/store.js` | JSONL append, replay, parse, session management |
| `server/routes/events.js` | POST /events, GET /events/sse, GET /events/history |
| `server/routes/sessions.js` | GET /sessions, GET /sessions/:id |
| `server/routes/memory.js` | GET /memory, GET /memory/* (file content) |
| `server/routes/stats.js` | GET /stats (aggregated token/skill/cost data) |
| `server/data/.gitkeep` | Placeholder for events.jsonl, sessions/ |
| `scripts/hook.js` | Claude Code hook script — reads stdin JSON, POSTs to server |
| `web/package.json` | Web deps (svelte, vite, @sveltejs/vite-plugin-svelte) |
| `web/vite.config.js` | Vite config with Svelte plugin, proxy /api to server |
| `web/svelte.config.js` | Svelte config |
| `web/index.html` | Entry HTML |
| `web/src/main.js` | Svelte app mount |
| `web/src/App.svelte` | Router, layout, global filters |
| `web/src/lib/store.js` | Svelte stores: events, sessions, filters, SSE connection |
| `web/src/lib/types.js` | JSDoc type definitions for events, sessions, agents |
| `web/src/lib/sse.js` | EventSource connection, auto-reconnect, history replay |
| `web/src/lib/utils.js` | Time formatting, token-to-cost calculation, JSONL parsing |
| `web/src/lib/constants.js` | Event type labels, colors, API base URL, Claude pricing |
| `web/src/lib/components/EventCard.svelte` | Single event card (timestamp, badge, expandable details) |
| `web/src/lib/components/EventFilter.svelte` | Global filter bar (type, session, project, time range) |
| `web/src/lib/components/TimelineNode.svelte` | Timeline turn node with details popup |
| `web/src/lib/components/AgentNode.svelte` | Agent chain tree node |
| `web/src/lib/components/BarChart.svelte` | Simple SVG bar chart (no external lib) |
| `web/src/lib/components/LineChart.svelte` | Simple SVG line chart (no external lib) |
| `web/src/views/LiveFeed.svelte` | View 1: auto-scrolling event list |
| `web/src/views/SessionTimeline.svelte` | View 2: session timeline |
| `web/src/views/MemoryInspector.svelte` | View 3: memory file browser |
| `web/src/views/AgentChain.svelte` | View 4: agent delegation tree |
| `web/src/views/SkillsStats.svelte` | View 5: skill frequency charts |
| `web/src/views/CostAnalytics.svelte` | View 6: token/cost analytics |
| `web/src/views/MultiSession.svelte` | View 7: multi-session grid |
| `web/src/styles/global.css` | Dark theme CSS variables, resets |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `.gitignore`, `CLAUDE.md`, `server/package.json`, `server/data/.gitkeep`, `web/package.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "claude-code-observatory",
  "private": true,
  "scripts": {
    "dev": "npm run server & npm run dev:web",
    "dev:web": "npm --prefix web run dev",
    "server": "node server/index.js",
    "install:all": "npm install && npm --prefix server install && npm --prefix web install"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
server/data/*.jsonl
server/data/sessions/
.superpowers/
```

- [ ] **Step 3: Create server/package.json**

```json
{
  "name": "observatory-server",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "hono": "^4.8.0",
    "@hono/node-server": "^1.14.0"
  }
}
```

- [ ] **Step 4: Create web/package.json**

```json
{
  "name": "observatory-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "svelte": "^5.0.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 5: Create directories and placeholder files**

```bash
mkdir -p server/data server/routes scripts
mkdir -p web/src/lib/components web/src/lib web/src/views web/src/styles
touch server/data/.gitkeep
```

- [ ] **Step 6: Install all dependencies**

Run: `npm --prefix server install && npm --prefix web install`
Expected: Both package-lock.json files created, node_modules populated.

- [ ] **Step 7: Update CLAUDE.md**

```markdown
# CLAUDE.md

## Project Overview
Claude Code Observatory — a real-time web dashboard for monitoring Claude Code activity (skills, agents, memory, tokens) via hooks, SSE, and Svelte.

## Code Structure
- `server/` — Hono event server (port 3456). Receives events from Claude Code hooks, persists to JSONL, serves SSE stream.
- `web/` — Svelte 5 SPA (port 5173). 7 dashboard views with real-time event streaming.
- `scripts/` — Claude Code hook scripts.

## Development Commands
- `npm run install:all` — install all dependencies
- `npm run server` — start Hono event server (port 3456)
- `npm run dev:web` — start Svelte dev server (port 5173)
- `npm run dev` — start both server and web

## Key Conventions
- English-only UI, dark theme only
- No external charting libraries — SVG charts built from scratch
- Event types are color-coded constants in `web/src/lib/constants.js`
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: scaffold observability project with server and web packages"
```

---

### Task 2: Shared Constants, Types, and Utilities

**Files:**
- Create: `web/src/lib/constants.js`, `web/src/lib/types.js`, `web/src/lib/utils.js`, `web/src/styles/global.css`

- [ ] **Step 1: Create constants**

```js
// web/src/lib/constants.js
export const API_BASE = 'http://localhost:3456';

export const EVENT_TYPES = {
  session_start: { label: 'Session Start', color: '#4ade80' },
  session_end: { label: 'Session End', color: '#f87171' },
  turn_end: { label: 'Turn End', color: '#60a5fa' },
  agent_start: { label: 'Agent Start', color: '#c084fc' },
  agent_end: { label: 'Agent End', color: '#a78bfa' },
};

// Claude API pricing (per 1M tokens) as of 2026-04
export const MODEL_PRICING = {
  'claude-opus-4-6': { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0 },
};

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
```

- [ ] **Step 2: Create JSDoc types**

```js
// web/src/lib/types.js

/**
 * @typedef {Object} TokenUsage
 * @property {number} input
 * @property {number} output
 */

/**
 * @typedef {Object} AgentInfo
 * @property {string} name
 * @property {string} type
 * @property {string} status
 */

/**
 * @typedef {Object} MemoryAccess
 * @property {string[]} read
 * @property {string[]} written
 */

/**
 * @typedef {Object} EventData
 * @property {number} [turn_number]
 * @property {string} [model]
 * @property {TokenUsage} [tokens_used]
 * @property {string[]} [tools_used]
 * @property {string[]} [skills_invoked]
 * @property {AgentInfo[]} [agents_launched]
 * @property {MemoryAccess} [memory_accessed]
 * @property {string} [transcript_summary]
 */

/**
 * @typedef {Object} ObservatoryEvent
 * @property {string} type
 * @property {string} session_id
 * @property {string} timestamp
 * @property {string} project
 * @property {EventData} data
 * @property {number} [id] - assigned by server
 */

/**
 * @typedef {Object} SessionInfo
 * @property {string} id
 * @property {string} project
 * @property {string} started_at
 * @property {string} [ended_at]
 * @property {string} status - 'active' | 'ended'
 * @property {number} turn_count
 * @property {number} total_input_tokens
 * @property {number} total_output_tokens
 */
```

- [ ] **Step 3: Create utility functions**

```js
// web/src/lib/utils.js
import { MODEL_PRICING, DEFAULT_MODEL } from './constants.js';

export function formatTimestamp(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour12: false });
}

export function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function calculateCost(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return +(inputCost + outputCost).toFixed(4);
}

export function formatCost(dollars) {
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(2)}`;
}

export function formatTokenCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function uniqueValues(events, fn) {
  const set = new Set();
  for (const e of events) {
    const v = fn(e);
    if (v) set.add(v);
  }
  return [...set].sort();
}
```

- [ ] **Step 4: Create global dark theme CSS**

```css
/* web/src/styles/global.css */
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --border-color: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #484f58;
  --accent: #58a6ff;
  --accent-hover: #79c0ff;
  --green: #3fb950;
  --red: #f85149;
  --yellow: #d29922;
  --purple: #bc8cff;
  --radius: 6px;
  --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font-sans);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.5;
  font-size: 14px;
}

a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); }

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: var(--bg-primary); }
::-webkit-scrollbar-thumb { background: var(--bg-tertiary); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
```

- [ ] **Step 5: Verify by checking files exist**

Run: `ls web/src/lib/constants.js web/src/lib/types.js web/src/lib/utils.js web/src/styles/global.css`
Expected: All 4 files listed.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/constants.js web/src/lib/types.js web/src/lib/utils.js web/src/styles/global.css
git commit -m "feat: add shared constants, types, utilities, and dark theme"
```

---

### Task 3: Event Store (JSONL Backend)

**Files:**
- Create: `server/store.js`

- [ ] **Step 1: Write tests for the store**

```js
// server/store.test.js
import { createStore } from './store.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function createTestStore() {
  const dir = mkdtempSync(join(tmpdir(), 'obs-test-'));
  const store = createStore({ dataDir: dir });
  return { store, dir };
}

function cleanup({ dir }) {
  rmSync(dir, { recursive: true, force: true });
}

function makeEvent(overrides = {}) {
  return {
    type: 'turn_end',
    session_id: 'test-1',
    timestamp: new Date().toISOString(),
    project: '/test/project',
    data: { turn_number: 1 },
    ...overrides,
  };
}

async function testAppend() {
  const { store, dir } = createTestStore();
  const event = makeEvent();
  const result = await store.append(event);
  console.assert(result.id === 1, 'First event should have id=1');
  console.assert(typeof result.timestamp === 'string', 'Should have timestamp');
  cleanup({ dir });
  console.log('testAppend: PASSED');
}

async function testReplay() {
  const { store, dir } = createTestStore();
  await store.append(makeEvent({ type: 'session_start' }));
  await store.append(makeEvent({ type: 'turn_end', data: { turn_number: 1 } }));
  await store.append(makeEvent({ type: 'turn_end', data: { turn_number: 2 } }));

  const replayed = store.replay();
  console.assert(replayed.length === 3, `Expected 3 events, got ${replayed.length}`);
  console.assert(replayed[0].type === 'session_start', 'First event should be session_start');
  console.assert(replayed[2].id === 3, 'Last event should have id=3');
  cleanup({ dir });
  console.log('testReplay: PASSED');
}

async function testGetById() {
  const { store, dir } = createTestStore();
  await store.append(makeEvent());
  await store.append(makeEvent());
  const ev = store.getById(2);
  console.assert(ev && ev.id === 2, 'Should get event by id');
  const missing = store.getById(999);
  console.assert(missing === undefined, 'Should return undefined for missing id');
  cleanup({ dir });
  console.log('testGetById: PASSED');
}

async function testGetSessions() {
  const { store, dir } = createTestStore();
  await store.append(makeEvent({ type: 'session_start', session_id: 's1' }));
  await store.append(makeEvent({ type: 'turn_end', session_id: 's1' }));
  await store.append(makeEvent({ type: 'session_start', session_id: 's2' }));

  const sessions = store.getSessions();
  console.assert(sessions.length === 2, `Expected 2 sessions, got ${sessions.length}`);
  const s1 = sessions.find(s => s.id === 's1');
  console.assert(s1.turn_count === 1, 's1 should have 1 turn');
  cleanup({ dir });
  console.log('testGetSessions: PASSED');
}

async function testGetStats() {
  const { store, dir } = createTestStore();
  await store.append(makeEvent({
    type: 'turn_end',
    data: {
      model: 'claude-sonnet-4-6',
      tokens_used: { input: 1000, output: 500 },
      skills_invoked: ['superpowers:brainstorming'],
    },
  }));
  await store.append(makeEvent({
    type: 'turn_end',
    data: {
      model: 'claude-sonnet-4-6',
      tokens_used: { input: 2000, output: 1000 },
      skills_invoked: ['superpowers:brainstorming'],
    },
  }));

  const stats = store.getStats();
  console.assert(stats.total_input_tokens === 3000, `Expected 3000 input tokens, got ${stats.total_input_tokens}`);
  console.assert(stats.total_output_tokens === 1500, `Expected 1500 output tokens`);
  console.assert(stats.skill_counts['superpowers:brainstorming'] === 2, 'Should count skill calls');
  cleanup({ dir });
  console.log('testGetStats: PASSED');
}

async function testCorruptLine() {
  const { store, dir } = createTestStore();
  await store.append(makeEvent());
  const fs = await import('fs');
  const path = await import('path');
  const jsonlPath = path.join(dir, 'events.jsonl');
  fs.appendFileSync(jsonlPath, 'NOT VALID JSON\n');
  await store.append(makeEvent());
  const replayed = store.replay();
  console.assert(replayed.length === 2, `Should skip corrupt line, got ${replayed.length}`);
  cleanup({ dir });
  console.log('testCorruptLine: PASSED');
}

(async () => {
  await testAppend();
  await testReplay();
  await testGetById();
  await testGetSessions();
  await testGetStats();
  await testCorruptLine();
  console.log('\nAll store tests passed.');
})();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node server/store.test.js`
Expected: `createStore is not a function` or similar import error.

- [ ] **Step 3: Implement the store**

```js
// server/store.js
import { appendFileSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export function createStore({ dataDir = './server/data' } = {}) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const sessionsDir = join(dataDir, 'sessions');
  if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true });

  const jsonlPath = join(dataDir, 'events.jsonl');
  let nextId = 1;
  const events = [];
  const sessions = new Map();

  // Load existing events on startup
  if (existsSync(jsonlPath)) {
    const lines = readFileSync(jsonlPath, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        events.push(event);
        nextId = Math.max(nextId, (event.id || 0) + 1);
        updateSessionIndex(event);
      } catch {
        console.warn('[store] Skipping malformed JSONL line');
      }
    }
  }

  function updateSessionIndex(event) {
    if (!event.session_id) return;
    if (!sessions.has(event.session_id)) {
      sessions.set(event.session_id, {
        id: event.session_id,
        project: event.project || 'unknown',
        started_at: event.timestamp,
        ended_at: null,
        status: 'active',
        turn_count: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
      });
    }
    const session = sessions.get(event.session_id);
    if (event.type === 'turn_end') {
      session.turn_count++;
      session.total_input_tokens += event.data?.tokens_used?.input || 0;
      session.total_output_tokens += event.data?.tokens_used?.output || 0;
    }
    if (event.type === 'session_end') {
      session.status = 'ended';
      session.ended_at = event.timestamp;
    }
    if (event.type === 'session_start') {
      session.started_at = event.timestamp;
    }
  }

  async function append(event) {
    const enriched = { ...event, id: nextId++ };
    events.push(enriched);
    appendFileSync(jsonlPath, JSON.stringify(enriched) + '\n');
    updateSessionIndex(enriched);
    return enriched;
  }

  function replay() {
    return [...events];
  }

  function getById(id) {
    return events.find(e => e.id === id);
  }

  function getAfterId(id) {
    const idx = events.findIndex(e => e.id === id);
    return events.slice(idx + 1);
  }

  function getSessions() {
    return [...sessions.values()].sort((a, b) =>
      new Date(b.started_at) - new Date(a.started_at)
    );
  }

  function getSessionById(id) {
    return sessions.get(id);
  }

  function getStats() {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalSessions = 0;
    const skillCounts = {};
    const toolCounts = {};
    const agentCounts = {};
    const modelUsage = {};
    const sessionCosts = {};

    for (const e of events) {
      if (e.type === 'session_start') totalSessions++;
      if (!e.data) continue;

      if (e.data.tokens_used) {
        totalInputTokens += e.data.tokens_used.input || 0;
        totalOutputTokens += e.data.tokens_used.output || 0;
      }

      for (const skill of (e.data.skills_invoked || [])) {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      }
      for (const tool of (e.data.tools_used || [])) {
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      }
      for (const agent of (e.data.agents_launched || [])) {
        agentCounts[agent.name] = (agentCounts[agent.name] || 0) + 1;
      }
      if (e.data.model) {
        modelUsage[e.data.model] = (modelUsage[e.data.model] || 0) + 1;
      }
    }

    // Calculate per-session costs
    for (const [sid, session] of sessions) {
      const { calculateCost } = await import('../web/src/lib/utils.js');
      const cost = calculateCost('claude-sonnet-4-6', session.total_input_tokens, session.total_output_tokens);
      sessionCosts[sid] = cost;
    }

    return {
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      total_sessions: totalSessions,
      skill_counts: skillCounts,
      tool_counts: toolCounts,
      agent_counts: agentCounts,
      model_usage: modelUsage,
      session_costs: sessionCosts,
    };
  }

  return { append, replay, getById, getAfterId, getSessions, getSessionById, getStats, jsonlPath };
}
```

Wait — the `getStats` function has a top-level `await` inside a non-async function. Let me fix that. I'll inline the cost calculation instead of importing it.

```js
// server/store.js — getStats function (corrected)
  function getStats() {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalSessions = 0;
    const skillCounts = {};
    const toolCounts = {};
    const agentCounts = {};
    const modelUsage = {};
    const dailyTokens = {};

    for (const e of events) {
      if (e.type === 'session_start') totalSessions++;
      if (!e.data) continue;

      if (e.data.tokens_used) {
        totalInputTokens += e.data.tokens_used.input || 0;
        totalOutputTokens += e.data.tokens_used.output || 0;

        // Daily token tracking
        const day = e.timestamp.slice(0, 10);
        if (!dailyTokens[day]) dailyTokens[day] = { input: 0, output: 0 };
        dailyTokens[day].input += e.data.tokens_used.input || 0;
        dailyTokens[day].output += e.data.tokens_used.output || 0;
      }

      for (const skill of (e.data.skills_invoked || [])) {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      }
      for (const tool of (e.data.tools_used || [])) {
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      }
      for (const agent of (e.data.agents_launched || [])) {
        agentCounts[agent.name] = (agentCounts[agent.name] || 0) + 1;
      }
      if (e.data.model) {
        modelUsage[e.data.model] = (modelUsage[e.data.model] || 0) + 1;
      }
    }

    const sessionCosts = {};
    for (const [sid, session] of sessions) {
      const pricing = MODEL_PRICING['claude-sonnet-4-6'];
      const cost = ((session.total_input_tokens / 1_000_000) * pricing.input) +
                   ((session.total_output_tokens / 1_000_000) * pricing.output);
      sessionCosts[sid] = +cost.toFixed(4);
    }

    return {
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      total_sessions: totalSessions,
      skill_counts: skillCounts,
      tool_counts: toolCounts,
      agent_counts: agentCounts,
      model_usage: modelUsage,
      daily_tokens: dailyTokens,
      session_costs: sessionCosts,
    };
  }
```

I need to include MODEL_PRICING in the store. Let me add it as a constant at the top.

Here's the complete corrected store:

```js
// server/store.js
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const MODEL_PRICING = {
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.0 },
};

export function createStore({ dataDir = './server/data' } = {}) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const sessionsDir = join(dataDir, 'sessions');
  if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true });

  const jsonlPath = join(dataDir, 'events.jsonl');
  let nextId = 1;
  const events = [];
  const sessions = new Map();

  if (existsSync(jsonlPath)) {
    const lines = readFileSync(jsonlPath, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        events.push(event);
        nextId = Math.max(nextId, (event.id || 0) + 1);
        updateSessionIndex(event);
      } catch {
        console.warn('[store] Skipping malformed JSONL line');
      }
    }
  }

  function updateSessionIndex(event) {
    if (!event.session_id) return;
    if (!sessions.has(event.session_id)) {
      sessions.set(event.session_id, {
        id: event.session_id,
        project: event.project || 'unknown',
        started_at: event.timestamp,
        ended_at: null,
        status: 'active',
        turn_count: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
      });
    }
    const s = sessions.get(event.session_id);
    if (event.type === 'turn_end') {
      s.turn_count++;
      s.total_input_tokens += event.data?.tokens_used?.input || 0;
      s.total_output_tokens += event.data?.tokens_used?.output || 0;
    }
    if (event.type === 'session_end') {
      s.status = 'ended';
      s.ended_at = event.timestamp;
    }
    if (event.type === 'session_start') {
      s.started_at = event.timestamp;
    }
  }

  async function append(event) {
    const enriched = { ...event, id: nextId++ };
    events.push(enriched);
    appendFileSync(jsonlPath, JSON.stringify(enriched) + '\n');
    updateSessionIndex(enriched);
    return enriched;
  }

  function replay() {
    return [...events];
  }

  function getById(id) {
    return events.find(e => e.id === id);
  }

  function getAfterId(id) {
    const idx = events.findIndex(e => e.id === id);
    return events.slice(idx + 1);
  }

  function getSessions() {
    return [...sessions.values()].sort((a, b) =>
      new Date(b.started_at) - new Date(a.started_at)
    );
  }

  function getSessionById(id) {
    return sessions.get(id);
  }

  function getStats() {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalSessions = 0;
    const skillCounts = {};
    const toolCounts = {};
    const agentCounts = {};
    const modelUsage = {};
    const dailyTokens = {};

    for (const e of events) {
      if (e.type === 'session_start') totalSessions++;
      if (!e.data) continue;
      if (e.data.tokens_used) {
        totalInputTokens += e.data.tokens_used.input || 0;
        totalOutputTokens += e.data.tokens_used.output || 0;
        const day = e.timestamp.slice(0, 10);
        if (!dailyTokens[day]) dailyTokens[day] = { input: 0, output: 0 };
        dailyTokens[day].input += e.data.tokens_used.input || 0;
        dailyTokens[day].output += e.data.tokens_used.output || 0;
      }
      for (const skill of (e.data.skills_invoked || [])) {
        skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      }
      for (const tool of (e.data.tools_used || [])) {
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      }
      for (const agent of (e.data.agents_launched || [])) {
        agentCounts[agent.name] = (agentCounts[agent.name] || 0) + 1;
      }
      if (e.data.model) {
        modelUsage[e.data.model] = (modelUsage[e.data.model] || 0) + 1;
      }
    }

    const sessionCosts = {};
    for (const [sid, s] of sessions) {
      const p = MODEL_PRICING['claude-sonnet-4-6'];
      sessionCosts[sid] = +(((s.total_input_tokens / 1e6) * p.input) + ((s.total_output_tokens / 1e6) * p.output)).toFixed(4);
    }

    return {
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      total_sessions: totalSessions,
      skill_counts: skillCounts,
      tool_counts: toolCounts,
      agent_counts: agentCounts,
      model_usage: modelUsage,
      daily_tokens: dailyTokens,
      session_costs: sessionCosts,
    };
  }

  return { append, replay, getById, getAfterId, getSessions, getSessionById, getStats };
}
```

- [ ] **Step 4: Run tests**

Run: `node server/store.test.js`
Expected: "All store tests passed."

- [ ] **Step 5: Commit**

```bash
git add server/store.js server/store.test.js
git commit -m "feat: implement JSONL event store with replay, sessions, and stats"
```

---

### Task 4: Hono Server and Routes

**Files:**
- Create: `server/index.js`, `server/routes/events.js`, `server/routes/sessions.js`, `server/routes/memory.js`, `server/routes/stats.js`

- [ ] **Step 1: Create the main server entry point**

```js
// server/index.js
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createStore } from './store.js';
import { eventsRouter } from './routes/events.js';
import { sessionsRouter } from './routes/sessions.js';
import { memoryRouter } from './routes/memory.js';
import { statsRouter } from './routes/stats.js';

const PORT = parseInt(process.env.PORT || '3456', 10);
const store = createStore();
const app = new Hono();

app.use('*', cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Attach store to context for routes
app.use('*', async (c, next) => {
  c.set('store', store);
  await next();
});

app.route('/events', eventsRouter);
app.route('/sessions', sessionsRouter);
app.route('/memory', memoryRouter);
app.route('/stats', statsRouter);

app.get('/health', (c) => c.json({ status: 'ok' }));

console.log(`[server] Starting on port ${PORT}`);
serve({ fetch: app.fetch, port: PORT });
```

- [ ] **Step 2: Events route with SSE**

```js
// server/routes/events.js
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

export const eventsRouter = new Hono();

// Track connected SSE clients
const clients = new Map();
let clientId = 0;

// POST /events — receive event from hook
eventsRouter.post('/', async (c) => {
  const store = c.get('store');
  let event;
  try {
    event = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  if (!event.type || !event.session_id) {
    return c.json({ error: 'Missing type or session_id' }, 400);
  }

  const saved = await store.append(event);

  // Broadcast to all SSE clients
  for (const [id, writer] of clients) {
    try {
      await writer.writeSSE({
        data: JSON.stringify(saved),
        id: String(saved.id),
      });
    } catch {
      clients.delete(id);
    }
  }

  return c.json({ id: saved.id }, 201);
});

// GET /events/sse — SSE stream
eventsRouter.get('/sse', (c) => {
  const store = c.get('store');
  const id = ++clientId;

  return streamSSE(c, async (stream) => {
    clients.set(id, stream);

    // Send replay of recent events (last 100)
    const history = store.replay().slice(-100);
    for (const event of history) {
      await stream.writeSSE({
        data: JSON.stringify(event),
        id: String(event.id),
      });
    }

    // Keep connection alive
    while (stream.closed === false) {
      await stream.sleep(30000);
      try {
        await stream.writeSSE({ event: 'ping' });
      } catch {
        break;
      }
    }

    clients.delete(id);
  });
});

// GET /events/history — get events after a given ID
eventsRouter.get('/history', (c) => {
  const store = c.get('store');
  const afterId = parseInt(c.req.query('after') || '0', 10);
  const limit = parseInt(c.req.query('limit') || '500', 10);
  const events = store.replay().filter(e => e.id > afterId).slice(0, limit);
  return c.json(events);
});

// GET /events — get all events (with optional limit)
eventsRouter.get('/', (c) => {
  const store = c.get('store');
  const limit = parseInt(c.req.query('limit') || '200', 10);
  const events = store.replay().slice(-limit);
  return c.json(events);
});
```

- [ ] **Step 3: Sessions route**

```js
// server/routes/sessions.js
import { Hono } from 'hono';

export const sessionsRouter = new Hono();

sessionsRouter.get('/', (c) => {
  const store = c.get('store');
  return c.json(store.getSessions());
});

sessionsRouter.get('/:id', (c) => {
  const store = c.get('store');
  const session = store.getSessionById(c.req.param('id'));
  if (!session) return c.json({ error: 'Session not found' }, 404);
  return c.json(session);
});
```

- [ ] **Step 4: Memory route**

```js
// server/routes/memory.js
import { Hono } from 'hono';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export const memoryRouter = new Hono();

function findMemoryDirs() {
  // Search for .claude/memory directories in known projects
  // For now, check common locations
  const dirs = [];
  const home = process.env.USERPROFILE || process.env.HOME;
  if (home) {
    const globalMemory = join(home, '.claude', 'memory');
    try {
      if (readdirSync(globalMemory).length > 0) {
        dirs.push({ label: 'Global', path: globalMemory });
      }
    } catch {}
  }
  return dirs;
}

memoryRouter.get('/', (c) => {
  const dirs = findMemoryDirs();
  const files = [];

  for (const dir of dirs) {
    try {
      const entries = readdirSync(dir.path, { recursive: true });
      for (const entry of entries) {
        const fullPath = join(dir.path, entry);
        const stat = statSync(fullPath);
        if (stat.isFile()) {
          files.push({
            name: entry,
            path: fullPath,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            source: dir.label,
          });
        }
      }
    } catch {}
  }

  return c.json(files);
});

memoryRouter.get('/:name', (c) => {
  const dirs = findMemoryDirs();
  const name = decodeURIComponent(c.req.param('name'));

  for (const dir of dirs) {
    const fullPath = join(dir.path, name);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      return c.json({ name, content, source: dir.label });
    } catch {}
  }

  return c.json({ error: 'File not found' }, 404);
});
```

- [ ] **Step 5: Stats route**

```js
// server/routes/stats.js
import { Hono } from 'hono';

export const statsRouter = new Hono();

statsRouter.get('/', (c) => {
  const store = c.get('store');
  return c.json(store.getStats());
});
```

- [ ] **Step 6: Test the server starts correctly**

Run: `node server/index.js`
Expected: `[server] Starting on port 3456`

Then in another terminal:
Run: `curl http://localhost:3456/health`
Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add server/index.js server/routes/
git commit -m "feat: add Hono server with events SSE, sessions, memory, and stats routes"
```

---

### Task 5: Hook Script

**Files:**
- Create: `scripts/hook.js`

- [ ] **Step 1: Write the hook script**

```js
// scripts/hook.js
// Claude Code hook script — reads session context from stdin, POSTs to server
import { stdin } from 'node:process';
import { createHmac, randomUUID } from 'node:crypto';

const SERVER_URL = process.env.OBSERVATORY_SERVER_URL || 'http://localhost:3456';
const HOOK_TYPE = process.argv[2];

if (!HOOK_TYPE) {
  console.error('[hook] Usage: node hook.js <hook_type>');
  process.exit(1);
}

// Read JSON from stdin (Claude Code passes context as JSON)
let data = '';
stdin.setEncoding('utf-8');
stdin.on('data', (chunk) => { data += chunk; });
stdin.on('end', () => {
  let context;
  try {
    context = data ? JSON.parse(data) : {};
  } catch {
    context = {};
  }

  const event = {
    type: HOOK_TYPE,
    session_id: context.session_id || randomUUID().slice(0, 8),
    timestamp: new Date().toISOString(),
    project: context.project || process.cwd(),
    data: extractEventData(HOOK_TYPE, context),
  };

  sendEvent(event);
});

function extractEventData(hookType, context) {
  const base = {};

  // Extract model from context if available
  if (context.model) base.model = context.model;

  // Extract token usage from transcript summary
  if (context.usage) {
    base.tokens_used = {
      input: context.usage.input_tokens || 0,
      output: context.usage.output_tokens || 0,
    };
  }

  // Extract tools used from transcript
  if (context.transcript) {
    const tools = new Set();
    const skills = new Set();
    const agents = [];

    for (const message of context.transcript) {
      if (message.type === 'tool_use') {
        tools.add(message.name);
        if (message.name === 'Agent') {
          agents.push({
            name: message.input?.subagent_type || 'general-purpose',
            type: message.input?.subagent_type || 'general-purpose',
            status: 'launched',
          });
        }
        if (message.name === 'Skill') {
          skills.add(message.input?.skill || 'unknown');
        }
      }
    }

    base.tools_used = [...tools];
    if (skills.size > 0) base.skills_invoked = [...skills];
    if (agents.length > 0) base.agents_launched = agents;
  }

  // Extract summary
  if (context.summary) {
    base.transcript_summary = context.summary;
  }

  // Extract turn number
  if (context.turn_number !== undefined) {
    base.turn_number = context.turn_number;
  }

  return base;
}

async function sendEvent(event) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`${SERVER_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[hook] POST failed: ${res.status}`);
    }
  } catch (err) {
    // Silently fail — hooks should not block Claude Code
    console.error(`[hook] Failed to send event: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 2: Test hook script with mock input**

Run: `echo '{"session_id":"test-1","project":"/test","model":"claude-sonnet-4-6","turn_number":1}' | node scripts/hook.js turn_end`
Expected: Server receives event (check server logs or GET /events).

- [ ] **Step 3: Commit**

```bash
git add scripts/hook.js
git commit -m "feat: add Claude Code hook script for event forwarding"
```

---

### Task 6: Svelte App Scaffold and SSE Store

**Files:**
- Create: `web/svelte.config.js`, `web/vite.config.js`, `web/index.html`, `web/src/main.js`, `web/src/App.svelte`, `web/src/lib/sse.js`, `web/src/lib/store.js`

- [ ] **Step 1: Create Vite config**

```js
// web/vite.config.js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

- [ ] **Step 2: Create Svelte config**

```js
// web/svelte.config.js
export default {
  compilerOptions: {
    runes: true,
  },
};
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Observatory</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create main.js**

```js
// web/src/main.js
import App from './App.svelte';

const app = new App({
  target: document.getElementById('app'),
});

export default app;
```

- [ ] **Step 5: Create SSE connection module**

```js
// web/src/lib/sse.js
import { API_BASE } from './constants.js';

export function createSSE(onEvent, onReconnect) {
  let evtSource;
  let reconnectTimer;

  function connect() {
    evtSource = new EventSource(`${API_BASE}/events/sse`);

    evtSource.onmessage = (e) => {
      if (e.data) {
        try {
          const event = JSON.parse(e.data);
          onEvent(event);
        } catch {
          console.warn('[sse] Failed to parse event:', e.data);
        }
      }
    };

    evtSource.onopen = () => {
      if (reconnectTimer) {
        onReconnect();
        reconnectTimer = null;
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
      reconnectTimer = setTimeout(connect, 3000);
    };
  }

  connect();

  return {
    close() {
      evtSource?.close();
      clearTimeout(reconnectTimer);
    },
  };
}

export async function fetchHistory(afterId = 0, limit = 500) {
  const res = await fetch(`${API_BASE}/events/history?after=${afterId}&limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchAllEvents(limit = 200) {
  const res = await fetch(`${API_BASE}/events?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSessions() {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSession(id) {
  const res = await fetch(`${API_BASE}/sessions/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchMemoryFiles() {
  const res = await fetch(`${API_BASE}/memory`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMemoryFile(name) {
  const res = await fetch(`${API_BASE}/memory/${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) return null;
  return res.json();
}
```

- [ ] **Step 6: Create Svelte stores**

```js
// web/src/lib/store.js
import { writable, derived } from 'svelte/store';
import { createSSE, fetchHistory, fetchAllEvents, fetchStats } from './sse.js';

// Events store
export const events = writable([]);
export const connected = writable(false);
export const lastEventId = writable(0);

// Filter state
export const filterType = writable('all');
export const filterSession = writable('all');
export const filterProject = writable('all');
export const filterTimeRange = writable('1h'); // '1h', 'today', 'week', 'all'

// Stats
export const stats = writable(null);

// Filtered events
export const filteredEvents = derived(
  [events, filterType, filterSession, filterProject, filterTimeRange],
  ([$events, $type, $session, $project, $time]) => {
    let result = $events;

    if ($type !== 'all') {
      result = result.filter(e => e.type === $type);
    }
    if ($session !== 'all') {
      result = result.filter(e => e.session_id === $session);
    }
    if ($project !== 'all') {
      result = result.filter(e => e.project === $project);
    }
    if ($time !== 'all') {
      const now = Date.now();
      const cutoff = $time === '1h' ? now - 3600000
        : $time === 'today' ? new Date().setHours(0, 0, 0, 0)
        : now - 7 * 86400000;
      result = result.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    }

    return result;
  }
);

// Unique session IDs and projects (for filter dropdowns)
export const sessionIds = derived(events, ($events) => {
  const set = new Set($events.map(e => e.session_id));
  return [...set].sort();
});

export const projects = derived(events, ($events) => {
  const set = new Set($events.map(e => e.project));
  return [...set].sort();
});

// Initialize SSE connection
export function initSSE() {
  // Fetch existing history first
  fetchAllEvents(500).then((history) => {
    events.set(history);
    if (history.length > 0) {
      lastEventId.set(history[history.length - 1].id);
    }
  });

  fetchStats().then((s) => {
    if (s) stats.set(s);
  });

  // Connect SSE
  const { close } = createSSE(
    (event) => {
      events.update(list => [...list, event]);
      lastEventId.set(event.id);
      // Refresh stats periodically
      fetchStats().then((s) => {
        if (s) stats.set(s);
      });
    },
    () => {
      // On reconnect, fetch missed events
      lastEventId.update((id) => {
        fetchHistory(id).then((newEvents) => {
          if (newEvents.length > 0) {
            events.update(list => [...list, ...newEvents]);
          }
        });
        return id;
      });
    }
  );

  connected.set(true);
  return { close };
}
```

- [ ] **Step 7: Create basic App shell**

```svelte
<!-- web/src/App.svelte -->
<script>
  import { onMount } from 'svelte';
  import { initSSE, connected } from '$lib/store.js';
  import { EVENT_TYPES } from '$lib/constants.js';
  import '../styles/global.css';

  let sse;
  onMount(() => {
    sse = initSSE();
    return () => sse?.close();
  });

  let currentView = 'live-feed';

  const views = [
    { id: 'live-feed', label: 'Live Feed' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'memory', label: 'Memory' },
    { id: 'agents', label: 'Agents' },
    { id: 'skills', label: 'Skills' },
    { id: 'cost', label: 'Cost' },
    { id: 'sessions', label: 'Sessions' },
  ];
</script>

<div class="app">
  <header class="header">
    <h1>Observatory</h1>
    <div class="status">
      <span class="dot" class:active={$connected}></span>
      <span>{$connected ? 'Connected' : 'Disconnected'}</span>
    </div>
    <nav>
      {#each views as view}
        <button class:active={currentView === view.id} on:click={() => currentView = view.id}>
          {view.label}
        </button>
      {/each}
    </nav>
  </header>
  <main class="content">
    <!-- Views will be added here -->
    <p>Select a view to get started.</p>
  </main>
</div>

<style>
  .app { min-height: 100vh; display: flex; flex-direction: column; }
  .header {
    display: flex; align-items: center; gap: 16px; padding: 12px 20px;
    background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);
  }
  .header h1 { font-size: 16px; font-weight: 600; color: var(--accent); }
  .status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); }
  .dot.active { background: var(--green); }
  nav { display: flex; gap: 4px; margin-left: auto; }
  nav button {
    padding: 6px 12px; border: none; border-radius: var(--radius);
    background: transparent; color: var(--text-secondary); cursor: pointer;
    font-size: 13px; transition: all 0.15s;
  }
  nav button:hover { background: var(--bg-tertiary); color: var(--text-primary); }
  nav button.active { background: var(--accent); color: var(--bg-primary); }
  .content { flex: 1; padding: 20px; overflow: auto; }
</style>
```

- [ ] **Step 8: Test the app loads**

Run: `npm run dev` (starts server + web)
Expected: Vite serves on port 5173, shows "Observatory" header with nav buttons.

- [ ] **Step 9: Commit**

```bash
git add web/svelte.config.js web/vite.config.js web/index.html web/src/
git commit -m "feat: scaffold Svelte app with SSE store and basic shell"
```

---

### Task 7: Shared Components

**Files:**
- Create: `web/src/lib/components/EventCard.svelte`, `web/src/lib/components/EventFilter.svelte`

- [ ] **Step 1: Create EventCard component**

```svelte
<!-- web/src/lib/components/EventCard.svelte -->
<script>
  import { EVENT_TYPES } from '$lib/constants.js';
  import { formatTimestamp } from '$lib/utils.js';

  let { event } = $props();
  let expanded = $state(false);

  const meta = EVENT_TYPES[event.type] || { label: event.type, color: '#888' };
</script>

<div class="event-card">
  <div class="event-header" onclick={() => expanded = !expanded}>
    <span class="event-time">{formatTimestamp(event.timestamp)}</span>
    <span class="event-badge" style="background: {meta.color}20; color: {meta.color}; border-color: {meta.color}40">
      {meta.label}
    </span>
    <span class="event-session">{event.session_id.slice(0, 8)}</span>
    <span class="event-summary">
      {#if event.data?.transcript_summary}
        {event.data.transcript_summary.slice(0, 80)}...
      {/if}
    </span>
    <span class="expand-icon">{expanded ? '▼' : '▶'}</span>
  </div>

  {#if expanded && event.data}
    <div class="event-details">
      {#if event.data.model}
        <div class="detail-row"><span class="label">Model:</span> {event.data.model}</div>
      {/if}
      {#if event.data.turn_number !== undefined}
        <div class="detail-row"><span class="label">Turn:</span> {event.data.turn_number}</div>
      {/if}
      {#if event.data.tokens_used}
        <div class="detail-row">
          <span class="label">Tokens:</span>
          Input: {event.data.tokens_used.input?.toLocaleString()} | Output: {event.data.tokens_used.output?.toLocaleString()}
        </div>
      {/if}
      {#if event.data.tools_used?.length}
        <div class="detail-row"><span class="label">Tools:</span> {event.data.tools_used.join(', ')}</div>
      {/if}
      {#if event.data.skills_invoked?.length}
        <div class="detail-row"><span class="label">Skills:</span> {event.data.skills_invoked.join(', ')}</div>
      {/if}
      {#if event.data.agents_launched?.length}
        <div class="detail-row">
          <span class="label">Agents:</span>
          {#each event.data.agents_launched as agent}
            {agent.name} ({agent.type})
          {/each}
        </div>
      {/if}
      {#if event.data.memory_accessed}
        {#if event.data.memory_accessed.read?.length}
          <div class="detail-row"><span class="label">Memory Read:</span> {event.data.memory_accessed.read.join(', ')}</div>
        {/if}
        {#if event.data.memory_accessed.written?.length}
          <div class="detail-row"><span class="label">Memory Written:</span> {event.data.memory_accessed.written.join(', ')}</div>
        {/if}
      {/if}
      {#if event.data.transcript_summary}
        <div class="detail-row"><span class="label">Summary:</span> {event.data.transcript_summary}</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .event-card {
    border: 1px solid var(--border-color); border-radius: var(--radius);
    margin-bottom: 4px; background: var(--bg-secondary);
  }
  .event-header {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    cursor: pointer; font-size: 13px;
  }
  .event-header:hover { background: var(--bg-tertiary); }
  .event-time { font-family: var(--font-mono); color: var(--text-muted); min-width: 70px; }
  .event-badge {
    padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;
  }
  .event-session { font-family: var(--font-mono); color: var(--text-secondary); font-size: 12px; }
  .event-summary { color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .expand-icon { color: var(--text-muted); font-size: 10px; }
  .event-details {
    padding: 8px 12px 12px; border-top: 1px solid var(--border-color);
    font-size: 12px; color: var(--text-secondary);
  }
  .detail-row { margin: 4px 0; }
  .label { color: var(--text-muted); font-weight: 500; margin-right: 6px; }
</style>
```

- [ ] **Step 2: Create EventFilter component**

```svelte
<!-- web/src/lib/components/EventFilter.svelte -->
<script>
  import { filterType, filterSession, filterProject, filterTimeRange, sessionIds, projects, events } from '$lib/store.js';
  import { EVENT_TYPES } from '$lib/constants.js';

  const timeOptions = [
    { value: '1h', label: 'Last Hour' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'all', label: 'All' },
  ];
</script>

<div class="filter-bar">
  <div class="filter-group">
    <label>Type</label>
    <select bind:value={$filterType}>
      <option value="all">All Types</option>
      {#each Object.entries(EVENT_TYPES) as [key, val]}
        <option value={key}>{val.label}</option>
      {/each}
    </select>
  </div>

  <div class="filter-group">
    <label>Session</label>
    <select bind:value={$filterSession}>
      <option value="all">All Sessions</option>
      {#each $sessionIds as id}
        <option value={id}>{id.slice(0, 8)}</option>
      {/each}
    </select>
  </div>

  <div class="filter-group">
    <label>Project</label>
    <select bind:value={$filterProject}>
      <option value="all">All Projects</option>
      {#each $projects as project}
        <option value={project}>{project.split('/').pop()}</option>
      {/each}
    </select>
  </div>

  <div class="filter-group">
    <label>Time</label>
    <div class="btn-group">
      {#each timeOptions as opt}
        <button class:active={$filterTimeRange === opt.value} on:click={() => $filterTimeRange = opt.value}>
          {opt.label}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .filter-bar {
    display: flex; gap: 16px; padding: 12px 16px;
    background: var(--bg-secondary); border: 1px solid var(--border-color);
    border-radius: var(--radius); margin-bottom: 16px; flex-wrap: wrap; align-items: flex-end;
  }
  .filter-group { display: flex; flex-direction: column; gap: 4px; }
  .filter-group label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
  select {
    padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px;
    background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px;
  }
  .btn-group { display: flex; gap: 2px; }
  .btn-group button {
    padding: 4px 10px; border: 1px solid var(--border-color); border-radius: 4px;
    background: var(--bg-tertiary); color: var(--text-secondary); cursor: pointer; font-size: 12px;
  }
  .btn-group button.active { background: var(--accent); color: var(--bg-primary); border-color: var(--accent); }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/components/EventCard.svelte web/src/lib/components/EventFilter.svelte
git commit -m "feat: add EventCard and EventFilter shared components"
```

---

### Task 8: Live Feed View

**Files:**
- Create: `web/src/views/LiveFeed.svelte`
- Modify: `web/src/App.svelte` (wire up view)

- [ ] **Step 1: Create LiveFeed view**

```svelte
<!-- web/src/views/LiveFeed.svelte -->
<script>
  import { filteredEvents } from '$lib/store.js';
  import EventCard from '$lib/components/EventCard.svelte';
  import EventFilter from '$lib/components/EventFilter.svelte';

  let container;
  let autoScroll = $state(true);

  $effect(() => {
    if (autoScroll && container) {
      container.scrollTop = container.scrollHeight;
    }
  });

  function onScroll() {
    if (!container) return;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    autoScroll = atBottom;
  }
</script>

<EventFilter />

<div class="feed-header">
  <span>{$filteredEvents.length} events</span>
  <label class="auto-scroll-toggle">
    <input type="checkbox" bind:checked={autoScroll}> Auto-scroll
  </label>
</div>

<div class="feed-container" bind:this={container} onscroll={onScroll}>
  {#each $filteredEvents as event (event.id)}
    <EventCard {event} />
  {/each}

  {#if $filteredEvents.length === 0}
    <div class="empty-state">
      <p>No events yet. Start a Claude Code session to see activity.</p>
    </div>
  {/if}
</div>

<style>
  .feed-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 12px; font-size: 13px; color: var(--text-secondary);
  }
  .auto-scroll-toggle { font-size: 12px; color: var(--text-muted); cursor: pointer; }
  .feed-container { max-height: calc(100vh - 200px); overflow-y: auto; }
  .empty-state {
    display: flex; align-items: center; justify-content: center;
    min-height: 300px; color: var(--text-muted); text-align: center;
  }
</style>
```

- [ ] **Step 2: Wire into App.svelte**

In `web/src/App.svelte`, replace the placeholder content in `<main class="content">`:

```svelte
  <main class="content">
    {#if currentView === 'live-feed'}
      <LiveFeed />
    {:else if currentView === 'timeline'}
      <p>Timeline view — coming soon</p>
    {:else if currentView === 'memory'}
      <p>Memory view — coming soon</p>
    {:else if currentView === 'agents'}
      <p>Agents view — coming soon</p>
    {:else if currentView === 'skills'}
      <p>Skills view — coming soon</p>
    {:else if currentView === 'cost'}
      <p>Cost view — coming soon</p>
    {:else if currentView === 'sessions'}
      <p>Sessions view — coming soon</p>
    {/if}
  </main>
```

Add the import at the top:
```svelte
  import LiveFeed from '$views/LiveFeed.svelte';
```

- [ ] **Step 3: Test**

Run: `npm run dev`
Expected: Live Feed view shows, filters work, auto-scroll works. Send a test event via `curl -X POST http://localhost:3456/events -H 'Content-Type: application/json' -d '{"type":"turn_end","session_id":"test","timestamp":"2026-04-17T10:00:00Z","project":"/test","data":{"turn_number":1,"model":"claude-sonnet-4-6","tokens_used":{"input":1000,"output":500},"tools_used":["Read"],"skills_invoked":["superpowers:brainstorming"],"transcript_summary":"Test event"}}'`

- [ ] **Step 4: Commit**

```bash
git add web/src/views/LiveFeed.svelte web/src/App.svelte
git commit -m "feat: implement Live Feed view with auto-scroll and filters"
```

---

### Task 9: Session Timeline View

**Files:**
- Create: `web/src/views/SessionTimeline.svelte`, `web/src/lib/components/TimelineNode.svelte`

- [ ] **Step 1: Create TimelineNode component**

```svelte
<!-- web/src/lib/components/TimelineNode.svelte -->
<script>
  import { formatTimestamp } from '$lib/utils.js';
  import { EVENT_TYPES } from '$lib/constants.js';

  let { event } = $props();
  let expanded = $state(false);

  const meta = EVENT_TYPES[event.type] || { label: event.type, color: '#888' };
</script>

<div class="timeline-node">
  <div class="node-dot" style="background: {meta.color}; border-color: {meta.color}40" onclick={() => expanded = !expanded}></div>
  <div class="node-content" onclick={() => expanded = !expanded}>
    <div class="node-header">
      <span class="node-time">{formatTimestamp(event.timestamp)}</span>
      <span class="node-label">{meta.label}</span>
      {#if event.data?.turn_number !== undefined}
        <span class="node-turn">Turn {event.data.turn_number}</span>
      {/if}
    </div>
    {#if event.data?.transcript_summary}
      <p class="node-summary">{event.data.transcript_summary.slice(0, 100)}</p>
    {/if}
  </div>

  {#if expanded && event.data}
    <div class="node-details">
      {#if event.data.tools_used?.length}
        <div class="detail-section">
          <h4>Tools</h4>
          <div class="tag-list">
            {#each event.data.tools_used as tool}
              <span class="tag">{tool}</span>
            {/each}
          </div>
        </div>
      {/if}
      {#if event.data.skills_invoked?.length}
        <div class="detail-section">
          <h4>Skills</h4>
          <div class="tag-list">
            {#each event.data.skills_invoked as skill}
              <span class="tag skill-tag">{skill}</span>
            {/each}
          </div>
        </div>
      {/if}
      {#if event.data.agents_launched?.length}
        <div class="detail-section">
          <h4>Agents</h4>
          {#each event.data.agents_launched as agent}
            <span class="tag agent-tag">{agent.name} — {agent.type}</span>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .timeline-node { display: flex; gap: 12px; position: relative; }
  .timeline-node::before {
    content: ''; position: absolute; left: 11px; top: 24px; bottom: -4px;
    width: 2px; background: var(--border-color);
  }
  .timeline-node:last-child::before { display: none; }
  .node-dot {
    width: 24px; height: 24px; border-radius: 50%; border: 3px solid;
    cursor: pointer; flex-shrink: 0; margin-top: 4px; position: relative; z-index: 1;
  }
  .node-content { cursor: pointer; flex: 1; }
  .node-header { display: flex; align-items: center; gap: 8px; }
  .node-time { font-family: var(--font-mono); color: var(--text-muted); font-size: 12px; }
  .node-label { font-size: 13px; color: var(--text-primary); }
  .node-turn { font-size: 11px; color: var(--text-muted); background: var(--bg-tertiary); padding: 1px 6px; border-radius: 3px; }
  .node-summary { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
  .node-details { margin-top: 8px; padding: 8px 12px; background: var(--bg-tertiary); border-radius: var(--radius); }
  .detail-section h4 { font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
  .tag-list { display: flex; gap: 4px; flex-wrap: wrap; }
  .tag { padding: 2px 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 3px; font-size: 11px; font-family: var(--font-mono); }
  .skill-tag { border-color: var(--purple); color: var(--purple); }
  .agent-tag { border-color: var(--green); color: var(--green); }
</style>
```

- [ ] **Step 2: Create SessionTimeline view**

```svelte
<!-- web/src/views/SessionTimeline.svelte -->
<script>
  import { filteredEvents, sessionIds } from '$lib/store.js';
  import TimelineNode from '$lib/components/TimelineNode.svelte';

  let selectedSession = $state('all');

  $derived(timelineEvents = $filteredEvents
    .filter(e => selectedSession === 'all' || e.session_id === selectedSession)
    .filter(e => e.type === 'turn_end')
    .sort((a, b) => a.id - b.id)
  );
</script>

<div class="timeline-view">
  <h2>Session Timeline</h2>

  <div class="session-selector">
    <label>Select Session:</label>
    <select bind:value={selectedSession}>
      <option value="all">All Sessions</option>
      {#each $sessionIds as id}
        <option value={id}>{id.slice(0, 8)}</option>
      {/each}
    </select>
  </div>

  <div class="timeline">
    {#each timelineEvents as event (event.id)}
      <TimelineNode {event} />
    {/each}

    {#if timelineEvents.length === 0}
      <div class="empty-state">
        <p>No turn events found for this session.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .timeline-view h2 { font-size: 16px; margin-bottom: 12px; }
  .session-selector { margin-bottom: 16px; display: flex; gap: 8px; align-items: center; }
  .session-selector label { font-size: 13px; color: var(--text-secondary); }
  select {
    padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px;
    background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px;
  }
  .timeline { max-height: calc(100vh - 250px); overflow-y: auto; }
  .empty-state { text-align: center; color: var(--text-muted); padding: 60px 0; }
</style>
```

- [ ] **Step 3: Wire into App.svelte**

Add import: `import SessionTimeline from '$views/SessionTimeline.svelte';`
Replace timeline placeholder: `<SessionTimeline />`

- [ ] **Step 4: Commit**

```bash
git add web/src/views/SessionTimeline.svelte web/src/lib/components/TimelineNode.svelte web/src/App.svelte
git commit -m "feat: implement Session Timeline view"
```

---

### Task 10: Memory Inspector View

**Files:**
- Create: `web/src/views/MemoryInspector.svelte`

- [ ] **Step 1: Create MemoryInspector view**

```svelte
<!-- web/src/views/MemoryInspector.svelte -->
<script>
  import { onMount } from 'svelte';
  import { fetchMemoryFiles, fetchMemoryFile } from '$lib/sse.js';
  import { formatTimestamp, formatFileSize } from '$lib/utils.js';

  let files = $state([]);
  let selectedFile = $state(null);
  let fileContent = $state(null);

  onMount(async () => {
    files = await fetchMemoryFiles();
  });

  async function openFile(file) {
    selectedFile = file;
    fileContent = await fetchMemoryFile(file.name);
  }
</script>

<div class="memory-view">
  <h2>Memory Inspector</h2>

  <div class="memory-layout">
    <div class="file-list">
      {#each files as file}
        <div class="file-item" class:active={selectedFile?.name === file.name} onclick={() => openFile(file)}>
          <div class="file-name">{file.name}</div>
          <div class="file-meta">
            <span>{formatFileSize(file.size)}</span>
            <span>{formatTimestamp(file.modified)}</span>
            <span>{file.source}</span>
          </div>
        </div>
      {/each}

      {#if files.length === 0}
        <div class="empty-state">
          <p>No memory files found.</p>
        </div>
      {/if}
    </div>

    {#if selectedFile}
      <div class="file-content">
        <div class="content-header">
          <h3>{selectedFile.name}</h3>
          <button on:click={() => { selectedFile = null; fileContent = null; }}>Close</button>
        </div>
        {#if fileContent?.content}
          <pre>{fileContent.content}</pre>
        {:else}
          <p>Loading...</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .memory-view h2 { font-size: 16px; margin-bottom: 12px; }
  .memory-layout { display: flex; gap: 16px; height: calc(100vh - 200px); }
  .file-list { width: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius); }
  .file-item { padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--border-color); }
  .file-item:hover { background: var(--bg-tertiary); }
  .file-item.active { background: var(--bg-tertiary); border-left: 3px solid var(--accent); }
  .file-name { font-size: 13px; color: var(--text-primary); font-weight: 500; }
  .file-meta { display: flex; gap: 8px; font-size: 11px; color: var(--text-muted); margin-top: 4px; }
  .file-content { flex: 1; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius); padding: 16px; }
  .content-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .content-header h3 { font-size: 14px; }
  .content-header button {
    padding: 4px 12px; border: 1px solid var(--border-color); border-radius: 4px;
    background: var(--bg-tertiary); color: var(--text-secondary); cursor: pointer;
  }
  pre {
    white-space: pre-wrap; word-break: break-word; font-family: var(--font-mono);
    font-size: 13px; color: var(--text-secondary); line-height: 1.6;
  }
  .empty-state { padding: 40px; text-align: center; color: var(--text-muted); }
</style>
```

- [ ] **Step 2: Wire into App.svelte**

Add import and replace placeholder.

- [ ] **Step 3: Commit**

```bash
git add web/src/views/MemoryInspector.svelte web/src/App.svelte
git commit -m "feat: implement Memory Inspector view"
```

---

### Task 11: Agent Chain View

**Files:**
- Create: `web/src/views/AgentChain.svelte`, `web/src/lib/components/AgentNode.svelte`

- [ ] **Step 1: Create AgentNode component**

```svelte
<!-- web/src/lib/components/AgentNode.svelte -->
<script>
  let { agent, depth = 0 } = $props();
  let expanded = $state(true);

  const indent = depth * 24;
</script>

<div class="agent-node" style="margin-left: {indent}px">
  <div class="agent-header" onclick={() => expanded = !expanded}>
    <span class="agent-expand">{expanded ? '▼' : '▶'}</span>
    <span class="agent-name">{agent.name}</span>
    <span class="agent-type">{agent.type}</span>
    <span class="agent-status" class:completed={agent.status === 'completed'}>{agent.status}</span>
  </div>
  {#if expanded && agent.children?.length}
    <div class="agent-children">
      {#each agent.children as child}
        <AgentNode agent={child} depth={depth + 1} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .agent-node { border-left: 2px solid var(--border-color); padding-left: 12px; margin-top: 8px; }
  .agent-header {
    display: flex; align-items: center; gap: 8px; padding: 6px 10px;
    background: var(--bg-secondary); border-radius: var(--radius); cursor: pointer;
  }
  .agent-header:hover { background: var(--bg-tertiary); }
  .agent-expand { color: var(--text-muted); font-size: 10px; width: 12px; }
  .agent-name { font-weight: 600; color: var(--text-primary); font-size: 13px; }
  .agent-type { color: var(--text-muted); font-size: 12px; font-family: var(--font-mono); }
  .agent-status {
    margin-left: auto; font-size: 11px; padding: 2px 8px; border-radius: 10px;
    background: var(--bg-tertiary); color: var(--yellow);
  }
  .agent-status.completed { background: #22c55e20; color: var(--green); }
  .agent-children { margin-top: 4px; }
</style>
```

- [ ] **Step 2: Create AgentChain view**

```svelte
<!-- web/src/views/AgentChain.svelte -->
<script>
  import { filteredEvents } from '$lib/store.js';

  $derived(agentTree = buildAgentTree($filteredEvents));

  function buildAgentTree(events) {
    const agents = [];
    const agentMap = new Map();

    for (const e of events) {
      if (e.type === 'agent_start' && e.data?.agents_launched) {
        for (const a of e.data.agents_launched) {
          const node = { ...a, children: [], parent_id: null };
          agentMap.set(`${e.session_id}-${a.name}`, node);
          agents.push(node);
        }
      }
      if (e.type === 'agent_end') {
        for (const a of (e.data?.agents_launched || [])) {
          const key = `${e.session_id}-${a.name}`;
          const node = agentMap.get(key);
          if (node) node.status = a.status || 'completed';
        }
      }
    }

    return agents.filter(a => !a.parent_id);
  }
</script>

<div class="agent-view">
  <h2>Agent Chain Viewer</h2>

  {#if agentTree.length > 0}
    <div class="agent-tree">
      {#each agentTree as agent}
        <AgentNode {agent} />
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <p>No agent delegations found in current events.</p>
    </div>
  {/if}
</div>

<style>
  .agent-view h2 { font-size: 16px; margin-bottom: 12px; }
  .agent-tree { max-height: calc(100vh - 200px); overflow-y: auto; padding: 12px; }
  .empty-state { text-align: center; color: var(--text-muted); padding: 60px 0; }
</style>
```

- [ ] **Step 3: Wire into App.svelte, commit**

```bash
git add web/src/views/AgentChain.svelte web/src/lib/components/AgentNode.svelte web/src/App.svelte
git commit -m "feat: implement Agent Chain Viewer"
```

---

### Task 12: Skills Stats View

**Files:**
- Create: `web/src/views/SkillsStats.svelte`, `web/src/lib/components/BarChart.svelte`

- [ ] **Step 1: Create BarChart component**

```svelte
<!-- web/src/lib/components/BarChart.svelte -->
<script>
  let { data = [], height = 200, color = '#58a6ff' } = $props();

  $derived(maxVal = Math.max(...data.map(d => d.value), 1));
  const barWidth = 40;
  const gap = 8;
  const chartWidth = data.length * (barWidth + gap) + gap;

  function shortenLabel(label) {
    const parts = label.split(':');
    return parts[parts.length - 1];
  }
</script>

<svg width="100%" height={height} viewBox={`0 0 ${Math.max(chartWidth, 300)} ${height}`}>
  {#each data as d, i}
    {#const barHeight = (d.value / maxVal) * (height - 40)}
    <rect
      x={gap + i * (barWidth + gap)}
      y={height - 20 - barHeight}
      width={barWidth}
      height={barHeight}
      fill={color}
      rx="3"
    />
    <text
      x={gap + i * (barWidth + gap) + barWidth / 2}
      y={height - 4}
      text-anchor="middle"
      fill="var(--text-muted)"
      font-size="10"
      font-family="var(--font-mono)"
    >
      {shortenLabel(d.label)}
    </text>
    <text
      x={gap + i * (barWidth + gap) + barWidth / 2}
      y={height - 26 - barHeight}
      text-anchor="middle"
      fill="var(--text-secondary)"
      font-size="11"
    >
      {d.value}
    </text>
  {/each}
</svg>
```

- [ ] **Step 2: Create LineChart component**

```svelte
<!-- web/src/lib/components/LineChart.svelte -->
<script>
  let { data = [], height = 200, lines = [{ key: 'input', color: '#58a6ff', label: 'Input' }, { key: 'output', color: '#3fb950', label: 'Output' }] } = $props();

  $derived(maxVal = Math.max(...data.flatMap(d => lines.map(l => d[l.key] || 0)), 1));
  const width = 500;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  function pointX(i) { return padding.left + (i / Math.max(data.length - 1, 1)) * chartW; }
  function pointY(val) { return padding.top + chartH - (val / maxVal) * chartH; }

  function pathData(key) {
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${pointX(i)} ${pointY(d[key] || 0)}`).join(' ');
  }
</script>

<svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
  <!-- Y axis labels -->
  {#each [0, 0.25, 0.5, 0.75, 1] as factor}
    {#const val = Math.round(maxVal * factor)}
    <text x={padding.left - 8} y={pointY(val) + 4} text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)">
      {val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val}
    </text>
  {/each}

  <!-- X axis labels -->
  {#each data as d, i}
    {#if i % Math.max(1, Math.floor(data.length / 7)) === 0 || i === data.length - 1}
      <text x={pointX(i)} y={height - 4} text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-mono)">
        {d.date?.slice(5)}
      </text>
    {/if}
  {/each}

  <!-- Lines -->
  {#each lines as line}
    <path d={pathData(line.key)} fill="none" stroke={line.color} stroke-width="2" />
  {/each}

  <!-- Legend -->
  {#each lines as line, i}
    <rect x={padding.left + i * 80} y={4} width="10" height="10" fill={line.color} rx="2" />
    <text x={padding.left + i * 80 + 14} y={13} fill="var(--text-secondary)" font-size="11">{line.label}</text>
  {/each}
</svg>
```

- [ ] **Step 3: Create SkillsStats view**

```svelte
<!-- web/src/views/SkillsStats.svelte -->
<script>
  import { stats } from '$lib/store.js';

  $derived(skillData = Object.entries($stats?.skill_counts || {})
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
  );

  $derived(toolData = Object.entries($stats?.tool_counts || {})
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
  );
</script>

<div class="skills-view">
  <h2>Skills Usage</h2>

  {#if skillData.length > 0}
    <div class="charts">
      <div class="chart-card">
        <h3>Skills</h3>
        <BarChart data={skillData} color="#bc8cff" />
      </div>
      <div class="chart-card">
        <h3>Tools</h3>
        <BarChart data={toolData} color="#58a6ff" />
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>No skill or tool usage data yet.</p>
    </div>
  {/if}
</div>

<style>
  .skills-view h2 { font-size: 16px; margin-bottom: 12px; }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .chart-card {
    background: var(--bg-secondary); border: 1px solid var(--border-color);
    border-radius: var(--radius); padding: 16px;
  }
  .chart-card h3 { font-size: 14px; margin-bottom: 12px; color: var(--text-secondary); }
  .empty-state { text-align: center; color: var(--text-muted); padding: 60px 0; }
</style>
```

- [ ] **Step 4: Wire into App.svelte, commit**

```bash
git add web/src/views/SkillsStats.svelte web/src/lib/components/BarChart.svelte web/src/lib/components/LineChart.svelte web/src/App.svelte
git commit -m "feat: implement Skills Usage Stats view with SVG charts"
```

---

### Task 13: Cost Analytics View

**Files:**
- Create: `web/src/views/CostAnalytics.svelte`

- [ ] **Step 1: Create CostAnalytics view**

```svelte
<!-- web/src/views/CostAnalytics.svelte -->
<script>
  import { stats, events } from '$lib/store.js';
  import { formatTokenCount, formatCost, calculateCost } from '$lib/utils.js';
  import BarChart from '$lib/components/BarChart.svelte';
  import LineChart from '$lib/components/LineChart.svelte';

  $derived(totalInput = $stats?.total_input_tokens || 0);
  $derived(totalOutput = $stats?.total_output_tokens || 0);
  $derived(totalTokens = totalInput + totalOutput);
  $derived(totalCost = calculateCost('claude-sonnet-4-6', totalInput, totalOutput));

  $derived(modelData = Object.entries($stats?.model_usage || {})
    .map(([label, value]) => ({ label, value }))
  );

  $derived(dailyData = Object.entries($stats?.daily_tokens || {})
    .map(([date, vals]) => ({ date, input: vals.input, output: vals.output }))
    .sort((a, b) => a.date.localeCompare(b.date))
  );

  $derived(sessionCostData = Object.entries($stats?.session_costs || {})
    .map(([session, cost]) => ({ label: session.slice(0, 8), value: cost }))
    .sort((a, b) => b.value - a.value)
  );
</script>

<div class="cost-view">
  <h2>Cost & Token Analytics</h2>

  <div class="summary-cards">
    <div class="card">
      <div class="card-label">Total Tokens</div>
      <div class="card-value">{formatTokenCount(totalTokens)}</div>
    </div>
    <div class="card">
      <div class="card-label">Input Tokens</div>
      <div class="card-value">{formatTokenCount(totalInput)}</div>
    </div>
    <div class="card">
      <div class="card-label">Output Tokens</div>
      <div class="card-value">{formatTokenCount(totalOutput)}</div>
    </div>
    <div class="card">
      <div class="card-label">Est. Cost</div>
      <div class="card-value">{formatCost(totalCost)}</div>
    </div>
  </div>

  {#if dailyData.length > 0}
    <div class="charts">
      <div class="chart-card">
        <h3>Daily Token Usage</h3>
        <LineChart data={dailyData} />
      </div>
      <div class="chart-card">
        <h3>Model Distribution</h3>
        <BarChart data={modelData} color="#d29922" />
      </div>
    </div>
  {/if}

  {#if sessionCostData.length > 0}
    <div class="chart-card" style="margin-top: 16px">
      <h3>Cost per Session</h3>
      <BarChart data={sessionCostData} color="#3fb950" />
    </div>
  {/if}
</div>

<style>
  .cost-view h2 { font-size: 16px; margin-bottom: 12px; }
  .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .card {
    background: var(--bg-secondary); border: 1px solid var(--border-color);
    border-radius: var(--radius); padding: 16px; text-align: center;
  }
  .card-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .card-value { font-size: 24px; font-weight: 700; color: var(--accent); margin-top: 8px; font-family: var(--font-mono); }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .chart-card {
    background: var(--bg-secondary); border: 1px solid var(--border-color);
    border-radius: var(--radius); padding: 16px;
  }
  .chart-card h3 { font-size: 14px; margin-bottom: 12px; color: var(--text-secondary); }
</style>
```

- [ ] **Step 2: Wire into App.svelte, commit**

```bash
git add web/src/views/CostAnalytics.svelte web/src/App.svelte
git commit -m "feat: implement Cost & Token Analytics view"
```

---

### Task 14: Multi-Session Overview

**Files:**
- Create: `web/src/views/MultiSession.svelte`

- [ ] **Step 1: Create MultiSession view**

```svelte
<!-- web/src/views/MultiSession.svelte -->
<script>
  import { onMount } from 'svelte';
  import { fetchSessions } from '$lib/sse.js';
  import { formatTimestamp, formatTokenCount, formatCost, formatDuration } from '$lib/utils.js';
  import { events } from '$lib/store.js';

  let sessions = $state([]);

  onMount(async () => {
    sessions = await fetchSessions();
  });

  $derived(activeSessions = sessions.filter(s => s.status === 'active'));
  $derived(endedSessions = sessions.filter(s => s.status === 'ended'));

  function getSessionCost(session) {
    return formatCost(((session.total_input_tokens / 1e6) * 3.0) + ((session.total_output_tokens / 1e6) * 15.0));
  }

  function getSessionDuration(session) {
    if (!session.ended_at) return 'ongoing';
    const ms = new Date(session.ended_at) - new Date(session.started_at);
    return formatDuration(ms / 1000);
  }
</script>

<div class="sessions-view">
  <h2>Session Overview</h2>

  <div class="summary-bar">
    <span class="stat">{sessions.length} total sessions</span>
    <span class="stat active-count">{activeSessions.length} active</span>
    <span class="stat">{endedSessions.length} completed</span>
  </div>

  <div class="session-grid">
    {#each sessions as session}
      <div class="session-card" class:active={session.status === 'active'}>
        <div class="session-header">
          <span class="session-id">{session.id.slice(0, 8)}</span>
          <span class="session-status" class:active={session.status === 'active'}>{session.status}</span>
        </div>
        <div class="session-info">
          <div><span class="info-label">Project:</span> {session.project.split('/').pop()}</div>
          <div><span class="info-label">Started:</span> {formatTimestamp(session.started_at)}</div>
          <div><span class="info-label">Duration:</span> {getSessionDuration(session)}</div>
          <div><span class="info-label">Turns:</span> {session.turn_count}</div>
          <div><span class="info-label">Tokens:</span> {formatTokenCount(session.total_input_tokens + session.total_output_tokens)}</div>
          <div><span class="info-label">Est. Cost:</span> {getSessionCost(session)}</div>
        </div>
      </div>
    {/each}

    {#if sessions.length === 0}
      <div class="empty-state">
        <p>No sessions recorded yet.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .sessions-view h2 { font-size: 16px; margin-bottom: 12px; }
  .summary-bar { display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); }
  .active-count { color: var(--green); }
  .session-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .session-card {
    background: var(--bg-secondary); border: 1px solid var(--border-color);
    border-radius: var(--radius); padding: 16px;
  }
  .session-card.active { border-color: var(--green); }
  .session-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .session-id { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); }
  .session-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--bg-tertiary); color: var(--text-muted); }
  .session-status.active { background: #22c55e20; color: var(--green); }
  .session-info { font-size: 12px; color: var(--text-secondary); }
  .session-info div { margin: 4px 0; }
  .info-label { color: var(--text-muted); margin-right: 6px; }
  .empty-state { text-align: center; color: var(--text-muted); padding: 60px 0; grid-column: 1 / -1; }
</style>
```

- [ ] **Step 2: Wire into App.svelte, commit**

```bash
git add web/src/views/MultiSession.svelte web/src/App.svelte
git commit -m "feat: implement Multi-Session Overview view"
```

---

### Task 15: Final Integration and Polish

**Files:**
- Modify: `web/src/App.svelte` (final wiring)

- [ ] **Step 1: Complete App.svelte with all imports**

Ensure all 7 views are imported and wired:

```svelte
<!-- web/src/App.svelte -->
<script>
  import { onMount } from 'svelte';
  import { initSSE, connected } from '$lib/store.js';
  import '../styles/global.css';
  import LiveFeed from '$views/LiveFeed.svelte';
  import SessionTimeline from '$views/SessionTimeline.svelte';
  import MemoryInspector from '$views/MemoryInspector.svelte';
  import AgentChain from '$views/AgentChain.svelte';
  import SkillsStats from '$views/SkillsStats.svelte';
  import CostAnalytics from '$views/CostAnalytics.svelte';
  import MultiSession from '$views/MultiSession.svelte';

  let sse;
  onMount(() => {
    sse = initSSE();
    return () => sse?.close();
  });

  let currentView = 'live-feed';

  const views = [
    { id: 'live-feed', label: 'Live Feed' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'memory', label: 'Memory' },
    { id: 'agents', label: 'Agents' },
    { id: 'skills', label: 'Skills' },
    { id: 'cost', label: 'Cost' },
    { id: 'sessions', label: 'Sessions' },
  ];
</script>

<div class="app">
  <header class="header">
    <h1>Observatory</h1>
    <div class="status">
      <span class="dot" class:active={$connected}></span>
      <span>{$connected ? 'Connected' : 'Disconnected'}</span>
    </div>
    <nav>
      {#each views as view}
        <button class:active={currentView === view.id} on:click={() => currentView = view.id}>
          {view.label}
        </button>
      {/each}
    </nav>
  </header>
  <main class="content">
    {#if currentView === 'live-feed'}
      <LiveFeed />
    {:else if currentView === 'timeline'}
      <SessionTimeline />
    {:else if currentView === 'memory'}
      <MemoryInspector />
    {:else if currentView === 'agents'}
      <AgentChain />
    {:else if currentView === 'skills'}
      <SkillsStats />
    {:else if currentView === 'cost'}
      <CostAnalytics />
    {:else if currentView === 'sessions'}
      <MultiSession />
    {/if}
  </main>
</div>

<style>
  .app { min-height: 100vh; display: flex; flex-direction: column; }
  .header {
    display: flex; align-items: center; gap: 16px; padding: 12px 20px;
    background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);
  }
  .header h1 { font-size: 16px; font-weight: 600; color: var(--accent); }
  .status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); }
  .dot.active { background: var(--green); }
  nav { display: flex; gap: 4px; margin-left: auto; }
  nav button {
    padding: 6px 12px; border: none; border-radius: var(--radius);
    background: transparent; color: var(--text-secondary); cursor: pointer;
    font-size: 13px; transition: all 0.15s;
  }
  nav button:hover { background: var(--bg-tertiary); color: var(--text-primary); }
  nav button.active { background: var(--accent); color: var(--bg-primary); }
  .content { flex: 1; padding: 20px; overflow: auto; }
</style>
```

- [ ] **Step 2: Full end-to-end test**

Run: `npm run server` in one terminal
Run: `npm run dev:web` in another terminal

Then send test events:
```bash
curl -X POST http://localhost:3456/events -H 'Content-Type: application/json' -d '{"type":"session_start","session_id":"demo-001","timestamp":"2026-04-17T10:00:00Z","project":"/demo/project","data":{}}'
curl -X POST http://localhost:3456/events -H 'Content-Type: application/json' -d '{"type":"turn_end","session_id":"demo-001","timestamp":"2026-04-17T10:01:00Z","project":"/demo/project","data":{"turn_number":1,"model":"claude-sonnet-4-6","tokens_used":{"input":5000,"output":2000},"tools_used":["Read","Bash","Agent"],"skills_invoked":["superpowers:brainstorming"],"agents_launched":[{"name":"Explore","type":"general-purpose","status":"launched"}],"transcript_summary":"User asked about monitoring dashboard"}}'
curl -X POST http://localhost:3456/events -H 'Content-Type: application/json' -d '{"type":"agent_end","session_id":"demo-001","timestamp":"2026-04-17T10:02:00Z","project":"/demo/project","data":{"agents_launched":[{"name":"Explore","type":"general-purpose","status":"completed"}]}}'
```

Verify all 7 views display data correctly.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete observability dashboard with all 7 views"
```

---
