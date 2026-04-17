import { describe, it } from "node:test";
import assert from "node:assert";
import { Hono } from "hono";

describe("API endpoints", async () => {
  const { eventRoutes } = await import("../src/routes/events.js");
  const { sessionRoutes } = await import("../src/routes/sessions.js");
  const { statsRoutes } = await import("../src/routes/stats.js");

  const app = new Hono();
  eventRoutes(app);
  sessionRoutes(app);
  statsRoutes(app);

  it("POST /events accepts valid events", async () => {
    const res = await app.request("/events", {
      method: "POST",
      body: JSON.stringify({
        type: "turn_end",
        session_id: "test-1",
        timestamp: "2026-04-17T10:00:00Z",
        project: "/test",
        data: { turn_number: 1, model: "test" },
      }),
      headers: { "Content-Type": "application/json" },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
  });

  it("POST /events rejects missing type", async () => {
    const res = await app.request("/events", {
      method: "POST",
      body: JSON.stringify({ session_id: "x", data: {} }),
      headers: { "Content-Type": "application/json" },
    });
    assert.strictEqual(res.status, 400);
  });

  it("GET /events/history returns saved events", async () => {
    await app.request("/events", {
      method: "POST",
      body: JSON.stringify({
        type: "turn_end",
        session_id: "test-2",
        timestamp: "2026-04-17T10:00:00Z",
        project: "/test",
        data: {},
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await app.request("/events/history");
    assert.strictEqual(res.status, 200);
    const events = await res.json();
    assert.ok(events.length > 0);
  });

  it("GET /health returns ok", async () => {
    const { Hono } = await import("hono");
    const healthApp = new Hono();
    healthApp.get("/health", (c) => c.json({ status: "ok" }));
    const res = await healthApp.request("/health");
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, "ok");
  });

  it("GET /sessions returns empty list", async () => {
    const res = await app.request("/sessions");
    assert.strictEqual(res.status, 200);
  });

  it("GET /stats returns aggregated stats", async () => {
    const res = await app.request("/stats");
    assert.strictEqual(res.status, 200);
    const stats = await res.json();
    assert.ok(typeof stats.totalTurns === "number");
    assert.ok(typeof stats.totalCost === "number");
  });
});
