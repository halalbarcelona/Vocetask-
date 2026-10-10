import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeReview, decideStatus } from "../src/agent.js";
import { createApp } from "../src/server.js";
import { createStore } from "../src/store.js";

delete process.env.ANTHROPIC_API_KEY; // force demo mode
const biz = { name: "Test Cafe" };

test("happy review is positive and does not need a human", async () => {
  const a = await analyzeReview({ rating: 5, text: "Great coffee!", author: "Ana Ruiz", platform: "Google" }, biz);
  assert.equal(a.sentiment, "positive");
  assert.equal(a.needs_human, false);
});

test("legal / health threats always escalate", async () => {
  const a = await analyzeReview({ rating: 1, text: "I got food poisoning, calling my lawyer", author: "Bo", platform: "Yelp" }, biz);
  assert.equal(a.needs_human, true);
});

test("model failure falls back to human review instead of losing the review", async () => {
  const client = { messages: { create: async () => { throw new Error("boom"); } } };
  const a = await analyzeReview({ rating: 5, text: "Nice", author: "C", platform: "Google" }, biz, { client });
  assert.equal(a.source, "fallback");
  assert.equal(decideStatus({ rating: 5 }, a, { autopilot: true }), "needs_attention");
});

test("parses structured model output", async () => {
  const out = { sentiment: "negative", topics: ["wait time"], urgency: "medium", needs_human: false, escalation_reason: "", reply: "Sorry about the wait." };
  const client = { messages: { create: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(out) }] }) } };
  const a = await analyzeReview({ rating: 2, text: "Slow", author: "D", platform: "Google" }, biz, { client });
  assert.equal(a.reply, "Sorry about the wait.");
  assert.equal(a.source, "claude");
});

test("autopilot only auto-publishes happy, safe reviews", () => {
  const ok = { sentiment: "positive", needs_human: false, source: "claude" };
  assert.equal(decideStatus({ rating: 5 }, ok, { autopilot: true }), "auto_publish");
  assert.equal(decideStatus({ rating: 5 }, ok, { autopilot: false }), "pending_approval");
  assert.equal(decideStatus({ rating: 3 }, { ...ok, sentiment: "neutral" }, { autopilot: true }), "pending_approval");
});

test("HTTP flow: ingest, approve, publish", async () => {
  const store = createStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ra-")), "db.json"));
  const server = createApp(store).listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    const post = (p, b) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
    const r = await post("/api/reviews", { author: "Eve", rating: 4, text: "Lovely", platform: "Google" });
    assert.equal(r.status, "pending_approval");
    const done = await post(`/api/reviews/${r.id}/approve`);
    assert.equal(done.status, "published");
    const bad = await fetch(base + "/api/reviews", { method: "POST", body: "{}" });
    assert.equal(bad.status, 400);
  } finally { server.close(); }
});

test("APP_PASSWORD gates the app; healthz stays open", async () => {
  process.env.APP_PASSWORD = "s3cret";
  const store = createStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ra-")), "db.json"));
  const server = createApp(store).listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    assert.equal((await fetch(base + "/api/state")).status, 401);
    assert.equal((await fetch(base + "/healthz")).status, 200);
    const ok = "Basic " + Buffer.from("me:s3cret").toString("base64");
    assert.equal((await fetch(base + "/api/state", { headers: { Authorization: ok } })).status, 200);
  } finally { server.close(); delete process.env.APP_PASSWORD; }
});
