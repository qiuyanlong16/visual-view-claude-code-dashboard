# Dashboard Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time icon-rich dashboard homepage with bento grid layout, SVG charts, animated KPIs, and live SSE-driven data updates.

**Architecture:** Server adds two new API endpoints (realtime stats, errors). Frontend adds a Dashboard view composed of 7 reusable chart/icon components, driven by existing SSE + polling stores. Dashboard becomes the default landing page.

**Tech Stack:** Svelte 5, Hono, CSS animations, SVG (no chart libraries)

---

## File Structure

```
New:
  server/src/routes/realtime.js     — GET /stats/realtime + GET /errors
  server/test/realtime.test.js      — API tests for realtime endpoints
  web/src/stores/realtime.js        — Realtime polling store (5s interval)
  web/src/views/Dashboard.svelte    — Main dashboard page (bento grid layout)
  web/src/components/KPICard.svelte  — KPI card with icon + sparkline
  web/src/components/Sparkline.svelte — Mini SVG sparkline
  web/src/components/AreaChart.svelte — Token trend area chart
  web/src/components/DonutChart.svelte — Model usage donut chart
  web/src/components/Heatmap.svelte — Activity heatmap
  web/src/components/ProgressBar.svelte — Tool usage progress bar
  web/src/components/AgentRow.svelte — Agent status row
  web/src/components/MemoryPanel.svelte — Memory stats grid for dashboard

Modified:
  server/src/index.js              — Register realtime routes
  web/src/App.svelte               — Add Dashboard, set as default
  web/src/app.css                  — Dashboard-specific styles
  web/src/stores/stats.js          — Faster polling for dashboard
```

---

### Task 1: Server — Realtime Stats Endpoint

**Files:**
- Create: `server/src/routes/realtime.js`
- Create: `server/test/realtime.test.js`
- Modify: `server/src/index.js`

- [ ] **Step 1: Write the failing test**

Create `server/test/realtime.test.js`:

```javascript
import { describe, it } from "node:test";
import assert from "node:assert";
import { Hono } from "hono";
import { realtimeRoutes } from "../src/routes/realtime.js";

describe("realtime endpoints", async () => {
  const app = new Hono();
  realtimeRoutes(app);

  it("GET /stats/realtime returns KPI values", async () => {
    const res = await app.request("/stats/realtime");
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.totalTokens === "number");
    assert.ok(typeof data.totalCost === "number");
    assert.ok(typeof data.activeAgents === "number");
    assert.ok(typeof data.totalTools === "number");
    assert.ok(typeof data.totalSkills === "number");
    assert.ok(typeof data.errorCount === "number");
    assert.ok(Array.isArray(data.recentErrors));
  });

  it("GET /errors returns error list", async () => {
    const res = await app.request("/errors");
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && node --test test/realtime.test.js
```

Expected: FAIL — module not found `realtime.js`

- [ ] **Step 3: Implement realtime.js**

Create `server/src/routes/realtime.js`:

```javascript
import { getEvents, getEventCount } from "../store.js";

const PRICING = {
  "claude-opus-4-7": { input: 15.0, output: 75.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "qwen3.6-plus": { input: 1.0, output: 5.0 },
};

function calcCost(model, inputTokens, outputTokens) {
  const p = PRICING[model] || { input: 1.0, output: 5.0 };
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

export function realtimeRoutes(app) {
  app.get("/stats/realtime", (c) => {
    const events = getEvents(null, 10000);
    const turnEnds = events.filter((e) => e.type === "turn_end");
    const agentEnds = events.filter((e) => e.type === "agent_end");
    const agentStarts = events.filter((e) => e.type === "agent_start");

    let totalTokens = 0;
    let totalCost = 0;
    let totalTools = 0;
    let totalSkills = 0;
    const runningAgents = new Set();

    for (const evt of turnEnds) {
      const d = evt.data || {};
      const tokens = d.tokens_used || {};
      const input = tokens.input || 0;
      const output = tokens.output || 0;
      const model = d.model || "unknown";
      totalTokens += input + output;
      totalCost += calcCost(model, input, output);
      totalTools += (d.tools_used || []).length;
      totalSkills += (d.skills_invoked || []).length;
    }

    // Track active agents (started but not ended)
    const agentMap = new Map();
    let agentCounter = 0;
    for (const evt of agentStarts) {
      agentMap.set(++agentCounter, { status: "running", ...evt.data });
    }
    let endedCounter = 0;
    for (const evt of agentEnds) {
      endedCounter++;
      const entry = [...agentMap.entries()].find(([, a]) => a.status === "running");
      if (entry) entry[1].status = "completed";
    }
    const activeAgents = [...agentMap.values()].filter((a) => a.status === "running").length;

    // Detect errors from events
    const recentErrors = [];
    for (const evt of events.slice(-50).reverse()) {
      if (evt.type === "agent_end" && evt.data?.status === "failed") {
        recentErrors.push({
          timestamp: evt.timestamp || evt.receivedAt,
          message: `Agent ${evt.data?.name || evt.data?.type} failed`,
          type: "agent_fail",
          sessionId: evt.session_id,
        });
      }
      if (recentErrors.length >= 5) break;
    }

    return c.json({
      totalTokens,
      totalCost: +totalCost.toFixed(4),
      activeAgents,
      totalTools,
      totalSkills,
      errorCount: recentErrors.length,
      recentErrors,
    });
  });

  app.get("/errors", (c) => {
    const events = getEvents(null, 10000);
    const errors = [];
    for (const evt of events) {
      if (evt.type === "agent_end" && evt.data?.status === "failed") {
        errors.push({
          timestamp: evt.timestamp || evt.receivedAt,
          message: `Agent ${evt.data?.name || evt.data?.type} failed`,
          type: "agent_fail",
          sessionId: evt.session_id,
        });
      }
    }
    return c.json(errors.slice(-20));
  });
}
```

- [ ] **Step 4: Register routes in index.js**

Modify `server/src/index.js` — add import and register:

```javascript
import { realtimeRoutes } from "./routes/realtime.js";
// ...
realtimeRoutes(app);
```

The updated `server/src/index.js`:

