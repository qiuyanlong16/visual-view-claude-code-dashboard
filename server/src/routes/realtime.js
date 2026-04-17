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
// Returns actual billed tokens (input_tokens = new, cache_read = cached read,
// cache_creation = newly cached, output_tokens = model output)
function tokensFromTranscript(transcriptPath, lastModel) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  try {
    const lines = readFileSync(transcriptPath, "utf-8").trim().split("\n").filter(Boolean);
    let inputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0, outputTokens = 0;
    let model = lastModel;
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.type === "assistant" && entry.message?.usage) {
        const u = entry.message.usage;
        inputTokens += u.input_tokens || 0;
        cacheReadTokens += u.cache_read_input_tokens || 0;
        cacheCreationTokens += u.cache_creation_input_tokens || 0;
        outputTokens += u.output_tokens || 0;
        model = entry.message.model || model;
      }
    }
    return { inputTokens, cacheReadTokens, cacheCreationTokens, outputTokens, model };
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

    // Group turn_end events by transcript_path — each transcript is parsed ONCE
    const transcriptEvents = new Map();
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

    // Parse each transcript once, split tokens across referencing events
    for (const [tp, evts] of transcriptEvents) {
      const t = tokensFromTranscript(tp, "unknown");
      const inputTokens = t ? t.inputTokens : 0;
      const outputTokens = t ? t.outputTokens : 0;
      const model = t ? t.model || "unknown" : "unknown";

      const n = evts.length;
      const perInput = Math.round(inputTokens / n);
      const perOutput = Math.round(outputTokens / n);
      const perTotal = perInput + perOutput;
      const perCost = calcCost(model, perInput, perOutput);

      for (const evt of evts) {
        totalTokens += perTotal;
        totalCost += perCost;
        const d = evt.data || {};
        totalTools += (d.tools_used || []).length;
        totalSkills += (d.skills_invoked || []).length;
      }
    }

    // Fallback for events without transcript (legacy tokens_used data)
    for (const evt of eventsWithoutTranscript) {
      const d = evt.data || {};
      const tokens = d.tokens_used || {};
      const input = tokens.input || 0;
      const output = tokens.output || 0;
      const model = d.model || "unknown";
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
