// พฤติกรรม = คลาส Cat_* ของโมเดล (cira_behavior.py แปลง Cat_Sleep -> "sleep" ฯลฯ)
// ลำดับคงที่ = ลำดับสี (ห้ามสลับ สีจะตามพฤติกรรมเสมอ)
export const BEHAVIORS = ["sleep", "walk", "play", "sit", "eat", "stand", "poop"] as const;
export type Behavior = (typeof BEHAVIORS)[number];

export const LABEL: Record<Behavior, string> = {
  sleep: "นอน",
  walk: "เดิน",
  play: "เล่น",
  sit: "นั่ง",
  eat: "กินอาหาร",
  stand: "ยืน",
  poop: "ขับถ่าย",
};

// categorical palette 7 สี (ผ่าน validator ทั้ง light/dark) — light / dark เป็นสเต็ปของ hue เดียวกัน
export const COLOR: Record<"light" | "dark", Record<Behavior, string>> = {
  light: { sleep: "#2a78d6", walk: "#eb6834", play: "#1baf7a", sit: "#eda100", eat: "#e87ba4", stand: "#008300", poop: "#6250d6" },
  dark: { sleep: "#3987e5", walk: "#d95926", play: "#199e70", sit: "#c98500", eat: "#d55181", stand: "#0ca30c", poop: "#9085e9" },
};

// ชื่อสิ่งของที่โมเดลตรวจจับ (ใช้ตอนวาดบนภาพสด) — ชื่ออื่นที่ไม่รู้จักจะแสดงตามเดิม
export const OBJECT_LABEL: Record<string, string> = {
  bed: "เตียง",
  bowl: "ชามอาหาร",
  poop: "อึ",
  sandbox: "กระบะทราย",
  toy: "ของเล่น",
};
export const objectLabel = (name = "") => OBJECT_LABEL[name.toLowerCase()] ?? name;

export const RANGES = {
  "1h": { label: "1 ชม.", ms: 3_600_000, bucketMs: 2 * 60_000 },
  "6h": { label: "6 ชม.", ms: 6 * 3_600_000, bucketMs: 10 * 60_000 },
  "24h": { label: "24 ชม.", ms: 24 * 3_600_000, bucketMs: 30 * 60_000 },
  "7d": { label: "7 วัน", ms: 7 * 24 * 3_600_000, bucketMs: 4 * 3_600_000 },
} as const;
export type RangeKey = keyof typeof RANGES;
