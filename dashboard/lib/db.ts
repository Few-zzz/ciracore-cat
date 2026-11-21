import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

// SQLite ในตัว Node 24 (ไม่ต้องลง native module) ไฟล์อยู่ที่ dashboard/data/cat.db
const DB_PATH = process.env.CAT_DB ?? path.join(process.cwd(), "data", "cat.db");

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY,
  ts        INTEGER NOT NULL,          -- epoch ms จาก CiRA
  cat_count INTEGER NOT NULL,
  counts    TEXT    NOT NULL,          -- JSON {"resting": 2, ...}
  cats      TEXT    NOT NULL           -- JSON [{id, behavior, conf, x, y, w, h}]
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
`;

// เก็บ connection ไว้ใน globalThis กัน hot reload เปิดซ้ำตอน dev
const g = globalThis as unknown as { catDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.catDb) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    g.catDb = new DatabaseSync(DB_PATH);
    g.catDb.exec("PRAGMA journal_mode = WAL;");
    g.catDb.exec(SCHEMA);
  }
  return g.catDb;
}

export type CatBehavior = {
  ts: number;
  cat_count: number;
  counts: Record<string, number>;
  cats: { id: number; behavior: string; conf: number; x: number; y: number; w: number; h: number }[];
};

export type EventRow = { ts: number; cat_count: number; counts: string; cats: string };
