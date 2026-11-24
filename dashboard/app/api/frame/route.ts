import { live, notifyFrame, waitForFrame } from "@/lib/live";

const DETECT_STALE_MS = 3000;   // กล่องเก่ากว่านี้ไม่วาด (DeepDetect/behavior node หยุด)
const WAIT_MS = 1000;           // ไม่มีเฟรมใหม่ รอได้นานสุดเท่านี้แล้วค่อยตอบ 204

// cira_raw_video.py ส่งภาพดิบ (ยังไม่มีกรอบ) มาที่นี่ — เก็บเฉพาะเฟรมล่าสุด
export async function POST(request: Request) {
  try {
    const { jpeg, ts } = await request.json();
    if (typeof jpeg !== "string") throw new Error("missing jpeg");
    live.frame = { seq: (live.frame?.seq ?? 0) + 1, ts: ts ?? Date.now(), jpeg: Buffer.from(jpeg, "base64") };
    notifyFrame();
    return Response.json({ ok: true, seq: live.frame.seq });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}

// GET /api/frame?after=<seq>  -> รอจนมีเฟรมใหม่ (long-poll) ส่งทันทีที่มา, 204 ถ้ารอครบ WAIT_MS แล้วยังไม่มี
// ส่งภาพดิบล่าสุด + กล่องล่าสุด (ใน header X-Meta) ให้เบราว์เซอร์วาดเอง
export async function GET(request: Request) {
  const after = Number(new URL(request.url).searchParams.get("after") ?? -1);
  await waitForFrame(after, WAIT_MS);
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
