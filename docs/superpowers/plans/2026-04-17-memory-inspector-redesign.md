# Memory Inspector Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Memory Inspector to auto-load global + configured projects' memory files, settings, and CLAUDE.md, with in-page project management.

**Architecture:** Server-side reads `~/.view-claude.json` (user home) for project paths, then scans each project's `.claude/memory/`, `.claude/settings.local.json`, and root `CLAUDE.md`. Client displays collapsible sections with expandable file previews.

**Tech Stack:** Svelte 5, Hono.js, Node.js `fs` module, Svelte stores

---

### Task 1: Server — Memory config CRUD API

**Files:**
- Modify: `server/src/routes/memory.js`

- [ ] **Step 1: Add helper to resolve user home directory**

At top of `server/src/routes/memory.js`, add `homedir` import and helper:

```javascript
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";

function getUserHome() {
  return homedir();
}

function getViewClaudePath() {
  return join(getUserHome(), ".view-claude.json");
}
```

- [ ] **Step 2: Add `GET /memory/config` endpoint**

Inside `memoryRoutes` function, before the closing `}`:

```javascript
  app.get("/memory/config", (c) => {
    const configPath = getViewClaudePath();
    if (!existsSync(configPath)) {
      return c.json({ projects: [] });
    }
    try {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      return c.json({ projects: parsed.projects || [] });
    } catch {
      return c.json({ projects: [] });
    }
  });
```

- [ ] **Step 3: Add `POST /memory/config` endpoint**

```javascript
  app.post("/memory/config", async (c) => {
    try {
      const body = await c.req.json();
      const { action, path } = body;
      const configPath = getViewClaudePath();
      let data = { projects: [] };
      if (existsSync(configPath)) {
        data = JSON.parse(readFileSync(configPath, "utf-8"));
      }
      if (!data.projects) data.projects = [];
      if (action === "add" && path && !data.projects.includes(path)) {
        data.projects.push(path);
      } else if (action === "remove" && path) {
        data.projects = data.projects.filter((p) => p !== path);
      }
      writeFileSync(configPath, JSON.stringify(data, null, 2), "utf-8");
      return c.json({ projects: data.projects });
    } catch (e) {
      return c.json({ error: e.message }, 500);
    }
  });
```

- [ ] **Step 4: Verify existing endpoints still work**

Run: `curl -s http://localhost:3456/memory?project=/tmp | head`
Expected: valid JSON response (not 404 or crash)

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/memory.js
git commit -m "feat: add memory config CRUD API for .view-claude.json"
```

---

### Task 2: Server — Batch project data endpoint

**Files:**
- Modify: `server/src/routes/memory.js`

- [ ] **Step 1: Add `GET /memory/projects/data` endpoint**

```javascript
  app.get("/memory/projects/data", (c) => {
    const configPath = getViewClaudePath();
    if (!existsSync(configPath)) {
      return c.json({ projects: {} });
    }
    let projects = [];
    try {
      const parsed = JSON.parse(readFileSync(configPath, "utf-8"));
      projects = parsed.projects || [];
    } catch {
      return c.json({ projects: {} });
    }

    const result = {};
    for (const projectPath of projects) {
      const name = basename(projectPath) || projectPath;
      const entry = { name, memoryFiles: [], hasSettings: false, settingsContent: null, hasClaudeMd: false, claudeMdSize: 0 };

      // Memory files
      const memDir = join(projectPath, ".claude", "memory");
      if (existsSync(memDir)) {
        try {
          const entries = readdirSync(memDir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isFile() && e.name.endsWith(".md")) {
              const fullPath = join(memDir, e.name);
              const st = statSync(fullPath);
              entry.memoryFiles.push({
                name: e.name,
                path: fullPath,
                size: st.size,
                modified: st.mtime.toISOString(),
              });
            }
          }
        } catch {}
      }

      // Settings
      const settingsPath = join(projectPath, ".claude", "settings.local.json");
      if (existsSync(settingsPath)) {
        try {
          entry.hasSettings = true;
          entry.settingsContent = readFileSync(settingsPath, "utf-8");
        } catch {}
      }

      // CLAUDE.md
      const claudePath = join(projectPath, "CLAUDE.md");
      if (existsSync(claudePath)) {
        try {
          const st = statSync(claudePath);
          entry.hasClaudeMd = true;
          entry.claudeMdSize = st.size;
        } catch {}
      }

      result[projectPath] = entry;
    }
    return c.json({ projects: result });
  });
