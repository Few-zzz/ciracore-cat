import { db, type CatBehavior } from "@/lib/db";

// CiRA CORE (Python+) POST ผล CatBehavior มาที่นี่ — แค่บันทึก ไม่คำนวณอะไร
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const items = (Array.isArray(body) ? body : [body]) as CatBehavior[];
  const valid = items.filter((e) => e && typeof e.ts === "number" && typeof e.cat_count === "number");
  if (valid.length === 0) {
    return Response.json({ error: "expected {ts, cat_count, counts, cats}" }, { status: 400 });
  }

  const insert = db().prepare("INSERT INTO events (ts, cat_count, counts, cats) VALUES (?, ?, ?, ?)");
  for (const e of valid) {
    insert.run(e.ts, e.cat_count, JSON.stringify(e.counts ?? {}), JSON.stringify(e.cats ?? []));
  }
  return Response.json({ ok: true, inserted: valid.length });
}
