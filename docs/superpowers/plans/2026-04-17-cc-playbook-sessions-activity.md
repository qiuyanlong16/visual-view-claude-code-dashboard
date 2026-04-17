# CC Playbook Deepening + Sessions Activity Graph — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static CC Playbook into interactive guides with live data, and relocate/enhance the Sessions Activity panel with a dual-area chart.

**Architecture:** Part A rewrites `CCPlaybook.svelte` to use expandable cards that pull live data from existing stores (`setup.js`, `stats.js`, `realtime.js`). Part B adds `SessionsActivityChart.svelte` and moves the Sessions Activity panel to span 2 columns in `Dashboard.svelte`.

**Tech Stack:** Svelte 5 (runes not used, stores-based), Vite, Hono server (no changes), SSE-driven stores.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `web/src/components/SessionsActivityChart.svelte` | **Create** | Responsive dual-area chart component for Sessions Activity |
| `web/src/views/CCPlaybook.svelte` | **Rewrite** | Interactive expandable cards with live status data |
| `web/src/views/Dashboard.svelte` | **Modify** | Grid layout: move Sessions Activity to span 2 cols, replace bar chart with new chart component |

---

### Task 1: SessionsActivityChart Component

**Files:**
- Create: `web/src/components/SessionsActivityChart.svelte`

- [ ] **Step 1: Write the failing test**

```javascript
// web/test/SessionsActivityChart.test.js
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import SessionsActivityChart from "../src/components/SessionsActivityChart.svelte";

describe("SessionsActivityChart", () => {
  it("renders empty state when no data", () => {
    render(SessionsActivityChart, { props: { turnData: [], agentData: [], labels: [] } });
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });

  it("renders area chart with data", () => {
    render(SessionsActivityChart, {
      props: {
        turnData: [10, 20, 30, 25, 15],
        agentData: [2, 5, 8, 3, 1],
        labels: ["10:00", "11:00", "12:00", "13:00", "14:00"],
      },
    });
    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
    // Should have turn area (blue) and agent area (amber)
    const polygons = svg.querySelectorAll("polygon");
    expect(polygons.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npm test -- SessionsActivityChart.test.js
```
Expected: FAIL — component file does not exist.

- [ ] **Step 3: Write minimal implementation**

```svelte
<script>
  export let turnData = [];
  export let agentData = [];
  export let labels = [];
  let width = 600;
  let height = 140;

  $: allValues = [...turnData, ...agentData];
  $: maxVal = Math.max(...allValues, 1);
  $: hasData = turnData.length > 0 && agentData.length > 0;

  function buildPath(data, w, h, mv) {
    if (data.length <= 1) return "";
    const pad = 40;
    const innerW = w - pad * 2;
    const innerH = h - 30;
    return data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * innerW;
      const y = h - 15 - (v / mv) * innerH;
      return `${x},${y}`;
    }).join(" ");
  }

  function buildAreaPath(data, w, h, mv) {
    const linePath = buildPath(data, w, h, mv);
    if (!linePath) return "";
    const pad = 40;
    const innerW = w - pad * 2;
    const lastX = pad + innerW;
    return `${linePath} ${lastX},${h - 15} ${pad},${h - 15}`;
  }

  $: turnLinePath = buildPath(turnData, width, height, maxVal);
  $: turnAreaPath = buildAreaPath(turnData, width, height, maxVal);
  $: agentLinePath = buildPath(agentData, width, height, maxVal);
  $: agentAreaPath = buildAreaPath(agentData, width, height, maxVal);
</script>

<div class="chart-area">
  {#if !hasData}
    <div class="empty-chart">No data</div>
  {:else}
    <svg class="chart-svg" viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="sa-turn-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="sa-agent-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <polygon points={turnAreaPath} fill="url(#sa-turn-grad)"/>
      <polyline points={turnLinePath} fill="none" stroke="#60a5fa" stroke-width="2"/>

      <polygon points={agentAreaPath} fill="url(#sa-agent-grad)"/>
      <polyline points={agentLinePath} fill="none" stroke="#fbbf24" stroke-width="2"/>

      {#if labels.length > 0}
        {#each labels as label, i}
          <text x={40 + i * ((width - 80) / (labels.length - 1))}
                y={height - 2} text-anchor="middle" fill="#606080" font-size="9"
                font-family="monospace">{label}</text>
        {/each}
      {/if}
    </svg>
    <div class="chart-legend">
      <span><span class="dot" style="background:#60a5fa"></span> Turns</span>
      <span><span class="dot" style="background:#fbbf24"></span> Agent Events</span>
    </div>
  {/if}
</div>

<style>
  .chart-area { width: 100%; }
  .chart-svg { width: 100%; height: auto; display: block; }
  .chart-legend { display: flex; gap: 16px; margin-top: 6px; font-size: 11px; color: var(--text-secondary); }
  .chart-legend .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .empty-chart { text-align: center; color: var(--text-muted); padding: 30px; font-size: 12px; }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npm test -- SessionsActivityChart.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/components/SessionsActivityChart.svelte web/test/SessionsActivityChart.test.js
git commit -m "feat: add SessionsActivityChart dual-area chart component

Adds a responsive SVG area chart component for visualizing turn rate
and agent event rate over time. Uses dual gradient fills for visual
layering."
```

