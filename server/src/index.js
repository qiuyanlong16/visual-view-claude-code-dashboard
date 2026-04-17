import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { eventRoutes } from "./routes/events.js";
import { sessionRoutes } from "./routes/sessions.js";
import { memoryRoutes } from "./routes/memory.js";
import { statsRoutes } from "./routes/stats.js";
import { realtimeRoutes } from "./routes/realtime.js";
import { setupRoutes, autoSetupHooks } from "./routes/setup.js";

const app = new Hono();

app.use("*", cors());
app.get("/health", (c) => c.json({ status: "ok" }));

eventRoutes(app);
sessionRoutes(app);
memoryRoutes(app);
statsRoutes(app);
realtimeRoutes(app);
setupRoutes(app);

serve({ fetch: app.fetch, port: 3456 }, async (info) => {
  console.log(`Event server listening on :${info.port}`);
  await autoSetupHooks();
});
