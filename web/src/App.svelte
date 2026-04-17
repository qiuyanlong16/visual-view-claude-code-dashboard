<script>
  import Sidebar from "./components/Sidebar.svelte";
  import Dashboard from "./views/Dashboard.svelte";
  import LiveFeed from "./views/LiveFeed.svelte";
  import SessionTimeline from "./views/SessionTimeline.svelte";
  import MemoryInspector from "./views/MemoryInspector.svelte";
  import SkillsUsage from "./views/ToolsUsage.svelte";
  import CostAnalytics from "./views/CostAnalytics.svelte";
  import SessionOverview from "./views/SessionOverview.svelte";
  import CCPlaybook from "./views/CCPlaybook.svelte";

  import { connectSSE, fetchHistory } from "./stores/events.js";
  import { fetchSessions } from "./stores/sessions.js";
  import { fetchStats } from "./stores/stats.js";
  import { startRealtimePolling, stopRealtimePolling } from "./stores/realtime.js";
  import { currentRoute, initRouter } from "./router.js";
  import { onMount, onDestroy } from "svelte";

  let connectionStatus = "disconnected";

  const views = [
    { id: "dashboard", label: "Dashboard" },
    { id: "live", label: "Live Feed" },
    { id: "timeline", label: "Session Timeline" },
    { id: "memory", label: "Memory Inspector" },
    { id: "tools", label: "Tools" },
    { id: "cost", label: "Cost & Tokens" },
    { id: "overview", label: "Session Overview" },
    { id: "playbook", label: "CC Playbook" },
  ];

  async function init() {
    initRouter();
    const evtSource = connectSSE();
    await fetchHistory();
    await fetchSessions();
    await fetchStats();
    startRealtimePolling(5000);

    setInterval(() => fetchSessions(), 10000);
    setInterval(() => fetchStats(), 15000);
  }

  onMount(() => {
    init();
    import("./stores/events.js").then(({ connected }) => {
      connected.subscribe((v) => {
        connectionStatus = v ? "connected" : "disconnected";
      });
    });
  });

  onDestroy(() => stopRealtimePolling());
</script>

<div class="app">
  <Sidebar {views} {connectionStatus} />
  <main class="content">
    {#if $currentRoute === "dashboard"}
      <Dashboard />
    {:else if $currentRoute === "live"}
      <LiveFeed />
    {:else if $currentRoute === "timeline"}
      <SessionTimeline />
    {:else if $currentRoute === "memory"}
      <MemoryInspector />
    {:else if $currentRoute === "tools"}
      <SkillsUsage />
    {:else if $currentRoute === "cost"}
      <CostAnalytics />
    {:else if $currentRoute === "overview"}
      <SessionOverview />
    {:else if $currentRoute === "playbook"}
      <CCPlaybook />
    {/if}
  </main>
</div>

<style>
  .app {
    display: flex;
    min-height: 100vh;
  }
  .content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }
</style>
