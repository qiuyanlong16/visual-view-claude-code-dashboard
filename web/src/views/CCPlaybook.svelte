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
        if (agentStartCount > 1 && !p.parallelAgent) p.parallelAgent = true;
        const name = (evt.data?.name || evt.data?.type || "").toLowerCase();
        if (name.includes("plan")) p.planMode = true;
        if (name.includes("review")) p.codeReview = true;
      }
      if (evt.type === "agent_end") agentEndCount++;
      if (evt.type === "agent_start" && agentStartCount > 0) p.subagentDriven = true;
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
      html += `<div class="pb-check-item ${c.ok ? 'ok' : 'fail'}">
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
      html += `<div class="pb-pattern-item ${active ? 'active' : 'inactive'}">
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
      const bashEvents = evts.slice(-50).filter(evt =>
        evt.data?.tools_used?.includes("Bash")
      );

      if (bashEvents.length > 20) {
        html += `<div class="pb-issue pb-warning">
          <span class="pb-issue-icon">&#9889;</span>
          <div class="pb-issue-body">
            <strong>High Bash usage</strong>
            <p>${bashEvents.length} of last 50 turns used Bash. Consider Read/Grep/Glob instead.</p>
          </div>
        </div>`;
      } else {
        html += `<div class="pb-issue pb-ok">
          <span class="pb-issue-icon">&#10003;</span>
          <div class="pb-issue-body">
            <strong>All clear</strong>
            <p>No errors or anti-patterns detected in recent activity.</p>
          </div>
        </div>`;
      }
    }

    for (const err of r.recentErrors.slice(0, 5)) {
      html += `<div class="pb-issue pb-error">
        <span class="pb-issue-icon">&#10007;</span>
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
        <button class="pb-card-header" on:click={() => toggleCard(i)} type="button">
          <div class="pb-card-title">
            <span class="pb-card-icon">{section.icon}</span>
            <span>{section.title}</span>
          </div>
          <span class="pb-card-summary">{section.summary}</span>
          <span class="pb-chevron" class:open={expandedCard === i}>&#9654;</span>
        </button>
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
    background: none; border: none; width: 100%; text-align: left;
    font: inherit; color: inherit;
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
