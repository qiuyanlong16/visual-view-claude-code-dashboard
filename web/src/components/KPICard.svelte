<script>
  import Sparkline from "./Sparkline.svelte";

  export let icon = "";
  export let label = "";
  export let value = "0";
  export let color = "#60a5fa";
  export let trend = null; // { value: number, direction: 'up' | 'down' }
  export let sparklineData = [];
  export let sub = "";
  export let delay = 0;
</script>

<div class="kpi-card" style="--delay: {delay}ms">
  <div class="kpi-icon" style="background: {color}20; color: {color};">
    {@html icon}
  </div>
  <div class="kpi-label">{label}</div>
  <div class="kpi-value" style="color: {color}">{value}</div>
  {#if trend}
    <div class="kpi-sub">
      <span class={trend.direction}>{trend.direction === "up" ? "▲" : "▼"} {trend.value}</span>
    </div>
  {:else if sub}
    <div class="kpi-sub">{sub}</div>
  {/if}
  {#if sparklineData.length > 1}
    <div class="sparkline">
      <Sparkline data={sparklineData} {color} />
    </div>
  {/if}
</div>

<style>
  .kpi-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    position: relative;
    overflow: hidden;
    animation: fadeIn 0.4s ease-out var(--delay) both;
    transition: border-color 0.2s, transform 0.2s;
  }
  .kpi-card:hover { border-color: #3a3a5a; transform: translateY(-1px); }
  .kpi-icon {
    width: 32px; height: 32px; border-radius: 8px; display: flex;
    align-items: center; justify-content: center; margin-bottom: 10px;
  }
  .kpi-label {
    font-size: 11px; color: var(--text-muted); text-transform: uppercase;
    letter-spacing: 0.08em; font-weight: 600; margin-bottom: 4px;
  }
  .kpi-value { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; }
  .kpi-sub { font-size: 11px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 4px; }
  .kpi-sub .up { color: var(--green); }
  .kpi-sub .down { color: var(--red); }
  .sparkline { position: absolute; bottom: 0; right: 0; opacity: 0.3; }
</style>
