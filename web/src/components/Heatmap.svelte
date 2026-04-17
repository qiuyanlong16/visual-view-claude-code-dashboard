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