---

### Task 2: Integrate SessionsActivityChart into Dashboard

**Files:**
- Modify: `web/src/views/Dashboard.svelte`

- [ ] **Step 1: Write the failing test**

```javascript
// web/test/DashboardSessionsActivity.test.js
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";
import Dashboard from "../src/views/Dashboard.svelte";
import { writable } from "svelte/store";

// Mock all stores before importing
vi.mock("../src/stores/events.js", () => ({
  events: writable([{ type: "turn_end", timestamp: "2026-04-17T10:00:00", data: {}, session_id: "abc" }]),
  connected: writable(true),
}));
vi.mock("../src/stores/stats.js", () => ({
  stats: writable({ totalTurns: 10, totalInputTokens: 5000, totalOutputTokens: 3000, totalCost: 0.05, toolCounts: {}, skillCounts: {}, agentCounts: {}, dailyTokens: {}, modelBreakdown: {}, memoryStats: { files: 5, size: 1000, lastAccess: null } }),
  eventRate: writable({
    buckets: [
      { time: "10:00", turnCount: 5, agentCount: 2 },
      { time: "10:05", turnCount: 8, agentCount: 3 },
      { time: "10:10", turnCount: 12, agentCount: 1 },
      { time: "10:15", turnCount: 6, agentCount: 4 },
      { time: "10:20", turnCount: 10, agentCount: 2 },
      { time: "10:25", turnCount: 3, agentCount: 0 },
      { time: "10:30", turnCount: 7, agentCount: 3 },
      { time: "10:35", turnCount: 9, agentCount: 1 },
      { time: "10:40", turnCount: 11, agentCount: 2 },
      { time: "10:45", turnCount: 4, agentCount: 5 },
      { time: "10:50", turnCount: 6, agentCount: 1 },
      { time: "10:55", turnCount: 8, agentCount: 3 },
    ],
    active: 2,
    totalEvents: 100,
    hours: 2,
  }),
}));
vi.mock("../src/stores/realtime.js", () => ({
  realtime: writable({ totalTokens: 8000, totalCost: 0.08, activeAgents: 2, totalTools: 15, totalSkills: 3, errorCount: 0, recentErrors: [] }),
}));
vi.mock("../src/stores/sessions.js", () => ({
  sessions: writable([{ id: "abc", status: "active", events: [{ type: "turn_end" }], createdAt: "2026-04-17T10:00:00", updatedAt: "2026-04-17T10:55:00" }]),
}));

describe("Dashboard Sessions Activity", () => {
  it("renders SessionsActivityChart when data exists", async () => {
    const { container } = render(Dashboard);
    const chart = container.querySelector("svg.chart-svg");
    expect(chart).toBeTruthy();
    // Should have area chart SVG with two areas (turn + agent)
    const polygons = chart.querySelectorAll("polygon");
    expect(polygons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders empty state when no event rate data", async () => {
    // Re-render with empty eventRate — the mock already has data,
    // so we check the empty-msg path is NOT shown
    const { container } = render(Dashboard);
    expect(container.querySelector(".empty-msg")).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npm test -- DashboardSessionsActivity.test.js
```
Expected: FAIL — chart component not imported yet.

- [ ] **Step 3: Implement Dashboard grid changes**

Replace the Sessions Activity panel in `web/src/views/Dashboard.svelte`.

First, add the import at the top of the `<script>` block (after line 12):

