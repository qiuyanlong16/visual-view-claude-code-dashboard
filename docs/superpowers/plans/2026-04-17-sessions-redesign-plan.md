# Sessions Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Live Feed and Session Overview with a unified Sessions page, add real-time event rate bar chart to Dashboard, and add a new `/stats/events-rate` server endpoint.

**Architecture:** Server provides 5-minute bucketed event counts via new endpoint. Dashboard renders a clickable CSS bar chart. Unified Sessions page combines aggregate stats, event rate chart, session cards, and expandable timelines in one view.

**Tech Stack:** Hono.js (server), Svelte 5 (frontend), pure CSS bar charts

---

### Task 1: Server — Add `/stats/events-rate` endpoint

**Files:**
- Modify: `server/src/routes/stats.js`
- Create: `server/test/events-rate.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/test/events-rate.test.js`:

```javascript
import { describe, it } from "node:test";
import assert from "node:assert";
import { Hono } from "hono";
import { statsRoutes } from "../src/routes/stats.js";

describe("events-rate endpoint", async () => {
  const app = new Hono();
  statsRoutes(app);

  it("GET /stats/events-rate returns buckets with correct shape", async () => {
    const res = await app.request("/stats/events-rate");
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.buckets));
    assert.ok(typeof data.active === "number");
    assert.ok(typeof data.totalEvents === "number");
    if (data.buckets.length > 0) {
      const b = data.buckets[0];
      assert.ok(typeof b.time === "string"); // "HH:MM" format
      assert.ok(typeof b.turnCount === "number");
      assert.ok(typeof b.agentCount === "number");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/test/events-rate.test.js`
Expected: FAIL — endpoint does not exist yet (returns 404).

- [ ] **Step 3: Add the `/stats/events-rate` endpoint**

Append this route to the `statsRoutes` function in `server/src/routes/stats.js`, before the closing `}` of the function:

```javascript
  app.get("/stats/events-rate", (c) => {
    const events = getEvents(null, 10000);
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Filter events to last 2 hours
    const recent = events.filter((e) => {
      const ts = e.timestamp || e.receivedAt;
      return ts && new Date(ts) >= twoHoursAgo;
    });

    // Group into 5-minute buckets (24 buckets max)
    const bucketMap = new Map();
    for (const evt of recent) {
      const ts = new Date(evt.timestamp || evt.receivedAt);
      const bucketMinute = Math.floor(ts.getMinutes() / 5) * 5;
      const key = `${ts.getHours().toString().padStart(2, "0")}:${bucketMinute.toString().padStart(2, "0")}`;

      if (!bucketMap.has(key)) {
        bucketMap.set(key, { time: key, turnCount: 0, agentCount: 0 });
      }
      const bucket = bucketMap.get(key);
      if (evt.type === "turn_end") bucket.turnCount++;
      if (evt.type === "agent_start" || evt.type === "agent_end") bucket.agentCount++;
    }

    // Fill all 5-minute slots between first and last event
    const buckets = [];
    if (bucketMap.size > 0) {
      const keys = [...bucketMap.keys()].sort();
      const firstParts = keys[0].split(":");
      let currentMin = parseInt(firstParts[0]) * 60 + parseInt(firstParts[1]);
      const lastParts = keys[keys.length - 1].split(":");
      const lastMin = parseInt(lastParts[0]) * 60 + parseInt(lastParts[1]);

      while (currentMin <= lastMin) {
        const h = Math.floor(currentMin / 60);
        const m = currentMin % 60;
        const key = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        buckets.push(bucketMap.get(key) || { time: key, turnCount: 0, agentCount: 0 });
        currentMin += 5;
      }
    }

    // Count active sessions
    const sessions = getSessions();
    const active = sessions.filter((s) => s.status === "active" || s.status === "running").length;

    return c.json({
      buckets,
      active,
      totalEvents: recent.length,
    });
  });
```

Note: `getSessions` is imported from `../store.js` — add it to the existing import at the top of the file. The current import line is:

```javascript
import { getEvents, getEventCount, getEventsByType } from "../store.js";
```

Change to:

```javascript
import { getEvents, getEventCount, getEventsByType, getSessions } from "../store.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/test/events-rate.test.js`
Expected: PASS

- [ ] **Step 5: Verify endpoint manually**

