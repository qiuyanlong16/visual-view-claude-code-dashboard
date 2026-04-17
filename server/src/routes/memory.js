import { homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getViewClaudePath() {
  return join(homedir(), ".view-claude.json");
}

export function memoryRoutes(app) {
  app.get("/memory", (c) => {
    const project = c.req.query("project");
    if (!project) {
      return c.json({ error: "Missing project parameter" }, 400);
    }
    const memoryDir = join(project, ".claude", "memory");
    if (!existsSync(memoryDir)) {
      return c.json({ files: [] });
    }

    const files = listMemoryFiles(memoryDir);
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
