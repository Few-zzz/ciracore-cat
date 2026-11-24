// ดึงข้อมูลพฤติกรรมรายนาทีจาก Google Sheet (ที่ cira_behavior.py บันทึกไว้) กลับมาเติมฐานข้อมูลในเครื่อง
// เว็บแค่อ่าน ไม่เขียนลง Sheet — เติมเฉพาะนาทีที่ในเครื่องไม่มีข้อมูล (เช่น ย้ายเครื่อง / ลบ cat.db / เว็บปิดอยู่ตอน CiRA ทำงาน)
// ตั้งค่าใน .env.local: SHEETS_URL=<Web app URL ลงท้าย /exec>  SHEETS_SECRET=<รหัสเดียวกับใน Apps Script>
import { db } from "@/lib/db";
import { BEHAVIORS } from "@/lib/behaviors";

const URL_ = process.env.SHEETS_URL;
const SECRET = process.env.SHEETS_SECRET;

const MINUTE = 60_000;
const KEEP_MS = 7 * 24 * 3_600_000;   // ดึงย้อนหลังไม่เกิน 7 วัน (ช่วงยาวสุดบนหน้าเว็บ)
const PULL_EVERY_MS = 5 * 60_000;     // เปิดเว็บซ้ำภายในช่วงนี้ไม่ต้องดึงใหม่ (Apps Script ตอบช้า 1-3 วิ)

// แถวจาก Sheet: [minute_ts, datetime(null), monitored_s, cat_count, sleep, walk, play, sit, eat, stand, poop]
type Row = [number, null, number, number, ...number[]];

export type SheetStatus = {
  enabled: boolean;
  lastPullAt: number | null;   // เวลาที่ดึงสำเร็จล่าสุด
  lastMinute: number;          // นาทีล่าสุดที่มีใน Sheet
  restored: number;            // จำนวนนาทีที่เติมเข้าเครื่องไปแล้ว (รวมทุกครั้ง)
  error: string | null;
};

type State = SheetStatus & { busy?: Promise<void> };
const g = globalThis as unknown as { catSheet?: State };
const state = (g.catSheet ??= { enabled: Boolean(URL_ && SECRET), lastPullAt: null, lastMinute: 0, restored: 0, error: null });

export const sheetStatus = (): SheetStatus => ({
  enabled: state.enabled,
  lastPullAt: state.lastPullAt,
  lastMinute: state.lastMinute,
  restored: state.restored,
  error: state.error,
});

async function fetchRows(after: number): Promise<{ rows: Row[]; last: number }> {
  const res = await fetch(`${URL_}?secret=${encodeURIComponent(SECRET!)}&after=${after}`, {
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let json: { error?: string; rows?: Row[]; last?: number };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Apps Script ตอบไม่ใช่ JSON (HTTP ${res.status}) — ตรวจ SHEETS_URL และว่า Deploy ให้ "Anyone" เข้าถึง`);
  }
  if (json.error) throw new Error(`Apps Script: ${json.error}`);
  return { rows: json.rows ?? [], last: Number(json.last) || 0 };
}

async function pull() {
  // ครั้งแรกดึง 7 วัน ครั้งต่อไปดึงเฉพาะนาทีที่ใหม่กว่าที่เคยเห็น
  const after = Math.max(state.lastMinute, Date.now() - KEEP_MS);
  const { rows, last } = await fetchRows(after);

  const has = db().prepare("SELECT 1 FROM events WHERE ts >= ? AND ts < ? LIMIT 1");
  const insert = db().prepare("INSERT INTO events (ts, cat_count, counts, cats) VALUES (?, ?, ?, '[]')");
  let n = 0;
  db().exec("BEGIN");
  try {
    for (const [m, , , catCount, ...vals] of rows) {
      if (has.get(m, m + MINUTE)) continue;   // นาทีนี้เว็บได้รับจาก CiRA เองแล้ว ไม่เติมซ้ำ
      // 1 แถวต่อนาที -> api/summary นับแถวละ 60 วิ (GAP_CAP) ได้ค่าเฉลี่ยเท่ากับใน Sheet
      const counts = Object.fromEntries(BEHAVIORS.map((b, i) => [b, vals[i]]).filter(([, v]) => Number(v) > 0));
      insert.run(m, catCount, JSON.stringify(counts));
      n++;
    }
    db().exec("COMMIT");
  } catch (e) {
    db().exec("ROLLBACK");
    throw e;
  }

  state.lastMinute = Math.max(state.lastMinute, last);
  state.restored += n;
  state.lastPullAt = Date.now();
  state.error = null;
  if (n) console.log(`[sheets] เติมข้อมูลจาก Google Sheet ${n} นาที`);
}

// เรียกตอนเซิร์ฟเวอร์เริ่ม และทุกครั้งที่หน้าเว็บขอสรุป (เว้นช่วง PULL_EVERY_MS)
// force = รอจนดึงเสร็จ (ใช้ตอนเปิดเว็บ เพื่อให้กราฟรวมข้อมูลจาก Sheet แล้ว)
export async function pullFromSheet(force = false): Promise<void> {
  if (!state.enabled) return;
  if (!force && state.lastPullAt && Date.now() - state.lastPullAt < PULL_EVERY_MS) return;
  state.busy ??= pull()
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== state.error) console.error("[sheets]", msg);
      state.error = msg;
      state.lastPullAt = Date.now();   // พลาดแล้วไม่ยิงซ้ำทุก 5 วิ รอรอบหน้า
    })
    .finally(() => {
      state.busy = undefined;
    });
  await state.busy;
}

export function startSheetPull() {
  if (!state.enabled) {
    console.log("[sheets] ไม่ได้ตั้ง SHEETS_URL / SHEETS_SECRET ใน .env.local — ไม่ดึงข้อมูลจาก Google Sheet");
    return;
  }
  void pullFromSheet(true);   // ไม่ await: ไม่ให้เซิร์ฟเวอร์รอ Google ก่อนเปิด
}
