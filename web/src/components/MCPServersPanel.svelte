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
