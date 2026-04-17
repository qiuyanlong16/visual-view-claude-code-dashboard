<script>
  import { stats, fetchStats } from "../stores/stats.js";
  import { onMount } from "svelte";

  $: s = $stats;
  $: tools = Object.entries(s.toolCounts || {}).sort((a, b) => b[1] - a[1]);
  $: skills = Object.entries(s.skillCounts || {}).sort((a, b) => b[1] - a[1]);
  $: plugins = Object.entries(s.pluginCounts || {}).sort((a, b) => b[1] - a[1]);
  $: mcpServers = Object.entries(s.mcpCounts || {}).sort((a, b) => b[1] - a[1]);
  $: maxTool = tools.length > 0 ? tools[0][1] : 1;
  $: maxSkill = skills.length > 0 ? skills[0][1] : 1;

  let toolsOpen = true;
  let skillsOpen = false;
  let pluginsOpen = false;
  let mcpOpen = false;

  // Known built-in skills
  const builtInSkills = [
    "superpowers:brainstorming",
    "superpowers:writing-plans",
    "superpowers:executing-plans",
    "superpowers:subagent-driven-development",
    "superpowers:code-reviewer",
    "superpowers:test-driven-development",
    "superpowers:debugging",
    "superpowers:frontend-design",
    "superpowers:mcp-builder",
    "superpowers:update-config",
    "superpowers:simplify",
    "superpowers:using-superpowers",
    "superpowers:using-git-worktrees",
    "superpowers:finishing-a-development-branch",
    "superpowers:requesting-code-review",
    "superpowers:brainstorm",
  ];

  // Known plugins (common ones)
  const knownPlugins = [
    "plugin:browser-use",
    "plugin:serpapi",
    "plugin:playwright",
    "plugin:puppeteer",
  ];

  // Common MCP servers
  const commonMCPServers = [
    "filesystem",
    "github",
    "slack",
    "linear",
    "postgres",
    "fetch",
    "memory",
    "sequential-thinking",
    "context7",
    "playwright",
    "puppeteer",
    "serpapi",
    "github-mcp-server",
  ];

  onMount(fetchStats);
</script>