```javascript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { eventRoutes } from "./routes/events.js";
import { sessionRoutes } from "./routes/sessions.js";
import { memoryRoutes } from "./routes/memory.js";
import { statsRoutes } from "./routes/stats.js";
import { realtimeRoutes } from "./routes/realtime.js";

const app = new Hono();

app.use("*", cors());
app.get("/health", (c) => c.json({ status: "ok" }));

eventRoutes(app);
sessionRoutes(app);
memoryRoutes(app);
statsRoutes(app);
realtimeRoutes(app);

serve({ fetch: app.fetch, port: 3456 }, (info) => {
  console.log(`Event server listening on :${info.port}`);
});
```

- [ ] **Step 5: Run tests**

```bash
cd server && node --test test/realtime.test.js
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/realtime.js server/test/realtime.test.js server/src/index.js
git commit -m "feat: add realtime stats and errors API endpoints"
```

---

### Task 2: Frontend — Realtime Store

**Files:**
- Create: `web/src/stores/realtime.js`

- [ ] **Step 1: Create realtime store with polling**

Create `web/src/stores/realtime.js`:

```javascript
import { writable } from "svelte/store";

export const realtime = writable({
  totalTokens: 0,
  totalCost: 0,
  activeAgents: 0,
  totalTools: 0,
  totalSkills: 0,
  errorCount: 0,
  recentErrors: [],
});

let intervalId = null;

export function startRealtimePolling(intervalMs = 5000) {
  fetchRealtime();
  intervalId = setInterval(fetchRealtime, intervalMs);
}

export function stopRealtimePolling() {
  if (intervalId) clearInterval(intervalId);
}

async function fetchRealtime() {
  try {
    const res = await fetch("/stats/realtime");
    if (res.ok) realtime.set(await res.json());
  } catch (e) {
    // Silently fail — stale values remain
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/stores/realtime.js
git commit -m "feat: add realtime polling store for dashboard KPIs"
```

---

### Task 3: Frontend — Sparkline Component

**Files:**
- Create: `web/src/components/Sparkline.svelte`

- [ ] **Step 1: Create Sparkline component**

Create `web/src/components/Sparkline.svelte`:

```javascript
<script>
  export let data = [];
  export let color = "#60a5fa";
  export let width = 80;
  export let height = 30;

  $: points = data.length > 1
    ? data.map((v, i) => {
        const x = (i / (data.length - 1)) * (width - 4) + 2;
        const max = Math.max(...data, 1);
        const y = height - 2 - (v / max) * (height - 4);
        return `${x},${y}`;
      }).join(" ")
    : `2,${height / 2} ${width - 2},${height / 2}`;
</script>

<svg {width} {height}>
  <polyline {points} fill="none" {stroke="color"} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/Sparkline.svelte
git commit -m "feat: add SVG Sparkline component for mini charts"
```

---

### Task 4: Frontend — KPICard Component

**Files:**
- Create: `web/src/components/KPICard.svelte`
- Modify: `web/src/app.css`

- [ ] **Step 1: Create KPICard component**

Create `web/src/components/KPICard.svelte`:

```javascript
<script>
  import Sparkline from "./Sparkline.svelte";

  export let icon = "";
  export let label = "";
  export let value = "0";
  export let color = "#60a5fa";
  export let trend = null; // { value: number, direction: 'up' | 'down' }
  export let sparklineData = [];
  export let sub = "";
  export let delay = 0;
</script>

<div class="kpi-card" style="--delay: {delay}ms">
  <div class="kpi-icon" style="background: {color}20; color: {color};">
    {@html icon}
  </div>
  <div class="kpi-label">{label}</div>
  <div class="kpi-value" style="color: {color}">{value}</div>
  {#if trend}
    <div class="kpi-sub">
      <span class={trend.direction}>{trend.direction === "up" ? "▲" : "▼"} {trend.value}</span>
    </div>
  {:else if sub}
    <div class="kpi-sub">{sub}</div>
  {/if}
  {#if sparklineData.length > 1}
    <div class="sparkline">
      <Sparkline data={sparklineData} color={color} />
    </div>
  {/if}
</div>

<style>
  .kpi-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    position: relative;
    overflow: hidden;
    animation: fadeIn 0.4s ease-out var(--delay) both;
    transition: border-color 0.2s, transform 0.2s;
  }
  .kpi-card:hover { border-color: #3a3a5a; transform: translateY(-1px); }
  .kpi-icon {
    width: 32px; height: 32px; border-radius: 8px; display: flex;
    align-items: center; justify-content: center; margin-bottom: 10px;
  }
  .kpi-label {
    font-size: 11px; color: var(--text-muted); text-transform: uppercase;
    letter-spacing: 0.08em; font-weight: 600; margin-bottom: 4px;
  }
  .kpi-value { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; }
  .kpi-sub { font-size: 11px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 4px; }
  .kpi-sub .up { color: var(--green); }
  .kpi-sub .down { color: var(--red); }
  .sparkline { position: absolute; bottom: 0; right: 0; opacity: 0.3; }
</style>
```

- [ ] **Step 2: Add dashboard styles to app.css**

Add to `web/src/app.css` (append at end):

```css
/* Dashboard-specific styles */
:root {
  --bg-card: #0f0f1a;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 4px currentColor; }
  50% { opacity: 0.5; box-shadow: 0 0 8px currentColor; }
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 320px;
  grid-template-rows: auto auto auto;
  gap: 12px;
}

.dashboard-bottom {
  display: grid;
  grid-template-columns: 1fr 1fr 320px;
  gap: 12px;
  margin-top: 12px;
}

.d-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  animation: fadeIn 0.4s ease-out both;
}

.d-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.d-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.d-panel-title .icon {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.d-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.d-status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
.d-status-badge.connected {
  background: rgba(74,222,128,0.1);
  border: 1px solid rgba(74,222,128,0.3);
  color: var(--green);
}
.d-status-badge.disconnected {
  background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.3);
  color: var(--red);
}
.d-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}
.d-status-badge.connected .d-status-dot { background: var(--green); color: var(--green); }
.d-status-badge.disconnected .d-status-dot { background: var(--red); color: var(--red); }

.d-event-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  margin-bottom: 3px;
  background: var(--bg-secondary);
  font-size: 11px;
}
.d-event-time {
  color: var(--text-muted);
  font-family: monospace;
  font-size: 10px;
  min-width: 48px;
}
.d-event-detail {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/KPICard.svelte web/src/app.css
git commit -m "feat: add KPICard component with dashboard styles"
```

---

### Task 5: Frontend — AreaChart Component

**Files:**
- Create: `web/src/components/AreaChart.svelte`

