import { live } from "@/lib/live";

const DETECT_STALE_MS = 3000;   // กล่องเก่ากว่านี้ไม่วาด (DeepDetect/behavior node หยุด)

// cira_raw_video.py ส่งภาพดิบ (ยังไม่มีกรอบ) มาที่นี่ — เก็บเฉพาะเฟรมล่าสุด
export async function POST(request: Request) {
  try {
    const { jpeg, ts } = await request.json();
    if (typeof jpeg !== "string") throw new Error("missing jpeg");
    live.frame = { seq: (live.frame?.seq ?? 0) + 1, ts: ts ?? Date.now(), jpeg: Buffer.from(jpeg, "base64") };
    return Response.json({ ok: true, seq: live.frame.seq });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}

// GET /api/frame?after=<seq>  -> 204 ถ้ายังไม่มีเฟรมใหม่
// ส่งภาพดิบล่าสุด + กล่องล่าสุด (ใน header X-Meta) ให้เบราว์เซอร์วาดเอง
export async function GET(request: Request) {
  const after = Number(new URL(request.url).searchParams.get("after") ?? -1);
  const f = live.frame;
  if (!f || f.seq <= after) return new Response(null, { status: 204 });

  const d = live.detections;
  const fresh = d && Date.now() - d.receivedAt < DETECT_STALE_MS ? d : null;

  return new Response(new Uint8Array(f.jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store",
      "X-Seq": String(f.seq),
      "X-Meta": encodeURIComponent(JSON.stringify(fresh)),
    },
  });
}
