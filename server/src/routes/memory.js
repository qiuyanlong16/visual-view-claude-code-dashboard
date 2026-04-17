import { homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync as fsReaddir } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getUserHome() {
  return homedir();
}

function getViewClaudePath() {
  return join(getUserHome(), ".view-claude.json");
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
}

function listMemoryFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = fsReaddir(dir, { withFileTypes: true });
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