```svelte
// Add this import after existing imports (line 12 area):
import SessionsActivityChart from "../components/SessionsActivityChart.svelte";
```

Add the data transformation for the chart (add after existing derived values around line 26):

```svelte
// Add these derived values for the Sessions Activity area chart
$: hourlyBuckets = aggregateHourly(er.buckets);

function aggregateHourly(buckets) {
  if (!buckets || buckets.length === 0) return { turnData: [], agentData: [], labels: [] };
  const hourMap = new Map();
  for (const b of buckets) {
    const [h, m] = b.time.split(":").map(Number);
    const label = `${h.toString().padStart(2, "0")}`;
    if (!hourMap.has(label)) hourMap.set(label, { turnCount: 0, agentCount: 0 });
    const entry = hourMap.get(label);
    entry.turnCount += b.turnCount;
    entry.agentCount += b.agentCount;
  }
  const sorted = [...hourMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    turnData: sorted.map(([, v]) => v.turnCount),
    agentData: sorted.map(([, v]) => v.agentCount),
    labels: sorted.map(([k]) => k + ":00"),
  };
}
```

Replace the existing Sessions Activity panel (lines 333-364) with:

```svelte
<!-- Sessions Activity Chart (spans 2 columns, Row 3) -->
<div class="d-panel d-sessions-activity" style="animation-delay: 0.65s" on:click={() => navigate("sessions")} role="button" tabindex="0">
  <div class="d-panel-header">
    <div class="d-panel-title">
      <span class="icon" style="background: rgba(96,165,250,0.2); color: #60a5fa;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="12" width="2" height="9" rx="0.5"/><rect x="7" y="8" width="2" height="13" rx="0.5"/><rect x="11" y="5" width="2" height="16" rx="0.5"/><rect x="15" y="9" width="2" height="12" rx="0.5"/><rect x="19" y="3" width="2" height="18" rx="0.5"/></svg>
      </span>
      Sessions Activity
    </div>
    <div class="session-activity-stats">
      <span class="sa-stat"><b style="color: #4ade80;">{activeSessions}</b> active</span>
      <span class="sa-stat"><b>{totalEvents}</b> events</span>
      <span class="sa-stat"><b>{totalTurns}</b> turns</span>
    </div>
  </div>
  {#if hourlyBuckets.turnData.length === 0}
    <div class="empty-msg">No events in last 2 hours.</div>
  {:else}
    <SessionsActivityChart turnData={hourlyBuckets.turnData} agentData={hourlyBuckets.agentData} labels={hourlyBuckets.labels} />
  {/if}
</div>
```

- [ ] **Step 4: Update CSS grid layout**

Replace the grid definition in `<style>` (around line 449):

```css
/* Replace these lines:
.dashboard-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 320px; grid-template-rows: auto auto auto; gap: 12px; }
.dashboard-bottom { display: grid; grid-template-columns: 1fr 1fr 320px; gap: 12px; margin-top: 12px; }
*/

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 320px;
  grid-template-rows: auto auto auto auto;
  gap: 12px;
}
.dashboard-bottom { display: grid; grid-template-columns: 1fr 1fr 320px; gap: 12px; margin-top: 12px; }
```

Add the new panel class (add after line 454):

```css
/* Sessions Activity spans 2 columns in row 3 */
.d-sessions-activity { grid-column: 3 / 5; }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd web && npm test -- DashboardSessionsActivity.test.js
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/views/Dashboard.svelte web/test/DashboardSessionsActivity.test.js web/src/components/SessionsActivityChart.svelte
git commit -m "feat: integrate SessionsActivityChart into Dashboard grid

Relocates Sessions Activity panel to span columns 3-4 in row 3.
Replaces the bar chart with a responsive dual-area chart showing
hourly turn counts and agent events. Adds aggregateHourly() helper
to aggregate 5-minute buckets into hourly data."
```

---

### Task 3: CC Playbook — Core Infrastructure

**Files:**
- Rewrite: `web/src/views/CCPlaybook.svelte`

- [ ] **Step 1: Write the failing test**

