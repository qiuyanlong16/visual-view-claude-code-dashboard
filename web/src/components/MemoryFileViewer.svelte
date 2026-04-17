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
