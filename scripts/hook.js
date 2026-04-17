/**
 * Claude Code hook script — receives JSON on stdin, enriches it,
 * and POSTs to the event server. Fire-and-forget with 2s timeout.
 *
 * Usage: node hook.js <event_type>
 */

const EVENT_TYPES = [
  "session_start",
  "session_end",
  "turn_end",
  "agent_start",
  "agent_end",
];

const type = process.argv[2];
if (!type || !EVENT_TYPES.includes(type)) {
  console.error(`Usage: node hook.js <${EVENT_TYPES.join("|")}>`);
  process.exit(0); // Don't block Claude Code
}

async function main() {
  let stdin = "";
  for await (const chunk of process.stdin) {
    stdin += chunk.toString();
  }

  if (!stdin.trim()) {
    console.error("No stdin provided");
    return;
  }

  let data;
  try {
    data = JSON.parse(stdin);
  } catch {
    console.error("Invalid JSON on stdin");
    return;
  }

  const event = {
    type,
    session_id: data.session_id || process.env.CLAUDE_SESSION_ID || "unknown",
    timestamp: new Date().toISOString(),
    project: process.cwd(),
    data,
  };

  const serverUrl =
    process.env.CC_OBSERVABILITY_SERVER || "http://localhost:3456";

  await fetch(`${serverUrl}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(2000),
  });
}

main().catch(() => {
  // Fire-and-forget — never fail
});
