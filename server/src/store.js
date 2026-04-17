import { EventEmitter } from "node:events";
import {
  appendFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CC_DATA_DIR || join(__dirname, "..", "..", "data");
const EVENTS_FILE = join(DATA_DIR, "events.jsonl");
const SESSIONS_DIR = join(DATA_DIR, "sessions");

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(SESSIONS_DIR, { recursive: true });

export const bus = new EventEmitter();

export function saveEvent(event) {
  const entry = { ...event, receivedAt: new Date().toISOString() };
  try {
    appendFileSync(EVENTS_FILE, JSON.stringify(entry) + "\n");
  } catch (e) {
    console.error("Failed to write event:", e.message);
  }
  bus.emit("event", entry);
}

export function getEvents(afterId = null, limit = 500) {
  if (!existsSync(EVENTS_FILE)) return [];
  const lines = readFileSync(EVENTS_FILE, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean);

  const parsed = lines.map((line, idx) => {
    try {
      return { ...JSON.parse(line), _idx: idx };
    } catch {
      return null;
    }
  }).filter(Boolean);

  let result = parsed;
  if (afterId !== null) {
    const idx = parsed.findIndex((e) => e._idx === Number(afterId));
    result = idx >= 0 ? parsed.slice(idx + 1) : [];
  }
  return result.slice(-limit);
}

export function saveSession(sessionId, data) {
  try {
    const path = join(SESSIONS_DIR, `${sessionId}.json`);
    const existing = existsSync(path)
      ? JSON.parse(readFileSync(path, "utf-8"))
      : { id: sessionId, events: [], createdAt: new Date().toISOString() };

    Object.assign(existing, data, {
      updatedAt: new Date().toISOString(),
      events: [...existing.events, ...(data.event ? [data.event] : [])],
    });
    appendFileSync(path, JSON.stringify(existing) + "\n");
  } catch (e) {
    console.error("Failed to save session:", e.message);
  }
}

export function getSessions() {
  if (!existsSync(SESSIONS_DIR)) return [];
  return readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const lines = readFileSync(join(SESSIONS_DIR, f), "utf-8").trim().split("\n");
        return JSON.parse(lines[lines.length - 1]);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function getSessionById(id) {
  const path = join(SESSIONS_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    const lines = readFileSync(path, "utf-8").trim().split("\n");
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

export function getEventCount() {
  if (!existsSync(EVENTS_FILE)) return 0;
  return readFileSync(EVENTS_FILE, "utf-8").trim().split("\n").filter(Boolean).length;
}

export function getEventsByType(type, limit = 100) {
  const all = getEvents(null, 1000);
  return all.filter((e) => e.type === type).slice(-limit);
}
