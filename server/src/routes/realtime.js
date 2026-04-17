import { getEvents, getEventCount } from "../store.js";
import { existsSync, readFileSync } from "node:fs";

const PRICING = {
  "claude-opus-4-7": { input: 15.0, output: 75.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "qwen3.6-plus": { input: 1.0, output: 5.0 },
};

function calcCost(model, inputTokens, outputTokens) {
  const p = PRICING[model] || { input: 1.0, output: 5.0 };
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

// Extract token usage from a transcript file (JSONL)
function tokensFromTranscript(transcriptPath, lastModel) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  try {
    const lines = readFileSync(transcriptPath, "utf-8").trim().split("\n").filter(Boolean);
    let totalInput = 0, totalOutput = 0;
    let model = lastModel;
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

export function realtimeRoutes(app) {
  app.get("/stats/realtime", (c) => {
    const events = getEvents(null, 10000);
    const turnEnds = events.filter((e) => e.type === "turn_end");
    const agentEnds = events.filter((e) => e.type === "agent_end");
    const agentStarts = events.filter((e) => e.type === "agent_start");

    let totalTokens = 0;
    let totalCost = 0;
    let totalTools = 0;
    let totalSkills = 0;

    // Per-session transcript usage cache (avoid re-parsing same transcript multiple times)
    const transcriptCache = new Map();

    for (const evt of turnEnds) {
      const d = evt.data || {};
      let input = 0, output = 0, model = d.model || "unknown";

      // Try tokens_used from event first (legacy / test data)
      const tokens = d.tokens_used || {};
      if (tokens.input || tokens.output) {
        input = tokens.input;
        output = tokens.output;
        model = d.model || model;
      } else if (d.transcript_path) {
        // Fall back to transcript file parsing
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

      totalTokens += input + output;
      totalCost += calcCost(model, input, output);
      totalTools += (d.tools_used || []).length;
      totalSkills += (d.skills_invoked || []).length;
    }

    // Track active agents (started but not ended)
    const agentMap = new Map();
    let agentCounter = 0;
    for (const evt of agentStarts) {
      agentMap.set(++agentCounter, { status: "running", ...evt.data });
    }
    let endedCounter = 0;
    for (const evt of agentEnds) {
      endedCounter++;
      const entry = [...agentMap.entries()].find(([, a]) => a.status === "running");
      if (entry) entry[1].status = "completed";
    }
    const activeAgents = [...agentMap.values()].filter((a) => a.status === "running").length;

    // Detect errors from events
    const recentErrors = [];
    for (const evt of events.slice(-50).reverse()) {
      if (evt.type === "agent_end" && evt.data?.status === "failed") {
        recentErrors.push({
          timestamp: evt.timestamp || evt.receivedAt,
          message: `Agent ${evt.data?.name || evt.data?.type} failed`,
          type: "agent_fail",
          sessionId: evt.session_id,
        });
      }
      if (recentErrors.length >= 5) break;
    }

    return c.json({
      totalTokens,
      totalCost: +totalCost.toFixed(4),
      activeAgents,
      totalTools,
      totalSkills,
      errorCount: recentErrors.length,
      recentErrors,
    });
  });

  app.get("/errors", (c) => {
    const events = getEvents(null, 10000);
    const errors = [];
    for (const evt of events) {
      if (evt.type === "agent_end" && evt.data?.status === "failed") {
        errors.push({
          timestamp: evt.timestamp || evt.receivedAt,
          message: `Agent ${evt.data?.name || evt.data?.type} failed`,
          type: "agent_fail",
          sessionId: evt.session_id,
        });
      }
    }
    return c.json(errors.slice(-20));
  });
}
