import { describe, it } from "node:test";
import assert from "node:assert";
import { Hono } from "hono";
import { realtimeRoutes } from "../src/routes/realtime.js";

describe("realtime endpoints", async () => {
  const app = new Hono();
  realtimeRoutes(app);

  it("GET /stats/realtime returns KPI values", async () => {
    const res = await app.request("/stats/realtime");
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.totalTokens === "number");
    assert.ok(typeof data.totalCost === "number");
    assert.ok(typeof data.activeAgents === "number");
    assert.ok(typeof data.totalTools === "number");
    assert.ok(typeof data.totalSkills === "number");
    assert.ok(typeof data.errorCount === "number");
    assert.ok(Array.isArray(data.recentErrors));
  });

  it("GET /errors returns error list", async () => {
    const res = await app.request("/errors");
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });
});
