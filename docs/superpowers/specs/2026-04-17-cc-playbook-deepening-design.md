# CC Playbook Deepening + Sessions Activity Graph — Design Spec

## Overview

Two independent improvements to the Claude Code Observatory dashboard:
1. **CC Playbook**: Transform from static reference tables into interactive guides with live status panels
2. **Sessions Activity**: Move the panel to span 2 columns and replace the bar chart with a responsive area chart

---

## Part A: CC Playbook Interactive Guides

### Current State

`CCPlaybook.svelte` renders 6 static HTML tables:
- Quick Start, High-Frequency Tips, Development Patterns, Tools & Skills, Config Reference, Common Pitfalls

All content is hardcoded. No interactivity. No live data.

### Target State

Each section becomes an **expandable interactive card** with:
- **Header row**: Section title + a live status summary (e.g., "Hooks: ✓ Global ✓ Project")
- **Collapsed view**: 2-line summary + expand button
- **Expanded view**: Detailed explanation text, code examples, and live status panels

### Section-by-Section Redesign

#### 1. Quick Start → "Environment Status"
- Shows real-time detection of: Claude CLI installed, global settings exist, project settings exist, hooks configured
- Pulls data from `setup.js` store (already available via `/setup/detect`)
- If anything is missing, shows actionable "Auto-Install Hooks" button

#### 2. High-Frequency Tips → "Active Patterns"
- Shows which patterns the user is actually using, based on event data
- E.g., "Parallel Agent: 4 calls detected in last 7 days"
- "Plan Mode: ✓ used" (if SubAgentStartHook events with plan-related agents found)
- Tips not yet used by the user are grayed out with "Try it →" hint

#### 3. Development Patterns → "Your Workflow Stats"
- Pulls from `stats.js`: shows TDD (tests run count), Plan-First (agent calls with plan agents), Code Review (review agent usage), Subagent-Driven (total agent launches)
- Visual badges: "Strong", "Moderate", "Not yet tried" per pattern

#### 4. Tools & Skills → "Your Tool & Skill Usage"
- Replaces static table with actual usage ranking from `stats.toolCounts` and `stats.skillCounts`
- Each tool/skill shows: count, trend (up/down vs previous period), last used timestamp
- Unused built-in tools shown in "Not yet tried" section with one-line descriptions

#### 5. Config Reference → "Your Config Files"
- Shows actual content excerpts from:
  - `CLAUDE.md` — read via `/setup` endpoint or direct file read
  - `settings.json` hooks section — via `/setup/detect`
  - Memory directory stats — via existing `stats.memoryStats`
- Clickable "View full file" links that open a modal overlay

#### 6. Common Pitfalls → "Recent Issues Detected"
- Shows error count from `realtime.errorCount`
- If errors exist, links to the Error Inspection panel
- Shows "sleep polling detected" warning if excessive `Bash` calls with `sleep` found in recent events
- Shows "uncommitted changes" warning if `git status` in events indicates uncommitted work

### Layout

- Two-column grid of expandable cards
- Each card: ~400px wide, auto-height
- Default: all cards collapsed showing summary only
- Click card header to expand/collapse
- "Expand All" / "Collapse All" toggle in header

### Data Flow

| UI Section | Data Source | Endpoint |
|---|---|---|
| Environment Status | `setup.js` store | `GET /setup/detect` |
| Active Patterns | `events.js` + `stats.js` | SSE events + `GET /stats` |
| Your Workflow Stats | `stats.js` | `GET /stats` |
| Tool & Skill Usage | `stats.js` | `GET /stats` |
| Config Files | `setup.js` store | `GET /setup/detect` |
| Recent Issues | `realtime.js` + `events.js` | SSE + `GET /stats` |

No new server endpoints needed — all data already available.

---

## Part B: Sessions Activity Graph

### Current State

Sessions Activity panel is in the 4th column (320px wide). It renders a vertical bar chart with 5-minute buckets. The bars are barely visible due to the narrow width. Labels show "-2h" and "now" but data is fetched for 24 hours.

### Target State

- **Position**: Move to Row 3, spanning 2 columns (same row as Skills & Plugins)
- **Chart**: Replace bar chart with a responsive dual-area chart (turns + agent events over 24 hours)
- **Data**: Aggregate 5-minute buckets into hourly buckets for cleaner visualization
- **Interaction**: Hover tooltip showing exact turn count, agent count, and timestamp

### Grid Layout Changes

Current grid (Dashboard.svelte):
```
Row 1: [Token & Cost Trend (3 cols)] [Agent Activity (1 col)]
Row 2: [Tool Calls] [Skills] [Error Inspection] [Memory]
Row 3: [Model Usage] [Activity Heatmap] [Skills & Plugins] [Sessions Activity]
Bottom: [Event Stream (2 cols)] [Quick Jump (1 col)]
```

New grid:
```
Row 1: [Token & Cost Trend (3 cols)] [Agent Activity (1 col)]
Row 2: [Tool Calls] [Skills] [Error Inspection] [Memory]
Row 3: [Model Usage] [Activity Heatmap] [Sessions Activity (2 cols)]
Row 4: [Skills & Plugins]
Bottom: [Event Stream (2 cols)] [Quick Jump (1 col)]
```

The Skills & Plugins panel moves to Row 4 spanning 1 column. Total grid height stays similar.

### New Component: `AreaChartDual.svelte`

A responsive area chart component for the Sessions Activity panel:

```
Props:
  - turnData: number[]  (hourly turn counts, length 24)
  - agentData: number[] (hourly agent event counts, length 24)
  - labels: string[]    (hour labels like "08", "09", ... "07")

Features:
  - Auto-sizes to container width using SVG viewBox
  - Two overlapping filled areas: blue (turns), amber (agents)
  - Hover tooltip with exact values
  - Legend: "Turns" and "Agent Events"
  - Y-axis with formatted labels
```

The component renders inline in `Dashboard.svelte` (no separate file) to keep it focused.

### Data Transformation

The existing `/stats/events-rate` endpoint returns 5-minute buckets. The frontend will:
1. Aggregate consecutive 5-minute buckets into hourly groups
2. Extract time labels from the first bucket of each hour
3. Pass 24 data points to the chart

No server-side changes needed.

### Styling

- Panel height: ~180px (chart area ~140px + header + legend)
- Chart background: `var(--bg-secondary)`
- Turn area: `#60a5fa` with 30% opacity fill, 2px stroke
- Agent area: `#fbbf24` with 20% opacity fill, 2px stroke
- Tooltip: dark overlay with monospace values

---

## Files Changed

| File | Change |
|---|---|
| `web/src/views/CCPlaybook.svelte` | Complete rewrite: expandable cards with live data |
| `web/src/views/Dashboard.svelte` | Move Sessions Activity panel, replace bar chart with area chart |
| `web/src/components/SessionsActivityChart.svelte` | New: responsive dual-area chart component |

No server-side changes. No new API endpoints.
