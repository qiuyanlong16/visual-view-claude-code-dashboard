<script>
  export let type = "info";
  export let label = "";

  const colors = {
    session_start: "var(--green)",
    session_end: "var(--red)",
    turn_end: "var(--blue)",
    agent_start: "var(--purple)",
    agent_end: "var(--orange)",
    info: "var(--text-muted)",
  };
</script>

<span class="badge" style="background: {colors[type] || colors.info}20; color: {colors[type] || colors.info}; border-color: {colors[type] || colors.info}40;">
  {label || type}
</span>

<style>
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: 1px solid;
  }
</style>
