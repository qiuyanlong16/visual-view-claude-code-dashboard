import { saveEvent, getEvents, getEventCount, bus, saveSession, getSessions } from "../store.js";

function updateSessionFromEvent(event) {
  const sid = event.session_id;
  if (!sid) return;

  switch (event.type) {
    case "session_start": {
      const session = getSessions().find((s) => s.id === sid);
      if (!session) {
        saveSession(sid, {
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
      break;
    }
    case "turn_end": {
      const d = event.data || {};
      const model = d.model || "";
      const usage = d.usage || {};
      const skills = d.skills_invoked || [];
      const agentInfo = d.agent_info || {};
      const isAgent = !!agentInfo.is_agent;

      // Find or create session
      let session = getSessions().find((s) => s.id === sid);
      if (!session) {
        session = {
          id: sid,
          project: event.project || "",
          status: "active",
          startedAt: event.timestamp || event.receivedAt,
          turns: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          skillsUsed: [],
          agentsCalled: 0,
        };
      }

      session.turns = (session.turns || 0) + 1;
      session.totalInputTokens = (session.totalInputTokens || 0) + (usage.input_tokens || 0);
      session.totalOutputTokens = (session.totalOutputTokens || 0) + (usage.output_tokens || 0);
      session.model = model;
      if (isAgent) session.agentsCalled = (session.agentsCalled || 0) + 1;
      const skillSet = new Set([...(session.skillsUsed || []), ...skills]);
      session.skillsUsed = [...skillSet];
      session.updatedAt = event.timestamp || event.receivedAt;

      saveSession(sid, session);
      break;
    }
    case "session_end": {
      const d = event.data || {};
      const usage = d.usage || {};
      let session = getSessions().find((s) => s.id === sid);
      if (session) {
        session.status = "completed";
        session.endedAt = event.timestamp || event.receivedAt;
        session.totalInputTokens = (session.totalInputTokens || 0) + (usage.input_tokens || 0);
        session.totalOutputTokens = (session.totalOutputTokens || 0) + (usage.output_tokens || 0);
        saveSession(sid, session);
      }
      break;
    }
    case "agent_start":
    case "agent_end": {
      // Agent events are tracked via turn_end; just ensure session exists
      if (!getSessions().find((s) => s.id === sid)) {
        saveSession(sid, {
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
      break;
    }
  }
}

const clients = new Set();

export function eventRoutes(app) {
  app.post("/events", async (c) => {
    try {
      const event = await c.req.json();
      if (!event.type || !event.session_id) {
        return c.json({ error: "Missing type or session_id" }, 400);
      }
      saveEvent(event);
      updateSessionFromEvent(event);
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: e.message }, 400);
    }
  });

  app.get("/events/sse", async (c) => {
    const lastId = c.req.query("Last-Event-ID") || c.req.query("lastEventId");
    const history = getEvents(lastId);

    const stream = new ReadableStream({
      start(controller) {
        // Send history first
        for (const evt of history) {
          const data = `id: ${evt._idx ?? 0}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        }

        const onEvent = (evt) => {
          const data = `id: ${evt._idx ?? 0}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        };

        bus.on("event", onEvent);
        clients.add(onEvent);

        // Cleanup on disconnect
        c.req.raw.signal.addEventListener("abort", () => {
          bus.off("event", onEvent);
          clients.delete(onEvent);
          controller.close();
        });
      },
    });

    return c.newResponse(stream, 200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
  });

  app.get("/events/history", (c) => {
    const afterId = c.req.query("afterId");
    const limit = Number(c.req.query("limit")) || 500;
    return c.json(getEvents(afterId, limit));
  });

  app.get("/events/count", (c) => {
    return c.json({ count: getEventCount() });
  });
}
