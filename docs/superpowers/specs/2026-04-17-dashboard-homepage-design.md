# Dashboard Homepage — Design Specification

**Date:** 2026-04-17
**Status:** Approved by user

## Overview

A new "Dashboard" view becomes the default homepage for CC Observatory. It replaces the previous Live Feed as the landing page. The dashboard displays real-time metrics in an icon-rich bento grid layout with live SVG charts, animated data points, and auto-refreshing KPI cards.

**Key requirement:** All data updates in real-time via existing SSE connection — no page refresh needed. Charts animate when new data arrives.

## Layout Architecture

The page has three horizontal zones:

### Zone 1: Header Bar
- Logo + title ("CC Observatory — Command Center")
- SSE connection status badge (pulsing green dot when connected)
- Time range selector dropdown (1h / 6h / 24h / 7d)

### Zone 2: KPI Strip (6 cards, equal width)
Each card shows: SVG icon, label, large numeric value, trend indicator (▲/▼ vs previous period), and optional mini sparkline.

| KPI | Color | Icon | Data Source |
|---|---|---|---|
| Total Tokens | Blue (#60a5fa) | Activity/spark | `stats.totalInputTokens + stats.totalOutputTokens` |
| Est. Cost | Green (#4ade80) | Dollar sign | `stats.totalCost` |
| Agent Calls | Purple (#a78bfa) | Grid/agent | `stats.agentCounts` (running + completed) |
| Tool Calls | Yellow (#fbbf24) | Wrench | `stats.toolCounts` (sum of all) |
| Skills Used | Red (#f87171) | Flag | `stats.skillCounts` (sum of all) |
| Errors | Red (#ef4444) | Alert triangle | Filtered from event stream for error indicators |

### Zone 3: Main Grid (4-column layout)
```
+-----------------------------------------+------------------+
| Token & Cost Trend Chart (span 3 cols)  | Agent Activity   |
|                                         |                  |
| SVG area chart with input/output lines  | Agent list with  |
| and animated data points                | status badges    |
+-----------------------------------------+------------------+
| Tool Calls (top)   | Skills (top)       | Event Stream     |
| Tool rows with     | Skill rows with    | (right sidebar   |
| progress bars      | emoji icons        | auto-scrolling)  |
+--------------------+--------------------+------------------+
| Memory (grid)      | Error Inspection   | Session Quick    |
| 6-card memory grid | 2 error list items | Jump cards       |
+--------------------+--------------------+------------------+
| Activity Heatmap   | Model Donut Chart  | Session List     |
+--------------------+--------------------+------------------+
```

### Zone 4: Bottom Strip (3 panels)
- **Event Stream** (wide) — latest 6 events with type-colored badges
- **Session Activity Log** (wide) — memory reads/writes, hook execution times, errors
- **Session Quick Jump** (narrow, right) — clickable session cards with aggregate stats

## Components

### New Components

1. **`KPICard.svelte`** — Reusable KPI card component
   - Props: `icon`, `label`, `value`, `color`, `trend`, `sparklineData`
   - Renders SVG icon, large number, trend arrow with color, mini sparkline

2. **`Sparkline.svelte`** — Mini SVG sparkline chart
   - Props: `data` (array of numbers), `color`, `width`, `height`

3. **`AreaChart.svelte`** — Full-size SVG area chart for token trend
   - Props: `inputData`, `outputData`, `labels`
   - Animated data points (pulsing circles on latest values)
   - Gradient fills under lines

4. **`DonutChart.svelte`** — SVG donut chart for model usage
   - Props: `segments` (array of { label, value, color })
   - Center text showing primary model percentage

5. **`Heatmap.svelte`** — GitHub-style activity heatmap
   - Props: `data` (7x24 matrix of counts)
   - Color scale from dark (#161625) to bright green (#4ade80)

6. **`ProgressBar.svelte`** — Mini horizontal progress bar
   - Props: `value`, `max`, `color`

7. **`AgentRow.svelte`** — Single agent status row
   - Props: `name`, `type`, `status` (running/completed/failed)

### Existing Components (reused)

- `Badge.svelte` — Type badges for events
- `Sidebar.svelte` — Navigation (updated: Dashboard becomes default)

## Data Flow

### Real-time Updates

1. **SSE Connection** — Existing `connectSSE()` in `stores/events.js` handles live event stream
2. **Stats Polling** — Existing `fetchStats()` called every 15 seconds, updated to every 5 seconds for homepage
3. **New API endpoint** — `GET /stats/realtime` for faster, lightweight metric polling (KPI values only, not full breakdown)

### New Server Endpoints

| Endpoint | Purpose | Response |
|---|---|---|
| `GET /stats/realtime` | Lightweight KPI values | `{ totalTokens, totalCost, activeAgents, totalTools, totalSkills, errorCount, modelBreakdown, recentErrors }` |
| `GET /stats/activity` | Heatmap data | `{ data: [[hour1..24], [day2], ...[day7]] }` |
| `GET /errors` | Recent errors | `[{ timestamp, message, type, sessionId }]` |

### Event Processing

When a new SSE event arrives, the dashboard processes it client-side:
- `turn_end` → increment token counters, tool counts, update area chart
- `agent_start` / `agent_end` → update agent list, increment agent count
- Any event with error indicator → add to error inspection panel
- `session_start` / `session_end` → update session list and count

## Color System

Consistent with existing dark theme palette, extended with chart-specific colors:

```
--bg-primary:    #080812  (page background)
--bg-card:       #0f0f1a  (panel/card background)
--bg-hover:      #161625  (hover/secondary bg)
--border:        #1e1e32  (card borders)

--blue:          #60a5fa  (input tokens, primary)
--green:         #4ade80  (cost, success, memory)
--purple:        #a78bfa  (agents, output tokens)
--yellow:        #fbbf24  (tools, warnings)
--red:           #f87171  (skills, errors)
--cyan:          #22d3ee  (sessions, calendar)
--orange:        #fb923c  (warnings alternate)
```

## Animations

All animations use CSS only (no JS animation library):

- **KPI cards** — fade-in on page load with staggered delays
- **Sparkline** — static SVG (data changes on poll)
- **Area chart latest point** — pulse animation (`r` oscillates between 3 and 5)
- **SSE status dot** — continuous pulse (opacity + box-shadow)
- **Card hover** — subtle `translateY(-1px)` + border color change
- **Progress bars** — CSS `transition: width 0.3s`
- **Session cards** — border color transition on hover

## Error Handling

- **SSE disconnect** — status badge turns red, "Disconnected" text
- **Stats API fails** — KPI cards show last known values with "stale" indicator
- **No events** — panels show empty state message with illustration
- **Chart data empty** — area chart shows flat line with "Waiting for data..." text

## Integration with Existing Views

The existing 7 views remain accessible via the sidebar. The Dashboard is now the default (`view = "dashboard"`). The sidebar adds a new "Dashboard" entry at the top:

```
Dashboard (new, default)
────────────────────────
Live Feed
Session Timeline
Memory Inspector
Agent Chain
Skills Usage
Cost & Tokens
Session Overview
```

## Files Changed

### New Files
- `web/src/views/Dashboard.svelte` — Main dashboard component
- `web/src/components/KPICard.svelte`
- `web/src/components/Sparkline.svelte`
- `web/src/components/AreaChart.svelte`
- `web/src/components/DonutChart.svelte`
- `web/src/components/Heatmap.svelte`
- `web/src/components/ProgressBar.svelte`
- `web/src/components/AgentRow.svelte`
- `server/src/routes/realtime.js` — Realtime stats endpoint
- `server/test/realtime.test.js` — Tests for new endpoints

### Modified Files
- `web/src/App.svelte` — Add Dashboard import, set as default view, add to views list
- `web/src/stores/stats.js` — Add realtime polling (5s interval)
- `web/src/app.css` — Add new animation keyframes, update card styles
- `server/src/index.js` — Add realtime routes
