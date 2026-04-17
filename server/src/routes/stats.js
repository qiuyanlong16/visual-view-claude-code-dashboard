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
    let inputTokens = 0, outputTokens = 0, model = fallbackModel;
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.type === "assistant" && entry.message?.usage) {
        const u = entry.message.usage;
        inputTokens += u.input_tokens || 0;
        outputTokens += u.output_tokens || 0;
        model = entry.message.model || model;
      }
    }
    return { inputTokens, outputTokens, model };
  } catch {
    return null;
  }
}

// Extract tool calls from a transcript file (JSONL)
function toolsFromTranscript(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return {};
  try {
    const lines = readFileSync(transcriptPath, "utf-8").trim().split("\n").filter(Boolean);
    const tools = {};
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.type === "assistant" && entry.message?.content && Array.isArray(entry.message.content)) {
        for (const c of entry.message.content) {
          if (c.type === "tool_use") {
            const name = c.name || "unknown";
            tools[name] = (tools[name] || 0) + 1;
          }
        }
      }
    }
    return tools;
  } catch {
    return {};
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

    // Group turn_end events by transcript_path, then parse each transcript ONCE
    const transcriptEvents = new Map(); // transcript_path -> [event, ...]
    const eventsWithoutTranscript = [];

    for (const evt of turnEnds) {
      const d = evt.data || {};
      const tp = d.transcript_path;
      if (tp && existsSync(tp)) {
        if (!transcriptEvents.has(tp)) transcriptEvents.set(tp, []);
        transcriptEvents.get(tp).push(evt);
      } else {
        eventsWithoutTranscript.push(evt);
      }
    }

    // Parse each transcript file once and attribute total to all referencing events
    for (const [tp, evts] of transcriptEvents) {
      const t = tokensFromTranscript(tp, "unknown");
      const inputTokens = t ? t.inputTokens : 0;
      const outputTokens = t ? t.outputTokens : 0;
      const model = t ? t.model || "unknown" : "unknown";

      // Parse tools once per transcript
      const tools = toolsFromTranscript(tp);

      const n = evts.length;
      const perInput = Math.round(inputTokens / n);
      const perOutput = Math.round(outputTokens / n);

      for (const evt of evts) {
        totalInputTokens += perInput;
        totalOutputTokens += perOutput;
        const cost = calcCost(model, perInput, perOutput);
        totalCost += cost;
        const d = evt.data || {};
        if (!modelBreakdown[model]) modelBreakdown[model] = { calls: 0, input: 0, output: 0, cost: 0 };
        modelBreakdown[model].calls++;
        modelBreakdown[model].input += perInput;
        modelBreakdown[model].output += perOutput;
        modelBreakdown[model].cost += cost;

        for (const skill of d.skills_invoked || []) {
          if (skill.startsWith("plugin:")) pluginCounts[skill] = (pluginCounts[skill] || 0) + 1;
          else skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        }
        for (const mcp of d.mcp_servers || []) {
          const name = typeof mcp === "string" ? mcp : mcp.name || mcp.server_name || "unknown";
          mcpCounts[name] = (mcpCounts[name] || 0) + 1;
        }
        // Legacy tools_used from event data (per-event)
        for (const tool of d.tools_used || []) toolCounts[tool] = (toolCounts[tool] || 0) + 1;
        for (const agent of d.agents_launched || []) {
          agentCounts[agent.name || agent.type || "unknown"] = (agentCounts[agent.name || agent.type || "unknown"] || 0) + 1;
        }
        const day = evt.timestamp?.slice(0, 10) || evt.receivedAt?.slice(0, 10) || "unknown";
        if (!dailyTokens[day]) dailyTokens[day] = { input: 0, output: 0 };
        dailyTokens[day].input += perInput;
        dailyTokens[day].output += perOutput;
      }
      // Add transcript-parsed tools (counted once per transcript/session)
      for (const [toolName, count] of Object.entries(tools)) {
        toolCounts[toolName] = (toolCounts[toolName] || 0) + count;
      }
    }

    // Fallback for events without transcript (legacy data with tokens_used)
    for (const evt of eventsWithoutTranscript) {
      const d = evt.data || {};
      const tokens = d.tokens_used || {};
      const input = tokens.input || 0;
      const output = tokens.output || 0;
      const model = d.model || "unknown";

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
