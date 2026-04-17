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

  function handleFolderPick(e) {
    const files = e.target.files;
    if (files.length > 0) {
      // webkitdirectory returns files with webkitRelativePath like "project/.claude/memory/foo.md"
      // Extract the root folder path from the first file
      const parts = files[0].webkitRelativePath.split("/");
      // Take the first segment as the project root
      newProjectPath = parts[0];
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
      <input type="text" bind:value={newProjectPath} placeholder="Project path (e.g. D:/workspace/my-project)" />
      <label class="folder-btn" title="Pick a folder">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        <input type="file" webkitdirectory on:change={handleFolderPick} />
      </label>
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
                <MemoryFileViewer fileName="CLAUDE.md" filePath={projectPath + "/CLAUDE.md"} expanded={true} />
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
    display: flex; gap: 8px; margin-bottom: 12px; align-items: center;
  }
  .add-form input[type="text"] { flex: 1; }
  .folder-btn {
    display: flex; align-items: center; justify-content: center;
    padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border);
    border-radius: 4px; color: var(--text-secondary); cursor: pointer;
  }
  .folder-btn:hover { background: var(--bg-hover); }
  .folder-btn input[type="file"] { display: none; }
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
