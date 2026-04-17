import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DATA_DIR = process.env.CC_DATA_DIR || join("data");
const SESSIONS_DIR = join(DATA_DIR, "sessions");
mkdirSync(SESSIONS_DIR, { recursive: true });

const EVENTS_FILE = join(DATA_DIR, "events.jsonl");
if (!existsSync(EVENTS_FILE)) {
  console.log("No events.jsonl found");
  process.exit(0);
}

const lines = readFileSync(EVENTS_FILE, "utf-8").trim().split("\n").filter(Boolean);
console.log(`Processing ${lines.length} events...`);

const sessions = new Map();

for (const line of lines) {
  const event = JSON.parse(line);
  const sid = event.session_id;
  if (!sid) continue;

  if (!sessions.has(sid)) {
    sessions.set(sid, {
      id: sid,
      project: event.project || "",
      status: "active",
      startedAt: event.timestamp || event.receivedAt,
      turns: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      skillsUsed: [],
      agentsCalled: 0,
    });
  }

  const s = sessions.get(sid);

  switch (event.type) {
    case "session_start":
      s.startedAt = event.timestamp || event.receivedAt;
      s.project = event.project || s.project;
      break;
    case "turn_end": {
      const d = event.data || {};
      const usage = d.usage || {};
      const skills = d.skills_invoked || [];
      const agentInfo = d.agent_info || {};
      s.turns++;
      s.totalInputTokens += usage.input_tokens || 0;
      s.totalOutputTokens += usage.output_tokens || 0;
      s.model = d.model || s.model;
      if (agentInfo.is_agent) s.agentsCalled++;
      for (const sk of skills) {
        if (!s.skillsUsed.includes(sk)) s.skillsUsed.push(sk);
      }
      s.updatedAt = event.timestamp || event.receivedAt;
      break;
    }
    case "session_end": {
      const d = event.data || {};
      const usage = d.usage || {};
      s.status = "completed";
      s.endedAt = event.timestamp || event.receivedAt;
      s.totalInputTokens += usage.input_tokens || 0;
      s.totalOutputTokens += usage.output_tokens || 0;
      break;
    }
  }
}

for (const [sid, s] of sessions) {
  const path = join(SESSIONS_DIR, `${sid}.json`);
  writeFileSync(path, JSON.stringify(s, null, 2), "utf-8");
}

console.log(`Rebuilt ${sessions.size} sessions.`);