- [ ] **Step 1: Create AreaChart component**

Create `web/src/components/AreaChart.svelte`:

```javascript
<script>
  export let inputData = [];
  export let outputData = [];
  export let labels = [];
  export let width = 700;
  export let height = 160;
  export let inputColor = "#60a5fa";
  export let outputColor = "#a78bfa";

  $: allValues = [...inputData, ...outputData];
  $: maxVal = Math.max(...allValues, 1);
  $: points = (data) => data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * (width - 40) + 30 : width / 2;
    const y = height - 10 - (v / maxVal) * (height - 20);
    return `${x},${y}`;
  }).join(" ");

  $: inputPath = inputData.map((v, i) => {
    const x = inputData.length > 1 ? (i / (inputData.length - 1)) * (width - 40) + 30 : width / 2;
    const y = height - 10 - (v / maxVal) * (height - 20);
    return `${x},${y}`;
  }).join(" ");

  $: inputAreaPath = inputPath + ` ${width - 10},${height - 10} 30,${height - 10}`;

  $: outputPath = outputData.map((v, i) => {
    const x = outputData.length > 1 ? (i / (outputData.length - 1)) * (width - 40) + 30 : width / 2;
    const y = height - 10 - (v / maxVal) * (height - 20);
    return `${x},${y}`;
  }).join(" ");

  $: outputAreaPath = outputPath + ` ${width - 10},${height - 10} 30,${height - 10}`;

  $: gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    y: height - 10 - pct * (height - 20),
    label: Math.round(pct * maxVal).toLocaleString(),
  }));
</script>

<div class="chart-area">
  {#if inputData.length === 0 && outputData.length === 0}
    <div class="empty-chart">Waiting for data...</div>
  {:else}
    <svg viewBox="0 0 {width} {height}">
      {#each gridLines as line}
        <line x1="30" y1={line.y} x2={width} y2={line.y} stroke="#161625" stroke-width="1"/>
        <text x="26" y={line.y + 3} text-anchor="end" fill="#606080" font-size="9" font-family="monospace">{line.label}</text>
      {/each}

      <defs>
        <linearGradient id="chart-input-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={inputColor} stop-opacity="0.3"/>
          <stop offset="100%" stop-color={inputColor} stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="chart-output-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={outputColor} stop-opacity="0.2"/>
          <stop offset="100%" stop-color={outputColor} stop-opacity="0"/>
        </linearGradient>
      </defs>

      <polygon points={inputAreaPath} fill="url(#chart-input-grad)"/>
      <polyline points={inputPath} fill="none" {stroke="inputColor"} stroke-width="2"/>

      <polygon points={outputAreaPath} fill="url(#chart-output-grad)"/>
      <polyline points={outputPath} fill="none" {stroke="outputColor"} stroke-width="2"/>

      {#if labels.length > 0}
        {#each labels as label, i}
          <text x={30 + i * ((width - 40) / (labels.length - 1))} y={height - 2}
                text-anchor="middle" fill="#606080" font-size="8" font-family="monospace">{label}</text>
        {/each}
      {/if}

      {#if inputData.length > 0}
        <circle cx={inputData.length > 1 ? width - 10 : width / 2}
                cy={height - 10 - (inputData[inputData.length - 1] / maxVal) * (height - 20)}
                r="3" fill={inputColor}>
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>
        </circle>
      {/if}
      {#if outputData.length > 0}
        <circle cx={outputData.length > 1 ? width - 10 : width / 2}
                cy={height - 10 - (outputData[outputData.length - 1] / maxVal) * (height - 20)}
                r="3" fill={outputColor}>
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>
        </circle>
      {/if}
    </svg>
  {/if}
  <div class="chart-legend">
    <span><span class="dot" style="background:{inputColor}"></span> Input</span>
    <span><span class="dot" style="background:{outputColor}"></span> Output</span>
  </div>
</div>

<style>
  .chart-area { width: 100%; }
  .chart-legend { display: flex; gap: 16px; margin-top: 8px; font-size: 11px; color: var(--text-secondary); }
  .chart-legend .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .empty-chart { text-align: center; color: var(--text-muted); padding: 40px; font-size: 13px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/AreaChart.svelte
git commit -m "feat: add SVG AreaChart with animated data points"
```

---

### Task 6: Frontend — DonutChart Component

**Files:**
- Create: `web/src/components/DonutChart.svelte`

- [ ] **Step 1: Create DonutChart component**

Create `web/src/components/DonutChart.svelte`:

```javascript
<script>
  export let segments = [];
  export let size = 100;
  export let radius = 40;
  export let strokeWidth = 14;

  $: total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  $: circumference = 2 * Math.PI * radius;
  $: cx = size / 2;
  $: cy = size / 2;

  function segmentAttrs(seg, index) {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += (segments[i].value / total) * circumference;
    }
    const length = (seg.value / total) * circumference;
    return {
      dasharray: `${length} ${circumference - length}`,
      dashoffset: -offset,
    };
  }

  $: primaryPct = segments.length > 0 ? Math.round((segments[0].value / total) * 100) : 0;
</script>

<div class="donut-wrap">
  <svg {width="size"} {height="size"} viewBox="0 0 {size} {size}">
    <circle {cx} {cy} {r="radius"} fill="none" stroke="#161625" {stroke-width="strokeWidth"}/>
    {#each segments as seg, i}
      {@const attrs = segmentAttrs(seg, i)}
      <circle {cx} {cy} {r="radius"} fill="none"
              stroke={seg.color} {stroke-width="strokeWidth"}
              stroke-dasharray={attrs.dasharray}
              stroke-dashoffset={attrs.dashoffset}
              stroke-linecap="round"
              transform="rotate(-90 {cx} {cy})"/>
    {/each}
    <text {x="cx"} y={cy - 3} text-anchor="middle" fill="#e0e0f0" font-size="14" font-weight="700">{primaryPct}%</text>
    <text {x="cx"} y={cy + 12} text-anchor="middle" fill="#606080" font-size="8">{segments[0]?.label || ""}</text>
  </svg>
  <div class="donut-labels">
    {#each segments as seg}
      <div class="donut-label">
        <span class="dot" style="background:{seg.color}"></span>
        {seg.label} — {Math.round((seg.value / total) * 100)}%
      </div>
    {/each}
  </div>
</div>

<style>
  .donut-wrap { display: flex; align-items: center; gap: 20px; }
  .donut-labels { display: flex; flex-direction: column; gap: 4px; }
  .donut-label { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); }
  .donut-label .dot { width: 8px; height: 8px; border-radius: 50%; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/DonutChart.svelte
git commit -m "feat: add SVG DonutChart for model usage visualization"
```