<div class="tools">
  <h2>Tools</h2>

  {#if tools.length === 0 && skills.length === 0 && plugins.length === 0 && mcpServers.length === 0}
    <div class="empty">No tools, skills, plugins, or MCP servers used yet.</div>
  {:else}
    <!-- Tool Calls -->
    {#if tools.length > 0}
      <section>
        <h3>Tool Calls ({tools.length})</h3>
        <div class="bar-chart">
          {#each tools as [name, count]}
            <div class="bar-row">
              <span class="bar-label">{name}</span>
              <div class="bar-track">
                <div class="bar-fill tool-color" style="width: {(count / maxTool) * 100}%"></div>
              </div>
              <span class="bar-value">{count}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Skills -->
    {#if skills.length > 0}
      <section>
        <h3>Skills ({skills.length})</h3>
        <div class="bar-chart">
          {#each skills as [name, count]}
            <div class="bar-row">
              <span class="bar-label">{name}</span>
              <div class="bar-track">
                <div class="bar-fill skill-color" style="width: {(count / maxSkill) * 100}%"></div>
              </div>
              <span class="bar-value">{count}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Plugins -->
    {#if plugins.length > 0}
      <section>
        <h3>Plugins ({plugins.length})</h3>
        <div class="bar-chart">
          {#each plugins as [name, count]}
            <div class="bar-row">
              <span class="bar-label">{name}</span>
              <div class="bar-track">
                <div class="bar-fill plugin-color" style="width: {(count / maxSkill) * 100}%"></div>
              </div>
              <span class="bar-value">{count}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- MCP Servers -->
    {#if mcpServers.length > 0}
      <section>
        <h3>MCP Servers ({mcpServers.length})</h3>
        <div class="bar-chart">
          {#each mcpServers as [name, count]}
            <div class="bar-row">
              <span class="bar-label">{name}</span>
              <div class="bar-track">
                <div class="bar-fill mcp-color" style="width: {(count / maxSkill) * 100}%"></div>
              </div>
              <span class="bar-value">{count}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}

  <!-- Collapsible Built-in Lists -->
  <div class="builtin-section">
    <button class="collapse-btn" on:click={() => toolsOpen = !toolsOpen}>
      <span class="arrow" class:open={toolsOpen}>▶</span>
      Available Tools (16+)
    </button>
    {#if toolsOpen}
      <div class="collapse-list">
        {#each ["Read","Write","Edit","Bash","Grep","Glob","WebFetch","WebSearch","TodoWrite","AskUserQuestion","Agent","Skill","TaskOutput","TaskStop","EnterPlanMode","ExitPlanMode"] as name}
          <div class="builtin-item">
            <span class="dot tool-dot"></span>
            {name}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="builtin-section">
    <button class="collapse-btn" on:click={() => skillsOpen = !skillsOpen}>
      <span class="arrow" class:open={skillsOpen}>▶</span>
      Built-in Skills ({builtInSkills.length})
    </button>
    {#if skillsOpen}
      <div class="collapse-list">
        {#each builtInSkills as name}
          <div class="builtin-item">
            <span class="dot skill-dot"></span>
            {name}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="builtin-section">
    <button class="collapse-btn" on:click={() => pluginsOpen = !pluginsOpen}>
      <span class="arrow" class:open={pluginsOpen}>▶</span>
      Known Plugins ({knownPlugins.length})
    </button>
    {#if pluginsOpen}
      <div class="collapse-list">
        {#each knownPlugins as name}
          <div class="builtin-item">
            <span class="dot plugin-dot"></span>
            {name}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="builtin-section">
    <button class="collapse-btn" on:click={() => mcpOpen = !mcpOpen}>
      <span class="arrow" class:open={mcpOpen}>▶</span>
      Common MCP Servers ({commonMCPServers.length})
    </button>
    {#if mcpOpen}
      <div class="collapse-list">
        {#each commonMCPServers as name}
          <div class="builtin-item">
            <span class="dot mcp-dot"></span>
            {name}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .tools { max-width: 700px; margin: 0 auto; }
  h2 { font-size: 18px; margin-bottom: 16px; }
  h3 { font-size: 14px; margin-bottom: 10px; color: var(--text-secondary); }

  section { margin-bottom: 28px; }

  .bar-chart { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
  .bar-row { display: flex; align-items: center; gap: 10px; }
  .bar-label { width: 220px; font-size: 13px; font-family: monospace; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1; height: 22px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.3s; min-width: 2px; }
  .bar-fill.tool-color { background: #fbbf24; }
  .bar-fill.skill-color { background: var(--accent); }
  .bar-fill.plugin-color { background: #f87171; }
  .bar-fill.mcp-color { background: #c084fc; }
  .bar-value { width: 40px; font-size: 13px; text-align: right; color: var(--text-secondary); font-family: monospace; }

  .builtin-section { margin-bottom: 8px; }

  .collapse-btn {
    width: 100%; text-align: left; padding: 10px 12px; background: var(--bg-tertiary);
    border: 1px solid var(--border); border-radius: 8px; color: var(--text-secondary);
    font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center;
    gap: 8px; transition: background 0.15s;
  }
  .collapse-btn:hover { background: var(--bg-hover); }

  .arrow {
    display: inline-block; font-size: 10px; transition: transform 0.2s;
  }
  .arrow.open { transform: rotate(90deg); }

  .collapse-list {
    padding: 8px 12px 8px 32px; display: flex; flex-wrap: wrap; gap: 6px;
    background: rgba(22,22,37,0.5); border-radius: 0 0 8px 8px; margin-top: -1px;
    border: 1px solid var(--border); border-top: none;
  }

  .builtin-item {
    font-size: 12px; font-family: monospace; color: var(--text-muted);
    display: flex; align-items: center; gap: 6px; padding: 2px 0;
  }

  .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .tool-dot { background: #fbbf24; }
  .skill-dot { background: var(--accent); }
  .plugin-dot { background: #f87171; }
  .mcp-dot { background: #c084fc; }

  .empty { text-align: center; color: var(--text-muted); padding: 40px; }
</style>
