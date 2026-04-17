<script>
  export let name = "";
  export let type = "";
  export let status = "unknown";

  const statusConfig = {
    completed: { color: "var(--green)", bg: "rgba(74,222,128,0.15)" },
    running: { color: "var(--yellow)", bg: "rgba(251,191,36,0.15)" },
    failed: { color: "var(--red)", bg: "rgba(248,113,113,0.15)" },
    unknown: { color: "var(--text-muted)", bg: "rgba(96,96,128,0.15)" },
  };

  $: cfg = statusConfig[status] || statusConfig.unknown;
  $: initials = name.split(/[\s-_]+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
</script>

<div class="agent-item">
  <div class="agent-avatar" style="background: {cfg.bg}; color: {cfg.color};">{initials}</div>
  <div class="agent-info">
    <div class="agent-name">{name}</div>
    <div class="agent-type">{type}</div>
  </div>
  <span class="agent-status" style="background: {cfg.bg}; color: {cfg.color};">{status}</span>
</div>

<style>
  .agent-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: 8px; margin-bottom: 4px;
    background: var(--bg-secondary); transition: background 0.15s;
  }
  .agent-item:hover { background: var(--bg-tertiary); }
  .agent-avatar {
    width: 28px; height: 28px; border-radius: 50%; display: flex;
    align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
  }
  .agent-info { flex: 1; }
  .agent-name { font-size: 12px; font-weight: 600; }
  .agent-type { font-size: 10px; color: var(--text-muted); }
  .agent-status {
    font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600;
  }
</style>
