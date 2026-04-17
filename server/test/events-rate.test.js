import { describe, it } from "node:test";
import assert from "node:assert";
import { Hono } from "hono";
import { statsRoutes } from "../src/routes/stats.js";

describe("events-rate endpoint", async () => {
  const app = new Hono();
  statsRoutes(app);

  it("GET /stats/events-rate returns buckets with correct shape", async () => {
    const res = await app.request("/stats/events-rate");
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.buckets));
    assert.ok(typeof data.active === "number");
    assert.ok(typeof data.totalEvents === "number");
    if (data.buckets.length > 0) {
      const b = data.buckets[0];
      assert.ok(typeof b.time === "string"); // "HH:MM" format
      assert.ok(typeof b.turnCount === "number");
      assert.ok(typeof b.agentCount === "number");
    }
  });
});
