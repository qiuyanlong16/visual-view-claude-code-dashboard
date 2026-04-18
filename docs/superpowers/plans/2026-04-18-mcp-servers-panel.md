# MCP Servers Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MCP Servers panel to fill the empty space to the right of Sessions Activity on the dashboard homepage.

**Architecture:** Create a standalone `MCPServersPanel` Svelte component that renders MCP server call counts with mini progress bars. Adjust Dashboard grid CSS so Sessions Activity spans cols 1-2 and the new panel spans cols 3-4.

**Tech Stack:** Svelte 5 (store-based), CSS Grid, existing `mcpCounts` from stats store.

---

### Task 1: Write Failing Test for MCPServersPanel

**Files:**
- Test: `web/test/MCPServersPanel.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import MCPServersPanel from "../src/components/MCPServersPanel.svelte";

describe("MCPServersPanel", () => {
  it("renders empty state when no data", () => {
    render(MCPServersPanel, { props: { mcpCounts: {}, maxCount: 1 } });
    expect(screen.getByText(/no mcp servers/i)).toBeInTheDocument();
  });

  it("renders server list sorted by call count", () => {
    render(MCPServersPanel, {
      props: {
        mcpCounts: { "context7": 12, "github": 8, "filesystem": 3 },
        maxCount: 12,
      },
    });
    expect(screen.getByText("context7")).toBeInTheDocument();
    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();
  });

  it("renders progress bars for each server", () => {
    render(MCPServersPanel, {
      props: {
        mcpCounts: { "context7": 12, "github": 8, "filesystem": 3 },
        maxCount: 12,
      },
    });
    const bars = document.querySelectorAll(".mcp-bar-fill");
    expect(bars.length).toBe(3);
  });

  it("shows call count numbers", () => {
    render(MCPServersPanel, {
      props: {
        mcpCounts: { "context7": 12, "github": 8 },
        maxCount: 12,
      },
    });
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- web/test/MCPServersPanel.test.js`
Expected: FAIL with "Cannot find module '../src/components/MCPServersPanel.svelte'"

- [ ] **Step 3: Commit**

```bash
git add web/test/MCPServersPanel.test.js
git commit -m "test: add failing test for MCPServersPanel component"
```

### Task 2: Implement MCPServersPanel Component

**Files:**
- Create: `web/src/components/MCPServersPanel.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script>
  export let mcpCounts = {};
  export let maxCount = 1;

  $: servers = Object.entries(mcpCounts || {})
    .sort((a, b) => b[1] - a[1]);

  function serverColor(count) {
    if (count >= 5) return "#4ade80";
    if (count >= 1) return "#fbbf24";
    return "#666";
  }
</script>

<div class="mcp-panel">
  {#if servers.length === 0}
    <div class="empty-msg">No MCP servers configured yet.</div>
  {:else}
    {#each servers as [name, count]}
      <div class="mcp-server-row">
        <div class="mcp-status-dot" style="background: {serverColor(count)};"></div>
        <span class="mcp-name">{name}</span>
        <div class="mcp-bar-track">
          <div class="mcp-bar-fill" style="width: {(count / maxCount) * 100}%; background: {serverColor(count)};"></div>
        </div>
        <span class="mcp-count">{count}</span>
      </div>
    {/each}
    <div class="mcp-legend">
      <span class="mcp-legend-item"><span style="color: #4ade80;">●</span> Active (5+)</span>
      <span class="mcp-legend-item"><span style="color: #fbbf24;">●</span> Low (1-4)</span>
    </div>
  {/if}
</div>

<style>
  .mcp-panel { padding: 4px 0; }
  .mcp-server-row {
    display: flex; align-items: center; gap: 6px;
    padding: 3px 0; border-bottom: 1px solid var(--bg-secondary);
  }
  .mcp-server-row:last-of-type { border-bottom: none; }
  .mcp-status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .mcp-name { font-size: 10px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); }
  .mcp-bar-track { width: 40px; height: 3px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
  .mcp-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
  .mcp-count { font-size: 10px; color: var(--text-muted); font-family: monospace; min-width: 16px; text-align: right; }
  .mcp-legend {
    margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--bg-secondary);
    display: flex; gap: 10px; font-size: 9px; color: var(--text-muted);
  }
  .mcp-legend-item { display: flex; gap: 3px; align-items: center; }
</style>
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- web/test/MCPServersPanel.test.js`
Expected: PASS (4 tests)

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MCPServersPanel.svelte web/test/MCPServersPanel.test.js
git commit -m "feat: create MCPServersPanel component with progress bars and status indicators"
```

### Task 3: Integrate MCP Servers Panel into Dashboard Grid

**Files:**
- Modify: `web/src/views/Dashboard.svelte`

- [ ] **Step 1: Add import for MCPServersPanel**

At the top of the `<script>` block, after line 13, add:

```javascript
import MCPServersPanel from "../components/MCPServersPanel.svelte";
```

- [ ] **Step 2: Add MCP row derived data**

After line 60 (after `skillColors`), add:

```javascript
// MCP server rows
$: mcpRows = Object.entries(s.mcpCounts || {})
  .sort((a, b) => b[1] - a[1]);