Run: `curl -s http://localhost:3456/stats/events-rate | head -200`
Expected: JSON with `buckets` array (may be empty if no events in last 2 hours), `active` count, `totalEvents` count.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/stats.js server/test/events-rate.test.js
git commit -m "feat: add /stats/events-rate endpoint with 5-min bucketed event counts"
```

---

### Task 2: Router — Update routes for new navigation

**Files:**
- Modify: `web/src/router.js`

- [ ] **Step 1: Update routes array**

Current content:
```javascript
const routes = ["dashboard", "live", "timeline", "memory", "tools", "cost", "overview", "playbook"];
```

Change to:
```javascript
const routes = ["dashboard", "sessions", "memory", "tools", "cost", "playbook"];
```

This removes `"live"`, `"timeline"`, and `"overview"`, and adds `"sessions"`.

- [ ] **Step 2: Commit**

```bash
git add web/src/router.js
git commit -m "feat: update router for sessions page, remove live/timeline/overview routes"
```

---

### Task 3: App.svelte — Update imports and routing

**Files:**
- Modify: `web/src/App.svelte`

- [ ] **Step 1: Replace LiveFeed import with Sessions import**

Current lines 4 and 9:
```javascript
  import LiveFeed from "./views/LiveFeed.svelte";
  import SessionOverview from "./views/SessionOverview.svelte";
```

Change to:
```javascript
  import Sessions from "./views/Sessions.svelte";
```

Remove both `LiveFeed` and `SessionOverview` imports.

- [ ] **Step 2: Update views array**

Current views array:
```javascript
  const views = [
    { id: "dashboard", label: "Dashboard" },
    { id: "live", label: "Live Feed" },

    { id: "memory", label: "Memory Inspector" },
    { id: "tools", label: "Tools" },
    { id: "cost", label: "Cost & Tokens" },
    { id: "overview", label: "Session Overview" },
    { id: "playbook", label: "CC Playbook" },
  ];
```

Change to:
```javascript
  const views = [
    { id: "dashboard", label: "Dashboard" },
    { id: "sessions", label: "Sessions" },
    { id: "memory", label: "Memory Inspector" },
    { id: "tools", label: "Tools" },
    { id: "cost", label: "Cost & Tokens" },
    { id: "playbook", label: "CC Playbook" },
  ];
```

- [ ] **Step 3: Update route handlers**

Current route handlers (lines 61-73):
```svelte
    {:else if $currentRoute === "live"}
      <LiveFeed />
    {:else if $currentRoute === "memory"}
```

Remove the `"live"` handler. Replace the `"overview"` handler:

```svelte
    {:else if $currentRoute === "overview"}
      <SessionOverview />
```

With:
```svelte
    {:else if $currentRoute === "sessions"}
      <Sessions />