---

### Task 7: Frontend — Heatmap + ProgressBar + AgentRow

**Files:**
- Create: `web/src/components/Heatmap.svelte`
- Create: `web/src/components/ProgressBar.svelte`
- Create: `web/src/components/AgentRow.svelte`

- [ ] **Step 1: Create Heatmap component**

Create `web/src/components/Heatmap.svelte`:

```javascript
<script>
  export let data = []; // 7x24 matrix: data[day][hour] = count

  const colors = ["#161625", "#1a2e1a", "#1a3e1a", "#2a5e2a", "#3a7e3a", "#4ade80"];

  function getColor(count, maxVal) {
    if (maxVal === 0) return colors[0];
    const intensity = count / maxVal;
    if (intensity === 0) return colors[0];
    if (intensity < 0.2) return colors[1];
    if (intensity < 0.4) return colors[2];
    if (intensity < 0.6) return colors[3];
    if (intensity < 0.8) return colors[4];
    return colors[5];
  }

  $: maxVal = data.length > 0 ? Math.max(...data.flat(), 1) : 1;
</script>

<div class="heatmap">
  {#each data as day, di}
    {#each day as count, hi}
      <div class="heatmap-cell"
           style="background: {getColor(count, maxVal)}"
           title="Day {di + 1}, {hi}:00 — {count} events"/>
    {/each}
  {/each}
</div>

<style>
  .heatmap { display: flex; gap: 2px; flex-wrap: wrap; }
  .heatmap-cell {
    width: 12px; height: 12px; border-radius: 2px; background: #161625;
    transition: transform 0.1s;
  }
  .heatmap-cell:hover { transform: scale(1.3); }
</style>
```

- [ ] **Step 2: Create ProgressBar component**

Create `web/src/components/ProgressBar.svelte`:

```javascript
<script>
  export let value = 0;
  export let max = 100;
  export let color = "#60a5fa";

  $: pct = max > 0 ? (value / max) * 100 : 0;
</script>

<div class="bar-track">
  <div class="bar-fill" style="width: {pct}%; background: {color}"></div>
</div>

<style>
  .bar-track { width: 60px; height: 4px; background: var(--bg-tertiary); border-radius: 2px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
</style>
```

- [ ] **Step 3: Create AgentRow component**

Create `web/src/components/AgentRow.svelte`:

```javascript
<script>
  export let name = "";
  export let type = "";
  export let status = "unknown";

  const statusConfig = {
    completed: { color: "var(--green)", bg: "rgba(74,222,128,0.15)" },
    running: { color: "var(--yellow)", bg: "rgba(251,191,36,0.15)" },
    failed: { color: "var(--red)", bg: "rgba(248,113,113,0.15)" },
    unknown: { color: "var(--text-muted)", bg: "rgba(96,96,128,0.15)" },
  };

  $: cfg = statusConfig[status] || statusConfig.unknown;
  $: initials = name.split(/[\s-_]+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
</script>

<div class="agent-item">
  <div class="agent-avatar" style="background: {cfg.bg}; color: {cfg.color};">{initials}</div>
  <div class="agent-info">
    <div class="agent-name">{name}</div>
    <div class="agent-type">{type}</div>
  </div>
  <span class="agent-status" style="background: {cfg.bg}; color: {cfg.color};">{status}</span>
</div>

<style>
  .agent-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: 8px; margin-bottom: 4px;
    background: var(--bg-secondary); transition: background 0.15s;
  }
  .agent-item:hover { background: var(--bg-tertiary); }
  .agent-avatar {
    width: 28px; height: 28px; border-radius: 50%; display: flex;
    align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
  }
  .agent-info { flex: 1; }
  .agent-name { font-size: 12px; font-weight: 600; }
  .agent-type { font-size: 10px; color: var(--text-muted); }
  .agent-status {
    font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600;
  }
</style>
```

- [ ] **Step 4: Create MemoryPanel component**

Create `web/src/components/MemoryPanel.svelte`:

