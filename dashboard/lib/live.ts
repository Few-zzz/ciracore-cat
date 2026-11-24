// ข้อมูลสด เก็บในหน่วยความจำ (ไม่บันทึกลงดิสก์) — ใช้ globalThis กัน hot reload ล้างค่า
export type Box = { name?: string; id?: number; behavior?: string; conf: number; x: number; y: number; w: number; h: number };
export type Detections = { ts: number; w: number; h: number; objects: Box[]; cats: Box[] };

type Live = {
  frame?: { seq: number; ts: number; jpeg: Buffer };   // ภาพดิบจาก cira_raw_video.py
  detections?: Detections & { receivedAt: number };   // กล่องจาก cira_behavior.py (เวลาฝั่ง server)
  waiters?: Set<() => void>;                           // เบราว์เซอร์ที่รอเฟรมใหม่อยู่ (long-poll)
};

const g = globalThis as unknown as { catLive?: Live };
export const live: Live = (g.catLive ??= {});
live.waiters ??= new Set();

// ปลุกทุกคนที่รอเฟรมใหม่
export function notifyFrame() {
  for (const wake of live.waiters!) wake();
  live.waiters!.clear();
}

// รอจนกว่าจะมีเฟรมใหม่ หรือครบ timeoutMs (คืน true ถ้ามีเฟรมใหม่)
export function waitForFrame(after: number, timeoutMs: number): Promise<boolean> {
  if ((live.frame?.seq ?? 0) > after) return Promise.resolve(true);
  return new Promise((resolve) => {
    const wake = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      live.waiters!.delete(wake);
      resolve(false);
    }, timeoutMs);
    live.waiters!.add(wake);
  });
}
