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
      <polyline points={inputPath} fill="none" stroke={inputColor} stroke-width="2"/>

      <polygon points={outputAreaPath} fill="url(#chart-output-grad)"/>
      <polyline points={outputPath} fill="none" stroke={outputColor} stroke-width="2"/>

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
