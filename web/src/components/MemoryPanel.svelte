<script>
  import { stats, fetchStats } from "../stores/stats.js";
  import { onMount } from "svelte";

  $: ms = $stats.memoryStats;

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  $: lastAccess = ms.lastAccess ? ms.lastAccess.slice(11, 19) : "\u2014";

  onMount(fetchStats);
</script>

<div class="mem-grid">
  <div class="mem-card">
    <div class="mem-icon">&#128100;</div>
    <div class="mem-label">Files</div>
    <div class="mem-value" style="color: #4ade80;">{ms.files}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">&#128190;</div>
    <div class="mem-label">Size</div>
    <div class="mem-value" style="color: #60a5fa;">{formatSize(ms.size)}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">&#9200;</div>
    <div class="mem-label">Last Access</div>
    <div class="mem-value" style="color: #9090b0; font-size: 10px;">{lastAccess}</div>
  </div>
</div>

<style>
  .mem-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .mem-card {
    background: var(--bg-secondary); border-radius: 8px; padding: 10px; text-align: center;
    border: 1px solid var(--border); transition: border-color 0.15s;
  }
  .mem-card:hover { border-color: #3a3a5a; }
  .mem-icon { font-size: 18px; margin-bottom: 4px; }
  .mem-label { font-size: 10px; color: var(--text-secondary); margin-bottom: 2px; }
  .mem-value { font-size: 14px; font-weight: 700; }
</style>