```

The final route section should look like:
```svelte
    {#if $currentRoute === "dashboard"}
      <Dashboard />
    {:else if $currentRoute === "sessions"}
      <Sessions />
    {:else if $currentRoute === "memory"}
      <MemoryInspector />
    {:else if $currentRoute === "tools"}
      <SkillsUsage />
    {:else if $currentRoute === "cost"}
      <CostAnalytics />
    {:else if $currentRoute === "playbook"}
      <CCPlaybook />
    {/if}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/App.svelte
git commit -m "feat: wire up Sessions page, remove Live Feed and Session Overview"
```

---

### Task 4: Dashboard — Replace Sessions panel with bar chart

**Files:**
- Modify: `web/src/views/Dashboard.svelte`

- [ ] **Step 1: Add event rate reactive declarations**

Add these lines after the existing `$: sess = $sessions;` line (around line 22):

```javascript
  $: eventRate = buildEventRate(e);
  $: maxRate = Math.max(1, ...eventRate.map(b => b.turnCount + b.agentCount));
  $: activeSessions = sess.filter(s => s.status === "active" || s.status === "running").length;
  $: totalEvents = e.length;
  $: totalTurns = (s.totalTurns || 0);

  function buildEventRate(evts) {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const recent = evts.filter((e) => {
      const ts = e.timestamp || e.receivedAt;
      return ts && new Date(ts) >= twoHoursAgo;
    });
    const bucketMap = new Map();
    for (const evt of recent) {
      const ts = new Date(evt.timestamp || evt.receivedAt);
      const bucketMinute = Math.floor(ts.getMinutes() / 5) * 5;
      const key = `${ts.getHours().toString().padStart(2, "0")}:${bucketMinute.toString().padStart(2, "0")}`;
      if (!bucketMap.has(key)) {
        bucketMap.set(key, { time: key, turnCount: 0, agentCount: 0 });
      }
      const bucket = bucketMap.get(key);
      if (evt.type === "turn_end") bucket.turnCount++;
      if (evt.type === "agent_start" || evt.type === "agent_end") bucket.agentCount++;
    }
    // Fill all 5-min slots
    const buckets = [];
    if (bucketMap.size > 0) {
      const keys = [...bucketMap.keys()].sort();
      const firstParts = keys[0].split(":");
      let currentMin = parseInt(firstParts[0]) * 60 + parseInt(firstParts[1]);
      const lastParts = keys[keys.length - 1].split(":");
      const lastMin = parseInt(lastParts[0]) * 60 + parseInt(lastParts[1]);
      while (currentMin <= lastMin) {
        const h = Math.floor(currentMin / 60);
        const m = currentMin % 60;
        const key = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        buckets.push(bucketMap.get(key) || { time: key, turnCount: 0, agentCount: 0 });
        currentMin += 5;
      }
    }
    return buckets;
  }
```

- [ ] **Step 2: Replace the "Sessions" panel**

Current "Sessions Quick View" panel (lines 327-349):

```svelte
    <!-- Sessions Quick View -->
    <div class="d-panel" style="animation-delay: 0.65s" on:click={() => navigate("overview")} role="button" tabindex="0">
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
```

Replace entirely with:

```svelte
    <!-- Sessions Activity Chart -->
    <div class="d-panel" style="animation-delay: 0.65s" on:click={() => navigate("sessions")} role="button" tabindex="0">
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
      {#if eventRate.length === 0}
        <div class="empty-msg">No events in last 2 hours.</div>
      {:else}
        <div class="event-rate-chart">
          {#each eventRate as bucket}
            <div class="rate-bar" title="{bucket.time}: {bucket.turnCount} turns, {bucket.agentCount} agent events">
              <div class="rate-bar-turn" style="height: {(bucket.turnCount / maxRate) * 100}%"></div>
              <div class="rate-bar-agent" style="height: {(bucket.agentCount / maxRate) * 100}%"></div>
            </div>
          {/each}
        </div>
        <div class="event-rate-labels">
          <span>-2h</span>
          <span>now</span>
        </div>
      {/if}
    </div>
```

- [ ] **Step 3: Add CSS for the bar chart**

Add these styles at the end of the `<style>` block (before `</style>`):

```css
  /* Session activity chart */
  .session-activity-stats { display: flex; gap: 10px; font-size: 10px; color: var(--text-muted); }
  .sa-stat { display: flex; gap: 3px; align-items: center; }

  .event-rate-chart {
    display: flex; align-items: flex-end; gap: 2px; height: 80px; padding: 8px 0;
    border-bottom: 1px solid var(--bg-secondary);
  }
  .event-rate-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 4px; }

  .rate-bar {
    flex: 1; display: flex; flex-direction: column-reverse; height: 100%;
    min-height: 2px; border-radius: 2px 2px 0 0; overflow: hidden;
  }
  .rate-bar-turn { background: #60a5fa; min-height: 1px; transition: height 0.3s; }
  .rate-bar-agent { background: #fbbf24; min-height: 1px; transition: height 0.3s; }
```

- [ ] **Step 4: Fix the KPI "Sessions Active" card if it exists**

Also fix the Errors KPI card's `navigate("live")` on line 145 — change to `navigate("sessions")`:

```svelte
    <KPICard icon={icons.errors} label="Errors" value={String(r.errorCount)} color="#ef4444" sub={r.errorCount === 0 ? "All clear" : "Last: " + (r.recentErrors[0]?.timestamp?.slice(11, 19) || "unknown")} delay={250} onClick={() => navigate("sessions")} />
```

Also fix the "Event Stream" panel on line 354 — change `navigate("live")` to `navigate("sessions")`:

```svelte
    <div class="d-panel" style="animation-delay: 0.7s" on:click={() => navigate("sessions")} role="button" tabindex="0">
```

And fix the Activity Heatmap panel on line 292 — change `navigate("overview")` to `navigate("sessions")`:

```svelte
    <div class="d-panel" style="animation-delay: 0.6s" on:click={() => navigate("sessions")} role="button" tabindex="0">
```

And fix the Quick Jump panel on line 328 — change `navigate("overview")` to `navigate("sessions")`:

```svelte
    <div class="d-panel" style="animation-delay: 0.65s" on:click={() => navigate("sessions")} role="button" tabindex="0">
```

Wait — the Quick Jump panel is the Sessions panel that was already replaced in Step 2. Just fix:
- Line 145: Errors KPI `navigate("live")` → `navigate("sessions")`
- Line 354: Event Stream panel `navigate("live")` → `navigate("sessions")`
- Line 292: Activity Heatmap `navigate("overview")` → `navigate("sessions")`

- [ ] **Step 5: Verify build**

Run: `cd web && npx vite build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/src/views/Dashboard.svelte
git commit -m "feat: add event rate bar chart to Dashboard Sessions Activity panel"
```

---

### Task 5: Create unified Sessions page

**Files:**
- Create: `web/src/views/Sessions.svelte`

- [ ] **Step 1: Create the Sessions component**

Create `web/src/views/Sessions.svelte` with this full content:

```svelte
<script>
  import { events } from "../stores/events.js";
  import { sessions } from "../stores/sessions.js";
  import { stats } from "../stores/stats.js";
  import { onMount } from "svelte";

  $: sessionList = $sessions;
  $: e = $events;
  $: s = $stats;
  $: eventRate = buildEventRate(e);
  $: maxRate = Math.max(1, ...eventRate.map(b => b.turnCount + b.agentCount));

  let expandedSession = null;

  function buildEventRate(evts) {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const recent = evts.filter((evt) => {
      const ts = evt.timestamp || evt.receivedAt;
      return ts && new Date(ts) >= twoHoursAgo;
    });
    const bucketMap = new Map();
    for (const evt of recent) {
      const ts = new Date(evt.timestamp || evt.receivedAt);
      const bucketMinute = Math.floor(ts.getMinutes() / 5) * 5;
      const key = `${ts.getHours().toString().padStart(2, "0")}:${bucketMinute.toString().padStart(2, "0")}`;
      if (!bucketMap.has(key)) {
        bucketMap.set(key, { time: key, turnCount: 0, agentCount: 0 });
      }
      const bucket = bucketMap.get(key);
      if (evt.type === "turn_end") bucket.turnCount++;
      if (evt.type === "agent_start" || evt.type === "agent_end") bucket.agentCount++;
    }
    const buckets = [];
    if (bucketMap.size > 0) {
      const keys = [...bucketMap.keys()].sort();
      const firstParts = keys[0].split(":");
      let currentMin = parseInt(firstParts[0]) * 60 + parseInt(firstParts[1]);
      const lastParts = keys[keys.length - 1].split(":");
      const lastMin = parseInt(lastParts[0]) * 60 + parseInt(lastParts[1]);
      while (currentMin <= lastMin) {
        const h = Math.floor(currentMin / 60);
        const m = currentMin % 60;
        const key = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        buckets.push(bucketMap.get(key) || { time: key, turnCount: 0, agentCount: 0 });
        currentMin += 5;
      }
    }
    return buckets;
  }

  function timeAgo(ts) {
    if (!ts) return "unknown";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  }

  function formatTokens(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
  }

  function getSessionEvents(sessionId) {
    return e.filter((evt) => evt.session_id === sessionId).sort((a, b) => {
      const ta = a.timestamp || a.receivedAt || "";
      const tb = b.timestamp || b.receivedAt || "";
      return ta.localeCompare(tb);
    });
  }

  function getUniqueTools(sessionEvents) {
    const tools = new Set();
    for (const evt of sessionEvents) {
      for (const t of evt.data?.tools_used || []) tools.add(t);
    }
    return tools.size;
  }
</script>

<div class="sessions">
  <h2>Sessions</h2>

  <!-- Aggregate Stats Bar -->
  <div class="aggregate">
    <div class="stat" style="border-left: 3px solid #60a5fa;">
      <span class="label">Sessions</span>
      <span class="value" style="color: #60a5fa;">{sessionList.length}</span>
    </div>
    <div class="stat" style="border-left: 3px solid #4ade80;">
      <span class="label">Events</span>
      <span class="value" style="color: #4ade80;">{e.length}</span>
    </div>
    <div class="stat" style="border-left: 3px solid #fbbf24;">
      <span class="label">Turns</span>
      <span class="value" style="color: #fbbf24;">{s.totalTurns ?? 0}</span>
    </div>
    <div class="stat" style="border-left: 3px solid #f87171;">
      <span class="label">Tokens</span>
      <span class="value" style="color: #f87171;">{formatTokens((s.totalInputTokens ?? 0) + (s.totalOutputTokens ?? 0))}</span>
    </div>
    <div class="stat" style="border-left: 3px solid #c084fc;">
      <span class="label">Cost</span>
      <span class="value" style="color: #c084fc;">${(s.totalCost ?? 0).toFixed(2)}</span>
    </div>
  </div>

  <!-- Event Rate Chart -->
  <div class="chart-panel">
    <div class="chart-header">
      <span class="chart-title">Event Rate (last 2 hours)</span>
    </div>
    {#if eventRate.length === 0}
      <div class="empty-msg">No events in last 2 hours.</div>
    {:else}
      <div class="event-rate-chart">
        {#each eventRate as bucket}
          <div class="rate-bar" title="{bucket.time}: {bucket.turnCount} turns, {bucket.agentCount} agent events">
            <div class="rate-bar-turn" style="height: {(bucket.turnCount / maxRate) * 100}%"></div>
            <div class="rate-bar-agent" style="height: {(bucket.agentCount / maxRate) * 100}%"></div>
          </div>
        {/each}
      </div>
      <div class="event-rate-labels">
        <span>{eventRate[0]?.time || "--:--"}</span>
        <span>{eventRate[eventRate.length - 1]?.time || "--:--"}</span>
      </div>
    {/if}
  </div>

  <!-- Session Cards -->
  <h3>Sessions ({sessionList.length})</h3>

  {#if sessionList.length === 0}
    <div class="empty">No sessions recorded yet.</div>
  {:else}
    <div class="session-grid">
      {#each sessionList as session}
        <div class="session-card" class:expanded={expandedSession === session.id} class:active={session.status === "active" || session.status === "running"}>
          <div class="session-header" on:click={() => expandedSession = expandedSession === session.id ? null : session.id}>
            <span class="session-id">{session.id.slice(0, 8)}</span>
            <span class="status-badge" class:active={session.status === "active" || session.status === "running"}>
              {session.status === "active" || session.status === "running" ? "active" : "ended"}
            </span>
          </div>
          <div class="session-body">
            <div class="session-meta">
              <span>{(session.events?.length ?? 0)} events</span>
              <span>{timeAgo(session.updatedAt || session.createdAt)}</span>
              <span>{getUniqueTools(getSessionEvents(session.id))} tools</span>
            </div>
          </div>

          <!-- Expandable Timeline -->
          {#if expandedSession === session.id}
            {#const sessionEvents = getSessionEvents(session.id)}
            {#if sessionEvents.length > 0}
              <div class="session-timeline">
                {#each sessionEvents as evt}
                  <div class="timeline-event" class:is-active={session.status === "active" || session.status === "running"}>
                    <span class="timeline-time">{(evt.timestamp || evt.receivedAt || "").slice(11, 19)}</span>
                    <span class="timeline-badge" data-type={evt.type}>{evt.type.replace("_end", "").replace("_start", "").toUpperCase()}</span>
                    {#if evt.data?.tools_used && evt.data.tools_used.length > 0}
                      <span class="timeline-tools">{evt.data.tools_used.join(", ")}</span>
                    {/if}
                    {#if evt.data?.name || evt.data?.type}
                      <span class="timeline-agent">{evt.data.name || evt.data.type}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-msg">No events for this session.</div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sessions { max-width: 1000px; margin: 0 auto; }
  h2 { font-size: 18px; margin-bottom: 16px; }
  h3 { font-size: 14px; margin-bottom: 12px; color: var(--text-secondary); }

  /* Aggregate Stats */
  .aggregate { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
  .stat {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px;
    padding: 12px 16px; display: flex; flex-direction: column; align-items: center; min-width: 100px;
  }
  .stat .label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
  .stat .value { font-size: 20px; font-weight: 700; margin-top: 2px; }

  /* Chart Panel */
  .chart-panel {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px; margin-bottom: 24px;
  }
  .chart-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
  .chart-header { margin-bottom: 10px; }

  .event-rate-chart {
    display: flex; align-items: flex-end; gap: 2px; height: 100px; padding: 8px 0;
    border-bottom: 1px solid var(--bg-secondary);
  }
  .event-rate-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 4px; }

  .rate-bar {
    flex: 1; display: flex; flex-direction: column-reverse; height: 100%;
    min-height: 2px; border-radius: 2px 2px 0 0; overflow: hidden;
  }
  .rate-bar-turn { background: #60a5fa; min-height: 1px; transition: height 0.3s; }
  .rate-bar-agent { background: #fbbf24; min-height: 1px; transition: height 0.3s; }

  /* Session Grid */
  .session-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }

  .session-card {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px;
    padding: 12px; transition: border-color 0.15s;
  }
  .session-card.active { border-left: 3px solid #4ade80; }
  .session-card.expanded { border-color: var(--accent); }

  .session-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
  .session-id { font-family: monospace; font-size: 13px; font-weight: 600; }

  .status-badge {
    font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 600;
  }
  .status-badge.active { background: rgba(74,222,128,0.2); color: #4ade80; }
  .status-badge:not(.active) { background: rgba(239,68,68,0.2); color: #ef4444; }

  .session-body { font-size: 12px; color: var(--text-secondary); }
  .session-meta { display: flex; gap: 12px; margin-top: 8px; font-size: 11px; color: var(--text-muted); }

  /* Timeline */
  .session-timeline {
    margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border);
    border-left: 2px solid var(--bg-secondary); padding-left: 12px;
    max-height: 240px; overflow-y: auto;
  }

  .timeline-event {
    display: flex; align-items: center; gap: 8px; padding: 4px 0;
    font-size: 11px; position: relative;
  }
  .timeline-event::before {
    content: ""; position: absolute; left: -5px; top: 50%; transform: translateY(-50%);
    width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted);
  }
  .timeline-event.is-active:last-child::before {
    background: #4ade80;
    box-shadow: 0 0 6px #4ade80;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: translateY(-50%) scale(1); }
    50% { opacity: 0.6; transform: translateY(-50%) scale(1.3); }
  }

  .timeline-time { font-family: monospace; color: var(--text-muted); min-width: 56px; font-size: 10px; }

  .timeline-badge {
    font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 3px;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .timeline-badge[data-type="turn"] { background: rgba(96,165,250,0.15); color: #60a5fa; }
  .timeline-badge[data-type="session"] { background: rgba(74,222,128,0.15); color: #4ade80; }
  .timeline-badge[data-type="agent"] { background: rgba(251,191,36,0.15); color: #fbbf24; }

  .timeline-tools { font-family: monospace; color: var(--text-secondary); font-size: 10px; }
  .timeline-agent { color: var(--text-muted); font-size: 10px; }

  .empty { text-align: center; color: var(--text-muted); padding: 40px; }
  .empty-msg { text-align: center; color: var(--text-muted); padding: 16px; font-size: 12px; }
</style>
```

- [ ] **Step 2: Verify build**

Run: `cd web && npx vite build`
Expected: Build succeeds with no new errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/views/Sessions.svelte
git commit -m "feat: create unified Sessions page with stats, chart, cards, and timelines"
```

---

### Task 6: Delete old files

**Files:**
- Delete: `web/src/views/LiveFeed.svelte`
- Delete: `web/src/views/SessionOverview.svelte`

- [ ] **Step 1: Remove old view files**

```bash
git rm web/src/views/LiveFeed.svelte web/src/views/SessionOverview.svelte
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove Live Feed and Session Overview pages"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full build check**

Run: `cd web && npx vite build`
Expected: Build succeeds. Output similar to:
```
✓ 153 modules transformed.
dist/index.html   0.41 kB │ gzip: 0.28 kB
dist/assets/index-*.css  ~26 kB │ gzip: ~5 kB
dist/assets/index-*.js   ~123 kB │ gzip: ~40 kB
✓ built in <1s
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Verify navigation flow**

Start both servers:
```bash
npm run server    # Hono on :3456
npm run dev       # Svelte on :5173
```

Open http://localhost:5173 and verify:
1. Sidebar shows: Dashboard, Sessions, Memory Inspector, Tools, Cost & Tokens, CC Playbook (no "Live Feed", no "Session Overview", no "Session Timeline")
2. Dashboard "Sessions Activity" panel shows bar chart with colored bars
3. Click on "Sessions Activity" panel → navigates to Sessions page
4. Sessions page shows: aggregate stats, event rate chart, session cards
5. Click on a session card → expands timeline below it
6. Click again → collapses timeline
7. Active sessions have green left border

- [ ] **Step 4: Commit everything**

```bash
git add -A
git commit -m "feat: sessions page redesign complete"
```