```javascript
<script>
  import { events } from "../stores/events.js";

  $: e = $events;

  // Derive memory stats from events
  $: memoryStats = (() => {
    const files = new Set();
    let reads = 0, writes = 0, lastAccess = "—";
    for (const evt of e) {
      const mem = evt.data?.memory_accessed;
      if (!mem) continue;
      for (const f of mem.read || []) { files.add(f); reads++; if (evt.timestamp) lastAccess = evt.timestamp.slice(11, 19); }
      for (const f of mem.written || []) { files.add(f); writes++; if (evt.timestamp) lastAccess = evt.timestamp.slice(11, 19); }
    }
    return { count: files.size, reads, writes, lastAccess };
  })();
</script>

<div class="mem-grid">
  <div class="mem-card">
    <div class="mem-icon">👤</div>
    <div class="mem-label">User</div>
    <div class="mem-value" style="color: #60a5fa;">{memoryStats.reads}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">📝</div>
    <div class="mem-label">Writes</div>
    <div class="mem-value" style="color: #fbbf24;">{memoryStats.writes}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">🚀</div>
    <div class="mem-label">Files</div>
    <div class="mem-value" style="color: #4ade80;">{memoryStats.count}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">🔗</div>
    <div class="mem-label">References</div>
    <div class="mem-value" style="color: #a78bfa;">{memoryStats.count > 0 ? memoryStats.count : "—"}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">⏰</div>
    <div class="mem-label">Last Access</div>
    <div class="mem-value" style="color: #9090b0; font-size: 10px;">{memoryStats.lastAccess}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">📊</div>
    <div class="mem-label">Total Ops</div>
    <div class="mem-value" style="color: #9090b0; font-size: 12px;">{memoryStats.reads + memoryStats.writes}</div>
  </div>
</div>

<style>
  .mem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .mem-card {
    background: var(--bg-secondary); border-radius: 8px; padding: 10px; text-align: center;
    border: 1px solid var(--border); transition: border-color 0.15s;
  }
  .mem-card:hover { border-color: #3a3a5a; }
  .mem-icon { font-size: 18px; margin-bottom: 4px; }
  .mem-label { font-size: 10px; color: var(--text-secondary); margin-bottom: 2px; }
  .mem-value { font-size: 14px; font-weight: 700; }
</style>
```

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Heatmap.svelte web/src/components/ProgressBar.svelte web/src/components/AgentRow.svelte web/src/components/MemoryPanel.svelte
git commit -m "feat: add Heatmap, ProgressBar, AgentRow, MemoryPanel components"
```

---

### Task 8: Frontend — Dashboard View (Main Component)

**Files:**
- Create: `web/src/views/Dashboard.svelte`

- [ ] **Step 1: Create Dashboard view**

This is the main component that assembles all the pieces. Due to its size, it's broken into the actual implementation below.

Create `web/src/views/Dashboard.svelte`:

```javascript
<script>
  import { events, connected, filteredEvents } from "../stores/events.js";
  import { stats } from "../stores/stats.js";
  import { realtime, startRealtimePolling, stopRealtimePolling } from "../stores/realtime.js";
  import { sessions } from "../stores/sessions.js";
  import KPICard from "../components/KPICard.svelte";
  import Sparkline from "../components/Sparkline.svelte";
  import AreaChart from "../components/AreaChart.svelte";
  import DonutChart from "../components/DonutChart.svelte";
  import Heatmap from "../components/Heatmap.svelte";
  import ProgressBar from "../components/ProgressBar.svelte";
  import AgentRow from "../components/AgentRow.svelte";
  import MemoryPanel from "../components/MemoryPanel.svelte";
  import { onMount, onDestroy } from "svelte";

  let timeRange = "24h";
  let connectionStatus = "disconnected";

  $: r = $realtime;
  $: s = $stats;
  $: e = $events;
  $: sess = $sessions;
  $: conn = $connected;
  $: isConn = conn ? "connected" : "disconnected";

  // Derived data for charts
  $: inputTrend = (s.dailyTokens ? Object.values(s.dailyTokens).map(d => d.input) : []).slice(-14);
  $: outputTrend = (s.dailyTokens ? Object.values(s.dailyTokens).map(d => d.output) : []).slice(-14);
  $: chartLabels = (s.dailyTokens ? Object.keys(s.dailyTokens) : []).slice(-5).map(d => d.slice(5));

  // Model breakdown for donut
  $: modelSegments = Object.entries(s.modelBreakdown || {})
    .sort((a, b) => b[1].calls - a[1].calls)
    .slice(0, 3)
    .map(([name, data], i) => ({
      label: name,
      value: data.calls,
      color: ["#60a5fa", "#a78bfa", "#fbbf24"][i],
    }));

  // Tool rows
  $: toolRows = Object.entries(s.toolCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  $: maxTool = toolRows.length > 0 ? toolRows[0][1] : 1;
  $: toolColors = ["#60a5fa", "#4ade80", "#a78bfa", "#fbbf24", "#f87171", "#22d3ee", "#fb923c", "#e0e0f0"];

  // Skill rows
  $: skillRows = Object.entries(s.skillCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  $: skillColors = ["#4ade80", "#60a5fa", "#fbbf24", "#a78bfa", "#f87171"];

  // Agent rows
  $: agentList = buildAgentList(e);
  $: heatmapData = generateHeatmapData(e);
  $: memoryStats = buildMemoryStats(e);

  function buildAgentList(evts) {
    const agents = new Map();
    let counter = 0;
    for (const evt of evts) {
      if (evt.type === "agent_start") {
        counter++;
        agents.set(counter, { name: evt.data?.name || evt.data?.type || "unknown", type: evt.data?.type || "general-purpose", status: "running" });
      } else if (evt.type === "agent_end") {
        const entry = [...agents.entries()].reverse().find(([, a]) => a.status === "running");
        if (entry) entry[1].status = evt.data?.status || "completed";
      }
    }
    return [...agents.values()].slice(-4);
  }

  function generateHeatmapData(evts) {
    const data = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const evt of evts) {
      const ts = evt.timestamp || evt.receivedAt;
      if (!ts) continue;
      const date = new Date(ts);
      const day = 6 - Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      const hour = date.getHours();
      if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
        data[day][hour]++;
      }
    }
    return data;
  }

  function buildMemoryStats(evts) {
    const files = new Set();
    let reads = 0, writes = 0, lastAccess = "—";
    for (const evt of evts) {
      const mem = evt.data?.memory_accessed;
      if (!mem) continue;
      for (const f of mem.read || []) { files.add(f); reads++; if (evt.timestamp) lastAccess = evt.timestamp.slice(11, 19); }
      for (const f of mem.written || []) { files.add(f); writes++; if (evt.timestamp) lastAccess = evt.timestamp.slice(11, 19); }
    }
    return { count: files.size, reads, writes, lastAccess };
  }

  function formatTokens(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
  }

  // SVG icons as HTML strings
  const icons = {
    tokens: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>`,
    cost: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
    agents: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/></svg>`,
    tools: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
    skills: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
    errors: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  };

  onMount(() => {
    startRealtimePolling(5000);
    connected.subscribe((v) => { connectionStatus = v ? "connected" : "disconnected"; });
  });
  onDestroy(() => stopRealtimePolling());
</script>

