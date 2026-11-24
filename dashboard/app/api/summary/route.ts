import { db, type EventRow } from "@/lib/db";
import { BEHAVIORS, RANGES, type RangeKey } from "@/lib/behaviors";
import { pullFromSheet, sheetStatus } from "@/lib/sheets";

const GAP_CAP_MS = 60_000;   // ช่องว่างเกินนี้ถือว่าไม่มีข้อมูล (CiRA ปิด) ไม่นับเวลา
const STALE_MS = 30_000;     // ไม่มีข้อมูลใหม่เกินนี้ถือว่าขาดการเชื่อมต่อ

// สรุปข้อมูลสำหรับแสดงผล (รวมตามช่วงเวลา) — พฤติกรรมคิดมาแล้วจาก CiRA
export async function GET(request: Request) {
  const key = (new URL(request.url).searchParams.get("range") ?? "1h") as RangeKey;
  const range = RANGES[key] ?? RANGES["1h"];
  // เปิดเว็บ -> ดึงนาทีที่ขาดจาก Google Sheet มาเติมก่อน (เว้นช่วงทุก 5 นาที ไม่ดึงทุกครั้งที่ poll)
  await pullFromSheet();
  const now = Date.now();
  const from = now - range.ms;

  const rows = db()
    .prepare("SELECT ts, cat_count, counts, cats FROM events WHERE ts >= ? ORDER BY ts")
    .all(from) as EventRow[];
  const latestRow = db()
    .prepare("SELECT ts, cat_count, counts, cats FROM events ORDER BY ts DESC LIMIT 1")
    .get() as EventRow | undefined;

  const nBuckets = Math.ceil(range.ms / range.bucketMs);
  const sums = Array.from({ length: nBuckets }, () => ({ covered: 0, cats: Object.fromEntries(BEHAVIORS.map((b) => [b, 0])) }));
  const catMs: Record<string, number> = Object.fromEntries(BEHAVIORS.map((b) => [b, 0]));
  let monitoredMs = 0;
  let absentMs = 0;

  rows.forEach((r, i) => {
    // แต่ละ sample แทนช่วงเวลาจนถึง sample ถัดไป (ถ่วงน้ำหนักด้วยเวลา)
    const next = i + 1 < rows.length ? rows[i + 1].ts : now;
    const dt = Math.min(next - r.ts, GAP_CAP_MS);
    const counts = JSON.parse(r.counts) as Record<string, number>;
    const bucket = sums[Math.min(Math.floor((r.ts - from) / range.bucketMs), nBuckets - 1)];

    monitoredMs += dt;
    bucket.covered += dt;
    if (r.cat_count === 0) absentMs += dt;
    for (const b of BEHAVIORS) {
      const c = counts[b] ?? 0;
      catMs[b] += c * dt;
      bucket.cats[b] += c * dt;
    }
  });

  const buckets = sums.map((s, i) => ({
    t: from + i * range.bucketMs,
    // จำนวนแมวเฉลี่ยในแต่ละพฤติกรรม ระหว่างช่วงที่มีข้อมูล (null = ไม่มีข้อมูล)
    ...Object.fromEntries(BEHAVIORS.map((b) => [b, s.covered ? +(s.cats[b] / s.covered).toFixed(2) : null])),
  }));

  return Response.json({
    now,
    range: key in RANGES ? key : "1h",
    bucketMs: range.bucketMs,
    latest: latestRow && {
      ts: latestRow.ts,
      cat_count: latestRow.cat_count,
      counts: JSON.parse(latestRow.counts),
      cats: JSON.parse(latestRow.cats),
    },
    stale: !latestRow || now - latestRow.ts > STALE_MS,
    buckets,
    catMinutes: Object.fromEntries(BEHAVIORS.map((b) => [b, +(catMs[b] / 60_000).toFixed(1)])),
    monitoredMinutes: +(monitoredMs / 60_000).toFixed(1),
    absentMinutes: +(absentMs / 60_000).toFixed(1),
    samples: rows.length,
    sheet: sheetStatus(),
  });
}
