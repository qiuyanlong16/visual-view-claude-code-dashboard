<script>
  import { currentRoute, navigate } from "../router.js";

  export let views = [];
  export let connectionStatus = "disconnected";
</script>

<aside class="sidebar">
  <div class="logo">
    <span class="dot" class:active={connectionStatus === "connected"}></span>
    <h1>CC Observatory</h1>
  </div>

  <nav>
    {#each views as v}
      <button class="nav-item" class:active={$currentRoute === v.id} on:click={() => navigate(v.id)}>
        {v.label}
      </button>
    {/each}
  </nav>

  <div class="status">
    <span class="indicator" class:active={connectionStatus === "connected"}></span>
    {connectionStatus}
  </div>
</aside>

<style>
  .sidebar {
    width: 220px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 16px 0;
    flex-shrink: 0;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px 20px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .dot.active {
    background: var(--green);
    box-shadow: 0 0 6px var(--green);
  }

  h1 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px;
    flex: 1;
  }

  .nav-item {
    text-align: left;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 13px;
    width: 100%;
  }

  .nav-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--accent);
    color: white;
  }

  .status {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--red);
  }

  .indicator.active {
    background: var(--green);
  }
</style>
