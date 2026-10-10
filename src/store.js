import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SEED_REVIEWS, DEFAULT_BUSINESS } from "./seed.js";

export function createStore(file = path.join(process.cwd(), "data", "db.json")) {
  let db;
  try {
    db = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    db = { business: DEFAULT_BUSINESS, settings: { autopilot: false }, reviews: SEED_REVIEWS.map(withId) };
    save();
  }
  function withId(r) {
    return { id: randomUUID(), status: "new", createdAt: new Date().toISOString(), ...r };
  }
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db, null, 2));
  }
  return {
    get business() { return db.business; },
    get settings() { return db.settings; },
    list: () => db.reviews,
    get: (id) => db.reviews.find((r) => r.id === id),
    add(r) { const rec = withId(r); db.reviews.unshift(rec); save(); return rec; },
    update(id, patch) { const r = db.reviews.find((x) => x.id === id); if (r) { Object.assign(r, patch); save(); } return r; },
    setBusiness(b) { db.business = { ...db.business, ...b }; save(); },
    setSettings(s) { db.settings = { ...db.settings, ...s }; save(); },
  };
}
