# Sessions Page Redesign

**Goal:** Replace Live Feed and Session Overview with a unified Sessions page featuring aggregate stats, event rate chart, session cards, and expandable timelines. Add a real-time bar chart to Dashboard's Sessions Activity panel.

**Architecture:** Single Sessions view replaces two existing views. Dashboard replaces static session list with a CSS bar chart. A new server endpoint `/stats/events-rate` provides 5-minute bucketed event counts.

**Tech Stack:** Svelte 5, CSS bar charts, Hono.js

---

## Design Details

### 1. Dashboard — Sessions Activity Panel

**Current:** Static list of recent sessions in a `d-panel` with clickable cards.
**New:** A CSS bar chart showing event counts per 5-minute bucket over the last 2 hours (24 bars).

- Bars are rendered with pure CSS flex + height percentages, matching the existing Heatmap style
- Color-coded by event type: `#60a5fa` (blue) for turn_end, `#fbbf24` (gold) for agent events
- Header shows aggregate stats: Active sessions count, total events, total turns
- Entire panel is clickable → navigates to `/sessions` route
- Updates every 5 seconds via the existing polling mechanism

**Data source:** Server endpoint `GET /stats/events-rate` returns `{ buckets: [{ time: "14:30", turnCount: 5, agentCount: 2 }, ...], active: 3 }`.

### 2. Unified Sessions Page (`web/src/views/Sessions.svelte`)

Replaces both `LiveFeed.svelte` and `SessionOverview.svelte`.

#### Section A: Aggregate Stats Bar

Five inline stat boxes at the top:
- Sessions (count, blue)
- Events (count, green)
- Turns (count, gold)
- Tokens (formatted, red)
- Cost (dollar amount, purple)

Data comes from the existing `stats` store (`$stats.totalTurns`, `$stats.totalInputTokens`, etc.) and `sessions` store.

#### Section B: Event Rate Chart

Same bar chart component as Dashboard but wider — shows last 2 hours at 5-minute granularity.
- Y-axis: event count (auto-scaled)
- X-axis: time labels (-2h, -1h, -30m, now)
- Stacked bars: turn_end (blue) + agent events (gold)
- Hover tooltip: exact count per event type for that bucket

#### Section C: Session Cards

Grid of session cards (2 columns on desktop, 1 on mobile):
- Session ID (first 8 chars, monospace)
- Status badge: "active" (green) or "ended" (red)
- Event count, time since last event, unique tool count
- Project name (truncated, monospace)

Active sessions have a `border-left: 2px solid #4ade80`.

#### Section D: Expandable Timeline

Clicking a session card toggles a timeline view below it:
- Left border timeline (`border-left: 2px solid #333`)
- Each event shows: time (HH:MM:SS), type badge (color-coded by event type), tools used
- Events ordered chronologically
- Active sessions have animated "pulse" indicator on the latest event

### 3. Navigation Changes

- **Remove** "Live Feed" from sidebar (route `"live"`)
- **Rename** "Session Overview" → "Sessions" (route `"sessions"`, replacing `"overview"`)
- **Remove** "Session Timeline" from sidebar (already deleted)
- Dashboard KPI "Sessions Active" → navigates to `"sessions"`
- Dashboard "Session Activity" bar chart panel → navigates to `"sessions"`

### 4. Server Changes

**New endpoint: `GET /stats/events-rate`**

Returns event counts bucketed by 5-minute windows for the last 2 hours:

```json
{
  "buckets": [
    { "time": "14:00", "turnCount": 3, "agentCount": 1 },
    { "time": "14:05", "turnCount": 7, "agentCount": 2 },
    ...
  ],
  "active": 3,
  "totalEvents": 121
}
```

Implementation:
- Read `events.jsonl`, filter last 2 hours
- Group by 5-minute bucket (`floor(minute / 5) * 5`)
- Count `turn_end` as `turnCount`, `agent_start`/`agent_end` as `agentCount`
- Active sessions = sessions with `status: "active"` in session store

### 5. Files to Modify

| File | Action |
|------|--------|
| `server/src/routes/stats.js` | Add `/stats/events-rate` endpoint |
| `web/src/views/Sessions.svelte` | **New** — unified sessions page |
| `web/src/views/Dashboard.svelte` | Replace Sessions Activity panel with bar chart |
| `web/src/App.svelte` | Remove Live Feed import/route, rename Session Overview → Sessions, add Sessions import |
| `web/src/router.js` | Remove `"live"`, `"overview"`; add `"sessions"` |
| `web/src/views/LiveFeed.svelte` | **Delete** |
| `web/src/views/SessionOverview.svelte` | **Delete** |
| `web/src/stores/events.js` | No changes needed — existing store suffices |

### 6. Data Flow

```
events.jsonl → POST /events → saved to file
             → GET /stats/events-rate → bucketed 5-min counts → Dashboard chart
             → GET /sessions → session records → Sessions page cards
             → SSE /events/sse → frontend events store → live updates
```

All data comes from existing stores — no new client-side stores needed. The Sessions page reads from `$events`, `$sessions`, and `$stats` stores.
