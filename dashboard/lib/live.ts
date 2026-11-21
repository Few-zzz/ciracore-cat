// ข้อมูลสด เก็บในหน่วยความจำ (ไม่บันทึกลงดิสก์) — ใช้ globalThis กัน hot reload ล้างค่า
export type Box = { name?: string; id?: number; behavior?: string; conf: number; x: number; y: number; w: number; h: number };
export type Detections = { ts: number; w: number; h: number; objects: Box[]; cats: Box[] };

type Live = {
  frame?: { seq: number; ts: number; jpeg: Buffer };   // ภาพดิบจาก cira_raw_video.py
  detections?: Detections & { receivedAt: number };   // กล่องจาก cira_behavior.py (เวลาฝั่ง server)
};

const g = globalThis as unknown as { catLive?: Live };
export const live: Live = (g.catLive ??= {});