$: maxMcp = mcpRows.length > 0 ? mcpRows[0][1] : 1;
```

- [ ] **Step 3: Add the MCP Servers panel HTML**

After the Sessions Activity panel (line 374 `</div>`), insert before the closing `</div>` of `dashboard-grid`:

```svelte
    <!-- MCP Servers -->
    <div class="d-panel d-mcp-servers" style="animation-delay: 0.68s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(34,211,238,0.2); color: #22d3ee;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 10h-4V6a2 2 0 00-4 0v4H6a2 2 0 000 4h4v4a2 2 0 004 0v-4h4a2 2 0 000-4z"/></svg>
          </span>
          MCP Servers
        </div>
        <span class="d-badge" style="background: rgba(34,211,238,0.15); color: #22d3ee;">{mcpRows.length} servers</span>
      </div>
      <MCPServersPanel mcpCounts={s.mcpCounts || {}} maxCount={maxMcp} />
    </div>
```

- [ ] **Step 4: Add CSS grid rules**

In the `<style>` block, after `.d-bottom-quick-jump { grid-column: 2 / 4; }`, add:

```css
  .d-sessions-activity { grid-column: 1 / 3; }
  .d-mcp-servers { grid-column: 3 / 5; }
```

- [ ] **Step 5: Add `d-sessions-activity` class to Sessions Activity panel**

Change line 355 from:
```svelte
    <div class="d-panel" style="animation-delay: 0.65s" on:click={() => navigate("sessions")} role="button" tabindex="0">
```
To:
```svelte
    <div class="d-panel d-sessions-activity" style="animation-delay: 0.65s" on:click={() => navigate("sessions")} role="button" tabindex="0">
```

- [ ] **Step 6: Run tests to verify**

Run: `npm test`
Expected: All 16 tests pass (12 existing + 4 new MCP panel tests)

- [ ] **Step 7: Commit**

```bash
git add web/src/views/Dashboard.svelte
git commit -m "feat: integrate MCP Servers panel into dashboard grid layout"
```

### Task 4: Add Dashboard Integration Test for MCP Servers

**Files:**
- Create: `web/test/DashboardMCPServers.test.js`

- [ ] **Step 1: Write the test**

Use the same mocking pattern as `DashboardSessionsActivity.test.js`. Add `mcpCounts` to the `statsStore` mock.

```javascript
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";

const { eventsStore, connectedStore, statsStore, eventRateStore, realtimeStore, sessionsStore } = vi.hoisted(() => {
  const { writable } = require("svelte/store");
  return {
    eventsStore: writable([{ type: "turn_end", timestamp: "2026-04-17T10:00:00", data: {}, session_id: "abc" }]),
    connectedStore: writable(true),
    statsStore: writable({
      totalTurns: 10, totalInputTokens: 5000, totalOutputTokens: 3000, totalCost: 0.05,
      toolCounts: {}, skillCounts: {}, agentCounts: {}, dailyTokens: {}, modelBreakdown: {},
      memoryStats: { files: 5, size: 1000, lastAccess: null },
      mcpCounts: { "context7": 12, "github": 8, "filesystem": 3 },
    }),
    eventRateStore: writable({
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
      active: 2, totalEvents: 100, hours: 2,
    }),
    realtimeStore: writable({ totalTokens: 8000, totalCost: 0.08, activeAgents: 2, totalTools: 15, totalSkills: 3, errorCount: 0, recentErrors: [] }),
    sessionsStore: writable([{ id: "abc", status: "active", events: [{ type: "turn_end" }], createdAt: "2026-04-17T10:00:00", updatedAt: "2026-04-17T10:55:00" }]),
  };
});

vi.mock("/src/stores/events.js", () => ({
  events: eventsStore,
  connected: connectedStore,
}));
vi.mock("/src/stores/stats.js", () => ({
  stats: statsStore,
  eventRate: eventRateStore,
  fetchStats: () => {},
  fetchEventRate: () => {},
}));
vi.mock("/src/stores/realtime.js", () => ({
  realtime: realtimeStore,
}));
vi.mock("/src/stores/sessions.js", () => ({
  sessions: sessionsStore,
}));

import Dashboard from "../src/views/Dashboard.svelte";

describe("Dashboard MCP Servers", () => {
  it("renders MCP Servers panel with data", () => {
    const { container } = render(Dashboard);
    expect(container.querySelector(".d-mcp-servers")).toBeTruthy();
    expect(container.querySelector(".mcp-panel")).toBeTruthy();
    const bars = container.querySelectorAll(".mcp-bar-fill");
    expect(bars.length).toBe(3);
  });

  it("shows MCP server names", () => {
    const { getByText } = render(Dashboard);
    expect(getByText("context7")).toBeTruthy();
    expect(getByText("github")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test`
Expected: All 18 tests pass

- [ ] **Step 3: Commit**

```bash
git add web/test/DashboardMCPServers.test.js
git commit -m "test: add Dashboard integration test for MCP Servers panel"
```
