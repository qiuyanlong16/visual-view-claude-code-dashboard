<script>
  export let turnData = [];
  export let agentData = [];
  export let labels = [];
  let width = 600;
  let height = 140;

  let hoveredIndex = null;
  let tooltipX = 0;
  let tooltipY = 0;

  $: allValues = [...turnData, ...agentData];
  $: maxVal = Math.max(...allValues, 1);
  $: hasData = turnData.length > 0 && agentData.length > 0;

  $: yTicks = (() => {
    const steps = 5;
    const step = Math.ceil(maxVal / steps);
    return Array.from({ length: steps + 1 }, (_, i) => i * step);
  })();

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

  function getPointX(index) {
    const pad = 40;
    const innerW = width - pad * 2;
    if (labels.length <= 1) return pad;
    return pad + (index / (labels.length - 1)) * innerW;
  }

  function getPointY(value) {
    const innerH = height - 30;
    return height - 15 - (value / maxVal) * innerH;
  }

  function handleMouseMove(e) {
    if (!hasData) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;
    const pad = 40;
    const innerW = width - pad * 2;
    if (labels.length <= 1) {
      hoveredIndex = 0;
    } else {
      const ratio = (mouseX - pad) / innerW;
      hoveredIndex = Math.round(ratio * (labels.length - 1));
      hoveredIndex = Math.max(0, Math.min(labels.length - 1, hoveredIndex));
    }
    tooltipX = getPointX(hoveredIndex);
    const turnVal = turnData[hoveredIndex] ?? 0;
    const agentVal = agentData[hoveredIndex] ?? 0;
    tooltipY = Math.min(getPointY(turnVal), getPointY(agentVal)) - 10;
  }

  function handleMouseLeave() {
    hoveredIndex = null;
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
    <svg class="chart-svg" viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet"
         role="img" aria-label="Sessions activity chart"
         on:mousemove={handleMouseMove} on:mouseleave={handleMouseLeave}>
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

      {#each yTicks as tick}
        <text x="8" y={height - 15 - (tick / maxVal) * (height - 30) + 3}
              fill="#606080" font-size="8" font-family="monospace"
              text-anchor="end">{tick}</text>
      {/each}

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

      {#if hoveredIndex !== null}
        <line x1={getPointX(hoveredIndex)} y1="15"
              x2={getPointX(hoveredIndex)} y2={height - 15}
              stroke="#8080a0" stroke-width="0.5" stroke-dasharray="2,2"/>
        <circle cx={getPointX(hoveredIndex)} cy={getPointY(turnData[hoveredIndex] ?? 0)}
                r="3" fill="#60a5fa"/>
        <circle cx={getPointX(hoveredIndex)} cy={getPointY(agentData[hoveredIndex] ?? 0)}
                r="3" fill="#fbbf24"/>
        <g class="tooltip-group" transform="translate({tooltipX}, {tooltipY})">
          <rect x="-60" y="-42" width="120" height="42" rx="4"
                fill="#1e1e2e" fill-opacity="0.95" stroke="#404060" stroke-width="0.5"/>
          <text x="0" y="-26" text-anchor="middle" fill="#a0a0c0" font-size="8"
                font-family="monospace">{labels[hoveredIndex]}</text>
          <text x="-8" y="-12" text-anchor="end" fill="#60a5fa" font-size="9"
                font-family="monospace">Turns: {turnData[hoveredIndex] ?? 0}</text>
          <text x="-8" y="0" text-anchor="end" fill="#fbbf24" font-size="9"
                font-family="monospace">Agents: {agentData[hoveredIndex] ?? 0}</text>
        </g>
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
  .tooltip-group { pointer-events: none; }
</style>
