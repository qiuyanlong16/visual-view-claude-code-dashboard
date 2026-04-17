import { getSessions, getSessionById, saveSession } from "../store.js";

export function sessionRoutes(app) {
  app.get("/sessions", (c) => {
    const status = c.req.query("status");
    let sessions = getSessions();
    if (status) {
      sessions = sessions.filter((s) => s.status === status);
    }
    return c.json(sessions);
  });

  app.get("/sessions/:id", (c) => {
    const session = getSessionById(c.req.param("id"));
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json(session);
  });

  app.post("/sessions", async (c) => {
    try {
      const data = await c.req.json();
      if (!data.id) return c.json({ error: "Missing session id" }, 400);
      saveSession(data.id, data);
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: e.message }, 400);
    }
  });
}
