<script>
  import { onMount, onDestroy } from "svelte";
  import {
    isReady,
    isChecking,
    detectResult,
    checkSetup,
    startPolling,
    stopPolling,
    installHooks,
  } from "../stores/setup.js";
  import { navigate } from "../router.js";

  let retryClicked = false;

  const POLL_MS = 5000;

  onMount(async () => {
    await checkSetup();
    startPolling(POLL_MS);
  });

  onDestroy(() => {
    stopPolling();
  });

  function onRetry() {
    retryClicked = true;
    checkSetup().then(() => {
      setTimeout(() => (retryClicked = false), 200);
    });
  }

  function onInstallHooks() {
    installHooks(["global", "project"]).then(() => {
      checkSetup();
    });
  }
</script>

<div class="detection-overlay">
  <div class="detection-container">
    <!-- Spinner -->
    <div class="spinner" class:checking={$isChecking}></div>

    <!-- Status heading -->
    {#if $isChecking}
      <h2 class="status-heading">Detecting Claude Code...</h2>
    {:else if $detectResult && !$detectResult.ready}
      <h2 class="status-heading error">Claude Code Not Fully Configured</h2>
    {/if}

    <!-- Detection details -->
    {#if $detectResult}
      <div class="detection-card">
        <div class="check-item" class:ok={$detectResult.claudeInstalled}>
          <span class="check-icon">{$detectResult.claudeInstalled ? "✓" : "✗"}</span>
          <span class="check-label">Claude CLI</span>
          <span class="check-detail">
            {$detectResult.claudeInstalled
              ? $detectResult.claudeVersion || "found"
              : "not found"}
          </span>
        </div>
        <div class="check-item" class:ok={$detectResult.globalSettingsExists}>
          <span class="check-icon">{$detectResult.globalSettingsExists ? "✓" : "✗"}</span>
          <span class="check-label">Global Settings</span>
          <span class="check-detail">{$detectResult.globalSettingsPath}</span>
        </div>
        <div class="check-item" class:ok={$detectResult.projectSettingsExists}>
          <span class="check-icon">{$detectResult.projectSettingsExists ? "✓" : "✗"}</span>
          <span class="check-label">Project Settings</span>
          <span class="check-detail">{$detectResult.projectSettingsPath}</span>
        </div>
        <div class="check-item" class:ok={$detectResult.hooksConfigured && ($detectResult.hooksConfigured.global || $detectResult.hooksConfigured.project)}>
          <span class="check-icon">{$detectResult.hooksConfigured && ($detectResult.hooksConfigured.global || $detectResult.hooksConfigured.project) ? "✓" : "✗"}</span>
          <span class="check-label">Hooks Configured</span>
          <span class="check-detail">
            {#if $detectResult.hooksConfigured}
              {#if $detectResult.hooksConfigured.global}global ✓{/if}
              {#if $detectResult.hooksConfigured.project}project ✓{/if}
              {#if !$detectResult.hooksConfigured.global && !$detectResult.hooksConfigured.project}none{/if}
            {/if}
          </span>
        </div>
      </div>

      <!-- Not ready: show actions -->
      {#if !$detectResult.claudeInstalled}
        <div class="install-guide">
          <p>Claude Code is required. Install it first:</p>
          <code>npm install -g @anthropic-ai/claude-code</code>
        </div>
      {:else if !$detectResult.ready}
        <div class="install-guide">
          <p>Hooks not configured. Click below to auto-setup:</p>
          <button class="btn-install" on:click={onInstallHooks}>
            Auto-Install Hooks
          </button>
        </div>
      {/if}
    {/if}

    <!-- Polling indicator -->
    <div class="polling-indicator">
      <div class="poll-bar"></div>
      <span class="poll-text">Re-checking every 5s...</span>
      <button class="btn-retry" on:click={onRetry} class:active={retryClicked}>
        Retry Now
      </button>
    </div>
  </div>
</div>

<style>
  .detection-overlay {
    position: fixed;
    inset: 0;
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .detection-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    max-width: 520px;
    width: 100%;
    padding: 0 20px;
  }

  .spinner {
    width: 56px;
    height: 56px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.checking {
    animation-duration: 0.6s;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .status-heading {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    text-align: center;
  }

  .status-heading.error {
    color: var(--red);
  }

  .detection-card {
    width: 100%;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    animation: fadeIn 0.3s ease both;
  }

  .check-item:nth-child(1) { animation-delay: 0.05s; }
  .check-item:nth-child(2) { animation-delay: 0.1s; }
  .check-item:nth-child(3) { animation-delay: 0.15s; }
  .check-item:nth-child(4) { animation-delay: 0.2s; }

  .check-item.ok .check-icon {
    color: var(--green);
  }

  .check-item:not(.ok) .check-icon {
    color: var(--red);
  }

  .check-icon {
    font-size: 14px;
    font-weight: 700;
    width: 18px;
    text-align: center;
  }

  .check-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    min-width: 130px;
  }

  .check-detail {
    font-size: 12px;
    color: var(--text-muted);
    word-break: break-all;
  }

  .install-guide {
    width: 100%;
    text-align: center;
  }

  .install-guide p {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0 0 8px;
  }

  .install-guide code {
    display: inline-block;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    font-family: var(--mono);
    color: var(--text-primary);
  }

  .btn-install {
    display: inline-block;
    padding: 10px 24px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-install:hover {
    opacity: 0.85;
  }

  .polling-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .poll-bar {
    flex: 1;
    height: 2px;
    background: var(--border);
    position: relative;
    overflow: hidden;
    border-radius: 1px;
  }

  .poll-bar::after {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0%;
    background: var(--accent);
    animation: pollFill 5s linear infinite;
  }

  @keyframes pollFill {
    to { width: 100%; }
  }

  .poll-text {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .btn-retry {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .btn-retry:hover {
    border-color: var(--accent);
    color: var(--text-primary);
  }

  .btn-retry.active {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
