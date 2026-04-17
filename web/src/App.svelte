<script>
  import Sidebar from "./components/Sidebar.svelte";
  import Dashboard from "./views/Dashboard.svelte";
  import LiveFeed from "./views/LiveFeed.svelte";
  import SessionTimeline from "./views/SessionTimeline.svelte";
  import MemoryInspector from "./views/MemoryInspector.svelte";
  import AgentChain from "./views/AgentChain.svelte";
  import SkillsUsage from "./views/SkillsUsage.svelte";
  import CostAnalytics from "./views/CostAnalytics.svelte";
  import SessionOverview from "./views/SessionOverview.svelte";

  import { connectSSE, fetchHistory } from "./stores/events.js";
  import { fetchSessions } from "./stores/sessions.js";
  import { fetchStats } from "./stores/stats.js";
  import { onMount } from "svelte";

  let view = "dashboard";
  let connectionStatus = "disconnected";

  const views = [
    { id: "dashboard", label: "Dashboard" },
    { id: "live", label: "Live Feed" },
    { id: "timeline", label: "Session Timeline" },
    { id: "memory", label: "Memory Inspector" },
    { id: "agents", label: "Agent Chain" },
    { id: "skills", label: "Skills Usage" },
    { id: "cost", label: "Cost & Tokens" },
    { id: "overview", label: "Session Overview" },
  ];

  async function init() {
    const evtSource = connectSSE();
    await fetchHistory();
    await fetchSessions();
    await fetchStats();

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
</script>

<div class="app">
  <Sidebar {views} bind:view {connectionStatus} />
  <main class="content">
    {#if view === "dashboard"}
      <Dashboard />
    {:else if view === "live"}
      <LiveFeed />
    {:else if view === "timeline"}
      <SessionTimeline />
    {:else if view === "memory"}
      <MemoryInspector />
    {:else if view === "agents"}
      <AgentChain />
    {:else if view === "skills"}
      <SkillsUsage />
    {:else if view === "cost"}
      <CostAnalytics />
    {:else if view === "overview"}
      <SessionOverview />
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
