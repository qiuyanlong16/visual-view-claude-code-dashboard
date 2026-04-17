<script>
  import { filteredEvents } from "../stores/events.js";

  $: events = $filteredEvents;
  $: agentEvents = events.filter((e) => e.type === "agent_start" || e.type === "agent_end");

  $: nodes = buildGraph(agentEvents);

  function buildGraph(agEvents) {
    const nodeMap = new Map();
    let parentId = null;

    for (const evt of agEvents) {
      const id = `${evt.session_id}-${evt.timestamp}-${evt.data?.name || evt.data?.type || "unknown"}`;

      if (evt.type === "agent_start") {
        nodeMap.set(id, {
          id,
          name: evt.data?.name || evt.data?.type || "unknown",
          type: evt.data?.type || "general-purpose",
          status: "running",
          parentId,
          children: [],
          startedAt: evt.timestamp,
        });
        parentId = id;
      } else if (evt.type === "agent_end") {
        const startedId = [...nodeMap.entries()]
          .reverse()
          .find(([, n]) => n.status === "running");

        if (startedId) {
          startedId[1].status = evt.data?.status || "completed";
          startedId[1].duration = evt.data?.duration;
          startedId[1].tokens = evt.data?.tokens_used;
          parentId = startedId[1].parentId;
        }
      }
    }

    // Build tree
    const roots = [];
    for (const [, node] of nodeMap) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId).children.push(node.id);
      } else {
        roots.push(node.id);
      }
    }

    return { nodes: nodeMap, roots };
  }

  function renderTree(nodeId, depth = 0) {
    const node = nodes.nodes.get(nodeId);
    if (!node) return null;
    return { node, depth, children: node.children.map((c) => renderTree(c, depth + 1)) };
  }

  const statusColor = {
    completed: "var(--green)",
    failed: "var(--red)",
    running: "var(--yellow)",
  };
</script>

<div class="agent-chain">
  <h2>Agent Chain Viewer</h2>

  {#if agentEvents.length === 0}
    <div class="empty">No agent events yet. When Claude Code launches sub-agents, they'll appear here.</div>
  {:else}
    <svg class="graph" width="800" height={Math.max(300, agentEvents.length * 60)}>
      {#each nodes.roots as rootId}
        {@const tree = renderTree(rootId)}
        {#if tree}
          {renderNodes(tree, 0)}
        {/if}
      {/each}
    </svg>
  {/if}
</div>

<script context="module">
  let yOffset = 30;

  function renderNodes(tree, depth) {
    if (!tree) return "";
    const x = 40 + depth * 200;
    const y = yOffset;
    yOffset += 50;

    let svg = `<g>
      <rect x="${x}" y="${y}" width="180" height="36" rx="6" fill="var(--bg-tertiary)" stroke="var(--border)" stroke-width="1"/>
      <text x="${x + 10}" y="${y + 16}" fill="var(--text-primary)" font-size="12" font-family="system-ui">${tree.node.name}</text>
      <text x="${x + 10}" y="${y + 30}" fill="var(--text-muted)" font-size="10" font-family="monospace">${tree.node.type}</text>
      <circle cx="${x + 170}" cy="${y + 18}" r="4" fill="${statusColor[tree.node.status] || "var(--yellow)"}"/>`;

    for (const child of tree.children) {
      svg += renderNodes(child, depth + 1);
      svg += `<line x1="${x + 180}" y1="${y + 18}" x2="${x + 200}" y2="${yOffset - 32}" stroke="var(--border)" stroke-width="1"/>`;
    }

    svg += `</g>`;
    return svg;
  }
</script>

<style>
  .agent-chain { max-width: 900px; margin: 0 auto; }
  h2 { font-size: 18px; margin-bottom: 16px; }
  .graph { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px; width: 100%; }
  .empty { text-align: center; color: var(--text-muted); padding: 40px; }
</style>
