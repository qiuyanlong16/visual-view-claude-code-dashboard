import { homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getViewClaudePath() {
  return join(homedir(), ".view-claude.json");
}

// Claude Code stores project-specific memory at:
// ~/.claude/projects/<project-dir-name>/memory/
// where <project-dir-name> is the workspace dir name with path separators replaced by dashes
function getProjectMemoryDir(projectPath) {
  const projectsDir = join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) return null;
  // Derive the expected directory name from the project path
  const projName = basename(projectPath).replace(/[\\/:]/g, "-");
  // Also try the full relative path as directory name
  const candidates = [projName];
  // e.g. "d--workspace-visual-view-claude-code-coding"
  const driveAndPath = projectPath.replace(/[\\/:]/g, "-").replace(/^([A-Z])-/, "$1--");
  candidates.push(driveAndPath);
  for (const name of candidates) {
    const memDir = join(projectsDir, name, "memory");
    if (existsSync(memDir)) return memDir;
  }
  // Fallback: scan all subdirs of ~/.claude/projects/ looking for one with a matching memory dir
  try {
    const entries = readdirSync(projectsDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const md = join(projectsDir, e.name, "memory");
        if (existsSync(md)) return md;
      }
    }
  } catch {}
  return null;
}

export function memoryRoutes(app) {
  app.get("/memory", (c) => {
    const project = c.req.query("project");
    if (!project) {
      return c.json({ error: "Missing project parameter" }, 400);
    }
    const files = [];
    // Check standard .claude/memory/ path
    const memDir = join(project, ".claude", "memory");
    if (existsSync(memDir)) {
      files.push(...listMemoryFiles(memDir));
    }
    // Check Claude Code's actual storage: ~/.claude/projects/<name>/memory/
    const ccMemDir = getProjectMemoryDir(project);
    if (ccMemDir && ccMemDir !== memDir) {
      const ccFiles = listMemoryFiles(ccMemDir);
      for (const f of ccFiles) {
        if (!files.some((existing) => existing.name === f.name)) {
          files.push(f);
        }
      }
    }
    return c.json({ project, files });
  });

  app.get("/memory/content", (c) => {
    const path = c.req.query("path");
    if (!path || !existsSync(path)) {
      return c.json({ error: "File not found" }, 404);
    }
    const content = readFileSync(path, "utf-8");
    const stat = statSync(path);
    return c.json({
      path,
      size: stat.size,
      modified: stat.mtime.toISOString(),
      content,
    });
  });

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
      if (action !== "add" && action !== "remove") {
        return c.json({ error: "Invalid action. Must be 'add' or 'remove'" }, 400);
      }
      if (action === "add" && path && !data.projects.includes(path)) {
        data.projects.push(path);
      } else if (action === "remove" && path) {
        data.projects = data.projects.filter((p) => p !== path);
      }
      writeFileSync(configPath, JSON.stringify(data, null, 2), "utf-8");
      return c.json({ projects: data.projects });
    } catch (e) {
      return c.json({ error: e.message }, 400);
    }
  });

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

      // Memory files — from both .claude/memory/ and ~/.claude/projects/<name>/memory/
      const memDir = join(projectPath, ".claude", "memory");
      const ccMemDir = getProjectMemoryDir(projectPath);
      const scannedDirs = new Set();
      if (existsSync(memDir)) scannedDirs.add(memDir);
      if (ccMemDir) scannedDirs.add(ccMemDir);
      for (const dir of scannedDirs) {
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isFile() && e.name.endsWith(".md")) {
              const fullPath = join(dir, e.name);
              const st = statSync(fullPath);
              // Avoid duplicates
              if (!entry.memoryFiles.some((f) => f.name === e.name)) {
                entry.memoryFiles.push({
                  name: e.name,
                  path: fullPath,
                  size: st.size,
                  modified: st.mtime.toISOString(),
                });
              }
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

  app.get("/memory/global", (c) => {
    const homeDir = homedir();
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
}

function listMemoryFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMemoryFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      const stat = statSync(fullPath);
      files.push({
        path: fullPath,
        name: entry.name,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }
  }
  return files;
}
