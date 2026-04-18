<script>
  import { events, connected } from "../stores/events.js";
  import { stats, eventRate } from "../stores/stats.js";
  import { realtime } from "../stores/realtime.js";
  import { sessions } from "../stores/sessions.js";
  import KPICard from "../components/KPICard.svelte";
  import AreaChart from "../components/AreaChart.svelte";
  import DonutChart from "../components/DonutChart.svelte";
  import Heatmap from "../components/Heatmap.svelte";
  import ProgressBar from "../components/ProgressBar.svelte";
  import AgentRow from "../components/AgentRow.svelte";
  import MemoryPanel from "../components/MemoryPanel.svelte";
  import SessionsActivityChart from "../components/SessionsActivityChart.svelte";
  import MCPServersPanel from "../components/MCPServersPanel.svelte";
  import { navigate } from "../router.js";
  import { onMount } from "svelte";

  let timeRange = "24h";
  let connectionStatus = "disconnected";

  $: r = $realtime;
  $: s = $stats;
  $: e = $events;
  $: sess = $sessions;
  $: er = $eventRate;
  $: maxRate = Math.max(1, ...er.buckets.map(b => b.turnCount + b.agentCount));
  $: activeSessions = er.active;
  $: totalEvents = er.totalEvents;
  $: totalTurns = (s.totalTurns || 0);
  $: hourlyBuckets = aggregateHourly(er.buckets);

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

  // MCP server rows
  $: mcpRows = Object.entries(s.mcpCounts || {})
    .sort((a, b) => b[1] - a[1]);
  $: maxMcp = mcpRows.length > 0 ? mcpRows[0][1] : 1;

  // Agent rows
  $: agentList = buildAgentList(e);
  $: heatmapData = generateHeatmapData(e);

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

  function formatTokens(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return String(n);
  }

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
    connected.subscribe((v) => { connectionStatus = v ? "connected" : "disconnected"; });
  });
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
    <KPICard icon={icons.tokens} label="Total Tokens" value={formatTokens(r.totalTokens)} color="#60a5fa" sub={`${formatTokens(s.totalInputTokens)} in / ${formatTokens(s.totalOutputTokens)} out`} sparklineData={inputTrend} delay={0} onClick={() => navigate("cost")} />
    <KPICard icon={icons.cost} label="Est. Cost" value={"$" + r.totalCost.toFixed(4)} color="#4ade80" sparklineData={[]} delay={50} onClick={() => navigate("cost")} />
    <KPICard icon={icons.agents} label="Agent Calls" value={String(r.activeAgents)} color="#a78bfa" sub={`${Object.values(s.agentCounts || {}).reduce((a, b) => a + b, 0)} total`} delay={100} />
    <KPICard icon={icons.tools} label="Tool Calls" value={String(r.totalTools)} color="#fbbf24" sub={`${Object.keys(s.toolCounts || {}).length} tools`} delay={150} onClick={() => navigate("tools")} />
    <KPICard icon={icons.skills} label="Skills Used" value={String(r.totalSkills)} color="#f87171" sub={`${Object.keys(s.skillCounts || {}).length} unique`} delay={200} onClick={() => navigate("tools")} />
    <KPICard icon={icons.errors} label="Errors" value={String(r.errorCount)} color="#ef4444" sub={r.errorCount === 0 ? "All clear" : "Last: " + (r.recentErrors[0]?.timestamp?.slice(11, 19) || "unknown")} delay={250} onClick={() => navigate("sessions")} />
  </div>

  <!-- Main Grid -->
  <div class="dashboard-grid">
    <!-- Token Trend Chart (span 3) -->
    <div class="d-panel d-chart-panel" style="animation-delay: 0.3s" on:click={() => navigate("cost")} role="button" tabindex="0">
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
    <div class="d-panel" style="animation-delay: 0.4s" on:click={() => navigate("sessions")} role="button" tabindex="0">
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
    <div class="d-panel" style="animation-delay: 0.45s" on:click={() => navigate("tools")} role="button" tabindex="0">
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
    <div class="d-panel" style="animation-delay: 0.5s" on:click={() => navigate("sessions")} role="button" tabindex="0">
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
    <div class="d-panel" style="animation-delay: 0.52s" on:click={() => navigate("memory")} role="button" tabindex="0">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(74,222,128,0.2); color: #4ade80;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          </span>
          Memory
        </div>
        <span class="d-badge" style="background: rgba(74,222,128,0.15); color: #4ade80;">{s.memoryStats.files} files</span>
      </div>
      <MemoryPanel />
    </div>

    <!-- Model Usage Donut -->
    <div class="d-panel" style="animation-delay: 0.55s" on:click={() => navigate("cost")} role="button" tabindex="0">
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
    <div class="d-panel" style="animation-delay: 0.6s" on:click={() => navigate("sessions")} role="button" tabindex="0">
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

    <!-- Skills & Plugins -->
    <div class="d-panel d-skills-plugins" style="animation-delay: 0.62s">
      <div class="d-panel-header">
        <div class="d-panel-title">
          <span class="icon" style="background: rgba(248,113,113,0.2); color: #f87171;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          </span>
          Skills & Plugins
        </div>
        <button class="d-more-btn" on:click={() => navigate("tools")}>More →</button>
      </div>
      {#if skillRows.length === 0}
        <div class="empty-msg">No skills or plugins used yet.</div>
      {:else}
        {#each skillRows as [name, count], i}
          <div class="skill-item">
            <span class="skill-badge" style="background: {skillColors[i % skillColors.length]}20; color: {skillColors[i % skillColors.length]};">{name}</span>
            <span class="skill-count">{count}</span>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Sessions Activity Chart (full width, Row 3) -->
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
  </div>

  <!-- Bottom Strip -->
  <div class="dashboard-bottom">
    <div class="d-panel" style="animation-delay: 0.7s" on:click={() => navigate("sessions")} role="button" tabindex="0">
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

    <div class="d-panel d-bottom-quick-jump" style="animation-delay: 0.8s">
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
  .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 320px; grid-template-rows: auto auto auto auto; gap: 12px; }
  .dashboard-bottom { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 12px; }

  /* Panel overrides */
  .d-chart-panel { grid-column: 1 / 4; }
  .d-skills-plugins { grid-column: 3 / 5; }
  .d-bottom-quick-jump { grid-column: 2 / 4; }
  .d-sessions-activity { grid-column: 1 / 3; }
  .d-mcp-servers { grid-column: 3 / 5; }
  .d-panel { min-height: 100px; }
  .d-panel[role="button"] { cursor: pointer; }
  .d-panel[role="button"]:hover { border-color: #3a3a5a; }

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

  /* Skills & Plugins card */
  .d-more-btn {
    background: none; border: none; color: var(--accent); font-size: 11px;
    font-weight: 600; cursor: pointer; padding: 2px 8px; border-radius: 4px;
    transition: background 0.15s;
  }
  .d-more-btn:hover { background: rgba(124,111,224,0.15); }
  .skill-badge {
    font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600;
    font-family: monospace; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; max-width: 180px;
  }

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
</style>
