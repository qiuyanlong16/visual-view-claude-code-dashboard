<script>
  import { events } from "../stores/events.js";
  import { sessions } from "../stores/sessions.js";
  import { stats, eventRate } from "../stores/stats.js";

  $: sessionList = $sessions;
  $: e = $events;
  $: s = $stats;
  $: er = $eventRate;
  $: maxRate = Math.max(1, ...er.buckets.map(b => b.turnCount + b.agentCount));

  let expandedSession = null;

  function timeAgo(ts) {
    if (!ts) return "unknown";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
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
    {#if er.buckets.length === 0}
      <div class="empty-msg">No events in last 2 hours.</div>
    {:else}
      <div class="event-rate-chart">
        {#each er.buckets as bucket}
          <div class="rate-bar" title="{bucket.time}: {bucket.turnCount} turns, {bucket.agentCount} agent events">
            <div class="rate-bar-turn" style="height: {(bucket.turnCount / maxRate) * 100}%"></div>
            <div class="rate-bar-agent" style="height: {(bucket.agentCount / maxRate) * 100}%"></div>
          </div>
        {/each}
      </div>
      <div class="event-rate-labels">
        <span>{er.buckets[0]?.time || "--:--"}</span>
        <span>{er.buckets[er.buckets.length - 1]?.time || "--:--"}</span>
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
            <span class="session-id">{session.id?.slice(0, 8) || "unknown"}</span>
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
          {#if expandedSession === session.id && getSessionEvents(session.id).length > 0}
            <div class="session-timeline">
              {#each getSessionEvents(session.id) as evt}
                  <div class="timeline-event" class:is-active={session.status === "active" || session.status === "running"}>
                    <span class="timeline-time">{(evt.timestamp || evt.receivedAt || "").slice(11, 19)}</span>
                    <span class="timeline-badge" data-type={evt.type.replace("_end", "").replace("_start", "")}>{evt.type.replace("_end", "").replace("_start", "").toUpperCase()}</span>
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
