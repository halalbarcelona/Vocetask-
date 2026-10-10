import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.js";
import { analyzeReview, decideStatus, MODEL } from "./agent.js";
import { publishReply } from "./platforms.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, "..", "public");

export function createApp(store = createStore()) {
  async function handleReview(review) {
    store.update(review.id, { status: "analyzing" });
    const analysis = await analyzeReview(review, store.business);
    const status = decideStatus(review, analysis, store.settings);
    let patch = { analysis, draft: analysis.reply, status };
    if (status === "auto_publish") {
      patch = { ...patch, status: "published", published: await publishReply(review, analysis.reply), publishedReply: analysis.reply };
    }
    return store.update(review.id, patch);
  }

  const json = (res, code, body) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let s = "";
      req.on("data", (c) => { s += c; if (s.length > 1e6) reject(new Error("too large")); });
      req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
    });

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    try {
      if (p === "/api/state" && req.method === "GET")
        return json(res, 200, { business: store.business, settings: store.settings, reviews: store.list(), live: hasKey(), model: MODEL });

      if (p === "/api/reviews" && req.method === "POST") {
        const token = process.env.INGEST_TOKEN;
        if (token && req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { error: "unauthorized" });
        const b = await readBody(req);
        if (!b.text || !Number.isFinite(+b.rating)) return json(res, 400, { error: "text and rating required" });
        const rec = store.add({ platform: b.platform || "Manual", author: b.author || "Anonymous", rating: Math.min(5, Math.max(1, +b.rating)), text: String(b.text) });
        return json(res, 201, await handleReview(rec));
      }

      if (p === "/api/process-all" && req.method === "POST") {
        const todo = store.list().filter((r) => r.status === "new");
        for (const r of todo) await handleReview(r);
        return json(res, 200, { processed: todo.length });
      }

      if (p === "/api/settings" && req.method === "PUT") {
        const b = await readBody(req);
        if (b.business) store.setBusiness(b.business);
        if (b.settings) store.setSettings({ autopilot: !!b.settings.autopilot });
        return json(res, 200, { business: store.business, settings: store.settings });
      }

      const m = p.match(/^\/api\/reviews\/([^/]+)\/(draft|approve|reject|regenerate)$/);
      if (m && req.method === "POST") {
        const review = store.get(m[1]);
        if (!review) return json(res, 404, { error: "not found" });
        if (m[2] === "draft") {
          const b = await readBody(req);
          return json(res, 200, store.update(review.id, { draft: String(b.draft || "") }));
        }
        if (m[2] === "reject") return json(res, 200, store.update(review.id, { status: "ignored" }));
        if (m[2] === "regenerate") return json(res, 200, await handleReview(review));
        if (!review.draft?.trim()) return json(res, 400, { error: "empty reply" });
        const published = await publishReply(review, review.draft);
        return json(res, 200, store.update(review.id, { status: "published", published, publishedReply: review.draft }));
      }

      // static files
      const file = path.join(PUBLIC, p === "/" ? "index.html" : p);
      if (file.startsWith(PUBLIC) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { "Content-Type": file.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain" });
        return res.end(fs.readFileSync(file));
      }
      json(res, 404, { error: "not found" });
    } catch (e) {
      json(res, 500, { error: e.message });
    }
  });
}

const hasKey = () => !!process.env.ANTHROPIC_API_KEY;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +process.env.PORT || 3000;
  createApp().listen(port, () =>
    console.log(`Review agent on http://localhost:${port} (${hasKey() ? "Claude " + MODEL : "demo mode - set ANTHROPIC_API_KEY for AI replies"})`)
  );
}