```javascript
// web/test/CCPlaybook.test.js
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import CCPlaybook from "../src/views/CCPlaybook.svelte";

vi.mock("../src/stores/setup.js", () => {
  const { writable } = require("svelte/store");
  return {
    detectResult: writable({
      claudeInstalled: true,
      claudeVersion: "0.5.0",
      globalSettingsExists: true,
      globalSettingsPath: "/home/user/.claude/settings.json",
      projectSettingsExists: true,
      projectSettingsPath: "/project/.claude/settings.local.json",
      hooksConfigured: { global: true, project: true },
      ready: true,
    }),
    isReady: writable(true),
    isChecking: writable(false),
    checkSetup: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    installHooks: vi.fn(),
  };
});

describe("CCPlaybook", () => {
  it("renders all 6 section cards", () => {
    render(CCPlaybook);
    expect(screen.getByText(/Environment Status/i)).toBeTruthy();
    expect(screen.getByText(/Active Patterns/i)).toBeTruthy();
    expect(screen.getByText(/Your Workflow Stats/i)).toBeTruthy();
    expect(screen.getByText(/Your Tool & Skill Usage/i)).toBeTruthy();
    expect(screen.getByText(/Your Config Files/i)).toBeTruthy();
    expect(screen.getByText(/Recent Issues Detected/i)).toBeTruthy();
  });

  it("cards are collapsed by default", () => {
    const { container } = render(CCPlaybook);
    // Each card body should be hidden by default
    const bodies = container.querySelectorAll(".pb-card-body");
    bodies.forEach(body => {
      expect(body).toHaveClass("collapsed");
    });
  });

  it("expands card on click", async () => {
    const { container } = render(CCPlaybook);
    const header = container.querySelector(".pb-card-header");
    await fireEvent.click(header);
    const body = container.querySelector(".pb-card-body");
    expect(body).not.toHaveClass("collapsed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npm test -- CCPlaybook.test.js
```
Expected: FAIL — section titles don't match new names.

- [ ] **Step 3: Rewrite CCPlaybook with expandable cards**

Replace the entire content of `web/src/views/CCPlaybook.svelte`:

