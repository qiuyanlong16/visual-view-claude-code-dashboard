import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const HOOK_SCRIPT_PATH = join(PROJECT_ROOT, "scripts", "hook.js");

const HOOK_KEYS = [
  "SessionStartHook",
  "SessionEndHook",
  "TurnEndHook",
  "SubAgentStartHook",
  "SubAgentEndHook",
];

function getHookScriptAbsolutePath() {
  return HOOK_SCRIPT_PATH;
}

function getGlobalSettingsPath() {
  return join(homedir(), ".claude", "settings.json");
}

function getProjectSettingsPath() {
  return join(PROJECT_ROOT, ".claude", "settings.local.json");
}

async function detectClaude() {
  const platform = process.platform;
  const cmd = platform === "win32" ? "where claude" : "which claude";
  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    const binPath = stdout.trim().split("\n")[0].trim();
    try {
      const { stdout: ver } = await execAsync("claude --version", {
        timeout: 5000,
      });
      return { installed: true, version: ver.trim(), path: binPath };
    } catch {
      return { installed: true, version: "unknown", path: binPath };
    }
  } catch {
    // Fallback: try npx
    try {
      const { stdout } = await execAsync("npx --yes claude --version", {
        timeout: 10000,
      });
      return { installed: true, version: stdout.trim(), path: "npx" };
    } catch {
      return { installed: false, version: null, path: null };
    }
  }
}

function checkHooks(settingsPath) {
  if (!existsSync(settingsPath)) return false;
  try {
    const raw = readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw);
    const hooks = settings.hooks || {};
    return HOOK_KEYS.every((k) => k in hooks);
  } catch {
    return false;
  }
}

function mergeHooks(existing, hookScriptPath) {
  const result = { ...existing, hooks: { ...(existing.hooks || {}) } };
  const hookMap = {
    SessionStartHook: `node "${hookScriptPath}" session_start`,
    SessionEndHook: `node "${hookScriptPath}" session_end`,
    TurnEndHook: `node "${hookScriptPath}" turn_end`,
    SubAgentStartHook: `node "${hookScriptPath}" agent_start`,
    SubAgentEndHook: `node "${hookScriptPath}" agent_end`,
  };
  for (const [key, value] of Object.entries(hookMap)) {
    if (!result.hooks[key]) {
      result.hooks[key] = value;
    }
  }
  return result;
}

function installHooksToFile(settingsPath, hookScriptPath) {
  let existing = {};
  if (existsSync(settingsPath)) {
    try {
      existing = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch {
      existing = {};
    }
  }
  const merged = mergeHooks(existing, hookScriptPath);
  const dir = dirname(settingsPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(settingsPath, JSON.stringify(merged, null, 2), "utf-8");
  return true;
}

export async function detect() {
  const claude = await detectClaude();
  const globalPath = getGlobalSettingsPath();
  const projectPath = getProjectSettingsPath();
  const globalHooks = checkHooks(globalPath);
  const projectHooks = checkHooks(projectPath);

  return {
    claudeInstalled: claude.installed,
    claudeVersion: claude.version,
    globalSettingsPath: globalPath,
    globalSettingsExists: existsSync(globalPath),
    projectSettingsPath: projectPath,
    projectSettingsExists: existsSync(projectPath),
    hookScriptPath: getHookScriptAbsolutePath(),
    hooksConfigured: {
      global: globalHooks,
      project: projectHooks,
    },
    ready: claude.installed && (globalHooks || projectHooks),
  };
}

export async function installHooks(targets = ["global", "project"]) {
  const hookScriptPath = getHookScriptAbsolutePath();
  const results = {};

  if (targets.includes("global")) {
    try {
      installHooksToFile(getGlobalSettingsPath(), hookScriptPath);
      results.global = { success: true };
    } catch (e) {
      results.global = { success: false, error: e.message };
    }
  }

  if (targets.includes("project")) {
    try {
      installHooksToFile(getProjectSettingsPath(), hookScriptPath);
      results.project = { success: true };
    } catch (e) {
      results.project = { success: false, error: e.message };
    }
  }

  return results;
}

export async function autoSetupHooks() {
  console.log("[setup] Running auto-detection...");
  const result = await detect();

  if (!result.claudeInstalled) {
    console.log(
      "[setup] Claude Code not found on this machine. Skipping hook installation."
    );
    return result;
  }

  const missingTargets = [];
  if (!result.hooksConfigured.global) missingTargets.push("global");
  if (!result.hooksConfigured.project) missingTargets.push("project");

  if (missingTargets.length === 0) {
    console.log("[setup] Hooks already configured. Nothing to do.");
    return result;
  }

  console.log(
    `[setup] Installing hooks for: ${missingTargets.join(", ")}...`
  );
  const installResult = await installHooks(missingTargets);
  console.log("[setup] Auto-setup complete:", JSON.stringify(installResult));

  return { ...result, ...installResult };
}

export function setupRoutes(app) {
  app.get("/setup/detect", async (c) => {
    const result = await detect();
    return c.json(result);
  });

  app.post("/setup/install-hooks", async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }
    const targets = body.targets || ["global", "project"];
    const result = await installHooks(targets);
    return c.json(result);
  });
}
