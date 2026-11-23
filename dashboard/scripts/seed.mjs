// สร้างข้อมูลจำลองย้อนหลัง 24 ชม. (แมว 3 ตัว ทุก 5 วินาที) ไว้ทดสอบหน้า dashboard
// รัน: npm run seed   (ลบข้อมูลจำลอง: ลบไฟล์ data/cat.db)
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";

mkdirSync("data", { recursive: true });
const db = new DatabaseSync("data/cat.db");
db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, cat_count INTEGER NOT NULL,
  counts TEXT NOT NULL, cats TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);`);

const BEHAVIORS = ["sleep", "walk", "play", "sit", "eat", "stand", "poop"];
const WEIGHT = [0.45, 0.05, 0.1, 0.2, 0.1, 0.07, 0.03];   // แมวนอนเยอะสุด
const pick = () => {
  let r = Math.random();
  for (let i = 0; i < WEIGHT.length; i++) if ((r -= WEIGHT[i]) < 0) return BEHAVIORS[i];
  return "sleep";
};

const STEP = 5000;
const now = Date.now();
const cats = [0, 1, 2].map((id) => ({ id, behavior: "sleep", present: true, x: 400 + id * 500, y: 700 }));
const insert = db.prepare("INSERT INTO events (ts, cat_count, counts, cats) VALUES (?, ?, ?, ?)");

db.exec("BEGIN");
let n = 0;
for (let ts = now - 24 * 3_600_000; ts <= now; ts += STEP) {
  for (const c of cats) {
    if (Math.random() < 0.004) c.present = !c.present;          // ออก/เข้าห้องนานๆ ครั้ง
    if (Math.random() < 0.02) c.behavior = pick();             // เปลี่ยนพฤติกรรมทุก ~4 นาที
  }
  const visible = cats.filter((c) => c.present);
  const counts = {};
  for (const c of visible) counts[c.behavior] = (counts[c.behavior] ?? 0) + 1;
  const out = visible.map((c) => ({ id: c.id, behavior: c.behavior, conf: 0.95, x: c.x, y: c.y, w: 150, h: 120 }));
  insert.run(ts, visible.length, JSON.stringify(counts), JSON.stringify(out));
  n++;
}
db.exec("COMMIT");
console.log(`seeded ${n} events`);
