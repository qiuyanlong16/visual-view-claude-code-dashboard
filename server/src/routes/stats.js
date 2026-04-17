import { getEvents, getEventCount, getEventsByType } from "../store.js";
import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PRICING = {
  "claude-opus-4-7": { input: 15.0, output: 75.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "qwen3.6-plus": { input: 1.0, output: 5.0 },
};

function calcCost(model, inputTokens, outputTokens) {
  const p = PRICING[model] || { input: 1.0, output: 5.0 };
  return (
    ((inputTokens / 1_000_000) * p.input +
      (outputTokens / 1_000_000) * p.output)
  );
}

// Extract token usage from a transcript file (JSONL)
function tokensFromTranscript(transcriptPath, fallbackModel) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  try {
    const lines = readFileSync(transcriptPath, "utf-8").trim().split("\n").filter(Boolean);
    let totalInput = 0, totalOutput = 0, model = fallbackModel;
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.type === "assistant" && entry.message?.usage) {
        const u = entry.message.usage;
        totalInput += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        totalOutput += u.output_tokens || 0;
        model = entry.message.model || model;
      }
    }
    return { input: totalInput, output: totalOutput, model };
  } catch {
    return null;
  }
}

export function statsRoutes(app) {
  app.get("/stats", (c) => {
    const events = getEvents(null, 10000);
    const turnEnds = events.filter((e) => e.type === "turn_end");

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    const modelBreakdown = {};
    const skillCounts = {};
    const pluginCounts = {};
    const mcpCounts = {};
    const toolCounts = {};
    const agentCounts = {};
    const dailyTokens = {};

    // Per-session transcript cache
    const transcriptCache = new Map();

    for (const evt of turnEnds) {
      const d = evt.data || {};
      let input = 0, output = 0, model = d.model || "unknown";

      // Try tokens_used from event first (legacy / test data)
      const tokens = d.tokens_used || {};
      if (tokens.input || tokens.output) {
        input = tokens.input;
        output = tokens.output;
      } else if (d.transcript_path) {
        const cached = transcriptCache.get(d.transcript_path);
        if (cached) {
          input = cached.input;
          output = cached.output;
          model = cached.model;
        } else {
          const t = tokensFromTranscript(d.transcript_path, model);
          if (t) {
            input = t.input;
            output = t.output;
            model = t.model || model;
          }
          transcriptCache.set(d.transcript_path, { input, output, model });
        }
      }

      totalInputTokens += input;
      totalOutputTokens += output;

      const cost = calcCost(model, input, output);
      totalCost += cost;

      if (!modelBreakdown[model]) modelBreakdown[model] = { calls: 0, input: 0, output: 0, cost: 0 };
      modelBreakdown[model].calls++;
      modelBreakdown[model].input += input;
      modelBreakdown[model].output += output;
      modelBreakdown[model].cost += cost;

      for (const skill of d.skills_invoked || []) {
        if (skill.startsWith("plugin:")) {
          pluginCounts[skill] = (pluginCounts[skill] || 0) + 1;
        } else {
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        }
      }
      for (const mcp of d.mcp_servers || []) {
        const name = typeof mcp === "string" ? mcp : mcp.name || mcp.server_name || "unknown";
        mcpCounts[name] = (mcpCounts[name] || 0) + 1;
      }
      for (const tool of d.tools_used || []) {
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      }
      for (const agent of d.agents_launched || []) {
        const name = agent.name || agent.type || "unknown";
        agentCounts[name] = (agentCounts[name] || 0) + 1;
      }

      const day = evt.timestamp?.slice(0, 10) || evt.receivedAt?.slice(0, 10) || "unknown";
      if (!dailyTokens[day]) dailyTokens[day] = { input: 0, output: 0 };
      dailyTokens[day].input += input;
      dailyTokens[day].output += output;
    }

    // Scan memory files from known projects
    const projects = new Set(events.map((e) => e.project).filter(Boolean));
    // Also always include the current workspace's Claude Code project memory
    projects.add(process.cwd());
    let memoryFiles = 0;
    let memorySize = 0;
    let memoryLastAccess = null;

    for (const project of projects) {
      const dirsToScan = new Set();
      const memDir = join(project, ".claude", "memory");
      if (existsSync(memDir)) dirsToScan.add(memDir);
      // Claude Code's actual project memory: ~/.claude/projects/<name>/memory/
      const ccProjectsDir = join(homedir(), ".claude", "projects");
      if (existsSync(ccProjectsDir)) {
        try {
          const ccEntries = readdirSync(ccProjectsDir, { withFileTypes: true });
          for (const e of ccEntries) {
            if (e.isDirectory()) {
              const md = join(ccProjectsDir, e.name, "memory");
              if (existsSync(md)) dirsToScan.add(md);
            }
          }
        } catch {}
      }

      for (const dir of dirsToScan) {
        try {
          const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(".md")) {
              const fullPath = join(dir, entry.name);
              if (existsSync(fullPath)) {
                const st = statSync(fullPath);
                memoryFiles++;
                memorySize += st.size;
                if (!memoryLastAccess || st.mtime > memoryLastAccess) {
                  memoryLastAccess = st.mtime;
                }
              }
            }
          }
        } catch {
          // skip inaccessible project
        }
      }
    }

    return c.json({
      totalTurns: turnEnds.length,
      totalInputTokens,
      totalOutputTokens,
      totalCost: +totalCost.toFixed(4),
      modelBreakdown,
      skillCounts,
      pluginCounts,
      mcpCounts,
      toolCounts,
      agentCounts,
      dailyTokens,
      memoryStats: {
        files: memoryFiles,
        size: memorySize,
        lastAccess: memoryLastAccess ? memoryLastAccess.toISOString() : null,
      },
    });
  });
}
