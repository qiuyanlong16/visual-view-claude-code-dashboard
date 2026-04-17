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
