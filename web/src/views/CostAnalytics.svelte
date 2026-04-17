<script>
  import { stats, fetchStats } from "../stores/stats.js";
  import { onMount } from "svelte";

  $: s = $stats;

  function formatTokens(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  }

  onMount(fetchStats);
</script>

<div class="cost">
  <h2>Cost & Token Analytics</h2>

  <div class="summary-cards">
    <div class="card">
      <div class="card-label">Total Cost</div>
      <div class="card-value">${s.totalCost?.toFixed(4) ?? "0.00"}</div>
    </div>
    <div class="card">
      <div class="card-label">Input Tokens</div>
      <div class="card-value">{formatTokens(s.totalInputTokens ?? 0)}</div>
    </div>
    <div class="card">
      <div class="card-label">Output Tokens</div>
      <div class="card-value">{formatTokens(s.totalOutputTokens ?? 0)}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Turns</div>
      <div class="card-value">{s.totalTurns ?? 0}</div>
    </div>
  </div>

  {#if Object.keys(s.modelBreakdown || {}).length > 0}
    <div class="section">
      <h3>Per-Model Breakdown</h3>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Calls</th>
            <th>Input</th>
            <th>Output</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {#each Object.entries(s.modelBreakdown) as [model, data]}
            <tr>
              <td class="mono">{model}</td>
              <td>{data.calls}</td>
              <td class="mono">{formatTokens(data.input)}</td>
              <td class="mono">{formatTokens(data.output)}</td>
              <td class="mono">${data.cost.toFixed(4)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if Object.keys(s.dailyTokens || {}).length > 0}
    <div class="section">
      <h3>Daily Token Usage</h3>
      <div class="daily-chart">
        {#each Object.entries(s.dailyTokens) as [day, data]}
          <div class="daily-bar">
            <div class="day-label">{day.slice(5)}</div>
            <div class="bars">
              <div class="bar input-bar" style="height: {Math.max(2, (data.input / Math.max(...Object.values(s.dailyTokens).map(d => d.input + d.output))) * 100)}%"></div>
              <div class="bar output-bar" style="height: {Math.max(2, (data.output / Math.max(...Object.values(s.dailyTokens).map(d => d.input + d.output))) * 100)}%"></div>
            </div>
          </div>
        {/each}
      </div>
      <div class="legend">
        <span class="legend-item"><span class="dot input"></span> Input</span>
        <span class="legend-item"><span class="dot output"></span> Output</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .cost { max-width: 900px; margin: 0 auto; }
  h2 { font-size: 18px; margin-bottom: 16px; }
  h3 { font-size: 14px; margin-bottom: 10px; color: var(--text-secondary); }

  .summary-cards {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px;
  }
  .card {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; padding: 16px;
  }
  .card-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .card-value { font-size: 24px; font-weight: 700; margin-top: 4px; color: var(--text-primary); }

  .section { margin-bottom: 24px; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px; color: var(--text-muted); font-weight: 500; border-bottom: 1px solid var(--border); font-size: 11px; text-transform: uppercase; }
  td { padding: 8px; border-bottom: 1px solid var(--border); }
  .mono { font-family: monospace; }

  .daily-chart {
    display: flex; gap: 8px; align-items: flex-end; height: 150px; padding: 10px 0;
  }
  .daily-bar { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
  .day-label { font-size: 11px; color: var(--text-muted); }
  .bars { display: flex; gap: 2px; align-items: flex-end; height: 120px; }
  .bar { width: 16px; border-radius: 3px 3px 0 0; min-height: 2px; }
  .input-bar { background: var(--blue); }
  .output-bar { background: var(--purple); }

  .legend { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: var(--text-secondary); }
  .legend-item { display: flex; align-items: center; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot.input { background: var(--blue); }
  .dot.output { background: var(--purple); }
</style>