```

- [ ] **Step 2: Add global memory + agents endpoint**

```javascript
  app.get("/memory/global", (c) => {
    const homeDir = getUserHome();
    const claudeDir = join(homeDir, ".claude");

    const memoryFiles = [];
    const memoryDir = join(claudeDir, "memory");
    if (existsSync(memoryDir)) {
      try {
        const entries = readdirSync(memoryDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isFile() && e.name.endsWith(".md")) {
            const fullPath = join(memoryDir, e.name);
            const st = statSync(fullPath);
            memoryFiles.push({
              name: e.name,
              path: fullPath,
              size: st.size,
              modified: st.mtime.toISOString(),
            });
          }
        }
      } catch {}
    }

    const agentFiles = [];
    const agentsDir = join(claudeDir, "agents");
    if (existsSync(agentsDir)) {
      try {
        const entries = readdirSync(agentsDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isFile() && e.name.endsWith(".md")) {
            const fullPath = join(agentsDir, e.name);
            const st = statSync(fullPath);
            agentFiles.push({
              name: e.name.replace(".md", ""),
              path: fullPath,
              size: st.size,
              modified: st.mtime.toISOString(),
            });
          }
        }
      } catch {}
    }

    return c.json({ memoryFiles, agentFiles });
  });
```

- [ ] **Step 3: Restart server and verify**

Run: `curl -s http://localhost:3456/memory/global | head`
Expected: `{"memoryFiles":[...],"agentFiles":[...]}`

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/memory.js
git commit -m "feat: add /memory/projects/data and /memory/global endpoints"
```

---

### Task 3: Client — Memory config store

**Files:**
- Create: `web/src/stores/memoryConfig.js`

- [ ] **Step 1: Create the store**

```javascript
import { writable } from "svelte/store";

export const globalMemory = writable({ memoryFiles: [], agentFiles: [] });
export const projectData = writable({});
export const configProjects = writable([]);

export async function loadConfig() {
  const res = await fetch("/memory/config");
  if (res.ok) {
    const data = await res.json();
    configProjects.set(data.projects || []);
  }
}

export async function loadGlobal() {
  const res = await fetch("/memory/global");
  if (res.ok) {
    globalMemory.set(await res.json());
  }
}

export async function loadProjectsData() {
  const res = await fetch("/memory/projects/data");
  if (res.ok) {
    const data = await res.json();
    projectData.set(data.projects || {});
  }
}

export async function loadAll() {
  await Promise.all([loadConfig(), loadGlobal(), loadProjectsData()]);
}

export async function addProject(path) {
  const res = await fetch("/memory/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add", path }),
  });
  if (res.ok) {
    await loadAll();
  }
}

