# MCP Servers Panel Design

**Goal:** Add an MCP Servers panel to fill the empty space to the right of Sessions Activity on the dashboard homepage.

**Architecture:** Reuse existing `mcpCounts` data from the `/stats` API (already collected server-side). Create a new Svelte component `MCPServersPanel` that renders server names, call counts, mini progress bars, and connection status indicators.

**Tech Stack:** Svelte 5 (store-based), CSS Grid, existing stats store.

---

## Data Source

The `mcpCounts` object is already populated in `server/src/routes/stats.js` from `turn_end` event data (`data.mcp_servers`). It is already present in the frontend `stats` store at `web/src/stores/stats.js`. No backend changes needed.

## Component: MCPServersPanel.svelte

**File:** `web/src/components/MCPServersPanel.svelte`

- **Props:** `mcpCounts` (object mapping server name to call count), `maxCount` (number, highest count for progress bar scaling)
- **Colors:** Green `#4ade80` for all servers with calls (active usage). Yellow `#fbbf24` for servers with only 1-2 calls (low activity). Color based on call count threshold, not connection status.
- **Layout:** Each server as a row with status dot, name, mini progress bar, count
- **Empty state:** "No MCP servers configured yet" when `mcpCounts` is empty
- **Note:** No "degraded" or "offline" states — data only tracks call counts from past events, not live connection status

## Dashboard Grid Layout Changes

**File:** `web/src/views/Dashboard.svelte`

### HTML changes
1. Add `<MCPServersPanel>` import
2. Insert new panel div between Sessions Activity and closing `</div>` of dashboard-grid
3. Remove the `grid-column: 1 / 4` implicit spanning of Sessions Activity by making it explicitly span `1 / 3`

### CSS changes
1. `.d-sessions-activity { grid-column: 1 / 3; }` — Sessions Activity takes cols 1-2
2. `.d-mcp-servers { grid-column: 3 / 5; }` — MCP Servers takes cols 3-4
3. Remove old `.d-sessions-activity` if it was set to auto-span

## Testing

- Unit test: `web/test/MCPServersPanel.test.js` — renders server list, empty state, progress bars
- Integration test: Dashboard includes MCP Servers panel in correct grid position

## Files Changed

| File | Action |
|------|--------|
| `web/src/components/MCPServersPanel.svelte` | Create |
| `web/src/views/Dashboard.svelte` | Modify (HTML + CSS) |
| `web/test/MCPServersPanel.test.js` | Create |
| `web/test/DashboardMCPServers.test.js` | Create |
