import { live, type Detections } from "@/lib/live";

// cira_behavior.py ส่งกล่องตรวจจับล่าสุดมาที่นี่ (ไว้วาดทับภาพสด)
export async function POST(request: Request) {
  try {
    const d = (await request.json()) as Detections;
    if (typeof d.w !== "number" || !Array.isArray(d.cats)) throw new Error("expected {w, h, objects, cats}");
    live.detections = { ...d, receivedAt: Date.now() };   // ไม่พึ่งนาฬิกาเครื่อง CiRA
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 400 });
  }
}