export async function removeProject(path) {
  const res = await fetch("/memory/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "remove", path }),
  });
  if (res.ok) {
    await loadAll();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/stores/memoryConfig.js
git commit -m "feat: add memoryConfig store for global + project memory management"
```

---

### Task 4: Client — File content fetch + preview component

**Files:**
- Modify: `web/src/stores/memory.js`
- Create: `web/src/components/MemoryFileViewer.svelte`

- [ ] **Step 1: Update existing memory store with content loader**

Modify `web/src/stores/memory.js`, keep existing imports, add nothing new — the existing `loadContent` function is sufficient. We'll use it directly.

- [ ] **Step 2: Create MemoryFileViewer component**

```svelte
<script>
  import { fileContent } from "../stores/memory.js";

  export let fileName = "";
  export let filePath = "";
  export let expanded = false;

  async function loadFile() {
    const res = await fetch(`/memory/content?path=${encodeURIComponent(filePath)}`);
    if (res.ok) {
      const data = await res.json();
      fileContent.set(data.content);
      expanded = !expanded;
    }
  }
</script>

{#if expanded}
  <div class="file-viewer">
    <div class="viewer-header">
      <span class="viewer-name">{fileName}</span>
      <button class="close-btn" on:click={() => { expanded = false; fileContent.set(""); }}>×</button>
    </div>
    <pre class="viewer-content">{$fileContent || "Loading..."}</pre>
  </div>
{:else}
  <button class="file-preview-btn" on:click={loadFile}>
    📄 {fileName} — click to view
  </button>
{/if}

<style>
  .file-viewer {
    background: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px;
    margin: 4px 0; overflow: hidden;
  }
  .viewer-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 10px; background: var(--bg-tertiary);
  }
  .viewer-name { font-size: 12px; font-weight: 600; color: var(--text-primary); font-family: monospace; }
  .close-btn {
    background: none; border: none; color: var(--text-muted); font-size: 18px;
    cursor: pointer; padding: 0 4px; line-height: 1;
  }
  .viewer-content {
    padding: 10px; font-size: 12px; line-height: 1.5; color: var(--text-secondary);
    font-family: "Fira Code", "Cascadia Code", monospace; white-space: pre-wrap;
    word-break: break-word; max-height: 400px; overflow-y: auto; margin: 0;
  }
  .file-preview-btn {
    display: block; width: 100%; text-align: left; padding: 6px 10px; background: none;
    border: none; color: var(--text-secondary); font-size: 12px; cursor: pointer;
    border-radius: 4px; font-family: monospace;
  }
  .file-preview-btn:hover { background: var(--bg-hover); }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MemoryFileViewer.svelte
git commit -m "feat: add expandable file viewer component"
```

---

### Task 5: Client — Rewrite MemoryInspector page

**Files:**
- Modify: `web/src/views/MemoryInspector.svelte`

- [ ] **Step 1: Replace entire component**

Write the new `web/src/views/MemoryInspector.svelte`:

```svelte
<script>
  import { onMount } from "svelte";
  import {
    globalMemory,
    configProjects,
    projectData,
    loadAll,
    addProject,
    removeProject,
  } from "../stores/memoryConfig.js";
  import { fileContent } from "../stores/memory.js";
  import MemoryFileViewer from "../components/MemoryFileViewer.svelte";

  $: g = $globalMemory;
  $: projects = $configProjects;
  $: pData = $projectData;

  let globalMemOpen = false;
  let globalAgentsOpen = false;
  let projectOpen = {};
  let newProjectPath = "";
  let showAddForm = false;
  let expandedFile = null;

  function toggleProjectSection(projectPath, section) {
    const key = `${projectPath}::${section}`;
    expandedFile = expandedFile === key ? null : key;
  }

  function toggleGlobalSection(section) {
    expandedFile = expandedFile === section ? null : section;
  }

  async function handleAddProject() {
    if (newProjectPath.trim()) {
      await addProject(newProjectPath.trim());
      newProjectPath = "";
      showAddForm = false;
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onMount(loadAll);
</script>

<div class="memory">
  <h2>Memory Inspector</h2>

  <!-- Global Memory -->
  <div class="section">
    <button class="section-header" on:click={() => toggleGlobalSection("mem")}>
      <span class="arrow" class:open={expandedFile === "mem"}>▶</span>
      <span>Global Memory</span>
      <span class="badge">~/.claude/memory/</span>
      <span class="count">{g.memoryFiles.length} files</span>
    </button>
    {#if expandedFile === "mem"}
      <div class="section-content">
        {#if g.memoryFiles.length === 0}
          <div class="empty-msg">No global memory files.</div>
        {:else}
          {#each g.memoryFiles as file}
            {#if expandedFile === `global::mem::${file.name}`}
              <MemoryFileViewer fileName={file.name} filePath={file.path} expanded={true} />
            {:else}
              <button class="file-item-btn" on:click={() => toggleGlobalSection(`global::mem::${file.name}`)}>
                <span class="file-name">{file.name}</span>
                <span class="file-meta">{formatSize(file.size)} · {file.modified.slice(0, 10)}</span>
              </button>
            {/if}
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <!-- Global Agents -->
  <div class="section">
    <button class="section-header" on:click={() => toggleGlobalSection("agents")}>
      <span class="arrow" class:open={expandedFile === "agents"}>▶</span>
      <span>Global Agents</span>
      <span class="badge">~/.claude/agents/</span>
      <span class="count">{g.agentFiles.length} agents</span>
    </button>
    {#if expandedFile === "agents"}
      <div class="section-content">
        {#if g.agentFiles.length === 0}
          <div class="empty-msg">No global agents.</div>
        {:else}
          {#each g.agentFiles as file}
            {#if expandedFile === `global::agents::${file.name}`}
              <MemoryFileViewer fileName={file.name} filePath={file.path} expanded={true} />
            {:else}
              <button class="file-item-btn" on:click={() => toggleGlobalSection(`global::agents::${file.name}`)}>
                <span class="file-name">{file.name}</span>
                <span class="file-meta">{formatSize(file.size)} · {file.modified.slice(0, 10)}</span>
              </button>
            {/if}
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <!-- Projects -->
  <div class="projects-header">
    <span>Projects</span>
    <button class="add-btn" on:click={() => showAddForm = !showAddForm}>+ Add Project</button>
  </div>

  {#if showAddForm}
    <div class="add-form">
      <input type="text" bind:value={newProjectPath} placeholder="Project path (e.g. /path/to/project)" />
      <button class="save-btn" on:click={handleAddProject}>Save</button>
      <button class="cancel-btn" on:click={() => showAddForm = false}>Cancel</button>
    </div>
  {/if}

  {#if projects.length === 0 && !showAddForm}
    <div class="empty-msg">No projects configured. Click "+ Add Project" to get started.</div>
  {:else}
    {#each projects as projectPath}
      {@const info = pData[projectPath] || { name: projectPath, memoryFiles: [], hasSettings: false, hasClaudeMd: false }}
      <div class="project-card">
        <div class="project-header">
          <span class="project-name">{info.name}</span>
          <span class="project-path">{projectPath}</span>
          <button class="remove-btn" on:click={() => removeProject(projectPath)}>Remove</button>
        </div>

        <!-- Project Memory Files -->
        <div class="subsection">
          <button class="subsection-header" on:click={() => toggleProjectSection(projectPath, "mem")}>
            <span class="arrow" class:open={expandedFile === `${projectPath}::mem`}>▶</span>
            Memory ({info.memoryFiles.length})
          </button>
          {#if expandedFile === `${projectPath}::mem`}
            <div class="subsection-content">
              {#if info.memoryFiles.length === 0}
                <div class="empty-sub">No memory files in this project.</div>
              {:else}
                {#each info.memoryFiles as file}
                  {#if expandedFile === `${projectPath}::mem::${file.name}`}
                    <MemoryFileViewer fileName={file.name} filePath={file.path} expanded={true} />
                  {:else}
                    <button class="file-item-btn" on:click={() => toggleProjectSection(projectPath, `mem::${file.name}`)}>
                      <span class="file-name">{file.name}</span>
                      <span class="file-meta">{formatSize(file.size)} · {file.modified.slice(0, 10)}</span>
                    </button>
                  {/if}
                {/each}
              {/if}
            </div>
          {/if}
        </div>

        <!-- Project Settings -->
        {#if info.hasSettings}
          <div class="subsection">
            <button class="subsection-header" on:click={() => toggleProjectSection(projectPath, "settings")}>
              <span class="arrow" class:open={expandedFile === `${projectPath}::settings`}>▶</span>
              Settings
            </button>
            {#if expandedFile === `${projectPath}::settings`}
              <div class="subsection-content">
                <pre class="settings-preview">{info.settingsContent}</pre>
              </div>
            {/if}
          </div>
        {/if}

        <!-- CLAUDE.md -->
        {#if info.hasClaudeMd}
          <div class="subsection">
            <button class="subsection-header" on:click={() => toggleProjectSection(projectPath, "claude")}>
              <span class="arrow" class:open={expandedFile === `${projectPath}::claude`}>▶</span>
              CLAUDE.md ({formatSize(info.claudeMdSize)})
            </button>
            {#if expandedFile === `${projectPath}::claude`}
              <div class="subsection-content">
                {@const claudePath = projectPath + "/CLAUDE.md"}
                <MemoryFileViewer fileName="CLAUDE.md" filePath={claudePath} expanded={true} />
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .memory { max-width: 800px; margin: 0 auto; }
  h2 { font-size: 18px; margin-bottom: 16px; }

  .section { margin-bottom: 8px; }

  .section-header {
    width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text-primary); font-size: 13px; font-weight: 600; cursor: pointer;
    text-align: left;
  }
  .section-header:hover { background: var(--bg-hover); }

  .badge { font-size: 11px; color: var(--text-muted); font-weight: 400; font-family: monospace; }
  .count { margin-left: auto; font-size: 11px; color: var(--text-muted); }

  .arrow { font-size: 10px; transition: transform 0.2s; display: inline-block; }
  .arrow.open { transform: rotate(90deg); }

  .section-content, .subsection-content { padding: 4px 0 4px 22px; }

  .file-item-btn {
    display: flex; justify-content: space-between; align-items: center; width: 100%;
    padding: 6px 10px; background: none; border: none; border-radius: 4px;
    color: var(--text-secondary); font-size: 12px; cursor: pointer; font-family: monospace;
  }
  .file-item-btn:hover { background: var(--bg-hover); }
  .file-meta { font-size: 11px; color: var(--text-muted); }

  .projects-header {
    display: flex; justify-content: space-between; align-items: center;
    margin: 20px 0 8px; font-size: 14px; font-weight: 600; color: var(--text-primary);
  }

  .add-btn {
    background: var(--accent); color: white; border: none; border-radius: 4px;
    padding: 4px 10px; font-size: 12px; cursor: pointer;
  }

  .add-form {
    display: flex; gap: 8px; margin-bottom: 12px;
  }
  .add-form input { flex: 1; }
  .save-btn {
    background: var(--green); color: white; border: none; border-radius: 4px;
    padding: 4px 12px; font-size: 12px; cursor: pointer;
  }
  .cancel-btn {
    background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border);
    border-radius: 4px; padding: 4px 12px; font-size: 12px; cursor: pointer;
  }

  .project-card {
    background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 10px;
    padding: 12px; margin-bottom: 8px;
  }

  .project-header {
    display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  }
  .project-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .project-path { font-size: 11px; color: var(--text-muted); font-family: monospace; }
  .remove-btn {
    margin-left: auto; background: none; border: 1px solid rgba(239,68,68,0.3);
    border-radius: 4px; color: var(--red); font-size: 11px; padding: 2px 8px; cursor: pointer;
  }
  .remove-btn:hover { background: rgba(239,68,68,0.1); }

  .subsection { margin: 4px 0; }

  .subsection-header {
    width: 100%; text-align: left; padding: 6px 8px; background: none; border: none;
    border-radius: 6px; color: var(--text-secondary); font-size: 12px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; gap: 6px;
  }
  .subsection-header:hover { background: var(--bg-hover); }

  .settings-preview {
    padding: 10px; font-size: 12px; color: var(--text-secondary); font-family: monospace;
    background: var(--bg-primary); border-radius: 6px; max-height: 300px; overflow-y: auto;
    white-space: pre-wrap; word-break: break-word;
  }

  .empty-msg { color: var(--text-muted); padding: 20px; text-align: center; font-size: 13px; }
  .empty-sub { color: var(--text-muted); padding: 8px 10px; font-size: 12px; }
</style>
```

- [ ] **Step 2: Build and verify**

Run: `cd web && npx vite build`
Expected: Build succeeds, no errors

- [ ] **Step 3: Commit**

```bash
git add web/src/views/MemoryInspector.svelte
git commit -m "feat: rewrite MemoryInspector with global + project collapsible panels"
```

---

### Task 6: Cleanup — Remove unused old code

**Files:**
- Modify: `web/src/views/Dashboard.svelte` (verify no broken imports)
- Modify: `web/src/views/MemoryInspector.svelte` (already done in Task 5)

- [ ] **Step 1: Verify MemoryPanel component is still used in Dashboard**

The `MemoryPanel.svelte` in Dashboard still works — it uses stats from the store. No changes needed.

- [ ] **Step 2: Verify no broken imports**

Run: `cd web && npx vite build 2>&1 | grep -i error`
Expected: No errors

- [ ] **Step 3: Manual verification**

Run: `npm run server` then `npm run dev`
Open `http://localhost:5173` and navigate to Memory Inspector via sidebar.

Expected behavior:
1. Global Memory section shows files from `~/.claude/memory/` (or empty message)
2. Global Agents section shows agents from `~/.claude/agents/` (or empty message)
3. Projects section is empty with "+ Add Project" button visible
4. Adding a project path that exists should load its memory files, settings, CLAUDE.md
5. Clicking any file expands to show its content
6. Removing a project refreshes the list

- [ ] **Step 4: Commit any final changes**

---

### Task 7: Update README with config documentation

**Files:**
- Modify: `README.md` (project root, or create if missing)

- [ ] **Step 1: Check if README exists**

Run: `ls README.md 2>/dev/null || echo "no README"`

- [ ] **Step 2: Add Memory Inspector configuration section**

If README exists, append after existing content. If not, create it:

```markdown
# Claude Code Observatory

Real-time web dashboard for monitoring Claude Code activity.

## Quick Start

```bash
npm run server    # Hono server on :3456
npm run dev       # Svelte dev server on :5173
```

## Memory Inspector Configuration

The Memory Inspector page shows memory files from your configured projects.
To add projects, either:

1. **Via the UI:** Navigate to Memory Inspector → click "+ Add Project" → enter path → Save
2. **Manually:** Create/edit `~/.view-claude.json`:

```json
{
  "projects": [
    "/path/to/your/project"
  ]
}
```

On Windows, this file is at `%USERPROFILE%/.view-claude.json`.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add Memory Inspector configuration instructions"
```

---

## Verification Checklist

1. `GET /memory/config` returns `{"projects":[]}` on fresh install
2. `POST /memory/config` with `{"action":"add","path":"/test"}` adds to config file
3. `GET /memory/global` returns memory files and agents from `~/.claude/`
4. `GET /memory/projects/data` returns data for all configured projects
5. UI shows global section, projects section, add/remove functionality
6. File content expands inline when clicked
7. `cd web && npx vite build` succeeds
8. No broken imports or runtime errors