<div class="dashboard">
  <!-- Header -->
  <div class="d-header">
    <div class="d-header-left">
      <svg class="d-logo" viewBox="0 0 36 36">
        <defs><linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#7c6fe0"/><stop offset="100%" style="stop-color:#4ade80"/></linearGradient></defs>
        <circle cx="18" cy="18" r="16" fill="none" stroke="url(#logo-grad)" stroke-width="2.5"/>
        <circle cx="18" cy="18" r="6" fill="#7c6fe0"/>
        <line x1="18" y1="2" x2="18" y2="12" stroke="#4ade80" stroke-width="1.5"/>
        <line x1="18" y1="24" x2="18" y2="34" stroke="#4ade80" stroke-width="1.5"/>
        <line x1="2" y1="18" x2="12" y2="18" stroke="#60a5fa" stroke-width="1.5"/>
        <line x1="24" y1="18" x2="34" y2="18" stroke="#60a5fa" stroke-width="1.5"/>
      </svg>
      <h1><span class="accent">CC</span> Observatory — Command Center</h1>
    </div>
    <div class="d-header-right">
      <div class="d-status-badge {isConn}">
        <span class="d-status-dot"></span>
        SSE {isConn === "connected" ? "Connected" : "Disconnected"}
      </div>
      <select bind:value={timeRange} class="d-time-filter">
        <option value="1h">Last 1 hour</option>
        <option value="6h">Last 6 hours</option>
        <option value="24h">Last 24 hours</option>
        <option value="7d">Last 7 days</option>
      </select>
    </div>
  </div>

  <!-- KPI Strip -->
  <div class="kpi-strip">
    <KPICard icon={icons.tokens} label="Total Tokens" value={formatTokens(r.totalTokens)} color="#60a5fa" sub={`${formatTokens(s.totalInputTokens)} in / ${formatTokens(s.totalOutputTokens)} out`} sparklineData={inputTrend} delay={0} />
    <KPICard icon={icons.cost} label="Est. Cost" value={"$" + r.totalCost.toFixed(4)} color="#4ade80" sparklineData={[]} delay={50} />
    <KPICard icon={icons.agents} label="Agent Calls" value={String(r.activeAgents)} color="#a78bfa" sub={`${Object.values(s.agentCounts || {}).reduce((a, b) => a + b, 0)} total`} delay={100} />
    <KPICard icon={icons.tools} label="Tool Calls" value={String(r.totalTools)} color="#fbbf24" sub={`${Object.keys(s.toolCounts || {}).length} tools`} delay={150} />
    <KPICard icon={icons.skills} label="Skills Used" value={String(r.totalSkills)} color="#f87171" sub={`${Object.keys(s.skillCounts || {}).length} unique`} delay={200} />
    <KPICard icon={icons.errors} label="Errors" value={String(r.errorCount)} color="#ef4444" sub={r.errorCount === 0 ? "All clear" : "Last: " + (r.recentErrors[0]?.timestamp?.slice(11, 19) || "unknown")} delay={250} />
  </div>

  <!-- Main Grid -->
  <div class="dashboard-grid">
    <!-- Token Trend Chart (span 3) -->
    <div class="d-panel d-chart-panel" style="animation-delay: 0.3s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(96,165,250,0.2); color: #60a5fa;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </span>
          Token & Cost Trend
        </div>
        <span class="d-badge" style="background: rgba(96,165,250,0.15); color: #60a5fa;">Live</span>
      </div>
      <AreaChart inputData={inputTrend} outputData={outputTrend} labels={chartLabels} />
    </div>

    <!-- Agent Activity -->
    <div class="d-panel" style="animation-delay: 0.35s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(167,139,250,0.2); color: #a78bfa;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/></svg>
          </span>
          Agent Activity
        </div>
        <span class="d-badge" style="background: rgba(167,139,250,0.15); color: #a78bfa;">{agentList.length} total</span>
      </div>
      {#if agentList.length === 0}
        <div class="empty-msg">No agent events yet.</div>
      {:else}
        {#each agentList as agent}
          <AgentRow name={agent.name} type={agent.type} status={agent.status} />
        {/each}
      {/if}
      <div class="agent-summary">
        <span style="color: var(--green);">● {agentList.filter(a => a.status === "completed").length} completed</span>
        <span style="color: var(--yellow);">● {agentList.filter(a => a.status === "running").length} running</span>
        <span style="color: var(--red);">● {agentList.filter(a => a.status === "failed").length} failed</span>
      </div>
    </div>

    <!-- Tool Calls -->
    <div class="d-panel" style="animation-delay: 0.4s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(251,191,36,0.2); color: #fbbf24;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          </span>
          Tool Calls
        </div>
        <span class="d-badge" style="background: rgba(251,191,36,0.15); color: #fbbf24;">{r.totalTools} total</span>
      </div>
      {#if toolRows.length === 0}
        <div class="empty-msg">No tool calls yet.</div>
      {:else}
        {#each toolRows as [name, count], i}
          <div class="tool-row">
            <div class="tool-name">{name}</div>
            <div class="tool-count">{count}</div>
            <ProgressBar value={count} max={maxTool} color={toolColors[i % toolColors.length]} />
          </div>
        {/each}
      {/if}
    </div>

    <!-- Skills Invoked -->
    <div class="d-panel" style="animation-delay: 0.45s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(248,113,113,0.2); color: #f87171;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          </span>
          Skills Invoked
        </div>
        <span class="d-badge" style="background: rgba(248,113,113,0.15); color: #f87171;">{r.totalSkills} calls</span>
      </div>
      {#if skillRows.length === 0}
        <div class="empty-msg">No skills invoked yet.</div>
      {:else}
        {#each skillRows as [name, count], i}
          <div class="skill-item">
            <span class="skill-name">{name}</span>
            <span class="skill-count">{count}</span>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Error Inspection -->
    <div class="d-panel" style="animation-delay: 0.5s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(239,68,68,0.2); color: #ef4444;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          Error Inspection
        </div>
        <span class="d-badge" style="background: rgba(239,68,68,0.15); color: #ef4444;">{r.errorCount} errors</span>
      </div>
      {#if r.recentErrors.length === 0}
        <div class="empty-msg" style="color: var(--green);">✓ All clear — no errors detected</div>
      {:else}
        {#each r.recentErrors.slice(0, 5) as err}
          <div class="error-item">
            <div class="error-dot" style="background: #ef4444;"></div>
            <div class="error-msg">{err.message}</div>
            <div class="error-time">{err.timestamp?.slice(11, 19) || ""}</div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Memory Stats -->
    <div class="d-panel" style="animation-delay: 0.52s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(74,222,128,0.2); color: #4ade80;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          </span>
          Memory
        </div>
        <span class="d-badge" style="background: rgba(74,222,128,0.15); color: #4ade80;">{memoryStats.count} files</span>
      </div>
      <MemoryPanel />
    </div>

    <!-- Model Usage Donut -->
    <div class="d-panel" style="animation-delay: 0.55s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(96,165,250,0.2); color: #60a5fa;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg>
          </span>
          Model Usage
        </div>
      </div>
      {#if modelSegments.length === 0}
        <div class="empty-msg">No model data yet.</div>
      {:else}
        <DonutChart segments={modelSegments} />
      {/if}
    </div>

    <!-- Activity Heatmap -->
    <div class="d-panel" style="animation-delay: 0.6s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(34,211,238,0.2); color: #22d3ee;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          Activity (7 days)
        </div>
      </div>
      <Heatmap data={heatmapData} />
    </div>

    <!-- Sessions Quick View -->
    <div class="d-panel" style="animation-delay: 0.65s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(34,211,238,0.2); color: #22d3ee;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </span>
          Sessions
        </div>
        <span class="d-badge" style="background: rgba(34,211,238,0.15); color: #22d3ee;">{sess.length}</span>
      </div>
      {#if sess.length === 0}
        <div class="empty-msg">No sessions yet.</div>
      {:else}
        {#each sess.slice(0, 6) as session}
          <div class="session-item">
            <div class="session-dot" style="background: {session.status === "active" ? "var(--green)" : "var(--text-muted)"};"></div>
            <div class="session-id">{session.id?.slice(0, 12) || "unknown"}</div>
            <div class="session-turns">{session.events?.length || 0} events</div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Bottom Strip -->
  <div class="dashboard-bottom">
    <div class="d-panel" style="animation-delay: 0.7s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(96,165,250,0.2); color: #60a5fa;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </span>
          Event Stream
        </div>
        <span class="d-badge" style="background: rgba(74,222,128,0.15); color: #4ade80;">● Live</span>
      </div>
      <div class="event-stream">
        {#each e.slice(-6).reverse() as evt}
          <div class="d-event-item">
            <span class="d-event-time">{(evt.timestamp || evt.receivedAt || "").slice(11, 19)}</span>
            <span class="event-type-badge" data-type={evt.type}>{evt.type?.replace("_end", "").replace("_start", "").toUpperCase()}</span>
            <span class="d-event-detail">{evt.data?.model || evt.data?.name || ""} {evt.data?.tokens_used ? `· tokens: ${((evt.data.tokens_used.input || 0) + (evt.data.tokens_used.output || 0)).toLocaleString()}` : ""}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="d-panel" style="animation-delay: 0.75s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(34,211,238,0.2); color: #22d3ee;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </span>
          Session Activity
        </div>
      </div>
      <div class="event-stream">
        {#each e.slice(-6).reverse() as evt}
          <div class="d-event-item">
            <span class="d-event-time">{(evt.timestamp || evt.receivedAt || "").slice(11, 19)}</span>
            <span class="event-type-badge" data-type={evt.type}>{evt.type?.replace("_end", "").replace("_start", "").toUpperCase()}</span>
            <span class="d-event-detail">{evt.session_id?.slice(0, 8)} · {evt.data?.tools_used?.join(", ") || ""}</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="d-panel" style="animation-delay: 0.8s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(34,211,238,0.2); color: #22d3ee;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
          </span>
          Quick Jump
        </div>
      </div>
      <div class="session-grid">
        {#each sess.slice(0, 4) as session}
          <div class="session-card">
            <div class="session-card-header">
              <div class="session-card-dot" style="background: {session.status === "active" ? "var(--green)" : "var(--text-muted)"};"></div>
              <span class="session-card-id">{session.id?.slice(0, 8) || "unknown"}</span>
            </div>
            <div class="session-card-body">{session.events?.length || 0} events</div>
          </div>
        {/each}
      </div>
      <div class="session-summary">
        <div class="summary-stat">
          <span class="summary-value" style="color: #60a5fa;">{s.totalTurns || 0}</span>
          <span class="summary-label">Turns</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value" style="color: #a78bfa;">{formatTokens((s.totalInputTokens || 0) + (s.totalOutputTokens || 0))}</span>
          <span class="summary-label">Tokens</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value" style="color: #4ade80;">${(s.totalCost || 0).toFixed(4)}</span>
          <span class="summary-label">Cost</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .dashboard { max-width: 1200px; margin: 0 auto; }

  /* Header */
  .d-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; margin-bottom: 20px;
    background: linear-gradient(135deg, #0f0f1a 0%, #161630 100%);
    border: 1px solid var(--border); border-radius: 14px;
  }
  .d-header-left { display: flex; align-items: center; gap: 14px; }
  .d-logo { width: 36px; height: 36px; }
  .d-header h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
  .d-header h1 .accent { color: var(--accent); }
  .d-header-right { display: flex; align-items: center; gap: 16px; }
  .d-time-filter { padding: 5px 12px; border-radius: 8px; background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-secondary); font-size: 12px; cursor: pointer; }

  /* KPI Strip */
  .kpi-strip { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 16px; }

  /* Grid */
  .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 320px; grid-template-rows: auto auto auto; gap: 12px; }
  .dashboard-bottom { display: grid; grid-template-columns: 1fr 1fr 320px; gap: 12px; margin-top: 12px; }

  /* Panel overrides */
  .d-chart-panel { grid-column: 1 / 4; }
  .d-panel { min-height: 100px; }

  /* Empty state */
  .empty-msg { text-align: center; color: var(--text-muted); padding: 20px; font-size: 12px; }

  /* Tool rows */
  .tool-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--bg-secondary); }
  .tool-row:last-child { border: none; }
  .tool-name { font-size: 12px; flex: 1; }
  .tool-count { font-size: 12px; color: var(--text-secondary); font-family: monospace; min-width: 30px; text-align: right; }

  /* Skill rows */
  .skill-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--bg-secondary); }
  .skill-item:last-child { border: none; }
  .skill-name { font-size: 11px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .skill-count { font-size: 11px; color: var(--text-secondary); font-family: monospace; }

  /* Error */
  .error-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--bg-secondary); }
  .error-item:last-child { border: none; }
  .error-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
  .error-msg { font-size: 11px; color: var(--text-secondary); flex: 1; }
  .error-time { font-size: 10px; color: var(--text-muted); font-family: monospace; white-space: nowrap; }

  /* Agent summary */
  .agent-summary { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--bg-secondary); font-size: 10px; color: var(--text-muted); display: flex; gap: 12px; }

  /* Session items */
  .session-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--bg-secondary); }
  .session-item:last-child { border: none; }
  .session-dot { width: 6px; height: 6px; border-radius: 50%; }
  .session-id { font-size: 11px; font-family: monospace; flex: 1; }
  .session-turns { font-size: 10px; color: var(--text-muted); }

  /* Event stream */
  .event-stream { max-height: 200px; overflow-y: auto; }
  .event-type-badge {
    padding: 1px 6px; border-radius: 3px; font-size: 9px;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    background: rgba(96,165,250,0.15); color: #60a5fa;
  }
  .event-type-badge[data-type="agent"] { background: rgba(167,139,250,0.15); color: #a78bfa; }
  .event-type-badge[data-type="session"] { background: rgba(74,222,128,0.15); color: #4ade80; }

  /* Session quick jump */
  .session-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
  .session-card {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px;
    padding: 12px; cursor: pointer; transition: border-color 0.15s;
  }
  .session-card:hover { border-color: var(--accent); }
  .session-card-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .session-card-dot { width: 6px; height: 6px; border-radius: 50%; }
  .session-card-id { font-size: 11px; font-weight: 600; font-family: monospace; }
  .session-card-body { font-size: 10px; color: var(--text-muted); }

  .session-summary { padding-top: 10px; border-top: 1px solid var(--bg-secondary); display: flex; gap: 16px; }
  .summary-stat { text-align: center; }
  .summary-value { font-size: 16px; font-weight: 700; }
  .summary-label { font-size: 9px; color: var(--text-muted); display: block; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/views/Dashboard.svelte
git commit -m "feat: add Dashboard homepage with bento grid layout and all panels"
```

---

### Task 9: Wire Dashboard into App + Update Sidebar

**Files:**
- Modify: `web/src/App.svelte`
- Modify: `web/src/stores/stats.js`

- [ ] **Step 1: Update App.svelte**

Modify `web/src/App.svelte`:

```javascript
<script>
  import Sidebar from "./components/Sidebar.svelte";
  import Dashboard from "./views/Dashboard.svelte";
  import LiveFeed from "./views/LiveFeed.svelte";
  import SessionTimeline from "./views/SessionTimeline.svelte";
  import MemoryInspector from "./views/MemoryInspector.svelte";
  import AgentChain from "./views/AgentChain.svelte";
  import SkillsUsage from "./views/SkillsUsage.svelte";
  import CostAnalytics from "./views/CostAnalytics.svelte";
  import SessionOverview from "./views/SessionOverview.svelte";

  import { connectSSE, fetchHistory } from "./stores/events.js";
  import { fetchSessions } from "./stores/sessions.js";
  import { fetchStats } from "./stores/stats.js";
  import { onMount } from "svelte";

  let view = "dashboard";
  let connectionStatus = "disconnected";

  const views = [
    { id: "dashboard", label: "Dashboard" },
    { id: "live", label: "Live Feed" },
    { id: "timeline", label: "Session Timeline" },
    { id: "memory", label: "Memory Inspector" },
    { id: "agents", label: "Agent Chain" },
    { id: "skills", label: "Skills Usage" },
    { id: "cost", label: "Cost & Tokens" },
    { id: "overview", label: "Session Overview" },
  ];

  async function init() {
    const evtSource = connectSSE();
    await fetchHistory();
    await fetchSessions();
    await fetchStats();

    setInterval(() => fetchSessions(), 10000);
    setInterval(() => fetchStats(), 15000);
  }

  onMount(() => {
    init();
    import("./stores/events.js").then(({ connected }) => {
      connected.subscribe((v) => {
        connectionStatus = v ? "connected" : "disconnected";
      });
    });
  });
</script>

<div class="app">
  <Sidebar {views} bind:view {connectionStatus} />
  <main class="content">
    {#if view === "dashboard"}
      <Dashboard />
    {:else if view === "live"}
      <LiveFeed />
    {:else if view === "timeline"}
      <SessionTimeline />
    {:else if view === "memory"}
      <MemoryInspector />
    {:else if view === "agents"}
      <AgentChain />
    {:else if view === "skills"}
      <SkillsUsage />
    {:else if view === "cost"}
      <CostAnalytics />
    {:else if view === "overview"}
      <SessionOverview />
    {/if}
  </main>
</div>

<style>
  .app {
    display: flex;
    min-height: 100vh;
  }
  .content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }
</style>
```

- [ ] **Step 2: Update stats.js for faster polling when dashboard is active**

The existing `fetchStats()` interval in App.svelte is 15s. This is fine since the realtime store handles the 5s KPI polling. No change needed to `web/src/stores/stats.js` — the `realtime.js` store handles the fast polling separately.

- [ ] **Step 3: Build and verify**

```bash
cd web && npx vite build
```

Expected: Build succeeds (may have a11y warnings, those are fine).

- [ ] **Step 4: Commit**

```bash
git add web/src/App.svelte
git commit -m "feat: wire Dashboard as default homepage in App router"
```

---

### Task 10: Integration Testing + Final Verification

**Files:**
- Modify: `server/test/api.test.js` (add realtime endpoint tests)

- [ ] **Step 1: Add realtime tests to API test suite**

Append to `server/test/api.test.js`:

```javascript
it("GET /stats/realtime returns KPI values", async () => {
  const { realtimeRoutes } = await import("../src/routes/realtime.js");
  const rtApp = new Hono();
  realtimeRoutes(rtApp);
  const res = await rtApp.request("/stats/realtime");
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(typeof data.totalTokens === "number");
  assert.ok(typeof data.totalCost === "number");
  assert.ok(Array.isArray(data.recentErrors));
});

it("GET /errors returns array", async () => {
  const { realtimeRoutes } = await import("../src/routes/realtime.js");
  const rtApp = new Hono();
  realtimeRoutes(rtApp);
  const res = await rtApp.request("/errors");
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
});
```

- [ ] **Step 2: Run all server tests**

```bash
cd server && node --test test/api.test.js
```

Expected: All 8 tests PASS.

- [ ] **Step 3: Start both servers and verify Dashboard loads**

```bash
# Terminal 1
npm run server

# Terminal 2
npm run dev
```

Open `http://localhost:5173` — Dashboard should be the default view.

- [ ] **Step 4: Inject test data and verify all panels populate**

```bash
curl -X POST http://localhost:3456/events -H "Content-Type: application/json" -d '{"type":"turn_end","session_id":"test-final","timestamp":"2026-04-17T10:30:00Z","project":"/test","data":{"turn_number":1,"model":"qwen3.6-plus","tokens_used":{"input":1200,"output":350},"tools_used":["Bash","Read"],"skills_invoked":["superpowers:brainstorming"],"agents_launched":[{"name":"Explore","type":"general-purpose","status":"completed"}]}}'
```

Verify: KPI strip updates, Event Stream shows the event, Agent Activity shows Explore.

- [ ] **Step 5: Run full test suite**

```bash
cd .. && npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/test/api.test.js
git commit -m "test: add realtime endpoint tests and verify integration"
```

---
