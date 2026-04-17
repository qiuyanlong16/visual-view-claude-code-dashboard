<script>
  import { events } from "../stores/events.js";

  $: e = $events;

  // Derive memory stats from events
  $: memoryStats = (() => {
    const files = new Set();
    let reads = 0, writes = 0, lastAccess = "\u2014";
    for (const evt of e) {
      const mem = evt.data?.memory_accessed;
      if (!mem) continue;
      for (const f of mem.read || []) { files.add(f); reads++; if (evt.timestamp) lastAccess = evt.timestamp.slice(11, 19); }
      for (const f of mem.written || []) { files.add(f); writes++; if (evt.timestamp) lastAccess = evt.timestamp.slice(11, 19); }
    }
    return { count: files.size, reads, writes, lastAccess };
  })();
</script>

<div class="mem-grid">
  <div class="mem-card">
    <div class="mem-icon">&#128100;</div>
    <div class="mem-label">User</div>
    <div class="mem-value" style="color: #60a5fa;">{memoryStats.reads}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">&#128221;</div>
    <div class="mem-label">Writes</div>
    <div class="mem-value" style="color: #fbbf24;">{memoryStats.writes}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">&#128640;</div>
    <div class="mem-label">Files</div>
    <div class="mem-value" style="color: #4ade80;">{memoryStats.count}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">&#128279;</div>
    <div class="mem-label">References</div>
    <div class="mem-value" style="color: #a78bfa;">{memoryStats.count > 0 ? memoryStats.count : "\u2014"}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">&#9200;</div>
    <div class="mem-label">Last Access</div>
    <div class="mem-value" style="color: #9090b0; font-size: 10px;">{memoryStats.lastAccess}</div>
  </div>
  <div class="mem-card">
    <div class="mem-icon">&#128202;</div>
    <div class="mem-label">Total Ops</div>
    <div class="mem-value" style="color: #9090b0; font-size: 12px;">{memoryStats.reads + memoryStats.writes}</div>
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