```svelte
<script>
  import { onMount, onDestroy } from "svelte";
  import { detectResult, isReady, isChecking, checkSetup, startPolling, stopPolling } from "../stores/setup.js";
  import { stats } from "../stores/stats.js";
  import { realtime } from "../stores/realtime.js";
  import { events } from "../stores/events.js";

  const POLL_MS = 30000;

  // Track expanded cards
  let expandedCard = null;

  function toggleCard(index) {
    expandedCard = expandedCard === index ? null : index;
  }

  onMount(() => {
    checkSetup();
    startPolling(POLL_MS);
  });

  onDestroy(() => {
    stopPolling();
  });

  // Derived: section data with live status
  $: detect = $detectResult;
  $: s = $stats;
  $: r = $realtime;
  $: e = $events;

  // Compute which patterns are detected in actual event data
  $: patterns = computeActivePatterns(e);

  function computeActivePatterns(evts) {
    const p = {
      parallelAgent: false,
      planMode: false,
      codeReview: false,
      subagentDriven: false,
      tdd: false,
    };
    let agentStartCount = 0;
    let agentEndCount = 0;

    for (const evt of evts) {
      if (evt.type === "agent_start") {
        agentStartCount++;
        // Multiple agent starts in same session = parallel
        if (agentStartCount > 1 && !p.parallelAgent) p.parallelAgent = true;
        // Check for plan-related agent names
        const name = (evt.data?.name || evt.data?.type || "").toLowerCase();
        if (name.includes("plan")) p.planMode = true;
        if (name.includes("review")) p.codeReview = true;
      }
      if (evt.type === "agent_end") agentEndCount++;
      if (evt.type === "agent_start" && agentStartCount > 0) p.subagentDriven = true;
      // TDD detection: look for test-related tool calls in turn_end data
      if (evt.type === "turn_end" && evt.data?.tools_used) {
        if (evt.data.tools_used.some(t => t.toLowerCase().includes("test") || t.toLowerCase().includes("vitest") || t.toLowerCase().includes("npm test"))) p.tdd = true;
      }
    }
    return p;
  }

  // Format time ago
  function timeAgo(ts) {
    if (!ts) return "unknown";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function formatSize(bytes) {
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  }

  // Section definitions with live status computation
  $: sections = [
    {
      title: "Environment Status",
      icon: "",
      summary: getEnvStatusSummary(detect),
      renderBody: (expand) => renderEnvironmentBody(detect, expand),
    },
    {
      title: "Active Patterns",
      icon: "⚡",
      summary: getPatternsSummary(patterns),
      renderBody: (expand) => renderPatternsBody(patterns, expand),
    },
    {
      title: "Your Workflow Stats",
      icon: "📊",
      summary: getWorkflowSummary(s, patterns),
      renderBody: (expand) => renderWorkflowBody(s, patterns, expand),
    },
    {
      title: "Your Tool & Skill Usage",
      icon: "🔧",
      summary: getToolSkillSummary(s),
      renderBody: (expand) => renderToolSkillBody(s, expand),
    },
    {
      title: "Your Config Files",
      icon: "📋",
      summary: getConfigSummary(detect, s),
      renderBody: (expand) => renderConfigBody(detect, s, expand),
    },
    {
      title: "Recent Issues Detected",
      icon: "⚠️",
      summary: getIssuesSummary(r, e),
      renderBody: (expand) => renderIssuesBody(r, e, expand),
    },
  ];

  // Summary getters
  function getEnvStatusSummary(d) {
    if (!d) return "Detecting...";
    const parts = [];
    if (d.hooksConfigured?.global) parts.push("Global ✓");
    if (d.hooksConfigured?.project) parts.push("Project ✓");
    return parts.length > 0 ? parts.join(" · ") : "Not configured";
  }

  function getPatternsSummary(p) {
    const active = Object.values(p).filter(Boolean).length;
    return `${active}/5 patterns detected in your sessions`;
  }

  function getWorkflowSummary(st, p) {
    const parts = [];
    if (st.totalTurns > 0) parts.push(`${st.totalTurns} turns`);
    if (p.subagentDriven) parts.push("subagents active");
    return parts.length > 0 ? parts.join(" · ") : "No activity yet";
  }

  function getToolSkillSummary(st) {
    const toolCount = Object.keys(st.toolCounts || {}).length;
    const skillCount = Object.keys(st.skillCounts || {}).length;
    return `${toolCount} tools · ${skillCount} skills used`;
  }

  function getConfigSummary(d, st) {
    if (!d) return "Detecting...";
    const files = st.memoryStats?.files || 0;
    return `${files} memory files tracked`;
  }

  function getIssuesSummary(r, evts) {
    if (r.errorCount > 0) return `${r.errorCount} errors detected`;
    // Check for excessive Bash usage in recent events
    const recentBash = evts.slice(-20).filter(evt =>
      evt.data?.tools_used?.includes("Bash")
    );
    if (recentBash.length > 8) return `High Bash usage (${recentBash.length}/20)`;
    return "All clear";
  }

  // Body renderers (return HTML strings for {@html})
  function renderEnvironmentBody(d, expanded) {
    if (!d) return "";
    const checks = [
      { label: "Claude CLI", ok: d.claudeInstalled, detail: d.claudeVersion || "found" },
      { label: "Global Settings", ok: d.globalSettingsExists, detail: d.globalSettingsPath },
      { label: "Project Settings", ok: d.projectSettingsExists, detail: d.projectSettingsPath },
      { label: "Hooks Configured", ok: d.hooksConfigured?.global || d.hooksConfigured?.project, detail: `Global: ${d.hooksConfigured?.global ? "✓" : "✗"} · Project: ${d.hooksConfigured?.project ? "✓" : "✗"}` },
    ];

    let html = `<div class="pb-checklist">`;
    for (const c of checks) {
      html += `<div class="pb-check-item" class="${c.ok ? 'ok' : 'fail'}">
        <span class="pb-check-icon">${c.ok ? "✓" : "✗"}</span>
        <span class="pb-check-label">${c.label}</span>
        <span class="pb-check-detail">${c.detail}</span>
      </div>`;
    }
    html += `</div>`;

    if (!d.ready) {
      html += `<div class="pb-install-guide">
        <p>Hooks not fully configured. Add to your Claude Code settings.json:</p>
        <pre class="pb-code-block">{
  "hooks": {
    "SessionStartHook": "node /path/to/scripts/hook.js session_start",
    "TurnEndHook": "node /path/to/scripts/hook.js turn_end",
    "SubAgentStartHook": "node /path/to/scripts/hook.js agent_start",
    "SubAgentEndHook": "node /path/to/scripts/hook.js agent_end"
  }
}</pre>
      </div>`;
    }

    return html;
  }

  function renderPatternsBody(p, expanded) {
    const patterns = [
      { name: "Parallel Agent", key: "parallelAgent", desc: "Multiple agents launched concurrently for independent tasks" },
      { name: "Plan Mode", key: "planMode", desc: "Using Plan agent to design before implementing" },
      { name: "Code Review", key: "codeReview", desc: "Using code-reviewer agent after major steps" },
      { name: "Subagent-Driven", key: "subagentDriven", desc: "Decomposing work across multiple sub-agent calls" },
      { name: "TDD", key: "tdd", desc: "Writing tests before implementation code" },
    ];

    let html = `<div class="pb-pattern-list">`;
    for (const pt of patterns) {
      const active = p[pt.key];
      html += `<div class="pb-pattern-item" class="${active ? 'active' : 'inactive'}">
        <span class="pb-pattern-name">${pt.name}</span>
        <span class="pb-pattern-status">${active ? "Active" : "Not yet tried"}</span>
        <span class="pb-pattern-desc">${pt.desc}</span>
      </div>`;
    }
    html += `</div>`;
    return html;
  }

  function renderWorkflowBody(st, p, expanded) {
    const items = [
      { name: "Total Turns", value: st.totalTurns || 0, color: "#60a5fa" },
      { name: "Total Tokens", value: formatTokens((st.totalInputTokens || 0) + (st.totalOutputTokens || 0)), color: "#f87171" },
      { name: "Est. Cost", value: "$" + (st.totalCost || 0).toFixed(4), color: "#4ade80" },
      { name: "Active Agents", value: p.subagentDriven ? "Yes" : "None", color: "#a78bfa" },
      { name: "TDD Detected", value: p.tdd ? "Yes" : "No", color: p.tdd ? "#4ade80" : "#606080" },
    ];

    let html = `<div class="pb-workflow-grid">`;
    for (const item of items) {
      html += `<div class="pb-wf-item">
        <span class="pb-wf-label">${item.name}</span>
        <span class="pb-wf-value" style="color: ${item.color}">${item.value}</span>
      </div>`;
    }
    html += `</div>`;
    return html;
  }

  function renderToolSkillBody(st, expanded) {
    const tools = Object.entries(st.toolCounts || {}).sort((a, b) => b[1] - a[1]);
    const skills = Object.entries(st.skillCounts || {}).sort((a, b) => b[1] - a[1]);

    let html = `<div class="pb-usage-section">
      <h4 class="pb-usage-title">Tools (${tools.length})</h4>`;

    if (tools.length === 0) {
      html += `<div class="pb-empty">No tool calls recorded yet.</div>`;
    } else {
      for (const [name, count] of tools.slice(0, 8)) {
        html += `<div class="pb-usage-row">
          <span class="pb-usage-name">${name}</span>
          <span class="pb-usage-count">${count}</span>
        </div>`;
      }
    }

    html += `</div><div class="pb-usage-section">
      <h4 class="pb-usage-title">Skills (${skills.length})</h4>`;

    if (skills.length === 0) {
      html += `<div class="pb-empty">No skills invoked yet.</div>`;
    } else {
      for (const [name, count] of skills.slice(0, 8)) {
        html += `<div class="pb-usage-row">
          <span class="pb-usage-name">${name}</span>
          <span class="pb-usage-count">${count}</span>
        </div>`;
      }
    }

    html += `</div>`;
    return html;
  }

  function renderConfigBody(d, st, expanded) {
    const memoryFiles = st.memoryStats?.files || 0;
    const memorySize = st.memoryStats?.size || 0;
    const lastAccess = st.memoryStats?.lastAccess ? timeAgo(st.memoryStats.lastAccess) : "never";

    let html = `<div class="pb-config-list">
      <div class="pb-config-item">
        <span class="pb-config-name">CLAUDE.md</span>
        <span class="pb-config-detail">Project-level instructions, architecture docs, workflow rules</span>
      </div>
      <div class="pb-config-item">
        <span class="pb-config-name">settings.json</span>
        <span class="pb-config-detail">${d?.globalSettingsPath || "not found"}${d?.hooksConfigured?.global ? " (hooks ✓)" : ""}</span>
      </div>
      <div class="pb-config-item">
        <span class="pb-config-name">Project settings</span>
        <span class="pb-config-detail">${d?.projectSettingsPath || "not found"}${d?.hooksConfigured?.project ? " (hooks ✓)" : ""}</span>
      </div>
      <div class="pb-config-item">
        <span class="pb-config-name">Memory files</span>
        <span class="pb-config-detail">${memoryFiles} files · ${formatSize(memorySize)} · last accessed ${lastAccess}</span>
      </div>
    </div>`;
    return html;
  }

  function renderIssuesBody(r, evts, expanded) {
    let html = "";

    if (r.errorCount === 0 && r.recentErrors.length === 0) {
      // Check for excessive Bash usage
      const bashEvents = evts.slice(-50).filter(evt =>
        evt.data?.tools_used?.includes("Bash")
      );

      if (bashEvents.length > 20) {
        html += `<div class="pb-issue pb-warning">
          <span class="pb-issue-icon">⚡</span>
          <div class="pb-issue-body">
            <strong>High Bash usage</strong>
            <p>${bashEvents.length} of last 50 turns used Bash. Consider Read/Grep/Glob instead.</p>
          </div>
        </div>`;
      } else {
        html += `<div class="pb-issue pb-ok">
          <span class="pb-issue-icon">✓</span>
          <div class="pb-issue-body">
            <strong>All clear</strong>
            <p>No errors or anti-patterns detected in recent activity.</p>
          </div>
        </div>`;
      }
    }

    for (const err of r.recentErrors.slice(0, 5)) {
      html += `<div class="pb-issue pb-error">
        <span class="pb-issue-icon">✗</span>
        <div class="pb-issue-body">
          <strong>${err.message}</strong>
          <p>${err.timestamp?.slice(11, 19) || ""}</p>
        </div>
      </div>`;
    }

    return html;
  }

  function formatTokens(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
  }
</script>

<div class="playbook-content">
  <div class="pb-header">
    <h2>CC Playbook</h2>
    <div class="pb-subtitle">Interactive reference — live data from your Claude Code sessions</div>
  </div>

  <div class="pb-grid">
    {#each sections as section, i}
      <div class="pb-card" class:expanded={expandedCard === i}>
        <div class="pb-card-header" on:click={() => toggleCard(i)}>
          <div class="pb-card-title">
            <span class="pb-card-icon">{section.icon}</span>
            <span>{section.title}</span>
          </div>
          <span class="pb-card-summary">{section.summary}</span>
          <span class="pb-chevron" class:open={expandedCard === i}>▸</span>
        </div>
        <div class="pb-card-body" class:collapsed={expandedCard !== i}>
          {@html section.renderBody(expandedCard === i)}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .playbook-content {
    max-width: 1200px; margin: 0 auto; padding: 0 24px;
  }
  .pb-header { margin-bottom: 24px; }
  .pb-header h2 { font-size: 18px; margin: 0 0 4px; }
  .pb-subtitle { font-size: 12px; color: var(--text-muted); }

  .pb-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  }

  .pb-card {
    background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
    overflow: hidden; transition: border-color 0.2s;
  }
  .pb-card:hover { border-color: #3a3a5a; }
  .pb-card.expanded { border-color: var(--accent); }

  .pb-card-header {
    display: flex; align-items: center; gap: 10px; padding: 14px 16px;
    cursor: pointer; user-select: none;
  }
  .pb-card-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; flex-shrink: 0; }
  .pb-card-icon { font-size: 16px; }
  .pb-card-summary { font-size: 11px; color: var(--text-muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pb-chevron { font-size: 12px; color: var(--text-muted); transition: transform 0.2s; flex-shrink: 0; }
  .pb-chevron.open { transform: rotate(90deg); }

  .pb-card-body {
    padding: 0 16px 16px;
    transition: max-height 0.3s ease, padding 0.3s ease;
    max-height: 0; overflow: hidden; padding-top: 0;
  }
  .pb-card-body.collapsed { max-height: 0; padding: 0 16px; }
  .pb-card-body:not(.collapsed) { max-height: 1200px; padding-top: 8px; }

  /* Checklists */
  .pb-checklist { display: flex; flex-direction: column; gap: 8px; }
  .pb-check-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .pb-check-item.ok .pb-check-icon { color: var(--green); }
  .pb-check-item.fail .pb-check-icon { color: var(--red); }
  .pb-check-icon { font-weight: 700; min-width: 16px; }
  .pb-check-label { font-weight: 500; color: var(--text-primary); min-width: 120px; }
  .pb-check-detail { color: var(--text-muted); font-size: 11px; word-break: break-all; }

  .pb-install-guide { margin-top: 12px; }
  .pb-install-guide p { font-size: 12px; color: var(--text-secondary); margin: 0 0 8px; }
  .pb-code-block {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px;
    padding: 10px 14px; font-size: 11px; font-family: var(--mono, monospace);
    color: var(--text-primary); white-space: pre; overflow-x: auto;
  }

  /* Patterns */
  .pb-pattern-list { display: flex; flex-direction: column; gap: 6px; }
  .pb-pattern-item {
    display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 8px 10px;
    border-radius: 6px; font-size: 12px;
  }
  .pb-pattern-item.active { background: rgba(74,222,128,0.08); }
  .pb-pattern-item.inactive { background: rgba(96,96,128,0.05); }
  .pb-pattern-name { font-weight: 600; color: var(--text-primary); }
  .pb-pattern-status { font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; }
  .pb-pattern-item.active .pb-pattern-status { background: rgba(74,222,128,0.2); color: var(--green); }
  .pb-pattern-item.inactive .pb-pattern-status { background: rgba(96,96,128,0.2); color: var(--text-muted); }
  .pb-pattern-desc { grid-column: 1 / -1; font-size: 11px; color: var(--text-muted); margin-top: 2px; }

  /* Workflow stats */
  .pb-workflow-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .pb-wf-item { display: flex; flex-direction: column; gap: 4px; padding: 10px; background: var(--bg-secondary); border-radius: 8px; }
  .pb-wf-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
  .pb-wf-value { font-size: 18px; font-weight: 700; }

  /* Tool/Skill usage */
  .pb-usage-section { margin-bottom: 12px; }
  .pb-usage-title { font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin: 0 0 6px; }
  .pb-usage-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--bg-secondary); font-size: 12px; }
  .pb-usage-row:last-child { border: none; }
  .pb-usage-name { color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .pb-usage-count { color: var(--text-muted); font-family: monospace; min-width: 30px; text-align: right; }
  .pb-empty { font-size: 11px; color: var(--text-muted); padding: 8px 0; }

  /* Config */
  .pb-config-list { display: flex; flex-direction: column; gap: 6px; }
  .pb-config-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--bg-secondary); font-size: 12px; }
  .pb-config-item:last-child { border: none; }
  .pb-config-name { font-weight: 600; color: var(--text-primary); min-width: 120px; }
  .pb-config-detail { color: var(--text-muted); word-break: break-all; }

  /* Issues */
  .pb-issue { display: flex; gap: 10px; padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 12px; }
  .pb-issue:last-child { margin-bottom: 0; }
  .pb-issue-ok { background: rgba(74,222,128,0.08); }
  .pb-issue-warning { background: rgba(251,191,36,0.08); }
  .pb-issue-error { background: rgba(248,113,113,0.08); }
  .pb-issue-icon { font-size: 14px; }
  .pb-issue-body strong { display: block; color: var(--text-primary); margin-bottom: 2px; }
  .pb-issue-body p { margin: 0; font-size: 11px; color: var(--text-muted); }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd web && npm test -- CCPlaybook.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/views/CCPlaybook.svelte web/test/CCPlaybook.test.js
git commit -m "feat: rewrite CC Playbook as interactive expandable cards

Replaces static reference tables with 6 interactive cards: Environment
Status (live hook detection), Active Patterns (detected from events),
Your Workflow Stats (from stats store), Tool & Skill Usage (ranked by
count), Config Files (with live paths), and Recent Issues (error
detection + anti-pattern warnings). Cards collapse/expand on click."
```

---

### Task 4: Integration & Verification

**Files:**
- Modify: `web/src/App.svelte` (if needed for CCDetection overlay compatibility)

- [ ] **Step 1: Verify no import errors**

```bash
cd web && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run all tests**

```bash
cd web && npm test
```
Expected: All tests pass (SessionsActivityChart, DashboardSessionsActivity, CCPlaybook).

- [ ] **Step 3: Start dev servers and manual check**

```bash
npm run server &
npm run dev
```

Open http://localhost:5173 and verify:
1. Dashboard renders with Sessions Activity showing area chart in columns 3-4
2. CC Playbook page shows 6 expandable cards in 2-column grid
3. Cards expand/collapse on click with smooth animation
4. Environment Status shows actual hook detection results
5. Active Patterns shows detected patterns from real event data
6. Grid layout has no empty gaps

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: verify build and run integration tests"
```
