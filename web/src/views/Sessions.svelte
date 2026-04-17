<script>
  import { sessions, fetchSessions } from "../stores/sessions.js";
  import { onMount } from "svelte";

  $: sessionList = $sessions;

  onMount(() => {
    fetchSessions();
  });

  function timeAgo(ts) {
    if (!ts) return "unknown";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
</script>

<div class="sessions">
  <h2>Sessions</h2>

  {#if sessionList.length === 0}
    <p class="empty">No sessions recorded yet.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Session ID</th>
          <th>Status</th>
          <th>Started</th>
          <th>Turns</th>
        </tr>
      </thead>
      <tbody>
        {#each sessionList as session}
          <tr>
            <td class="id-cell">{session.id ?? "—"}</td>
            <td>
              <span class="status {session.status || 'unknown'}">{session.status || "unknown"}</span>
            </td>
            <td>{timeAgo(session.startTime ?? session.created_at)}</td>
            <td>{session.turnCount ?? session.turns ?? "—"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .sessions {
    max-width: 1000px;
  }
  h2 {
    margin-bottom: 16px;
    color: #e2e8f0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid #1e293b;
  }
  th {
    color: #94a3b8;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  td {
    color: #cbd5e1;
    font-size: 0.9rem;
  }
  .id-cell {
    font-family: monospace;
    font-size: 0.8rem;
    color: #64748b;
  }
  .status {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .status.active, .status.running {
    background: #064e3b;
    color: #6ee7b7;
  }
  .status.ended, .status.completed {
    background: #1e1b4b;
    color: #a5b4fc;
  }
  .status.unknown {
    background: #1c1917;
    color: #a8a29e;
  }
  .empty {
    color: #64748b;
    font-style: italic;
  }
</style>
